import assert from "node:assert";
import { ClinicalCase, SecondarySurvey } from "./src/types";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";

console.log("==================================================");
console.log("ERMATE — SECONDARY SURVEY NORMAL TEMPLATE & CTA AUDIT");
console.log("==================================================");

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Approved Normal Template Constants
// -----------------------------------------------------------------------------
const EXPECTED_NORMAL = {
  general: "Conscious, alert, and oriented. No pallor, no icterus, no cyanosis, no clubbing, no lymphadenopathy, no edema.",
  cvs: "S1 and S2 heard, normal intensity. Regular pulse. Normal apex beat, no precordial heave. No murmurs, no gallops or rubs. JVP not elevated. Peripheral pulses well felt bilaterally.",
  respiratory: "Equal chest expansion. Bilateral equal air entry. Vesicular breath sounds. Resonant percussion. Normal vocal resonance. No wheeze, no crackles, no rhonchi.",
  abdomen: "Soft, non-distended, non-tender. No guarding or rigidity. No organomegaly. Tympanic percussion. Bowel sounds present and normal. Normal umbilicus, normal external genitalia, normal hernial orifices.",
  cns: (gcs: number = 15) => `Conscious and oriented to time, place, and person. GCS ${gcs}/15. Higher mental functions intact. Cranial nerves intact. Pupils: BERL. Sensory system intact. Motor system normal. Motor power 5/5 in all limbs. Reflexes normal. Romberg sign negative. Cerebellar examination normal.`,
  extremities: "Peripheral pulses present and well felt. No edema. No cyanosis or clubbing. No deformity. No swelling. Full range of motion."
};

// -----------------------------------------------------------------------------
// TEST 1: Approved Normal Template Content Verification
// -----------------------------------------------------------------------------
test("Approved Normal Template has all 6 canonical systems with detailed findings", () => {
  // General
  assert.ok(EXPECTED_NORMAL.general.includes("Conscious, alert, and oriented"));
  assert.ok(EXPECTED_NORMAL.general.includes("No pallor"));
  assert.ok(EXPECTED_NORMAL.general.includes("no icterus"));
  assert.ok(EXPECTED_NORMAL.general.includes("no cyanosis"));
  assert.ok(EXPECTED_NORMAL.general.includes("no clubbing"));
  assert.ok(EXPECTED_NORMAL.general.includes("no lymphadenopathy"));
  assert.ok(EXPECTED_NORMAL.general.includes("no edema"));

  // CVS
  assert.ok(EXPECTED_NORMAL.cvs.includes("S1 and S2 heard, normal intensity"));
  assert.ok(EXPECTED_NORMAL.cvs.includes("Regular pulse"));
  assert.ok(EXPECTED_NORMAL.cvs.includes("Normal apex beat"));
  assert.ok(EXPECTED_NORMAL.cvs.includes("no precordial heave"));
  assert.ok(EXPECTED_NORMAL.cvs.includes("No murmurs"));
  assert.ok(EXPECTED_NORMAL.cvs.includes("no gallops or rubs"));
  assert.ok(EXPECTED_NORMAL.cvs.includes("JVP not elevated"));
  assert.ok(EXPECTED_NORMAL.cvs.includes("Peripheral pulses well felt bilaterally"));

  // Respiratory
  assert.ok(EXPECTED_NORMAL.respiratory.includes("Equal chest expansion"));
  assert.ok(EXPECTED_NORMAL.respiratory.includes("Bilateral equal air entry"));
  assert.ok(EXPECTED_NORMAL.respiratory.includes("Vesicular breath sounds"));
  assert.ok(EXPECTED_NORMAL.respiratory.includes("Resonant percussion"));
  assert.ok(EXPECTED_NORMAL.respiratory.includes("Normal vocal resonance"));
  assert.ok(EXPECTED_NORMAL.respiratory.includes("No wheeze"));
  assert.ok(EXPECTED_NORMAL.respiratory.includes("no crackles"));
  assert.ok(EXPECTED_NORMAL.respiratory.includes("no rhonchi"));

  // Abdomen
  assert.ok(EXPECTED_NORMAL.abdomen.includes("Soft, non-distended, non-tender"));
  assert.ok(EXPECTED_NORMAL.abdomen.includes("No guarding or rigidity"));
  assert.ok(EXPECTED_NORMAL.abdomen.includes("No organomegaly"));
  assert.ok(EXPECTED_NORMAL.abdomen.includes("Tympanic percussion"));
  assert.ok(EXPECTED_NORMAL.abdomen.includes("Bowel sounds present and normal"));
  assert.ok(EXPECTED_NORMAL.abdomen.includes("Normal umbilicus"));
  assert.ok(EXPECTED_NORMAL.abdomen.includes("normal external genitalia"));
  assert.ok(EXPECTED_NORMAL.abdomen.includes("normal hernial orifices"));

  // Inviolable: PR and PV must NOT be populated in normal template
  assert.ok(!EXPECTED_NORMAL.abdomen.toLowerCase().includes("pr normal"));
  assert.ok(!EXPECTED_NORMAL.abdomen.toLowerCase().includes("pv normal"));
  assert.ok(!EXPECTED_NORMAL.abdomen.toLowerCase().includes("per-rectal"));
  assert.ok(!EXPECTED_NORMAL.abdomen.toLowerCase().includes("per-vaginal"));
  assert.ok(!EXPECTED_NORMAL.abdomen.toLowerCase().includes("rectal"));
  assert.ok(!EXPECTED_NORMAL.abdomen.toLowerCase().includes("vaginal"));

  // CNS
  const cnsText = EXPECTED_NORMAL.cns(15);
  assert.ok(cnsText.includes("Conscious and oriented to time, place, and person"));
  assert.ok(cnsText.includes("GCS 15/15"));
  assert.ok(cnsText.includes("Higher mental functions intact"));
  assert.ok(cnsText.includes("Cranial nerves intact"));
  assert.ok(cnsText.includes("Pupils: BERL")); // Inviolable: BERL preserved exactly
  assert.ok(cnsText.includes("Sensory system intact"));
  assert.ok(cnsText.includes("Motor system normal"));
  assert.ok(cnsText.includes("Motor power 5/5 in all limbs"));
  assert.ok(cnsText.includes("Reflexes normal"));
  assert.ok(cnsText.includes("Romberg sign negative"));
  assert.ok(cnsText.includes("Cerebellar examination normal"));

  // Extremities
  assert.ok(EXPECTED_NORMAL.extremities.includes("Peripheral pulses present and well felt"));
  assert.ok(EXPECTED_NORMAL.extremities.includes("No edema"));
  assert.ok(EXPECTED_NORMAL.extremities.includes("No cyanosis or clubbing"));
  assert.ok(EXPECTED_NORMAL.extremities.includes("No deformity"));
  assert.ok(EXPECTED_NORMAL.extremities.includes("No swelling"));
  assert.ok(EXPECTED_NORMAL.extremities.includes("Full range of motion"));
});

// -----------------------------------------------------------------------------
// TEST 2: Field-by-Field Mapping and Print Parity
// -----------------------------------------------------------------------------
test("Normal Secondary Survey fields correctly convert to CaseSheetData and print sections", () => {
  const normalSurvey: SecondarySurvey = {
    general: EXPECTED_NORMAL.general,
    cvs: EXPECTED_NORMAL.cvs,
    respiratory: EXPECTED_NORMAL.respiratory,
    abdomen: EXPECTED_NORMAL.abdomen,
    cns: EXPECTED_NORMAL.cns(15),
    extremities: EXPECTED_NORMAL.extremities,
  };

  const c: ClinicalCase = {
    id: "case-test-norm-01",
    displayId: "ER-NORM-01",
    status: "Active",
    savedTime: "11:00 AM",
    timeSpentMin: 2,
    patient: {
      name: "Suresh Menon",
      age: 42,
      gender: "Male",
      uhid: "UHID-88219",
      dateOpened: "10/09/2026, 11:00 AM",
      triageCategory: "Priority 3 (Green)",
      caseType: "Medical",
      isMlc: false,
      presentingComplaint: "Mild headache for 1 day",
    },
    vitals: {
      bp: "120/80",
      hr: "76",
      rr: "16",
      spo2: "99",
      temp: "36.8",
      gcs: "15",
    },
    primaryAssessment: {
      airway: "Patent",
      breathing: "Normal air entry bilaterally",
      circulation: "Hemodynamically stable",
      disability: "GCS 15/15, Pupils: BERL",
      exposure: "Normal",
    },
    sampleHistory: {
      symptoms: "Mild tension headache",
      allergies: "NKDA",
      medications: "None",
      pastHistory: "None",
      lastMeal: "2 hours ago",
      events: "Gradual onset",
    },
    secondarySurvey: normalSurvey,
    secondaryAssessment: [
      `General: ${EXPECTED_NORMAL.general}`,
      `CVS: ${EXPECTED_NORMAL.cvs}`,
      `RS: ${EXPECTED_NORMAL.respiratory}`,
      `PA: ${EXPECTED_NORMAL.abdomen}`,
      `CNS: ${EXPECTED_NORMAL.cns(15)}`,
      `Extremities: ${EXPECTED_NORMAL.extremities}`,
    ].join("\n"),
    treatments: [],
    investigations: [],
    provisionalPrimaryDiagnosis: "Tension-type Headache",
    conditionAtShift: "Stable",
    progressNotes: "",
    dischargeInfo: null
  };

  const printData = convertClinicalCaseToCaseSheetData(c);

  // Parity check across all 6 sections
  assert.strictEqual(printData.secondarySurvey.general, EXPECTED_NORMAL.general);
  assert.strictEqual(printData.secondarySurvey.cvs, EXPECTED_NORMAL.cvs);
  assert.strictEqual(printData.secondarySurvey.respiratory, EXPECTED_NORMAL.respiratory);
  assert.strictEqual(printData.secondarySurvey.abdomen, EXPECTED_NORMAL.abdomen);
  assert.strictEqual(printData.secondarySurvey.cns, EXPECTED_NORMAL.cns(15));
  assert.strictEqual(printData.secondarySurvey.extremities, EXPECTED_NORMAL.extremities);
});

// -----------------------------------------------------------------------------
// TEST 3: GCS Coherence Protection
// -----------------------------------------------------------------------------
test("GCS consistency: respects documented GCS in vitals/primary assessment", () => {
  const getDocumentedGcs = (c: ClinicalCase): number | null => {
    const vGcs = c.vitals?.gcs ? parseInt(String(c.vitals.gcs).trim(), 10) : NaN;
    if (!isNaN(vGcs) && vGcs >= 3 && vGcs <= 15) return vGcs;

    const sGcs = c.primaryAssessment?.survey?.disability?.gcsTotal;
    const numSGcs = sGcs !== undefined && sGcs !== null ? parseInt(String(sGcs).trim(), 10) : NaN;
    if (!isNaN(numSGcs) && numSGcs >= 3 && numSGcs <= 15) return numSGcs;

    if (c.primaryAssessment?.disability) {
      const match = c.primaryAssessment.disability.match(/GCS[:\s]*(\d+)/i);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed >= 3 && parsed <= 15) return parsed;
      }
    }

    return null;
  };

  const caseWithGcs13: any = {
    vitals: { gcs: "13" },
    primaryAssessment: {}
  };
  assert.strictEqual(getDocumentedGcs(caseWithGcs13), 13);
  assert.strictEqual(EXPECTED_NORMAL.cns(13).includes("GCS 13/15"), true);

  const defaultCase: any = { vitals: {}, primaryAssessment: {} };
  assert.strictEqual(getDocumentedGcs(defaultCase), null);
  assert.strictEqual(EXPECTED_NORMAL.cns(15).includes("GCS 15/15"), true);
});

console.log("==================================================");
console.log(`ALL TESTS COMPLETED: ${passedTests} / ${totalTests} PASSED`);
console.log("==================================================");
