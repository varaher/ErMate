import fs from "fs";
import { hasExplicitBedLabel, shouldHoldPastedSheet, classifyPendingSheetReply } from "./src/mate/mateNewCaseIntent";
import { resolveMateCaseReference } from "./src/mate/mateCaseResolver";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const sheet = `Mrs. TEST PATIENT\nAge/Sex: 54/F\nChief complaints: chest pain since 2 hours\nHistory of present illness: ${"pain radiating to left arm. ".repeat(12)}\nPast history: DM, HTN\nVitals: BP 150/90 HR 98 SpO2 97% RR 18 Temp 98.6\nExamination: CVS S1 S2 normal\nInvestigations: ECG ST depression, Trop pending, Vit B12 normal\nTreatment: Aspirin 300 mg, nitroglycerin\nPlan: admit, cardiology opinion\nFinal diagnosis: NSTEMI\n`;
t("fixture is a full sheet", sheet.length >= 500);
t("held: sheet with no bed and no patient open", shouldHoldPastedSheet({ text: sheet, hasOpenPatient: false }));
t("not held when a patient is open", !shouldHoldPastedSheet({ text: sheet, hasOpenPatient: true }));
t("'Vit B12' / '2a' do not count as a bed", !hasExplicitBedLabel("Vit B12 given, 2a done, grade 2"));
t("not held when the sheet states its own bed", !shouldHoldPastedSheet({ text: sheet + "Bed No: 9\n", hasOpenPatient: false }));
t("short dictation is never held", !shouldHoldPastedSheet({ text: "BP 90/60 HR 110", hasOpenPatient: false }));
t("explicit labels", hasExplicitBedLabel("Bed no 9") && hasExplicitBedLabel("bed: 12B") && hasExplicitBedLabel("BED #4"));

const bed = (s: string) => { const r = classifyPendingSheetReply(s); return r.kind === "bed" ? r.bed : r.kind; };
for (const [s, e] of [["9", "9"], ["Bed 9", "9"], ["bed no 9", "9"], ["bed number 12", "12"], ["9A", "9A"], ["9 b", "9B"], ["in bed 9", "9"], ["put her in bed 9", "9"], ["it's bed 4", "4"], ["Bed 9.", "9"], ["bed 9 please", "9"], ["cancel", "cancel"], ["Discard", "cancel"]] as const)
  t(`reply "${s}" -> ${e}`, bed(s) === e);
for (const s of ["what is the dose of aspirin", "summarise bed 9", "show bed 9 vitals", "new patient bed 9", "BP 120/80", "do I have a patient in bed 9?", "hello", "patient in bed 9 has chest pain"])
  t(`reply "${s}" -> other`, bed(s) === "other");

// Placement uses the existing A/B family rules.
const mk = (id: string, bedNo: string) => ({ id, bedNo, patient: { name: "X" } } as any);
const d = (cases: any[], b: string) => resolveMateCaseReference({ utterance: `Bed ${b}`, cases, activeCaseId: null, physicalCapacity: 30, newCaseIntent: true });
t("empty bed 9 -> NOT_FOUND slot 9A", d([], "9").status === "NOT_FOUND" && d([], "9").referenceValue === "9A");
t("9A occupied -> NOT_FOUND slot 9B (notice is posted by startNewCaseInBed)", d([mk("a", "9A")], "9").referenceValue === "9B");
t("9A and 9B occupied -> AMBIGUOUS (refused, sheet stays held)", d([mk("a", "9A"), mk("b", "9B")], "9").status === "AMBIGUOUS");
t("bed 99 -> INVALID_LOCATION", d([], "99").status === "INVALID_LOCATION");

const src = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
const at = (x: string) => src.indexOf(x);
t("pending ref declared", /pendingPastedSheetRef = useRef</.test(src));
t("hold/stale-drop runs before the fast path", at("end a stale or abandoned hold") > 0 && at("end a stale or abandoned hold") < at("const fastPathResult = pendingPastedSheetRef.current ? null"));
t("fast path skipped while a sheet is held", /const fastPathResult = pendingPastedSheetRef\.current \? null : tryDeterministicFastPath/.test(src));
t("hold + bed reply handled after startNewCaseInBed is defined", at("const heldSheet = pendingPastedSheetRef.current") > at("const startNewCaseInBed"));
t("hold happens before explicit new-patient intake", at("shouldHoldPastedSheet({") < at("// Check for explicit new-patient intake"));
t("replay reuses the existing handoff with the held text", /startNewCaseInBed\(dest\.referenceValue \|\| reply\.bed, reply\.bed, false, heldSheet\.text\)/.test(src));
t("startNewCaseInBed reports success", /Promise<boolean>/.test(src) && /if \(!started\) pendingPastedSheetRef\.current = heldSheet/.test(src));
t("replay still skips MATE resolution (no re-hold loop)", /sendToChat\(pendingNew\.utterance, \{ skipMatePatientResolution: true \}\)/.test(src));
t("hold expires (15 min) and drops on other messages", /15 \* 60 \* 1000/.test(src) && /I dropped the case sheet that was waiting for a bed/.test(src));
t("held text is not shown twice (placeholder bubble)", /Case sheet pasted \(\$\{trimmed\.length\} characters\)/.test(src));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
