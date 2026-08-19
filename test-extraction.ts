import { processScribeChatTurn } from "./server/scribeChatTurn.ts";
import { deidentifyText } from "./server/deidentify.ts";

const userInput = "pt came with fever cough running nose since today morning . His primary survery is within normal limits , VBG normal ecg /bed side echo not done ..signs same as explained rest all fine . Secondary survey all normal except for sinus tendeness. Investigation cbc crp , treatment injection paracetamol 1 gm iv stat ,ns 250 ml /hr . Dx is h1n1 , uri . Plan review reports symptomtomc treatment and discharge";

async function main() {
  const result = await processScribeChatTurn(userInput, null, {}, "test-case", [], {
    callExtractionModel: async () => {
      // simulate returned format
      return {
        presentingComplaint: "Fever, cough, running nose since today morning",
        airway: "Normal",
        breathing: "Normal",
        circulation: "Normal",
        disability: "Normal",
        exposure: "Normal",
        vitals: {},
        signsSymptoms: ["Fever", "Cough", "Running nose", "Sinus tenderness"],
        events: [],
        drugs: ["Injection Paracetamol 1 gm IV stat", "NS 250 ml /hr"],
        plan: ["Review reports", "Symptomatic treatment", "Discharge"],
        labs: [{ name: "CBC", value: "ordered" }, { name: "CRP", value: "ordered" }, { name: "VBG", value: "Normal" }],
        diagnosis: ["H1N1", "URI"]
      } as any;
    },
    callClinicalReasoningModel: async () => {
      throw new Error("Simulated failure for Claude");
    }
  });

  console.log(JSON.stringify(result, null, 2));
}
main();
