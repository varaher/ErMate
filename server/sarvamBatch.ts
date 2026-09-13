import { getFfmpegPath } from "./ffmpegPath.ts";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { getErMateApiKey } from "./sarvamClient";

const SARVAM_API_BASE = "https://api.sarvam.ai";

export async function sarvamBatchTranscribe(
  audioBuffer: Buffer,
  filename: string,
  mode: string = "translate"
): Promise<{ success: boolean; transcript: string; method: string }> {
  const apiKey = getErMateApiKey();
  if (!apiKey) {
    throw new Error("ErMate AI API key not configured. Transcription disabled.");
  }

  // Do not log the filename to ensure absolutely no PHI (e.g. if the file is named with patient info) is exposed in logs
  console.log(`[SarvamBatch] Starting batch transcription job (size: ${audioBuffer.length} bytes), mode: ${mode}`);

  const timestamp = Date.now();
  const safeFilename = `audio_${timestamp}.wav`; // Target must be .wav
  const tmpDir = os.tmpdir();
  const tmpInputPath = path.join(tmpDir, `input_${timestamp}.webm`);
  const tmpWavPath = path.join(tmpDir, safeFilename);
  
  let normalizedBuffer: Buffer | null = null;
  
  try {
    // Write raw browser buffer to a temporary input file
    fs.writeFileSync(tmpInputPath, audioBuffer);
    
    // Normalize using FFmpeg
    await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(getFfmpegPath(), [
            "-y",
            "-i", tmpInputPath,
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "pcm_s16le",
            tmpWavPath
        ]);
        ffmpeg.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg failed to normalize audio with code ${code}`));
        });
        ffmpeg.on("error", reject);
    });
    
    normalizedBuffer = fs.readFileSync(tmpWavPath);
    if (!normalizedBuffer || normalizedBuffer.length === 0) {
        throw new Error("Normalized WAV buffer is empty.");
    }

    // 1. Create/initiate job
    // NOTE: For automatic language detection in Batch, we omit the language_code entirely.
    const initReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1`, {
        method: "POST",
        headers: {
            "api-subscription-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            job_parameters: {
                model: "saaras:v3",
                mode: mode
            }
        })
    });

    if (!initReq.ok) {
        const errText = await initReq.text();
        throw new Error(`Failed to create batch job: ${initReq.status} ${errText}`);
    }
    const initRes = await initReq.json();
    const jobId = initRes.job_id;
    if (!jobId) throw new Error("Invalid response: No job_id returned from job creation.");

    // 2. Obtain presigned upload URL
    const uploadFilesReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/upload-files`, {
        method: "POST",
        headers: {
            "api-subscription-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            job_id: jobId,
            files: [safeFilename]
        })
    });

    if (!uploadFilesReq.ok) {
        const errText = await uploadFilesReq.text();
        throw new Error(`Failed to get batch upload URLs: ${errText}`);
    }
    const uploadRes = await uploadFilesReq.json();
    const uploadUrlObj = uploadRes.upload_urls?.[safeFilename];
    const uploadUrl = uploadUrlObj?.file_url;
    if (!uploadUrl) throw new Error("No presigned upload URL found in response.");

    // 3. PUT the audio file to the presigned upload URL
    const putReq = await fetch(uploadUrl, {
        method: "PUT",
        body: normalizedBuffer,
        headers: {
            "x-ms-blob-type": "BlockBlob",
            "Content-Length": String(normalizedBuffer.length)
        }
    });

    if (!putReq.ok) {
        const errText = await putReq.text();
        throw new Error(`Failed to upload audio to Sarvam storage: ${putReq.status} ${errText}`);
    }

    // 4. Start the job
    const startReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/${jobId}/start`, {
        method: "POST",
        headers: {
            "api-subscription-key": apiKey,
            "Content-Type": "application/json"
        }
    });

    if (!startReq.ok) {
        const errText = await startReq.text();
        throw new Error(`Failed to start batch job processing: ${startReq.status} ${errText}`);
    }

    // 5. Poll the job status
    let status = "in_progress";
    let pollAttempts = 0;
    const maxAttempts = 60; // 5 minutes max at 5-second intervals
    let jobDetails: any = {};

    while (pollAttempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        pollAttempts++;

        const statusReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/${jobId}/status`, {
            method: "GET",
            headers: { "api-subscription-key": apiKey },
        });

        if (!statusReq.ok) continue;

        jobDetails = await statusReq.json();
        status = jobDetails.job_state || jobDetails.status || jobDetails.state || status;

        
        if (status === "Completed" || status === "completed" || status === "success" || status === "done") {
            if (jobDetails.failed_files_count > 0 || jobDetails.successful_files_count === 0) {
                 const errDetail = jobDetails.job_details?.[0]?.error_message || "Unknown upstream error";
                 throw new Error(`ErMate Batch Dictation Error: ${errDetail}`);
            }
            break;
        } else if (status === "Failed" || status === "failed" || status === "error") {
            throw new Error("ErMate Batch Dictation Error: The upstream processing engine failed to transcribe the audio.");
        }

    }

    if (pollAttempts >= maxAttempts || (status !== "Completed" && status !== "completed" && status !== "success" && status !== "done")) {
        throw new Error("ErMate Batch Dictation Timeout: The processing took too long and timed out. Please try dictating again.");
    }

    
    // 6. Read the output filename from the completed job details
    let outputFilename = null;
    if (jobDetails.job_details && jobDetails.job_details.length > 0) {
        const details = jobDetails.job_details[0];
        if (details.outputs && details.outputs.length > 0) {
            outputFilename = details.outputs[0].file_name || details.outputs[0].name;
        }
    }
    
    // Default fallback
    if (!outputFilename) {
         outputFilename = `0.json`;
    }


    // 7. POST download-files
    const downloadReq = await fetch(`${SARVAM_API_BASE}/speech-to-text/job/v1/download-files`, {
        method: "POST",
        headers: {
            "api-subscription-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            job_id: jobId,
            files: [outputFilename]
        })
    });

    if (!downloadReq.ok) {
         throw new Error(`ErMate Batch Dictation Error: Failed to retrieve transcription download URL.`);
    }

    const downloadRes = await downloadReq.json();
    const downloadUrlObj = downloadRes.download_urls?.[outputFilename];
    const transcriptUrl = downloadUrlObj?.file_url;

    if (!transcriptUrl) {
        throw new Error("ErMate Batch Dictation Error: Transcription completed but download URL was missing.");
    }

    // 8. Download the returned result JSON and extract transcript
    const transcriptDataReq = await fetch(transcriptUrl);
    if (!transcriptDataReq.ok) {
        throw new Error("ErMate Batch Dictation Error: Failed to download the final transcript JSON.");
    }

    const transcriptData = await transcriptDataReq.json();
    
    // Handle standard Sarvam output schema
    let finalTranscript = "";
    if (transcriptData.transcript) finalTranscript = transcriptData.transcript;
    else if (transcriptData.text) finalTranscript = transcriptData.text;
    else if (Array.isArray(transcriptData) && transcriptData[0]?.transcript) finalTranscript = transcriptData[0].transcript;
    else if (transcriptData.outputs && transcriptData.outputs[0]?.transcript) finalTranscript = transcriptData.outputs[0].transcript;

    if (!finalTranscript) {
        throw new Error("ErMate Batch Dictation Error: Transcription completed but the returned result was empty.");
    }

    console.log("[SarvamBatch] Successfully completed batch transcription.");

    return {
        success: true,
        transcript: finalTranscript.trim(),
        method: "ermate_voice_batch"
    };

  } catch (err: any) {
    console.error("[SarvamBatch] Error:", err.message);
    throw err;
  } finally {
      // Security: Always delete the temporary patient audio files immediately after processing/failure
      try {
          if (fs.existsSync(tmpInputPath)) {
              fs.unlinkSync(tmpInputPath);
          }
      } catch (e) {
          console.error(`[SarvamBatch] Failed to delete temporary input file: ${tmpInputPath}`);
      }
      try {
          if (fs.existsSync(tmpWavPath)) {
              fs.unlinkSync(tmpWavPath);
          }
      } catch (e) {
          console.error(`[SarvamBatch] Failed to delete temporary WAV file: ${tmpWavPath}`);
      }
  }
}
