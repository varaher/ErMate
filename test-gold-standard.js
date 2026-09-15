import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

async function runTest(input) {
  const res = await fetch("http://localhost:3000/api/scribe-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "C-TEST2",
      userInput: input,
      patientAgeYears: 30,
      caseContext: {},
      messages: [],
    })
  });
  const data = await res.json();
  console.log("REPLY:", data.reply);
  console.log("EXTRACTION (unappliedExtraction):", JSON.stringify(data.unappliedExtraction, null, 2));
}

runTest("30-year-old RTA, HR 120, FAST positive.").catch(console.error);
