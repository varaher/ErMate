import { convertAndChunkAudioToWav } from "./server/audioConvert.ts";
import fs from "fs";
import { execSync } from "child_process";

// create a dummy 40-second audio with some silence
execSync("ffmpeg -y -f lavfi -i \"aevalsrc=sin(440*2*PI*t)*st(0,mod(t,10)):d=40\" test_input.webm");
const buf = fs.readFileSync("test_input.webm");

convertAndChunkAudioToWav(buf, "test_input.webm").then(chunks => {
  console.log("Success! Chunks:", chunks.length);
}).catch(err => {
  console.error("Failed:", err);
});
