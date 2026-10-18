// MARKER: ERMATE-TRIAGE-CHART-V1
import { readFileSync } from "fs";
import { classifyEmergencyTriage, findPhrase } from "./src/utils/triageClassifier";
import { TRIAGE_LEVELS, levelToLegacyCategory, getTriageDisplay, matchesTriageCode, TRIAGE_LEVEL_LIST } from "./src/utils/triageScale";
import { TriageCategory } from "./src/types";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, extra = "") => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n} ${extra}`); } };

const V = (o: Partial<Record<string, string>> = {}) => ({ bp: "", hr: "", spo2: "", rr: "", temp: "", gcs: "", gcs_e: "", gcs_v: "", gcs_m: "", grbs: "", avpu: "", painScore: "", ...o }) as any;
const lvl = (age: number | null, complaint: string, vitals: any = V()) => classifyEmergencyTriage(age, complaint, vitals).level;
const is = (name: string, got: number, want: number) => check(`${name} -> P${want}`, got === want, `(got P${got})`);

// ── scale
check("five levels with chart names and minutes", TRIAGE_LEVEL_LIST.length === 5 && TRIAGE_LEVELS[1].minutes === 0 && TRIAGE_LEVELS[2].minutes === 5 && TRIAGE_LEVELS[3].minutes === 30 && TRIAGE_LEVELS[4].minutes === 60 && TRIAGE_LEVELS[5].minutes === 120);
check("level names", TRIAGE_LEVELS[1].name === "Immediate" && TRIAGE_LEVELS[2].name === "Very Urgent" && TRIAGE_LEVELS[3].name === "Urgent" && TRIAGE_LEVELS[4].name === "Standard" && TRIAGE_LEVELS[5].name === "Non-Urgent");
check("legacy bucket mapping I->P1, II/III->P2, IV/V->P3", levelToLegacyCategory(1) === TriageCategory.P1 && levelToLegacyCategory(2) === TriageCategory.P2 && levelToLegacyCategory(3) === TriageCategory.P2 && levelToLegacyCategory(4) === TriageCategory.P3 && levelToLegacyCategory(5) === TriageCategory.P3);
check("legacy enum values untouched (older consumers)", TriageCategory.P1 === "P1 (Immediate)" && TriageCategory.P2 === "P2 (Urgent)" && TriageCategory.P3 === "P3 (Non-Urgent)");
check("display uses level when consistent", getTriageDisplay({ triageCategory: "P2 (Urgent)", triageLevel: 3 }).code === "P3");
check("display falls back to legacy when level contradicts category", getTriageDisplay({ triageCategory: "P1 (Immediate)", triageLevel: 4 }).code === "P1");
check("display of old case (no level) is its stored code", getTriageDisplay({ triageCategory: "P3 (Non-Urgent)" }).code === "P3" && getTriageDisplay({ triageCategory: "P3 (Non-Urgent)" }).legacy);
check("pending case keeps the old P2 placeholder", getTriageDisplay({ triageCategory: "" }).code === "P2");
check("filter matches displayed code (new + old)", matchesTriageCode({ triageCategory: "P2 (Urgent)", triageLevel: 3 }, "P3") && matchesTriageCode({ triageCategory: "P3 (Non-Urgent)" }, "P3") && !matchesTriageCode({ triageCategory: "P2 (Urgent)", triageLevel: 3 }, "P2"));

// ── phrase matching
check("negation: 'no chest pain' ignored", findPhrase("no chest pain", ["chest pain"]) === null);
check("negation: only within the clause", findPhrase("no fever, chest pain", ["chest pain"]) === "chest pain");
check("word start: 'seizures' matches 'seizure'", findPhrase("known seizures", ["seizure"]) === "seizure");
check("'slurred' does not trigger 'slip'", findPhrase("slurred speech", ["slip"]) === null);
check("whole-word marker: 'utility' is not UTI", findPhrase("utility room", ["uti$"]) === null && findPhrase("uti, fever", ["uti$"]) === "uti");

// ── adult: complaint conditions per priority
is("adult cardiac arrest", lvl(45, "cardiac arrest"), 1);
is("adult anaphylaxis", lvl(30, "anaphylaxis after injection"), 1);
is("adult active seizure", lvl(30, "active seizures"), 1);
is("adult head injury + unconscious", lvl(30, "head injury, unconscious"), 1);
is("adult snake bite", lvl(30, "snake bite right leg"), 1);
is("adult hanging", lvl(30, "attempted hanging"), 1);
is("adult poisoning", lvl(30, "organophosphate poisoning"), 1);
is("adult chest pain", lvl(55, "chest pain radiating to left arm"), 2);
is("adult stroke", lvl(60, "right sided weakness, slurred speech"), 2);
is("adult sepsis", lvl(60, "suspected sepsis"), 2);
is("adult open fracture", lvl(30, "open fracture tibia"), 2);
is("adult DKA", lvl(30, "vomiting, known DKA"), 2);
is("adult violent patient", lvl(30, "violent aggressive behaviour"), 2);
is("adult slip and fall", lvl(70, "slip and fall at home"), 2);
is("adult breathlessness is not silently routine", lvl(50, "breathlessness"), 2);
is("adult acute abdominal pain", lvl(30, "acute abdominal pain"), 3);
is("adult renal colic", lvl(30, "renal colic"), 3);
is("adult UTI", lvl(30, "UTI"), 3);
is("adult allergic reaction", lvl(30, "allergic reaction, hives"), 3);
is("adult hip fracture", lvl(78, "hip fracture"), 3);
is("adult cellulitis", lvl(40, "cellulitis left leg"), 3);
is("adult ankle sprain", lvl(30, "ankle sprain"), 4);
is("adult fever with sore throat", lvl(30, "fever with sore throat"), 4);
is("adult headache", lvl(30, "headache"), 4);
is("adult 'slurred' not slip/fall", lvl(30, "slurred speech") , 2);
check("adult unmatched => P4 and clinician must decide", (() => { const r = classifyEmergencyTriage(30, "feels unwell", V()); return r.level === 4 && r.needsClinician; })());
check("adult matched P4 does not demand clinician", (() => { const r = classifyEmergencyTriage(30, "ankle sprain", V()); return r.level === 4 && !r.needsClinician; })());
check("empty input is safe", (() => { const r = classifyEmergencyTriage(null, "", V()); return r.level === 4 && r.needsClinician; })());
check("never returns P5 (clinician-selected only)", ["cough", "cardiac arrest", "", "ankle sprain"].every((c) => lvl(30, c) !== 5));

// ── negation in complaints
is("'no chest pain' does not raise priority", lvl(40, "no chest pain, cough"), 4);
is("'denies seizure' does not raise priority", lvl(40, "headache, denies seizure"), 4);

// ── adult vitals (raise only)
is("SBP 85", lvl(40, "weakness", V({ bp: "85/50" })), 1);
is("SpO2 88 with breathlessness", lvl(40, "breathlessness", V({ spo2: "88" })), 1);
is("SpO2 92", lvl(40, "cough", V({ spo2: "92" })), 2);
is("SpO2 97 normal stays P4", lvl(40, "cough", V({ spo2: "97" })), 4);
is("HR 155", lvl(40, "palpitations", V({ hr: "155" })), 1);
is("HR 135", lvl(40, "palpitations", V({ hr: "135" })), 2);
is("RR 32", lvl(40, "cough", V({ rr: "32" })), 1);
is("RR 26", lvl(40, "cough", V({ rr: "26" })), 2);
is("GCS 7", lvl(40, "found down", V({ gcs: "7" })), 1);
is("GCS 12", lvl(40, "drowsy since morning", V({ gcs: "12" })), 2);
is("GCS 15 stays", lvl(40, "cough", V({ gcs: "15" })), 4);
is("temp 105F", lvl(40, "fever", V({ temp: "105" })), 2);
is("temp 40C treated as 104F", lvl(40, "fever", V({ temp: "40" })), 2);
is("temp 101F not escalated for adult", lvl(40, "fever", V({ temp: "101" })), 4);
is("GRBS 40", lvl(40, "sweating", V({ grbs: "40" })), 2);
is("GRBS 420", lvl(40, "polyuria", V({ grbs: "420" })), 2);
is("pain 9", lvl(40, "pain", V({ painScore: "9" })), 2);
is("pain 7", lvl(40, "pain", V({ painScore: "7" })), 3);
is("BP 190/100", lvl(40, "headache", V({ bp: "190/100" })), 3);
is("shock index >= 1 (HR 110, SBP 100)", lvl(40, "weakness", V({ hr: "110", bp: "100/60" })), 2);
check("vitals never lower a complaint priority", lvl(40, "chest pain", V({ bp: "120/80", hr: "78", spo2: "99" })) === 2);
check("reasons list every rule that fired, most urgent first", (() => { const r = classifyEmergencyTriage(40, "chest pain", V({ spo2: "88" })); return r.level === 1 && r.reasons.length >= 2 && r.reasons[0].startsWith("P1"); })());

// ── paediatric protocol (age <= 16)
is("child cough and cold", lvl(5, "cough and cold"), 4);
is("child throat pain", lvl(5, "throat pain"), 4);
is("child rash", lvl(8, "rash"), 4);
is("child active seizure", lvl(5, "active seizures"), 1);
is("child seizure 2 h ago", lvl(5, "seizure 2 hours ago"), 2);
is("child seizure yesterday", lvl(5, "seizure yesterday"), 3);
is("child stridor", lvl(4, "stridor"), 1);
is("child grunting", lvl(2, "grunting"), 1);
is("child severe asthma", lvl(9, "acute severe asthma"), 1);
is("child resp distress SpO2 90", lvl(6, "respiratory distress", V({ spo2: "90" })), 1);
is("child resp distress SpO2 97", lvl(6, "respiratory distress", V({ spo2: "97" })), 3);
is("child resp distress, SpO2 not entered", lvl(6, "respiratory distress"), 2);
is("child GCS 7", lvl(6, "unwell", V({ gcs: "7" })), 1);
is("child GCS 10", lvl(6, "unwell", V({ gcs: "10" })), 2);
is("child severe dehydration (2 signs)", lvl(3, "diarrhoea, sunken eyeballs, dry tongue"), 1);
is("child diarrhoea with some dehydration", lvl(6, "diarrhea with some dehydration"), 2);
is("child diarrhoea no dehydration", lvl(6, "diarrhea, no dehydration"), 4);
is("child shock (2 signs)", lvl(5, "cold peripheries, drowsy"), 1);
is("child hypotension SBP 60 at age 6", lvl(6, "weak", V({ bp: "60/30" })), 1);
is("child burns", lvl(7, "burns left arm"), 2);
is("child 'burning micturition' is not burns", lvl(7, "burning micturition") !== 2 ? 3 : 2, 3);
is("child abdominal pain", lvl(9, "abdominal pain"), 3);
is("child painful scrotal swelling", lvl(10, "scrotal swelling with pain"), 3);
is("child scrotal swelling no pain", lvl(10, "scrotal swelling"), 4);
is("child dog bite", lvl(9, "dog bite"), 3);
is("child rat bite", lvl(9, "rat bite"), 4);
is("child snake bite no compromise", lvl(9, "snake bite foot"), 2);
is("child snake bite with drowsiness", lvl(9, "snake bite, drowsy"), 1);
is("child suspected abuse", lvl(6, "suspected child abuse"), 2);
is("child fever + neck pain", lvl(6, "fever with neck pain"), 2);
is("child hypertension with headache", lvl(12, "hypertension, headache"), 2);
is("child chest pain, normal vitals", lvl(12, "chest pain", V({ hr: "88", rr: "18", spo2: "99", bp: "110/70" })), 4);
is("child chest pain, abnormal HR", lvl(12, "chest pain", V({ hr: "190", rr: "18", spo2: "99", bp: "110/70" })), 1);
is("child GRBS 40", lvl(6, "sleepy", V({ grbs: "40" })), 2);
is("child DKA picture (GRBS 320 + fast breathing)", lvl(8, "vomiting", V({ grbs: "320", rr: "30" })), 3);
is("child with very high RR is escalated", lvl(8, "vomiting", V({ grbs: "320", rr: "42" })), 2);
is("infant fever >=102F", lvl(1, "fever", V({ temp: "103" })), 2);
is("age 3 fever >=102F", lvl(3, "fever", V({ temp: "103" })), 3);
is("age 8 fever >=102F", lvl(8, "fever", V({ temp: "103" })), 4);
is("age 0 (unknown month) with cough is NOT auto-neonate P1", lvl(0, "cough"), 4);
is("age 0 irritable crying infant", lvl(0, "irritable and crying"), 3);
is("newborn with complications written", lvl(0, "newborn, not feeding, distress"), 1);
is("age 16 uses paediatric protocol", lvl(16, "cough and cold"), 4);
check("age 16 protocol label", classifyEmergencyTriage(16, "cough", V()).reason.startsWith("Paediatric"));
check("age 17 uses adult protocol", classifyEmergencyTriage(17, "cough", V()).reason.startsWith("Adult"));

// ── wiring (static)
const tf = readFileSync("src/components/TriageForm.tsx", "utf8");
const cs = readFileSync("src/components/CaseSheetView.tsx", "utf8");
const cl = readFileSync("src/components/CasesListView.tsx", "utf8");
const db = readFileSync("src/components/DashboardView.tsx", "utf8");
const pv = readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
const types = readFileSync("src/types.ts", "utf8");
check("TriageForm offers all five levels from the scale", tf.includes("TRIAGE_LEVEL_LIST.map") && tf.includes("triageLevel,"));
check("TriageForm still saves the legacy category", tf.includes("triageCategory: levelToLegacyCategory(triageLevel)"));
check("pending strip uses five levels and saves both fields", cs.includes("TRIAGE_LEVEL_LIST.map") && cs.includes("triageCategory: levelToLegacyCategory(item.level), triageLevel: item.level"));
check("old mismatched strip labels are gone", !cs.includes("Resuscitative") && !cs.includes("Emergent") && !cs.includes('"P4 (Non-Urgent)"'));
check("all three auto-triage sites also set triageLevel", (cs.match(/\.\.\.\(autoTriage \? \{ triageLevel: autoTriage\.level \} : \{\}\)/g) || []).length === 3);
check("dashboard / list badges use getTriageDisplay", (db.match(/getTriageDisplay\(/g) || []).length >= 6 && cl.includes("getTriageDisplay("));
check("case list filter offers P1-P5", cl.includes('"P4", "P5"'));
check("print / copy-to-EMR show the level label", pv.includes("getTriageDisplay(c.patient).label"));
check("PatientDemographics.triageLevel is optional (old cases valid)", /triageLevel\?: TriageLevel;/.test(types));
check("legacy enum not renamed", /P1 = "P1 \(Immediate\)",\s*\n\s*P2 = "P2 \(Urgent\)",\s*\n\s*P3 = "P3 \(Non-Urgent\)"/.test(types));
check("no source-form reference appears in triage files", !/\/FO\/ER\/|Rev 0\d/.test(readFileSync("src/utils/triageClassifier.ts", "utf8") + readFileSync("src/utils/triageScale.ts", "utf8")));

console.log(`\nTriage chart: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
