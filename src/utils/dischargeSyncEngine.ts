/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Discharge Summary Synchronization Engine
 * Pure functional helpers to derive initial discharge summary fields from ClinicalCase,
 * intelligently merge latest case updates into an active discharge draft without clobbering manual edits,
 * and avoid duplicate paragraphs or redundant bullet points.
 */

import type { ClinicalCase, DischargeInfo, DischargeOutcomeDetails } from '../types.ts';
import { interpretPediatricVital } from './pediatricRanges.ts';

/**
 * Notes that are really a whole case sheet, not a reassessment (25 Nov 2026, Neeraj: "the whole case sheet
 * gets displayed in course in hospital"). Quick discharge keeps the pasted sheet in progressNotes as the
 * source for review (the fact validator reads it); the course must never quote it.
 */
const SOURCE_RECORD_MARKER = /^\s*external clinical record\s*[—–-]+\s*source for review/i;
const CASE_SHEET_HEADINGS = [
  /presenting complaints?\s*:/i, /chief complaints?\s*:/i, /history of present(ing)? illness\s*:/i, /\bH\/?O\s*P\/?I\b/i,
  /primary (assessment|survey)\s*:/i, /secondary (assessment|survey)/i, /past (medical|surgical|history)/i,
  /general examination\s*:/i, /systemic examination\s*:/i, /allerg(y|ies)\s*:/i, /case record/i, /case seen by/i,
  /investigations?\s*:/i, /treatment (given|in er)\s*:/i, /disposition\s*:/i, /vitals?\s*(at|on)?[^:\n]{0,25}:/i,
];
export function isSourceRecordText(text: string | undefined | null): boolean {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (SOURCE_RECORD_MARKER.test(t)) return true;
  const headings = CASE_SHEET_HEADINGS.filter((re) => re.test(t)).length;
  return headings >= 3;
}

/** A saved course that quoted the pasted sheet (before 25 Nov 2026): rebuilt instead of shown. */
export function courseHasSourceDump(text: string | undefined | null): boolean {
  return /external clinical record\s*[—–-]+\s*source for review/i.test(String(text || ""));
}

/** Temperature with exactly one unit: "98.6°F" stays, "98.6" -> "98.6°F", "37.2" -> "37.2°C". */
export function formatTemperature(raw: string | undefined | null): { text: string; febrile: boolean; normal: boolean } | null {
  const t = String(raw || "").trim();
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const statedF = /°?\s*f\b|fahrenheit/i.test(t);
  const statedC = /°?\s*c\b|celsius/i.test(t);
  const isF = statedF || (!statedC && n > 45);
  const text = `${m[1]}°${isF ? "F" : "C"}`;
  const febrile = isF ? n >= 100.4 : n >= 38.0;
  const normal = isF ? n >= 97 && n < 99.5 : n >= 36.1 && n < 37.5;
  return { text, febrile, normal };
}
const pct = (v: string) => String(v).replace(/\s*%+\s*$/, "").trim();
const mmHg = (v: string) => String(v).replace(/\s*mm\s*hg\s*$/i, "").trim();
const perMin = (v: string) => String(v).replace(/\s*(\/\s*min|bpm|per\s*min(ute)?)\s*$/i, "").trim();

/**
 * Format primary assessment findings into a concise narrative string
 */
export function formatPrimaryAssessmentForCourse(c: ClinicalCase): string {
  const parts: string[] = [];
  if (c.primaryAssessment) {
    const pa = c.primaryAssessment;
    if (pa.airway || pa.airwayStatus) {
      parts.push(`Airway: ${pa.airway || pa.airwayStatus}`);
    }
    if (pa.breathing || pa.breathingStatus) {
      parts.push(`Breathing: ${pa.breathing || pa.breathingStatus}`);
    }
    if (pa.circulation || pa.circulationStatus) {
      parts.push(`Circulation: ${pa.circulation || pa.circulationStatus}`);
    }
    if (pa.disability || pa.disabilityStatus) {
      parts.push(`Disability: ${pa.disability || pa.disabilityStatus}`);
    }
    if (pa.exposure || pa.exposureStatus) {
      parts.push(`Exposure: ${pa.exposure || pa.exposureStatus}`);
    }
  }
  return parts.join("; ");
}

/**
 * Format procedures checked and other procedures into readable text
 */
export function formatProceduresText(c: ClinicalCase): string {
  const parts: string[] = [];
  if (c.proceduresChecked && c.proceduresChecked.length > 0) {
    const readable = c.proceduresChecked.map(p => {
      if (p === "foleys") return "Foley's Catheterization";
      if (p === "ng_tube") return "Nasogastric (NG) Tube";
      if (p === "iv_cannula") return "IV Cannulation";
      if (p === "intubation") return "Endotracheal Intubation";
      if (p === "central_line") return "Central Venous Line";
      if (p === "suturing") return "Wound Suturing";
      if (p === "splint") return "Splinting / Immobilization";
      if (p === "nebulization") return "Nebulization";
      return p.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    });
    parts.push(`Procedures performed: ${readable.join(", ")}.`);
  }
  if (c.otherProcedures && c.otherProcedures.trim()) {
    parts.push(c.otherProcedures.trim());
  }
  return parts.join(" ");
}

/**
 * Format consultations requested or reviewed into readable text
 */
export function formatConsultationsText(c: ClinicalCase): string {
  const parts: string[] = [];
  const consults = c.dispositionAndPlan?.consultsRequested || [];
  if (consults.length > 0) {
    parts.push(`Specialist consultations requested: ${consults.join(", ")}.`);
  }
  if (c.consultantReview?.reviewText) {
    const by = c.consultantReview.reviewedBy ? ` (${c.consultantReview.reviewedBy})` : "";
    parts.push(`Consultant Review${by}: ${c.consultantReview.reviewText}`);
  }
  return parts.join(" ");
}

/**
 * Format bedside adjuncts (ECG, eFAST/POCUS, ABG/VBG)
 */
export function formatBedsideAdjunctsText(c: ClinicalCase): string {
  const parts: string[] = [];
  if (c.adjuncts?.ecgDetails || c.primaryAssessment?.circulation) {
    if (c.adjuncts?.ecgDetails && c.adjuncts.ecgDetails.trim()) {
      parts.push(`ECG: ${c.adjuncts.ecgDetails.trim()}`);
    }
  }
  if (c.adjuncts?.efastNotes && c.adjuncts.efastNotes.trim()) {
    parts.push(`eFAST/POCUS: ${c.adjuncts.efastNotes.trim()}`);
  }
  const abg = c.primaryAssessment?.survey?.adjuncts?.abg;
  const abgText = (() => {
    if (c.adjuncts?.abgDetails && c.adjuncts.abgDetails.trim()) {
      return c.adjuncts.abgDetails.trim();
    }
    if (abg) {
      const summary = abg.finalDiagnosis || abg.clinicalInterpretation;
      const values = [
        abg.sampleType,
        abg.ph ? `pH ${abg.ph}` : null,
        abg.pco2 ? `pCO2 ${abg.pco2}` : null,
        abg.po2 ? `pO2 ${abg.po2}` : null,
        abg.hco3 ? `HCO3 ${abg.hco3}` : null,
        abg.lactate ? `Lactate ${abg.lactate}` : null,
        abg.be ? `BE ${abg.be}` : null,
        abg.sao2 ? `SaO2 ${abg.sao2}%` : null,
        abg.fio2 ? `FiO2 ${abg.fio2}%` : null,
        abg.na ? `Na ${abg.na}` : null,
        abg.k ? `K ${abg.k}` : null,
        abg.cl ? `Cl ${abg.cl}` : null,
        abg.ag ? `AG ${abg.ag}` : null,
        abg.glucose ? `Glucose ${abg.glucose}` : null,
        abg.hb ? `Hb ${abg.hb}` : null,
        abg.aa ? `A-a ${abg.aa}` : null,
      ].filter(Boolean).join(", ");
      if (summary && values) return `${summary} (${values})`;
      if (summary) return summary;
      if (values) return values;
    }
    return "";
  })();
  if (abgText) {
    parts.push(`Blood Gas (ABG/VBG): ${abgText}`);
  }
  return parts.join("; ");
}

/**
 * Patch C4A: Extract explicit preceding event related to the presentation.
 * Returns null if no explicit precipitating event occurred, or if event field
 * is merely an ordinary symptom duration or explicit negative history.
 */
export function extractPrecedingEvent(c: ClinicalCase): string | null {
  const rawCandidates = [
    c.sampleHistory?.events,
    (c.sampleHistory as any)?.eventsLeadingToPresentation,
    (c as any)?.mlcDetails?.incidentDetails,
    (c as any)?.mlcDetails?.mechanism,
    (c as any)?.traumaDetails?.mechanism,
    (c as any)?.events
  ].filter(Boolean) as string[];

  if (rawCandidates.length === 0) return null;

  for (const raw of rawCandidates) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // 1. Explicit negative history check (Section 6 & 19)
    if (/^(?:no\s+(?:history\s+of\s+)?(?:trauma|fall|accident|poisoning|bite|seizure|events?|precipitating\s+event)(?:\s+(?:or|and)\s+(?:trauma|fall|accident|poisoning|bite|seizure|events?|precipitating\s+event))*|nil|none|no\s+precipitating\s+event|denies\s+(?:trauma|fall|accident)|na|n\/a|not\s+applicable|not\s+documented)\.?$/i.test(trimmed)) {
      continue;
    }
    if (/^(?:no|denies)\s+(?:known\s+|reported\s+|alleged\s+)?(?:history\s+of\s+)?(?:trauma|fall|accident|poisoning|bite|injury|seizure)/i.test(trimmed)) {
      continue;
    }
    if (/\bno\s+precipitating\s+event\b/i.test(trimmed) && trimmed.length < 35) {
      continue;
    }

    // 2. Precipitating event keyword validation (Section 4, 5, 7)
    const PRECIPITATING_EVENT_KEYWORDS = /\b(?:accident|rta|road\s+traffic|collision|hit|struck|crash|skid|skidded|fall|fell|slip|slipped|trip|tripped|assault|beaten|fight|stab|burn|burns|scald|scalded|fire|drown|drowning|submersion|bite|bitten|sting|stung|snake|serpent|dog|animal|scorpion|wasp|bee|insect|poison|poisoning|ingest|ingested|ingestion|overdose|consumed|tablet|tablets|pills?|toxic|kerosene|pesticide|organophosphate|chemical|electric|shock|electrocution|seizure|convulsion|convulsions|fit|fits|syncope|syncopal|collapsed?|loss\s+of\s+consciousness|blackout|passed\s+out|fainted?|surgery|procedure|post-op|exertion|exertional|strenuous|heavy\s+lifting|lifting|trauma|injury|injured|wound|cut|laceration|fracture|blunt|penetrating|camp|forest|travel|journey|exposure|near-hanging|hanging|aspiration|choking|foreign\s+body)\b/i;

    const isPrecipitatingEvent = PRECIPITATING_EVENT_KEYWORDS.test(trimmed);

    // 3. Symptom duration check (Section 5)
    const SYMPTOM_DURATION_REGEX = /^(?:(?:fever|cough|cold|pain|abdominal\s+pain|chest\s+pain|headache|vomiting|vomit|loose\s+stools?|diarrhea|breathlessness|dyspnea|shortness\s+of\s+breath|nausea|weakness|giddiness|swelling|rash)\s+(?:for|since|x|lasting|from)\s+[^.]+)\.?$/i;

    if (!isPrecipitatingEvent && SYMPTOM_DURATION_REGEX.test(trimmed)) {
      continue;
    }

    if (!isPrecipitatingEvent && /\b(?:fever|cough|vomiting|headache|abdominal\s+pain)\b/i.test(trimmed) && /\b(?:days?|hours?|weeks?|since|morning|evening|yesterday)\b/i.test(trimmed)) {
      continue;
    }

    // 4. Deduplication against presenting complaint (Section 21)
    const pc = (c.patient?.presentingComplaint || "").trim().toLowerCase();
    if (pc && pc === trimmed.toLowerCase()) {
      continue;
    }

    return trimmed;
  }

  return null;
}

/**
 * Strip legacy or accidental section headings (e.g. "Presentation:", "Initial Assessment:")
 * from a Course in Hospital text, returning clean narrative paragraphs.
 */
export function stripCourseSectionHeadings(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#*\s*COURSE\s+IN\s+(?:EMERGENCY\s+DEPARTMENT|HOSPITAL)\s*:?\s*/gim, "")
    .replace(/(?:^|\n)\s*(?:Presentation|Events\s+Leading\s+to\s+Presentation|Initial\s+Assessment|Investigations?|Treatment\s+Given|Treatments?|Procedures?|Consultations?|Clinical\s+Course(?:\s*\/\s*Reassessment)?|Reassessment|Disposition)\s*:\s*/gim, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** How the ER visit ended — decides the closing paragraph of the course and what must be filled before Finalise. */
export type OutcomeKind = "discharge" | "request" | "referral" | "lama" | "death" | "admit" | "observation" | "absconded" | "other" | "none";

export function classifyDisposition(status: string | undefined | null): OutcomeKind {
  const s = String(status || "").trim().toLowerCase();
  if (!s || s === "pending / not documented") return "none";
  if (/death|expired|deceased|\bdied\b|brought dead/.test(s)) return "death";
  if (/against medical advice|\bdama\b|\blama\b|left against/.test(s)) return "lama";
  if (/abscond/.test(s)) return "absconded";
  if (/refer|transfer/.test(s)) return "referral";
  if (/request/.test(s)) return "request";
  if (/admit|icu|\bward\b|\bot\b|theatre|theater/.test(s)) return "admit";
  if (/observation/.test(s)) return "observation";
  if (/discharge/.test(s)) return "discharge";
  return "other";
}

/** Details the doctor records for a referral, LAMA or death (Discharge Summary → Outcome details). */
export type OutcomeDetails = DischargeOutcomeDetails;

const filled = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s && !/^(not documented|not recorded|n\/?a|nil|none|-|pending)$/i.test(s) ? s : "";
};
const yes = (v: unknown) => /^(y|yes|true|done|explained)/i.test(String(v ?? "").trim());
const noDot = (s: string) => s.trim().replace(/[.\s]+$/, "");
// Lower-case the first letter of a phrase, but keep acronyms ("ALS ambulance", "ICU").
const lowerFirst = (s: string) => (s && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const andJoin = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** What still has to be recorded for this outcome. `required` blocks Finalise; `advised` is a reminder. */
export function outcomeChecklist(kind: OutcomeKind, d: OutcomeDetails | undefined, extra: { condition?: string; vitalsAtExit?: boolean; isMlc?: boolean; followUp?: string } = {}): { required: string[]; advised: string[] } {
  const o = d || {};
  const required: string[] = [];
  const advised: string[] = [];
  const need = (ok: unknown, label: string, list = required) => { if (!filled(ok)) list.push(label); };
  if (kind === "lama") {
    need(o.counselledPerson, "Who was counselled (name)");
    need(o.counselledRelation, "Their relationship to the patient");
    if (!yes(o.risksExplained)) required.push("Risks of leaving explained, including death");
    need(o.lamaFormSignedAt, "Time the LAMA form was signed");
    need(o.witness, "Witness");
    need(extra.condition, "Condition at the time of leaving");
    if (!extra.vitalsAtExit) required.push("Vitals at the time of leaving");
    if (extra.isMlc) need(o.policeInformed, "Police informed (MLC)");
  } else if (kind === "death") {
    need(o.timeOfDeath, "Date and time of death");
    need(o.causeOfDeath, "Cause of death");
    need(o.declaredBy, "Declared by (doctor)");
    need(o.bodyHandedTo, "Body handed over to (name, relationship) or mortuary");
    need(o.resuscitation, "Resuscitation done (or not attempted, with reason)", advised);
    if (extra.isMlc) need(o.policeInformed, "Police informed (MLC)");
  } else if (kind === "referral") {
    need(o.referredTo, "Referred to (hospital / department)");
    need(o.referralReason, "Reason for referral");
    need(o.transportMode, "Mode of transport");
    need(extra.condition, "Condition at the time of transfer");
    if (!extra.vitalsAtExit) required.push("Vitals at the time of transfer");
    need(o.acceptingDoctor, "Accepting doctor", advised);
    need(o.transferSupport, "Support during transfer (oxygen, ventilator, infusions)", advised);
    if (extra.isMlc) need(o.policeInformed, "Police informed (MLC)", advised);
  } else if (kind === "discharge" || kind === "request") {
    need(extra.condition, "Condition at discharge", advised);
    need(extra.followUp, "Follow-up advice", advised);
  }
  return { required, advised };
}

/** True when HR, BP and SpO2 are all recorded and in the normal adult range (used for "hemodynamically stable"). */
function adultVitalsAllNormal(v: any): boolean {
  const bp = String(v?.bp || "").match(/(\d+)\s*\/\s*(\d+)/);
  const hr = parseInt(String(v?.hr || ""), 10);
  const sp = parseInt(String(v?.spo2 || ""), 10);
  if (!bp || !Number.isFinite(hr) || !Number.isFinite(sp)) return false;
  const sbp = parseInt(bp[1], 10);
  return sbp >= 90 && sbp < 160 && hr >= 60 && hr <= 100 && sp >= 95;
}

function drugText(t: any): string {
  const route = String(t.route || "").trim();
  const r = /^(iv|im|sc|s\/c|io|in|pr|sl)$/i.test(route) ? route.toUpperCase() : route.toLowerCase();
  return [String(t.drugName || "").trim(), String(t.dose || "").trim(), r].filter(Boolean).join(" ");
}

/**
 * Course in Hospital (25 Nov 2026, from Neeraj's sample summaries).
 * The summary already prints the complaints, vitals, primary survey and examination, so the course does not
 * repeat them. It tells the story in this order:
 *   1. "presented with the above-mentioned complaints" (+ referral source, preceding event)
 *   2. one status phrase: "hemodynamically stable" only when HR, BP and SpO2 are recorded and normal;
 *      otherwise only the abnormal values that matter (hypotension, tachycardia, hypoxia, fever, GCS, GRBS)
 *   3. investigations, treatment (drugs with doses; a list when more than three), procedures, consultations
 *   4. observation / reassessment — only from a real note, never invented
 *   5. a closing paragraph for the outcome: discharge, discharge at request, referral, LAMA, death, admission
 * Nothing is added that is not documented (Rule 8); missing outcome details are listed by outcomeChecklist().
 */
export function deriveInitialCourseInHospital(c: ClinicalCase): string {
  // Age must be a real number: a blank/unknown age is NOT a child (Number("") and Number(null) are 0).
  const ageNum = parseFloat(String(c.patient?.age ?? ""));
  const isPed = c.isPediatric === true || (Number.isFinite(ageNum) && ageNum <= 16);
  const subject = isPed ? "The child" : "The patient";
  const subj = subject.toLowerCase();
  const info: any = c.dischargeInfo || {};

  // --- 1. Presentation ---
  const p1: string[] = [];
  const rawPc = (c.patient?.presentingComplaint || "").trim();
  const hasPc = Boolean(rawPc) && !/^quick discharge intake$/i.test(rawPc);
  const referredFrom = filled((c.patient as any)?.referredFrom) || filled((c as any).referredFrom);
  const referredIn = referredFrom ? `, referred from ${referredFrom}` : String(c.patient?.arrivalMode || "") === "Referred" ? " on referral" : "";
  p1.push(`${subject} presented to the Emergency Department${hasPc ? " with the above-mentioned complaints" : ""}${referredIn}.`);

  const event = extractPrecedingEvent(c);
  if (event) {
    const ev = noDot(event);
    if (/^(?:symptoms?|pain|onset|the\s+patient|patient|the\s+child|child|alleged|reported|witnessed|h\/o|history)\b/i.test(ev)) p1.push(`${ev.charAt(0).toUpperCase()}${ev.slice(1)}.`);
    else p1.push(`Symptoms followed ${lowerFirst(ev)}.`);
  }

  // Pediatric Assessment Triangle: one phrase
  if (isPed && c.pediatricDetails) {
    const pd = c.pediatricDetails as any;
    const patNormal = pd.patNormal === true || pd.pediatricTriangle?.status === "normal" ||
      (pd.patAppearance === "normal" && pd.patWorkOfBreathing === "normal" && pd.patCirculation === "normal");
    if (patNormal) p1.push("The Pediatric Assessment Triangle was documented as normal.");
    else {
      const ptDetails: string[] = [];
      const app = pd.patAppearance || pd.pediatricTriangle?.appearance;
      if (app && app !== "normal") ptDetails.push(`appearance (${app})`);
      const wob = pd.patWorkOfBreathing || pd.pediatricTriangle?.workOfBreathing;
      if (wob && wob !== "normal") ptDetails.push(`work of breathing (${wob})`);
      const circ = pd.patCirculation || pd.pediatricTriangle?.circulation;
      if (circ && circ !== "normal") ptDetails.push(`circulation to skin (${circ})`);
      if (ptDetails.length) p1.push(`The Pediatric Assessment Triangle showed abnormal ${ptDetails.join("; ")}.`);
    }
  }

  // --- 2. Status: one phrase, abnormal values only ---
  if (c.vitals) {
    const v: any = c.vitals;
    const tokens: string[] = [];
    const bpM = String(v.bp || "").match(/(\d+)\s*\/\s*(\d+)/);
    const sbp = bpM ? parseInt(bpM[1], 10) : null;
    const hrNum = parseInt(String(v.hr || ""), 10);
    const rrNum = parseInt(String(v.rr || ""), 10);
    const spNum = parseInt(String(v.spo2 || ""), 10);
    const tempInfo = formatTemperature(v.temp);
    const gcsTxt = String(v.gcs || "").trim();
    const gcsNum = parseInt(gcsTxt, 10);
    const alteredGcs = gcsTxt && !/^15(\/15)?$/.test(gcsTxt) && (Number.isFinite(gcsNum) ? gcsNum < 15 : /^E\d/i.test(gcsTxt));
    const grbs = parseInt(String(v.grbs || ""), 10);

    if (isPed) {
      const ageYears = c.patient?.age as any;
      const flag = (param: "hr" | "rr" | "sbp" | "spo2", value: any) => interpretPediatricVital(param, value, ageYears);
      const word = (i: any) => (i?.status === "High" ? "high for age" : i?.status === "Low" ? "low for age" : "");
      const bpW = bpM ? word(flag("sbp", bpM[1])) : "";
      const hrW = Number.isFinite(hrNum) ? word(flag("hr", v.hr)) : "";
      const rrW = Number.isFinite(rrNum) ? word(flag("rr", v.rr)) : "";
      const spW = Number.isFinite(spNum) ? word(flag("spo2", v.spo2)) : "";
      if (bpW) tokens.push(`blood pressure ${mmHg(v.bp)} mmHg (${bpW})`);
      if (hrW) tokens.push(`heart rate ${perMin(v.hr)}/min (${hrW})`);
      if (rrW) tokens.push(`respiratory rate ${perMin(v.rr)}/min (${rrW})`);
      if (spW) tokens.push(`oxygen saturation ${pct(v.spo2)}% (${spW})`);
    } else {
      if (sbp !== null && sbp <= 90) tokens.push(`hypotension with blood pressure ${mmHg(v.bp)} mmHg`);
      else if (sbp !== null && sbp >= 180) tokens.push(`elevated blood pressure of ${mmHg(v.bp)} mmHg`);
      if (Number.isFinite(hrNum) && hrNum > 100) tokens.push(`pulse of ${perMin(v.hr)}/min`);
      else if (Number.isFinite(hrNum) && hrNum < 60) tokens.push(`bradycardia with pulse ${perMin(v.hr)}/min`);
      if (Number.isFinite(spNum) && spNum < 94) tokens.push(`oxygen saturation ${pct(v.spo2)}%`);
      if (Number.isFinite(rrNum) && (rrNum > 22 || rrNum < 10)) tokens.push(`respiratory rate ${perMin(v.rr)}/min`);
    }
    if (tempInfo?.febrile) tokens.push(`fever of ${tempInfo.text}`);
    if (alteredGcs) tokens.push(`GCS ${gcsTxt}`);
    if (Number.isFinite(grbs) && (grbs >= 250 || grbs < 70)) tokens.push(`GRBS ${grbs} mg/dL`);

    if (tokens.length) p1.push(`Initial assessment revealed ${tokens.join(", ")}.`);
    else if (!isPed && adultVitalsAllNormal(v)) p1.push(`${subject} was hemodynamically stable.`);
  }

  // --- 3. Management ---
  const p2: string[] = [];
  const inv: string[] = [];
  if (filled(c.investigationLabsOrdered)) inv.push(`Blood investigations including ${noDot(String(c.investigationLabsOrdered))} were sent.`);
  if (filled(c.investigationImaging)) {
    const img = String(c.investigationImaging).trim();
    inv.push(/[.]$/.test(img) ? img : `${img} was done.`);
  }
  if (c.investigations && c.investigations.length > 0) {
    // "Ordered"/"Pending" are order statuses, not results: never report them as "showed ...".
    const NOT_A_RESULT = /^\s*(pending|ordered|sent|awaited|awaiting|in progress|not (yet )?(done|resulted)|n\/?a)\.?\s*$/i;
    const results = c.investigations
      .filter(i => i.result && !NOT_A_RESULT.test(String(i.result)))
      .map(i => `${i.testName} showed ${i.result}`)
      .join(", ");
    if (results) inv.push(`Investigations revealed ${results}.`);
  }
  if (filled(c.investigationResultsSummary)) {
    const rs = String(c.investigationResultsSummary).trim();
    if (!inv.some(s => s.toLowerCase().includes(rs.toLowerCase()))) inv.push(/[.]$/.test(rs) ? rs : `${rs}.`);
  }
  if (inv.length) p2.push(inv.join(" "));

  const drugs = (c.treatments || []).map(drugText).filter(Boolean);
  const infusions = (c.infusions || []).map((i: any) => [i.fluidName, i.dose, i.rate ? `at ${i.rate}` : ""].filter(Boolean).join(" ").trim()).filter(Boolean);
  const allMeds = [...drugs, ...infusions];
  let medsList = "";
  if (allMeds.length > 3) medsList = `Medications given:\n${allMeds.map((m) => `• ${m}`).join("\n")}`;
  else if (allMeds.length) p2.push(`${subject} was treated with ${andJoin(allMeds)}.`);
  if (filled(c.treatmentNotes)) {
    const tn = String(c.treatmentNotes).trim();
    p2.push(/[.]$/.test(tn) ? tn : `${tn}.`);
  }
  const procStr = formatProceduresText(c);
  if (procStr) p2.push(procStr);
  const consults = (c.dispositionAndPlan?.consultsRequested || []).map((x) => String(x).trim()).filter(Boolean);
  if (consults.length) p2.push(`${consults.join(" and ")} consultation${consults.length > 1 ? "s were" : " was"} sought.`);
  if (c.consultantReview?.reviewText) {
    const by = c.consultantReview.reviewedBy ? ` (${c.consultantReview.reviewedBy})` : "";
    p2.push(`Consultant review${by}: ${noDot(c.consultantReview.reviewText)}.`);
  }

  // --- 4. Observation / reassessment: only from a real note ---
  const p3: string[] = [];
  if (filled(c.progressNotes) && !isSourceRecordText(c.progressNotes)) {
    const n = noDot(String(c.progressNotes));
    p3.push(`On reassessment, ${n}.`);
  } else if (filled(c.dispositionDetails?.observationNotes)) {
    p3.push(`On observation, ${noDot(String(c.dispositionDetails!.observationNotes))}.`);
  }

  // --- 5. Outcome ---
  const p4: string[] = [];
  const dispStatus = info.dispositionStatus || info.dispositionType || c.dispositionDetails?.dispositionType ||
    (c.dispositionAndPlan as any)?.disposition || c.dispositionAndPlan?.dispositionStatus;
  const kind = classifyDisposition(dispStatus);
  const o: OutcomeDetails = info.outcome || {};
  const followUp = filled(info.followUpPlan) || filled(c.dispositionAndPlan?.followUpAdvice) || filled((c.dispositionDetails as any)?.followUpAdvice);
  const condRaw = filled(info.dischargeCondition) || filled(info.conditionAtDischarge);
  const cond = condRaw ? condRaw.toLowerCase() : "";
  const condPhrase = cond ? (/stable/.test(cond) && !/unstable/.test(cond) ? "a clinically stable condition" : `${/condition/.test(cond) ? cond : `${cond} condition`}`) : "";
  const inCond = condPhrase ? ` in ${/^a /.test(condPhrase) ? condPhrase : `a ${condPhrase}`}` : "";

  if (kind === "discharge") {
    p4.push(`Hence, ${subj} was discharged from the Emergency Department${inCond}${followUp ? ` with advice for ${noDot(followUp)}` : ""}.`);
  } else if (kind === "request") {
    p4.push(`In view of the decision to seek outpatient management, ${subj} was discharged at request${inCond}${followUp ? ` with advice for ${noDot(followUp)}` : " with advice for outpatient follow-up"} and instructions to return to the Emergency Department in case of worsening symptoms.`);
  } else if (kind === "referral") {
    const to = filled(o.referredTo);
    const why = filled(o.referralReason);
    const s1 = `${why ? `In view of ${lowerFirst(noDot(why))}, ` : ""}${why ? subj : subject} was referred${to ? ` to ${noDot(to)}` : ""} for further management${filled(o.acceptingDoctor) ? `, after discussion with ${noDot(o.acceptingDoctor!)}` : ""}.`;
    p4.push(s1.charAt(0).toUpperCase() + s1.slice(1));
    const how = filled(o.transportMode);
    const sup = filled(o.transferSupport);
    if (how || sup || condPhrase) p4.push(`${subject} was transferred${how ? ` by ${lowerFirst(noDot(how))}` : ""}${sup ? ` with ${lowerFirst(noDot(sup))}` : ""}${inCond}.`);
  } else if (kind === "lama") {
    const who = filled(o.counselledPerson);
    const rel = filled(o.counselledRelation);
    const isSelf = /^(self|patient|himself|herself)$/i.test(rel);
    // Counselling is written only when it was recorded (Rule 8).
    if (who || rel || yes(o.risksExplained)) {
      const party = isSelf ? subject : rel ? `The ${lowerFirst(rel)}${who ? ` (${who})` : ""}` : who ? who : "The bystanders";
      const verb = party === "The bystanders" ? "were" : "was";
      p4.push(`${party} ${verb} counselled regarding the clinical condition and the need for further treatment${yes(o.risksExplained) ? ", and the risks of leaving, including deterioration and death, were explained" : ""}.`);
      p4.push(`Despite counselling, ${isSelf ? subj : "they"} chose to leave against medical advice${filled(o.lamaFormSignedAt) ? `, and the LAMA form was signed at ${noDot(o.lamaFormSignedAt!)}` : ""}${filled(o.witness) ? ` in the presence of ${noDot(o.witness!)}` : ""}.`);
    }
    if (filled(o.policeInformed)) p4.push(`Police were informed (${noDot(o.policeInformed!)}).`);
    p4.push(`Hence, ${subj} was discharged against medical advice${inCond}.`);
  } else if (kind === "death") {
    const resus = filled(o.resuscitation);
    const t = filled(o.timeOfDeath);
    const by = filled(o.declaredBy);
    const notTried = /not attempted|\bdnr\b|withheld|not done/i.test(resus);
    if (resus) p4.push(notTried ? `Resuscitation was not attempted (${noDot(resus)}).` : `Resuscitation was done (${noDot(resus)}).`);
    p4.push(`${resus && !notTried ? `Despite resuscitative measures, ${subj}` : subject} was declared dead${t ? ` at ${noDot(t)}` : ""}${by ? ` by ${noDot(by)}` : ""}.`);
    if (filled(o.causeOfDeath)) p4.push(`Cause of death: ${noDot(o.causeOfDeath!)}.`);
    if (filled(o.policeInformed)) p4.push(`Police were informed (${noDot(o.policeInformed!)}).`);
    if (filled(o.bodyHandedTo)) p4.push(`The body was handed over to ${noDot(o.bodyHandedTo!)}.`);
  } else if (kind === "admit") {
    p4.push(`In view of the clinical condition, ${subj} was ${/^admitted/i.test(String(dispStatus)) ? lowerFirst(noDot(String(dispStatus))) : `admitted (${noDot(String(dispStatus))})`}.`);
  } else if (kind === "observation") {
    p4.push(`${subject} remains under observation in the Emergency Department.`);
  } else if (kind === "absconded") {
    p4.push(`${subject} left the Emergency Department without informing the treating team.`);
  } else if (kind === "other") {
    p4.push(`Disposition: ${noDot(String(dispStatus))}.`);
  }

  const paragraphs = [
    p1.join(" "),
    [p2.join(" "), medsList].filter(Boolean).join("\n"),
    p3.join(" "),
    p4.join(" "),
  ].map(p => p.trim()).filter(Boolean);

  return paragraphs.join("\n\n");
}

export const CANONICAL_COURSE_HEADINGS = [
  "Presentation",
  "Events Leading to Presentation",
  "Initial Assessment",
  "Investigations",
  "Treatment Given",
  "Procedures",
  "Consultations",
  "Clinical Course",
  "Disposition"
] as const;

export type CanonicalCourseHeading = typeof CANONICAL_COURSE_HEADINGS[number];

const CANONICAL_HEADING_MAP: Record<string, CanonicalCourseHeading> = {
  "presentation": "Presentation",
  "events leading to presentation": "Events Leading to Presentation",
  "events": "Events Leading to Presentation",
  "initial assessment": "Initial Assessment",
  "investigations": "Investigations",
  "investigation": "Investigations",
  "treatment given": "Treatment Given",
  "treatments given": "Treatment Given",
  "treatment": "Treatment Given",
  "procedures": "Procedures",
  "procedure": "Procedures",
  "consultations": "Consultations",
  "consultation": "Consultations",
  "clinical course": "Clinical Course",
  "clinical course / reassessment": "Clinical Course",
  "reassessment": "Clinical Course",
  "disposition": "Disposition"
};

function matchCanonicalHeading(line: string): { canonical: CanonicalCourseHeading; inlineContent: string } | null {
  const cleanLine = line.replace(/^\s*#+\s*|\*+/g, "").trim();
  const m = cleanLine.match(/^([A-Za-z\s/]+?)\s*:\s*(.*)$/);
  if (!m) return null;
  const key = m[1].trim().toLowerCase();
  const canonical = CANONICAL_HEADING_MAP[key];
  if (!canonical) return null;
  return { canonical, inlineContent: m[2].trim() };
}

interface ParsedStructuredCourse {
  title: string;
  preamble: string;
  sections: Map<CanonicalCourseHeading, string>;
}

function parseStructuredCourse(text: string): ParsedStructuredCourse {
  if (!text) {
    return { title: "", preamble: "", sections: new Map() };
  }
  const lines = text.split(/\r?\n/);
  let title = "";
  const preambleLines: string[] = [];
  const sections = new Map<CanonicalCourseHeading, string>();

  let currentHeading: CanonicalCourseHeading | null = null;
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!title && !currentHeading && preambleLines.length === 0 && /^#*\s*COURSE\s+IN\s+(?:EMERGENCY\s+DEPARTMENT|HOSPITAL)/i.test(trimmed)) {
      title = "COURSE IN EMERGENCY DEPARTMENT";
      continue;
    }

    const headingMatch = matchCanonicalHeading(rawLine);
    if (headingMatch) {
      if (currentHeading) {
        sections.set(currentHeading, currentLines.join("\n").trim());
      }
      currentHeading = headingMatch.canonical;
      currentLines = [];
      if (headingMatch.inlineContent) {
        currentLines.push(headingMatch.inlineContent);
      }
    } else {
      if (currentHeading) {
        currentLines.push(rawLine);
      } else {
        preambleLines.push(rawLine);
      }
    }
  }

  if (currentHeading) {
    sections.set(currentHeading, currentLines.join("\n").trim());
  }

  return {
    title: title || (sections.size > 0 ? "COURSE IN EMERGENCY DEPARTMENT" : ""),
    preamble: preambleLines.join("\n").trim(),
    sections
  };
}

function normalizeForComparison(s: string): string {
  if (!s) return "";
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractFactualUnits(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const units: string[] = [];
  for (const line of lines) {
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(Boolean);
    if (sentences.length > 0) {
      units.push(...sentences);
    } else {
      units.push(line);
    }
  }
  return units;
}

function isUnitRepresentedInText(unit: string, text: string): boolean {
  const normUnit = normalizeForComparison(unit);
  if (!normUnit) return true;
  const normText = normalizeForComparison(text);
  if (normText.includes(normUnit)) return true;
  const stripPunct = (s: string) => s.replace(/[.,;!?]+$/g, "").trim();
  if (normText.includes(stripPunct(normUnit))) return true;
  return false;
}

function appendNewFactsToLocal(localBody: string, newFacts: string[]): string {
  let result = localBody.trim();
  for (const fact of newFacts) {
    if (!result) {
      result = fact;
    } else {
      if (result.endsWith(".") || result.endsWith("!") || result.endsWith("?")) {
        result += " " + fact;
      } else if (result.includes("\n")) {
        result += "\n" + fact;
      } else {
        result += ". " + fact;
      }
    }
  }
  return result;
}

/**
 * Patch C4B: Three-way merge of automatically generated Course with clinician manual edits.
 * BASE = previous automatically generated course
 * LOCAL = current clinician text in textbox (including manual edits)
 * NEXT = newly generated course from ClinicalCase
 */
export function mergeAutoCoursePreservingManualEdits(
  previousAutoCourse: string,
  currentClinicianText: string,
  nextAutoCourse: string
): string {
  const normPrev = normalizeForComparison(previousAutoCourse);
  const normCurr = normalizeForComparison(currentClinicianText);
  const normNext = normalizeForComparison(nextAutoCourse);

  // If clinician made NO manual edits, take nextAutoCourse cleanly
  if (normCurr === normPrev) {
    return nextAutoCourse;
  }

  // If next auto course is identical to previous, clinician edits remain
  if (normNext === normPrev) {
    return currentClinicianText;
  }

  const base = parseStructuredCourse(previousAutoCourse);
  const local = parseStructuredCourse(currentClinicianText);
  const next = parseStructuredCourse(nextAutoCourse);

  // If both local and next are pure narrative without canonical headings:
  if (local.sections.size === 0 && next.sections.size === 0) {
    const prevUnits = extractFactualUnits(previousAutoCourse);
    const nextUnits = extractFactualUnits(nextAutoCourse);
    const genuinelyNewFacts = nextUnits.filter(nu => {
      const inPrev = prevUnits.some(pu => normalizeForComparison(pu) === normalizeForComparison(nu));
      if (inPrev) return false;
      return !isUnitRepresentedInText(nu, currentClinicianText);
    });

    if (genuinelyNewFacts.length === 0) {
      return currentClinicianText;
    }
    const newText = genuinelyNewFacts.join(". ");
    return `${currentClinicianText.trim()}\n\n${newText.endsWith(".") ? newText : newText + "."}`.trim();
  }

  const mergedSections = new Map<CanonicalCourseHeading, string>();

  for (const heading of CANONICAL_COURSE_HEADINGS) {
    const baseBody = base.sections.get(heading) ?? null;
    const localBody = local.sections.get(heading) ?? null;
    const nextBody = next.sections.get(heading) ?? null;

    const hasBase = baseBody !== null;
    const hasLocal = localBody !== null;
    const hasNext = nextBody !== null;

    if (!hasBase && !hasLocal && !hasNext) {
      continue;
    }

    // Rule 4 (D): BASE absent, LOCAL absent, NEXT present -> Add NEXT in canonical order
    if (!hasBase && !hasLocal && hasNext) {
      mergedSections.set(heading, nextBody);
      continue;
    }

    // Rule 5 (E): BASE present, LOCAL absent -> Intentional clinician deletion
    if (hasBase && !hasLocal) {
      if (hasNext) {
        // Delta check: do NOT restore old deleted facts; append only genuinely new facts if any
        const baseUnits = extractFactualUnits(baseBody);
        const nextUnits = extractFactualUnits(nextBody);
        const genuinelyNewFacts = nextUnits.filter(nu => !baseUnits.some(bu => normalizeForComparison(bu) === normalizeForComparison(nu)));
        if (genuinelyNewFacts.length > 0) {
          const joined = genuinelyNewFacts.join(". ");
          mergedSections.set(heading, joined.endsWith(".") ? joined : joined + ".");
        }
      }
      continue;
    }

    // Clinician created this canonical section manually, absent in base and next
    if (!hasBase && hasLocal && !hasNext) {
      mergedSections.set(heading, localBody);
      continue;
    }

    // Section present in base and local, but omitted in next
    if (hasBase && hasLocal && !hasNext) {
      if (normalizeForComparison(localBody) !== normalizeForComparison(baseBody)) {
        mergedSections.set(heading, localBody);
      }
      continue;
    }

    // Both Local and Next are present
    if (hasLocal && hasNext) {
      const localMatchesBase = hasBase && normalizeForComparison(localBody) === normalizeForComparison(baseBody);
      const nextMatchesBase = hasBase && normalizeForComparison(nextBody) === normalizeForComparison(baseBody);

      // Rule 1 (A): LOCAL == BASE -> safe to replace with NEXT
      if (localMatchesBase) {
        mergedSections.set(heading, nextBody);
        continue;
      }

      // Rule 2 (B): LOCAL != BASE, NEXT == BASE -> preserve LOCAL exactly
      if (!localMatchesBase && nextMatchesBase) {
        mergedSections.set(heading, localBody);
        continue;
      }

      // Rule 3 (C): LOCAL != BASE, NEXT != BASE -> preserve LOCAL, append only genuinely new facts from NEXT
      const baseUnits = hasBase ? extractFactualUnits(baseBody) : [];
      const nextUnits = extractFactualUnits(nextBody);
      const genuinelyNewFacts = nextUnits.filter(nu => {
        const inBase = baseUnits.some(bu => normalizeForComparison(bu) === normalizeForComparison(nu));
        if (inBase) return false;
        return !isUnitRepresentedInText(nu, localBody);
      });

      if (genuinelyNewFacts.length > 0) {
        mergedSections.set(heading, appendNewFactsToLocal(localBody, genuinelyNewFacts));
      } else {
        mergedSections.set(heading, localBody);
      }
    }
  }

  const output: string[] = [];
  const title = local.title || next.title || base.title || "COURSE IN EMERGENCY DEPARTMENT";
  if (title && (mergedSections.size > 0 || local.preamble)) {
    output.push(title);
  }

  if (local.preamble) {
    output.push(local.preamble);
  }

  for (const heading of CANONICAL_COURSE_HEADINGS) {
    const body = mergedSections.get(heading);
    if (body && body.trim()) {
      output.push(`${heading}:\n${body.trim()}`);
    }
  }

  return output.join("\n\n").trim();
}

/**
 * Format structured investigations into text
 */
export function formatInvestigationsText(c: ClinicalCase): string {
  const lines: string[] = [];

  // Laboratory investigations
  if (c.investigations && c.investigations.length > 0) {
    c.investigations.forEach(i => {
      const val = i.result ? `: ${i.result}` : ": Done";
      lines.push(`${i.testName}${val}`);
    });
  }

  // Free-text lab summary if present and not redundant
  if (c.investigationLabsOrdered && c.investigationLabsOrdered.trim()) {
    const labs = c.investigationLabsOrdered.trim();
    if (!lines.some(l => l.toLowerCase().includes(labs.toLowerCase()))) {
      lines.push(`Ordered Labs: ${labs}`);
    }
  }

  // Diagnostic imaging
  if (c.investigationImaging && c.investigationImaging.trim()) {
    lines.push(`Diagnostic Imaging: ${c.investigationImaging.trim()}`);
  }

  // Results summary
  if (c.investigationResultsSummary && c.investigationResultsSummary.trim()) {
    lines.push(`Results Summary: ${c.investigationResultsSummary.trim()}`);
  }

  return lines.join("\n").trim();
}

/**
 * Format outpatient / discharge medications from explicit dischargeInfo only.
 * NEVER derives or falls back to ER treatments, infusions, or acute orders.
 */
export function formatDischargeMedicationsText(c: ClinicalCase): string {
  const explicit: any = c.dischargeInfo?.dischargeMedications;
  if (!explicit) return "";
  if (typeof explicit === "string") return explicit.trim();
  if (Array.isArray(explicit)) return explicit.filter(Boolean).join("\n").trim();
  return String(explicit).trim();
}

/**
 * Intelligently merge new investigations from ClinicalCase into existing investigations text
 * Preserves user's custom formatting or extra typed notes while appending new tests.
 */
export function mergeInvestigations(existingText: string, c: ClinicalCase): string {
  const newTests = formatInvestigationsText(c);
  if (!existingText || !existingText.trim()) {
    return newTests;
  }
  if (!newTests) {
    return existingText;
  }

  const existingLower = existingText.toLowerCase();
  const newLines = newTests.split("\n").map(l => l.trim()).filter(Boolean);
  const toAppend: string[] = [];

  for (const line of newLines) {
    // Check if key part of test already exists
    const testNameKey = line.split(":")[0]?.trim().toLowerCase();
    if (testNameKey && !existingLower.includes(testNameKey)) {
      toAppend.push(line);
    }
  }

  if (toAppend.length === 0) {
    return existingText;
  }

  return `${existingText.trim()}\n${toAppend.join("\n")}`.trim();
}

/**
 * Intelligently merge discharge medications:
 * Preserves clinician's existing discharge prescriptions exactly.
 * Newly administered ER treatments are strictly excluded (ER treatment ≠ discharge Rx).
 * If a new explicit discharge prescription exists in c.dischargeInfo, it is safely merged.
 */
export function mergeDischargeMedications(existingText: string, c: ClinicalCase): string {
  const current = (existingText || "").trim();
  const explicitNew = formatDischargeMedicationsText(c);

  if (!current) {
    return explicitNew;
  }

  // If a new explicit discharge prescription was recorded and not already present, merge unique lines
  if (explicitNew && !current.toLowerCase().includes(explicitNew.toLowerCase())) {
    const existingLines = current.split("\n").map(l => l.trim().toLowerCase());
    const newLines = explicitNew.split("\n").map(l => l.trim()).filter(Boolean);
    const toAppend: string[] = [];
    for (const line of newLines) {
      if (!existingLines.some(el => el.includes(line.toLowerCase()) || line.toLowerCase().includes(el))) {
        toAppend.push(line);
      }
    }
    if (toAppend.length > 0) {
      return `${current}\n${toAppend.join("\n")}`.trim();
    }
  }

  return current;
}

/**
 * Intelligently merge clinical course:
 * Keeps clinician's manual edits and appends new progress notes, procedures, or consultations without duplicate paragraphs.
 */
export function mergeCourseInHospital(existingText: string, c: ClinicalCase): string {
  if (!existingText || !existingText.trim()) {
    return deriveInitialCourseInHospital(c);
  }

  const existingLower = existingText.toLowerCase();
  const additions: string[] = [];

  // Check progress notes
  if (c.progressNotes && c.progressNotes.trim()) {
    const notes = c.progressNotes.trim();
    // Split into individual note entries (e.g. [14:20] - ...)
    const noteLines = notes.split("\n").map(l => l.trim()).filter(Boolean);
    const unrecordedNotes: string[] = [];
    for (const n of noteLines) {
      if (!existingLower.includes(n.toLowerCase())) {
        unrecordedNotes.push(n);
      }
    }
    if (unrecordedNotes.length > 0) {
      additions.push(`Updated Progress Notes:\n${unrecordedNotes.join("\n")}`);
    }
  }

  // Check procedures
  const procStr = formatProceduresText(c);
  if (procStr && !existingLower.includes(procStr.toLowerCase())) {
    additions.push(procStr);
  }

  // Check consults
  const consultStr = formatConsultationsText(c);
  if (consultStr && !existingLower.includes(consultStr.toLowerCase())) {
    additions.push(consultStr);
  }

  // Check bedside diagnostics
  const adjunctsStr = formatBedsideAdjunctsText(c);
  if (adjunctsStr && !existingLower.includes(adjunctsStr.toLowerCase())) {
    additions.push(`Bedside Diagnostics: ${adjunctsStr}.`);
  }

  if (additions.length === 0) {
    return existingText;
  }

  return `${existingText.trim()}\n\n${additions.join("\n\n")}`.trim();
}