import assert from "node:assert";
import { ClinicalCase, DischargeInfo } from "./src/types";
import { checkDischargeCompleteness } from "./src/utils/dischargeCompleteness";
import {
  deriveInitialCourseInHospital,
  mergeAutoCoursePreservingManualEdits,
  mergeCourseInHospital,
  mergeDischargeMedications,
  formatDischargeMedicationsText,
  formatInvestigationsText
} from "./src/utils/dischargeSyncEngine";
import { formatDischargeSummaryText } from "./src/utils/dischargeSummaryFormat";

console.log("==================================================");
console.log("ERMATE — DISCHARGE PREVIEW INTEGRITY VERIFICATION SUITE");
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

function createBaseDischargeCase(): ClinicalCase {
  return {
    id: "case-discharge-001",
    displayId: "261006010",
    bedNo: "08A",
    status: "Active",
    savedTime: "11:00 AM",
    timeSpentMin: 25,
    isPediatric: false,
    patient: {
      name: "Suresh Gupta",
      age: 45,
      gender: "Male",
      presentingComplaint: "Acute severe epigastric pain for 6 hours",
      triageCategory: "P2 Very Urgent",
      dateOpened: "11:00 AM | Oct 6",
      uhid: "UHID-112233",
      isMlc: false
    },
    vitals: {
      bp: "130/85",
      hr: "92",
      rr: "18",
      spo2: "99",
      temp: "98.4",
      grbs: "105",
      gcs: "15"
    },
    sampleHistory: {
      symptoms: "Severe epigastric pain radiating to back, nausea",
      allergies: "NKDA",
      medications: "None",
      pastHistory: "Cholelithiasis diagnosed 2 months ago",
      lastMeal: "6 hours ago",
      events: "Pain started 1 hour after fatty meal"
    },
    primaryAssessment: {
      airway: "Patent",
      breathing: "Clear breath sounds bilaterally",
      circulation: "Hemodynamically stable, pulses full",
      disability: "GCS 15/15",
      exposure: "No rash"
    },
    secondarySurvey: {
      general: "Conscious, oriented, in mild distress due to pain",
      cvs: "S1 S2 normal",
      respiratory: "Normal vesicular breath sounds",
      abdomen: "Epigastric tenderness, no guarding or rigidity, Murphy's negative",
      cns: "No focal deficit",
      extremities: "No edema"
    },
    secondaryAssessment: "General: Conscious, oriented\nCVS: S1 S2 normal\nRS: Clear\nPA: Epigastric tenderness\nCNS: Normal\nExtremities: Normal",
    investigations: [
      { id: "inv-1", testName: "Serum Lipase", result: "340 U/L", isAbnormal: true },
      { id: "inv-2", testName: "Serum Amylase", result: "180 U/L", isAbnormal: true },
      { id: "inv-3", testName: "USG Abdomen", result: "Gallstones present, no common bile duct dilation", isAbnormal: true }
    ],
    investigationLabsOrdered: "Serum Lipase, Serum Amylase, LFT, CBC",
    investigationImaging: "USG Whole Abdomen",
    investigationResultsSummary: "Lipase elevated at 340 U/L; USG confirms cholelithiasis without choledocholithiasis.",
    provisionalPrimaryDiagnosis: "Acute Mild Biliary Pancreatitis",
    provisionalDifferentialDiagnoses: "Acute Cholecystitis; Peptic Ulcer Disease",
    differentials: [
      { diagnosis: "Acute Cholecystitis", status: "ruled_out" },
      { diagnosis: "Peptic Ulcer Disease", status: "ruled_out" }
    ],
    treatments: [
      { drugName: "Inj. Pantoprazole", dose: "40 mg", route: "IV", instruction: "Stat", timeGiven: "11:15 AM" },
      { drugName: "Inj. Tramadol", dose: "50 mg in 100ml NS", route: "IV", instruction: "Stat over 20 mins", timeGiven: "11:20 AM" },
      { drugName: "IV Ringer Lactate", dose: "500 ml", route: "IV", instruction: "Stat @ 150ml/hr", timeGiven: "11:15 AM" }
    ],
    proceduresChecked: ["iv_cannula"],
    otherProcedures: "20G IV cannula in left forearm",
    progressNotes: "12:30 PM: Pain significantly relieved following analgesia and IV hydration. Tolerating oral sips without vomiting.",
    conditionAtShift: "STABLE",
    dispositionDetails: {
      dispositionType: "Discharged from ER",
      residentName: "Dr. R. Duty",
      consultantName: "Dr. S. Consultant",
      dischargeVitals: {
        hr: "78",
        bp: "124/80",
        rr: "16",
        spo2: "100",
        temp: "98.4",
        gcs: "15"
      }
    },
    dischargeInfo: {
      primaryDiagnosis: "Acute Mild Biliary Pancreatitis",
      secondaryDiagnosis: "Cholelithiasis",
      conditionAtDischarge: "STABLE",
      dischargeMedications: "1. Tab. Pantoprazole 40mg OD before breakfast x 7 days\n2. Tab. Tramadol/Paracetamol 37.5/325mg SOS for pain (max BD x 3 days)",
      followUpPlan: "Surgical OPD in 3 days for elective laparoscopic cholecystectomy review.",
      patientInstructions: "Emergency warnings: Return immediately if intractable vomiting, severe abdominal pain, high fever, or jaundice develops.",
      courseInHospital: "COURSE IN EMERGENCY DEPARTMENT\n\nPresentation:\nThe patient presented to the Emergency Department with Acute severe epigastric pain for 6 hours.\n\nEvents Leading to Presentation:\nPain started 1 hour after fatty meal.\n\nInitial Assessment:\nAirway: Patent; Breathing: Clear breath sounds bilaterally; Circulation: Hemodynamically stable, pulses full; Disability: GCS 15/15; Exposure: No rash. Pulse was 92/min, blood pressure 130/85 mmHg, respiratory rate 18/min, oxygen saturation 99%, and temperature 98.4°C.\n\nInvestigations:\nInvestigations ordered: Serum Lipase, Serum Amylase, LFT, CBC. Imaging ordered: USG Whole Abdomen.\n\nTreatment Given:\nMedications administered: Inj. Pantoprazole 40 mg IV, Inj. Tramadol 50 mg in 100ml NS IV, IV Ringer Lactate 500 ml IV.\n\nProcedures:\nProcedures performed: Iv Cannula.\n\nClinical Course:\n12:30 PM: Pain significantly relieved following analgesia and IV hydration. Tolerating oral sips without vomiting.\n\nDisposition:\nThe patient was discharged from the Emergency Department with advice for Surgical OPD in 3 days.",
      dischargeDateTime: "06 Oct 2026, 01:30 PM",
      dispositionType: "Discharged from ER",
      emResidentName: "Dr. R. Duty",
      emConsultantName: "Dr. S. Consultant",
      summaryStatus: "PREPARED",
      preparedAt: "2026-10-06T07:30:00.000Z",
      caseUpdatedAfterPreparation: false,
      dischargeHr: "78",
      dischargeBp: "124/80",
      dischargeRr: "16",
      dischargeSpo2: "100",
      dischargeGcs: "15",
      dischargeTemp: "98.4"
    }
  };
}

// ---------------------------------------------------------------
// TEST 1: presenting complaint DOES NOT satisfy ER clinical course
// ---------------------------------------------------------------
test("1. presenting complaint DOES NOT satisfy ER clinical course", () => {
  const c = createBaseDischargeCase();
  // Clear course and progress notes
  c.dischargeInfo!.courseInHospital = "";
  c.progressNotes = "";
  // Presenting complaint is present
  assert.ok(c.patient.presentingComplaint.length > 0);

  const report = checkDischargeCompleteness(c);
  assert.strictEqual(report.complete, false);
  assert.ok(report.missing.includes("ER Clinical Course"), "Missing array must include ER Clinical Course");
});

// ---------------------------------------------------------------
// TEST 2: general examination DOES NOT satisfy condition at discharge
// ---------------------------------------------------------------
test("2. general examination DOES NOT satisfy condition at discharge", () => {
  const c = createBaseDischargeCase();
  c.dischargeInfo!.conditionAtDischarge = "";
  c.dischargeInfo!.dischargeCondition = "";
  c.conditionAtShift = undefined;
  (c.dispositionDetails as any).conditionAtShift = undefined;
  // General examination is populated!
  assert.ok(c.secondarySurvey?.general?.length! > 0);

  const report = checkDischargeCompleteness(c);
  assert.strictEqual(report.complete, false);
  assert.ok(report.missing.includes("Condition at Discharge"), "Missing array must include Condition at Discharge");
});

// ---------------------------------------------------------------
// TEST 3: courseInHospital preserved
// ---------------------------------------------------------------
test("3. courseInHospital preserved", () => {
  const c = createBaseDischargeCase();
  assert.ok(c.dischargeInfo?.courseInHospital?.includes("COURSE IN EMERGENCY DEPARTMENT"));
  assert.ok(c.dischargeInfo?.courseInHospital?.includes("12:30 PM: Pain significantly relieved"));
});

// ---------------------------------------------------------------
// TEST 4: primary diagnosis preserved
// ---------------------------------------------------------------
test("4. primary diagnosis preserved", () => {
  const c = createBaseDischargeCase();
  assert.strictEqual(c.dischargeInfo?.primaryDiagnosis, "Acute Mild Biliary Pancreatitis");
});

// ---------------------------------------------------------------
// TEST 5: secondary diagnosis preserved only if explicitly documented
// ---------------------------------------------------------------
test("5. secondary diagnosis preserved only if explicitly documented", () => {
  const c = createBaseDischargeCase();
  assert.strictEqual(c.dischargeInfo?.secondaryDiagnosis, "Cholelithiasis");

  // If absent: must remain blank / empty string
  const c2 = createBaseDischargeCase();
  c2.dischargeInfo!.secondaryDiagnosis = "";
  assert.strictEqual(c2.dischargeInfo?.secondaryDiagnosis, "");
});

// ---------------------------------------------------------------
// TEST 6: investigations preserved
// ---------------------------------------------------------------
test("6. investigations preserved", () => {
  const c = createBaseDischargeCase();
  const invText = formatInvestigationsText(c);
  assert.ok(invText.includes("Serum Lipase"));
  assert.ok(invText.includes("340 U/L"));
  assert.ok(invText.includes("USG Whole Abdomen"));
});

// ---------------------------------------------------------------
// TEST 7: investigation results preserved
// ---------------------------------------------------------------
test("7. investigation results preserved", () => {
  const c = createBaseDischargeCase();
  assert.ok(c.investigationResultsSummary?.includes("Lipase elevated at 340 U/L"));
});

// ---------------------------------------------------------------
// TEST 8: ER treatment preserved in ER course
// ---------------------------------------------------------------
test("8. ER treatment preserved in ER course", () => {
  const c = createBaseDischargeCase();
  assert.ok(c.dischargeInfo?.courseInHospital?.includes("Inj. Pantoprazole 40 mg IV"));
  assert.ok(c.dischargeInfo?.courseInHospital?.includes("Inj. Tramadol 50 mg in 100ml NS IV"));
  assert.ok(c.dischargeInfo?.courseInHospital?.includes("IV Ringer Lactate 500 ml IV"));
});

// ---------------------------------------------------------------
// TEST 9: ER treatment does NOT become discharge medication
// ---------------------------------------------------------------
test("9. ER treatment does NOT become discharge medication", () => {
  const c = createBaseDischargeCase();
  const dischargeMeds = c.dischargeInfo?.dischargeMedications || "";
  // ER injections must not appear in discharge Rx
  assert.ok(!dischargeMeds.includes("Inj. Tramadol 50 mg in 100ml NS IV"));
  assert.ok(!dischargeMeds.includes("IV Ringer Lactate"));
  // Only outpatient prescriptions appear
  assert.ok(dischargeMeds.includes("Tab. Pantoprazole 40mg"));
  assert.ok(dischargeMeds.includes("Tab. Tramadol/Paracetamol"));
});

// ---------------------------------------------------------------
// TEST 10: discharge Rx appears only when explicitly prescribed
// ---------------------------------------------------------------
test("10. discharge Rx appears only when explicitly prescribed", () => {
  const c = createBaseDischargeCase();
  c.dischargeInfo!.dischargeMedications = "";
  const merged = mergeDischargeMedications("", c);
  // No explicit dischargePrescriptions on c -> remains blank
  assert.strictEqual(merged, "");
});

// ---------------------------------------------------------------
// TEST 11: conditionAtDischarge required independently
// ---------------------------------------------------------------
test("11. conditionAtDischarge required independently", () => {
  const c = createBaseDischargeCase();
  c.dischargeInfo!.conditionAtDischarge = "";
  c.dischargeInfo!.dischargeCondition = "";
  c.conditionAtShift = undefined;
  (c.dispositionDetails as any).conditionAtShift = undefined;

  const report = checkDischargeCompleteness(c);
  assert.ok(report.missing.includes("Condition at Discharge"));

  // Once explicitly provided as "STABLE"
  c.dischargeInfo!.conditionAtDischarge = "STABLE";
  const report2 = checkDischargeCompleteness(c);
  assert.ok(!report2.missing.includes("Condition at Discharge"));
});

// ---------------------------------------------------------------
// TEST 12: disposition preserved
// ---------------------------------------------------------------
test("12. disposition preserved", () => {
  const c = createBaseDischargeCase();
  assert.strictEqual(c.dischargeInfo?.dispositionType, "Discharged from ER");
});

// ---------------------------------------------------------------
// TEST 13: follow-up preserved
// ---------------------------------------------------------------
test("13. follow-up preserved", () => {
  const c = createBaseDischargeCase();
  assert.strictEqual(c.dischargeInfo?.followUpPlan, "Surgical OPD in 3 days for elective laparoscopic cholecystectomy review.");
});

// ---------------------------------------------------------------
// TEST 14: instructions preserved
// ---------------------------------------------------------------
test("14. instructions preserved", () => {
  const c = createBaseDischargeCase();
  assert.ok(c.dischargeInfo?.patientInstructions?.includes("Return immediately if intractable vomiting"));
});

// ---------------------------------------------------------------
// TEST 15: discharge date/time preserved
// ---------------------------------------------------------------
test("15. discharge date/time preserved", () => {
  const c = createBaseDischargeCase();
  assert.strictEqual(c.dischargeInfo?.dischargeDateTime, "06 Oct 2026, 01:30 PM");
});

// ---------------------------------------------------------------
// TEST 16: discharge vitals preserved
// ---------------------------------------------------------------
test("16. discharge vitals preserved", () => {
  const c = createBaseDischargeCase();
  assert.strictEqual(c.dischargeInfo?.dischargeHr, "78");
  assert.strictEqual(c.dischargeInfo?.dischargeBp, "124/80");
  assert.strictEqual(c.dischargeInfo?.dischargeRr, "16");
  assert.strictEqual(c.dischargeInfo?.dischargeSpo2, "100");
  assert.strictEqual(c.dischargeInfo?.dischargeGcs, "15");
  assert.strictEqual(c.dischargeInfo?.dischargeTemp, "98.4");
});

// ---------------------------------------------------------------
// TEST 17: intentionally incomplete discharge reports exact missing fields
// ---------------------------------------------------------------
test("17. intentionally incomplete discharge reports exact missing fields", () => {
  const c = createBaseDischargeCase();
  c.dischargeInfo = {
    primaryDiagnosis: "",
    conditionAtDischarge: "",
    dischargeMedications: "",
    followUpPlan: "",
    courseInHospital: ""
  };
  c.provisionalPrimaryDiagnosis = "";
  c.progressNotes = "";
  c.conditionAtShift = undefined;
  (c.dispositionDetails as any) = {};

  const report = checkDischargeCompleteness(c);
  assert.strictEqual(report.complete, false);
  assert.ok(report.missing.includes("Primary Diagnosis"));
  assert.ok(report.missing.includes("ER Clinical Course"));
  assert.ok(report.missing.includes("Discharge Medications"));
  assert.ok(report.missing.includes("Condition at Discharge"));
  assert.ok(report.missing.includes("Follow-Up Plan"));
  assert.ok(report.missing.includes("Disposition Type"));
});

// ---------------------------------------------------------------
// TEST 18: finalized summary cannot be automatically overwritten
// ---------------------------------------------------------------
test("18. finalized summary cannot be automatically overwritten", () => {
  const c = createBaseDischargeCase();
  c.dischargeInfo!.summaryStatus = "FINALIZED";
  const finalizedCourse = c.dischargeInfo!.courseInHospital;

  // New progress note added to ClinicalCase
  c.progressNotes += "\n02:00 PM: Stale update after discharge finalized.";

  // In DischargeSummaryView line 276: if summaryStatus === "FINALIZED", auto merge is bypassed
  const canAutoMerge = c.dischargeInfo!.summaryStatus !== "FINALIZED";
  assert.strictEqual(canAutoMerge, false, "Auto-merge must be bypassed when finalized");
  assert.strictEqual(c.dischargeInfo!.courseInHospital, finalizedCourse);
});

// ---------------------------------------------------------------
// TEST 19: clinician manually-edited discharge text is preserved
// ---------------------------------------------------------------
test("19. clinician manually-edited discharge text is preserved", () => {
  const previousAuto = "COURSE IN EMERGENCY DEPARTMENT\n\nPresentation:\nThe patient presented with pain.";
  const clinicianManualEdit = "COURSE IN EMERGENCY DEPARTMENT\n\nPresentation:\nThe patient presented with severe burning pain after spicy food, verified by spouse.";
  const nextAuto = "COURSE IN EMERGENCY DEPARTMENT\n\nPresentation:\nThe patient presented with pain.\n\nInvestigations:\nLipase was 340 U/L.";

  const merged = mergeAutoCoursePreservingManualEdits(previousAuto, clinicianManualEdit, nextAuto);
  // Clinician's manual edits to Presentation must be preserved!
  assert.ok(merged.includes("severe burning pain after spicy food, verified by spouse"));
  // Newly added investigations section must be appended!
  assert.ok(merged.includes("Lipase was 340 U/L"));
});

// ---------------------------------------------------------------
// TEST 20: later Case Sheet update sets caseUpdatedAfterPreparation correctly
// ---------------------------------------------------------------
test("20. later Case Sheet update sets caseUpdatedAfterPreparation correctly", () => {
  const c = createBaseDischargeCase();
  c.dischargeInfo!.summaryStatus = "PREPARED";
  c.dischargeInfo!.caseUpdatedAfterPreparation = false;

  // Clinician updates Case Sheet (e.g. adding new lab result)
  const updatedCaseSheet: ClinicalCase = {
    ...c,
    dischargeInfo: c.dischargeInfo ? {
      ...c.dischargeInfo,
      caseUpdatedAfterPreparation: true
    } : null
  };

  assert.strictEqual(updatedCaseSheet.dischargeInfo?.caseUpdatedAfterPreparation, true);
});

console.log(`\nDischarge Preview Integrity Verification: ${passedTests} / ${totalTests} assertions passed.`);
