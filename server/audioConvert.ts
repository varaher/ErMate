import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

/**
 * server/audioConvert.ts
 *
 * Ported from the old ErMate app, unchanged. Normalizes any incoming
 * audio format into 16kHz mono 16-bit PCM WAV before it reaches
 * Sarvam — removes format/codec variability across browsers/devices
 * so Sarvam always receives a predictable, clean input.
 *
 * PAIRS WITH: server/sarvamClient.ts (ported earlier). Call this
 * FIRST, then pass its output into sarvamSpeechToText() — see
 * integration block at the bottom of this file.
 *
 * DEPLOYMENT REQUIREMENT — CONFIRM BEFORE TRUSTING THIS RUNS:
 * This shells out to the `ffmpeg` binary via execFile. If ffmpeg is
 * NOT installed in the production container, every call fails
 * silently (falls through to the catch block below) and returns the
 * ORIGINAL unconverted audio with no error thrown anywhere. This
 * means the conversion step can silently do nothing while looking
 * completely healthy. Verify in the actual deployed Cloud Run
 * container — not just locally — with:
 *   `which ffmpeg` or `ffmpeg -version`
 * If missing, add it to the Dockerfile, e.g. for a Debian-based image:
 *   RUN apt-get update && apt-get install -y ffmpeg
 */

export async function convertAudioToWavOld(
  audioBuffer: Buffer,
  originalFilename: string = "recording.webm"
): Promise<{ buffer: Buffer; filename: string }> {
  const ext = path.extname(originalFilename).toLowerCase();

  if (ext === ".wav") {
    return { buffer: audioBuffer, filename: originalFilename };
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `voice_input_${timestamp}${ext || ".bin"}`);
  const outputPath = path.join(tmpDir, `voice_output_${timestamp}.wav`);

  try {
    fs.writeFileSync(inputPath, audioBuffer);

    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", "-f", "wav", outputPath],
      { timeout: 30000 }
    );

    const wavBuffer = fs.readFileSync(outputPath);
    console.log(
      `[AudioConvert] Converted ${originalFilename} (${audioBuffer.length} bytes) -> WAV (${wavBuffer.length} bytes)`
    );
    return { buffer: wavBuffer, filename: originalFilename.replace(/\.[^.]+$/, ".wav") };
  } catch (error) {
    console.error("[AudioConvert] ffmpeg conversion failed:", error);
    console.log("[AudioConvert] Returning original audio as fallback");
    return { buffer: audioBuffer, filename: originalFilename };
  } finally {
    try {
      fs.unlinkSync(inputPath);
    } catch {}
    try {
      fs.unlinkSync(outputPath);
    } catch {}
  }
}

export async function convertAndChunkAudioToWav(
  audioBuffer: Buffer,
  originalFilename: string = "recording.webm"
): Promise<{ buffer: Buffer; filename: string }[]> {
  const ext = path.extname(originalFilename).toLowerCase();
  
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `voice_input_${timestamp}${ext || ".bin"}`);
  const outputPattern = path.join(tmpDir, `voice_output_${timestamp}_%03d.wav`);

  try {
    fs.writeFileSync(inputPath, audioBuffer);

    const intermediateWav = path.join(tmpDir, `voice_intermediate_${timestamp}.wav`);
    
    // 1. Convert to 16kHz mono WAV first
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", intermediateWav],
      { timeout: 60000 }
    );
    
    // 2. Perform silence detection to avoid cutting mid-sentence
    let stderr = "";
    try {
      const result = await execFileAsync(
        "ffmpeg",
        ["-i", intermediateWav, "-af", "silencedetect=noise=-30dB:d=0.5", "-f", "null", "-"],
        { timeout: 60000 }
      );
      stderr = result.stderr;
    } catch (err: any) {
      stderr = err.stderr || ""; // ffmpeg often exits with an error code on null muxer, so we catch its stderr
    }

    const silenceMatches = [...stderr.matchAll(/silence_start: ([\d\.]+)/g)];
    const silenceStarts = silenceMatches.map(m => parseFloat(m[1]));

    let duration = 0;
    const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):([\d\.]+)/);
    if (durationMatch) {
      duration = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3]);
    }

    let splitTimes: number[] = [];
    const MIN_CHUNK_DUR = 12; // Try to get at least 12 seconds per chunk
    const MAX_CHUNK_DUR = 25; // Force split if no silence is found within 25s window

    if (duration > 0 && silenceStarts.length > 0) {
      let currentTime = 0;
      while (currentTime < duration) {
         const minSearch = currentTime + MIN_CHUNK_DUR;
         const maxSearch = currentTime + MAX_CHUNK_DUR;
         
         // Find silences in the optimal split window
         const validSilences = silenceStarts.filter(t => t >= minSearch && t <= maxSearch);
         
         if (validSilences.length > 0) {
             const splitPoint = validSilences[0]; // Cut at the first silence in the window
             splitTimes.push(splitPoint);
             currentTime = splitPoint;
         } else {
             // If someone speaks non-stop for 25s without a 0.5s pause, force a blind cut
             if (maxSearch < duration) {
                 splitTimes.push(maxSearch);
                 currentTime = maxSearch;
             } else {
                 break; // We've reached the end
             }
         }
      }
    }

    // 3. Segment the file based on calculated silence times, or fallback to fixed 15s
    if (splitTimes.length > 0) {
      const segmentTimes = splitTimes.join(",");
      await execFileAsync(
        "ffmpeg",
        [
          "-y", 
          "-i", intermediateWav, 
          "-f", "segment", 
          "-segment_times", segmentTimes,
          "-c", "copy",
          outputPattern
        ],
        { timeout: 60000 }
      );
    } else {
      // Fallback: original blind 15-second split if silence detection completely failed
      await execFileAsync(
        "ffmpeg",
        [
          "-y", 
          "-i", intermediateWav, 
          "-f", "segment", 
          "-segment_time", "15",
          "-c", "copy",
          outputPattern
        ],
        { timeout: 60000 }
      );
    }
    
    try { fs.unlinkSync(intermediateWav); } catch {}

    const chunks: { buffer: Buffer; filename: string }[] = [];
    for (let i = 0; i < 1000; i++) {
      const idx = i.toString().padStart(3, "0");
      const chunkPath = path.join(tmpDir, `voice_output_${timestamp}_${idx}.wav`);
      if (fs.existsSync(chunkPath)) {
        const wavBuffer = fs.readFileSync(chunkPath);
        chunks.push({ buffer: wavBuffer, filename: `chunk_${idx}.wav` });
        try { fs.unlinkSync(chunkPath); } catch {}
      } else {
        break;
      }
    }

    console.log(
      `[AudioConvert] Converted and chunked ${originalFilename} (${audioBuffer.length} bytes) -> ${chunks.length} chunks`
    );

    return chunks;

  } catch (error) {
    console.error("[AudioConvert] ffmpeg chunking failed:", error);
    return [{ buffer: audioBuffer, filename: originalFilename }];
  } finally {
    try {
      fs.unlinkSync(inputPath);
    } catch {}
  }
}
