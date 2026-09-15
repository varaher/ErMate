import { extractFromTranscript } from "./server/voiceExtraction.ts";
import { cleanExtractionOutput } from "./server/extractionCleanup.ts";
import { mapExtractionToCaseSheetFields } from "./server/scribeChatTurn.ts";

async function run() {
    const feverText = `This is a 5-year-old female child. Presenting complaints are fever for 3 days, cough, running nose, reduced oral intake, and two episodes of vomiting since morning. On assessment, airway is patent. Respiratory rate is 26, SpO2 is 98 percent. Heart rate is 118, pulses are well felt, CRT is less than 2 seconds. Temperature is 38.8. On focused exam, abdomen is soft and non-tender. No neck stiffness, no focal neurological deficit, and no rash. Past medical history is not significant. Not on regular medications. Oral or IV fluids were given depending on tolerance, along with weight-appropriate antipyretic treatment. Provisional diagnosis is acute febrile illness, likely viral, with mild dehydration. Plan includes hydration, symptomatic treatment, observation, and reassessment for red flags.`;

    const traumaText = `5-year-old female child following RTA. She was thrown from a vehicle outside-hospital referral near Chunungambeli around 8 AM. She complains of pain all over body, nausea, and event amnesia. No significant PMH, not on regular medications. She had food that morning. Airway is patent, but there is C-spine tenderness. RR is 20, SpO2 98, with right chest tenderness. HR 120, peripheral pulses palpable. GCS 15, E4 V5 M6, pupils equal and reacting. Left thigh deformity noted, no open wound, multiple abrasions all over, and tenderness in multiple locations. ABG shows pH 7.35, PCO2 25, HCO3 20, Na 130, K 4, Cl 110, BE -2, Hb 14, anion gap 12. FAST abdomen and pelvis are positive. Echo was done. Medications given: TXA, Sompraz, Emeset, and analgesia appropriate for child's weight. Diagnosis is blunt abdominal trauma with suspected hemoperitoneum, closed left femur fracture, and multiple abrasions following RTA. Consultations sent to Orthopaedics, Surgery, Pediatric Surgery, and Neurosurgery. Plan is to review investigations and imaging, compare with previous reports, definitive management, and OT as indicated.`;

    try {
        console.log("=== FEVER CHILD ===");
        const rawFever = await extractFromTranscript(feverText, { isPediatric: true });
        const feverExtracted = rawFever.extracted;
        console.log("RAW:\n", JSON.stringify(feverExtracted, null, 2));
        const cleanedFever = cleanExtractionOutput(feverExtracted);
        console.log("CLEANED:\n", JSON.stringify(cleanedFever, null, 2));
        const mappedFever = mapExtractionToCaseSheetFields(cleanedFever, feverExtracted, {}, feverText);
        console.log("MAPPED:\n", JSON.stringify(mappedFever, null, 2));

        console.log("\n=== TRAUMA CHILD ===");
        const rawTrauma = await extractFromTranscript(traumaText, { isPediatric: true });
        const traumaExtracted = rawTrauma.extracted;
        console.log("RAW:\n", JSON.stringify(traumaExtracted, null, 2));
        const cleanedTrauma = cleanExtractionOutput(traumaExtracted);
        console.log("CLEANED:\n", JSON.stringify(cleanedTrauma, null, 2));
        const mappedTrauma = mapExtractionToCaseSheetFields(cleanedTrauma, traumaExtracted, {}, traumaText);
        console.log("MAPPED:\n", JSON.stringify(mappedTrauma, null, 2));

    } catch (e) {
        console.error(e);
    }
}
run();
