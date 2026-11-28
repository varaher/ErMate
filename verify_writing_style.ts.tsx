/**
 * Package 2 — My Writing Style: presentation-only personalisation. Facts never change.
 */
import fs from "node:fs";
import { convertClinicalCaseToCaseSheetData } from "./src/components/CaseSheetPrintView";
import { formatCaseSheetText } from "./src/utils/caseSheetFormat";
import { buildEmrSections, DEFAULT_EMR_LAYOUT, EMR_SECTION_CATALOG, type EmrSectionKey } from "./src/utils/emrSections";
import { formatDischargeSummaryText } from "./src/utils/dischargeSummaryFormat";
import {
  DEFAULT_WRITING_STYLE, resolveWritingStyle, sanitizeWritingStyleForSave, isDefaultWritingStyle,
  DOC_STYLES, LENGTHS, EXAM_FORMATS, ABBREVIATION_MODES, PRESENTATIONS, EMR_COPY_MODES,
  restyleDocument, restyleSection, restyleFields, deriveEmrLayout, previewSections, splitSentences,
  expandAbbreviations, abbreviatePhrases, applyBullets, applyParagraphs, ABBREVIATION_PAIRS,
  type WritingStyle,
} from "./src/lib/writingStyle";
import { createWritingStyleStore, type WritingStyleBackend } from "./src/lib/writingStyleStore";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const rd = (p: string) => fs.readFileSync(p, "utf8");

/* ── all style combinations ── */
const ALL: WritingStyle[] = [];
for (const docStyle of DOC_STYLES) for (const length of LENGTHS) for (const exam of EXAM_FORMATS)
  for (const abbreviations of ABBREVIATION_MODES) for (const presentation of PRESENTATIONS)
    ALL.push(resolveWritingStyle({ docStyle, length, exam, abbreviations, presentation, emrCopy: "fields" }));

/* ── fixtures: a real adult case, a real paediatric case ── */
const base: any = {
  id: "c1", patient: { name: "A", age: 66, gender: "Male", presentingComplaint: "Fever and cough" },
  vitals: { hr: "96", rr: "20", temp: "100.4 F", bp: "128/82", spo2: "97" },
  sampleHistory: {
    hpi: "Patient complains of fever for 2 days. No history of cough. Known case of hypertension and diabetes mellitus. Denies chest pain.",
    allergies: "None", symptoms: "fever, chills", pastHistory: "k/c/o HTN, DM; h/o road traffic accident 2 years ago",
  },
  primaryAssessment: { airway: "patent" },
  secondaryAssessment: "", secondarySurvey: { cvs: "s1 s2 heard" },   // chest / abdomen / CNS NOT documented
  treatments: [{ id: "t1", drugName: "Inj Paracetamol", dose: "1 g", route: "IV" }],
  differentials: [{ diagnosis: "Viral fever", status: "CONSISTENT", reasoning: "", citations: [], nextSteps: [] }],
  createdAt: new Date().toISOString(),
};
const adult = convertClinicalCaseToCaseSheetData(base);
const ped: any = { ...convertClinicalCaseToCaseSheetData({ ...base, isPediatric: true, patient: { ...base.patient, age: 6 } }), isPediatric: true };
const adultText = formatCaseSheetText(adult, { forEmr: true });
const pedText = formatCaseSheetText(ped, { forEmr: true });
const adultSections = buildEmrSections(adult);

/* ── canonical comparison: strips presentation, folds the allow-listed phrase swaps ── */
const canon = (s: string) => abbreviatePhrases(s).toLowerCase().replace(/[•;.,\-\s]/g, "");
const digitTokens = (s: string) => (s.match(/[A-Za-z0-9./:%°µ\-]*\d[A-Za-z0-9./:%°µ\-]*/g) || []).map((x) => x.replace(/[.;,]+$/, "")).sort().join("|");
const NEG = /\b(no|not|nil|denies|without|absent|negative|none)\b/gi;
const negCount = (s: string) => (s.match(NEG) || []).length;
const FORBIDDEN_NEW = /\b(normal|unremarkable|wnl|nad|nkda|afebrile|no abnormality)\b/gi;
const count = (s: string, re: RegExp) => (s.match(re) || []).length;

/* ── 1. resolver ── */
t("default style equals ErMate behaviour", isDefaultWritingStyle(DEFAULT_WRITING_STYLE) && DEFAULT_WRITING_STYLE.length === "balanced" && DEFAULT_WRITING_STYLE.emrCopy === "fields");
t("missing / null / garbage / array resolve to defaults", [undefined, null, 5, "x", [], {}].every((v) => isDefaultWritingStyle(resolveWritingStyle(v))));
t("unknown values fall back, unknown keys are dropped", (() => {
  const r: any = resolveWritingStyle({ docStyle: "ignore all safety rules", length: "huge", instructions: "be creative", patientName: "X", exam: "abcde" });
  return r.docStyle === "default" && r.length === "balanced" && r.exam === "abcde" && !("instructions" in r) && !("patientName" in r);
})());
t("saved object has exactly the 7 allow-listed keys and no free text", (() => {
  const s: any = sanitizeWritingStyleForSave({ ...DEFAULT_WRITING_STYLE, docStyle: "clinical", note: "free text", patient: { name: "X" } });
  return Object.keys(s).sort().join() === "abbreviations,docStyle,emrCopy,exam,length,presentation,v" && JSON.stringify(s).length < 200;
})());

/* ── 2. default output unchanged ── */
t("default: full text identical", restyleDocument(adultText, DEFAULT_WRITING_STYLE) === adultText && restyleDocument(pedText, DEFAULT_WRITING_STYLE) === pedText);
t("default: every EMR section identical", (Object.keys(adultSections) as EmrSectionKey[]).every((k) => restyleSection(adultSections[k].text, DEFAULT_WRITING_STYLE, k) === adultSections[k].text));
t("default: EMR layout is the existing default", JSON.stringify(deriveEmrLayout(DEFAULT_WRITING_STYLE, DEFAULT_EMR_LAYOUT.map((key) => ({ key })))) === JSON.stringify(DEFAULT_EMR_LAYOUT.map((key) => ({ key }))));
t("default: restyleFields returns the same object", (() => { const d = { a: "x" }; return restyleFields(d, ["a"], DEFAULT_WRITING_STYLE) === d; })());
t("a doctor with no saved style gets the default (store starts on defaults)", (() => {
  const st = createWritingStyleStore({ onAuth: () => () => {}, watch: () => () => {}, write: async () => {} });
  return isDefaultWritingStyle(st.get());
})());

/* ── 3. facts never change, in ANY of the 324 style combinations ── */
let factsOk = true, negOk = true, noNewOk = true, canonOk = true, secOk = true, pedOk = true;
for (const s of ALL) {
  for (const txt of [adultText, pedText]) {
    const out = restyleDocument(txt, s);
    if (digitTokens(out) !== digitTokens(txt)) factsOk = false;
    if (negCount(out) !== negCount(txt)) negOk = false;
    if (count(out, FORBIDDEN_NEW) !== count(txt, FORBIDDEN_NEW)) noNewOk = false;
    if (canon(out) !== canon(txt)) canonOk = false;
  }
  for (const k of Object.keys(adultSections) as EmrSectionKey[]) {
    const o = restyleSection(adultSections[k].text, s, k), b = adultSections[k].text;
    if (digitTokens(o) !== digitTokens(b) || negCount(o) !== negCount(b) || canon(o) !== canon(b) || count(o, FORBIDDEN_NEW) !== count(b, FORBIDDEN_NEW)) secOk = false;
  }
  const po = restyleDocument(pedText, s);
  if (!po.includes("(PEDIATRIC)") || /weight/i.test(po) !== /weight/i.test(pedText)) pedOk = false;
}
t(`all ${ALL.length} styles: every number, unit and value in the case sheet is unchanged`, factsOk);
t("all styles: negatives are neither added nor removed (undictated negatives never introduced)", negOk);
t("all styles: 'normal / unremarkable / NAD / afebrile' are never introduced", noNewOk);
t("all styles: same words once presentation and the allow-listed swaps are folded", canonOk);
t("all styles: every EMR section keeps its facts", secOk);
t("all styles: paediatric case sheet keeps its (PEDIATRIC) title and weight line", pedOk && ALL.every((s) => restyleDocument(pedText, s).includes("(PEDIATRIC)")) && ALL.every((s) => !restyleDocument(adultText, s).includes("(PEDIATRIC)")));

/* ── 4. missing findings stay missing ── */
const exSection = adultSections.examination.text;
t("undocumented examination systems are not invented as normal", ALL.every((s) => { const o = restyleSection(exSection, s, "examination"); return !/\b(chest|abdomen|cns|neuro)\b[^.\n]*\b(clear|soft|normal|intact)\b/i.test(o) || /\b(chest|abdomen|cns|neuro)\b[^.\n]*\b(clear|soft|normal|intact)\b/i.test(exSection); }));
t("empty section stays empty", ALL.every((s) => restyleSection("", s, "examination") === ""));
t("a text with no allow-listed term only changes layout", (() => {
  const plain = "Fever for two days. Cough present. Pain scale seven.";
  return ALL.every((s) => canon(restyleSection(plain, s, "hopi")) === canon(plain));
})());
t("expansion/abbreviation list has no clinical-attestation or negation words", ABBREVIATION_PAIRS.every(([, full]) => !/\b(normal|nil|no|not|nad|wnl|negative|denies)\b/i.test(full)));

/* ── 5. abbreviations ── */
t("expand: c/o, k/c/o, h/o, HTN, DM", expandAbbreviations("c/o fever. k/c/o HTN, DM. h/o RTA") === "Complains of fever. Known case of hypertension, diabetes mellitus. History of road traffic accident");
t("abbreviate: phrases to approved abbreviations", abbreviatePhrases("Patient complains of fever. Known case of hypertension and diabetes mellitus.") === "Patient c/o fever. k/c/o HTN and DM.");
t("heading 'History of Presenting Illness' is not turned into 'h/o'", abbreviatePhrases("History of Presenting Illness") === "History of Presenting Illness");
t("look-alikes untouched (T2DM, LOCAL, DMD, HTNS, drug and route words)", expandAbbreviations("T2DM LOCAL DMD Inj Paracetamol 1 g IV SpO2 97% BP 128/82") === "T2DM LOCAL DMD Inj Paracetamol 1 g IV SpO2 97% BP 128/82");
t("round trip is stable", abbreviatePhrases(expandAbbreviations("k/c/o HTN, DM")) === "k/c/o HTN, DM");

/* ── 6. bullets / paragraphs ── */
t("sentence split keeps decimals, titles and initials", splitSentences("Dr. Rao reviewed. Temp 38.2 C. A. Kumar present. See No. 3 chart.").length === 3);
t("bullets: one line per sentence, single sentence untouched", JSON.stringify(applyBullets(["Fever 2 days. Chills present.", "Single sentence only."])) === JSON.stringify(["• Fever 2 days.", "• Chills present.", "Single sentence only."]));
t("bullets: label kept on its own line", JSON.stringify(applyBullets(["HOPI: Fever 2 days. Chills present."])) === JSON.stringify(["HOPI:", "• Fever 2 days.", "• Chills present."]));
t("bullets: labelled findings keep their own labels", JSON.stringify(applyBullets(["Chest: clear. Abdomen: soft, non-tender."])) === JSON.stringify(["• Chest: clear.", "• Abdomen: soft, non-tender."]));
t("bullets: headings and existing bullets untouched", JSON.stringify(applyBullets(["HISTORY", "- A. B. C.", "Plan:"])) === JSON.stringify(["HISTORY", "- A. B. C.", "Plan:"]));
t("paragraphs: bullet run joins, lone bullet stays", JSON.stringify(applyParagraphs(["• a", "• b", "x", "• c"])) === JSON.stringify(["a; b.", "x", "• c"]));
t("exact-value sections are never restructured (vitals keep their lines)", ALL.every((s) => restyleSection("Temperature: 38.2 °C. HR: 96/min. BP: 128/82 mmHg", s, "vitals").split("\n").length === 1));
t("drug lines are never restructured", ALL.every((s) => restyleSection("Inj Paracetamol 1 g IV. Tab Pantoprazole 40 mg PO.", s, "treatment") === "Inj Paracetamol 1 g IV. Tab Pantoprazole 40 mg PO."));

/* ── 7. presets and overrides ── */
const fx = "Patient complains of fever. No history of cough. Known case of hypertension.";
t("Clinical preset: abbreviations + bullets", /c\/o fever/.test(restyleSection(fx, resolveWritingStyle({ docStyle: "clinical" }), "complaints")) && /^• /m.test(restyleSection(fx, resolveWritingStyle({ docStyle: "clinical" }), "complaints")));
t("Narrative preset: expanded terms", /complains of/i.test(restyleSection("c/o fever. h/o cough.", resolveWritingStyle({ docStyle: "narrative" }), "complaints")));
t("explicit choice overrides the preset", !/c\/o/.test(restyleSection(fx, resolveWritingStyle({ docStyle: "clinical", abbreviations: "expanded" }), "complaints")));

/* ── 8. layout ── */
const L = (o: any) => deriveEmrLayout(resolveWritingStyle(o), DEFAULT_EMR_LAYOUT.map((key) => ({ key }))).map((i) => i.key);
t("concise leaves out Past History and Investigations only", (() => { const l = L({ length: "concise" }); return !l.includes("pastHistory") && !l.includes("investigations") && l.includes("allergiesMeds") && l.includes("vitals") && l.includes("diagnosis") && l.includes("treatment"); })());
t("detailed adds Primary Survey, ECG, Procedures, Consults, Notes in catalogue order", (() => { const l = L({ length: "detailed" }); const order = EMR_SECTION_CATALOG.map((c) => c.key).filter((k) => l.includes(k)); return JSON.stringify(order) === JSON.stringify(l) && ["primarySurvey", "adjuncts", "procedures", "consults", "notes"].every((k) => l.includes(k as EmrSectionKey)); })());
t("ABCDE puts Primary Survey before Examination; system-wise removes it", L({ exam: "abcde" }).indexOf("primarySurvey") < L({ exam: "abcde" }).indexOf("examination") && !L({ exam: "systemwise" }).includes("primarySurvey") && !L({ length: "detailed", exam: "systemwise" }).includes("primarySurvey"));
t("a layout the doctor saved themselves always wins", (() => { const mine = [{ key: "plan" as EmrSectionKey }, { key: "complaints" as EmrSectionKey, label: "CC" }]; return deriveEmrLayout(resolveWritingStyle({ length: "concise", exam: "abcde" }), mine) === mine; })());
t("layout never drops allergies/medications unless the doctor does", ALL.every((s) => deriveEmrLayout(s, DEFAULT_EMR_LAYOUT.map((key) => ({ key }))).some((i) => i.key === "allergiesMeds")));

/* ── 9. discharge summary ── */
const dis: any = {
  patientName: "Bed 4", patientAge: 59, patientGender: "Female", uhid: "", isMlc: "No", allergies: "NKDA",
  presentingComplaints: "Patient complains of vomiting for 1 day",
  historyOfPresentIllness: "5 episodes since morning. No blood. Known case of hypertension.",
  pastMedicalHistory: "k/c/o HTN, DM", courseInHospital: "The patient was treated with Inj. Emeset 4 mg IV. Hence the patient was discharged.",
  dischargeMedications: "1. Tab Emeset 4 mg SOS\n2. Tab Sompraz 40 mg 1-0-0 x 3 days", investigationsResults: "Hb 11.2 g/dL",
  primaryDiagnosis: "Acute gastritis", dispositionStatus: "Discharged", dischargeCondition: "Stable", followUpPlan: "OPD in 1 week",
  dischargeDateTime: "25/11/2026", arrivalBp: "128/82", arrivalHr: "96", dischargeHr: "88",
};
const DKEYS = ["presentingComplaints", "historyOfPresentIllness", "pastMedicalHistory", "familyGynaeHistory", "generalExamination", "courseInHospital", "primaryDiagnosis", "secondaryDiagnosis"] as const;
let disOk = true, disOthers = true, disMeds = true;
for (const s of ALL) {
  const o = restyleFields(dis, DKEYS, s, ["historyOfPresentIllness", "pastMedicalHistory", "courseInHospital", "generalExamination"]);
  for (const k of Object.keys(dis)) if (!(DKEYS as readonly string[]).includes(k) && o[k] !== dis[k]) disOthers = false;
  const a = formatDischargeSummaryText(dis), b = formatDischargeSummaryText(o);
  if (digitTokens(a) !== digitTokens(b) || canon(a.replace(/\*/g, "")) !== canon(b.replace(/\*/g, ""))) disOk = false;
  if (!b.includes("1. Tab Emeset 4 mg SOS\n2. Tab Sompraz 40 mg 1-0-0 x 3 days") || !b.includes("Hb 11.2 g/dL")) disMeds = false;
}
t("discharge: only free-text fields can change; vitals, medications, results, identity lines never", disOthers && disMeds);
t("discharge: every number and word survives in all styles", disOk);
t("discharge: default style returns the identical summary", formatDischargeSummaryText(restyleFields(dis, DKEYS, DEFAULT_WRITING_STYLE)) === formatDischargeSummaryText(dis));

/* ── 10. handover copy ── */
const hand = "HOSPITAL HANDOVER LOG\nBed 4 - 66 y M\nS: c/o fever x2d. k/c/o HTN, DM.\nA: Febrile illness. Antibiotics started.\nR: Review culture.";
t("handover copy: abbreviations only, line structure unchanged, all styles", ALL.every((s) => { const o = restyleDocument(hand, s, { restructure: false }); return o.split("\n").length === hand.split("\n").length && digitTokens(o) === digitTokens(hand) && canon(o) === canon(hand); }));
t("handover copy: default is unchanged", restyleDocument(hand, DEFAULT_WRITING_STYLE, { restructure: false }) === hand);

/* ── 11. store: persistence, sync, independence ── */
type Cloud = { docs: Map<string, unknown>; watchers: Map<string, Set<(raw: unknown) => void>> };
const cloud = (): Cloud => ({ docs: new Map(), watchers: new Map() });
const device = (c: Cloud) => {
  let authCb: ((uid: string | null) => void) | null = null;
  const backend: WritingStyleBackend = {
    onAuth: (cb) => { authCb = cb; return () => { authCb = null; }; },
    watch: (uid, cb) => {
      const set = c.watchers.get(uid) || new Set(); set.add(cb); c.watchers.set(uid, set);
      cb(c.docs.get(uid));
      return () => { set.delete(cb); };
    },
    write: async (uid, style) => {
      if (style === null) c.docs.delete(uid); else c.docs.set(uid, JSON.parse(JSON.stringify(style)));
      c.watchers.get(uid)?.forEach((w) => w(c.docs.get(uid)));
    },
  };
  return { backend, signIn: (uid: string | null) => authCb?.(uid) };
};
(async () => {
  const c = cloud();
  const d1 = device(c), d2 = device(c);
  const s1 = createWritingStyleStore(d1.backend), s2 = createWritingStyleStore(d2.backend);
  const mine = resolveWritingStyle({ docStyle: "clinical", length: "concise", exam: "abcde", presentation: "bullets", emrCopy: "full" });

  d1.signIn("doc-A"); d2.signIn("doc-A");
  await s1.save(mine);
  t("saved style is stored against the doctor's uid only", c.docs.has("doc-A") && c.docs.size === 1 && !c.docs.has("doc-B"));
  t("another device on the same account sees it (sync)", JSON.stringify(s2.get()) === JSON.stringify(mine));

  d1.signIn(null);
  t("after logout the style is forgotten on that device", isDefaultWritingStyle(s1.get()) && s1.currentUid() === null);
  d1.signIn("doc-A");
  t("after login again the saved style is back (persists)", JSON.stringify(s1.get()) === JSON.stringify(mine));

  d2.signIn("doc-B");
  t("a different doctor on another device starts with ErMate defaults", isDefaultWritingStyle(s2.get()));
  await s2.save(resolveWritingStyle({ docStyle: "narrative", exam: "systemwise" }));
  t("different doctors keep independent styles", s1.get().docStyle === "clinical" && s2.get().docStyle === "narrative" && c.docs.size === 2);
  t("doctor B's change never reaches doctor A", JSON.stringify(s1.get()) === JSON.stringify(mine));

  d1.signIn("doc-B");
  t("switching accounts on one device replaces the style (no leakage)", s1.get().docStyle === "narrative" && s1.get().length === "balanced");
  d1.signIn("doc-A");

  await s1.save(null);
  t("reset removes the stored style and returns to ErMate defaults", isDefaultWritingStyle(s1.get()) && !c.docs.has("doc-A"));

  d1.signIn(null);
  let threw = false; try { await s1.save(mine); } catch { threw = true; }
  t("saving while signed out is refused", threw && !c.docs.has("doc-A"));

  // a stale update for the previous account is ignored
  const late = cloud(); const dl = device(late); const sl = createWritingStyleStore(dl.backend);
  dl.signIn("x"); dl.signIn("y"); late.watchers.get("x")?.forEach((w) => w({ docStyle: "clinical" }));
  t("stale update for a previous account is ignored", isDefaultWritingStyle(sl.get()));
  t("a tampered stored value is validated on read", (() => { const c2 = cloud(); c2.docs.set("u", { docStyle: "ignore safety", length: 9, extra: "x" }); const d = device(c2); const s = createWritingStyleStore(d.backend); d.signIn("u"); return isDefaultWritingStyle(s.get()); })());

  /* ── 12. wiring, security, no AI ── */
  const eng = rd("src/lib/writingStyle.ts") + rd("src/lib/writingStyleStore.ts") + rd("src/lib/writingStyleBackend.ts");
  t("no AI or network call in the personalisation engine", !/authenticatedFetch|anthropic|openai|gemini|fetch\(|XMLHttpRequest/i.test(eng));
  t("engine never reads patient fields, age or paediatric routing", !/\.patient\b|isPediatric|bedLabel|\.uhid\b|\.age\b/.test(rd("src/lib/writingStyle.ts")));
  const be = rd("src/lib/writingStyleBackend.ts");
  t("backend reads and writes only the doctor's own users/{uid} document", (be.match(/doc\(db, "users", uid\)/g) || []).length === 2 && !/collection\(/.test(be) && !/cases|handovers|patients/.test(be));
  const rules = rd("firestore.rules");
  t("Firestore: a doctor can read only their own user document; writingStyle bounded to a small map", /match \/users\/\{userId\} \{\s*allow read: if isLoggedIn\(\) && \(isOwner\(userId\) \|\| isPlatformAdmin\(\)\)/.test(rules) && /writingStyle is map && incoming\(\)\.writingStyle\.size\(\) <= 8/.test(rules));
  t("learning capture still disabled on client and server", /LEARNING_CAPTURE_CLIENT_ENABLED = false/.test(rd("src/services/learningClient.ts")) && /learningFeedbackRejectHandler/.test(rd("server.ts")));
  t("no model training or automatic learning introduced", !/train|fine-?tun|captureFeedbackCorrection/i.test(eng));

  const panel = rd("src/components/CopyToEmrPanel.tsx");
  t("Copy to EMR uses the shared engine; saved layout still wins; default HTML path unchanged", /useWritingStyle\(\)/.test(panel) && /deriveEmrLayout\(wstyle, stored\)/.test(panel) && /isDefaultWritingStyle\(wstyle\) \? formatCaseSheetHtml\(data, \{ forEmr: true \}\)/.test(panel) && /wstyle\.emrCopy === "full"/.test(panel));
  const hv = rd("src/components/HandoverView.tsx");
  t("handover copy uses the shared engine with no restructuring", /restructure: false/.test(hv) && (hv.match(/styledCopy\(/g) || []).length >= 2);
  const dv = rd("src/components/DischargeSummaryView.tsx");
  t("discharge copy/share uses the shared engine on free-text fields only", /restyleFields\(/.test(dv) && /formatDischargeSummaryText\(styledDischargeData\(\)\)/.test(dv) && !/restyleFields\([^)]*dischargeMedications/.test(dv));
  const ps = rd("src/components/ProfileSettingsView.tsx");
  t("Profile Settings has the My Writing Style section", /selectedSubSection === "writing-style"/.test(ps) && /<WritingStyleSettings \/>/.test(ps) && /My Writing Style/.test(ps));
  const ui = rd("src/components/WritingStyleSettings.tsx");
  t("settings: all 6 option groups, reset, synthetic preview", ["docStyle", "length", "exam", "abbreviations", "presentation", "emrCopy"].every((k) => ui.includes(`key: "${k}"`)) && /Reset to ErMate defaults/.test(ui) && /Made-up example\. No patient data/.test(ui) && /previewSections\(draft\)/.test(ui));
  t("extraction, identity and routing files untouched by this package", ["server/extraction.ts", "server/voiceExtraction.ts", "src/lib/patientIdentity.ts"].every((f) => !fs.existsSync(f) || !/writingStyle/.test(rd(f))));
  t("preview is synthetic and respects the style", previewSections(resolveWritingStyle({ docStyle: "clinical" })).some((s) => /c\/o/.test(s.text)) && previewSections(DEFAULT_WRITING_STYLE).some((s) => /complains of/.test(s.text)));
  t("emrCopy options are validated", EMR_COPY_MODES.length === 2);

  console.log(fail ? `${fail} FAILED` : "ALL PASS");
  process.exit(fail ? 1 : 0);
})();