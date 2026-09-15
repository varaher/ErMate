import { extractFromTranscript } from './server/voiceExtraction';
import { cleanExtractionOutput } from './server/extractionCleanup';
import { mapExtractionToCaseSheetFields } from './server/scribeChatTurn';
import { deidentifyText } from './server/deidentify';

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
  const deidentifiedInput = deidentifyText(transcript).deidentified;
  const rawResponse = await extractFromTranscript(deidentifiedInput);
  const extracted = mapExtractionToCaseSheetFields(
    cleanExtractionOutput(rawResponse.extracted),
    rawResponse.extracted,
    {},
    deidentifiedInput
  );

  const existingMatch = null;
  const parsedAge = (extracted.age !== null && extracted.age !== undefined && String(extracted.age).trim() !== "") ? Number(extracted.age) : null;
  const finalAge = parsedAge;
  let resolvedAge = null;
  let resolvedIsPediatric = false;
  if (finalAge !== null) {
    resolvedAge = finalAge;
    resolvedIsPediatric = finalAge <= 16;
  }

  const newCase = {
    id: "cas_test_123",
    patient: {
      name: "",
      age: String(resolvedAge || ""),
      gender: extracted.gender || "",
    },
    isPediatric: resolvedIsPediatric,
    vitals: {
      hr: extracted.vitals?.hr || "",
      rr: extracted.vitals?.rr || "",
      spo2: extracted.vitals?.spo2 || "",
      gcs: extracted.vitals?.gcs || "",
      gcs_e: extracted.vitals?.gcs_e || "",
      gcs_v: extracted.vitals?.gcs_v || "",
      gcs_m: extracted.vitals?.gcs_m || "",
    },
    primaryAssessment: {
      airway: extracted.airway || "",
      circulation: extracted.circulation || "",
      disability: extracted.disability || "",
      exposure: extracted.exposure || ""
    },
    secondarySurvey: extracted.secondarySurvey,
    sampleHistory: {
      pastHistory: extracted.pastMedicalHistory || "",
      medications: extracted.currentMedications || "",
      lastMeal: extracted.lastMeal || "",
    },
    adjuncts: {
      abgPh: extracted.vbgAbg?.values?.find((v:any)=>v.param==="ph")?.value,
      efastNotes: extracted.fastFindings ? JSON.stringify(extracted.fastFindings) : "",
      echoFindings: extracted.echo || ""
    },
    pediatricDetails: extracted.pediatricDetails,
    treatments: extracted.treatmentGiven ? extracted.treatmentGiven.map((t: any, i: number) => ({ 
      id: `trt-${Date.now()}-${i}`, 
      drugName: typeof t === 'string' ? t : (t.drugName || t.name || ""), 
      dose: typeof t === 'string' ? "" : (t.dose || ""), 
      route: typeof t === 'string' ? "" : (t.route || ""), 
      instruction: typeof t === 'string' ? "" : (t.instruction || ""), 
      timeGiven: typeof t === 'string' ? "" : (t.timeGiven || ""), 
      ipsgVerified: false 
    })) : [],
    dispositionAndPlan: {
      managementPlan: extracted.plan || "",
      consultsRequested: extracted.consultations || []
    }
  };

  console.log("=== FINAL CLINICAL CASE ===");
  console.log(JSON.stringify(newCase, null, 2));
}

runTest().catch(console.error);
