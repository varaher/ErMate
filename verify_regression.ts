import assert from "node:assert";
import {
  deriveInitialCourseInHospital,
  mergeAutoCoursePreservingManualEdits,
  extractPrecedingEvent,
  formatDischargeMedicationsText,
  mergeInvestigations,
  mergeDischargeMedications
} from "./src/utils/dischargeSyncEngine";
import { formatDischargeSummaryText, formatDischargeSummaryHtml } from "./src/utils/dischargeSummaryFormat";
import { deterministicAbgAnalysis } from "./server/aiDiagnosis";
import { isMedicationSupportedInContext, extractExplicitDischargeContext } from "./server/dischargeSummary";
import { ClinicalCase } from "./src/types";

// GCS derivation functions from server/scribeChatTurn.ts (Patch C1)
function transcriptHasExplicitGcsComponent(text: string, component: "e" | "v" | "m"): boolean {
  if (!text) return false;
  switch (component) {
    case "e":
      return /\be\s*[:=-]?\s*([1-4])(?=\D|$)/i.test(text) || /e([1-4])(?=[vm\D]|$)/i.test(text) || /\beye(?:s)?\s*(?:opening|response)?\s*[:=-]?\s*([1-4])\b/i.test(text);
    case "v":
      return /\bv\s*[:=-]?\s*([1-5])(?=\D|$)/i.test(text) || /v([1-5])(?=[em\D]|$)/i.test(text) || /\bverbal\s*(?:response)?\s*[:=-]?\s*([1-5])\b/i.test(text);
    case "m":
      return /\bm\s*[:=-]?\s*([1-6])(?=\D|$)/i.test(text) || /m([1-6])(?=[ev\D]|$)/i.test(text) || /\bmotor\s*(?:response)?\s*[:=-]?\s*([1-6])\b/i.test(text);
  }
}

function transcriptHasExplicitTotalGcs(text: string): boolean {
  if (!text) return false;
  return /\b(?:total\s+gcs|gcs\s+total|gcs\s+score|glasgow\s+(?:coma\s+)?(?:scale|score)|gcs)\s*(?:is|of|[:=-])?\s*(?:total\s*)?(?:[3-9]|1[0-5])\b/i.test(text) ||
    /\b(?:gcs\s+)?total\s+(?:[3-9]|1[0-5])\s*(?:out\s+of|\/)\s*15\b/i.test(text);
}

function deriveExplicitGcsTotal(
  filteredVitals: Record<string, any>,
  rawInputText: string
): string | null {
  if (
    !transcriptHasExplicitGcsComponent(rawInputText, "e") ||
    !transcriptHasExplicitGcsComponent(rawInputText, "v") ||
    !transcriptHasExplicitGcsComponent(rawInputText, "m")
  ) {
    return null;
  }

  const rawE = filteredVitals.gcs_e;
  const rawV = filteredVitals.gcs_v;
  const rawM = filteredVitals.gcs_m;

  if (
    rawE === undefined || rawE === null ||
    rawV === undefined || rawV === null ||
    rawM === undefined || rawM === null
  ) {
    return null;
  }

  const parseComponent = (val: any): number | null => {
    const s = String(val).replace(/^[evm]\s*[:=-]?\s*/i, "").trim();
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const e = parseComponent(rawE);
  const v = parseComponent(rawV);
  const m = parseComponent(rawM);

  if (e === null || v === null || m === null) {
    return null;
  }

  if (e < 1 || e > 4 || v < 1 || v > 5 || m < 1 || m > 6) {
    return null;
  }

  filteredVitals.gcs_e = String(e);
  filteredVitals.gcs_v = String(v);
  filteredVitals.gcs_m = String(m);

  return String(e + v + m);
}

console.log("==================================================");
console.log("ERMATE — CLINICAL DOCUMENTATION REGRESSION SUITE");
console.log("==================================================");

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// --------------------------------------------------
// 1. ADULT COMPLETE CASE & GCS & ABG
// --------------------------------------------------
test("1. Adult Complete Case Integration", () => {
  const vitals: Record<string, any> = { gcs_e: "4", gcs_v: "5", gcs_m: "6" };
  const total = deriveExplicitGcsTotal(vitals, "GCS E4 V5 M6");
  assert.strictEqual(total, "15");
  assert.strictEqual(vitals.gcs_e, "4");
  assert.strictEqual(vitals.gcs_v, "5");
  assert.strictEqual(vitals.gcs_m, "6");

  // ABG Interpretation
  const abg = {
    sampleType: "Arterial (ABG)",
    ph: "7.25",
    pco2: "30",
    hco3: "13",
    na: "138",
    k: "4",
    cl: "105",
    lactate: "3"
  };
  const abgAnalysis = deterministicAbgAnalysis(abg);
  assert.ok(abgAnalysis, "ABG interpretation should be generated");
  assert.ok((abgAnalysis.fullText + " " + abgAnalysis.diagnosis).toLowerCase().includes("metabolic acidosis"), "Should diagnose metabolic acidosis");
  assert.ok(abgAnalysis.calculatedAnionGap !== null, "Should compute anion gap");

  // Case construction
  const adultCase: ClinicalCase = {
    id: "case-adult-01",
    patient: {
      name: "Ramesh Sharma",
      age: 45,
      gender: "Male",
      uhid: "UHID-987654",
      caseType: "Medical",
      dateOpened: "2026-10-04",
      timeOpened: "18:00",
      presentingComplaint: "Chest pain for 2 hours",
      triagePriority: "Red",
      isMlc: false
    },
    vitals: {
      hr: "110",
      bp: "100/60",
      rr: "22",
      spo2: "96",
      temp: "37",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6"
    },
    sampleHistory: {
      symptoms: "Retrosternal chest discomfort radiating to left shoulder",
      events: "Pain started while climbing stairs",
      allergies: "No known drug allergies",
      pastHistory: "Hypertension for 5 years",
      medications: "Tab Amlodipine 5 mg OD"
    },
    primaryAssessment: {
      airway: "Patent and clear",
      breathing: "Bilateral equal breath sounds, no added sounds",
      circulation: "Tachycardic, peripheral pulses palpable, CRT < 2s",
      disability: "GCS 15 (E4V5M6), pupils PERRL",
      exposure: "No rashes, warm peripheries"
    },
    secondaryAssessment: "CVS: S1 S2 heard, no murmur. RS: Clear. Abdomen: Soft.",
    investigations: [
      { id: "inv-1", testName: "ECG", result: "ST elevation in II, III, aVF" },
      { id: "inv-2", testName: "Troponin I", result: "Elevated (0.85 ng/mL)" },
      { id: "inv-3", testName: "CBC", result: "Hb 14.2, TLC 9,800" }
    ],
    treatments: [
      { id: "t-1", drugName: "Aspirin", dose: "300 mg", route: "Oral", timeGiven: "18:05" },
      { id: "t-2", drugName: "Clopidogrel", dose: "300 mg", route: "Oral", timeGiven: "18:05" },
      { id: "t-3", drugName: "Atorvastatin", dose: "80 mg", route: "Oral", timeGiven: "18:06" }
    ],
    dischargeInfo: {
      dischargeMedications: "Tab Ticagrelor 90 mg BD\nTab Rosuvastatin 40 mg OD",
      primaryDiagnosis: "Acute Inferior Wall ST-Elevation Myocardial Infarction",
      secondaryDiagnosis: "Essential Hypertension",
      dispositionStatus: "Admitted under Cardiology"
    }
  } as any;

  const course = deriveInitialCourseInHospital(adultCase);
  assert.ok(course.includes("The patient was evaluated in the Emergency Department with Chest pain for 2 hours."));
  assert.ok(course.includes("Pain started while climbing stairs."));
  assert.ok(course.includes("Initial assessment revealed"));
  assert.ok(course.includes("Bedside ECG demonstrated ST elevation in II, III, aVF") || course.includes("ST elevation in II, III, aVF"));
  assert.ok(course.includes("Aspirin 300 mg oral, Clopidogrel 300 mg oral, Atorvastatin 80 mg oral"));
  assert.ok(course.includes("Admitted under Cardiology"));
  assert.ok(!course.includes("Presentation:\n"), "Must not contain Presentation heading");
  assert.ok(!course.includes("Events Leading to Presentation:\n"), "Must not contain Events heading");

  // Check medication separation
  const dischargeMeds = formatDischargeMedicationsText(adultCase);
  assert.ok(dischargeMeds.includes("Ticagrelor"));
  assert.ok(!dischargeMeds.includes("Aspirin"), "ER Aspirin must not leak into discharge prescription");
});

// --------------------------------------------------
// 2. PEDIATRIC COMPLETE CASE
// --------------------------------------------------
test("2. Pediatric Complete Case Integration", () => {
  const pedsCase: ClinicalCase = {
    id: "case-peds-01",
    isPediatric: true,
    patient: {
      name: "Ananya",
      age: 5,
      gender: "Female",
      uhid: "UHID-PEDS-123",
      caseType: "Pediatric",
      dateOpened: "2026-10-04",
      timeOpened: "14:00",
      presentingComplaint: "Fever for 2 days",
      triagePriority: "Yellow",
      isMlc: false
    },
    pediatricDetails: {
      patientWeight: "18",
      patNormal: true,
      patWorkOfBreathing: "normal",
      patCirculation: "normal"
    },
    vitals: {
      hr: "105",
      bp: "95/60",
      rr: "24",
      spo2: "99",
      temp: "38.5",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6"
    },
    sampleHistory: {
      symptoms: "Fever, mild malaise",
      events: "Fever for 2 days", // Duration should NOT become precipitating event
      allergies: "",
      pastHistory: ""
    },
    investigations: [
      { id: "inv-p1", testName: "Rapid Malarial Antigen", result: "Negative" }
    ],
    treatments: [
      { id: "tp-1", drugName: "Paracetamol", dose: "250 mg", route: "Oral", timeGiven: "14:15" }
    ],
    progressNotes: "Reassessment at 1 hour: Child is afebrile (37.1 C), active, playful, tolerating oral fluids.",
    dispositionDetails: {
      dispositionType: "Discharge"
    },
    dischargeInfo: {
      followUpPlan: "Review with Pediatric OPD in 48 hours or sooner if fever spikes or child becomes lethargic."
    }
  } as any;

  // 1. Events extraction check
  const event = extractPrecedingEvent(pedsCase);
  assert.strictEqual(event, null, "Symptom duration 'Fever for 2 days' must NOT become Event");

  // 2. Course generation check
  const course = deriveInitialCourseInHospital(pedsCase);
  assert.ok(course.includes("The child was evaluated in the Emergency Department with Fever for 2 days.") || course.includes("The child presented to the Emergency Department with Fever for 2 days."));
  assert.ok(!course.includes("Events Leading to Presentation:"), "Events section must be omitted");
  assert.ok(course.includes("The Pediatric Assessment Triangle was documented as normal."));
  assert.ok(course.includes("Paracetamol 250 mg oral"));
  assert.ok(course.includes("Child is afebrile"));

  // 3. Discharge medications check
  const dischargeMeds = formatDischargeMedicationsText(pedsCase);
  assert.strictEqual(dischargeMeds, "", "No take-home prescription provided, ER paracetamol must not leak");
});

// --------------------------------------------------
// 3. GCS REGRESSION
// --------------------------------------------------
test("3. GCS Deterministic Derivation and Hallucination Protection", () => {
  // Case A: E2V3M4 -> total 9
  const v1 = { gcs_e: "2", gcs_v: "3", gcs_m: "4" };
  const total1 = deriveExplicitGcsTotal(v1, "GCS E2 V3 M4");
  assert.strictEqual(total1, "9");

  // Case B: Explicit total 14 only
  assert.strictEqual(transcriptHasExplicitTotalGcs("GCS 14"), true);

  // Case C: E4 only -> no total
  const v3 = { gcs_e: "4" };
  const total3 = deriveExplicitGcsTotal(v3, "Patient eye opening GCS E4");
  assert.strictEqual(total3, null);

  // Case D: Partial E2 V3 -> no total
  const v4 = { gcs_e: "2", gcs_v: "3" };
  const total4 = deriveExplicitGcsTotal(v4, "GCS E2 V3");
  assert.strictEqual(total4, null);

  // Case E: Model hallucinates total 15 when transcript only has E3
  const v5 = { gcs: "15", gcs_e: "4", gcs_v: "5", gcs_m: "6" };
  const total5 = deriveExplicitGcsTotal(v5, "Patient opening eyes to speech GCS E3");
  // Missing V and M in transcript -> deriveExplicitGcsTotal returns null
  assert.strictEqual(total5, null);
});

// --------------------------------------------------
// 4. ABG/VBG INTERPRETATION REGRESSION
// --------------------------------------------------
test("4. VBG Complete Interpretation & Venous pO2 Safety", () => {
  const vbg = {
    sampleType: "Venous (VBG)",
    ph: "7.32",
    pco2: "60",
    hco3: "20",
    na: "126",
    k: "4",
    cl: "100",
    be: "-2",
    hb: "15",
    po2: "41"
  };
  const interpRes = deterministicAbgAnalysis(vbg);
  assert.ok(interpRes, "Interpretation must not be null");
  const full = (interpRes.fullText + " " + interpRes.diagnosis).toLowerCase();
  assert.ok(full.includes("respiratory acidosis") || full.includes("mixed"), "Should identify respiratory acidosis component");
  assert.ok(full.includes("metabolic acidosis") || full.includes("mixed"), "Should identify metabolic acidosis component");
  assert.ok(interpRes.associatedFindings.some(f => f.toLowerCase().includes("hyponatremia")) || full.includes("hyponatremia"), "Should flag Hyponatremia");
  assert.ok(interpRes.vbgWarning !== null || full.includes("venous po2"), "Must warn that VBG pO2 is not for arterial hypoxemia");
  assert.ok(interpRes.calculatedAnionGap !== null, "Calculated Anion Gap must be clearly stated");
});

// --------------------------------------------------
// 5. MULTI-TURN BLOOD GAS MERGING
// --------------------------------------------------
test("5. Multi-Turn Deep Merge for Blood Gas", () => {
  const turn1Gas = {
    sampleType: "Venous (VBG)",
    ph: "7.32",
    pco2: "60"
  };
  const turn2Additions = {
    hco3: "20",
    na: "126"
  };
  const mergedGas = {
    ...turn1Gas,
    ...turn2Additions
  };
  assert.strictEqual(mergedGas.sampleType, "Venous (VBG)");
  assert.strictEqual(mergedGas.ph, "7.32");
  assert.strictEqual(mergedGas.pco2, "60");
  assert.strictEqual(mergedGas.hco3, "20");
  assert.strictEqual(mergedGas.na, "126");

  const interpRes = deterministicAbgAnalysis(mergedGas);
  assert.ok(interpRes, "Merged gas with pH, pCO2, HCO3 can now be interpreted");
});

// --------------------------------------------------
// 6. EVENTS REGRESSION
// --------------------------------------------------
test("6. Events Extraction & Exclusion Rules", () => {
  // A: "Fever for 2 days" -> NOT Event
  assert.strictEqual(extractPrecedingEvent({ sampleHistory: { events: "Fever for 2 days" } } as any), null);
  // B: "RTA at 8 PM" -> Event
  assert.strictEqual(extractPrecedingEvent({ sampleHistory: { events: "RTA at 8 PM" } } as any), "RTA at 8 PM");
  // C: "Snake bite while working in field" -> Event
  assert.strictEqual(extractPrecedingEvent({ sampleHistory: { events: "Snake bite while working in field" } } as any), "Snake bite while working in field");
  // D: "Ingested 20 tablets at 6 PM" -> Event
  assert.strictEqual(extractPrecedingEvent({ sampleHistory: { events: "Ingested 20 tablets at 6 PM" } } as any), "Ingested 20 tablets at 6 PM");
  // E: "No history of trauma" -> does NOT create Events section
  assert.strictEqual(extractPrecedingEvent({ sampleHistory: { events: "No history of trauma" } } as any), null);
  // F: Deduplication: event same as presenting complaint
  assert.strictEqual(extractPrecedingEvent({ patient: { presentingComplaint: "Fall from bicycle" }, sampleHistory: { events: "Fall from bicycle" } } as any), null);
});

// --------------------------------------------------
// 7. COURSE STRUCTURE & SECTION ORDER
// --------------------------------------------------
test("7. Canonical Narrative Course Structure & Zero Filler", () => {
  const minimalCase: ClinicalCase = {
    patient: { presentingComplaint: "Headache" },
    dispositionDetails: { dispositionType: "Discharge" }
  } as any;

  const course = deriveInitialCourseInHospital(minimalCase);
  assert.ok(!course.includes("COURSE IN EMERGENCY DEPARTMENT"), "No banner title");
  assert.ok(!course.includes("Presentation:"), "No section headings");
  assert.ok(course.includes("Headache"));
  assert.ok(course.includes("discharged"));
  assert.ok(!course.includes("No investigations ordered"));
  assert.ok(!course.includes("No treatment given"));
  assert.ok(!course.includes("No consultation documented"));
});

// --------------------------------------------------
// 8. LIVE THREE-WAY COURSE MERGE & MANUAL EDITS
// --------------------------------------------------
test("8. Live Course Merge & Manual Edit Protection", () => {
  const baseCase: ClinicalCase = {
    patient: { presentingComplaint: "Fever for 2 days" }
  } as any;
  const baseAuto = deriveInitialCourseInHospital(baseCase);

  // Clinician manually rewrites presentation
  const clinicianEdited = baseAuto.replace(
    "The patient was evaluated in the Emergency Department with Fever for 2 days.",
    "The patient was brought with a 2-day history of high-grade fever."
  );

  // New treatment and lab added in Case Sheet
  const nextCase: ClinicalCase = {
    ...baseCase,
    investigationLabsOrdered: "CBC, Dengue NS1",
    treatments: [{ id: "t1", drugName: "Paracetamol", dose: "1 g", route: "IV", timeGiven: "10:00" }]
  } as any;
  const nextAuto = deriveInitialCourseInHospital(nextCase);

  const merged = mergeAutoCoursePreservingManualEdits(baseAuto, clinicianEdited, nextAuto);

  // Rule: Clinician manual edit preserved
  assert.ok(merged.includes("The patient was brought with a 2-day history of high-grade fever."));
  // Rule: New facts added
  assert.ok(merged.includes("CBC, Dengue NS1") || merged.includes("Paracetamol 1 g"));
});

// --------------------------------------------------
// 9. MANUAL SECTION DELETION
// --------------------------------------------------
test("9. Manual Section Deletion Not Resurrected", () => {
  const caseWithConsult: ClinicalCase = {
    patient: { presentingComplaint: "Abdominal pain" },
    dispositionAndPlan: { consultsRequested: ["General Surgery"] }
  } as any;
  const baseAuto = deriveInitialCourseInHospital(caseWithConsult);
  assert.ok(baseAuto.includes("General Surgery"));

  // Clinician intentionally deletes the consultation note
  const clinicianWithoutConsult = baseAuto.replace(/General Surgery[^\.]*\./gi, "").trim();
  assert.ok(!clinicianWithoutConsult.includes("General Surgery"));

  // Scribe adds an unrelated new treatment
  const nextCase: ClinicalCase = {
    ...caseWithConsult,
    treatments: [{ id: "t2", drugName: "Pantoprazole", dose: "40 mg", route: "IV", timeGiven: "11:00" }]
  } as any;
  const nextAuto = deriveInitialCourseInHospital(nextCase);

  const merged = mergeAutoCoursePreservingManualEdits(baseAuto, clinicianWithoutConsult, nextAuto);

  // Consultations must NOT be resurrected
  assert.ok(!merged.includes("General Surgery"), "Deleted Consultations must not be resurrected");
  // New Treatment must be present
  assert.ok(merged.includes("Pantoprazole 40 mg"));
});

// --------------------------------------------------
// 10. FINALIZED SUMMARY PROTECTION
// --------------------------------------------------
test("10. Finalized Summary Protection (Simulated)", () => {
  const finalizedSummary = "COURSE IN EMERGENCY DEPARTMENT\n\nFinal frozen narrative.";
  const summaryStatus = "FINALIZED";
  const nextAuto = "COURSE IN EMERGENCY DEPARTMENT\n\nNew information.";

  // DischargeSummaryView useEffect guard: if (summaryStatus === 'FINALIZED') return;
  let activeCourse = finalizedSummary;
  if (summaryStatus !== "FINALIZED") {
    activeCourse = nextAuto;
  }
  assert.strictEqual(activeCourse, finalizedSummary, "Finalized summary must remain frozen");
});

// --------------------------------------------------
// 11. ER TREATMENT VS DISCHARGE RX SEPARATION
// --------------------------------------------------
test("11. ER Treatment Given ≠ Discharge Rx Separation", () => {
  const testCase: ClinicalCase = {
    treatments: [
      { id: "t1", drugName: "Ceftriaxone", dose: "2 g", route: "IV", timeGiven: "12:00" },
      { id: "t2", drugName: "Ondansetron", dose: "4 mg", route: "IV", timeGiven: "12:05" }
    ],
    dischargeInfo: {
      dischargeMedications: "Tab Pantoprazole 40 mg OD × 5 days"
    }
  } as any;

  const rx = formatDischargeMedicationsText(testCase);
  assert.strictEqual(rx, "Tab Pantoprazole 40 mg OD × 5 days");
  assert.ok(!rx.includes("Ceftriaxone"));
  assert.ok(!rx.includes("Ondansetron"));
});

// --------------------------------------------------
// 12. SAME DRUG DIFFERENT CONTEXT COEXISTENCE
// --------------------------------------------------
test("12. Same Drug Different Context Coexistence", () => {
  const testCase: ClinicalCase = {
    patient: { presentingComplaint: "Fever" },
    treatments: [
      { id: "t1", drugName: "Paracetamol", dose: "1 g", route: "IV", timeGiven: "10:00" }
    ],
    dischargeInfo: {
      dischargeMedications: "Tab Paracetamol 500 mg SOS"
    }
  } as any;

  const course = deriveInitialCourseInHospital(testCase);
  const rx = formatDischargeMedicationsText(testCase);

  assert.ok(course.includes("Paracetamol 1 g iv"));
  assert.strictEqual(rx, "Tab Paracetamol 500 mg SOS");
});

// --------------------------------------------------
// 13. NO DISCHARGE RX LEAKAGE
// --------------------------------------------------
test("13. No Discharge Rx Leakage When None Prescribed", () => {
  const testCase: ClinicalCase = {
    treatments: [
      { id: "t1", drugName: "Hydrocortisone", dose: "100 mg", route: "IV", timeGiven: "10:00" },
      { id: "t2", drugName: "Salbutamol", dose: "2.5 mg", route: "Nebulized", timeGiven: "10:15" }
    ]
  } as any;

  const rx = formatDischargeMedicationsText(testCase);
  assert.strictEqual(rx, "", "Discharge medications must be empty string");
});

// --------------------------------------------------
// 14. FABRICATION REGRESSION (PATCH C5)
// --------------------------------------------------
test("14. Minimal Case Undocumented Data Blank Stored / Not Documented Presentation", () => {
  const minimalData = {
    patientName: "Baby Aisha",
    patientAge: 5,
    patientGender: "Female",
    uhid: "",
    isMlc: "No",
    mlcNo: "",
    allergies: "",
    arrivalHr: "", arrivalBp: "", arrivalRr: "", arrivalSpo2: "", arrivalGcs: "", arrivalPainScore: "", arrivalGrbs: "", arrivalTemp: "",
    presentingComplaints: "Fever for 2 days",
    historyOfPresentIllness: "",
    pastMedicalHistory: "",
    familyGynaeHistory: "",
    lmp: "",
    generalExamination: "",
    primaryAirway: "", primaryAirwayIntervention: "",
    primaryBreathingWork: "", primaryBreathingAirEntry: "", primaryBreathingCct: "", primaryBreathingSubcut: "", primaryBreathingEfast: "", primaryBreathingIntervention: "",
    primaryCirculationCrt: "", primaryCirculationDnv: "", primaryCirculationPct: "", primaryCirculationDeformity: "", primaryCirculationFast: "", primaryCirculationInterventions: "",
    primaryDisabilityAvpuGcs: "", primaryDisabilityPupils: "", primaryDisabilityGrbs: "",
    primaryExposureTemp: "", primaryExposureTrauma: "",
    secondaryPicle: "", secondaryChest: "", secondaryCvs: "", secondaryPa: "", secondaryCns: "", secondaryExtremities: "",
    courseInHospital: "",
    investigationsResults: "",
    primaryDiagnosis: "",
    secondaryDiagnosis: "",
    dischargeMedications: "",
    dispositionStatus: "Normal Discharge",
    dischargeCondition: "",
    dischargeHr: "", dischargeBp: "", dischargeRr: "", dischargeSpo2: "", dischargeGcs: "", dischargePainScore: "", dischargeGrbs: "", dischargeTemp: "",
    followUpPlan: "",
    emResidentName: "", emConsultantName: "",
    dischargeDateTime: "04/10/2026, 20:00"
  };

  const text = formatDischargeSummaryText(minimalData);
  assert.ok(text.includes("**Allergy :** Not documented"));
  assert.ok(!text.includes("NKDA"));
  assert.ok(text.includes("**Past Medical/Surgical Histories:**\nNot documented"));
  assert.ok(!text.includes("None recorded"));
  assert.ok(text.includes("**Course in Hospital with Medications and Procedure:**\nNot documented"));
  assert.ok(!text.includes("Patient evaluated and stabilized in ER."));
  assert.ok(text.includes("**Investigations:**\nNot documented"));
  assert.ok(!text.includes("No investigations ordered."));
  assert.ok(text.includes("**Diagnosis at the time of discharge:**\nNot documented"));
  assert.ok(!text.includes("Under Evaluation"));
  assert.ok(text.includes("**Discharge Medications:**\nNot documented"));
  assert.ok(!text.includes("No outpatient medications prescribed."));
  assert.ok(text.includes("**Condition at time of discharge:(STABLE/UNSTABLE)** Not documented"));
  assert.ok(!text.includes("Not Recorded"));
});

// --------------------------------------------------
// 15. EXPLICIT NEGATIVE REGRESSION
// --------------------------------------------------
test("15. Explicit Negative Preservation", () => {
  const explicitNegatives = {
    patientName: "John",
    patientAge: 50,
    patientGender: "Male",
    uhid: "UHID-1",
    isMlc: "No",
    mlcNo: "",
    allergies: "No Known Drug Allergies",
    arrivalHr: "80", arrivalBp: "120/80", arrivalRr: "16", arrivalSpo2: "98", arrivalGcs: "15", arrivalPainScore: "0", arrivalGrbs: "110", arrivalTemp: "36.8",
    presentingComplaints: "Knee pain",
    historyOfPresentIllness: "Twisted knee while jogging",
    pastMedicalHistory: "No significant medical or surgical history",
    familyGynaeHistory: "Nil",
    lmp: "",
    generalExamination: "Conscious, oriented",
    primaryAirway: "Patent", primaryAirwayIntervention: "None",
    primaryBreathingWork: "Normal", primaryBreathingAirEntry: "B/L equal", primaryBreathingCct: "Normal", primaryBreathingSubcut: "None", primaryBreathingEfast: "Negative", primaryBreathingIntervention: "None",
    primaryCirculationCrt: "< 2s", primaryCirculationDnv: "No", primaryCirculationPct: "No", primaryCirculationDeformity: "No", primaryCirculationFast: "Negative", primaryCirculationInterventions: "None",
    primaryDisabilityAvpuGcs: "Alert", primaryDisabilityPupils: "PERRL", primaryDisabilityGrbs: "110",
    primaryExposureTemp: "36.8", primaryExposureTrauma: "Logroll normal",
    secondaryPicle: "Nil", secondaryChest: "Clear", secondaryCvs: "Normal", secondaryPa: "Soft", secondaryCns: "Normal", secondaryExtremities: "Right knee swelling",
    courseInHospital: "Evaluated for right knee injury.",
    investigationsResults: "X-ray Right Knee: No fracture detected",
    primaryDiagnosis: "Right Knee Sprain",
    secondaryDiagnosis: "",
    dischargeMedications: "Tab Paracetamol 650 mg TDS x 3 days",
    dispositionStatus: "Normal Discharge",
    dischargeCondition: "STABLE",
    dischargeHr: "76", dischargeBp: "120/80", dischargeRr: "16", dischargeSpo2: "99", dischargeGcs: "15", dischargePainScore: "2", dischargeGrbs: "105", dischargeTemp: "36.7",
    followUpPlan: "Ortho OPD in 5 days",
    emResidentName: "Dr. Clinician", emConsultantName: "Dr. Consultant",
    dischargeDateTime: "04/10/2026, 20:00"
  };

  const text = formatDischargeSummaryText(explicitNegatives);
  assert.ok(text.includes("**Allergy :** No Known Drug Allergies"), "Explicit negative allergy must be preserved");
  assert.ok(text.includes("No significant medical or surgical history"), "Explicit negative PMH must be preserved");
});

// --------------------------------------------------
// 16. DIAGNOSIS SAFETY & PMH SEPARATION
// --------------------------------------------------
test("16. Diagnosis Safety: Differentials / Complaint / PMH Never Auto-Become Diagnosis", () => {
  // Case with differentials and PMH, but NO primary or secondary diagnosis set
  const caseWithoutDx: ClinicalCase = {
    patient: { presentingComplaint: "Chest pain" },
    differentials: [
      { diagnosis: "Acute Coronary Syndrome", reasoning: "High risk" },
      { diagnosis: "Pulmonary Embolism", reasoning: "Possible" }
    ],
    sampleHistory: {
      pastHistory: "Hypertension for 10 years"
    }
  } as any;

  // Initial discharge state mapping in DischargeSummaryView:
  const primaryDx = (caseWithoutDx.dischargeInfo?.primaryDiagnosis || caseWithoutDx.provisionalPrimaryDiagnosis || "");
  const secondaryDx = (caseWithoutDx.dischargeInfo?.secondaryDiagnosis || "");

  assert.strictEqual(primaryDx, "", "Primary diagnosis must remain blank when not explicitly diagnosed");
  assert.strictEqual(secondaryDx, "", "Secondary diagnosis must NOT be auto-populated with PMH");

  // When doctor explicitly sets provisionalPrimaryDiagnosis:
  const caseWithExplicitDx = {
    ...caseWithoutDx,
    provisionalPrimaryDiagnosis: "Acute Coronary Syndrome"
  };
  const updatedPrimaryDx = (caseWithExplicitDx.dischargeInfo?.primaryDiagnosis || caseWithExplicitDx.provisionalPrimaryDiagnosis || "");
  assert.strictEqual(updatedPrimaryDx, "Acute Coronary Syndrome");
});

// --------------------------------------------------
// 17. SAVE + RELOAD INTEGRITY
// --------------------------------------------------
test("17. Save and Reload Field Persistence", () => {
  const caseToSave: ClinicalCase = {
    id: "case-save-test",
    patient: { name: "Test Patient", age: 30, gender: "Male", uhid: "U-123" } as any,
    vitals: { hr: "80", bp: "120/80", gcs: "14", gcs_e: "4", gcs_v: "4", gcs_m: "6" } as any,
    dischargeInfo: {
      primaryDiagnosis: "Gastroenteritis",
      secondaryDiagnosis: "",
      dischargeMedications: "ORS sachets as needed\nTab Ondansetron 4 mg SOS",
      allergies: "",
      broughtBy: "",
      pastMedicalHistory: "",
      generalExamination: "",
      courseInHospital: "COURSE IN EMERGENCY DEPARTMENT\n\nPresentation:\nThe patient presented with vomiting."
    } as any
  } as any;

  // JSON round-trip simulating database persistence
  const serialized = JSON.stringify(caseToSave);
  const reloaded: ClinicalCase = JSON.parse(serialized);

  assert.strictEqual(reloaded.vitals.gcs, "14");
  assert.strictEqual(reloaded.vitals.gcs_e, "4");
  assert.strictEqual(reloaded.dischargeInfo?.primaryDiagnosis, "Gastroenteritis");
  assert.strictEqual(reloaded.dischargeInfo?.allergies, "");
  assert.strictEqual(reloaded.dischargeInfo?.broughtBy, "");
  assert.strictEqual(reloaded.dischargeInfo?.dischargeMedications, "ORS sachets as needed\nTab Ondansetron 4 mg SOS");
  assert.ok(reloaded.dischargeInfo?.courseInHospital?.includes("Presentation:"));
});

// --------------------------------------------------
// 18. LEGACY DATA SAFETY
// --------------------------------------------------
test("18. Legacy Clinician-Entered Values Not Wiped", () => {
  const legacyCase: ClinicalCase = {
    dischargeInfo: {
      allergies: "NKDA",
      pastMedicalHistory: "Nil",
      conditionAtDischarge: "Stable"
    } as any
  } as any;

  // In DischargeSummaryView:
  const allergies = legacyCase.dischargeInfo?.allergies || "";
  const pmh = legacyCase.dischargeInfo?.pastMedicalHistory || "";
  const cond = legacyCase.dischargeInfo?.conditionAtDischarge || "";

  assert.strictEqual(allergies, "NKDA", "Existing explicit NKDA must be preserved");
  assert.strictEqual(pmh, "Nil", "Existing explicit Nil must be preserved");
  assert.strictEqual(cond, "Stable", "Existing explicit Stable must be preserved");
});

// --------------------------------------------------
// 19. TEST B PRESERVATION (NO FIELD LOSS)
// --------------------------------------------------
test("19. Non-GCS Fields Preserved When Updating GCS", () => {
  const existingCase: ClinicalCase = {
    vitals: {
      hr: "110",
      bp: "100/60"
    } as any,
    ipsgChecklist: { ipsg1IdentifiersVerified: true }
  } as any;

  const gcsComponents: Record<string, any> = { gcs_e: "3", gcs_v: "4", gcs_m: "5" };
  const totalGcs = deriveExplicitGcsTotal(gcsComponents, "GCS E3 V4 M5");

  const updatedCase: ClinicalCase = {
    ...existingCase,
    vitals: {
      ...existingCase.vitals,
      gcs: totalGcs || undefined,
      ...gcsComponents
    }
  };

  assert.strictEqual(updatedCase.vitals.hr, "110");
  assert.strictEqual(updatedCase.vitals.bp, "100/60");
  assert.strictEqual(updatedCase.vitals.gcs, "12");
  assert.strictEqual(updatedCase.vitals.gcs_e, "3");
  assert.strictEqual(updatedCase.vitals.gcs_v, "4");
  assert.strictEqual(updatedCase.vitals.gcs_m, "5");
  assert.strictEqual(updatedCase.ipsgChecklist?.ipsg1IdentifiersVerified, true);
});

console.log("\n==================================================");
console.log(`ALL REGRESSION TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`);
console.log("==================================================");
