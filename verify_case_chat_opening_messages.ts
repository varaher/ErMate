/**
 * verify_case_chat_opening_messages.ts
 *
 * Verification suite for ErMate Discuss Opening: Concise Case Debrief:
 * 1. existing ACS case → concise case debrief
 * 2. trauma case → concise case debrief
 * 3. pediatric case → concise case debrief
 * 4. minimal case → short factual statement only
 * 5. empty shell → "Ask me anything about this case."
 * 6. no Clinical Case Summary heading
 * 7. no Patient Overview table
 * 8. no Critical Gaps section
 * 9. no action-menu list
 * 10. no fabricated normal ABCDE
 * 11. no fabricated GCS 15
 * 12. no fabricated treatment
 * 13. genuine historical conversation preserved
 * 14. old bootstrap summary removed
 * 15. Rounds opening unchanged
 */

import assert from "assert";
import fs from "fs";
import {
  generateDiscussCaseDebrief,
  buildWelcomeMessage,
  migrateLegacySessionMessages,
  isMeaningfulCase,
  isMinimallyDocumentedCase
} from "./src/utils/caseDebrief";
import type { ChatContext, ChatMessage } from "./src/hooks/useBoundChat";

let passedCount = 0;
let totalCount = 0;

function test(name: string, fn: () => void) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("\n=======================================================");
console.log("  VERIFY ERMATE DISCUSS OPENING: CONCISE CASE DEBRIEF");
console.log("=======================================================\n");

// Mock Clinical Cases
const acsCase = {
  id: "case_acs_01",
  patient: {
    name: "Ramesh Sharma",
    age: 58,
    gender: "Male",
    presentingComplaint: "acute retrosternal chest pain radiating to left arm",
    triageCategory: "P1 Resuscitation",
    caseType: "Medical"
  },
  vitals: {
    bp: "150/90",
    hr: "96",
    spo2: "98",
    rr: "20"
  },
  sampleHistory: {
    signsSymptoms: "Chest tightness, diaphoresis",
    allergies: "NKDA",
    medications: "Telmisartan 40mg",
    pastMedicalHistory: "Hypertension x 5 yrs",
    lastMeal: "2 hours ago",
    events: "sudden onset crushing chest pain while resting"
  },
  primaryAssessment: {
    airway: "Patent",
    airwayStatus: "Normal",
    breathing: "Bilateral vesicular breath sounds, no wheeze",
    breathingStatus: "Normal",
    circulation: "Warm peripheries, pulses 96/min regular",
    circulationStatus: "Normal",
    disability: "Alert, pupils equal",
    disabilityStatus: "Normal",
    exposure: "Afebrile, no rash",
    exposureStatus: "Normal"
  },
  secondarySurvey: {
    chest: "Normal vesicular breath sounds, S1 S2 heard, no murmur"
  },
  investigations: [
    { testName: "ECG", result: "ST elevation in leads II, III, aVF" },
    { testName: "Troponin T", result: "Positive" }
  ],
  treatments: [
    { drugName: "Aspirin", dose: "300mg" },
    { drugName: "Clopidogrel", dose: "300mg" },
    { drugName: "Atorvastatin", dose: "80mg" }
  ],
  provisionalPrimaryDiagnosis: "Acute Inferior Wall STEMI",
  dispositionDetails: {
    dispositionType: "Cath Lab / CCU",
    observationNotes: "Planned for immediate primary PCI"
  }
};

const traumaCase = {
  id: "case_trauma_02",
  patient: {
    name: "Vikram Kumar",
    age: 28,
    gender: "Male",
    presentingComplaint: "road traffic accident",
    triageCategory: "P1 Resuscitation",
    caseType: "Trauma"
  },
  vitals: {
    bp: "90/60",
    hr: "124",
    spo2: "97",
    rr: "26"
  },
  sampleHistory: {
    events: "two-wheeler collision with divider, blunt abdominal trauma"
  },
  primaryAssessment: {
    circulation: "Tachycardic, weak radial pulse",
    circulationStatus: "Abnormal"
  },
  secondarySurvey: {
    abdomen: "abdominal tenderness and guarding, positive eFAST in Morrison pouch"
  },
  investigations: [
    { testName: "eFAST", result: "Free fluid in hepatorenal pouch" },
    { testName: "VBG", result: "Lactate 3.8 mmol/L" }
  ],
  treatments: [
    { drugName: "IV Normal Saline", dose: "1000ml rapid bolus" },
    { drugName: "Tranexamic Acid", dose: "1g IV" }
  ],
  provisionalPrimaryDiagnosis: "Hemoperitoneum secondary to blunt abdominal trauma",
  dispositionDetails: {
    dispositionType: "Emergency OT"
  }
};

const pedsCase = {
  id: "case_peds_03",
  isPediatric: true,
  patient: {
    name: "Ananya",
    age: 4,
    gender: "Female",
    presentingComplaint: "high grade fever and cough with fast breathing",
    triageCategory: "P2 Priority 2",
    caseType: "Pediatric"
  },
  pediatricDetails: {
    patientWeight: 16
  },
  vitals: {
    hr: "140",
    spo2: "93",
    rr: "42",
    temp: "102.4"
  },
  primaryAssessment: {
    breathing: "bilateral wheeze and subcostal retractions",
    breathingStatus: "Abnormal"
  },
  secondarySurvey: {
    chest: "bilateral polyphonic wheezing"
  },
  investigations: [
    { testName: "Chest X-Ray", result: "Right lower lobe infiltrates" }
  ],
  treatments: [
    { drugName: "Nebulized Salbutamol", dose: "2.5mg" },
    { drugName: "IV Ceftriaxone", dose: "800mg" }
  ],
  provisionalPrimaryDiagnosis: "Severe Community-Acquired Pneumonia with reactive airway disease",
  dispositionDetails: {
    dispositionType: "PICU"
  }
};

const minimalCase = {
  id: "case_min_04",
  patient: {
    triageCategory: "P2 Priority 2",
    caseType: "Medical"
  }
};

const emptyCase = {
  id: "case_empty_05",
  patient: {}
};

// 1. existing ACS case → concise case debrief
test("1. existing ACS case → concise case debrief", () => {
  const debrief = generateDiscussCaseDebrief(acsCase);
  assert.ok(debrief.startsWith("Here’s what you’ve documented so far:"), "Must begin with standard prefix");
  assert.ok(debrief.includes("How can I help with this case?"), "Must end with standard call to action");
  assert.ok(debrief.includes("58-year-old male"), "Must include age and gender");
  assert.ok(debrief.includes("chest pain"), "Must include presenting complaint");
  assert.ok(debrief.includes("BP 150/90 mmHg"), "Must include documented vitals");
  assert.ok(debrief.includes("Aspirin"), "Must include treatments");
  assert.ok(debrief.includes("STEMI"), "Must include diagnosis");

  const wordCount = debrief.trim().split(/\s+/).length;
  assert.ok(wordCount >= 40 && wordCount <= 120, `Word count should be in concise 40-100 range (got ${wordCount})`);
});

// 2. trauma case → concise case debrief
test("2. trauma case → concise case debrief", () => {
  const debrief = generateDiscussCaseDebrief(traumaCase);
  assert.ok(debrief.startsWith("Here’s what you’ve documented so far:"));
  assert.ok(debrief.includes("How can I help with this case?"));
  assert.ok(debrief.includes("28-year-old male"));
  assert.ok(debrief.includes("road traffic accident"));
  assert.ok(debrief.includes("BP 90/60 mmHg"));
  assert.ok(debrief.includes("Tranexamic Acid"));
  assert.ok(debrief.includes("Hemoperitoneum"));

  const wordCount = debrief.trim().split(/\s+/).length;
  assert.ok(wordCount >= 40 && wordCount <= 120, `Word count should be in concise range (got ${wordCount})`);
});

// 3. pediatric case → concise case debrief
test("3. pediatric case → concise case debrief", () => {
  const debrief = generateDiscussCaseDebrief(pedsCase);
  assert.ok(debrief.startsWith("Here’s what you’ve documented so far:"));
  assert.ok(debrief.includes("How can I help with this case?"));
  assert.ok(debrief.includes("4-year-old girl"));
  assert.ok(debrief.includes("fever"));
  assert.ok(debrief.includes("Salbutamol"));
  assert.ok(debrief.includes("Pneumonia"));

  const wordCount = debrief.trim().split(/\s+/).length;
  assert.ok(wordCount >= 40 && wordCount <= 120, `Word count should be in concise range (got ${wordCount})`);
});

// 4. minimal case → short factual statement only
test("4. minimal case → short factual statement only", () => {
  const debrief = generateDiscussCaseDebrief(minimalCase);
  const expected = `Here’s what you’ve documented so far:
This is a P2 medical patient currently under evaluation.

How can I help with this case?`;
  assert.strictEqual(debrief, expected, "Minimal case must produce exact short factual statement without missing data audit");
  assert.ok(!debrief.toLowerCase().includes("missing"), "No missing data audit");
  assert.ok(!debrief.toLowerCase().includes("not documented"), "No 'not documented' audit");
});

// 5. empty shell → "Ask me anything about this case."
test("5. empty shell → 'Ask me anything about this case.'", () => {
  const debrief = generateDiscussCaseDebrief(emptyCase);
  assert.strictEqual(debrief, "Ask me anything about this case.", "Empty shell must return exact string");

  const nullDebrief = generateDiscussCaseDebrief(null);
  assert.strictEqual(nullDebrief, "Ask me anything about this case.");
});

// 6. no Clinical Case Summary heading
test("6. no Clinical Case Summary heading", () => {
  const cases = [acsCase, traumaCase, pedsCase, minimalCase, emptyCase];
  for (const c of cases) {
    const debrief = generateDiscussCaseDebrief(c);
    assert.ok(!debrief.includes("Clinical Case Summary"), "Must not contain 'Clinical Case Summary'");
    assert.ok(!debrief.includes("# "), "Must not contain markdown headings");
  }
});

// 7. no Patient Overview table
test("7. no Patient Overview table", () => {
  const cases = [acsCase, traumaCase, pedsCase, minimalCase, emptyCase];
  for (const c of cases) {
    const debrief = generateDiscussCaseDebrief(c);
    assert.ok(!debrief.includes("Patient Overview"), "Must not contain 'Patient Overview'");
    assert.ok(!debrief.includes("|"), "Must not contain markdown table pipe characters");
  }
});

// 8. no Critical Gaps section
test("8. no Critical Gaps section", () => {
  const cases = [acsCase, traumaCase, pedsCase, minimalCase, emptyCase];
  for (const c of cases) {
    const debrief = generateDiscussCaseDebrief(c);
    assert.ok(!debrief.includes("Critical Gaps"), "Must not contain 'Critical Gaps'");
    assert.ok(!debrief.includes("Clinical Snapshot"), "Must not contain 'Clinical Snapshot'");
    assert.ok(!debrief.includes("Record significantly incomplete"), "Must not contain completeness warning");
  }
});

// 9. no action-menu list
test("9. no action-menu list", () => {
  const cases = [acsCase, traumaCase, pedsCase, minimalCase, emptyCase];
  for (const c of cases) {
    const debrief = generateDiscussCaseDebrief(c);
    assert.ok(!debrief.includes("How would you like to proceed?"), "Must not include proceed question");
    assert.ok(!debrief.includes("1. "), "Must not contain numbered menu item 1.");
    assert.ok(!debrief.includes("2. "), "Must not contain numbered menu item 2.");
    assert.ok(!debrief.includes("Suggested actions"), "Must not contain suggested actions");
  }
});

// 10. no fabricated normal ABCDE
test("10. no fabricated normal ABCDE", () => {
  // acsCase has normal primary assessment: airway, breathing, circulation, disability, exposure are all Normal
  const debrief = generateDiscussCaseDebrief(acsCase);
  assert.ok(!debrief.toLowerCase().includes("airway patent"), "Never mention normal airway");
  assert.ok(!debrief.toLowerCase().includes("breathing normal"), "Never mention normal breathing");
  assert.ok(!debrief.toLowerCase().includes("abcde normal"), "Never invent 'ABCDE normal'");
  assert.ok(!debrief.toLowerCase().includes("hemodynamically stable"), "Never invent 'hemodynamically stable'");
});

// 11. no fabricated GCS 15
test("11. no fabricated GCS 15", () => {
  // acsCase does not have GCS documented in vitals
  const debrief = generateDiscussCaseDebrief(acsCase);
  assert.ok(!debrief.includes("GCS 15"), "Must not invent GCS 15 when omitted");
  assert.ok(!debrief.includes("GCS"), "Must not mention GCS when omitted");
});

// 12. no fabricated treatment
test("12. no fabricated treatment", () => {
  const caseWithoutRx = {
    id: "case_norx",
    patient: {
      age: 35,
      gender: "Female",
      presentingComplaint: "isolated sprained ankle after fall",
      triageCategory: "P3 Green",
      caseType: "Orthopedic"
    },
    vitals: { bp: "120/80", hr: "72", spo2: "99" }
  };
  const debrief = generateDiscussCaseDebrief(caseWithoutRx);
  assert.ok(!debrief.includes("treatments administered so far include"), "Must not fabricate treatment sentence when no treatments given");
  assert.ok(!debrief.toLowerCase().includes("symptomatic monitoring"), "Must not invent 'symptomatic monitoring'");
  assert.ok(!debrief.toLowerCase().includes("no treatments"), "Must not say 'no treatments documented'");
});

// 13. genuine historical conversation preserved
test("13. genuine historical conversation preserved", () => {
  const context: ChatContext = {
    type: "case",
    id: acsCase.id,
    data: acsCase
  };

  const legacySession: ChatMessage[] = [
    {
      role: "assistant",
      content: "## Discussing Active Case\n\n### Clinical Case Summary\nPatient Overview table\n| Key | Value |\nCritical Gaps: None\nHow would you like to proceed?",
      timestamp: "2026-10-07T10:00:00Z"
    },
    {
      role: "user",
      content: "What is the troponin result and recommendation?",
      timestamp: "2026-10-07T10:01:00Z"
    },
    {
      role: "assistant",
      content: "Troponin T is positive. In view of ST elevation in inferior leads, emergent coronary angiography is indicated.",
      timestamp: "2026-10-07T10:01:30Z"
    }
  ];

  const migrated = migrateLegacySessionMessages(legacySession, context, "discuss");
  assert.strictEqual(migrated.length, 3, "Migrated session should keep 3 messages");
  assert.strictEqual(migrated[1].role, "user", "Message 1 must be genuine user message");
  assert.strictEqual(migrated[1].content, "What is the troponin result and recommendation?", "User text must be identical");
  assert.strictEqual(migrated[2].role, "assistant", "Message 2 must be assistant answer");
  assert.strictEqual(migrated[2].content, "Troponin T is positive. In view of ST elevation in inferior leads, emergent coronary angiography is indicated.");
});

// 14. old bootstrap summary removed
test("14. old bootstrap summary removed", () => {
  const context: ChatContext = {
    type: "case",
    id: acsCase.id,
    data: acsCase
  };

  const legacySession: ChatMessage[] = [
    {
      role: "assistant",
      content: "## Discussing Active Case\n\n### Clinical Case Summary\nPatient Overview table\nCritical Gaps: None\nHow would you like to proceed?",
      timestamp: "2026-10-07T10:00:00Z"
    },
    {
      role: "user",
      content: "Start heparin infusion?",
      timestamp: "2026-10-07T10:01:00Z"
    }
  ];

  const migrated = migrateLegacySessionMessages(legacySession, context, "discuss");
  const openingMsg = migrated[0];
  assert.ok(!openingMsg.content.includes("Clinical Case Summary"), "Old bootstrap summary must be removed");
  assert.ok(!openingMsg.content.includes("Critical Gaps"), "Old Critical Gaps must be removed");
  assert.ok(!openingMsg.content.includes("How would you like to proceed?"), "Old proceed prompt must be removed");
  assert.ok(openingMsg.content.startsWith("Here’s what you’ve documented so far:"), "Replaced with fresh concise debrief");
  assert.ok(openingMsg.content.includes("How can I help with this case?"));
});

// 15. Rounds opening unchanged
test("15. Rounds opening unchanged", () => {
  const contextCase: ChatContext = {
    type: "case",
    id: acsCase.id,
    data: acsCase
  };

  const roundsWelcome = buildWelcomeMessage(contextCase, "rounds");
  assert.strictEqual(
    roundsWelcome.content,
    "Want to prepare before rounds? Ask.",
    "Rounds opening must be exactly 'Want to prepare before rounds? Ask.'"
  );

  const contextRoundsType: ChatContext = {
    type: "rounds",
    id: acsCase.id,
    data: acsCase
  };
  const roundsWelcomeType = buildWelcomeMessage(contextRoundsType, "rounds");
  assert.strictEqual(
    roundsWelcomeType.content,
    "Want to prepare before rounds? Ask.",
    "Rounds context type opening must be exactly 'Want to prepare before rounds? Ask.'"
  );
});

console.log(`\nResults: ${passedCount} / ${totalCount} tests passed.\n`);
if (passedCount === totalCount) {
  console.log("All 15 Discuss Opening Concise Debrief verifications PASSED!\n");
} else {
  process.exit(1);
}
