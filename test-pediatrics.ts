import { extractFromTranscript } from "./server/voiceExtraction.ts";
import { cleanExtractionOutput } from "./server/extractionCleanup.ts";
import { mapExtractionToCaseSheetFields } from "./server/scribeChatTurn.ts";

async function run() {
    const feverText = `This is a 5-year-old female child brought by her mother with complaints of fever for the last 3 days associated with cough, running nose, reduced oral intake and two episodes of vomiting since morning.

There is no history of seizures, breathing difficulty, rash or altered sensorium. Urine output is maintained.

There is no significant past medical history and the child is not on any regular medications.

On assessment, the child is conscious, alert and interacting appropriately.

Airway is patent.

Respiratory rate is 26 per minute, SpO2 is 98% on room air and bilateral air entry is equal with no significant added sounds.

Heart rate is 118 per minute, peripheral pulses are well felt and capillary refill is less than 2 seconds.

Temperature is 38.8 degrees Celsius.

Abdomen is soft and non-tender.

There is no neck stiffness or focal neurological deficit.

Hydration is mildly reduced with slightly dry oral mucosa.

Appropriate investigations were planned based on clinical assessment and duration of fever.

Oral or IV fluids were given depending on tolerance, along with weight-appropriate antipyretic treatment.

Provisional diagnosis is acute febrile illness, likely viral, with mild dehydration.

Plan is hydration, symptomatic treatment, observation and reassessment for any red-flag features.`;

    const traumaText = `This is a 5-year-old female child referred from an outside hospital following a road traffic accident involving a two-wheeler and four-wheeler near Chunungambeli at approximately 8 AM. The child was thrown off the vehicle.

She complains of pain all over the body, nausea and amnesia for the event.

There is no significant past medical history and she is not on any regular medications. She had food that morning.

Airway is patent. There is C-spine tenderness.

Respiratory rate is 20 per minute and SpO2 is 98%. There is right-sided chest tenderness.

Heart rate is 120 per minute and peripheral pulses are palpable.

GCS is 15 out of 15, E4 V5 M6. Pupils are equal and reacting.

There is left thigh deformity with no open wound.

There are abrasions over both forearms, chest, lower abdomen and chin.

There is tenderness over the left thigh, both arms, chest and lower abdomen.

ABG shows pH 7.35, PCO2 25, HCO3 20, sodium 130, potassium 4, chloride 110, base excess minus 2, hemoglobin 14 and anion gap approximately 12.

FAST shows free fluid in the right hepatorenal region and pelvic/perivesical region.

Bedside echo shows good RV and LV function, no pericardial effusion and no IVC collapse.

Treatment given includes tranexamic acid, Sompraz, Emeset and analgesia as appropriate for the child's weight.

Provisional diagnosis is blunt abdominal trauma with suspected hemoperitoneum, closed left femur fracture and multiple abrasions following RTA.

Consultations were taken from Orthopaedics, Surgery / Pediatric Surgery and Neurosurgery.

Plan is to review investigations and imaging, compare previous reports, proceed with definitive management and OT as indicated.`;

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
