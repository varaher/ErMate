// MARKER: ERMATE-CASE-SHEET-WEIGHT-V1
import { readFileSync } from "fs";
import { parseTriageDictation } from "./src/utils/triageDictation";
import { formatCaseSheetText } from "./src/utils/caseSheetFormat";
import { hasAnyClinicalContent } from "./src/utils/caseLifecycle";
import { estimateWeightFromAge, resolveDosingWeight } from "./src/utils/drugDoseSuggestions";
import { ClinicalCase, TriageCategory } from "./src/types";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, extra = "") => {
  if (c) { pass++; console.log(`[PASS] ${n}`); }
  else { fail++; console.log(`[FAIL] ${n} ${extra}`); }
};

const src = (p: string) => readFileSync(p, "utf8");

// ── 1. Type definitions
const typesSrc = src("src/types.ts");
check("PatientDemographics has weight", /weight\?: string;/.test(typesSrc));
check("PatientVitals has weight", /export interface PatientVitals[\s\S]*?weight\?: string;/.test(typesSrc));

// ── 2. Triage dictation parser parses weight
const d1 = parseTriageDictation("45 year old male, chest pain, BP 140/90, weight 72 kg");
check("dictation parses adult weight in kg", d1.weight === "72" && d1.filled.includes("weight (kg)"));

const d2 = parseTriageDictation("3 year old child, fever, wt 14.5 kilos, saturation 98");
check("dictation parses pediatric decimal weight", d2.weight === "14.5" && d2.filled.includes("weight (kg)"));

const d3 = parseTriageDictation("no weight mentioned here");
check("dictation without weight leaves weight undefined", d3.weight === undefined);

// ── 3. APLS and Dosing Weight calculations
check("APLS infant 6 months estimate", estimateWeightFromAge(0, 6) === 7);
check("APLS 3 year old estimate (2*age + 8 = 14)", estimateWeightFromAge(3) === 14);
check("APLS 7 year old estimate (3*age + 7 = 28)", estimateWeightFromAge(7) === 28);
check("resolveDosingWeight uses entered weight when present", resolveDosingWeight("16.5", 3)?.kg === 16.5 && resolveDosingWeight("16.5", 3)?.estimated === false);
check("resolveDosingWeight falls back to APLS estimate when blank", resolveDosingWeight("", 3)?.kg === 14 && resolveDosingWeight("", 3)?.estimated === true);

// ── 4. Case lifecycle recognizes weight as clinical content
const emptyCase: ClinicalCase = {
  id: "case-wt-1",
  patient: {
    name: "",
    age: null,
    gender: "",
    presentingComplaint: "",
    triageCategory: TriageCategory.P2,
    dateOpened: "now",
    isMlc: false
  },
  vitals: { bp: "", hr: "", spo2: "", rr: "", temp: "", gcs: "", gcs_e: "", gcs_v: "", gcs_m: "", grbs: "", avpu: "", painScore: "" },
  primaryAssessment: {} as any,
  secondaryAssessment: "",
  sampleHistory: {} as any,
  treatments: [],
  investigations: [],
  differentials: []
};
check("completely empty case has no clinical content", hasAnyClinicalContent(emptyCase) === false);

const caseWithWeight: ClinicalCase = {
  ...emptyCase,
  patient: {
    ...emptyCase.patient,
    weight: "65"
  }
};
check("case with patient.weight has clinical content", hasAnyClinicalContent(caseWithWeight) === true);

const caseWithVitalsWeight: ClinicalCase = {
  ...emptyCase,
  vitals: {
    ...emptyCase.vitals,
    weight: "12"
  }
};
check("case with vitals.weight has clinical content", hasAnyClinicalContent(caseWithVitalsWeight) === true);

// ── 5. Case sheet plain text / EMR export formatting
const formattedSheet = formatCaseSheetText({
  caseId: "ER-909",
  patient: {
    name: "John Doe",
    age: 42,
    sex: "M",
    uhid: "UHID-1234",
    bed: "Bed 4",
    weight: "75"
  },
  arrival: { date: "18-Oct-2026", time: "09:30" },
  clinician: "Dr. Smith",
  presentingComplaint: "Abdominal pain",
  initialVitals: [],
  vbgAbg: { type: null, performed: false, values: [] },
  ecg: { performed: false, findings: "" },
  bedsideEcho: { performed: false, findings: "" },
  efast: { performed: false, findings: "" },
  symptoms: [],
  allergies: [],
  currentMedications: [],
  pastHistory: [],
  lastMeal: null,
  events: null,
  treatment: null,
  primarySurvey: {} as any,
  secondarySurvey: {} as any,
  labs: [],
  treatmentGiven: [],
  treatmentNotes: null,
  procedures: { proceduresChecked: [], otherProcedures: null, procedureNotes: [] },
  consultation: { consultsRequested: [], consultantReview: null },
  provisionalDiagnosis: null,
  differentials: [],
  provisionalDifferentialDiagnoses: null,
  disposition: {} as any,
  isPediatric: false,
  pediatricDetails: null,
  notes: { progressNotes: null, addendum: null },
  safetyAndAccreditation: null,
  isMlc: false,
  mlcDetails: null,
  familyHistory: null,
  hpi: null
});
check("formatted EMR text includes Weight: 75 kg", formattedSheet.includes("Weight: 75 kg"));

// ── 6. Source inspection in CaseSheetView and CaseSheetPrintView
const csvSrc = src("src/components/CaseSheetView.tsx");
check("CaseSheetView has casesheet-weight-section", csvSrc.includes('data-testid="casesheet-weight-section"'));
check("CaseSheetView has casesheet-weight-input", csvSrc.includes('id="casesheet-weight-input"'));
check("CaseSheetView has casesheet-patient-weight-input in demographics", csvSrc.includes('id="casesheet-patient-weight-input"'));
check("CaseSheetView imports Scale icon", /Scale/.test(csvSrc));
check("CaseSheetView handles weight update and syncs", csvSrc.includes("handleUpdateWeight"));
check("CaseSheetView isCaseSheetDirty checks weight", /weight: \(c\.patient\?\.weight \|\| ""\)\.trim\(\)/.test(csvSrc));
check("CaseSheetView EMR copy includes Weight", csvSrc.includes("**Weight:**") && csvSrc.includes("<strong>Weight:</strong>"));

const cspvSrc = src("src/components/CaseSheetPrintView.tsx");
check("CaseSheetPrintView extracts weight into patient.weight", cspvSrc.includes("weight: c.patient?.weight || c.vitals?.weight || c.pediatricDetails?.patientWeight || c.pediatricDetails?.weight || null"));
check("CaseSheetPrintView renders Weight in printed header", cspvSrc.includes('<div><span className="font-bold">Weight:</span> {data.patient.weight ? `${data.patient.weight} kg` : "—"}</div>'));

const tfSrc = src("src/components/TriageForm.tsx");
check("TriageForm has Weight (kg) input", tfSrc.includes("Weight (kg)"));
check("TriageForm passes weight to demographics and vitals", tfSrc.includes("weight.trim() ? { weight: weight.trim() } : {}"));

const pssSrc = src("src/components/PrimarySurveySection.tsx");
check("PrimarySurveySection Exposure has Weight VitalInput", pssSrc.includes('label="Weight"') && pssSrc.includes('unit="kg"'));

console.log(`\nCase sheet weight: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
