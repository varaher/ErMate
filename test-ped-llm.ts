import { config } from "dotenv";
config();
import { extractFromTranscript } from "./server/voiceExtraction.ts";
import { cleanExtractionOutput } from "./server/extractionCleanup.ts";
import { runExtraction } from "./server/scribeChatTurn.ts";

const turn1 = `5-year-old female child referred from outside hospital following RTA,
two-wheeler versus four-wheeler, near Chunungambeli at around 8 AM.

Child was travelling on the two-wheeler.
The two-wheeler was hit by a four-wheeler.
Child was thrown from vehicle.
Initially taken to outside hospital and later referred.

Symptoms:
- pain all over body
- nausea
- event amnesia

No significant past medical history.
Not on regular medications.
Had food on the morning of incident.

Airway:
patent

C-spine:
tenderness

Breathing:
RR 20/min
SpO2 98%
right-sided chest tenderness

Circulation:
HR 120/min
peripheral pulses palpable

Disability:
GCS 15
E4 V5 M6
pupils equal and reacting

Exposure:
left thigh deformity
no open wound
abrasions both forearms
abrasions chest
abrasions lower abdomen
abrasion chin
tenderness left thigh
tenderness both arms
chest tenderness
lower abdominal tenderness

ABG:
pH 7.35
PCO2 25
HCO3 20
Na 130
K 4
Cl 110
BE -2
Hb 14
anion gap approximately 12

NO pO2 dictated.

FAST:
free fluid in right hepatorenal angle
free fluid around urinary bladder / pelvis

Echo:
good RV function
good LV function
no pericardial effusion
no IVC collapse

Secondary survey:
no other significant abnormality apart from documented injuries.

Treatment:
tranexamic acid
Sompraz
Emeset
analgesia appropriate for child's weight

Diagnosis:
blunt abdominal trauma with suspected hemoperitoneum
closed left femur fracture
multiple abrasions following RTA

Consultations:
Orthopaedics
Surgery / Pediatric Surgery
Neurosurgery

Plan:
review investigations and imaging
compare with previous reports
definitive management
OT as indicated`;

async function main() {
  console.log("\n================ ACTUAL LIVE LLM TEST — STANDALONE SERVER HARNESS ================");
  const rawResult = await extractFromTranscript(turn1);
  console.log("\n[1] COMPLETE RAW MODEL JSON:");
  console.log(JSON.stringify(rawResult.extracted, null, 2));
  
  console.log("\n[2] COMPLETE CLEANED EXTRACTION:");
  const cleaned = cleanExtractionOutput(rawResult.extracted as any);
  console.log(JSON.stringify(cleaned, null, 2));
  
  console.log("\nRUNNING runExtraction...");
  const result = await runExtraction(turn1, null, undefined, {}, async () => rawResult.extracted as any);
  console.log("\n[3] COMPLETE UNAPPLIED EXTRACTION:");
  console.log(JSON.stringify(result.updatedFields, null, 2));
}

main().catch(console.error);
