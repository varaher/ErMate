import { config } from "dotenv";
config();
import { extractFromTranscript } from "./server/voiceExtraction.ts";

async function main() {
  const turn2 = "She has C-spine tenderness and left thigh deformity.";
  const result = await extractFromTranscript(turn2);
  console.log(JSON.stringify(result.extracted, null, 2));
}

main().catch(console.error);
