import assert from "node:assert";
import { readFileSync } from "fs";
import { ClinicalCase } from "./src/types";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import { formatCaseSheetText } from "./src/utils/caseSheetFormat";
import { formatDischargeSummaryText, DischargeSummaryData } from "./src/utils/dischargeSummaryFormat";

console.log("==================================================");
console.log("ERMATE — UNIVERSAL DOCUMENTS & COPY-FIRST VERIFICATION");
console.log("==================================================");

let total = 0;
let passed = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${total}. ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${total}. ${name}:`, err.message);
    throw err;
  }
}

// -------------------------------------------------------------
// Test Case Builders
// -------------------------------------------------------------
function buildAdultTestClinicalCase(): ClinicalCase {
  return {
    id: "case-adult-001",
    displayId: "261011001",
    bedNo: "05A",
    status: "Active",
    savedTime: "09:30 AM",
    timeSpentMin: 15,
    isPediatric: false,
    patient: {
      name: "Rajesh Kumar",
      age: 48,
      gender: "Male",
      presentingComplaint: "Acute retrosternal chest pain radiating to left arm",
      triageCategory: "P1 Immediate",
      dateOpened: "09:30 AM | Oct 11",
      uhid: "UHID-556677",
      isMlc: false,
    },
    vitals: {
      bp: "150/94",
      hr: "102",
      rr: "22",
      spo2: "96",
      temp: "98.4",
      grbs: "142",
      gcs: "15",
    },
    primaryAssessment: {
      airway: "Patent, speaking in full sentences",
      breathing: "Equal bilateral air entry, vesicular breath sounds, no wheeze",
      circulation: "Radial pulse strong, CRT < 2s, warm peripheries",
      disability: "Alert and oriented to time, place, and person (GCS 15)",
      exposure: "Normothermic, no skin rash or trauma marks",
    },
    sampleHistory: {
      symptoms: "Retrosternal chest pressure with diaphoresis",
      allergies: "Penicillin (causes urticaria)",
      medications: "Tab Amlodipine 5mg OD, Tab Metformin 500mg BD",
      pastHistory: "Hypertension for 5 years, Type 2 DM for 3 years",
      lastMeal: "Light breakfast 2 hours prior to arrival",
      events: "Onset during morning walk, acute worsening over 1 hour",
    },
    secondaryAssessment:
      "General: Conscious, oriented, mild diaphoresis.\n" +
      "CVS: S1 S2 heard, no murmurs.\n" +
      "RS: Bilateral normal vesicular breath sounds, no added sounds.\n" +
      "PA: Soft, non-tender, no organomegaly.\n" +
      "CNS: No focal neurological deficit, pupils 3mm B/L reactive.\n" +
      "Extremities: No edema, distal pulses palpable.",
    provisionalPrimaryDiagnosis: "Acute Coronary Syndrome (Anterior Wall STEMI)",
    differentials: [
      { diagnosis: "Aortic Dissection", status: "RULED OUT" },
      { diagnosis: "Acute Pericarditis", status: "LESS LIKELY" },
    ],
    investigationsOrdered: "ECG, Cardiac Biomarkers (Troponin I), CBC, Serum Creatinine, CXR",
    investigationLabsOrdered: "Troponin I, CBC, BMP",
    investigationResults: [
      { name: "Troponin I", value: 3.4, unit: "ng/mL", status: "CRITICAL" },
      { name: "Creatinine", value: 1.1, unit: "mg/dL", status: "NORMAL" },
    ],
    investigationImaging: "12-Lead ECG: 3mm ST elevation in V1-V4 with reciprocal ST depression in III, aVF",
    treatments: [
      { id: "t1", drugName: "Tab Aspirin", dose: "325 mg", route: "Oral", timeGiven: "09:35", instruction: "Chewed stat" },
      { id: "t2", drugName: "Tab Clopidogrel", dose: "300 mg", route: "Oral", timeGiven: "09:35", instruction: "Loading dose" },
      { id: "t3", drugName: "Tab Atorvastatin", dose: "80 mg", route: "Oral", timeGiven: "09:36", instruction: "Stat" },
      { id: "t4", drugName: "Inj Heparin", dose: "5000 IU", route: "IV", timeGiven: "09:40", instruction: "Bolus" },
    ],
    treatmentNotes: "Patient prepped for urgent primary PCI transfer.",
    proceduresChecked: ["iv_line"],
    procedureNotes: [
      {
        id: "p1",
        procedureName: "Peripheral IV Cannulation",
        metadata: { date: "11/10/2026", time: "09:32" },
        generatedNarrative: "18G IV cannula inserted in left cubital fossa under aseptic conditions. Free flow established.",
      },
    ],
    dispositionAndPlan: {
      dispositionStatus: "Cath Lab Transfer",
      destinationUnit: "Cardiac Cath Lab (Primary PCI)",
      durationInEr: "35 mins",
      conditionAtShift: "Stable, pain decreased to 4/10",
      managementPlan: "Immediate transfer to Cath Lab for primary PCI. Cardiology team alerted.",
      consultsRequested: ["Cardiology (Interventional)"],
      followUpAdvice: "Post-PCI CCU admission.",
    },
    doctorName: "Dr. Ananya Roy",
    consultantName: "Dr. Vikram Seth",
    lastEditedAt: "11/10/2026, 10:05 AM",
  };
}

function buildPediatricTestClinicalCase(): ClinicalCase {
  return {
    id: "case-ped-001",
    displayId: "261011002",
    bedNo: "P-02",
    status: "Active",
    savedTime: "10:15 AM",
    timeSpentMin: 20,
    isPediatric: true,
    patient: {
      name: "Master Kabir",
      age: 4,
      gender: "Male",
      presentingComplaint: "Fever and rapid breathing for 2 days",
      triageCategory: "P2 Very Urgent",
      dateOpened: "10:15 AM | Oct 11",
      uhid: "UHID-998877",
      isMlc: false,
    },
    vitals: {
      bp: "96/60",
      hr: "135",
      rr: "38",
      spo2: "94",
      temp: "102.4",
      grbs: "98",
      gcs: "15",
    },
    pediatricDetails: {
      patientWeight: "16",
      patAppearanceTone: "Moderate muscle tone, clinging to mother",
      patAppearanceInteractivity: "Alert, responds to voice and parents",
      patAppearanceConsolability: "Consolable by mother",
      patAppearanceLookGaze: "Fixes and follows",
      patAppearanceSpeechCry: "Crying with moderate pitch, no stridor",
      patWorkOfBreathing: "Subcostal retractions, mild tachypnea",
      patCirculation: "Peripheries warm, CRT 1.5s, pink mucosal tinge",
      birthHistory: "Full term normal vaginal delivery, birth weight 3.1 kg, cried immediately",
      feedingHistory: "Age-appropriate diet, reduced intake today due to fever",
      developmentalHistory: "Attained all motor and speech milestones appropriately",
      immunizationHistory: "Immunized up to age as per national schedule (including MMR)",
      broughtBy: "Both parents",
      informant: "Mother",
    },
    primaryAssessment: {
      airway: "Clear, no secretions",
      breathing: "Bilateral subcostal retractions, tachypnea (RR 38)",
      circulation: "Heart rate 135 bpm, CRT 1.5s, strong femoral and radial pulses",
      disability: "GCS 15, active, pupils equal and briskly reactive",
      exposure: "Temperature 102.4 F, no purpuric rash",
    },
    sampleHistory: {
      symptoms: "Fever, non-productive cough, decreased oral intake",
      allergies: "Nil known",
      medications: "Syp Paracetamol 250mg given 4 hours prior at home",
      pastHistory: "No prior hospitalizations or wheezing episodes",
      lastMeal: "Sips of oral fluids 1 hour prior",
      events: "Fever started 2 days ago, respiratory rate increased today morning",
    },
    secondaryAssessment:
      "General: Febrile, alert, not toxic.\n" +
      "RS: Bilateral vesicular breath sounds with scattered right lower lobe crackles.\n" +
      "CVS: Normal heart sounds S1 S2, no murmur.\n" +
      "PA: Soft, abdomen non-tender, no organomegaly.\n" +
      "CNS: Awake, no signs of meningism.\n" +
      "Extremities: Warm, capillary refill < 2s.",
    investigationLabsOrdered: "CBC with diff, CRP, Blood Culture",
    investigationImaging: "CXR AP view: Right lower lobe consolidation",
    investigationResults: [
      { name: "WBC", value: 16500, unit: "/cumm", status: "HIGH" },
      { name: "CRP", value: 38, unit: "mg/L", status: "HIGH" },
    ],
    treatments: [
      { id: "pt1", drugName: "Syp Paracetamol", dose: "240 mg", route: "Oral", timeGiven: "10:20", instruction: "Stat for fever" },
      { id: "pt2", drugName: "Inj Ceftriaxone", dose: "1200 mg", route: "IV", timeGiven: "10:40", instruction: "Slow IV infusion over 30 mins" },
    ],
    treatmentNotes: "Humidified nasal oxygen at 2 L/min started; SpO2 improved to 99%.",
    provisionalPrimaryDiagnosis: "Community-Acquired Pneumonia (Right Lower Lobe)",
    differentials: [
      { diagnosis: "Viral Bronchiolitis", status: "LESS LIKELY" },
      { diagnosis: "Foreign Body Aspiration", status: "RULED OUT" },
    ],
    proceduresChecked: ["iv_line", "oxygen_therapy"],
    dispositionAndPlan: {
      dispositionStatus: "Pediatric Ward Admission",
      destinationUnit: "Pediatric Inpatient Unit",
      durationInEr: "1 hour 15 mins",
      conditionAtShift: "Stable, afebrile after paracetamol, SpO2 99% on 2L O2",
      managementPlan: "Admit under Pediatrics. Complete IV antibiotic course, monitor respiratory rate and SpO2.",
      consultsRequested: ["Pediatrician on call"],
      followUpAdvice: "Pediatric ward admission.",
    },
    doctorName: "Dr. Ananya Roy",
    consultantName: "Dr. Vikram Seth",
    lastEditedAt: "11/10/2026, 11:30 AM",
  };
}

// =============================================================
// TESTS
// =============================================================

// 1. Adult Case Sheet Data Conversion
test("1. Adult Case Sheet Data Conversion preserves all core fields", () => {
  const adultCase = buildAdultTestClinicalCase();
  const data = convertClinicalCaseToCaseSheetData(adultCase);
  assert.strictEqual(data.caseId, "261011001");
  assert.strictEqual(data.patient.name, "Rajesh Kumar");
  assert.strictEqual(data.patient.age, 48);
  assert.strictEqual(data.patient.sex, "M");
  assert.strictEqual(data.patient.uhid, "UHID-556677");
  assert.strictEqual(data.patient.bed, "05A");
  assert.strictEqual(data.isPediatric, false);
  assert.strictEqual(data.provisionalDiagnosis, "Acute Coronary Syndrome (Anterior Wall STEMI)");
  assert.strictEqual(data.treatmentGiven.length, 4);
  assert.strictEqual(data.procedures.procedureNotes?.length, 1);
  assert.strictEqual(data.consultation.consultsRequested[0], "Cardiology (Interventional)");
});

// 2. Adult Plain-Text Formatter contains all documented clinical fields
test("2. Adult Plain-Text Formatter produces complete EMR text", () => {
  const adultCase = buildAdultTestClinicalCase();
  const data = convertClinicalCaseToCaseSheetData(adultCase);
  const text = formatCaseSheetText(data);

  assert.ok(text.includes("EMERGENCY DEPARTMENT — CASE SHEET"), "Header must be present");
  assert.ok(text.includes("Rajesh Kumar"), "Patient name present");
  assert.ok(text.includes("48y M"), "Age/Sex present");
  assert.ok(text.includes("UHID: UHID-556677"), "UHID present");
  assert.ok(text.includes("Acute retrosternal chest pain"), "Presenting complaint present");
  assert.ok(text.includes("A — Airway: Patent, speaking in full sentences"), "Primary survey airway present");
  assert.ok(text.includes("Penicillin (causes urticaria)"), "Allergies present");
  assert.ok(text.includes("Tab Amlodipine"), "Medications present");
  assert.ok(text.includes("Hypertension for 5 years"), "Past history present");
  assert.ok(text.includes("Troponin I"), "Labs present");
  assert.ok(text.includes("Tab Aspirin"), "Treatments present");
  assert.ok(text.includes("Peripheral IV Cannulation"), "Procedure notes present");
  assert.ok(text.includes("Cardiology (Interventional)"), "Consults present");
  assert.ok(text.includes("Cath Lab Transfer"), "Disposition status present");
  assert.ok(text.includes("Dr. Ananya Roy"), "Physician name present");
  assert.ok(text.includes("Dr. Vikram Seth"), "Consultant name present");
});

// 3. Pediatric Case Sheet Data Conversion preserves PAT and weight
test("3. Pediatric Case Sheet Data Conversion preserves PAT TICLS and weight", () => {
  const pedCase = buildPediatricTestClinicalCase();
  const data = convertClinicalCaseToCaseSheetData(pedCase);
  assert.strictEqual(data.isPediatric, true);
  assert.strictEqual(data.patient.name, "Master Kabir");
  assert.strictEqual(data.patient.age, 4);
  assert.ok(data.pediatricDetails !== null);
  assert.strictEqual(data.pediatricDetails?.weight, "16");
  assert.strictEqual(data.pediatricDetails?.patAppearanceTone, "Moderate muscle tone, clinging to mother");
  assert.strictEqual(data.pediatricDetails?.patAppearanceInteractivity, "Alert, responds to voice and parents");
  assert.strictEqual(data.pediatricDetails?.patAppearanceConsolability, "Consolable by mother");
  assert.strictEqual(data.pediatricDetails?.patAppearanceLookGaze, "Fixes and follows");
  assert.strictEqual(data.pediatricDetails?.patAppearanceSpeechCry, "Crying with moderate pitch, no stridor");
  assert.strictEqual(data.pediatricDetails?.patWorkOfBreathing, "Subcostal retractions, mild tachypnea");
  assert.strictEqual(data.pediatricDetails?.patCirculation, "Peripheries warm, CRT 1.5s, pink mucosal tinge");
  assert.strictEqual(data.pediatricDetails?.birthHistory, "Full term normal vaginal delivery, birth weight 3.1 kg, cried immediately");
  assert.strictEqual(data.pediatricDetails?.feedingHistory, "Age-appropriate diet, reduced intake today due to fever");
  assert.strictEqual(data.pediatricDetails?.developmentalHistory, "Attained all motor and speech milestones appropriately");
  assert.strictEqual(data.pediatricDetails?.immunizationHistory, "Immunized up to age as per national schedule (including MMR)");
  assert.strictEqual(data.pediatricDetails?.broughtBy, "Both parents");
  assert.strictEqual(data.pediatricDetails?.informant, "Mother");
});

// 4. Pediatric Plain-Text Formatter contains all documented pediatric fields
test("4. Pediatric Plain-Text Formatter produces complete pediatric text", () => {
  const pedCase = buildPediatricTestClinicalCase();
  const data = convertClinicalCaseToCaseSheetData(pedCase);
  const text = formatCaseSheetText(data);

  assert.ok(text.includes("Master Kabir"), "Patient name present");
  assert.ok(text.includes("4y M"), "Age/Sex present");
  assert.ok(text.includes("PEDIATRIC ASSESSMENT (PAT)"), "PAT section present");
  assert.ok(text.includes("Weight: 16 kg"), "Weight present");
  assert.ok(text.includes("Moderate muscle tone"), "Tone present");
  assert.ok(text.includes("Subcostal retractions"), "Work of breathing present");
  assert.ok(text.includes("Immunization History"), "Immunization present");
  assert.ok(text.includes("Syp Ceftriaxone") || text.includes("Inj Ceftriaxone"), "Antibiotic present");
  assert.ok(text.includes("Community-Acquired Pneumonia"), "Provisional diagnosis present");
});

// 5. Pediatric Section Ordering: Focused Physical Exam -> Investigations -> Treatment -> Provisional Diagnosis
test("5. Pediatric Section Ordering follows strict clinical sequence", () => {
  const pedCase = buildPediatricTestClinicalCase();
  const data = convertClinicalCaseToCaseSheetData(pedCase);
  const text = formatCaseSheetText(data);

  const idxExam = text.indexOf("\nFOCUSED PHYSICAL EXAMINATION\n");
  const idxInv = text.indexOf("\nINVESTIGATIONS\n");
  const idxTreat = text.indexOf("\nTREATMENT GIVEN\n");
  const idxDiag = text.indexOf("Provisional Diagnosis:");

  assert.ok(!text.includes("**"), "Copy text must be plain (no markdown **) for EMR paste");
  assert.ok(idxExam !== -1, "Focused Physical Exam must be present");
  assert.ok(idxInv !== -1, "Investigations must be present");
  assert.ok(idxTreat !== -1, "Treatment Given must be present");
  assert.ok(idxDiag !== -1, "Provisional Diagnosis must be present");

  assert.ok(idxExam < idxInv, "Focused Exam must precede Investigations");
  assert.ok(idxInv < idxTreat, "Investigations must precede Treatment Given");
  assert.ok(idxTreat < idxDiag, "Treatment Given must precede Provisional Diagnosis");
});

// 6. Adult Section Ordering: Primary Survey -> SAMPLE -> Secondary Survey -> Diagnosis -> Investigations -> Treatment
test("6. Adult Section Ordering follows standard ATLS/adult sequence", () => {
  const adultCase = buildAdultTestClinicalCase();
  const data = convertClinicalCaseToCaseSheetData(adultCase);
  const text = formatCaseSheetText(data);

  const idxPrimary = text.indexOf("\nPRIMARY SURVEY (ABCDE)\n");
  const idxSample = text.indexOf("\nSAMPLE HISTORY\n");
  const idxSec = text.indexOf("\nSECONDARY SURVEY / SYSTEMIC EXAMINATION\n");
  const idxDiag = text.indexOf("\nDIAGNOSIS\n");
  const idxInv = text.indexOf("\nINVESTIGATIONS\n");
  const idxTreat = text.indexOf("\nTREATMENT GIVEN\n");

  assert.ok(idxPrimary < idxSample, "Primary Survey must precede SAMPLE");
  assert.ok(idxSample < idxSec, "SAMPLE must precede Secondary Survey");
  assert.ok(idxSec < idxDiag, "Secondary Survey must precede Diagnosis");
  assert.ok(idxDiag < idxInv, "Diagnosis must precede Investigations");
  assert.ok(idxInv < idxTreat, "Investigations must precede Treatment");
});

// 7. Age routing: 0-16 pediatric, 17+ adult, unknown stays unknown/adult
test("7. Age routing rules enforced strictly", () => {
  // Age 16 -> pediatric
  const case16: ClinicalCase = { ...buildAdultTestClinicalCase(), patient: { ...buildAdultTestClinicalCase().patient, age: 16 } };
  assert.strictEqual(convertClinicalCaseToCaseSheetData(case16).isPediatric, true);

  // Age 0 -> pediatric
  const case0: ClinicalCase = { ...buildAdultTestClinicalCase(), patient: { ...buildAdultTestClinicalCase().patient, age: 0 } };
  assert.strictEqual(convertClinicalCaseToCaseSheetData(case0).isPediatric, true);

  // Age 17 -> adult
  const case17: ClinicalCase = { ...buildAdultTestClinicalCase(), patient: { ...buildAdultTestClinicalCase().patient, age: 17 } };
  assert.strictEqual(convertClinicalCaseToCaseSheetData(case17).isPediatric, false);

  // Age null / unknown -> remains adult / non-pediatric
  const caseUnknown: ClinicalCase = { ...buildAdultTestClinicalCase(), isPediatric: false, patient: { ...buildAdultTestClinicalCase().patient, age: null as any } };
  assert.strictEqual(convertClinicalCaseToCaseSheetData(caseUnknown).isPediatric, false);
});

// 8. Zero hallucination: missing fields remain "Not documented", no fabricated normal findings
test("8. Zero hallucination invariant: missing clinical fields are not fabricated as normal", () => {
  const emptyCase: ClinicalCase = {
    id: "case-empty",
    status: "Active",
    patient: { name: "Unknown Patient", presentingComplaint: "" } as any,
    vitals: {} as any,
    primaryAssessment: {} as any,
    sampleHistory: {} as any,
  };

  const data = convertClinicalCaseToCaseSheetData(emptyCase);
  const text = formatCaseSheetText(data);

  assert.ok(!text.includes("B/L air entry equal"), "Must not invent respiratory findings");
  assert.ok(!text.includes("Normal vesicular breath sounds"), "Must not invent vesicular sounds");
  assert.ok(!text.includes("S1 S2 heard"), "Must not invent cardiac sounds");
  assert.ok(!text.includes("Soft, non-tender"), "Must not invent abdominal examination");
  assert.ok(!text.includes("No focal deficit"), "Must not invent neuro exam");
  assert.ok(text.includes("A — Airway: Not documented"), "Unrecorded airway must be Not documented");
});

// 9. COPY FIRST, PRINT SECOND invariant: CaseSheetPrintView button order
test("9. CaseSheetPrintView implements COPY FIRST, PRINT SECOND in toolbar", () => {
  const code = readFileSync("src/components/CaseSheetPrintView.tsx", "utf-8");
  // Check preview mode button order
  const idxPreviewCopy = code.indexOf('id="preview-copy-casesheet-button"');
  const idxPreviewPrint = code.indexOf('id="preview-print-casesheet-button"');
  assert.ok(idxPreviewCopy !== -1, "Preview Copy button must exist");
  assert.ok(idxPreviewPrint !== -1, "Preview Print button must exist");
  assert.ok(idxPreviewCopy < idxPreviewPrint, "Preview Copy must be placed BEFORE Print");

  // Check print mode button order
  const idxPrintCopy = code.indexOf('id="print-copy-casesheet-button"');
  const idxPrintDownload = code.indexOf('id="print-download-casesheet-button"');
  assert.ok(idxPrintCopy !== -1, "Print Copy button must exist");
  assert.ok(idxPrintDownload !== -1, "Print Download/Print button must exist");
  assert.ok(idxPrintCopy < idxPrintDownload, "Print Copy must be placed BEFORE Print");
});

// 10. COPY FIRST, PRINT SECOND invariant: DischargeSummaryView button order
test("10. DischargeSummaryView implements COPY FIRST in toolbar", () => {
  const code = readFileSync("src/components/DischargeSummaryView.tsx", "utf-8");
  const toolbarIdx = code.indexOf('id="download-dropdown-discharge-container"');
  assert.ok(toolbarIdx !== -1, "Toolbar container must exist");
  const copyBtnIdx = code.lastIndexOf("handleCopyDischargeSummary", toolbarIdx);
  const printBtnIdx = code.indexOf("print-btn-discharge", toolbarIdx);
  assert.ok(copyBtnIdx !== -1, "Copy to EMR button must exist in toolbar");
  assert.ok(printBtnIdx !== -1, "Print button must exist in toolbar");
  assert.ok(copyBtnIdx < printBtnIdx, "Copy to EMR must be positioned before Print in toolbar");
});

// 11. Single printable document invariant: CaseSheetView has no duplicate hidden print block
test("11. CaseSheetView has NO redundant duplicate print templates and wraps editor in no-print", () => {
  const code = readFileSync("src/components/CaseSheetView.tsx", "utf-8");
  assert.ok(!code.includes('className="w-full pb-28 sm:pb-36 no-print"'), "Outer wrapper must NOT be no-print (it contains the print document)");
  assert.ok(code.includes('id="case-sheet-container"') && /no-print"? id="case-sheet-container"|className="[^"]*no-print[^"]*" id="case-sheet-container"/.test(code), "Editable form container must be no-print");
  assert.ok(code.includes('<div className="hidden print:block">') && code.includes('<CaseSheetPrintView clinicalCase={currentCase} defaultHospital='), "Must embed canonical CaseSheetPrintView on print");
  assert.ok(!code.includes("BEAUTIFUL PEDIATRIC PRINT RECORD"), "Obsolete duplicate pediatric print record must be removed");
});

// 12. Manual edits preservation: onViewPrintSheet passes unsaved currentCase
test("12. CaseSheetView passes unsaved currentCase to onViewPrintSheet", () => {
  const code = readFileSync("src/components/CaseSheetView.tsx", "utf-8");
  assert.ok(code.includes("setShowPdfModal(true) /* stay in the form so unsaved edits are kept */"), "Menu View must preview the current draft inside the form (unsaved edits kept)");
});

// 13. App.tsx retains unsaved viewCaseSheetPrintCase without silent Firestore writes
test("13. App.tsx stores and displays viewCaseSheetPrintCase", () => {
  const code = readFileSync("src/App.tsx", "utf-8");
  assert.ok(code.includes("viewCaseSheetPrintCase"), "viewCaseSheetPrintCase state must exist");
  assert.ok(code.includes("viewCaseSheetPrintCase && viewCaseSheetPrintCase.id === viewCaseSheetPrintId"), "Must prioritize unsaved draft over Firestore cases");
});

// 14. Discharge Summary live preview includes Immunization Status
test("14. DischargeSummaryView live preview includes pediatric Immunization Status", () => {
  const code = readFileSync("src/components/DischargeSummaryView.tsx", "utf-8");
  assert.ok(code.includes("Immunization Status:"), "Live preview must render Immunization Status for pediatric cases");
});

console.log("==================================================");
console.log(`Universal Documents & Copy-First: ${passed} / ${total} assertions passed.`);
console.log("==================================================");
