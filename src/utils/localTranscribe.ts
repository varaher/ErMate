import { env } from "@xenova/transformers";

// Disable local model loading from node_modules, fetch from Hugging Face CDN instead
env.allowLocalModels = false;

let pipelineInstance: any = null;

export interface ScanProgress {
  status: "idle" | "loading" | "downloading" | "ready" | "transcribing" | "error";
  progress?: number;
  file?: string;
  message?: string;
}

/**
 * Lazy loads the Whisper pipeline.
 */
export async function getWhisperPipeline(onProgress: (progress: ScanProgress) => void) {
  if (pipelineInstance) {
    return pipelineInstance;
  }

  // Dynamically import to keep main bundle lightweight
  const { pipeline } = await import("@xenova/transformers");

  onProgress({ status: "loading", message: "Initializing local Web-ML engine..." });

  pipelineInstance = await pipeline("automatic-speech-recognition", "Xenova/whisper-small", {
    progress_callback: (data: any) => {
      if (data.status === "progress") {
        onProgress({
          status: "downloading",
          file: data.file,
          progress: Math.round(data.progress),
          message: `Downloading neural speech model weights: ${Math.round(data.progress)}%`
        });
      } else if (data.status === "ready") {
        onProgress({ status: "ready", message: "Clinical speech model ready!" });
      }
    }
  });

  return pipelineInstance;
}

/**
 * Decodes a browser recording Audio Blob into standard 16kHz mono Float32Array required by Whisper.
 */
export async function decodeAudioBlob(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  
  // Force sample rate to 16000Hz (Whisper default input rate)
  const audioCtx = new AudioContextClass({ sampleRate: 16000 });
  
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0); // Use first mono channel
    return channelData;
  } finally {
    await audioCtx.close();
  }
}

/**
 * Transcribes audio blob using client-side WebAssembly Whisper model.
 */
export async function transcribeAudioLocally(
  blob: Blob,
  onProgress: (progress: ScanProgress) => void
): Promise<string> {
  try {
    const transcriber = await getWhisperPipeline(onProgress);
    
    onProgress({ status: "transcribing", message: "Decoding medical dictation audio..." });
    const audioData = await decodeAudioBlob(blob);
    
    onProgress({ status: "transcribing", message: "AI running local neural inference..." });
    
    const output = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false
    });
    
    onProgress({ status: "idle" });
    return output.text || "";
  } catch (error: any) {
    console.error("Local Whisper Transcription Error:", error);
    onProgress({ status: "error", message: error.message || "Failed to transcribe locally." });
    throw error;
  }
}
