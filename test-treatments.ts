import { processScribeChatTurn } from "./server/scribeChatTurn.ts";

const caseA = {
  treatment: ["Tranexamic acid 1 g IV stat"]
};

const caseB = {
  treatment: [{
    drugName: "Tranexamic acid",
    dose: "1 g",
    route: "IV",
    frequency: "stat"
  }]
};

const caseC = {
  treatment: [{
    drugName: "Tranexamic acid",
    dose: "1 g",
    route: "IV",
    timeGiven: "08:42"
  }]
};

async function runTest(name: string, rawJSON: any) {
  console.log(`\n=== ${name} ===`);
  const helpers = {
    callExtractionModel: async () => rawJSON,
    callClinicalReasoningModel: async () => ({ summary: "Test", differentials: [], references: [], watchFor: [] })
  };
  const res = await processScribeChatTurn("dummy text", 35, {}, "c1", [], helpers as any);
  
  // To simulate App.tsx mapping:
  const extracted = res.unappliedExtraction as any;
  const mapped = extracted.treatmentGiven ? extracted.treatmentGiven.map((t: any, i: number) => ({
    id: `trt-test-${i}`,
    drugName: typeof t === 'string' ? t : (t.drugName || t.name || ""),
    dose: typeof t === 'string' ? "" : (t.dose || ""),
    route: typeof t === 'string' ? "" : (t.route || ""),
    timeGiven: typeof t === 'string' ? "" : (t.timeGiven || "")
  })) : [];
  
  console.log(JSON.stringify(mapped, null, 2));
}

async function main() {
  await runTest("CASE A - legacy string", caseA);
  await runTest("CASE B - structured instruction", caseB);
  await runTest("CASE C - actual clock administration time", caseC);
}

main().catch(console.error);
