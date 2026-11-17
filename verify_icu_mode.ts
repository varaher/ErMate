/**
 * ICU Mode Phase 1 — logic verification (no network, no Firebase).
 * Run: npx tsx verify_icu_mode.ts
 */
import assert from "node:assert/strict";
import {
  applyExtraction, buildIcuEmrSections, buildIcuNoteText, carryForwardNote, deviceDay, fastHugsGapCount,
  formatObservation, gcsText, icuDayNumber, isFastHugsComplete, newNote, resolveClockTime, resolvePastClock,
  sanitizeExtraction, splitWhen,
} from "./src/icu/icuLogic";
import { buildIcuExtractionPrompt } from "./server/icuPrompt";
import { buildIcuIsbar, icuHandoverText } from "./src/icu/icuHandover";
import { buildTrends, filterWindow, parseBp, parseSingleNumber } from "./src/icu/icuTrends";
import { buildIcuDiscussRecord } from "./src/icu/icuDiscussContext";
import { isIcuPayload, buildIcuDiscussSystem } from "./server/icuDiscussPrompt";
import { readFileSync } from "node:fs";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}`); throw e; }
};

// 4:00 PM on 11 Nov 2026 local time — the time Dr Shyam's note was written.
const NOW = new Date(2026, 10, 11, 16, 0, 0);
const adm = { unitName: "MICU 1", bed: "4", admittedAt: NOW.toISOString() };

// Model output shaped like a correct extraction of Dr Shyam Jacob's sample (de-identified).
const raw = {
  problems: [
    { text: "Severe metabolic acidosis with lactic acidosis", suspected: false },
    { text: "Severe hyperkalemia with ECG changes – tall T waves and junctional bradycardia", suspected: false },
    { text: "AKI with severe azotemia", suspected: false },
    { text: "Shock requiring vasopressor support", suspected: false },
    { text: "Acute respiratory failure on invasive mechanical ventilation", suspected: false },
    { text: "Hyperglycemia with ketonemia", suspected: false },
    { text: "Recently detected type 2 diabetes mellitus", suspected: false },
  ],
  background: "Graves' disease, hypertension, TR with right heart failure",
  admissionStory: "Fatigue 1 day, breathlessness since morning, increasing lethargy. In ER: hypotension, bradycardia, severe metabolic acidosis. Intubated, started on vasopressors, shifted to MICU.",
  events: null,
  ventilation: "Invasive mechanical ventilation",
  neuro: "Sedated and paralysed",
  haemodynamic: "Noradrenaline and dopamine infusions",
  vitals: [
    { name: "HR", value: "73", unit: "/min", time: null },
    { name: "BP", value: "150/70", unit: "mmHg", time: null },
    { name: "RR", value: "30", unit: "/min", time: null },
    { name: "SpO2", value: "96", unit: "%", time: null },
    { name: "Temp", value: "afebrile", unit: null, time: null },
    { name: "GRBS", value: "352", unit: "mg/dL", time: null },
  ],
  gcs: { e: null, v: null, m: null, total: null },
  rass: null, camIcu: null,
  exam: {},
  attestedNormal: false,
  investigations: [
    { name: "Potassium", value: "7.7", unit: "mmol/L", time: null },
    { name: "Potassium", value: "8.7", unit: "mmol/L", time: null },
    { name: "Sodium", value: "122", unit: "mmol/L", time: null },
    { name: "Sodium", value: "129", unit: "mmol/L", time: null },
    { name: "Urea", value: "204", unit: "mg/dL", time: null },
    { name: "Creatinine", value: "7.58", unit: "mg/dL", time: null },
  ],
  differentials: [
    "Metformin-associated lactic acidosis", "SGLT2 inhibitor-associated ketoacidosis", "Uremic metabolic acidosis",
    "Sepsis with septic shock", "Volume depletion with renal hypoperfusion", "Cardiorenal syndrome", "Obstructive uropathy to be excluded",
  ],
  plan: {
    metabolic: ["Insulin infusion as per Scale 3", "Sodium bicarbonate infusion at 20 mL/hour"],
    haemo_resp: ["Continue noradrenaline and dopamine, MAP around 65", "CVC and arterial line insertion"],
    renal: ["Femoral haemodialysis catheter insertion", "Lasix infusion 10 mg/hour"],
    fluid_glycaemic: ["IV NS/DNS at 100 mL/hour for 4 hours"],
    infection: ["Inj. Meropenem and Inj. Teicoplanin with renal dose adjustment"],
    investigations: [], consults: ["Urgent nephrology", "Cardiology"], followup: [], other: [],
  },
  fastHugs: {
    analgesia: "Fentanyl infusion 50 mcg/hour",
    sedation: "Sedated and paralysed — agents not named",
    glucose: "Insulin infusion as per Scale 3, hourly GRBS",
    indwelling: "CVC, arterial line, femoral HD catheter, Foley ordered",
    deescalation: "Meropenem + Teicoplanin started; blood, urine cultures and procalcitonin sent",
  },
  flags: [
    { order: "IV NS/DNS at 100 mL/hour", issue: "Which fluid: NS or DNS?" },
    { order: "Meropenem and Teicoplanin with renal dose adjustment", issue: "Dose and frequency not stated" },
    { order: "Sedated and paralysed", issue: "Sedative and paralytic agents not named" },
    { order: "Inj. Human Actrapid 10 units STAT", issue: "Route not stated; note says verify" },
  ],
  tasks: [
    { what: "ABG", when: "8 PM, 12 AM and 4 AM" },
    { what: "Serum Na/K", when: "8 PM, 12 AM and 4 AM" },
    { what: "GRBS", when: "Hourly" },
    { what: "CBC, CRP, RFT, electrolytes, mini-LFT, INR, VBG, Troponin-I, ECG", when: "Tomorrow" },
  ],
  devices: [
    { type: "CVC", site: null, status: "ordered", insertedTime: null },
    { type: "Arterial line", site: null, status: "ordered", insertedTime: null },
    { type: "HD catheter", site: "Femoral", status: "ordered", insertedTime: null },
    { type: "Foley catheter", site: null, status: "ordered", insertedTime: null },
  ],
  summary: "Critically ill. Prognosis guarded.",
};

const ext = sanitizeExtraction(raw);
const base = newNote({ admissionId: "adm1", kind: "admission", authorUid: "u1", authorName: "Dr Test", now: NOW });
const note = applyExtraction(base, ext, NOW);

test("problems: 7 numbered, differentials kept out", () => {
  assert.equal(note.sections.problems.length, 7);
  for (const d of note.sections.differentials) {
    assert.ok(!note.sections.problems.some((p) => p.text === d));
  }
  assert.equal(note.sections.differentials.length, 7);
});

test("serial potassium and sodium stay separate, no invented times", () => {
  const k = note.sections.investigations.filter((i) => i.name === "Potassium");
  assert.deepEqual(k.map((x) => x.value), ["7.7", "8.7"]);
  assert.ok(note.sections.investigations.every((i) => i.time === null));
});

test("afebrile stays text; numeric temp without unit says unit not stated", () => {
  const t = note.sections.vitals.find((v) => v.name === "Temp")!;
  assert.equal(formatObservation(t), "Temp afebrile");
  assert.equal(formatObservation({ id: "x", name: "Temp", value: "101", unit: null, time: null }), "Temp 101 (unit not stated)");
  assert.equal(formatObservation({ id: "x", name: "Temp", value: "38.2", unit: "°C", time: "6 AM" }), "Temp 38.2 °C (6 AM)");
});

test("devices are ordered, not inserted, and have no day count", () => {
  assert.equal(note.devices.length, 4);
  for (const d of note.devices) {
    assert.equal(d.status, "ordered");
    assert.equal(d.insertedAt, null);
    assert.equal(deviceDay(d, NOW), null);
  }
});

test("FAST HUGS: 5 addressed, 6 not reviewed", () => {
  assert.equal(fastHugsGapCount(note.fastHugs), 6);
  for (const k of ["feeds", "thromboprophylaxis", "head_up", "ulcer_prophylaxis", "sbt", "bowel"] as const) {
    assert.equal(note.fastHugs[k].status, "not_reviewed");
  }
});

test("FAST HUGS status without details is not complete", () => {
  assert.equal(isFastHugsComplete({ status: "addressed", detail: null, reason: null }), false);
  assert.equal(isFastHugsComplete({ status: "not_applicable", detail: null, reason: "  " }), false);
  assert.equal(isFastHugsComplete({ status: "not_applicable", detail: null, reason: "Extubated" }), true);
});

test("4 clarification flags; text untouched", () => {
  assert.equal(note.flags.length, 4);
  assert.ok(note.sections.plan.fluid_glycaemic.includes("IV NS/DNS at 100 mL/hour for 4 hours"));
});

test("timed tasks: 8 PM today, 12 AM and 4 AM tomorrow", () => {
  const abg = note.tasks.filter((t) => t.what === "ABG");
  assert.equal(abg.length, 3);
  const due = abg.map((t) => new Date(t.dueAt!));
  assert.equal(due[0].getDate(), 11); assert.equal(due[0].getHours(), 20);
  assert.equal(due[1].getDate(), 12); assert.equal(due[1].getHours(), 0);
  assert.equal(due[2].getDate(), 12); assert.equal(due[2].getHours(), 4);
  const hourly = note.tasks.find((t) => t.what === "GRBS")!;
  assert.equal(hourly.dueAt, null);
  assert.equal(hourly.when, "Hourly");
});

test("clock parsing", () => {
  assert.equal(resolveClockTime("STAT", NOW), null);
  assert.equal(new Date(resolveClockTime("20:30", NOW)!).getHours(), 20);
  assert.deepEqual(splitWhen("8 PM, 12 AM and 4 AM"), ["8 PM", "12 AM", "4 AM"]);
  const past = new Date(resolvePastClock("6 PM", NOW)!); // said at 4 PM → yesterday 6 PM
  assert.equal(past.getDate(), 10);
});

test("exam untouched = Not documented; no silent normals", () => {
  const sec = buildIcuEmrSections(note, adm, NOW).find((s) => s.key === "exam")!;
  assert.ok(sec.text.includes("Respiratory: Not documented"));
  assert.ok(sec.text.includes("Neurological: Not documented"));
});

test("specific finding documents only that system", () => {
  const ex = sanitizeExtraction({ exam: { abdomen: "Soft, non-tender" } });
  const n = applyExtraction(newNote({ admissionId: "a", kind: "daily", authorUid: "u", authorName: null, now: NOW }), ex, NOW);
  assert.equal(n.sections.exam.abdomen.text, "Soft, non-tender");
  assert.equal(n.sections.exam.abdomen.source, "dictated");
  assert.equal(n.sections.exam.respiratory.status, "not_documented");
});

test("global attestation: tagged normals, named exception wins, neuro never auto-filled", () => {
  const ex = sanitizeExtraction({ attestedNormal: true, exam: { respiratory: "Coarse crepts right base" } });
  const n = applyExtraction(newNote({ admissionId: "a", kind: "daily", authorUid: "u", authorName: null, now: NOW }), ex, NOW);
  assert.equal(n.sections.exam.respiratory.text, "Coarse crepts right base");
  assert.equal(n.sections.exam.respiratory.source, "dictated");
  assert.equal(n.sections.exam.cardiovascular.source, "attested-normal");
  assert.equal(n.sections.exam.neurological.status, "not_documented");
  assert.equal(n.sections.exam.lines.status, "not_documented");
});

test("GCS: total only when dictated or all components valid", () => {
  assert.equal(gcsText({ e: 3, v: null, m: 5, vText: "T", dictatedTotal: null }), "GCS E3 VT M5 (total not calculable)");
  assert.equal(gcsText({ e: 3, v: 4, m: 6, vText: null, dictatedTotal: null }), "GCS 13 (E3 V4 M6)");
  assert.equal(gcsText({ e: null, v: null, m: null, vText: null, dictatedTotal: null }), null);
  const g = sanitizeExtraction({ gcs: { e: 9, v: "T", m: 5 } }).gcs;
  assert.equal(g.e, null); // out of range dropped
  assert.equal(g.vText, "T");
});

test("carry forward: stable items marked carried; measurements start empty", () => {
  const signed = { ...note, status: "signed" as const };
  const day2 = carryForwardNote(signed, { authorUid: "u1", authorName: "Dr Test", now: new Date(2026, 10, 12, 8) });
  assert.equal(day2.kind, "daily");
  assert.ok(day2.sections.problems.length === 7 && day2.sections.problems.every((p) => p.carried));
  assert.ok(day2.devices.every((d) => d.carried));
  assert.equal(day2.sections.vitals.length, 0);
  assert.equal(day2.tasks.length, 0);
  assert.equal(day2.flags.length, 0);
  assert.equal(fastHugsGapCount(day2.fastHugs), 11);
  const text = buildIcuNoteText(day2, adm, { name: "Dr Test" }, new Date(2026, 10, 12, 8));
  assert.ok(text.includes("[carried forward — not yet confirmed]"));
});

test("EMR text: draft header, sections, flags printed, plain text", () => {
  const text = buildIcuNoteText(note, adm, { name: "Dr Test", designation: "Consultant" }, NOW);
  assert.ok(text.startsWith("DRAFT — NOT SIGNED"));
  assert.ok(text.includes("MICU 1 · Bed 4 · ICU day 1"));
  for (const h of ["DIAGNOSIS / ACTIVE PROBLEMS", "PROGRESS", "PLAN FOR THE DAY", "FAST HUGS BID", "LINES & TUBES"]) assert.ok(text.includes(h), h);
  assert.ok(text.includes("[CLARIFY: IV NS/DNS at 100 mL/hour — Which fluid: NS or DNS?]"));
  assert.ok(text.includes("F — Feeds: Not reviewed"));
  assert.ok(text.includes("CVC — ordered, not yet inserted"));
  assert.ok(!/\*\*|#{1,3} /.test(text), "no markdown");
  const signed = buildIcuNoteText({ ...note, status: "signed" }, adm, { name: "Dr Test" }, NOW);
  assert.ok(!signed.includes("DRAFT"));
});

test("sanitiser drops junk and placeholders", () => {
  const s = sanitizeExtraction({ problems: ["N/A", { text: "Sepsis" }, null], vitals: [{ name: "HR", value: "" }], background: "null", flags: [{ order: "x" }] });
  assert.deepEqual(s.problems.map((p) => p.text), ["Sepsis"]);
  assert.equal(s.vitals.length, 0);
  assert.equal(s.background, null);
  assert.equal(s.flags.length, 0);
});

test("ICU day counter", () => {
  assert.equal(icuDayNumber(NOW.toISOString(), NOW), 1);
  assert.equal(icuDayNumber(NOW.toISOString(), new Date(2026, 10, 13, 9)), 3);
});

test("server prompt carries the safety rules", () => {
  const p = buildIcuExtractionPrompt("test", "daily");
  for (const rule of ["CURRENT vs PLANNED", "DIAGNOSIS vs DIFFERENTIAL", "SERIAL VALUES", "CLARIFICATION FLAGS", "TEMPERATURE"]) assert.ok(p.includes(rule), rule);
});

// ── ICU handover (ISBAR) ──────────────────────────────────────
const admRec: any = {
  id: "adm1", patientLabel: "Test Patient", uhid: "UH-9", ageYears: 54, sex: "F", source: "ER",
  admittedAt: NOW.toISOString(), unitName: "MICU 1", bed: "4", stays: [], status: "active",
};

test("handover: five ISBAR blocks in order, names hidden by default", () => {
  const e = buildIcuIsbar(admRec, note, { showNames: false, now: NOW });
  assert.deepEqual(e.blocks.map((b) => b.key), ["I", "S", "B", "A", "R"]);
  const text = icuHandoverText([e], { now: NOW });
  assert.ok(!text.includes("Test Patient") && !text.includes("UH-9"));
  assert.ok(buildIcuIsbar(admRec, note, { showNames: true, now: NOW }).blocks[0].text.includes("Test Patient"));
});

test("handover: recommendation carries pending tasks, flags and FAST HUGS gaps", () => {
  const r = buildIcuIsbar(admRec, note, { showNames: false, now: NOW }).blocks.find((b) => b.key === "R")!.text;
  assert.ok(r.includes("Pending tasks:") && r.includes("ABG"));
  assert.ok(r.includes("To clarify:") && r.includes("NS/DNS"));
  assert.ok(r.includes("FAST HUGS not reviewed:") && r.includes("Feeds"));
});

test("handover: ordered lines are not listed as in place", () => {
  const sit = buildIcuIsbar(admRec, note, { showNames: false, now: NOW }).blocks.find((b) => b.key === "S")!.text;
  assert.ok(!sit.includes("Lines:"));
});

test("handover: no note and old note are flagged, nothing invented", () => {
  const none = buildIcuIsbar(admRec, null, { showNames: false, now: NOW });
  assert.equal(none.noteState, "none");
  assert.equal(none.blocks.find((b) => b.key === "A")!.text, "Not documented");
  const old = buildIcuIsbar(admRec, note, { showNames: false, now: new Date(2026, 10, 13, 9) });
  assert.equal(old.noteState, "old");
  assert.ok(icuHandoverText([old], { now: new Date(2026, 10, 13, 9) }).includes("not today"));
});

test("handover: plain text, no markdown", () => {
  const t = icuHandoverText([buildIcuIsbar(admRec, note, { showNames: false, now: NOW })], { now: NOW });
  assert.ok(t.startsWith("ICU HANDOVER"));
  assert.ok(!/\*\*|#{1,3} /.test(t));
});

// ── Rounds, Discuss, Trends ─────────────────────────────────────
const trendAdm = { admittedAt: new Date(2026, 10, 9, 8).toISOString() };
const tNote = (when: Date, vitals: any[], labs: any[]) => {
  const n: any = newNote({ admissionId: "a1", kind: "daily", authorUid: "u", authorName: "Dr Real Name", now: when });
  n.status = "signed";
  n.signedAt = when.toISOString();
  n.sections.vitals = vitals;
  n.sections.investigations = labs;
  return n;
};
const tn1 = tNote(new Date(2026, 10, 9, 10),
  [{ id: "v1", name: "BP", value: "90/60", unit: null, time: "9 AM" }, { id: "v2", name: "Temp", value: "101", unit: null, time: null }],
  [{ id: "l1", name: "K", value: "8.7", unit: "mmol/L", time: "6 AM" }]);
const tn2 = tNote(new Date(2026, 10, 11, 10),
  [{ id: "v3", name: "SpO2", value: "98% on 4L O2", unit: null, time: null }],
  [{ id: "l2", name: "Potassium", value: "5.1", unit: "mmol/L", time: "4 AM" }, { id: "l3", name: "Lactate", value: "3.8 → 2.1", unit: null, time: null }]);
const TNOW = new Date(2026, 10, 11, 12);
const bundle = buildTrends(trendAdm, [tn1, tn2], TNOW);

test("trends: K and Potassium are one line, broken across the gap (no interpolation)", () => {
  const k = bundle.series.find((x) => x.key === "lab:potassium")!;
  assert.equal(k.count, 2);
  assert.ok(k.points.some((p) => p.v === null), "gap > 12 h must insert a null break");
  assert.equal(k.latest!.v, 5.1);
});

test("trends: ambiguous values are skipped, never guessed", () => {
  assert.equal(parseSingleNumber("3.8 → 2.1"), null);
  assert.equal(parseSingleNumber("98% on 4L O2"), null);
  assert.ok(!bundle.series.some((x) => x.key === "lab:lactate"));
  assert.ok(!bundle.series.some((x) => x.key === "vital:SpO2"));
});

test("trends: BP split, temperature unit never assumed, missing time flagged approx", () => {
  assert.deepEqual(parseBp("90/60"), { sys: 90, dia: 60 });
  assert.equal(parseBp("60/90"), null);
  assert.ok(bundle.series.some((x) => x.key === "vital:SBP") && bundle.series.some((x) => x.key === "vital:DBP"));
  const temp = bundle.series.find((x) => x.key.startsWith("vital:Temp"))!;
  assert.equal(temp.label, "Temp (unit not stated)");
  assert.equal(temp.latest!.approx, true);
});

test("trends: 24 h window drops older readings", () => {
  const w = filterWindow(bundle, "24h", TNOW);
  assert.ok(!w.series.some((x) => x.key === "vital:SBP"));
  assert.equal(w.series.find((x) => x.key === "lab:potassium")!.count, 1);
});

test("discuss record: no patient name, UHID, doctor name or calendar date", () => {
  const admFull: any = {
    id: "a1", patientLabel: "Ramesh Kumar", uhid: "UH778899", ageYears: 55, sex: "M", source: "ER",
    admittedAt: trendAdm.admittedAt, status: "active", outcome: null, outcomeAt: null,
    unitId: "u1", unitName: "MICU 1", unitType: "MICU", bed: "4",
    stays: [{ unitId: "u1", unitName: "MICU 1", bed: "4", inAt: trendAdm.admittedAt, outAt: null }],
  };
  const r = buildIcuDiscussRecord(admFull, [tn1, tn2], TNOW);
  assert.ok(!/Ramesh|UH778899|Real Name|2026/.test(r.text));
  assert.ok(r.text.includes("ICU day 3"));
  assert.equal(r.noteCount, 2);
});

test("server prompt: ICU record de-identified again, no [UPDATE] edits allowed", () => {
  assert.equal(isIcuPayload({ icuRecord: "x" }), true);
  assert.equal(isIcuPayload({ patient: {} }), false);
  const sys = buildIcuDiscussSystem({ icuRecord: "Patient: 55 years\\nCall 9876543210" });
  assert.ok(!sys.includes("9876543210"));
  assert.ok(sys.includes("Do NOT output any [UPDATE: ...] block"));
});

test("chat hook: ICU chats can never write to the note", () => {
  const hook = readFileSync("src/hooks/useBoundChat.ts", "utf8");
  assert.ok(hook.includes("if (context.type === 'icu') { setPendingUpdates(null); return; }"));
});

console.log(`\nICU mode: ${passed} checks passed`);