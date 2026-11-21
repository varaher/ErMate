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

export type ErLine =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }          // "Presenting Complaint:"
  | { kind: "subheading"; text: string }       // "ECG:", "CVS:" (inside a section)
  | { kind: "item"; text: string }             // indented line
  | { kind: "dash"; text: string }             // "- No known allergies."
  | { kind: "para"; text: string }             // paragraph (History of Present Illness)
  | { kind: "labelled"; label: string; text: string; arrow?: boolean }; // "Case Seen By: …", "Airway → …"

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

export function buildErCaseRecord(data: CaseSheetData): ErLine[] {
  const L: ErLine[] = [];
  const heading = (text: string) => L.push({ kind: "heading", text });
  const sub = (text: string) => L.push({ kind: "subheading", text });
  const items = (lines: string[], opts: { period?: boolean } = {}) => {
    const period = opts.period !== false;
    if (!lines.length) { L.push({ kind: "item", text: ND }); return; }
    lines.forEach((l) => L.push({ kind: "item", text: period ? sentence(l) : capFirst(l) }));
  };
  const dashes = (lines: string[]) => {
    if (!lines.length) { L.push({ kind: "dash", text: ND }); return; }
    lines.forEach((l) => L.push({ kind: "dash", text: sentence(l) }));
  };

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
  items(splitSentences(data.presentingComplaint));

  // Primary Assessment
  const ps = data.primarySurvey || ({} as CaseSheetData["primarySurvey"]);
  const vc = ps.vitalsContext || {};
  heading("Primary Assessment:");
  L.push({ kind: "labelled", arrow: true, label: "Airway", text: has(ps.airway) ? sentence(clean(ps.airway)) : ND });
  L.push({
    kind: "labelled", arrow: true, label: "Breathing",
    text: joinVitalsAndFindings([
      has(vc.rr) ? `RR: ${withUnit(vc.rr, "/min", /\/\s*min|per\s*min|bpm/i)}` : "",
      has(vc.spo2) ? `SpO2: ${spo2Text(vc.spo2)}` : "",
    ], clean(ps.breathing)),
  });
  const circ = takeCrt(clean(ps.circulation));
  L.push({
    kind: "labelled", arrow: true, label: "Circulation",
    text: joinVitalsAndFindings([
      circ.crt,
      has(vc.hr) ? `HR: ${withUnit(vc.hr, "/min", /\/\s*min|bpm|per\s*min/i)}` : "",
      has(vc.bp) ? `BP: ${withUnit(vc.bp, " mmHg", /mm\s*hg/i)}` : "",
    ], circ.rest),
  });
  {
    const gcs = gcsText(vc);
    const dis = clean(ps.disability);
    const grbs = has(vc.grbs) ? `GRBS: ${displayGrbs(vc.grbs)}` : "";
    const head = [gcs ? `GCS: ${gcs}` : "", dis ? (gcs ? continuation(dis) : dis) : ""].filter(Boolean).join(", ");
    const text = [head ? sentence(head) : "", grbs ? sentence(grbs) : ""].filter(Boolean).join(" ");
    L.push({ kind: "labelled", arrow: true, label: "Disability", text: text || ND });
  }
  L.push({
    kind: "labelled", arrow: true, label: "Exposure",
    text: joinVitalsAndFindings([has(vc.temp) ? `Temperature: ${displayTemperature(vc.temp)}` : ""], clean(ps.exposure)),
  });

  // Adjuvants to Primary
  heading("Adjuvants to Primary:");
  let anyAdjunct = false;
  if (data.ecg?.performed || has(data.ecg?.findings)) {
    anyAdjunct = true;
    sub("ECG:");
    dashes(has(data.ecg?.findings) ? splitSentences(data.ecg.findings) : ["Done, findings not documented"]);
  }
  const gas = data.vbgAbg;
  if (gas?.performed && ((gas.values || []).length || has(gas.notes))) {
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
  if (data.bedsideEcho?.performed || has(data.bedsideEcho?.findings)) {
    anyAdjunct = true;
    sub("Bedside Screening Echo:");
    items(has(data.bedsideEcho?.findings) ? splitSentences(data.bedsideEcho.findings) : ["Done, findings not documented"]);
  }
  if (data.efast?.performed || has(data.efast?.findings)) {
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
    const parts = [hpi, events && events.toLowerCase() !== hpi.toLowerCase() && !hpi.toLowerCase().includes(events.toLowerCase()) ? events : ""].filter(Boolean);
    if (parts.length) parts.forEach((p) => L.push({ kind: "para", text: sentence(p) }));
    else L.push({ kind: "para", text: ND });
  }

  // Secondary Survey
  heading("Secondary Survey:");
  heading("Signs and Symptoms:");
  items((data.symptoms || []).flatMap(splitSentences));
  heading("Past Medical History:");
  items((data.pastHistory || []).flatMap(splitSentences));
  if ((data.currentMedications || []).some(has)) {
    heading("Current Medications:");
    items((data.currentMedications || []).flatMap(splitSentences));
  }
  heading("Surgical History:");
  dashes(splitSentences(data.surgicalHistory));
  heading("Family / Gynae History:");
  dashes([...splitSentences(data.familyHistory), ...(has(data.lmp) ? [`LMP: ${clean(data.lmp)}`] : [])]);
  if (has(data.socialHistory)) {
    heading("Social History:");
    dashes(splitSentences(data.socialHistory));
  }
  heading("Allergies:");
  dashes((data.allergies || []).flatMap(splitSentences));
  if (has(data.lastMeal)) {
    heading("Last Meal:");
    dashes([clean(data.lastMeal)]);
  }

  // Examination
  const ss = data.secondarySurvey || ({} as CaseSheetData["secondarySurvey"]);
  heading("General Examination:");
  items(splitSentences(ss.general));
  heading("Systemic Examination:");
  sub("CVS:");
  dashes(splitSentences(ss.cvs));
  sub("CHEST:");
  items(splitSentences(ss.respiratory));
  sub("Abdomen:");
  items(splitSentences(ss.abdomen));
  sub("CNS:");
  items(splitSentences(ss.cns));
  sub("Extremities and Back:");
  dashes(splitSentences(ss.extremities));

  // Psychological Assessment
  heading("Psychological Assessment:");
  {
    const pa = data.psychologicalAssessment;
    const lines: string[] = [];
    if (pa) {
      lines.push(...splitSentences(pa.notes));
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
    items(lines);
  }

  // Investigations
  heading("Investigations:");
  {
    const inv: string[] = [
      ...splitList(data.investigationLabsOrdered),
      ...splitList(data.investigationImaging),
    ];
    (data.labs || []).forEach((panel) =>
      (panel.values || []).forEach((v) => inv.push(`${v.name}: ${v.value ?? v.text ?? "Pending"}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`))
    );
    (data.cultureResults || []).forEach((c) => inv.push(`${c.name}: ${clean(c.result) || "Pending"}`));
    splitSentences(data.investigationResultsSummary).forEach((s) => inv.push(sentence(s)));
    items(inv, { period: false });
  }

  // Treatment Plan
  heading("Treatment Plan:");
  {
    const tx: string[] = (data.treatmentGiven || []).map((t) => clean(t).replace(/\s*·\s*/g, " "));
    const notes = [...splitSentences(data.treatmentNotes)];
    if (has(data.treatment?.otherNotes) && clean(data.treatment?.otherNotes) !== clean(data.treatmentNotes)) {
      notes.push(...splitSentences(data.treatment?.otherNotes));
    }
    items([...tx, ...notes]);
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
    lines.push(...splitSentences(d.managementPlan));
    if (has(d.followUpAdvice)) lines.push(`Follow-up: ${clean(d.followUpAdvice)}`);
    if (has(d.observationNotes)) lines.push(...splitSentences(d.observationNotes));
    items(lines);
  }
  const review = data.consultation?.consultantReview;
  if (review && (has(review.reviewText) || has(review.reviewedBy))) {
    heading("Consultant Review:");
    items([
      `${has(review.reviewedBy) ? drName(review.reviewedBy) : "Consultant"}${has(review.timestamp) ? ` (${clean(review.timestamp)})` : ""}${has(review.reviewText) ? `: ${clean(review.reviewText)}` : ""}`,
    ]);
  }

  // Diagnosis
  if (has(data.provisionalDiagnosis)) {
    heading("Provisional Diagnosis:");
    items(splitSentences(data.provisionalDiagnosis));
  }
  heading("Differential Diagnosis:");
  {
    const dd = (data.differentials || [])
      .map((d) => `${clean(d.diagnosis)}${has(d.status) && !/^(suspected|considered|possible)$/i.test(clean(d.status)) ? ` (${clean(d.status)})` : ""}`)
      .filter((s) => s && !/^\(/.test(s));
    // Differentials list AND the free-text differential notes are both kept (the old sheet showed both).
    const ddNotes = splitSentences(data.provisionalDifferentialDiagnoses).filter((n) => !dd.some((x) => x.toLowerCase() === n.toLowerCase().replace(/[.\s]+$/, "")));
    items([...dd, ...ddNotes]);
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
  if (has(data.notes?.progressNotes)) {
    heading("Progress Notes:");
    splitSentences(data.notes.progressNotes).forEach((p) => L.push({ kind: "item", text: sentence(p) }));
  }
  if (has(data.notes?.addendum)) {
    heading("Addendum:");
    splitSentences(data.notes.addendum).forEach((p) => L.push({ kind: "item", text: sentence(p) }));
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