/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Discharge Summary Synchronization Engine
 * Pure functional helpers to derive initial discharge summary fields from ClinicalCase,
 * intelligently merge latest case updates into an active discharge draft without clobbering manual edits,
 * and avoid duplicate paragraphs or redundant bullet points.
 */

import { ClinicalCase, DischargeInfo } from "../types";

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

/**
 * Course in Hospital Narrative Engine:
 * Generates ONE coherent chronological clinical narrative describing what happened
 * DURING the ER encounter in natural professional prose (usually 1-3 paragraphs).
 * Resembles a professionally dictated hospital discharge course.
 *
 * Core Mandates:
 * - NO section headings (zero "Presentation:", "Initial Assessment:", "COURSE IN EMERGENCY DEPARTMENT")
 * - NO bullet lists or mini-case-sheet dumps
 * - Course in Hospital != Case Sheet summary (ABCDE, complete vitals, full investigation list have separate sections)
 * - Factual only: never invent improvement, stability, or consultations unless documented
 *
 * Answers chronologically:
 * 1. Why evaluated in ER (chief complaint & presenting context)
 * 2. Clinically important issues affecting acute management (e.g. hypotension, tachycardia, acute findings)
 * 3. Investigations performed, resulted, or advised with actual status
 * 4. Treatments and procedures actually administered
 * 5. Consultations, counselling, or refusal (e.g. declined tests/admission)
 * 6. Documented reassessments or progress notes
 * 7. How and why finally disposed
 */
export function deriveInitialCourseInHospital(c: ClinicalCase): string {
  const isPed = c.isPediatric || (c.patient?.age !== undefined && Number(c.patient.age) <= 16);
  const subject = isPed ? "The child" : "The patient";

  // --- PARAGRAPH 1: EVALUATION REASON, PRECEDING EVENT & CLINICAL PRESENTATION ---
  const p1Parts: string[] = [];
  const rawPc = (c.patient?.presentingComplaint || "").trim();
  const event = extractPrecedingEvent(c);

  let arrivalSentence = "";
  if (rawPc) {
    let cleanPc = rawPc.replace(/\.$/, "").trim();
    // Normalize if starts with "The patient/child presented..."
    const pcMatch = cleanPc.match(/^(?:the\s+)?(?:patient|child)\s+(?:presented|was\s+evaluated)\s*(?:to\s+(?:the\s+)?(?:emergency\s+department|er))?\s*(?:with|following|due\s+to)?\s*(.*)$/i);
    if (pcMatch && pcMatch[1]) {
      cleanPc = pcMatch[1].trim();
    }
    
    if (event) {
      const cleanEvent = event.replace(/\.$/, "").trim();
      if (/^(?:symptoms?|pain|onset|the\s+patient|patient|the\s+child|child|alleged|reported|witnessed)\b/i.test(cleanEvent)) {
        arrivalSentence = `${subject} was evaluated in the Emergency Department with ${cleanPc}. ${cleanEvent}.`;
      } else {
        arrivalSentence = `${subject} was evaluated in the Emergency Department with ${cleanPc}. Symptoms occurred following ${cleanEvent.charAt(0).toLowerCase() + cleanEvent.slice(1)}.`;
      }
    } else {
      arrivalSentence = `${subject} was evaluated in the Emergency Department with ${cleanPc}.`;
    }
  } else if (event) {
    const cleanEvent = event.replace(/\.$/, "").trim();
    arrivalSentence = `${subject} was evaluated in the Emergency Department following ${cleanEvent}.`;
  } else {
    arrivalSentence = `${subject} was evaluated in the Emergency Department.`;
  }
  p1Parts.push(arrivalSentence);

  // Pediatric PAT
  if (isPed && c.pediatricDetails) {
    const pd = c.pediatricDetails as any;
    const patNormal = pd.patNormal === true || pd.pediatricTriangle?.status === "normal" || 
      (pd.patAppearance === "normal" && pd.patWorkOfBreathing === "normal" && pd.patCirculation === "normal");
    if (patNormal) {
      p1Parts.push("The Pediatric Assessment Triangle was documented as normal.");
    } else {
      const ptDetails: string[] = [];
      const app = pd.patAppearance || pd.pediatricTriangle?.appearance;
      if (app) ptDetails.push(`appearance: ${app}`);
      const wob = pd.patWorkOfBreathing || pd.pediatricTriangle?.workOfBreathing;
      if (wob) ptDetails.push(`work of breathing: ${wob}`);
      const circ = pd.patCirculation || pd.pediatricTriangle?.circulation;
      if (circ) ptDetails.push(`circulation: ${circ}`);
      if (ptDetails.length > 0) {
        p1Parts.push(`Pediatric Assessment Triangle revealed ${ptDetails.join(", ")}.`);
      }
    }
  }

  // Clinically Relevant Vitals & Findings
  if (c.vitals) {
    const v = c.vitals;
    const vitalTokens: string[] = [];
    const bpM = v.bp?.match(/(\d+)\/(\d+)/);
    const sbp = bpM ? parseInt(bpM[1], 10) : null;
    const hrNum = v.hr ? parseInt(v.hr, 10) : null;
    const rrNum = v.rr ? parseInt(v.rr, 10) : null;
    const spo2Num = v.spo2 ? parseInt(v.spo2, 10) : null;
    const tempNum = v.temp ? parseFloat(v.temp) : null;
    const isHypotensive = sbp !== null && sbp < 95;
    const isHypertensive = sbp !== null && sbp >= 160;
    const isTachycardic = hrNum !== null && hrNum > 100;
    const isBradycardic = hrNum !== null && hrNum < 60;
    const isHypoxic = spo2Num !== null && spo2Num < 95;
    const isFebrile = tempNum !== null && (tempNum >= 38.0 || tempNum >= 100.4);
    const isAlteredGcs = v.gcs && v.gcs !== "15" && v.gcs !== "15/15";

    if (isHypotensive) vitalTokens.push(`hypotension with blood pressure ${v.bp} mmHg`);
    else if (isHypertensive) vitalTokens.push(`elevated blood pressure of ${v.bp} mmHg`);
    else if (v.bp) vitalTokens.push(`blood pressure ${v.bp} mmHg`);

    if (isTachycardic) vitalTokens.push(`pulse of ${v.hr}/min`);
    else if (isBradycardic) vitalTokens.push(`bradycardia with pulse ${v.hr}/min`);
    else if (v.hr) vitalTokens.push(`pulse was ${v.hr}/min`);

    if (isHypoxic) vitalTokens.push(`oxygen saturation ${v.spo2}%`);
    else if (v.spo2 && v.spo2 !== "100" && v.spo2 !== "99") vitalTokens.push(`oxygen saturation ${v.spo2}%`);

    if (isFebrile) vitalTokens.push(`temperature ${v.temp}°C`);
    else if (v.temp && v.temp !== "98.4" && v.temp !== "37") vitalTokens.push(`temperature ${v.temp}°C`);

    if (rrNum && (rrNum > 22 || rrNum < 12)) vitalTokens.push(`respiratory rate ${v.rr}/min`);
    if (isAlteredGcs) vitalTokens.push(`GCS ${v.gcs}`);

    if (vitalTokens.length > 0) {
      p1Parts.push(`Initial assessment revealed ${vitalTokens.join(", ")}.`);
    }
  }

  // Bedside adjuncts (ECG, POCUS)
  if (c.adjuncts?.ecgDetails && c.adjuncts.ecgDetails.trim()) {
    const ecg = c.adjuncts.ecgDetails.trim();
    p1Parts.push(`Bedside ECG demonstrated ${ecg.replace(/^showing\s+/i, "").replace(/\.$/, "")}.`);
  }
  if (c.adjuncts?.efastNotes && c.adjuncts.efastNotes.trim()) {
    p1Parts.push(`Bedside ultrasound (eFAST/POCUS) showed ${c.adjuncts.efastNotes.trim().replace(/\.$/, "")}.`);
  }

  // --- PARAGRAPH 2: INVESTIGATIONS, TREATMENT & PROCEDURES ---
  const p2Parts: string[] = [];

  // Investigations with documented status
  const invSentences: string[] = [];
  if (c.investigationLabsOrdered && c.investigationLabsOrdered.trim()) {
    invSentences.push(`Blood investigations including ${c.investigationLabsOrdered.trim()} were sent.`);
  }
  if (c.investigationImaging && c.investigationImaging.trim()) {
    const img = c.investigationImaging.trim();
    invSentences.push(img.endsWith(".") ? img : `${img} was ordered.`);
  }
  if (c.investigations && c.investigations.length > 0) {
    const results = c.investigations
      .filter(i => i.result)
      .map(i => `${i.testName} showed ${i.result}`)
      .join(", ");
    if (results) {
      invSentences.push(`Investigations revealed ${results}.`);
    }
  }
  if (c.investigationResultsSummary && c.investigationResultsSummary.trim()) {
    const resSummary = c.investigationResultsSummary.trim();
    if (!invSentences.some(s => s.toLowerCase().includes(resSummary.toLowerCase()))) {
      invSentences.push(resSummary.endsWith(".") ? resSummary : `${resSummary}.`);
    }
  }
  if (invSentences.length > 0) {
    p2Parts.push(invSentences.join(" "));
  }

  // Treatments actually administered
  if (c.treatments && c.treatments.length > 0) {
    const meds = c.treatments.map(t => {
      const dose = t.dose ? ` ${t.dose}` : "";
      const route = t.route ? ` ${t.route.toLowerCase()}` : "";
      return `${t.drugName}${dose}${route}`;
    }).join(", ");
    p2Parts.push(`${subject} was treated with ${meds} as documented.`);
  }
  if (c.infusions && c.infusions.length > 0) {
    const infs = c.infusions.map(i => `${i.fluidName} ${i.dose || ""} @ ${i.rate || ""}`.trim()).join(", ");
    p2Parts.push(`IV infusions of ${infs} were administered.`);
  }
  if (c.treatmentNotes && c.treatmentNotes.trim()) {
    const tn = c.treatmentNotes.trim();
    p2Parts.push(tn.endsWith(".") ? tn : `${tn}.`);
  }

  // Procedures performed
  const procStr = formatProceduresText(c);
  if (procStr) {
    p2Parts.push(procStr);
  }

  // Consultations
  const consultStr = formatConsultationsText(c);
  if (consultStr) {
    p2Parts.push(consultStr);
  }

  // --- PARAGRAPH 3: REASSESSMENT, COUNSELLING & DISPOSITION ---
  const p3Parts: string[] = [];

  // Reassessment - ONLY IF DOCUMENTED
  if (c.progressNotes && c.progressNotes.trim()) {
    const cleanNotes = c.progressNotes.trim();
    p3Parts.push(`On reassessment, ${cleanNotes.endsWith(".") ? cleanNotes : cleanNotes + "."}`);
  } else if (c.dispositionDetails?.observationNotes && c.dispositionDetails.observationNotes.trim()) {
    const obs = c.dispositionDetails.observationNotes.trim();
    p3Parts.push(`On observation, ${obs.endsWith(".") ? obs : obs + "."}`);
  }

  // Disposition & Counselling / Refusal
  const dispStatus = c.dischargeInfo?.dispositionStatus || 
    c.dispositionDetails?.dispositionType || 
    (c.dispositionAndPlan as any)?.disposition ||
    c.dispositionAndPlan?.dispositionStatus;
  const followUp = c.dischargeInfo?.followUpPlan || 
    c.dispositionAndPlan?.followUpAdvice ||
    (c.dispositionDetails as any)?.followUpAdvice;

  if (dispStatus && dispStatus !== "Pending / Not Documented") {
    const lower = dispStatus.toLowerCase();
    if (lower.includes("request")) {
      // Discharge at request / refusal
      let dar = `In view of ${subject.toLowerCase()}'s decision to seek outpatient management, ${subject.toLowerCase()} was discharged at request`;
      if (followUp && followUp.trim()) {
        dar += ` with advice for ${followUp.trim()}`;
      } else {
        dar += ` with advice for outpatient follow-up`;
      }
      dar += ` and instructions to return to the Emergency Department in case of worsening symptoms.`;
      p3Parts.push(dar);
    } else if (lower.includes("discharge")) {
      if (followUp && followUp.trim()) {
        p3Parts.push(`${subject} was discharged from the Emergency Department with advice for ${followUp.trim()}.`);
      } else {
        p3Parts.push(`${subject} was discharged from the Emergency Department.`);
      }
    } else if (lower.includes("admit")) {
      p3Parts.push(`In view of the clinical condition, ${subject.toLowerCase()} was ${dispStatus}.`);
    } else if (lower.includes("transfer") || lower.includes("refer")) {
      p3Parts.push(`${subject} was ${dispStatus}.`);
    } else if (lower.includes("lama") || lower.includes("dama")) {
      p3Parts.push(`${subject} took discharge against medical advice.`);
    } else if (lower.includes("death") || lower.includes("deceased")) {
      p3Parts.push(`Patient expired in the Emergency Department.`);
    } else {
      p3Parts.push(`Disposition: ${dispStatus}.`);
    }
  }

  const paragraphs = [
    p1Parts.join(" "),
    p2Parts.join(" "),
    p3Parts.join(" ")
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
