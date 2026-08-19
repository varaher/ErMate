import { convertAndChunkAudioToWav } from "./server/audioConvert.ts";
import * as fs from "fs";

async function main() {
  const buf = fs.readFileSync("test_audio.wav");
  try {
    const res = await convertAndChunkAudioToWav(buf, "test_audio.wav");
    console.log("Success:", res.length);
    for (const chunk of res) {
       console.log("Chunk:", chunk.filename, chunk.buffer.length);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
