/**
 * src/utils/erCaseRecord.ts
 *
 * Adult ER case sheet in the hospital's own EMR format (Neeraj, 21 Nov 2026: "this is the same
 * format I need, follow this for ER cases, no deviation"). Source: the hospital EMR's
 * "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD" (Visit Notes).
 *
 * ONE builder feeds the printed sheet, "Copy case sheet" and "Copy to EMR", so they always match.
 *
 * Section order (fixed, always printed — "Not documented." when empty):
 *   Title · Case Seen By · Presenting Complaint · Primary Assessment (Airway/Breathing/Circulation/
 *   Disability/Exposure →) · Adjuvants to Primary (ECG, VBG/ABG, Bedside Screening Echo) ·
 *   History of Present Illness · Secondary Survey: Signs and Symptoms · Past Medical History ·
 *   Surgical History · Family / Gynae History · Allergies · General Examination ·
 *   Systemic Examination (CVS, CHEST, Abdomen, CNS, Extremities and Back) · Psychological Assessment ·
 *   Investigations · Treatment Plan · Disposition · Differential Diagnosis · EM Resident · EM Consultant
 *
 * Data the hospital format has no place for is never dropped: it prints only when it was recorded,
 * under its own heading, next to the closest section (weight, triage/isolation, MLC, eFAST,
 * current medications, last meal, procedures, consultant review, provisional diagnosis,
 * patient-safety checks, progress notes/addendum).
 *
 * Rule 8: nothing is invented. No default normal findings; missing → "Not documented."
 */
import type { CaseSheetData } from "../components/CaseSheetPrintView";
import { screeningLines, isolationBanner } from "./triageScreening";
import { displayGcs, displayTemperature, displayGrbs, displayDocumentedBoolean } from "./clinicalFormatter";

export const ER_RECORD_TITLE = "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD";
const ND = "Not documented.";

/**
 * Where an editable line writes back (edit in the preview): s = section title and k = field key of
 * src/lib/previewedit.ts (EDIT_SECTIONS). Lines without it are read-only in the preview.
 * ph = the line is only the "Not documented." placeholder of an empty field.
 */
export interface ErEdit { s: string; k: string; ph?: boolean }
/** A piece of a composed line (e.g. Breathing → vitals + findings): only pieces with `edit` can be typed in. */
export interface ErSeg { text: string; edit?: ErEdit; hint?: string }

export type ErLine =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }          // "Presenting Complaint:"
  | { kind: "subheading"; text: string }       // "ECG:", "CVS:" (inside a section)
  | { kind: "item"; text: string; edit?: ErEdit }   // indented line
  | { kind: "dash"; text: string; edit?: ErEdit }   // "- No known allergies."
  | { kind: "para"; text: string; edit?: ErEdit }   // paragraph (History of Present Illness)
  | { kind: "labelled"; label: string; text: string; arrow?: boolean; segs?: ErSeg[] }; // "Case Seen By: …", "Airway → …"

// ── text helpers ─────────────────────────────────────────────────────────────

const clean = (v: unknown): string => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
const has = (v: unknown): boolean => clean(v).length > 0;

/** First letter upper-case (leaves abbreviations such as "pH" or "eFAST" alone). */
function capFirst(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/^[a-z][A-Z]/.test(t)) return t; // pH, eFAST, mmHg…
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Ends a sentence with a full stop unless it already ends with punctuation. */
function sentence(s: string): string {
  const t = capFirst(s.replace(/[\s,;]+$/, ""));
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

const ABBREV = /\b(?:Dr|Inj|Tab|Cap|Syp|Syr|No|Mr|Mrs|Ms|St|vs|approx|Neb|Susp|Oint|Hon|Sr|Jr|Prof|Pt|Ref|Fig)\.$/i;

/** Splits dictated text into lines: new lines, semicolons, bullets and real sentence ends. */
export function splitSentences(text: unknown): string[] {
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  const out: string[] = [];
  for (const chunk of raw.split(/\n|;|•/)) {
    let rest = chunk.replace(/^\s*[-*]\s+/, "").trim();
    if (!rest) continue;
    // Sentence ends: ". " followed by a capital letter, not after an abbreviation or inside a number.
    let start = 0;
    for (let i = 0; i < rest.length - 2; i++) {
      if (rest[i] === "." && rest[i + 1] === " " && /[A-Z]/.test(rest[i + 2])) {
        const before = rest.slice(start, i + 1);
        if (!ABBREV.test(before)) {
          out.push(before.trim());
          start = i + 2;
        }
      }
    }
    const tail = rest.slice(start).trim();
    if (tail) out.push(tail);
  }
  return out.filter(Boolean);
}

/** Splits a list of tests/items ("CBC, CRP, RFT") into one per line. */
function splitList(text: unknown): string[] {
  return String(text ?? "")
    .split(/[,;\n•]+/)
    .map((s) => s.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
}

function drName(raw: unknown): string {
  const n = clean(raw).replace(/^dr\.?\s*/i, "");
  return n ? `Dr. ${n}` : "";
}

/** "08:40" / "8.40 am" / "20:05" → "8:40 AM" / "8:05 PM". Anything else is shown as written. */
function clockTime(raw: unknown): string {
  const t = clean(raw);
  if (!t) return "";
  const m = t.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?$/i);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  let ap = (m[3] || "").toUpperCase();
  if (!ap) ap = h >= 12 ? "P" : "A";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${min} ${ap}M`;
}

// ── vitals in the hospital's wording ─────────────────────────────────────────

function withUnit(raw: unknown, unit: string, alreadyHas: RegExp): string {
  const s = clean(raw);
  if (!s) return "";
  return alreadyHas.test(s) ? s : `${s}${unit}`;
}

function spo2Text(raw: unknown): string {
  const s = clean(raw);
  if (!s) return "";
  if (s.includes("%")) return s;
  return /^\d+(\.\d+)?/.test(s) ? s.replace(/^(\d+(?:\.\d+)?)\s*/, "$1% ").trim() : s;
}

/** "15/15 — E4 V5 M6" → "E4 V5 M6 (15/15)". Never calculates a total (GCS policy). */
function gcsText(vc: NonNullable<CaseSheetData["primarySurvey"]["vitalsContext"]>): string {
  const shown = clean(vc.gcsComponents) || (has(vc.gcs) ? displayGcs(vc.gcs as any) : "");
  if (!shown || /^not documented$/i.test(shown)) return "";
  const m = shown.match(/^(\d+\/15)\s+—\s+(.+)$/);
  return m ? `${m[2]} (${m[1]})` : shown;
}

/** Pulls a "CRT …" clause out of circulation findings so it can lead the line, as in the hospital format. */
function takeCrt(findings: string): { crt: string; rest: string } {
  const re = /\b(?:CRT|capillary refill(?: time)?)\b\s*:?\s*((?:[^,;.]|\.(?=\d))*)/i;
  const m = findings.match(re);
  if (!m) return { crt: "", rest: findings };
  const crt = `CRT: ${m[1].trim()}`.replace(/:\s*$/, "");
  const rest = findings.replace(m[0], "").replace(/^[\s,;.]+/, "").replace(/\s*,\s*,/g, ",").replace(/[\s,;]+$/, "").trim();
  return { crt, rest };
}

/** "Bilateral air entry present" after a comma reads as a continuation: lower-case only plain words. */
function continuation(s: string): string {
  const t = s.trim();
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function joinVitalsAndFindings(vitals: string[], findings: string): string {
  const v = vitals.filter(Boolean).join(", ");
  const f = clean(findings);
  if (v && f) return `${sentence(v)} ${sentence(f)}`;
  if (v) return sentence(v);
  if (f) return sentence(f);
  return ND;
}

const VBG_UNITS: Record<string, string> = {
  pco2: "mmHg", po2: "mmHg", hco3: "mmol/L", be: "mmol/L", lactate: "mmol/L",
  na: "mmol/L", k: "mmol/L", cl: "mmol/L", ag: "mmol/L",
};
const VBG_NAMES: Record<string, string> = { na: "Sodium", k: "Potassium", cl: "Chloride", ag: "Anion gap" };

// ── builder ──────────────────────────────────────────────────────────────────

/**
 * opts.editing (preview Edit mode only, 24 Nov 2026 — Neeraj: "edit all the fields, the things which are not
 * documented also"): every field gets its own editable line, with an editable "Not documented." placeholder
 * when empty, including sections that otherwise print only when recorded. Print, Copy to EMR and EMR fields
 * never pass it, so their output is unchanged.
 */
export function buildErCaseRecord(data: CaseSheetData, opts: { editing?: boolean } = {}): ErLine[] {
  const E = Boolean(opts.editing);
  const L: ErLine[] = [];
  const heading = (text: string) => L.push({ kind: "heading", text });
  const sub = (text: string) => L.push({ kind: "subheading", text });
  /** edit = every line writes to that field; an empty list prints the placeholder, which is editable too. */
  const items = (lines: string[], opts: { period?: boolean; edit?: Omit<ErEdit, "ph"> } = {}) => {
    const period = opts.period !== false;
    if (!lines.length) { L.push({ kind: "item", text: ND, ...(opts.edit ? { edit: { ...opts.edit, ph: true } } : {}) }); return; }
    lines.forEach((l) => L.push({ kind: "item", text: period ? sentence(l) : capFirst(l), ...(opts.edit ? { edit: opts.edit } : {}) }));
  };
  const dashes = (lines: string[], opts: { edit?: Omit<ErEdit, "ph"> } = {}) => {
    if (!lines.length) { L.push({ kind: "dash", text: ND, ...(opts.edit ? { edit: { ...opts.edit, ph: true } } : {}) }); return; }
    lines.forEach((l) => L.push({ kind: "dash", text: sentence(l), ...(opts.edit ? { edit: opts.edit } : {}) }));
  };
  /** Pieces of a composed line, in order. Returns undefined (line stays read-only) when a piece can't be located in the text. */
  const carve = (full: string, parts: { text: string; edit: ErEdit; hint?: string }[]): ErSeg[] | undefined => {
    const segs: ErSeg[] = [];
    let cur = 0;
    const lower = full.toLowerCase();
    for (const p of parts) {
      if (!p.text) { segs.push({ text: "", edit: p.edit, hint: p.hint }); continue; }
      const i = lower.indexOf(p.text.toLowerCase(), cur);
      if (i < 0) return undefined;
      if (i > cur) segs.push({ text: full.slice(cur, i) });
      segs.push({ text: full.slice(i, i + p.text.length), edit: p.edit, hint: p.hint });
      cur = i + p.text.length;
    }
    if (cur < full.length) segs.push({ text: full.slice(cur) });
    return segs;
  };
  const PRIM = "Primary Survey", HIST = "History", SURV = "Secondary Survey";

  // Title + Case Seen By
  L.push({ kind: "title", text: ER_RECORD_TITLE });
  const doctor = drName(data.clinician);
  const time = clockTime(data.arrival?.time);
  L.push({
    kind: "labelled",
    label: "Case Seen By",
    text: doctor ? `${doctor}${time ? ` at ${time}` : ""}.` : ND,
  });

  // (only when recorded) weight, triage & isolation, MLC
  if (has(data.patient?.weight)) L.push({ kind: "labelled", label: "Weight", text: `${clean(data.patient.weight)} kg.` });
  const triageLines = screeningLines(data.triageScreening);
  const banner = isolationBanner(data.triageScreening);
  if (has(data.triageCategory) || triageLines.length || banner) {
    heading("Triage:");
    const t: string[] = [];
    if (has(data.triageCategory)) t.push(`Triage category: ${clean(data.triageCategory)}`);
    if (banner) t.push(banner.toUpperCase());
    items([...t, ...triageLines]);
  }
  if (data.isMlc || data.mlcDetails) {
    const m = data.mlcDetails;
    heading("Medico-Legal Case (MLC):");
    items([
      `Nature of incident: ${clean(m?.natureOfIncident) || "Not documented"}`,
      `Date & time of incident: ${clean(m?.dateTimeOfIncident) || "Not documented"}`,
      `Place of incident: ${clean(m?.placeOfIncident) || "Not documented"}`,
      `Identification mark: ${clean(m?.identificationMark) || "Not documented"}`,
      `Brought by / informant: ${clean(m?.informantBroughtBy) || "Not documented"}`,
      ...(has(m?.policeStation) ? [`Police station: ${clean(m?.policeStation)}`] : []),
    ]);
  }

  // Presenting Complaint
  heading("Presenting Complaint:");
  items(splitSentences(data.presentingComplaint), { edit: { s: "Presenting Complaint", k: "cc" } });

  // Primary Assessment
  const ps = data.primarySurvey || ({} as CaseSheetData["primarySurvey"]);
  const vc = ps.vitalsContext || {};
  heading("Primary Assessment:");
  /** A Primary Assessment line: `findings` (the doctor's own words for this letter) can be typed in; vitals are shown but fixed. */
  const primaryLine = (label: string, key: string, text: string, findingsShown: string, hasVitals: boolean) => {
    const edit: ErEdit = { s: PRIM, k: key };
    let segs: ErSeg[] | undefined;
    if (text === ND) segs = [{ text: "", edit: { ...edit, ph: true }, hint: ND }];
    // Only vitals are shown: they stay fixed text, with an empty piece after them to type the findings into.
    else if (!findingsShown) segs = hasVitals ? [{ text }, { text: "", edit, hint: "Add findings" }] : undefined;
    else segs = carve(text, [{ text: findingsShown, edit, hint: "Add findings" }]);
    L.push({ kind: "labelled", arrow: true, label, text, ...(segs ? { segs } : {}) });
  };
  primaryLine("Airway", "airway", has(ps.airway) ? sentence(clean(ps.airway)) : ND, has(ps.airway) ? sentence(clean(ps.airway)) : "", false);
  {
    const vit = [
      has(vc.rr) ? `RR: ${withUnit(vc.rr, "/min", /\/\s*min|per\s*min|bpm/i)}` : "",
      has(vc.spo2) ? `SpO2: ${spo2Text(vc.spo2)}` : "",
    ];
    const f = clean(ps.breathing);
    primaryLine("Breathing", "breathing", joinVitalsAndFindings(vit, f), f ? sentence(f) : "", vit.some(Boolean));
  }
  const circ = takeCrt(clean(ps.circulation));
  {
    const vit = [
      circ.crt,
      has(vc.hr) ? `HR: ${withUnit(vc.hr, "/min", /\/\s*min|bpm|per\s*min/i)}` : "",
      has(vc.bp) ? `BP: ${withUnit(vc.bp, " mmHg", /mm\s*hg/i)}` : "",
    ];
    const text = joinVitalsAndFindings(vit, circ.rest);
    const edit: ErEdit = { s: PRIM, k: "circulation" };
    let segs: ErSeg[] | undefined;
    if (text === ND) segs = [{ text: "", edit: { ...edit, ph: true }, hint: ND }];
    // CRT and the other findings are two typeable pieces of ONE field; the writer joins them back with ", ".
    else {
      segs = carve(text, [
        ...(circ.crt ? [{ text: circ.crt, edit, hint: "CRT" }] : []),
        ...(circ.rest ? [{ text: sentence(circ.rest), edit, hint: "Add findings" }] : []),
      ]);
      if (segs && !circ.rest) segs.push({ text: "", edit, hint: "Add findings" });
    }
    L.push({ kind: "labelled", arrow: true, label: "Circulation", text, ...(segs ? { segs } : {}) });
  }
  {
    const gcs = gcsText(vc);
    const dis = clean(ps.disability);
    const grbs = has(vc.grbs) ? `GRBS: ${displayGrbs(vc.grbs)}` : "";
    const head = [gcs ? `GCS: ${gcs}` : "", dis ? (gcs ? continuation(dis) : dis) : ""].filter(Boolean).join(", ");
    const text = [head ? sentence(head) : "", grbs ? sentence(grbs) : ""].filter(Boolean).join(" ");
    const shown = dis ? (gcs ? continuation(dis) : dis) : "";
    primaryLine("Disability", "disability", text || ND, shown, Boolean(gcs || grbs));
  }
  {
    const vit = [has(vc.temp) ? `Temperature: ${displayTemperature(vc.temp)}` : ""];
    const f = clean(ps.exposure);
    primaryLine("Exposure", "exposure", joinVitalsAndFindings(vit, f), f ? sentence(f) : "", vit.some(Boolean));
  }

  // Adjuvants to Primary
  heading("Adjuvants to Primary:");
  const ADJ = "Adjuvants to Primary";
  if (E) {
    sub("ECG:");
    dashes(splitSentences(data.ecg?.findings), { edit: { s: ADJ, k: "ecg" } });
    const g = data.vbgAbg;
    sub(`${g?.type || "VBG / ABG"}:`);
    const gv = (g?.values || []).filter((x) => x.value !== null && x.value !== undefined).map((x) => {
      const key = String(x.param || x.name || "").toLowerCase();
      const unit = VBG_UNITS[key];
      return `${VBG_NAMES[key] || x.name}: ${x.value}${unit ? ` ${unit}` : ""}`;
    });
    gv.forEach((v) => L.push({ kind: "item", text: capFirst(v) }));
    if (gv.length) sub("Interpretation:");
    items(splitSentences(g?.notes), { edit: { s: ADJ, k: "gas" } });
    sub("Bedside Screening Echo:");
    items(splitSentences(data.bedsideEcho?.findings), { edit: { s: ADJ, k: "echo" } });
    sub("eFAST:");
    items(splitSentences(data.efast?.findings), { edit: { s: ADJ, k: "efast" } });
  }
  let anyAdjunct = E;
  if (!E && (data.ecg?.performed || has(data.ecg?.findings))) {
    anyAdjunct = true;
    sub("ECG:");
    dashes(has(data.ecg?.findings) ? splitSentences(data.ecg.findings) : ["Done, findings not documented"]);
  }
  const gas = data.vbgAbg;
  if (!E && gas?.performed && ((gas.values || []).length || has(gas.notes))) {
    anyAdjunct = true;
    sub(`${gas.type || "VBG"}:`);
    const vals = (gas.values || [])
      .filter((x) => x.value !== null && x.value !== undefined)
      .map((x) => {
        const key = String(x.param || x.name || "").toLowerCase();
        const name = VBG_NAMES[key] || x.name;
        const unit = VBG_UNITS[key];
        return `${name}: ${x.value}${unit ? ` ${unit}` : ""}`;
      });
    items(vals, { period: false });
    if (has(gas.notes)) L.push({ kind: "item", text: sentence(`Interpretation: ${clean(gas.notes)}`) });
  }
  if (!E && (data.bedsideEcho?.performed || has(data.bedsideEcho?.findings))) {
    anyAdjunct = true;
    sub("Bedside Screening Echo:");
    items(has(data.bedsideEcho?.findings) ? splitSentences(data.bedsideEcho.findings) : ["Done, findings not documented"]);
  }
  if (!E && (data.efast?.performed || has(data.efast?.findings))) {
    anyAdjunct = true;
    sub("eFAST:");
    items(has(data.efast?.findings) ? splitSentences(data.efast.findings) : ["Done, findings not documented"]);
  }
  if (!anyAdjunct) L.push({ kind: "item", text: ND });

  // History of Present Illness
  heading("History of Present Illness:");
  {
    const hpi = clean(data.hpi);
    const events = clean(data.events);
    const evShown = events && events.toLowerCase() !== hpi.toLowerCase() && !hpi.toLowerCase().includes(events.toLowerCase()) ? events : "";
    if (hpi) L.push({ kind: "para", text: sentence(hpi), edit: { s: HIST, k: "hpi" } });
    if (evShown) L.push({ kind: "para", text: sentence(evShown), edit: { s: HIST, k: "events" } });
    if (!hpi && !evShown) L.push({ kind: "para", text: ND, edit: { s: HIST, k: "hpi", ph: true } });
    if (E && !events) { sub("Events preceding:"); L.push({ kind: "para", text: ND, edit: { s: HIST, k: "events", ph: true } }); }
  }

  // Secondary Survey
  heading("Secondary Survey:");
  heading("Signs and Symptoms:");
  items((data.symptoms || []).flatMap(splitSentences), { edit: { s: HIST, k: "symptoms" } });
  heading("Past Medical History:");
  items((data.pastHistory || []).flatMap(splitSentences), { edit: { s: HIST, k: "pastHistory" } });
  if (E || (data.currentMedications || []).some(has)) {
    heading("Current Medications:");
    items((data.currentMedications || []).flatMap(splitSentences), { edit: { s: HIST, k: "medications" } });
  }
  heading("Surgical History:");
  dashes(splitSentences(data.surgicalHistory), { edit: { s: HIST, k: "surgicalHistory" } });
  heading("Family / Gynae History:");
  {
    const fam = splitSentences(data.familyHistory);
    if (E) {
      dashes(fam, { edit: { s: HIST, k: "familyHistory" } });
      sub("LMP:");
      dashes(has(data.lmp) ? [clean(data.lmp)] : [], { edit: { s: HIST, k: "lmp" } });
    } else if (!fam.length && !has(data.lmp)) dashes([], { edit: { s: HIST, k: "familyHistory" } });
    else {
      if (fam.length) dashes(fam, { edit: { s: HIST, k: "familyHistory" } });
      if (has(data.lmp)) L.push({ kind: "dash", text: sentence(`LMP: ${clean(data.lmp)}`) });
    }
  }
  if (E || has(data.socialHistory)) {
    heading("Social History:");
    dashes(splitSentences(data.socialHistory), { edit: { s: HIST, k: "socialHistory" } });
  }
  heading("Allergies:");
  dashes((data.allergies || []).flatMap(splitSentences), { edit: { s: HIST, k: "allergies" } });
  if (E || has(data.lastMeal)) {
    heading("Last Meal:");
    dashes(has(data.lastMeal) ? [clean(data.lastMeal)] : [], { edit: { s: HIST, k: "lastMeal" } });
  }

  // Examination
  const ss = data.secondarySurvey || ({} as CaseSheetData["secondarySurvey"]);
  heading("General Examination:");
  items(splitSentences(ss.general), { edit: { s: SURV, k: "general" } });
  heading("Systemic Examination:");
  sub("CVS:");
  dashes(splitSentences(ss.cvs), { edit: { s: SURV, k: "cvs" } });
  sub("CHEST:");
  items(splitSentences(ss.respiratory), { edit: { s: SURV, k: "respiratory" } });
  sub("Abdomen:");
  items(splitSentences(ss.abdomen), { edit: { s: SURV, k: "abdomen" } });
  sub("CNS:");
  items(splitSentences(ss.cns), { edit: { s: SURV, k: "cns" } });
  sub("Extremities and Back:");
  dashes(splitSentences(ss.extremities), { edit: { s: SURV, k: "extremities" } });

  // Psychological Assessment
  heading("Psychological Assessment:");
  {
    const pa = data.psychologicalAssessment;
    const lines: string[] = [];
    const PSY = { s: "Psychological Assessment", k: "psych" };
    const noteLines = pa ? splitSentences(pa.notes) : [];
    if (pa) {
      lines.push(...noteLines);
      const flags: [string, boolean | null | undefined][] = [
        ["Suicidal ideation", pa.suicidalIdeation],
        ["Self-harm history", pa.selfHarmHistory],
        ["Intent to harm others", pa.intentToHarmOthers],
        ["Substance use", pa.substanceAbuse],
        ["Psychiatric history", pa.psychiatricHistory],
        ["Currently on psychiatric treatment", pa.currentlyOnPsychiatricTreatment],
        ["Support system", pa.hasSupportSystem],
      ];
      flags.forEach(([label, v]) => { if (v === true || v === false) lines.push(`${label}: ${displayDocumentedBoolean(v)}`); });
    }
    if (!lines.length) items([], { edit: PSY });
    else {
      if (E && !noteLines.length) items([], { edit: PSY });
      noteLines.forEach((l) => L.push({ kind: "item", text: sentence(l), edit: PSY }));
      lines.slice(noteLines.length).forEach((l) => L.push({ kind: "item", text: sentence(l) }));
    }
  }

  // Investigations
  heading("Investigations:");
  {
    const INV = "Investigations & Diagnostic Studies";
    if (E) {
      sub("Labs ordered:");
      items(splitList(data.investigationLabsOrdered), { period: false, edit: { s: INV, k: "labsOrdered" } });
      const res: string[] = [];
      (data.labs || []).forEach((panel) =>
        (panel.values || []).forEach((v) => res.push(`${v.name}: ${v.value ?? v.text ?? "Pending"}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`))
      );
      (data.cultureResults || []).forEach((c) => res.push(`${c.name}: ${clean(c.result) || "Pending"}`));
      if (res.length) { sub("Results:"); res.forEach((t) => L.push({ kind: "item", text: capFirst(t) })); }
      sub("Imaging:");
      items(splitList(data.investigationImaging), { period: false, edit: { s: INV, k: "imaging" } });
      sub("Results summary:");
      items(splitSentences(data.investigationResultsSummary), { edit: { s: INV, k: "resultsSummary" } });
    }
    const inv: { text: string; edit?: Omit<ErEdit, "ph"> }[] = [
      ...splitList(data.investigationLabsOrdered).map((text) => ({ text, edit: { s: INV, k: "labsOrdered" } })),
      ...splitList(data.investigationImaging).map((text) => ({ text, edit: { s: INV, k: "imaging" } })),
    ];
    (data.labs || []).forEach((panel) =>
      (panel.values || []).forEach((v) => inv.push({ text: `${v.name}: ${v.value ?? v.text ?? "Pending"}${v.unit && v.value !== null ? ` ${v.unit}` : ""}` }))
    );
    (data.cultureResults || []).forEach((c) => inv.push({ text: `${c.name}: ${clean(c.result) || "Pending"}` }));
    splitSentences(data.investigationResultsSummary).forEach((s) => inv.push({ text: sentence(s), edit: { s: INV, k: "resultsSummary" } }));
    if (E) { /* shown above, field by field */ }
    else if (!inv.length) items([], { edit: { s: INV, k: "labsOrdered" } });
    else inv.forEach((l) => L.push({ kind: "item", text: capFirst(l.text), ...(l.edit ? { edit: l.edit } : {}) }));
  }

  // Treatment Plan
  heading("Treatment Plan:");
  {
    const TRT = "Treatment Given & Emergency Orders";
    const tx: string[] = (data.treatmentGiven || []).map((t) => clean(t).replace(/\s*·\s*/g, " "));
    const notes = [...splitSentences(data.treatmentNotes)];
    const extra: string[] = [];
    if (has(data.treatment?.otherNotes) && clean(data.treatment?.otherNotes) !== clean(data.treatmentNotes)) {
      extra.push(...splitSentences(data.treatment?.otherNotes));
    }
    if (E) {
      sub("Drugs given:");
      items(tx, { edit: { s: TRT, k: "drugs" } });
      sub("Treatment notes / orders:");
      items(notes, { edit: { s: TRT, k: "treatmentNotes" } });
      extra.forEach((l) => L.push({ kind: "item", text: sentence(l) }));
    } else if (!tx.length && !notes.length && !extra.length) items([], { edit: { s: TRT, k: "drugs" } });
    else {
      tx.forEach((l) => L.push({ kind: "item", text: sentence(l), edit: { s: TRT, k: "drugs" } }));
      notes.forEach((l) => L.push({ kind: "item", text: sentence(l), edit: { s: TRT, k: "treatmentNotes" } }));
      extra.forEach((l) => L.push({ kind: "item", text: sentence(l) }));
    }
  }
  const procLines: string[] = [];
  (data.procedures?.procedureNotes || []).forEach((n: any) => {
    const when = [n?.metadata?.date, n?.metadata?.time].filter(Boolean).join(" ");
    procLines.push(`${clean(n?.procedureName) || "Procedure"}${when ? ` (${when})` : ""}${has(n?.generatedNarrative) ? `: ${clean(n.generatedNarrative)}` : ""}`);
  });
  (data.procedures?.proceduresChecked || []).forEach((p) => procLines.push(p));
  if (has(data.procedures?.otherProcedures)) procLines.push(clean(data.procedures.otherProcedures));
  if (procLines.length) {
    heading("Procedures:");
    items(procLines);
  }

  // Disposition
  heading("Disposition:");
  {
    const d = data.disposition || ({} as CaseSheetData["disposition"]);
    const lines: string[] = [];
    if (has(d.status)) lines.push(`${clean(d.status)}${has(d.destinationUnit) ? ` — ${clean(d.destinationUnit)}` : ""}`);
    else if (has(d.destinationUnit)) lines.push(clean(d.destinationUnit));
    const consults = [...new Set([...(d.consultsRequested || []), ...(data.consultation?.consultsRequested || [])].map(clean).filter(Boolean))];
    consults.forEach((c) => lines.push(/consult/i.test(c) ? c : `${c} consultation`));
    if (has(d.conditionAtShift)) lines.push(`Condition: ${clean(d.conditionAtShift)}`);
    if (has(d.durationInEr)) lines.push(`Duration in ER: ${clean(d.durationInEr)}`);
    const DSP = "Disposition & Outcome";
    const plan = splitSentences(d.managementPlan);
    const post: string[] = [];
    if (has(d.followUpAdvice)) post.push(`Follow-up: ${clean(d.followUpAdvice)}`);
    if (has(d.observationNotes)) post.push(...splitSentences(d.observationNotes));
    if (E) {
      const one = (label: string, k: string, v: string) => { sub(label); items(has(v) ? splitSentences(v) : [], { edit: { s: DSP, k } }); };
      one("Status:", "status", clean(d.status));
      one("Destination:", "destination", clean(d.destinationUnit));
      consults.forEach((c) => L.push({ kind: "item", text: sentence(/consult/i.test(c) ? c : `${c} consultation`) }));
      one("Condition:", "condition", clean(d.conditionAtShift));
      if (has(d.durationInEr)) L.push({ kind: "item", text: sentence(`Duration in ER: ${clean(d.durationInEr)}`) });
      one("Management plan:", "plan", clean(d.managementPlan));
      one("Follow-up:", "followUp", clean(d.followUpAdvice));
      if (has(d.observationNotes)) splitSentences(d.observationNotes).forEach((l) => L.push({ kind: "item", text: sentence(l) }));
    } else if (!lines.length && !plan.length && !post.length) items([], { edit: { s: DSP, k: "plan" } });
    else {
      lines.forEach((l) => L.push({ kind: "item", text: sentence(l) }));
      plan.forEach((l) => L.push({ kind: "item", text: sentence(l), edit: { s: DSP, k: "plan" } }));
      post.forEach((l) => L.push({ kind: "item", text: sentence(l) }));
    }
  }
  const review = data.consultation?.consultantReview;
  if (review && (has(review.reviewText) || has(review.reviewedBy))) {
    heading("Consultant Review:");
    items([
      `${has(review.reviewedBy) ? drName(review.reviewedBy) : "Consultant"}${has(review.timestamp) ? ` (${clean(review.timestamp)})` : ""}${has(review.reviewText) ? `: ${clean(review.reviewText)}` : ""}`,
    ]);
  }

  // Diagnosis
  if (E || has(data.provisionalDiagnosis)) {
    heading("Provisional Diagnosis:");
    items(splitSentences(data.provisionalDiagnosis), { edit: { s: "Provisional Diagnosis", k: "provisional" } });
  }
  heading("Differential Diagnosis:");
  {
    const dd = (data.differentials || [])
      .map((d) => `${clean(d.diagnosis)}${has(d.status) && !/^(suspected|considered|possible)$/i.test(clean(d.status)) ? ` (${clean(d.status)})` : ""}`)
      .filter((s) => s && !/^\(/.test(s));
    // Differentials list AND the free-text differential notes are both kept (the old sheet showed both).
    const ddNotes = splitSentences(data.provisionalDifferentialDiagnoses).filter((n) => !dd.some((x) => x.toLowerCase() === n.toLowerCase().replace(/[.\s]+$/, "")));
    const DX = "Provisional Diagnosis";
    // A status in brackets ("(confirmed)") cannot be typed back into the diagnosis name, so such a list stays read-only.
    const ddEditable = dd.every((x) => !/\([^)]*\)\s*$/.test(x));
    if (E) {
      // Names only (the status is kept by the writer when the name is unchanged), so every list is typeable.
      sub("Differentials:");
      items((data.differentials || []).map((d) => clean(d.diagnosis)).filter(Boolean), { edit: { s: DX, k: "differentials" } });
      sub("Differential notes:");
      items(splitSentences(data.provisionalDifferentialDiagnoses), { edit: { s: DX, k: "diffNotes" } });
    } else if (!dd.length && !ddNotes.length) items([], { edit: { s: DX, k: "differentials" } });
    else {
      dd.forEach((l) => L.push({ kind: "item", text: sentence(l), ...(ddEditable ? { edit: { s: DX, k: "differentials" } } : {}) }));
      ddNotes.forEach((l) => L.push({ kind: "item", text: sentence(l), edit: { s: DX, k: "diffNotes" } }));
    }
  }

  // Patient safety (only when recorded)
  const sa = data.safetyAndAccreditation;
  if (sa && (sa.hasAnyIpsg || (sa.vulnerability || []).length || (sa.consentTimeOut || []).length)) {
    heading("Patient Safety Checks:");
    const s: string[] = [];
    const ip = sa.ipsgChecklist;
    if (sa.hasAnyIpsg && ip) {
      const b = (label: string, v: any) => { if (v === true || v === false) s.push(`${label}: ${displayDocumentedBoolean(v)}`); };
      b("Identifiers verified", ip.ipsg1IdentifiersVerified);
      b("Verbal order read-back", ip.ipsg2ReadBackPerformed);
      b("High-alert medicines double-checked", ip.ipsg3HighAlertDoubleChecked);
      b("Time-out performed", ip.ipsg4TimeOutPerformed);
      b("Hand hygiene complied", ip.ipsg5HandHygieneComplied);
      if (has(ip.ipsg6FallRiskAssessed)) s.push(`Fall risk: ${clean(ip.ipsg6FallRiskAssessed)}`);
    }
    s.push(...(sa.vulnerability || []), ...(sa.consentTimeOut || []));
    items(s);
  }

  // Notes (only when recorded)
  if (E || has(data.notes?.progressNotes)) {
    heading("Progress Notes:");
    items(splitSentences(data.notes?.progressNotes), { edit: { s: "Clinical Notes & Addendum", k: "notes" } });
  }
  if (E || has(data.notes?.addendum)) {
    heading("Addendum:");
    items(splitSentences(data.notes?.addendum), { edit: { s: "Clinical Notes & Addendum", k: "addendum" } });
  }

  // Signatures
  const sig = data.signatureBlock || ({} as CaseSheetData["signatureBlock"]);
  L.push({ kind: "labelled", label: "EM Resident", text: drName(sig.clinicianName || data.clinician) || "Not documented" });
  L.push({ kind: "labelled", label: "EM Consultant", text: drName(sig.consultantName) || "Not documented" });

  return L;
}

// ── output formats ───────────────────────────────────────────────────────────

const INDENT = "    ";

/** Plain text, exactly as typed into the hospital EMR. */
export function erCaseRecordToText(lines: ErLine[]): string {
  return lines
    .map((l) => {
      switch (l.kind) {
        case "title": return l.text;
        case "heading": return l.text;
        case "subheading": return l.text;
        case "item": return `${INDENT}${l.text}`;
        case "dash": return `- ${l.text}`;
        case "para": return l.text;
        case "labelled": return l.arrow ? `${INDENT}${l.label} → ${l.text}` : `${l.label}: ${l.text}`;
      }
    })
    .join("\n") + "\n";
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Rich-text version for EMR editors (TinyMCE and similar): one <p> per line, headings and labels
 * bold, indented lines with a left margin. No fonts or colours, so the EMR keeps its own look.
 */
export function erCaseRecordToHtml(lines: ErLine[]): string {
  const p = (inner: string, indent = false) => `<p${indent ? ' style="margin-left:40px"' : ""}>${inner}</p>`;
  const body = lines
    .map((l) => {
      switch (l.kind) {
        case "title": return p(`<strong>${esc(l.text)}</strong>`);
        case "heading": return p(`<strong>${esc(l.text)}</strong>`);
        case "subheading": return p(`<strong>${esc(l.text)}</strong>`);
        case "item": return p(esc(l.text), true);
        case "dash": return p(`- ${esc(l.text)}`);
        case "para": return p(esc(l.text));
        case "labelled":
          return l.arrow
            ? p(`<strong>${esc(l.label)}</strong> → ${esc(l.text)}`, true)
            : p(`<strong>${esc(l.label)}:</strong> ${esc(l.text)}`);
      }
    })
    .join("");
  return `<meta charset="utf-8">${body}`;
}