/**
 * Local (no-LLM) reader for a pasted external case sheet that has its own labelled sections
 * (Presenting Complaint, Primary Assessment, History of Present Illness, Secondary Survey ...).
 *
 * Why: the model extractor is built to drop anything not clearly stated, so on a long structured sheet
 * it keeps only fragments. A sheet's own labelled text is already the clinician's wording, so it is copied
 * across word for word. Nothing is invented: no GCS total, no temperature unit, no drug the sheet does not name,
 * and a vital outside a believable range is left out.
 */

export interface PastedSheetSections {
  presentingComplaint?: string;
  hpi?: string;
  vitals?: Record<string, string>;
  airway?: string;
  breathing?: string;
  circulation?: string;
  disability?: string;
  exposure?: string;
  ecg?: string;
  echo?: string;
  symptoms?: string;
  pastMedicalHistory?: string;
  surgicalHistory?: string;
  familyHistory?: string;
  allergies?: string;
  secondarySurvey?: Record<string, string>;
  psychologicalAssessment?: string;
  labs?: { name: string; value?: string }[];
  imaging?: { name: string; value?: string }[];
  managementPlan?: string;
  disposition?: string;
  differentialDiagnosis?: string;
  emResident?: string;
  emConsultant?: string;
  age?: string;
  gender?: "Male" | "Female";
}

type Key =
  | "complaint" | "primary" | "adjuvants" | "hpi" | "secondary" | "signs" | "pmh" | "psh" | "family" | "lmp"
  | "allergies" | "general" | "systemic" | "psych" | "inv" | "plan" | "dispo" | "ddx" | "resident" | "consultant" | "agesex";

const LABELS: { key: Key; re: string }[] = [
  { key: "complaint", re: String.raw`(?:presenting|chief)\s+complaints?` },
  { key: "primary", re: String.raw`primary\s+(?:assessment|survey)` },
  { key: "adjuvants", re: String.raw`adjuvants?\s+to\s+primary(?:\s+(?:assessment|survey))?` },
  { key: "hpi", re: String.raw`(?:history\s+of\s+present(?:ing)?\s+illness|hpi)` },
  { key: "secondary", re: String.raw`secondary\s+(?:survey|assessment)` },
  { key: "signs", re: String.raw`signs\s+and\s+symptoms` },
  { key: "pmh", re: String.raw`past\s+(?:medical\s+)?history` },
  { key: "psh", re: String.raw`surgical\s+history` },
  { key: "family", re: String.raw`family(?:\s*\/\s*gynae(?:cological)?)?\s+history` },
  { key: "lmp", re: String.raw`lmp` },
  { key: "allergies", re: String.raw`allerg(?:y|ies)` },
  { key: "general", re: String.raw`general\s+examination` },
  { key: "systemic", re: String.raw`systemic\s+examination` },
  // Same wording as server/psychLabel.ts (verify_psych_capture.ts keeps them identical).
  { key: "psych", re: String.raw`(?:psycholog(?:ical|y)|psychiatr(?:ic|y)|psych)\s+(?:assessment|evaluation|examination|exam|status|screening|review|findings?)|mental\s+(?:health|status)(?:\s+(?:assessment|evaluation|examination|exam))?` },
  { key: "inv", re: String.raw`investigations?` },
  { key: "plan", re: String.raw`(?:treatment|management)\s+plan` },
  { key: "dispo", re: String.raw`disposition` },
  { key: "ddx", re: String.raw`(?:differential\s+diagnosis|provisional\s+diagnosis)` },
  { key: "resident", re: String.raw`em\s+resident` },
  { key: "consultant", re: String.raw`em\s+consultant` },
  { key: "agesex", re: String.raw`age\s*\/\s*sex` },
];

const clean = (s: string) => s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const bulletsToLine = (s: string) =>
  clean(s)
    .split("\n")
    .map((l) => l.replace(/^[\s•\-–*·]+/, "").replace(/[.;]+$/, "").trim())
    .filter(Boolean)
    .join("; ");
const NIL = /^(?:nil|n\/a|na|none|not applicable|-+)\.?$/i;

function splitSections(text: string): Partial<Record<Key, string>> {
  const alt = LABELS.map((l) => `(${l.re})`).join("|");
  const re = new RegExp(`^[ \\t]*(?:[•\\-–*·]\\s*)?(?:${alt})\\b[ \\t]*[:：\\-–]?[ \\t]*`, "gim");
  const hits: { key: Key; start: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const idx = m.slice(1).findIndex((g) => g !== undefined);
    if (idx < 0) continue;
    hits.push({ key: LABELS[idx].key, start: m.index, bodyStart: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++;
  }
  const out: Partial<Record<Key, string>> = {};
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const body = clean(text.slice(h.bodyStart, end));
    if (body && out[h.key] === undefined) out[h.key] = body;
  });
  return out;
}

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));
const inRange = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;

function parseVitals(primary: string): Record<string, string> {
  const v: Record<string, string> = {};
  const rr = primary.match(/\bRR\s*[:\-=]?\s*(\d{1,3})\b/i);
  if (rr && inRange(num(rr[1]), 5, 70)) v.rr = rr[1];
  const hr = primary.match(/\b(?:HR|pulse)\s*[:\-=]?\s*(\d{1,3})\b/i);
  if (hr && inRange(num(hr[1]), 20, 300)) v.hr = hr[1];
  const sp = primary.match(/\bSpO\s*2\s*[:\-=]?\s*(\d{2,3})\b/i);
  if (sp && inRange(num(sp[1]), 50, 100)) v.spo2 = sp[1];
  const bp = primary.match(/\bBP\s*[:\-=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if (bp && inRange(num(bp[1]), 50, 300) && inRange(num(bp[2]), 20, 200) && num(bp[1]) > num(bp[2])) v.bp = `${bp[1]}/${bp[2]}`;
  const gr = primary.match(/\bGRBS\s*[:\-=]?\s*(\d{2,3})\b/i);
  if (gr && inRange(num(gr[1]), 20, 900)) v.grbs = gr[1];
  const tp = primary.match(/\bTemp(?:erature)?\s*[:\-=]?\s*(\d{2,3}(?:\.\d)?)\s*(°\s*[CF]\b|[CF]\b|celsius|fahrenheit)?/i);
  if (tp) {
    const n = num(tp[1]);
    // Kept exactly as written (unit as dictated). A number with no unit is only kept in a believable body range.
    if (tp[2] ? inRange(n, 20, 120) : inRange(n, 25, 115)) v.temp = tp[2] ? `${tp[1]} ${tp[2].replace(/\s+/g, "").replace(/^°/, "°")}` : tp[1];
  }
  // GCS parts exactly as written (E1 VT M1). No total is ever worked out here.
  const g = primary.match(/\bGCS\s*[:\-=]?\s*E\s*([1-4])\s*V\s*([1-5]|T)\s*M\s*([1-6])\b/i);
  if (g) {
    v.gcs_e = g[1];
    v.gcs_v = g[2].toUpperCase();
    v.gcs_m = g[3];
  }
  return v;
}

function parsePrimary(primary: string): Partial<PastedSheetSections> {
  const out: Partial<PastedSheetSections> = {};
  const re = /^[ \t]*(?:[•\-–*·]\s*)?(Airway|Breathing|Circulation|Disability|Exposure)\s*(?:→|->|—>|:|-|–)\s*(.*)$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(primary))) {
    const val = m[2].trim();
    if (!val) continue;
    (out as any)[m[1].toLowerCase()] = val;
  }
  return out;
}

function parseExam(text: string, subs: { key: string; re: string }[]): Record<string, string> {
  const alt = subs.map((s, i) => `(${s.re})`).join("|");
  const re = new RegExp(`^[ \\t]*(?:[•\\-–*·]\\s*)?(?:${alt})\\s*[:\\-–]\\s*`, "gim");
  const hits: { key: string; start: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const idx = m.slice(1).findIndex((g) => g !== undefined);
    if (idx >= 0) hits.push({ key: subs[idx].key, start: m.index, bodyStart: m.index + m[0].length });
  }
  const out: Record<string, string> = {};
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const v = clean(text.slice(h.bodyStart, end)).replace(/\n+/g, " ").trim();
    if (v) out[h.key] = v;
  });
  return out;
}

const IMAGING = /\b(?:ct|mri|mr|x[\s-]?ray|xr|usg|ultrasound|sonography|doppler|echo|2d\s*echo|cxr|pet|angio\w*|fast|efast)\b/i;

/** "Pa panel emergency Rpt CT brain" -> ["Pa panel emergency", "Rpt CT brain"]. Separate tests are split at a new test word. */
function splitTests(raw: string): string[] {
  const parts = clean(raw)
    .split(/\n|;|,|\s{2,}|\s+(?=(?:rpt|repeat)\b)/i)
    .map((p) => p.replace(/^[\s•\-–*·]+/, "").trim())
    .filter(Boolean);
  return parts.map((p) => p.replace(/^rpt\b\.?/i, "Repeat"));
}

/** Break the plan text onto separate lines before each drug form (Inj, Tab, Cap, Syp, Neb, IV fluid). */
function planLines(raw: string): string {
  const one = clean(raw).replace(/\n+/g, " ");
  return one
    .replace(/\s+(?=(?:Inj|Tab|Cap|Syp|Neb|Susp|Oint)\.?\s)/gi, "\n")
    .replace(/\s+(?=(?:Gcs|GCS)\s+monitoring)/g, "\n")
    .trim();
}

export function parsePastedSheetSections(text: string): PastedSheetSections {
  const out: PastedSheetSections = {};
  const t = (text || "").replace(/\r/g, "");
  const s = splitSections(t);

  const asl = s.agesex || "";
  const am = asl.match(/(\d{1,3})\s*[- ]?\s*(?:years?|yrs?|y)\b[- ]*(?:old)?\s*(male|female)?/i) || asl.match(/^(\d{1,3})\s*[\/,\s]+\s*(male|female|m|f)\b/i);
  if (am && inRange(num(am[1]), 0, 120)) {
    out.age = am[1];
    const g = (am[2] || "").toLowerCase();
    if (g) out.gender = g.startsWith("f") ? "Female" : "Male";
  } else if (!out.gender) {
    const g = asl.match(/\b(male|female)\b/i);
    if (g) out.gender = g[1].toLowerCase() === "female" ? "Female" : "Male";
  }

  if (s.complaint) out.presentingComplaint = bulletsToLine(s.complaint);
  if (s.hpi) out.hpi = clean(s.hpi);

  if (s.primary) {
    Object.assign(out, parsePrimary(s.primary));
    const v = parseVitals(s.primary);
    if (Object.keys(v).length) out.vitals = v;
  }
  if (s.adjuvants) {
    const ex = parseExam(s.adjuvants, [
      { key: "ecg", re: "ECG" },
      { key: "vbg", re: "VBG|ABG" },
      { key: "echo", re: "Bedside\\s+Screening\\s+Echo|Echo" },
    ]);
    if (ex.ecg && !NIL.test(ex.ecg)) out.ecg = ex.ecg;
    if (ex.echo && !NIL.test(ex.echo)) out.echo = ex.echo;
  }

  if (s.signs) out.symptoms = bulletsToLine(s.signs);
  if (s.pmh) out.pastMedicalHistory = bulletsToLine(s.pmh);
  if (s.psh) out.surgicalHistory = bulletsToLine(s.psh);
  if (s.family && !NIL.test(s.family.trim())) out.familyHistory = bulletsToLine(s.family);
  if (s.allergies) out.allergies = bulletsToLine(s.allergies);

  const sec: Record<string, string> = {};
  if (s.general) {
    const g = bulletsToLine(s.general);
    if (g) sec.general = g;
  }
  if (s.systemic) {
    const ex = parseExam(s.systemic, [
      { key: "cvs", re: "CVS" },
      { key: "respiratory", re: "CHEST|RS|Respiratory(?:\\s+system)?" },
      { key: "abdomen", re: "Abdomen|P\\/A|PA" },
      { key: "cns", re: "CNS" },
      { key: "extremities", re: "Extremities(?:\\s+and\\s+Back)?" },
    ]);
    Object.assign(sec, ex);
  }
  if (Object.keys(sec).length) out.secondarySurvey = sec;
  if (s.psych) out.psychologicalAssessment = clean(s.psych).replace(/\n+/g, " ");

  if (s.inv) {
    const labs: { name: string }[] = [];
    const imaging: { name: string }[] = [];
    for (const name of splitTests(s.inv)) (IMAGING.test(name) ? imaging : labs).push({ name });
    if (labs.length) out.labs = labs;
    if (imaging.length) out.imaging = imaging;
  }
  if (s.plan) out.managementPlan = planLines(s.plan);
  if (s.dispo) out.disposition = clean(s.dispo).replace(/\n+/g, " ").replace(/^[\s\-–:]+/, "");
  if (s.ddx) out.differentialDiagnosis = clean(s.ddx).replace(/\n+/g, " ");
  if (s.resident) out.emResident = clean(s.resident).split("\n")[0].trim();
  if (s.consultant) out.emConsultant = clean(s.consultant).split("\n")[0].trim();
  return out;
}

/**
 * Put the sheet's own labelled text into the extraction. Text the sheet states under a clear label wins over
 * the model's shortened version; anything the sheet does not state is left exactly as extraction had it.
 */
export function applyPastedSheetSections(extraction: Record<string, any>, text: string): Record<string, any> {
  const p = parsePastedSheetSections(text);
  const out: Record<string, any> = { ...(extraction || {}) };
  const blank = (v: any) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || String(v).toLowerCase() === "unknown";

  if (p.age && blank(out.age)) out.age = p.age;
  if (p.gender && blank(out.gender) && blank(out.sex)) out.gender = p.gender;

  const win = (k: string, v: any) => { if (!blank(v)) out[k] = v; };
  win("presentingComplaint", p.presentingComplaint);
  win("hpi", p.hpi);
  win("symptoms", p.symptoms);
  win("pastMedicalHistory", p.pastMedicalHistory);
  win("surgicalHistory", p.surgicalHistory);
  win("familyHistory", p.familyHistory);
  win("allergies", p.allergies);
  win("ecg", p.ecg);
  win("echo", p.echo);
  win("psychologicalAssessment", p.psychologicalAssessment);
  win("managementPlan", p.managementPlan);
  win("disposition", p.disposition);
  win("differentialDiagnosis", p.differentialDiagnosis);
  win("emResident", p.emResident);
  win("emConsultant", p.emConsultant);
  for (const k of ["airway", "breathing", "circulation", "disability", "exposure"] as const) win(k, p[k]);

  if (p.symptoms) {
    out.sampleHistory = { ...(out.sampleHistory || {}), symptoms: p.symptoms };
    if (p.pastMedicalHistory) out.sampleHistory.pastHistory = p.pastMedicalHistory;
    if (p.allergies) out.sampleHistory.allergies = p.allergies;
  } else if (p.pastMedicalHistory || p.allergies) {
    out.sampleHistory = { ...(out.sampleHistory || {}) };
    if (p.pastMedicalHistory) out.sampleHistory.pastHistory = p.pastMedicalHistory;
    if (p.allergies) out.sampleHistory.allergies = p.allergies;
  }
  if (p.hpi && out.sampleHistory) out.sampleHistory.hpi = p.hpi;

  if (p.vitals) out.vitals = { ...(out.vitals || {}), ...p.vitals };
  // A tube / non-numeric V (e.g. "E1 VT M1") has no honest total: never keep a computed "3/15".
  if (out.vitals && /^\s*[a-z]/i.test(String(out.vitals.gcs_v ?? "")) && !p.vitals?.gcs) delete out.vitals.gcs;
  if (p.secondarySurvey) out.secondarySurvey = { ...(out.secondarySurvey || {}), ...p.secondarySurvey };

  if (p.labs) {
    out.labs = p.labs;
    out.investigationLabsOrdered = p.labs.map((l) => l.name).join(", ");
    out.investigations = p.labs.map((l, i) => ({ id: `inv-sheet-${i}`, testName: l.name, result: "Ordered", isAbnormal: false }));
  }
  if (p.imaging) {
    out.imaging = p.imaging;
    out.investigationImaging = p.imaging.map((l) => l.name).join(", ");
  }
  if (p.managementPlan) {
    out.managementPlan = p.managementPlan;
    delete out.plan; // the model's shorter plan list would repeat the sheet's own text
  }
  return out;
}