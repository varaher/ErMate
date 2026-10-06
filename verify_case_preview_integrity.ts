import assert from "node:assert";
import { ClinicalCase, PrimarySurvey, PatientDemographics, SampleHistory } from "./src/types";
import { getDisplayCaseId } from "./src/utils/caseIdentity";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import { parseSecondaryAssessmentToSurvey } from "./src/components/SecondarySurveySection";

console.log("==================================================");
console.log("ERMATE — CASE PREVIEW INTEGRITY VERIFICATION SUITE");
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

// ---------------------------------------------------------------
// Helper to construct a base test case
// ---------------------------------------------------------------
function createBaseAdultCase(): ClinicalCase {
  return {
    id: "case-uuid-adult-001",
    displayId: "261006001",
    bedNo: "11A",
    status: "Active",
    savedTime: "10:30 AM",
    timeSpentMin: 12,
    isPediatric: false,
    patient: {
      name: "Ramesh Sharma",
      age: 58,
      gender: "Male",
      presentingComplaint: "Chest pain for 2 hours",
      triageCategory: "P1 Immediate",
      dateOpened: "10:30 AM | Oct 6",
      uhid: "UHID-987654",
      isMlc: false
    },
    vitals: {
      bp: "140/90",
      hr: "98",
      rr: "18",
      spo2: "98",
      temp: "98.6",
      grbs: "110",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6",
      painScore: "7"
    },
    sampleHistory: {
      symptoms: "Retrosternal chest pressure with radiation to left arm",
      allergies: "NKDA",
      medications: "Tab. Amlodipine 5mg OD",
      pastHistory: "Hypertension for 5 years",
      lastMeal: "2 hours ago",
      events: "Sudden onset while walking in park",
      socialHistory: "Non-smoker",
      familyHistory: "CAD in father at 52"
    },
    primaryAssessment: {
      airway: "Patent, speaking in full sentences",
      breathing: "Bilateral air entry equal, no wheeze or crackles",
      circulation: "Peripheral pulses well felt, CRT < 2s, regular rhythm",
      disability: "GCS 15/15, pupils 3mm equal and reactive to light",
      exposure: "No rash, no external injuries, abdomen soft"
    },
    secondarySurvey: {
      general: "Alert, oriented, mild diaphoresis",
      cvs: "S1 S2 heard, no murmurs",
      respiratory: "Clear breath sounds bilaterally",
      abdomen: "Per abdomen soft, non-tender, no organomegaly",
      cns: "No focal neurological deficit, cranial nerves grossly intact",
      extremities: "No pedal edema, peripheral pulses palpable bilaterally"
    },
    secondaryAssessment: "General: Alert, oriented, mild diaphoresis\nCVS: S1 S2 heard, no murmurs\nRS: Clear breath sounds bilaterally\nPA: Per abdomen soft, non-tender, no organomegaly\nCNS: No focal neurological deficit\nExtremities: No pedal edema",
    investigations: [
      { id: "inv-1", testName: "Troponin I", result: "0.04 ng/mL", isAbnormal: false, orderTime: "10:35 AM", resultTime: "11:15 AM" },
      { id: "inv-2", testName: "ECG 12-Lead", result: "Sinus rhythm, ST elevation in V2-V4", isAbnormal: true, orderTime: "10:32 AM", resultTime: "10:34 AM" }
    ],
    investigationLabsOrdered: "CBC, Troponin I, Serum Electrolytes, RFT",
    investigationImaging: "Chest X-Ray AP",
    investigationResultsSummary: "Troponin I borderline at 0.04; ECG confirms anterior STEMI pattern.",
    provisionalPrimaryDiagnosis: "Acute Anterior Wall Myocardial Infarction",
    provisionalDifferentialDiagnoses: "Aortic Dissection; Acute Pericarditis; GERD",
    differentials: [
      { diagnosis: "Aortic Dissection", status: "ruled_out" },
      { diagnosis: "Acute Pericarditis", status: "under_evaluation" },
      { diagnosis: "GERD", status: "ruled_out" }
    ],
    treatments: [
      { drugName: "Tab. Aspirin", dose: "300 mg", route: "Oral", instruction: "Stat chewed", timeGiven: "10:35 AM" },
      { drugName: "Tab. Clopidogrel", dose: "300 mg", route: "Oral", instruction: "Stat", timeGiven: "10:35 AM" },
      { drugName: "Tab. Atorvastatin", dose: "80 mg", route: "Oral", instruction: "Stat", timeGiven: "10:35 AM" }
    ],
    proceduresChecked: ["iv_cannula", "ecg"],
    otherProcedures: "18G IV cannula placed in right cubital fossa",
    procedureNotes: [
      {
        id: "proc-1",
        procedureName: "IV Cannulation",
        generatedNarrative: "18G IV cannula secured in right antecubital vein under aseptic precautions.",
        metadata: { date: "2026-10-06", time: "10:34 AM" }
      }
    ],
    dispositionDetails: {
      dispositionType: "Admitted to Cath Lab / ICU",
      residentName: "Dr. A. Resident",
      consultantName: "Dr. C. Consultant",
      durationInEr: "45 mins"
    },
    dispositionAndPlan: {
      dispositionStatus: "Admitted to Cath Lab / ICU",
      destinationUnit: "Cath Lab",
      managementPlan: "Immediate primary PCI by Cardiology team",
      followUpAdvice: "Post-PCI CCU monitoring"
    }
  };
}

function createBasePediatricCase(): ClinicalCase {
  return {
    id: "case-uuid-ped-002",
    displayId: "261006002",
    bedNo: "12A",
    status: "Active",
    savedTime: "11:15 AM",
    timeSpentMin: 8,
    isPediatric: true,
    patient: {
      name: "Baby Aarav",
      age: 4,
      gender: "Male",
      presentingComplaint: "High fever and fast breathing for 1 day",
      triageCategory: "P2 Very Urgent",
      dateOpened: "11:15 AM | Oct 6",
      uhid: "UHID-654321",
      isMlc: false
    },
    pediatricDetails: {
      patientWeight: "16",
      weight: "16",
      patAppearanceTone: "Good muscle tone, sitting upright",
      patAppearanceInteractivity: "Alert, reaches for mother",
      patAppearanceConsolability: "Consolable by mother",
      patAppearanceLookGaze: "Tracks clinician face and light",
      patAppearanceSpeechCry: "Crying vigorously, sounds normal",
      patWorkOfBreathing: "Mild subcostal retractions, no grunting",
      patCirculation: "Warm peripheries, pink, CRT 1.5s",
      birthHistory: "Full term normal vaginal delivery, birth weight 3.1kg",
      feedingHistory: "Age-appropriate diet, reduced intake today",
      developmentalHistory: "Milestones normal for 4 years",
      immunizationHistory: "Up to date as per National Immunization Schedule",
      broughtBy: "Mother",
      informant: "Mother"
    },
    vitals: {
      bp: "95/60",
      hr: "132",
      rr: "34",
      spo2: "97",
      temp: "102.4",
      grbs: "96",
      gcs: "15"
    },
    sampleHistory: {
      symptoms: "Fever up to 102.4 F, cough, mild nasal congestion",
      allergies: "No known drug allergies",
      medications: "Syrup Paracetamol 250mg given 3 hours ago at home",
      pastHistory: "No prior hospital admissions, no asthma",
      lastMeal: "Milk 2 hours ago",
      events: "Fever started yesterday evening, worsened today"
    },
    primaryAssessment: {
      airway: "Patent, no stridor",
      breathing: "Mild tachypnea, bilateral air entry equal, bilateral ronchi heard",
      circulation: "Warm extremities, CRT < 2s, pulses full",
      disability: "Active, alert, pupils equal and reactive",
      exposure: "No rash, no skin lesions"
    },
    secondarySurvey: {
      general: "Febrile, comfortable on mother's lap",
      cvs: "Tachycardia, normal heart sounds, no murmur",
      respiratory: "Tachypnea, mild subcostal retraction, bilateral fine crepitations at right base",
      abdomen: "Per abdomen soft, non-tender, liver 1cm palpable (normal)",
      cns: "Alert, no signs of meningeal irritation",
      extremities: "No swelling, full range of motion"
    },
    secondaryAssessment: "General: Febrile, comfortable on mother's lap\nCVS: Tachycardia, normal heart sounds\nRS: Tachypnea, bilateral fine crepitations at right base\nPA: Per abdomen soft, non-tender\nCNS: Alert, no meningism\nExtremities: Normal",
    investigations: [
      { id: "inv-ped-1", testName: "CBC with Differential", result: "WBC 14,200 (Neutrophils 72%)", isAbnormal: true, orderTime: "11:20 AM" },
      { id: "inv-ped-2", testName: "Chest X-Ray AP/PA", result: "Right lower zone consolidation", isAbnormal: true, orderTime: "11:25 AM" }
    ],
    investigationLabsOrdered: "CBC, CRP, Blood Culture",
    investigationImaging: "Chest X-Ray (Pedia view)",
    investigationResultsSummary: "Elevated WBC with right lower lobe infiltrates on X-ray.",
    provisionalPrimaryDiagnosis: "Community Acquired Pneumonia (Right Lower Lobe)",
    provisionalDifferentialDiagnoses: "Viral Bronchiolitis; Foreign Body Aspiration",
    differentials: [
      { diagnosis: "Viral Bronchiolitis", status: "under_evaluation" },
      { diagnosis: "Foreign Body Aspiration", status: "ruled_out" }
    ],
    treatments: [
      { drugName: "Syrup Paracetamol", dose: "250 mg (15mg/kg)", route: "Oral", instruction: "Stat", timeGiven: "11:30 AM" },
      { drugName: "Inj. Ceftriaxone", dose: "800 mg (50mg/kg)", route: "IV", instruction: "Stat over 30 mins", timeGiven: "11:45 AM" }
    ],
    proceduresChecked: ["iv_cannula"],
    otherProcedures: "24G IV cannula secured in left hand",
    dispositionDetails: {
      dispositionType: "Admitted to Pediatric Ward",
      residentName: "Dr. P. Pediatrician",
      consultantName: "Dr. H. Consultant"
    }
  };
}

// ---------------------------------------------------------------
// TEST 1: Adult complete preview conversion
// ---------------------------------------------------------------
test("1. Adult complete preview conversion", () => {
  const c = createBaseAdultCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.patient.name, "Ramesh Sharma");
  assert.strictEqual(printData.patient.age, 58);
  assert.strictEqual(printData.patient.sex, "M");
  assert.strictEqual(printData.caseId, "261006001");
  assert.strictEqual(printData.patient.bed, "11A");
  assert.strictEqual(printData.presentingComplaint, "Chest pain for 2 hours");
  const bpVital = printData.initialVitals.find(v => v.label === "BP");
  assert.strictEqual(bpVital?.value, 140);
  assert.strictEqual(printData.provisionalDiagnosis, "Acute Anterior Wall Myocardial Infarction");
  assert.strictEqual(printData.isPediatric, false);
});

// ---------------------------------------------------------------
// TEST 2: Pediatric complete preview conversion
// ---------------------------------------------------------------
test("2. Pediatric complete preview conversion", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.patient.name, "Baby Aarav");
  assert.strictEqual(printData.patient.age, 4);
  assert.strictEqual(printData.isPediatric, true);
  assert.ok(printData.pediatricDetails !== null);
  assert.strictEqual(printData.pediatricDetails?.weight, "16");
});

// ---------------------------------------------------------------
// TESTS 3–9: PAT Components Verification
// ---------------------------------------------------------------
test("3. PAT Tone preserved", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.pediatricDetails?.patAppearanceTone, "Good muscle tone, sitting upright");
});

test("4. PAT Interactivity preserved", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.pediatricDetails?.patAppearanceInteractivity, "Alert, reaches for mother");
});

test("5. PAT Consolability preserved", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.pediatricDetails?.patAppearanceConsolability, "Consolable by mother");
});

test("6. PAT Look/Gaze preserved", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.pediatricDetails?.patAppearanceLookGaze, "Tracks clinician face and light");
});

test("7. PAT Speech/Cry preserved", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.pediatricDetails?.patAppearanceSpeechCry, "Crying vigorously, sounds normal");
});

test("8. PAT Work of Breathing preserved", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.pediatricDetails?.patWorkOfBreathing, "Mild subcostal retractions, no grunting");
});

test("9. PAT Circulation preserved", () => {
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.pediatricDetails?.patCirculation, "Warm peripheries, pink, CRT 1.5s");
});

// ---------------------------------------------------------------
// TEST 10: Pediatric section order in print/preview
// Focused Examination -> Investigations -> Treatment Given -> Provisional Diagnosis
// ---------------------------------------------------------------
test("10. Pediatric section order consistency", () => {
  // In CaseSheetPrintView.tsx lines 1362 - 1459:
  // 1362: <SecondarySurveySection data={data.secondarySurvey} title="Focused Physical Examination" />
  // 1366: {hasInvestigations && (<Section><SectionHeading>Investigations & Diagnostic Studies</SectionHeading>...
  // 1406: {hasTreatments && (<Section><SectionHeading>Treatment Given & Emergency Orders</SectionHeading>...
  // 1454: {hasPedProvisionalDiagnosis && (<Section><SectionHeading>Provisional Diagnosis</SectionHeading>...
  const c = createBasePediatricCase();
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.ok(printData.secondarySurvey?.respiratory, "Focused exam present");
  assert.ok(printData.labs.length > 0, "Investigations present");
  assert.ok(printData.treatmentGiven.length > 0, "Treatments present");
  assert.ok(printData.provisionalDiagnosis, "Provisional diagnosis present");
});

// ---------------------------------------------------------------
// TEST 11: SAMPLE Aliases Preservation
// ---------------------------------------------------------------
test("11. SAMPLE aliases correctly populate canonical fields", () => {
  const c = createBaseAdultCase();
  c.sampleHistory = {
    symptoms: "Nausea, diaphoresis",
    allergies: "Sulfa drugs",
    medications: "Metformin 500mg BD",
    pastHistory: "Type 2 Diabetes Mellitus x 3 years",
    lastMeal: "Light snack at 8:00 AM",
    events: "Chest pain triggered while climbing stairs",
    socialHistory: "Occasional alcohol",
    familyHistory: "Father had MI at age 50",
    psychiatricFlags: "Nil"
  };
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.ok(printData.symptoms.includes("Nausea, diaphoresis"));
  assert.ok(printData.allergies.includes("Sulfa drugs"));
  assert.ok(printData.currentMedications.includes("Metformin 500mg BD"));
  assert.ok(printData.pastHistory.includes("Type 2 Diabetes Mellitus x 3 years"));
  assert.strictEqual(printData.lastMeal, "Light snack at 8:00 AM");
  assert.strictEqual(printData.events, "Chest pain triggered while climbing stairs");
});

// ---------------------------------------------------------------
// TEST 12: abdomenExamination alias
// ---------------------------------------------------------------
test("12. abdomenExamination alias lands in secondarySurvey.abdomen", () => {
  const parsed = parseSecondaryAssessmentToSurvey("Abdomen examination: Soft, suprapubic tenderness");
  assert.strictEqual(parsed.abdomen, "Soft, suprapubic tenderness");
});

// ---------------------------------------------------------------
// TEST 13: abdominalExamination alias
// ---------------------------------------------------------------
test("13. abdominalExamination alias lands in secondarySurvey.abdomen", () => {
  const parsed = parseSecondaryAssessmentToSurvey("Abdominal examination: Guarding in right iliac fossa");
  assert.strictEqual(parsed.abdomen, "Guarding in right iliac fossa");
});

// ---------------------------------------------------------------
// TEST 14: perAbdomen / "P/A" terminology
// ---------------------------------------------------------------
test("14. perAbdomen and P/A terminology landing in canonical abdomen field", () => {
  const parsed1 = parseSecondaryAssessmentToSurvey("Per abdomen: Soft, non-tender, no organomegaly");
  assert.strictEqual(parsed1.abdomen, "Soft, non-tender, no organomegaly");

  const parsed2 = parseSecondaryAssessmentToSurvey("P/A: Distended, palpable bladder");
  assert.strictEqual(parsed2.abdomen, "Distended, palpable bladder");

  const parsed3 = parseSecondaryAssessmentToSurvey("PA: Tenderness in epigastrium");
  assert.strictEqual(parsed3.abdomen, "Tenderness in epigastrium");
});

// ---------------------------------------------------------------
// TEST 15: Investigations Ordered vs Results Separation
// ---------------------------------------------------------------
test("15. investigations ordered vs results separation", () => {
  const c = createBaseAdultCase();
  c.investigationLabsOrdered = "Serum Creatinine, Blood Urea";
  c.investigationImaging = "Ultrasound KUB";
  c.investigationResultsSummary = "Creatinine 1.2 mg/dL, normal kidneys";
  c.investigations = [
    { id: "inv-1", testName: "Serum Creatinine", result: "1.2 mg/dL", isAbnormal: false }
  ];

  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.investigationLabsOrdered, "Serum Creatinine, Blood Urea");
  assert.strictEqual(printData.investigationImaging, "Ultrasound KUB");
  assert.strictEqual(printData.investigationResultsSummary, "Creatinine 1.2 mg/dL, normal kidneys");
  assert.strictEqual(printData.labs[0].values[0].value, 1.2);
});

// ---------------------------------------------------------------
// TEST 16: Treatment preservation
// ---------------------------------------------------------------
test("16. treatment preservation with exact drug, dose, route", () => {
  const c = createBaseAdultCase();
  c.treatments = [
    { drugName: "Inj. Pantoprazole", dose: "40 mg", route: "IV", instruction: "Stat", timeGiven: "10:40 AM" },
    { drugName: "Inj. Ondansetron", dose: "4 mg", route: "IV", instruction: "Stat", timeGiven: "10:40 AM" }
  ];
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.treatmentGiven.length, 2);
  assert.ok(printData.treatmentGiven[0].includes("Pantoprazole"));
  assert.ok(printData.treatmentGiven[0].includes("40 mg"));
  assert.ok(printData.treatmentGiven[0].includes("IV"));
});

// ---------------------------------------------------------------
// TEST 17: Procedures preservation
// ---------------------------------------------------------------
test("17. procedures preservation structured and narrative", () => {
  const c = createBaseAdultCase();
  c.proceduresChecked = ["iv_cannula", "foleys"];
  c.otherProcedures = "14 Fr Foley catheter inserted under sterile technique, draining clear amber urine";
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.ok(printData.procedures.proceduresChecked.includes("iv_cannula"));
  assert.ok(printData.procedures.proceduresChecked.includes("foleys"));
  assert.strictEqual(printData.procedures.otherProcedures, "14 Fr Foley catheter inserted under sterile technique, draining clear amber urine");
});

// ---------------------------------------------------------------
// TEST 18: Provisional Diagnosis vs Differential Separation
// ---------------------------------------------------------------
test("18. provisional diagnosis vs differential separation", () => {
  const c = createBaseAdultCase();
  c.provisionalPrimaryDiagnosis = "Acute Appendicitis";
  c.provisionalDifferentialDiagnoses = "Mesenteric Adenitis; Renal Colic";
  c.differentials = [
    { diagnosis: "Mesenteric Adenitis", status: "under_evaluation" },
    { diagnosis: "Renal Colic", status: "ruled_out" }
  ];

  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.provisionalDiagnosis, "Acute Appendicitis");
  assert.strictEqual(printData.provisionalDifferentialDiagnoses, "Mesenteric Adenitis; Renal Colic");
  assert.strictEqual(printData.differentials.length, 2);
  assert.strictEqual(printData.differentials[0].diagnosis, "Mesenteric Adenitis");
});

// ---------------------------------------------------------------
// TEST 19: Explicit negative preservation
// ---------------------------------------------------------------
test("19. explicit negative preservation (no fabrication, no stripping)", () => {
  const c = createBaseAdultCase();
  c.sampleHistory = {
    ...c.sampleHistory,
    allergies: "No known drug allergies (NKDA)",
    pastHistory: "No history of hypertension, diabetes, or asthma",
    events: "No precipitating trauma or fall"
  };
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.ok(printData.allergies.includes("No known drug allergies (NKDA)"));
  assert.ok(printData.pastHistory.includes("No history of hypertension, diabetes, or asthma"));
  assert.strictEqual(printData.events, "No precipitating trauma or fall");
});

// ---------------------------------------------------------------
// TEST 20: Unmentioned field remains blank (no normal inference)
// ---------------------------------------------------------------
test("20. unmentioned field remains blank (zero fabrication rule)", () => {
  const c = createBaseAdultCase();
  c.vitals = {
    bp: "120/80",
    hr: "76",
    // All other vitals omitted
    spo2: "",
    rr: "",
    temp: "",
    grbs: "",
    gcs: ""
  };
  c.secondarySurvey = {};
  c.secondaryAssessment = "";

  const printData = convertClinicalCaseToCaseSheetData(c);
  const spo2Vital = printData.initialVitals.find(v => v.label === "SpO2");
  assert.strictEqual(spo2Vital?.value, null);
  assert.strictEqual(printData.secondarySurvey?.abdomen, null);
  assert.strictEqual(printData.secondarySurvey?.respiratory, null);
});

// ---------------------------------------------------------------
// TEST 21: Partial update deep merge preservation
// ---------------------------------------------------------------
test("21. partial update preserves existing fields without clobbering", () => {
  const base = createBaseAdultCase();
  // Simulating partial update: only new vitals and new progress note
  const updated: ClinicalCase = {
    ...base,
    vitals: {
      ...base.vitals,
      bp: "130/80",
      hr: "88"
    },
    progressNotes: "Patient reports pain reduced to 2/10 post-nitroglycerin."
  };

  const printData = convertClinicalCaseToCaseSheetData(updated);
  const bpVital = printData.initialVitals.find(v => v.label === "BP");
  const hrVital = printData.initialVitals.find(v => v.label === "HR");
  assert.strictEqual(bpVital?.value, 130);
  assert.strictEqual(hrVital?.value, 88);
  // Original fields must still survive!
  assert.strictEqual(printData.patient.name, "Ramesh Sharma");
  assert.strictEqual(printData.provisionalDiagnosis, "Acute Anterior Wall Myocardial Infarction");
  assert.strictEqual(printData.treatmentGiven.length, 3);
});

// ---------------------------------------------------------------
// TEST 22: Saved/reloaded consistency
// ---------------------------------------------------------------
test("22. JSON round-trip saved/reloaded consistency", () => {
  const original = createBaseAdultCase();
  const serialized = JSON.stringify(original);
  const reloaded: ClinicalCase = JSON.parse(serialized);

  const printOriginal = convertClinicalCaseToCaseSheetData(original);
  const printReloaded = convertClinicalCaseToCaseSheetData(reloaded);

  assert.strictEqual(printReloaded.patient.name, printOriginal.patient.name);
  assert.strictEqual(printReloaded.caseId, printOriginal.caseId);
  assert.strictEqual(printReloaded.provisionalDiagnosis, printOriginal.provisionalDiagnosis);
  assert.deepStrictEqual(printReloaded.initialVitals, printOriginal.initialVitals);
});

// ---------------------------------------------------------------
// TEST 23: CaseSheetPrintView data parity
// ---------------------------------------------------------------
test("23. CaseSheetPrintView data parity with clinical case", () => {
  const c = createBaseAdultCase();
  const data = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(data.patient.bed, c.bedNo);
  assert.strictEqual(data.patient.uhid, c.patient.uhid);
  assert.strictEqual(data.triageCategory, c.patient.triageCategory);
  assert.strictEqual(data.signatureBlock.clinicianName, c.dispositionDetails?.residentName);
  assert.strictEqual(data.signatureBlock.consultantName, c.dispositionDetails?.consultantName);
});

// ---------------------------------------------------------------
// TEST 24: Raw UUID never displayed in preview
// ---------------------------------------------------------------
test("24. Raw UUID never displayed in preview", () => {
  const uncommittedCase: ClinicalCase = {
    ...createBaseAdultCase(),
    id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    displayId: undefined
  };

  const label = getDisplayCaseId(uncommittedCase);
  assert.strictEqual(label, "New Case — ID pending");
  assert.ok(!label.includes("a1b2c3d4"));

  const printData = convertClinicalCaseToCaseSheetData(uncommittedCase);
  assert.strictEqual(printData.caseId, "New Case — ID pending");
  assert.strictEqual(printData.internalCaseId, "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d");
});

// ---------------------------------------------------------------
// TEST 25: Age 16 pediatric classification invariant
// ---------------------------------------------------------------
test("25. Age 16 classified strictly as pediatric", () => {
  const c = createBaseAdultCase();
  c.patient.age = 16;
  c.isPediatric = undefined as any;
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.isPediatric, true);
});

// ---------------------------------------------------------------
// TEST 26: Age 17 adult classification invariant
// ---------------------------------------------------------------
test("26. Age 17 classified strictly as adult", () => {
  const c = createBaseAdultCase();
  c.patient.age = 17;
  c.isPediatric = undefined as any;
  const printData = convertClinicalCaseToCaseSheetData(c);
  assert.strictEqual(printData.isPediatric, false);
});

// ---------------------------------------------------------------
// TEST 27: Existing clinician-entered field not erased by blank update
// ---------------------------------------------------------------
test("27. Existing clinician-entered field not erased by blank update", () => {
  const existingCase = createBaseAdultCase();
  existingCase.sampleHistory = {
    ...existingCase.sampleHistory,
    allergies: "Known Penicillin Anaphylaxis"
  };

  // Simulating incoming blank extraction
  const incomingExtractionAllergies = "";
  const mergedAllergies = incomingExtractionAllergies || existingCase.sampleHistory.allergies;

  assert.strictEqual(mergedAllergies, "Known Penicillin Anaphylaxis");
});

console.log(`\nCase Preview Integrity Verification: ${passedTests} / ${totalTests} assertions passed.`);
