import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

async function runTest(label, input, history = []) {
  console.log(`\n--- TEST: ${label} ---`);
  const res = await fetch("http://localhost:3000/api/scribe-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "C-TEST",
      userInput: input,
      patientAgeYears: 30,
      caseContext: {},
      messages: history,
    })
  });
  
  if (!res.ok) {
    console.error("HTTP Error:", res.status, await res.text());
    return;
  }
  
  const data = await res.json();
  console.log("REPLY:", data.reply);
  console.log("EXTRACTION (unappliedExtraction):", JSON.stringify(data.unappliedExtraction, null, 2));
}

async function main() {
  await runTest("CASE A", "Patient has fever.");
  await runTest("CASE B", "RTA, FAST positive.");
  await runTest("CASE C", "Plan CT trauma.", [
    { sender: "user", text: "RTA, FAST positive." },
    { sender: "ai", text: "Key Concerns\n- Blunt trauma... Consider CT if haemodynamically stable." }
  ]);
}

main().catch(console.error);
