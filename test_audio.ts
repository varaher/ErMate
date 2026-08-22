import { convertAndChunkAudioToWav } from "./server/audioConvert.js";
import fs from "fs";
import { execSync } from "child_process";

// create a dummy 40-second audio file using ffmpeg
execSync("ffmpeg -y -f lavfi -i sine=frequency=1000:duration=40 test_input.webm");
const buf = fs.readFileSync("test_input.webm");

convertAndChunkAudioToWav(buf, "test_input.webm").then(chunks => {
  console.log("Success! Chunks:", chunks.length);
  for (const c of chunks) {
     console.log(c.filename, c.buffer.length);
  }
}).catch(err => {
  console.error("Failed:", err);
});
