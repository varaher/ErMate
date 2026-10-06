import assert from "node:assert";
import { ClinicalCase, DischargeInfo } from "./src/types";
import { getDisplayCaseId } from "./src/utils/caseIdentity";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import {
  deriveInitialCourseInHospital,
  mergeAutoCoursePreservingManualEdits,
  extractPrecedingEvent,
  formatDischargeMedicationsText,
  formatInvestigationsText
} from "./src/utils/dischargeSyncEngine";
import { formatDischargeSummaryText, formatDischargeSummaryHtml } from "./src/utils/dischargeSummaryFormat";

console.log("==================================================");
console.log("ERMATE — CLINICAL PREVIEW INTEGRITY VERIFICATION");
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
// TEST 1: Display ID Preview Protection — No Raw UUID in UI
// ---------------------------------------------------------------
test("Display ID Preview Protection (New Case — ID pending)", () => {
  const rawUuid = "0908b2d7-bfa2-49f4-b7a4-57b6d9f3f209";
  const draftNewCase: ClinicalCase = {
    id: rawUuid,
    displayId: undefined,
    status: "Active",
    savedTime: "10:00 AM",
    timeSpentMin: 1,
    isPediatric: false,
    patient: {
      name: "Ramesh Sharma",
      age: 58,
      gender: "Male",
      presentingComplaint: "Chest pain for 2 hours",
      triageCategory: "P1 Immediate",
      dateOpened: "10:00 AM | Oct 6",
      isMlc: false,
      uhid: "UHID-123456"
    },
    vitals: {
      bp: "140/90",
      hr: "98",
      spo2: "98",
      rr: "18",
      temp: "98.6",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6",
      grbs: "110",
      avpu: "Alert",
      painScore: "7"
    },
    sampleHistory: {
      symptoms: "Retrosternal chest pain",
      allergies: "NKDA",
      medications: "Tab Amlodipine 5mg",
      pastHistory: "HTN x 5 years",
      lastMeal: "2 hours ago",
      events: "Pain started while walking",
      socialHistory: "Non-smoker",
      familyHistory: "CAD in father",
      psychiatricFlags: ""
    },
    primaryAssessment: {
      airway: "Patent",
      breathing: "Bilateral air entry equal",
      circulation: "S1 S2 heard, peripheral pulses well felt",
      disability: "GCS 15/15, pupils 3mm equal reactive",
      exposure: "No rashes or trauma"
    },
    secondaryAssessment: "General: Comfortable at rest\nCVS: S1 S2 heard, no murmurs\nRS: Clear bilaterally\nPA: Soft, non-tender",
    investigations: [],
    treatments: [],
    progressNotes: "",
    dischargeInfo: null,
    differentials: []
  };

  // 1. getDisplayCaseId must return "New Case — ID pending", NOT the UUID
  const displayLabel = getDisplayCaseId(draftNewCase);
  assert.strictEqual(displayLabel, "New Case — ID pending", `Expected "New Case — ID pending", got "${displayLabel}"`);
  assert.ok(!displayLabel.includes(rawUuid), "Raw UUID must not be exposed");

  // 2. convertClinicalCaseToCaseSheetData must have caseId = "New Case — ID pending" and internalCaseId = rawUuid
  const converted = convertClinicalCaseToCaseSheetData(draftNewCase);
  assert.strictEqual(converted.caseId, "New Case — ID pending");
  assert.strictEqual(converted.internalCaseId, rawUuid);

  // 3. Saved case with assigned displayId returns the 9-digit displayId
  const savedCase = { ...draftNewCase, displayId: "261006001" };
  assert.strictEqual(getDisplayCaseId(savedCase), "261006001");
  assert.strictEqual(convertClinicalCaseToCaseSheetData(savedCase).caseId, "261006001");

  // 4. Legacy case with C-2976 returns C-2976
  const legacyCase = { ...draftNewCase, id: "C-2976", displayId: undefined };
  assert.strictEqual(getDisplayCaseId(legacyCase), "C-2976");
  assert.strictEqual(convertClinicalCaseToCaseSheetData(legacyCase).caseId, "C-2976");
});

// ---------------------------------------------------------------
// TEST 2: Adult Case Sheet End-to-End Field Integrity
// ---------------------------------------------------------------
test("Adult Case Sheet Complete Field Integrity Through Print Data", () => {
  const adultCase: ClinicalCase = {
    id: "uuid-adult-001",
    displayId: "261006002",
    bedNo: "11A",
    status: "Active",
    savedTime: "10:15 AM",
    timeSpentMin: 2,
    isPediatric: false,
    patient: {
      name: "Suresh Kumar",
      age: 45,
      gender: "Male",
      presentingComplaint: "Acute severe chest pain, radiating to left arm",
      triageCategory: "P1 Immediate",
      dateOpened: "10:15 AM | Oct 6",
      isMlc: false,
      uhid: "UHID-789012"
    },
    vitals: {
      bp: "130/80",
      hr: "84",
      spo2: "99",
      rr: "16",
      temp: "98.4",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6",
      grbs: "128",
      avpu: "Alert",
      painScore: "8"
    },
    sampleHistory: {
      symptoms: "Chest pain, diaphoresis, nausea",
      allergies: "Sulfa drugs allergy",
      medications: "Tab Metoprolol 25mg OD",
      pastHistory: "Hypertension x 3 years",
      lastMeal: "Light breakfast at 8 AM",
      events: "Sudden onset while driving to office",
      socialHistory: "Occasional alcohol",
      familyHistory: "No sudden cardiac death",
      psychiatricFlags: ""
    },
    primaryAssessment: {
      airway: "Patent, speaking full sentences",
      breathing: "Normal work of breathing, bilaterally clear",
      circulation: "Radial pulse regular, BP 130/80, CRT < 2s",
      disability: "Alert, oriented x 3, pupils reactive",
      exposure: "Diaphoretic, no pedal edema"
    },
    secondaryAssessment: "General: Diaphoretic\nCVS: Normal S1 S2, no friction rub\nRS: Vesicular breath sounds\nPA: Soft non-tender\nExtremities: Pulses palpable",
    adjuncts: {
      ecgDone: "true",
      ecgNotes: "Sinus rhythm, ST elevation in II, III, aVF",
      echoDone: "true",
      echoNotes: "Inferior wall hypokinesia",
      efastNotes: "Negative for pericardial effusion",
      abgStatus: "done",
      abgPh: "7.41",
      abgPco2: "38",
      abgHco3: "24",
      abgLactate: "1.1"
    },
    investigations: [
      { id: "inv-1", testName: "Troponin I", result: "0.85 ng/mL (High)", orderTime: "10:20", resultTime: "10:45", isAbnormal: true },
      { id: "inv-2", testName: "CBC", result: "Ordered", orderTime: "10:20", resultTime: "Pending", isAbnormal: false }
    ],
    treatments: [
      { id: "trt-1", drugName: "Tab Aspirin", dose: "300 mg", route: "Oral", instruction: "Chewed immediately", timeGiven: "10:18", ipsgVerified: true, provenance: "scribe" },
      { id: "trt-2", drugName: "Tab Clopidogrel", dose: "300 mg", route: "Oral", instruction: "Stat", timeGiven: "10:18", ipsgVerified: true, provenance: "scribe" },
      { id: "trt-3", drugName: "Inj Heparin", dose: "5000 IU", route: "IV", instruction: "Bolus", timeGiven: "10:25", ipsgVerified: true, provenance: "scribe" }
    ],
    treatmentNotes: "Patient loaded with dual antiplatelet therapy. Cath lab activated.",
    provisionalPrimaryDiagnosis: "Acute Inferior Wall STEMI",
    differentials: [
      { diagnosis: "Aortic Dissection", status: "LESS LIKELY", reasoning: "Pulses symmetric, no tearing back pain", citations: [], nextSteps: [] },
      { diagnosis: "Acute Pericarditis", status: "LESS LIKELY", reasoning: "Localized ST elevation without PR depression", citations: [], nextSteps: [] }
    ],
    dispositionAndPlan: {
      dispositionStatus: "Admit",
      destinationUnit: "Cath Lab / CCU",
      consultsRequested: ["Cardiology"],
      managementPlan: "Primary PCI planned. Shifted urgently to Cath Lab.",
      followUpAdvice: "Post-PCI CCU care."
    },
    conditionAtShift: "Stable",
    progressNotes: "",
    dischargeInfo: null
  };

  const sheet = convertClinicalCaseToCaseSheetData(adultCase);

  // Field integrity checks
  assert.strictEqual(sheet.caseId, "261006002");
  assert.strictEqual(sheet.patient.name, "Suresh Kumar");
  assert.strictEqual(sheet.patient.age, 45);
  assert.strictEqual(sheet.patient.sex, "M");
  assert.strictEqual(sheet.patient.bed, "11A");
  assert.strictEqual(sheet.triageCategory, "P1 Immediate");
  assert.strictEqual(sheet.presentingComplaint, "Acute severe chest pain, radiating to left arm");

  // Vitals
  assert.strictEqual(sheet.initialVitals.find(v => v.label === "BP")?.value, 130);
  assert.strictEqual(sheet.initialVitals.find(v => v.label === "HR")?.value, 84);
  assert.strictEqual(sheet.initialVitals.find(v => v.label === "SpO2")?.value, 99);
  assert.strictEqual(sheet.initialVitals.find(v => v.label === "RR")?.value, 16);
  assert.strictEqual(sheet.initialVitals.find(v => v.label === "GCS")?.value, 15);

  // SAMPLE History
  assert.ok(sheet.allergies.includes("Sulfa drugs allergy"));
  assert.ok(sheet.currentMedications.some(m => m.includes("Metoprolol")));
  assert.ok(sheet.pastHistory.some(p => p.includes("Hypertension")));
  assert.strictEqual(sheet.lastMeal, "Light breakfast at 8 AM");
  assert.strictEqual(sheet.events, "Sudden onset while driving to office");

  // Adjuncts
  assert.ok(sheet.ecg.performed);
  assert.ok(sheet.ecg.findings.includes("ST elevation in II, III, aVF"));
  assert.ok(sheet.bedsideEcho.performed);
  assert.ok(sheet.bedsideEcho.findings.includes("Inferior wall hypokinesia"));

  // Treatments
  assert.strictEqual(sheet.treatmentGiven.length, 3);
  assert.ok(sheet.treatmentGiven[0].includes("Aspirin"));

  // Diagnosis
  assert.strictEqual(sheet.provisionalDiagnosis, "Acute Inferior Wall STEMI");
  assert.strictEqual(sheet.differentials.length, 2);
  assert.strictEqual(sheet.differentials[0].diagnosis, "Aortic Dissection");

  // Disposition
  assert.strictEqual(sheet.disposition.status, "Admit");
  assert.strictEqual(sheet.disposition.conditionAtShift, "Stable");
  assert.ok(sheet.disposition.consultsRequested.includes("Cardiology"));
});

// ---------------------------------------------------------------
// TEST 3: Pediatric Case Sheet & PAT Integration
// ---------------------------------------------------------------
test("Pediatric Case Sheet PAT & Weight Alias Synchronization", () => {
  const pedCase: ClinicalCase = {
    id: "uuid-ped-001",
    displayId: "261006003",
    bedNo: "2",
    status: "Active",
    savedTime: "11:00 AM",
    timeSpentMin: 1,
    isPediatric: true,
    patient: {
      name: "Master Aarav",
      age: 4,
      gender: "Male",
      presentingComplaint: "Fever and barking cough for 2 days",
      triageCategory: "P2 Very Urgent",
      dateOpened: "11:00 AM | Oct 6",
      isMlc: false,
      uhid: "UHID-334455"
    },
    vitals: {
      bp: "95/60",
      hr: "120",
      spo2: "97",
      rr: "28",
      temp: "101.2",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6",
      grbs: "96",
      avpu: "Alert",
      painScore: "3"
    },
    sampleHistory: {
      symptoms: "Barking seal-like cough, inspiratory stridor on exertion",
      allergies: "Nil known",
      medications: "Nil",
      pastHistory: "No prior croup or asthma",
      lastMeal: "Milk 1 hour ago",
      events: "Worsened overnight",
      socialHistory: "Lives with parents",
      familyHistory: "No atopy in family",
      psychiatricFlags: ""
    },
    primaryAssessment: {
      airway: "Patent, inspiratory stridor when agitated, calm at rest",
      breathing: "Mild subcostal retractions, RR 28, SpO2 97%",
      circulation: "Pink, warm, CRT < 2s, HR 120 regular",
      disability: "Alert, tracks mother, consolable",
      exposure: "Temp 101.2 F, no rash"
    },
    secondaryAssessment: "General: Irritable on examination, consolable\nRS: Stridor noted, air entry bilaterally equal\nCVS: S1 S2 heard\nPA: Soft",
    pediatricDetails: {
      patientWeight: "16",
      weight: "16",
      patAppearanceTone: "Good tone, active",
      patAppearanceInteractivity: "Interacts with parents",
      patAppearanceConsolability: "Consolable by mother",
      patAppearanceLookGaze: "Normal eye contact",
      patAppearanceSpeechCry: "Barking cry, voice hoarse",
      patWorkOfBreathing: "Mild retractions, stridor on crying",
      patCirculation: "Pink, normal perfusion",
      immunizationHistory: "Up to date for age",
      birthHistory: "Full term normal delivery, cried immediately",
      feedingHistory: "Taking liquids well",
      developmentalHistory: "Normal milestones",
      broughtBy: "Mother",
      informant: "Mother"
    },
    investigations: [],
    treatments: [
      { id: "trt-p1", drugName: "Syr Dexamethasone", dose: "0.15 mg/kg (2.4 mg)", route: "Oral", instruction: "Single dose stat", timeGiven: "11:05", ipsgVerified: true, provenance: "scribe" },
      { id: "trt-p2", drugName: "L-Adrenaline Nebulization", dose: "1:1000 2 mL", route: "Nebulization", instruction: "With O2", timeGiven: "11:10", ipsgVerified: true, provenance: "scribe" }
    ],
    provisionalPrimaryDiagnosis: "Viral Croup (Laryngotracheobronchitis)",
    differentials: [
      { diagnosis: "Acute Epiglottitis", status: "LESS LIKELY", reasoning: "No drooling, patient consolable", citations: [], nextSteps: [] },
      { diagnosis: "Foreign Body Aspiration", status: "LESS LIKELY", reasoning: "Prodromal viral fever for 2 days", citations: [], nextSteps: [] }
    ],
    dispositionAndPlan: {
      dispositionStatus: "Observation",
      destinationUnit: "Pediatric ER Observation",
      managementPlan: "Observe for 2 hours post-adrenaline for rebound stridor. Discharge if calm with no resting stridor.",
      followUpAdvice: "Return immediately if stridor at rest or breathing difficulty recurs."
    },
    conditionAtShift: "Stable",
    progressNotes: "",
    dischargeInfo: null
  };

  const sheet = convertClinicalCaseToCaseSheetData(pedCase);

  // Verification of pediatric specifics
  assert.strictEqual(sheet.isPediatric, true);
  assert.ok(sheet.pediatricDetails !== null);
  assert.strictEqual(sheet.pediatricDetails?.weight, "16");
  assert.strictEqual(sheet.pediatricDetails?.patAppearanceTone, "Good tone, active");
  assert.strictEqual(sheet.pediatricDetails?.patAppearanceInteractivity, "Interacts with parents");
  assert.strictEqual(sheet.pediatricDetails?.patAppearanceConsolability, "Consolable by mother");
  assert.strictEqual(sheet.pediatricDetails?.patWorkOfBreathing, "Mild retractions, stridor on crying");
  assert.strictEqual(sheet.pediatricDetails?.patCirculation, "Pink, normal perfusion");
  assert.strictEqual(sheet.pediatricDetails?.immunizationHistory, "Up to date for age");
  assert.strictEqual(sheet.pediatricDetails?.birthHistory, "Full term normal delivery, cried immediately");
  assert.strictEqual(sheet.pediatricDetails?.broughtBy, "Mother");
  assert.strictEqual(sheet.pediatricDetails?.informant, "Mother");
});

// ---------------------------------------------------------------
// TEST 4: Discharge Summary Clinical Course & Separation Rules
// ---------------------------------------------------------------
test("Discharge Summary Canonical 9-Section Course & Rx Separation", () => {
  const caseForDischarge: ClinicalCase = {
    id: "uuid-disc-001",
    displayId: "261006004",
    bedNo: "5",
    status: "Active",
    savedTime: "12:00 PM",
    timeSpentMin: 1,
    isPediatric: false,
    patient: {
      name: "Anil Deshmukh",
      age: 62,
      gender: "Male",
      presentingComplaint: "Severe colicky right flank pain radiating to groin for 4 hours",
      triageCategory: "P2 Very Urgent",
      dateOpened: "12:00 PM | Oct 6",
      isMlc: false,
      uhid: "UHID-998877"
    },
    vitals: {
      bp: "150/90",
      hr: "92",
      spo2: "98",
      rr: "18",
      temp: "98.6",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6",
      grbs: "118",
      avpu: "Alert",
      painScore: "9"
    },
    sampleHistory: {
      symptoms: "Right flank pain, microscopic hematuria, nausea",
      allergies: "NKDA",
      medications: "Tab Telmisartan 40mg",
      pastHistory: "Renal calculus 3 years ago",
      lastMeal: "Lunch at 11 AM",
      events: "Sudden onset while sitting at desk",
      socialHistory: "Nil",
      familyHistory: "Nil",
      psychiatricFlags: ""
    },
    primaryAssessment: {
      airway: "Patent",
      breathing: "Clear",
      circulation: "HR 92, BP 150/90",
      disability: "GCS 15",
      exposure: "Right renal angle tenderness present"
    },
    secondaryAssessment: "General: Restless due to severe pain\nPA: Soft, severe right flank tenderness, no guarding",
    adjuncts: {
      efastNotes: "USG KUB: 6mm calculus in right lower ureter, mild hydronephrosis"
    },
    investigations: [
      { id: "inv-u1", testName: "Urine Routine", result: "RBCs 20-25/hpf, protein nil", orderTime: "12:10", resultTime: "12:30", isAbnormal: true },
      { id: "inv-u2", testName: "Serum Creatinine", result: "1.0 mg/dL (Normal)", orderTime: "12:10", resultTime: "12:40", isAbnormal: false }
    ],
    // ER Acute Treatments Given
    treatments: [
      { id: "trt-er-1", drugName: "Inj Tramadol", dose: "50 mg", route: "IV", instruction: "Slow in 100ml NS", timeGiven: "12:15", ipsgVerified: true, provenance: "scribe" },
      { id: "trt-er-2", drugName: "Inj Ondansetron", dose: "4 mg", route: "IV", instruction: "Stat", timeGiven: "12:15", ipsgVerified: true, provenance: "scribe" }
    ],
    treatmentNotes: "Pain subsided to 2/10 after 30 minutes.",
    provisionalPrimaryDiagnosis: "Right Ureteric Calculus (6mm) with Renal Colic",
    differentials: [
      { diagnosis: "Acute Appendicitis", status: "LESS LIKELY", reasoning: "Flank tenderness with hematuria, no McBurney sign", citations: [], nextSteps: [] }
    ],
    dispositionAndPlan: {
      dispositionStatus: "Discharged",
      destinationUnit: "Home",
      consultsRequested: ["Urology"],
      managementPlan: "Medical expulsive therapy initiated. Follow up with Urology OPD.",
      followUpAdvice: "Hydration > 2.5L/day. Return if intractable pain, fever, or anuria."
    },
    conditionAtShift: "Stable",
    progressNotes: "",
    dischargeInfo: null
  };

  // 1. Course in hospital derivation
  const course = deriveInitialCourseInHospital(caseForDischarge);
  assert.ok(course.includes("Presentation:"));
  assert.ok(course.includes("Initial Assessment:"));
  assert.ok(course.includes("Treatment Given:"));
  assert.ok(course.includes("Inj Tramadol"));
  // Notice: no fake sections fabricated
  assert.ok(!course.includes("Procedures were not performed"));
  assert.ok(!course.includes("Baseline investigations were not ordered"));

  // 2. Format discharge summary text and HTML
  const dischargeData = {
    patientName: caseForDischarge.patient.name,
    patientAge: caseForDischarge.patient.age || "",
    patientGender: caseForDischarge.patient.gender,
    uhid: caseForDischarge.patient.uhid || "",
    isMlc: "No",
    mlcNo: "",
    allergies: caseForDischarge.sampleHistory.allergies,
    arrivalHr: caseForDischarge.vitals.hr,
    arrivalBp: caseForDischarge.vitals.bp,
    arrivalRr: caseForDischarge.vitals.rr,
    arrivalSpo2: caseForDischarge.vitals.spo2,
    arrivalGcs: caseForDischarge.vitals.gcs,
    arrivalPainScore: caseForDischarge.vitals.painScore,
    arrivalGrbs: caseForDischarge.vitals.grbs,
    arrivalTemp: caseForDischarge.vitals.temp,
    presentingComplaints: caseForDischarge.patient.presentingComplaint,
    historyOfPresentIllness: caseForDischarge.sampleHistory.events,
    pastMedicalHistory: caseForDischarge.sampleHistory.pastHistory,
    familyGynaeHistory: "",
    lmp: "N/A",
    generalExamination: caseForDischarge.secondaryAssessment,
    primaryAirway: "Patent",
    primaryAirwayIntervention: "",
    primaryBreathingWork: "Normal",
    primaryBreathingAirEntry: "Clear",
    primaryBreathingCct: "",
    primaryBreathingSubcut: "",
    primaryBreathingEfast: "",
    primaryBreathingIntervention: "",
    primaryCirculationCrt: "< 2 sec",
    primaryCirculationDnv: "",
    primaryCirculationPct: "",
    primaryCirculationDeformity: "",
    primaryCirculationFast: "",
    primaryCirculationInterventions: "",
    primaryDisabilityAvpuGcs: "GCS 15",
    primaryDisabilityPupils: "",
    primaryDisabilityGrbs: caseForDischarge.vitals.grbs,
    primaryExposureTemp: caseForDischarge.vitals.temp,
    primaryExposureTrauma: "",
    secondaryPicle: "",
    secondaryChest: "",
    secondaryCvs: "",
    secondaryPa: "Flank tenderness",
    secondaryCns: "",
    secondaryExtremities: "",
    courseInHospital: course,
    investigationsResults: "Urine Routine: RBCs 20-25/hpf; Serum Creatinine: 1.0 mg/dL",
    primaryDiagnosis: caseForDischarge.provisionalPrimaryDiagnosis || "",
    secondaryDiagnosis: "",
    // Separate Discharge Rx (Medical Expulsive Therapy)
    dischargeMedications: "1. Tab Tamsulosin 0.4mg once daily at bedtime x 14 days\n2. Tab Paracetamol 650mg SOS for pain",
    dispositionStatus: "Normal Discharge",
    dischargeCondition: "Stable",
    dischargeHr: "78",
    dischargeBp: "124/78",
    dischargeRr: "16",
    dischargeSpo2: "99",
    dischargeGcs: "15",
    dischargePainScore: "1",
    dischargeGrbs: "105",
    dischargeTemp: "98.4",
    followUpPlan: "Urology OPD review after 5 days with repeat USG KUB",
    emResidentName: "Dr. Ananya Roy",
    emConsultantName: "Dr. Sandeep Patel",
    dischargeDateTime: "06/10/2026, 02:00 PM"
  };

  const formattedText = formatDischargeSummaryText(dischargeData);
  const formattedHtml = formatDischargeSummaryHtml(dischargeData);

  assert.ok(formattedText.includes("**PATIENT NAME:** Anil Deshmukh"));
  assert.ok(formattedText.includes("Right Ureteric Calculus"));
  assert.ok(formattedText.includes("Tab Tamsulosin 0.4mg"));
  assert.ok(formattedText.includes("Inj Tramadol")); // inside Course in Hospital
  assert.ok(formattedHtml.includes("Anil Deshmukh"));
  assert.ok(formattedHtml.includes("Tab Tamsulosin"));
});

console.log("==================================================");
console.log(`ALL PREVIEW INTEGRITY TESTS PASSED: ${passedTests}/${totalTests}`);
console.log("==================================================");
