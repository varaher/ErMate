import { convertAndChunkAudioToWav } from "./server/audioConvert.ts";
import fs from "fs";
const buf = fs.readFileSync("test_120s.wav");
convertAndChunkAudioToWav(buf, "test_120s.wav").then(console.log).catch(console.error);
