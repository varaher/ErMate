import { extractFromTranscript } from './server/voiceExtraction';
import { cleanExtractionOutput } from './server/extractionCleanup';

const transcript = `
5-year-old FEMALE
HR 120
RR 20
SpO2 98%
GCS 15
E4 V5 M6
Airway patent
C-spine tenderness
right-sided chest tenderness
peripheral pulses palpable
pupils equal/reacting
left thigh deformity
no open wound
abrasions:
both forearms
chest
lower abdomen
chin
tenderness:
left thigh
both arms
chest
lower abdomen
No significant PMH
Not on regular medications
Food morning of incident
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
NO pO2
FAST:
right hepatorenal free fluid
pelvic/perivesical free fluid
Echo:
good RV
good LV
no pericardial effusion
no IVC collapse
Treatment:
tranexamic acid
Sompraz
Emeset
analgesia as appropriate for the child's weight
Diagnosis:
blunt abdominal trauma with suspected hemoperitoneum
closed left femur fracture
multiple abrasions following RTA
Consultations:
Orthopaedics
Surgery / Pediatric Surgery
Neurosurgery
Plan:
review investigations/imaging
compare previous reports
definitive management
OT as indicated
`;

async function runTest() {
  const rawResponse = await extractFromTranscript(transcript);
  const raw = rawResponse.extracted;
  
  const cleaned = cleanExtractionOutput(raw);
  console.log("=== RAW TREATMENT ===");
  console.log(JSON.stringify(raw.treatment, null, 2));

  console.log("=== CLEANED DRUGS ===");
  console.log(JSON.stringify(cleaned.drugs, null, 2));
}

runTest().catch(console.error);
