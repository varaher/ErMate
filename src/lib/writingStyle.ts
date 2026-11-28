/**
 * ErMate — "My Writing Style": one shared, typed, deterministic personalisation engine.
 *
 * PRESENTATION ONLY. It never touches clinical extraction, patient identity, age or paediatric
 * routing, bed binding, vitals, drug names, doses, units or investigation results.
 *   - No AI calls. No free-text instructions: every option is a fixed, validated value.
 *   - A doctor with no saved style (or "default" everywhere) gets byte-identical ErMate output.
 *   - Nothing is ever added: abbreviation swaps replace one allow-listed phrase with its
 *     equivalent; bullets/paragraphs only change line breaks and the "• " / "; " separators.
 *     "Not mentioned" is never turned into "normal", and no negative is ever introduced.
 *
 * ER, ICU, MATE, case sheet, discharge and handover all call the same functions below.
 */
import { DEFAULT_EMR_LAYOUT, EMR_SECTION_CATALOG, type EmrLayoutItem, type EmrSectionKey } from "../utils/emrSections";

export const WRITING_STYLE_VERSION = 1 as const;

export const DOC_STYLES = ["default", "clinical", "narrative", "structured"] as const;
export const LENGTHS = ["concise", "balanced", "detailed"] as const;
export const EXAM_FORMATS = ["default", "abcde", "systemwise"] as const;
export const ABBREVIATION_MODES = ["default", "abbreviated", "expanded"] as const;
export const PRESENTATIONS = ["default", "bullets", "paragraphs"] as const;
export const EMR_COPY_MODES = ["fields", "full"] as const;

export type DocStyle = (typeof DOC_STYLES)[number];
export type LengthPref = (typeof LENGTHS)[number];
export type ExamFormat = (typeof EXAM_FORMATS)[number];
export type AbbreviationMode = (typeof ABBREVIATION_MODES)[number];
export type PresentationMode = (typeof PRESENTATIONS)[number];
export type EmrCopyMode = (typeof EMR_COPY_MODES)[number];

export interface WritingStyle {
  v: typeof WRITING_STYLE_VERSION;
  docStyle: DocStyle;
  length: LengthPref;
  exam: ExamFormat;
  abbreviations: AbbreviationMode;
  presentation: PresentationMode;
  emrCopy: EmrCopyMode;
}

/** The existing ErMate behaviour. */
export const DEFAULT_WRITING_STYLE: WritingStyle = {
  v: WRITING_STYLE_VERSION,
  docStyle: "default",
  length: "balanced",
  exam: "default",
  abbreviations: "default",
  presentation: "default",
  emrCopy: "fields",
};

const pick = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * Turns anything stored (undefined, null, wrong types, extra keys, future values) into a valid style.
 * Unknown keys are dropped and unknown values fall back to the default for that option.
 */
export function resolveWritingStyle(raw: unknown): WritingStyle {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    v: WRITING_STYLE_VERSION,
    docStyle: pick(DOC_STYLES, r.docStyle, DEFAULT_WRITING_STYLE.docStyle),
    length: pick(LENGTHS, r.length, DEFAULT_WRITING_STYLE.length),
    exam: pick(EXAM_FORMATS, r.exam, DEFAULT_WRITING_STYLE.exam),
    abbreviations: pick(ABBREVIATION_MODES, r.abbreviations, DEFAULT_WRITING_STYLE.abbreviations),
    presentation: pick(PRESENTATIONS, r.presentation, DEFAULT_WRITING_STYLE.presentation),
    emrCopy: pick(EMR_COPY_MODES, r.emrCopy, DEFAULT_WRITING_STYLE.emrCopy),
  };
}

/** What is written to Firestore: only the validated fields, nothing else, never patient data. */
export function sanitizeWritingStyleForSave(raw: unknown): WritingStyle {
  return resolveWritingStyle(raw);
}

export function isDefaultWritingStyle(style: WritingStyle): boolean {
  const d = DEFAULT_WRITING_STYLE;
  return style.docStyle === d.docStyle && style.length === d.length && style.exam === d.exam
    && style.abbreviations === d.abbreviations && style.presentation === d.presentation && style.emrCopy === d.emrCopy;
}

/**
 * Documentation style is a starting point; an explicit abbreviation / presentation choice wins.
 *   clinical   = approved abbreviations + bullets
 *   narrative  = expanded terms + paragraphs
 *   structured = bullets (ErMate's labelled lines stay as they are)
 */
export function effectiveAbbreviations(s: WritingStyle): "default" | "abbreviated" | "expanded" {
  if (s.abbreviations !== "default") return s.abbreviations;
  if (s.docStyle === "clinical") return "abbreviated";
  if (s.docStyle === "narrative") return "expanded";
  return "default";
}
export function effectivePresentation(s: WritingStyle): "default" | "bullets" | "paragraphs" {
  if (s.presentation !== "default") return s.presentation;
  if (s.docStyle === "clinical" || s.docStyle === "structured") return "bullets";
  if (s.docStyle === "narrative") return "paragraphs";
  return "default";
}

/* ───────────────────────── abbreviations (allow-list only) ───────────────────────── */

/**
 * Deliberately short and unambiguous. No drug names, units, vitals labels, routes (IV/IM),
 * or findings such as NAD/WNL/NKDA-style attestations that carry clinical weight when reworded.
 * [abbreviation, full phrase]
 */
export const ABBREVIATION_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["k/c/o", "known case of"],
  ["c/o", "complains of"],
  ["h/o", "history of"],
  ["s/p", "status post"],
  ["HTN", "hypertension"],
  ["DM", "diabetes mellitus"],
  ["CAD", "coronary artery disease"],
  ["COPD", "chronic obstructive pulmonary disease"],
  ["CKD", "chronic kidney disease"],
  ["AKI", "acute kidney injury"],
  ["UTI", "urinary tract infection"],
  ["RTA", "road traffic accident"],
  ["SOB", "shortness of breath"],
  ["LOC", "loss of consciousness"],
  ["PTA", "prior to arrival"],
];

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const SENTENCE_START = /(?:^|[\n.!?]\s*(?:[-•*]\s*)?)$/;

const EXPAND_RULES = [...ABBREVIATION_PAIRS]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([abbr, full]) => ({
    full,
    re: new RegExp(`(?<![A-Za-z0-9/])${escRe(abbr)}(?![A-Za-z0-9/])`, /[a-z/]/.test(abbr) ? "gi" : "g"),
  }));

const ABBREVIATE_RULES = [...ABBREVIATION_PAIRS]
  .sort((a, b) => b[1].length - a[1].length)
  .map(([abbr, full]) => ({
    abbr,
    // "history of present/presenting illness" is a heading, not a past-history phrase.
    re: new RegExp(`(?<![A-Za-z0-9])${full.split(" ").map(escRe).join("\\s+")}(?![A-Za-z0-9])${full === "history of" ? "(?!\\s+present)" : ""}`, "gi"),
  }));

/** Swaps allow-listed abbreviations for their full phrase. Everything else is left exactly as written. */
export function expandAbbreviations(text: string): string {
  let out = text;
  for (const { re, full } of EXPAND_RULES) {
    out = out.replace(re, (m, offset: number, whole: string) => {
      const atStart = SENTENCE_START.test(whole.slice(0, offset));
      return atStart ? full.charAt(0).toUpperCase() + full.slice(1) : full;
    });
  }
  return out;
}

/** Swaps allow-listed full phrases for the approved abbreviation. */
export function abbreviatePhrases(text: string): string {
  let out = text;
  for (const { re, abbr } of ABBREVIATE_RULES) out = out.replace(re, abbr);
  return out;
}

/* ───────────────────────── bullets / paragraphs ───────────────────────── */

const NO_SPLIT = new Set(["dr", "mr", "mrs", "ms", "prof", "vs", "approx", "no", "st", "sr", "jr", "e.g", "i.e", "etc", "inj", "tab", "cap", "syr"]);
const BULLET = /^\s*[-•*]\s+/;
const isBulletLine = (l: string) => BULLET.test(l);

/** All-caps lines, **bold** markers and "Label:" lines are headings and are never restructured. */
export function isHeadingLikeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith("**")) return true;
  if (/[A-Za-z]{3,}/.test(t) && !/[a-z]/.test(t)) return true;
  return /^[A-Za-z][A-Za-z0-9 /&()'\-]{0,60}:$/.test(t);
}

/** Sentence split that never splits decimals ("38.2"), titles ("Dr. Rao"), initials or "No. 3". */
export function splitSentences(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === "." || ch === "!" || ch === "?") && /\s/.test(line[i + 1] || "") ) {
      const rest = line.slice(i + 1).trimStart();
      if (!/^[A-Z0-9(]/.test(rest)) continue;
      const wordBefore = (line.slice(start, i).match(/([A-Za-z][A-Za-z.]*)$/) || [])[1] || "";
      if (ch === "." && (NO_SPLIT.has(wordBefore.toLowerCase()) || /^[A-Za-z]$/.test(wordBefore))) continue;
      out.push(line.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const last = line.slice(start).trim();
  if (last) out.push(last);
  return out.filter(Boolean);
}

const LABELLED = /^([A-Za-z][A-Za-z0-9 /&()'\-]{1,40}):\s+(.+)$/;

/** One "• " line per sentence. Single-sentence lines, headings and existing bullets are untouched. */
export function applyBullets(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim() || isHeadingLikeLine(line) || isBulletLine(line)) { out.push(line); continue; }
    const lab = line.match(LABELLED);
    // "Chest: clear. Abdomen: soft." is a list of labelled findings: each keeps its own label.
    const whole = splitSentences(line);
    if (lab && whole.length >= 2 && whole.slice(1).some((x) => LABELLED.test(x))) {
      for (const sn of whole) out.push(`• ${sn}`);
      continue;
    }
    const body = lab ? lab[2] : line;
    const sentences = splitSentences(body);
    if (sentences.length < 2) { out.push(line); continue; }
    if (lab) out.push(`${lab[1]}:`);
    for (const sn of sentences) out.push(`• ${sn}`);
  }
  return out;
}

/** Two or more consecutive bullet lines become one sentence-paragraph joined with "; ". */
export function applyParagraphs(lines: string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const items = run.map((l) => l.replace(BULLET, "").trim().replace(/[.;,]+$/, ""));
      out.push(`${items.join("; ")}.`);
    } else out.push(...run);
    run = [];
  };
  for (const line of lines) {
    if (isBulletLine(line)) run.push(line); else { flush(); out.push(line); }
  }
  flush();
  return out;
}

/* ───────────────────────── applying a style to text ───────────────────────── */

/** Sections that hold exact values: abbreviations are safe (allow-list), restructuring is not applied. */
export const EXACT_VALUE_SECTIONS: ReadonlySet<EmrSectionKey> = new Set<EmrSectionKey>([
  "vitals", "investigations", "treatment", "allergiesMeds", "procedures", "patient", "mlc", "pediatric", "adjuncts",
]);

const FREE_TEXT_HEADING = /complain|history|hopi|present|exam|diagnos|plan|assess|advice|course|impression|opinion|note/i;

function styleLines(lines: string[], style: WritingStyle, allowRestructure: (line: string, idx: number) => boolean): string[] {
  const abbr = effectiveAbbreviations(style);
  const pres = effectivePresentation(style);
  let work = lines;
  if (abbr !== "default") {
    work = work.map((l) => (isHeadingLikeLine(l) && !LABELLED.test(l) ? l : abbr === "expanded" ? expandAbbreviations(l) : abbreviatePhrases(l)));
  }
  if (pres === "default") return work;
  // Restructure only the lines the caller allows (free-text areas), keep everything else as is.
  const out: string[] = [];
  let chunk: string[] = [];
  let chunkOk: boolean | null = null;
  const flush = () => {
    if (!chunk.length) return;
    out.push(...(chunkOk ? (pres === "bullets" ? applyBullets(chunk) : applyParagraphs(chunk)) : chunk));
    chunk = [];
  };
  work.forEach((l, i) => {
    const ok = allowRestructure(l, i);
    if (chunkOk !== null && ok !== chunkOk) flush();
    chunkOk = ok;
    chunk.push(l);
  });
  flush();
  return out;
}

/** A single EMR field (field-wise copy). Exact-value sections only get the abbreviation allow-list. */
export function restyleSection(text: string, style: WritingStyle, key: EmrSectionKey): string {
  if (!text) return text;
  const free = !EXACT_VALUE_SECTIONS.has(key);
  const lines = text.split("\n");
  return styleLines(lines, style, () => free).join("\n");
}

/**
 * A whole document (full case-sheet copy, handover copy). Restructuring applies only under headings
 * that hold free text (complaints, history, examination, diagnosis, plan, notes ...).
 */
export function restyleDocument(text: string, style: WritingStyle, opts: { restructure?: boolean } = {}): string {
  if (!text) return text;
  if (isDefaultWritingStyle(style)) return text;
  const lines = text.split("\n");
  let inFree = false;
  const free = lines.map((l) => {
    if (isHeadingLikeLine(l) && !LABELLED.test(l)) inFree = FREE_TEXT_HEADING.test(l);
    return inFree;
  });
  return styleLines(lines, style, (_l, i) => opts.restructure !== false && free[i]).join("\n");
}

/** Free-text string fields of a record (discharge summary). Every other field is returned untouched. */
export function restyleFields<T extends Record<string, any>>(data: T, keys: ReadonlyArray<keyof T & string>, style: WritingStyle, restructureKeys: ReadonlyArray<string> = []): T {
  if (isDefaultWritingStyle(style)) return data;
  const out: Record<string, any> = { ...data };
  for (const k of keys) {
    const v = out[k];
    if (typeof v !== "string" || !v.trim()) continue;
    const lines = v.split("\n");
    out[k] = styleLines(lines, style, () => restructureKeys.includes(k)).join("\n");
  }
  return out as T;
}

/* ───────────────────────── EMR layout derived from the style ───────────────────────── */

const CATALOG_ORDER = EMR_SECTION_CATALOG.map((c) => c.key);

/**
 * Starting layout for field-wise copy, derived from Length and Examination format.
 * Only used while the doctor has NOT saved their own EMR layout: a saved layout always wins.
 *   concise  → leaves out Past History and Investigations
 *   detailed → adds Primary Survey, ECG / bedside tests, Procedures, Consultations, Progress Notes
 *   abcde    → includes the Primary Survey (A-B-C-D-E) before the Examination
 *   systemwise → leaves the Primary Survey out
 * Nothing is shortened or reworded: whole sections are shown or left out.
 */
export function deriveEmrLayout(style: WritingStyle, stored: EmrLayoutItem[]): EmrLayoutItem[] {
  const isStoredDefault = stored.length === DEFAULT_EMR_LAYOUT.length
    && stored.every((it, i) => it.key === DEFAULT_EMR_LAYOUT[i] && !it.label);
  if (!isStoredDefault) return stored;
  const set = new Set<EmrSectionKey>(DEFAULT_EMR_LAYOUT);
  if (style.length === "concise") { set.delete("pastHistory"); set.delete("investigations"); }
  if (style.length === "detailed") {
    (["primarySurvey", "adjuncts", "procedures", "consults", "notes"] as EmrSectionKey[]).forEach((k) => set.add(k));
  }
  if (style.exam === "abcde") set.add("primarySurvey");
  if (style.exam === "systemwise") set.delete("primarySurvey");
  return CATALOG_ORDER.filter((k) => set.has(k)).map((key) => ({ key }));
}

/* ───────────────────────── synthetic preview (no patient data) ───────────────────────── */

export const PREVIEW_SECTIONS: ReadonlyArray<{ key: EmrSectionKey; title: string; text: string }> = [
  { key: "complaints", title: "Chief Complaints", text: "Patient complains of fever for 2 days. No history of cough." },
  { key: "hopi", title: "History of Presenting Illness", text: "Fever for 2 days, intermittent. Chills present. No shortness of breath. Known case of hypertension and diabetes mellitus." },
  { key: "pastHistory", title: "Past History", text: "k/c/o HTN, DM. h/o road traffic accident 2 years ago." },
  { key: "vitals", title: "Vitals", text: "Temperature: 38.2 °C\nHR: 96/min\nBP: 128/82 mmHg" },
  { key: "primarySurvey", title: "Primary Survey", text: "A: Patent\nB: Air entry equal\nC: CRT < 2 s\nD: GCS 15\nE: Afebrile" },
  { key: "examination", title: "Examination", text: "Chest: clear. Abdomen: soft, non-tender. Not examined: neurological." },
  { key: "investigations", title: "Investigations", text: "Hb 11.2 g/dL\nWBC 12,400/µL" },
  { key: "diagnosis", title: "Diagnosis", text: "Acute febrile illness." },
  { key: "plan", title: "Disposition & Plan", text: "Admit under medicine. Review in 24 hours." },
];

export function previewSections(style: WritingStyle): Array<{ key: EmrSectionKey; title: string; text: string }> {
  const layout = deriveEmrLayout(style, DEFAULT_EMR_LAYOUT.map((key) => ({ key })));
  return layout
    .map((it) => PREVIEW_SECTIONS.find((p) => p.key === it.key))
    .filter((p): p is { key: EmrSectionKey; title: string; text: string } => !!p)
    .map((p) => ({ ...p, text: restyleSection(p.text, style, p.key) }));
}