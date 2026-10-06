import assert from "node:assert";
import { ClinicalCase } from "./src/types";
import { deriveInitialCourseInHospital, extractPrecedingEvent } from "./src/utils/dischargeSyncEngine";
import { deriveExplicitEvents, isExplicitPrecipitatingEvent } from "./server/scribeChatTurn";
import { validateNarrativeFacts } from "./server/dischargeFactValidator";

console.log("==================================================");
console.log("ERMATE — CLINICAL NARRATIVE QUALITY AUDIT SUITE");
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
// 1. ACS Narrative
// ---------------------------------------------------------------
test("1. ACS Narrative Synthesis", () => {
  const acsCase: ClinicalCase = {
    id: "acs-01",
    patient: {
      name: "Ramesh Sharma",
      age: 56,
      gender: "Male",
      presentingComplaint: "Acute retrosternal chest pain of 2 hours duration associated with sweating and nausea"
    },
    sampleHistory: {
      symptoms: "Retrosternal chest discomfort radiating to left arm",
      events: "Symptoms began suddenly while patient was walking",
      allergies: "NKDA",
      pastHistory: "Hypertension, Type 2 DM"
    },
    primaryAssessment: {
      airway: "Patent",
      breathing: "Bilateral equal air entry, clear",
      circulation: "Hypotensive, peripheral pulses weak",
      disability: "GCS 15, pupils equal and reactive",
      exposure: "Cold clammy peripheries"
    },
    vitals: {
      bp: "90/60",
      hr: "110",
      rr: "22",
      spo2: "95",
      temp: "36.8"
    },
    investigations: [
      { id: "i1", testName: "ECG", result: "ST elevation in V1-V4" },
      { id: "i2", testName: "Troponin I", result: "Elevated at 1.4 ng/mL" }
    ],
    treatments: [
      { id: "t1", drugName: "Aspirin", dose: "300 mg", route: "Oral", timeGiven: "10:15" },
      { id: "t2", drugName: "Ticagrelor", dose: "180 mg", route: "Oral", timeGiven: "10:15" },
      { id: "t3", drugName: "Unfractionated Heparin", dose: "5000 IU", route: "IV", timeGiven: "10:20" }
    ],
    dispositionDetails: {
      dispositionType: "Admitted to Coronary Care Unit"
    }
  } as any;

  const course = deriveInitialCourseInHospital(acsCase);
  assert.ok(course.includes("Presentation:\nThe patient presented to the Emergency Department with Acute retrosternal chest pain of 2 hours duration associated with sweating and nausea."));
  assert.ok(course.includes("Events Leading to Presentation:\nSymptoms began suddenly while patient was walking."));
  assert.ok(course.includes("Initial Assessment:"));
  assert.ok(course.includes("Pulse was 110/min, blood pressure 90/60 mmHg"));
  assert.ok(course.includes("ECG showed a ST elevation in V1-V4"));
  assert.ok(course.includes("Troponin I showed a Elevated at 1.4 ng/mL"));
  assert.ok(course.includes("Aspirin 300 mg oral, Ticagrelor 180 mg oral, Unfractionated Heparin 5000 IU iv was administered."));
  assert.ok(course.includes("The patient was Admitted to Coronary Care Unit."));
});

// ---------------------------------------------------------------
// 2. Trauma / Fall Narrative
// ---------------------------------------------------------------
test("2. Trauma / Fall Narrative Synthesis", () => {
  const traumaCase: ClinicalCase = {
    id: "trauma-01",
    patient: {
      name: "Suresh",
      age: 42,
      gender: "Male",
      presentingComplaint: "Pain over right hip and inability to bear weight"
    },
    sampleHistory: {
      events: "The patient sustained a fall from approximately 6 feet while working at home"
    },
    vitals: {
      bp: "120/80",
      hr: "84",
      rr: "18",
      spo2: "99"
    },
    proceduresChecked: ["splint"],
    treatments: [
      { id: "t1", drugName: "Tramadol", dose: "50 mg", route: "IV", timeGiven: "11:00" }
    ],
    investigations: [
      { id: "i1", testName: "Pelvis X-Ray", result: "Fracture neck of femur right side" }
    ],
    dispositionDetails: {
      dispositionType: "Admitted under Orthopedics"
    }
  } as any;

  const course = deriveInitialCourseInHospital(traumaCase);
  assert.ok(course.includes("Presentation:\nThe patient presented to the Emergency Department with Pain over right hip and inability to bear weight."));
  assert.ok(course.includes("The patient sustained a fall from approximately 6 feet while working at home."));
  assert.ok(course.includes("Pelvis X-Ray showed a Fracture neck of femur right side."));
  assert.ok(course.includes("Splinting / Immobilization"));
  assert.ok(course.includes("The patient was Admitted under Orthopedics."));
});

// ---------------------------------------------------------------
// 3. Pediatric Fever Narrative
// ---------------------------------------------------------------
test("3. Pediatric Fever Narrative Synthesis", () => {
  const pedsCase: ClinicalCase = {
    id: "peds-01",
    isPediatric: true,
    patient: {
      name: "Master Aarav",
      age: 3,
      gender: "Male",
      presentingComplaint: "Fever for 3 days with reduced oral intake"
    },
    pediatricDetails: {
      patientWeight: "14",
      patNormal: true,
      patWorkOfBreathing: "normal",
      patCirculation: "normal"
    },
    vitals: {
      temp: "39.1",
      hr: "128",
      rr: "26",
      spo2: "98"
    },
    treatments: [
      { id: "t1", drugName: "Paracetamol", dose: "210 mg", route: "Oral", timeGiven: "14:10" }
    ],
    dischargeInfo: {
      dispositionStatus: "Discharged",
      followUpPlan: "Pediatric OPD review in 48 hours"
    }
  } as any;

  const course = deriveInitialCourseInHospital(pedsCase);
  assert.ok(course.includes("Presentation:\nThe child presented to the Emergency Department with Fever for 3 days with reduced oral intake."));
  assert.ok(course.includes("The Pediatric Assessment Triangle was documented as normal."));
  assert.ok(!course.includes("Events Leading to Presentation:"), "Ordinary pediatric fever must not create an Events section");
  assert.ok(course.includes("Paracetamol 210 mg oral was administered."));
  assert.ok(course.includes("The child was discharged with advice for Pediatric OPD review in 48 hours."));
});

// ---------------------------------------------------------------
// 4. Poisoning Narrative
// ---------------------------------------------------------------
test("4. Poisoning Narrative Synthesis", () => {
  const poisonEvent = deriveExplicitEvents({
    hpi: "Patient brought with alleged history of consumption of organophosphate compound around 2 hours back at residence"
  });
  assert.ok(poisonEvent !== null);
  assert.ok(poisonEvent.toLowerCase().includes("consumption of organophosphate compound"));

  const poisonCase: ClinicalCase = {
    id: "poison-01",
    patient: {
      name: "Rajesh",
      age: 28,
      gender: "Male",
      presentingComplaint: "Vomiting and altered sensorium following substance ingestion"
    },
    sampleHistory: {
      events: poisonEvent
    },
    proceduresChecked: ["ng_tube", "foleys"],
    treatments: [
      { id: "t1", drugName: "Atropine", dose: "2 mg", route: "IV", timeGiven: "09:00" },
      { id: "t2", drugName: "Pralidoxime", dose: "1 g", route: "IV", timeGiven: "09:15" }
    ],
    dispositionDetails: {
      dispositionType: "Admitted to Medical ICU"
    }
  } as any;

  const course = deriveInitialCourseInHospital(poisonCase);
  assert.ok(course.includes("Events Leading to Presentation:"));
  assert.ok(course.includes("Consumption of organophosphate compound"));
  assert.ok(course.includes("Nasogastric (NG) Tube"));
  assert.ok(course.includes("Foley's Catheterization"));
  assert.ok(course.includes("Atropine 2 mg iv, Pralidoxime 1 g iv was administered."));
  assert.ok(course.includes("The patient was Admitted to Medical ICU."));
});

// ---------------------------------------------------------------
// 5. Explicit Negative Preservation
// ---------------------------------------------------------------
test("5. Explicit Negative Preservation (No Trauma / No Precipitating Event)", () => {
  const negCase: ClinicalCase = {
    id: "neg-01",
    patient: {
      name: "Kamala",
      age: 64,
      presentingComplaint: "Generalized weakness"
    },
    sampleHistory: {
      events: "No history of trauma or fall"
    }
  } as any;

  const event = extractPrecedingEvent(negCase);
  assert.strictEqual(event, null, "Explicit negative trauma must not become an active precipitating event");

  const course = deriveInitialCourseInHospital(negCase);
  assert.ok(!course.includes("Events Leading to Presentation:"), "Negative event statement must not create an Events section");
});

// ---------------------------------------------------------------
// 6. No Event Documented → Events Blank
// ---------------------------------------------------------------
test("6. No Event Documented → Events Blank", () => {
  const emptyCase: ClinicalCase = {
    id: "empty-01",
    patient: {
      name: "Sita",
      age: 35,
      presentingComplaint: "Headache for 1 day"
    },
    sampleHistory: {
      events: ""
    }
  } as any;

  const event = extractPrecedingEvent(emptyCase);
  assert.strictEqual(event, null);
  const course = deriveInitialCourseInHospital(emptyCase);
  assert.ok(!course.includes("Events Leading to Presentation:"));
});

// ---------------------------------------------------------------
// 7. Primary Survey Not Copied into Events
// ---------------------------------------------------------------
test("7. Primary Survey Not Copied into Events", () => {
  const surveyDump = "Airway patent. Bilateral air entry clear. S1 S2 heard. GCS 15. Pupils equal.";
  assert.strictEqual(isExplicitPrecipitatingEvent(surveyDump), false);

  const derived = deriveExplicitEvents({ events: surveyDump }, surveyDump);
  assert.strictEqual(derived, null, "Primary survey findings must never be derived into Events");
});

// ---------------------------------------------------------------
// 8. Secondary Survey Not Copied into Events
// ---------------------------------------------------------------
test("8. Secondary Survey Not Copied into Events", () => {
  const secondaryExamDump = "Per abdomen soft, non-tender. Bowel sounds present. No guarding. No rigidity.";
  assert.strictEqual(isExplicitPrecipitatingEvent(secondaryExamDump), false);

  const derived = deriveExplicitEvents({ events: secondaryExamDump }, secondaryExamDump);
  assert.strictEqual(derived, null, "Secondary survey findings must never be derived into Events");
});

// ---------------------------------------------------------------
// 9. Discharge Course Chronological Order
// ---------------------------------------------------------------
test("9. Discharge Course Chronological Order", () => {
  const fullCase: ClinicalCase = {
    id: "chrono-01",
    patient: {
      name: "Vikram",
      age: 50,
      presentingComplaint: "Shortness of breath"
    },
    sampleHistory: {
      events: "Sudden onset breathlessness after climbing hill"
    },
    vitals: { hr: "112", bp: "150/90" },
    investigations: [{ id: "i1", testName: "Chest X-Ray", result: "Bilateral infiltrates" }],
    treatments: [{ id: "t1", drugName: "Furosemide", dose: "40 mg", route: "IV" }],
    proceduresChecked: ["iv_cannula"],
    progressNotes: "Patient serial vitals monitored in ER.",
    dispositionDetails: { dispositionType: "Admitted to Ward" }
  } as any;

  const course = deriveInitialCourseInHospital(fullCase);
  const idxPres = course.indexOf("Presentation:");
  const idxEvents = course.indexOf("Events Leading to Presentation:");
  const idxInit = course.indexOf("Initial Assessment:");
  const idxInv = course.indexOf("Investigations:");
  const idxTx = course.indexOf("Treatment Given:");
  const idxProc = course.indexOf("Procedures:");
  const idxClin = course.indexOf("Clinical Course:");
  const idxDisp = course.indexOf("Disposition:");

  assert.ok(idxPres < idxEvents, "Presentation before Events");
  assert.ok(idxEvents < idxInit, "Events before Initial Assessment");
  assert.ok(idxInit < idxInv, "Initial Assessment before Investigations");
  assert.ok(idxInv < idxTx, "Investigations before Treatment Given");
  assert.ok(idxTx < idxProc, "Treatment Given before Procedures");
  assert.ok(idxProc < idxClin, "Procedures before Clinical Course");
  assert.ok(idxClin < idxDisp, "Clinical Course before Disposition");
});

// ---------------------------------------------------------------
// 10. Course Includes Important Initial Findings
// ---------------------------------------------------------------
test("10. Course Includes Documented Initial Findings", () => {
  const vitalsCase: ClinicalCase = {
    id: "vitals-01",
    patient: {
      name: "Meena",
      age: 29,
      presentingComplaint: "Palpitations"
    },
    vitals: {
      hr: "165",
      bp: "110/70",
      spo2: "99",
      temp: "37.0"
    }
  } as any;

  const course = deriveInitialCourseInHospital(vitalsCase);
  assert.ok(course.includes("Initial Assessment:"));
  assert.ok(course.includes("Pulse was 165/min"));
  assert.ok(course.includes("blood pressure 110/70 mmHg"));
});

// ---------------------------------------------------------------
// 11. Investigations Summarized Naturally
// ---------------------------------------------------------------
test("11. Investigations Summarized Naturally", () => {
  const invCase: ClinicalCase = {
    id: "inv-01",
    patient: { name: "Test", presentingComplaint: "Abdominal pain" },
    investigationLabsOrdered: "CBC, LFT, RFT",
    investigations: [
      { id: "i1", testName: "Serum Amylase", result: "Elevated at 850 U/L" },
      { id: "i2", testName: "Serum Lipase", result: "Elevated at 620 U/L" }
    ]
  } as any;

  const course = deriveInitialCourseInHospital(invCase);
  assert.ok(course.includes("CBC, LFT, RFT were sent."));
  assert.ok(course.includes("Serum Amylase showed a Elevated at 850 U/L"));
  assert.ok(course.includes("Serum Lipase showed a Elevated at 620 U/L"));
});

// ---------------------------------------------------------------
// 12. Treatment Summarized Naturally
// ---------------------------------------------------------------
test("12. Treatment Summarized Naturally", () => {
  const txCase: ClinicalCase = {
    id: "tx-01",
    patient: { name: "Test", presentingComplaint: "Asthma exacerbation" },
    treatments: [
      { id: "t1", drugName: "Salbutamol", dose: "2.5 mg", route: "Nebulization" },
      { id: "t2", drugName: "Hydrocortisone", dose: "100 mg", route: "IV" }
    ]
  } as any;

  const course = deriveInitialCourseInHospital(txCase);
  assert.ok(course.includes("Treatment Given:"));
  assert.ok(course.includes("Salbutamol 2.5 mg nebulization, Hydrocortisone 100 mg iv was administered."));
});

// ---------------------------------------------------------------
// 13. Progress Included Only When Documented
// ---------------------------------------------------------------
test("13. Progress Included Only When Documented", () => {
  const noNotesCase: ClinicalCase = {
    id: "notes-01",
    patient: { name: "Test", presentingComplaint: "Cold" }
  } as any;

  const courseWithout = deriveInitialCourseInHospital(noNotesCase);
  assert.ok(!courseWithout.includes("Clinical Course:"), "Missing progress notes must omit Clinical Course section");

  const notesCase: ClinicalCase = {
    id: "notes-02",
    patient: { name: "Test", presentingComplaint: "Cold" },
    progressNotes: "Re-assessed after 1 hour: breathing easy, tolerating sips of water."
  } as any;

  const courseWith = deriveInitialCourseInHospital(notesCase);
  assert.ok(courseWith.includes("Clinical Course:\nRe-assessed after 1 hour: breathing easy, tolerating sips of water."));
});

// ---------------------------------------------------------------
// 14. Disposition Included Only When Documented
// ---------------------------------------------------------------
test("14. Disposition Included Only When Documented", () => {
  const noDispCase: ClinicalCase = {
    id: "disp-01",
    patient: { name: "Test", presentingComplaint: "Fever" }
  } as any;

  const courseWithout = deriveInitialCourseInHospital(noDispCase);
  assert.ok(!courseWithout.includes("Disposition:"));

  const dispCase: ClinicalCase = {
    id: "disp-02",
    patient: { name: "Test", presentingComplaint: "Fever" },
    dischargeInfo: {
      dispositionStatus: "Discharged",
      followUpPlan: "Local clinic review in 3 days"
    }
  } as any;

  const courseWith = deriveInitialCourseInHospital(dispCase);
  assert.ok(courseWith.includes("Disposition:\nThe patient was discharged with advice for Local clinic review in 3 days."));
});

// ---------------------------------------------------------------
// 15. Fact Check: No Fabricated Improvement
// ---------------------------------------------------------------
test("15. Fact Check: No Fabricated Improvement", () => {
  const baseCase: any = {
    progressNotes: "Patient resting in bed."
  };

  const fabricated = "Patient condition improved significantly and symptoms resolved.";
  const res = validateNarrativeFacts(fabricated, baseCase);
  assert.strictEqual(res.valid, false);
  assert.ok(res.violations[0].includes("patient improved"));

  const verified = "Patient condition improved following analgesia.";
  const validCase = { progressNotes: "Patient improved after analgesia" };
  const resValid = validateNarrativeFacts(verified, validCase);
  assert.strictEqual(resValid.valid, true);
});

// ---------------------------------------------------------------
// 16. Fact Check: No Fabricated Stability
// ---------------------------------------------------------------
test("16. Fact Check: No Fabricated Stability", () => {
  const baseCase: any = {
    progressNotes: "Monitoring ongoing."
  };

  const fabricated = "Patient remained hemodynamically stable throughout the ED stay.";
  const res = validateNarrativeFacts(fabricated, baseCase);
  assert.strictEqual(res.valid, false);
  assert.ok(res.violations[0].includes("stable"));

  const validCase = {
    dischargeInfo: { conditionAtDischarge: "Hemodynamically stable" }
  };
  const resValid = validateNarrativeFacts(fabricated, validCase);
  assert.strictEqual(resValid.valid, true);
});

// ---------------------------------------------------------------
// 17. Fact Check: No Fabricated Consultation
// ---------------------------------------------------------------
test("17. Fact Check: No Fabricated Consultation", () => {
  const baseCase: any = {
    consultations: []
  };

  const fabricated = "Specialist reviewed and cardiology consultation was obtained.";
  const res = validateNarrativeFacts(fabricated, baseCase);
  assert.strictEqual(res.valid, false);
  assert.ok(res.violations[0].includes("consultation"));

  const validCase = {
    consultations: ["Cardiology"]
  };
  const resValid = validateNarrativeFacts(fabricated, validCase);
  assert.strictEqual(resValid.valid, true);
});

// ---------------------------------------------------------------
// 18. Fact Check: No Fabricated Tolerated Well
// ---------------------------------------------------------------
test("18. Fact Check: No Fabricated Tolerated Well", () => {
  const baseCase: any = {
    progressNotes: "Procedure performed as charted."
  };

  const fabricated = "Patient tolerated the procedure well without any complications.";
  const res = validateNarrativeFacts(fabricated, baseCase);
  assert.strictEqual(res.valid, false);
  assert.ok(res.violations[0].includes("tolerated"));
});

// ---------------------------------------------------------------
// 19. Duplicate Facts Minimized Between Sections
// ---------------------------------------------------------------
test("19. Duplicate Facts Minimized Between Sections", () => {
  const sampleCase: ClinicalCase = {
    id: "dup-01",
    patient: {
      name: "Ashok",
      presentingComplaint: "Fall from ladder"
    },
    sampleHistory: {
      events: "Fall from ladder"
    }
  } as any;

  // When events is an exact duplicate of presenting complaint, extractPrecedingEvent suppresses duplicate section
  const event = extractPrecedingEvent(sampleCase);
  assert.strictEqual(event, null, "Exact duplicate of presenting complaint must be omitted from Events section");

  const course = deriveInitialCourseInHospital(sampleCase);
  assert.ok(course.includes("Presentation:\nThe patient presented to the Emergency Department with Fall from ladder."));
  assert.ok(!course.includes("Events Leading to Presentation:"));
});

// ---------------------------------------------------------------
// 20. Model Failure → Deterministic Fallback Still Works
// ---------------------------------------------------------------
test("20. Model Failure → Deterministic Fallback Preserves Full Structure", () => {
  const testCase: ClinicalCase = {
    id: "fallback-01",
    patient: {
      name: "Devi",
      age: 62,
      presentingComplaint: "Severe dizziness and vertigo"
    },
    vitals: {
      bp: "130/80",
      hr: "76"
    },
    treatments: [
      { id: "t1", drugName: "Betahistine", dose: "16 mg", route: "Oral" }
    ],
    dischargeInfo: {
      primaryDiagnosis: "Benign Paroxysmal Positional Vertigo",
      dispositionStatus: "Discharged"
    }
  } as any;

  const fallbackCourse = deriveInitialCourseInHospital(testCase);
  assert.ok(fallbackCourse.startsWith("COURSE IN EMERGENCY DEPARTMENT"));
  assert.ok(fallbackCourse.includes("Presentation:\nThe patient presented to the Emergency Department with Severe dizziness and vertigo."));
  assert.ok(fallbackCourse.includes("Initial Assessment:"));
  assert.ok(fallbackCourse.includes("Pulse was 76/min, and blood pressure 130/80 mmHg."));
  assert.ok(fallbackCourse.includes("Treatment Given:\nBetahistine 16 mg oral was administered."));
  assert.ok(fallbackCourse.includes("Disposition:\nThe patient was discharged from the Emergency Department."));
});

console.log("==================================================");
console.log(`Clinical Narrative Quality Audit: ${passedTests} / ${totalTests} assertions passed.`);
console.log("==================================================");
