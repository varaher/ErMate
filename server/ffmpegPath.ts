import ffmpegStatic from "ffmpeg-static";
import * as fs from "fs";

/**
 * server/ffmpegPath.ts
 *
 * Provides a reliable, cross-environment path to the ffmpeg executable.
 * In the Cloud Run production environment, depending on the system PATH
 * can fail with ENOENT because a system ffmpeg is not installed in the
 * base image. ffmpeg-static provides a packaged binary.
 */

export function getFfmpegPath(): string {
  if (!ffmpegStatic) {
    throw new Error("Audio processing service is temporarily unavailable.");
  }

  // Ensure the file actually exists and is executable
  try {
    fs.accessSync(ffmpegStatic, fs.constants.F_OK | fs.constants.X_OK);
  } catch (err) {
    console.error("[ffmpegPath] Resolving ffmpeg-static failed:", err);
    throw new Error("Audio processing service is temporarily unavailable.");
  }

  return ffmpegStatic;
}
