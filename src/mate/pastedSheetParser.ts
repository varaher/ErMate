/**
 * Local (no-LLM) reader for a pasted external case sheet / summary.
 *
 * Patient details are removed before any text reaches a model (PHI rule), so the model can never
 * fill the name or the discharge advice written in the sheet's own words. This reads clearly
 * labelled lines in the browser, after the model call, and only fills what extraction left empty.
 */

export interface PastedSheetHeader {
  patientName?: string;
  age?: string;
  gender?: "Male" | "Female";
}

export interface PastedDischargeDraft {
  primaryDiagnosis?: string;
  conditionAtDischarge?: string;
  dischargeMedications?: string;
  followUpPlan?: string;
}

const LABEL_END = String.raw`(?:\s*[:\-–]\s*|\s*\n\s*)`;

/** Text after a label, up to the next line that looks like another "Label:" or a blank gap. */
function section(text: string, labels: string[]): string | undefined {
  const alt = labels.join("|");
  const re = new RegExp(`(?:^|\\n)[ \\t]*(?:${alt})${LABEL_END}([\\s\\S]*?)(?=\\n[ \\t]*[A-Za-z][A-Za-z /&().'-]{2,40}\\s*[:：]|\\n\\s*\\n|$)`, "i");
  const m = text.match(re);
  const v = m?.[1]?.replace(/\s+\n/g, "\n").trim();
  return v ? v : undefined;
}

export function parsePastedSheetHeader(text: string): PastedSheetHeader {
  const out: PastedSheetHeader = {};
  const t = text || "";

  const nameM = t.match(/(?:^|\n)[ \t]*(?:patient\s*name|name\s+of\s+(?:the\s+)?patient|name)\s*[:\-–]\s*([^\n]{2,60}?)(?=\s{2,}|\s+(?:age|sex|gender|uhid|mrn|ip\s*no|op\s*no|date|dob)\b|\s*[,;|]|\n|$)/i);
  if (nameM) {
    const n = nameM[1].replace(/^(?:mr|mrs|ms|master|baby|dr)\.?\s+/i, "").trim();
    if (n && !/\d/.test(n) && n.split(/\s+/).length <= 5) out.patientName = n;
  }

  // Unlabelled header: first non-empty line such as "Mrs. CLARAMMA ABRAHAM".
  if (!out.patientName) {
    const first = t.split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "";
    const hm = first.match(/^(?:mr|mrs|ms|miss|master|baby|smt|shri)\.?\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3})$/i);
    if (hm && first.length <= 60 && !/\d/.test(first)) out.patientName = hm[1].trim();
  }

  const ageSex = t.match(/\b(?:age\s*(?:\/\s*sex)?|age\s*\/\s*gender)\s*[:\-–]?\s*(\d{1,3})\s*(?:y(?:ea)?rs?|y)?\s*(?:[\/,\s]+\s*(male|female|m|f)\b)?/i);
  if (ageSex) {
    out.age = ageSex[1];
    const g = ageSex[2]?.toLowerCase();
    if (g) out.gender = g.startsWith("f") ? "Female" : "Male";
  }
  if (!out.age) {
    const a = t.match(/\bage\s*[:\-–]\s*(\d{1,3})\b/i);
    if (a) out.age = a[1];
  }
  if (!out.gender) {
    const s = t.match(/\b(?:sex|gender)\s*[:\-–]\s*(male|female|m|f)\b/i);
    if (s) out.gender = s[1].toLowerCase().startsWith("f") ? "Female" : "Male";
  }
  const age = out.age ? Number(out.age) : NaN;
  if (!Number.isFinite(age) || age < 0 || age > 120) delete out.age;
  return out;
}

export function parsePastedDischargeDraft(text: string): PastedDischargeDraft {
  const t = text || "";
  const out: PastedDischargeDraft = {};
  // Only an explicitly FINAL / DISCHARGE diagnosis. A bare "Diagnosis:" or "Impression:" may be provisional.
  const dx = section(t, ["final\\s+diagnosis", "discharge\\s+diagnosis", "diagnosis\\s+at\\s+discharge"]);
  if (dx) out.primaryDiagnosis = dx.split("\n")[0].trim();
  const cond = section(t, ["condition\\s+at\\s+discharge", "discharge\\s+condition", "condition\\s+on\\s+discharge"]);
  if (cond) out.conditionAtDischarge = cond.split("\n")[0].trim();
  const meds = section(t, ["discharge\\s+medications?", "discharge\\s+meds", "medications?\\s+on\\s+discharge", "rx\\s+on\\s+discharge", "take\\s+home\\s+medications?", "tto"]);
  if (meds) out.dischargeMedications = meds;
  const fu = section(t, ["follow[\\s-]?up(?:\\s+advice|\\s+plan)?", "review\\s+(?:advice|after)", "advice\\s+on\\s+discharge", "discharge\\s+advice"]);
  if (fu) out.followUpPlan = fu;
  return out;
}

/** Fill only blanks; never overwrite what extraction produced. */
export function mergePastedSheetIntoExtraction(extraction: Record<string, any>, text: string): Record<string, any> {
  const out = { ...(extraction || {}) };
  const blank = (v: any) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || String(v).toLowerCase() === "unknown";
  const h = parsePastedSheetHeader(text);
  if (h.patientName && blank(out.patientName)) out.patientName = h.patientName;
  if (h.age && blank(out.age)) out.age = h.age;
  if (h.gender && blank(out.gender) && blank(out.sex)) out.gender = h.gender;
  const d = parsePastedDischargeDraft(text);
  if (d.followUpPlan && blank(out.followUpAdvice)) out.followUpAdvice = d.followUpPlan;
  if (Object.keys(d).length > 0) {
    const prev: Record<string, any> = { ...(out.dischargeInfoDraft || {}) };
    for (const [k, v] of Object.entries(d)) {
      if (blank(prev[k])) prev[k] = v; // existing non-empty values always win
    }
    out.dischargeInfoDraft = prev;
  }
  return out;
}

const normName = (n: string) =>
  (n || "")
    .toLowerCase()
    .replace(/\b(?:mr|mrs|ms|miss|master|baby|smt|shri|dr)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

/**
 * A pasted sheet that clearly belongs to someone else must never be merged into the open
 * patient's chart. Returns a message when the sheet's name / age / sex contradict the open
 * patient, otherwise null. Missing information on either side is not a conflict.
 */
export function detectSheetIdentityConflict(
  sheetText: string,
  open: { name?: string | null; age?: number | string | null; gender?: string | null } | null | undefined
): string | null {
  if (!open) return null;
  const h = parsePastedSheetHeader(sheetText);
  const reasons: string[] = [];

  const a = normName(h.patientName || "");
  const b = normName(String(open.name || ""));
  if (a.length > 0 && b.length > 0 && !a.some((w) => b.includes(w))) {
    reasons.push(`name "${h.patientName}" vs open patient "${open.name}"`);
  }
  const openAge = open.age === null || open.age === undefined || String(open.age).trim() === "" ? NaN : Number(open.age);
  if (h.age && Number.isFinite(openAge) && Math.abs(Number(h.age) - openAge) > 5) {
    reasons.push(`age ${h.age} vs open patient ${openAge}`);
  }
  const og = String(open.gender || "").trim().charAt(0).toUpperCase();
  if (h.gender && (og === "M" || og === "F") && h.gender.charAt(0) !== og) {
    reasons.push(`sex ${h.gender} vs open patient ${og === "M" ? "Male" : "Female"}`);
  }
  return reasons.length ? reasons.join("; ") : null;
}
