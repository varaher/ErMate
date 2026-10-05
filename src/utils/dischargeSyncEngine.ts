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
    if (/^(?:no\s+(?:history\s+of\s+)?(?:trauma|fall|accident|poisoning|bite|seizure|events?|precipitating\s+event)|nil|none|no\s+precipitating\s+event|denies\s+(?:trauma|fall|accident)|na|n\/a|not\s+applicable|not\s+documented)\.?$/i.test(trimmed)) {
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
 * Patch C4A: Build initial clinical course narrative from latest clinical case sources.
 * Follows strict 9-section ordered structure with short headings:
 * 1. Presentation
 * 2. Events Leading to Presentation (ONLY IF explicitly documented)
 * 3. Initial Assessment (ONLY IF documented)
 * 4. Investigations (ONLY IF documented)
 * 5. Treatment Given (ONLY IF documented)
 * 6. Procedures (ONLY IF performed)
 * 7. Consultations (ONLY IF done)
 * 8. Clinical Course (ONLY IF documented)
 * 9. Disposition (ONLY IF documented)
 * Empty sections are strictly OMITTED (zero absence filler statements).
 */
export function deriveInitialCourseInHospital(c: ClinicalCase): string {
  const sections: { title: string; body: string }[] = [];
  const isPed = c.isPediatric || (c.patient?.age !== undefined && Number(c.patient.age) <= 16);

  // 1. Presentation
  const rawPc = (c.patient?.presentingComplaint || "").trim();
  if (rawPc) {
    let pcSentence = rawPc;
    if (!/^(?:the\s+)?(?:child|patient)\s+presented/i.test(pcSentence)) {
      const subject = isPed ? "The child" : "The patient";
      if (/^with\b/i.test(pcSentence)) {
        pcSentence = `${subject} presented to the Emergency Department ${pcSentence}`;
      } else if (/^(?:following|after)\b/i.test(pcSentence)) {
        pcSentence = `${subject} presented ${pcSentence}`;
      } else {
        pcSentence = `${subject} presented to the Emergency Department with ${pcSentence}`;
      }
    }
    if (!pcSentence.endsWith(".")) pcSentence += ".";
    sections.push({ title: "Presentation", body: pcSentence });
  }

  // 2. Events Leading to Presentation (ONLY IF explicitly documented)
  const event = extractPrecedingEvent(c);
  if (event) {
    let eventSentence = event;
    if (!eventSentence.endsWith(".")) eventSentence += ".";
    sections.push({ title: "Events Leading to Presentation", body: eventSentence });
  }

  // 3. Initial Assessment (ONLY IF documented)
  const assessParts: string[] = [];

  // PAT for pediatric
  if (isPed && c.pediatricDetails) {
    const pd = c.pediatricDetails as any;
    const patNormal = pd.patNormal === true || pd.pediatricTriangle?.status === "normal" || 
      (pd.patAppearance === "normal" && pd.patWorkOfBreathing === "normal" && pd.patCirculation === "normal");
    if (patNormal) {
      assessParts.push("The Pediatric Assessment Triangle was documented as normal.");
    } else {
      const ptDetails: string[] = [];
      const app = pd.patAppearance || pd.pediatricTriangle?.appearance;
      if (app) ptDetails.push(`Appearance: ${app}`);
      const wob = pd.patWorkOfBreathing || pd.pediatricTriangle?.workOfBreathing;
      if (wob) ptDetails.push(`Work of Breathing: ${wob}`);
      const circ = pd.patCirculation || pd.pediatricTriangle?.circulation;
      if (circ) ptDetails.push(`Circulation: ${circ}`);
      if (ptDetails.length > 0) {
        assessParts.push(`Pediatric Assessment Triangle findings: ${ptDetails.join(", ")}.`);
      }
    }
  }

  // Primary survey findings
  const primarySurveyStr = formatPrimaryAssessmentForCourse(c);
  if (primarySurveyStr) {
    assessParts.push(primarySurveyStr.endsWith(".") ? primarySurveyStr : `${primarySurveyStr}.`);
  }

  // Documented Vitals
  if (c.vitals) {
    const v = c.vitals;
    const vitalTokens: string[] = [];
    if (v.hr) vitalTokens.push(`Pulse was ${v.hr}/min`);
    if (v.bp) vitalTokens.push(`blood pressure ${v.bp} mmHg`);
    if (v.rr) vitalTokens.push(`respiratory rate ${v.rr}/min`);
    if (v.spo2) vitalTokens.push(`oxygen saturation ${v.spo2}%`);
    if (v.temp) vitalTokens.push(`temperature ${v.temp}°C`);
    if (v.gcs && v.gcs !== "15") vitalTokens.push(`GCS ${v.gcs}`);

    if (vitalTokens.length > 0) {
      if (vitalTokens.length === 1) {
        assessParts.push(`${vitalTokens[0]}.`);
      } else {
        const last = vitalTokens.pop();
        assessParts.push(`${vitalTokens.join(", ")}, and ${last}.`);
      }
    }
  }

  // Secondary assessment / focused exam
  if (c.secondaryAssessment && typeof c.secondaryAssessment === "string" && c.secondaryAssessment.trim()) {
    const cleanSec = c.secondaryAssessment.trim();
    assessParts.push(cleanSec.endsWith(".") ? cleanSec : `${cleanSec}.`);
  }

  // Bedside diagnostics (ECG, eFAST, ABG/VBG)
  const adjunctsStr = formatBedsideAdjunctsText(c);
  if (adjunctsStr) {
    assessParts.push(adjunctsStr.endsWith(".") ? adjunctsStr : `${adjunctsStr}.`);
  }

  if (assessParts.length > 0) {
    sections.push({ title: "Initial Assessment", body: assessParts.join(" ") });
  }

  // 4. Investigations (ONLY IF documented)
  const invParts: string[] = [];
  if (c.investigationLabsOrdered && c.investigationLabsOrdered.trim()) {
    invParts.push(`${c.investigationLabsOrdered.trim()} were sent.`);
  }
  if (c.investigationImaging && c.investigationImaging.trim()) {
    const img = c.investigationImaging.trim();
    invParts.push(img.endsWith(".") ? img : `${img} was ordered.`);
  }
  if (c.investigations && c.investigations.length > 0) {
    const results = c.investigations
      .filter(i => i.result)
      .map(i => `${i.testName} showed a ${i.result}`)
      .join(". ");
    if (results) invParts.push(results.endsWith(".") ? results : `${results}.`);
  }
  if (c.investigationResultsSummary && c.investigationResultsSummary.trim()) {
    const resSummary = c.investigationResultsSummary.trim();
    if (!invParts.some(p => p.toLowerCase().includes(resSummary.toLowerCase()))) {
      invParts.push(resSummary.endsWith(".") ? resSummary : `${resSummary}.`);
    }
  }
  if (invParts.length > 0) {
    sections.push({ title: "Investigations", body: invParts.join(" ") });
  }

  // 5. Treatment Given (ONLY IF administered)
  const rxParts: string[] = [];
  if (c.treatments && c.treatments.length > 0) {
    const meds = c.treatments.map(t => {
      const dose = t.dose ? ` ${t.dose}` : "";
      const route = t.route ? ` ${t.route.toLowerCase()}` : "";
      return `${t.drugName}${dose}${route}`;
    }).join(", ");
    rxParts.push(`${meds} was administered.`);
  }
  if (c.infusions && c.infusions.length > 0) {
    const infs = c.infusions.map(i => `${i.fluidName} ${i.dose || ""} @ ${i.rate || ""}`.trim()).join(", ");
    rxParts.push(`IV infusions administered: ${infs}.`);
  }
  if (c.treatmentNotes && c.treatmentNotes.trim()) {
    const tn = c.treatmentNotes.trim();
    rxParts.push(tn.endsWith(".") ? tn : `${tn}.`);
  }
  if (rxParts.length > 0) {
    sections.push({ title: "Treatment Given", body: rxParts.join(" ") });
  }

  // 6. Procedures (ONLY IF performed)
  const procStr = formatProceduresText(c);
  if (procStr) {
    sections.push({ title: "Procedures", body: procStr });
  }

  // 7. Consultations (ONLY IF done)
  const consultStr = formatConsultationsText(c);
  if (consultStr) {
    sections.push({ title: "Consultations", body: consultStr });
  }

  // 8. Clinical Course (ONLY IF documented reassessments or progress notes exist)
  const courseParts: string[] = [];
  if (c.progressNotes && c.progressNotes.trim()) {
    courseParts.push(c.progressNotes.trim());
  }
  if (c.dispositionDetails?.observationNotes && c.dispositionDetails.observationNotes.trim()) {
    const obs = c.dispositionDetails.observationNotes.trim();
    if (!courseParts.some(p => p.toLowerCase().includes(obs.toLowerCase()))) {
      courseParts.push(obs);
    }
  }
  if (courseParts.length > 0) {
    sections.push({ title: "Clinical Course", body: courseParts.join("\n") });
  }

  // 9. Disposition (ONLY IF documented)
  const dispStatus = c.dischargeInfo?.dispositionStatus || 
    c.dispositionDetails?.dispositionType || 
    (c.dispositionAndPlan as any)?.disposition ||
    c.dispositionAndPlan?.dispositionStatus;
  const followUp = c.dischargeInfo?.followUpPlan || 
    c.dispositionAndPlan?.followUpAdvice ||
    (c.dispositionDetails as any)?.followUpAdvice;
  if (dispStatus && dispStatus !== "Pending / Not Documented") {
    const subject = isPed ? "The child" : "The patient";
    let dispSentence = "";
    const lower = dispStatus.toLowerCase();
    if (lower.includes("discharge")) {
      if (followUp && followUp.trim()) {
        dispSentence = `${subject} was discharged with advice for ${followUp.trim()}.`;
      } else {
        dispSentence = `${subject} was discharged from the Emergency Department.`;
      }
    } else if (lower.includes("admit")) {
      dispSentence = `${subject} was ${dispStatus}.`;
    } else if (lower.includes("transfer") || lower.includes("refer")) {
      dispSentence = `${subject} was ${dispStatus}.`;
    } else if (lower.includes("lama") || lower.includes("dama")) {
      dispSentence = `${subject} took discharge against medical advice.`;
    } else if (lower.includes("death") || lower.includes("deceased")) {
      dispSentence = `Patient expired in the Emergency Department.`;
    } else {
      dispSentence = `Disposition: ${dispStatus}.`;
    }
    if (!dispSentence.endsWith(".")) dispSentence += ".";
    sections.push({ title: "Disposition", body: dispSentence });
  }

  if (sections.length === 0) {
    return "";
  }

  const output = ["COURSE IN EMERGENCY DEPARTMENT"];
  for (const s of sections) {
    output.push(`${s.title}:\n${s.body}`);
  }

  return output.join("\n\n");
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
  const base = parseStructuredCourse(previousAutoCourse);
  const local = parseStructuredCourse(currentClinicianText);
  const next = parseStructuredCourse(nextAutoCourse);

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
