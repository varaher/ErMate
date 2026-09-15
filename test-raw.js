import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
import { VOICE_EXTRACTION_PROMPT } from "./server/voiceExtraction.js"; // Wait, can't easily import from ts

async function main() {
  const res = await fetch("http://localhost:3000/api/scribe-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "C-TEST3",
      userInput: "30-year-old male, RTA. FAST positive.",
      patientAgeYears: 30,
      caseContext: {},
      messages: [],
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data.unappliedExtraction, null, 2));
}
main().catch(console.error);
