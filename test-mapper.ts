import { cleanExtractionOutput } from "./server/extractionCleanup.ts";
import { processScribeChatTurn } from "./server/scribeChatTurn.ts";

const traumaRawJSON = {
  events: "Rider of two-wheeler, struck by four-wheeler, thrown off vehicle, initially taken to outside hospital and referred here.",
  echo: "Good RV function, Good LV function, No pericardial effusion, No IVC collapse",
  treatment: ["Tranexamic acid 1 g IV stat", "Sompraz 40 mg IV stat", "Emeset 4 mg IV stat", "Diclofenac 75 mg IV stat"]
};

async function testMapper() {
  console.log("=== TRAUMA MAPPER TEST WITH MOCKED INPUT ===");
  const cleanedTrauma = cleanExtractionOutput(traumaRawJSON as any);
  console.log("Cleaned Trauma:", cleanedTrauma);

  const helpers1 = {
    callExtractionModel: async () => traumaRawJSON,
    callClinicalReasoningModel: async () => ({ summary: "Test", differentials: [], references: [], watchFor: [] })
  };
  const res1 = await processScribeChatTurn("dummy text", 35, {}, "c1", [], helpers1 as any);
  console.log("Trauma Updated Fields:", JSON.stringify(res1.unappliedExtraction, null, 2));
}

testMapper().catch(console.error);
