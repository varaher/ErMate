/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClinicalCase } from "../types";

export interface CasePendingStatus {
  isPending: boolean;
  pendingCount: number;
  pendingSections: string[];
}

export const hasMeaningfulValue = (value: any): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (["none documented", "not assessed", "not documented", "n/a", "none"].includes(lower)) return false;
    return true;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue);
  }
  if (typeof value === "object") {
    return Object.values(value).some(hasMeaningfulValue);
  }
  return true;
};

/**
 * Evaluates the completion of each clinical section for an active EMR case.
 * Returns which tabs/sections have pending (missing or empty) details.
 */
export function getCasePendingStatus(c: ClinicalCase): CasePendingStatus {
  // Discharged or fully closed cases are not considered pending
  if (c.status === "Discharged") {
    return { isPending: false, pendingCount: 0, pendingSections: [] };
  }

  const pendingSections: string[] = [];

  // 1. History Section (needs at least Symptoms / Complaints, allergies, medications, pastHistory)
  const sh = c.sampleHistory;
  const isHistoryPending = !sh || 
    !sh.symptoms?.trim() || 
    !sh.allergies?.trim() || 
    !sh.medications?.trim() || 
    !sh.pastHistory?.trim();
  
  if (isHistoryPending) {
    pendingSections.push("SAMPLE History");
  }

  // 2. Examination (Primary Survey ABCDE AND Secondary Systemic Examination)
  // Domain A: Airway (status / intervention / cSpine or legacy airway narrative)
  const survey = c.primaryAssessment?.survey;
  const legacyPA = c.primaryAssessment;

  const hasAirway =
    hasMeaningfulValue(survey?.airway?.status) ||
    hasMeaningfulValue(survey?.airway?.intervention) ||
    hasMeaningfulValue(survey?.airway?.cSpine) ||
    hasMeaningfulValue(legacyPA?.airway);

  // Domain B: Breathing (work of breathing, air entry, added sounds, O2 delivery, chest wall, or legacy breathing narrative)
  // Note: Vitals (RR, SpO2) may support/display inside B, but clinical examination findings must be documented
  const hasBreathing =
    hasMeaningfulValue(survey?.breathing?.workOfBreathing) ||
    hasMeaningfulValue(survey?.breathing?.airEntry) ||
    hasMeaningfulValue(survey?.breathing?.addedSounds) ||
    hasMeaningfulValue(survey?.breathing?.o2Delivery) ||
    hasMeaningfulValue(survey?.breathing?.chestWall) ||
    hasMeaningfulValue(legacyPA?.breathing);

  // Domain C: Circulation (rhythm, CRT, peripheral pulses, skin perfusion, bleeding, IV access, or legacy circulation narrative)
  // Note: Vitals (HR, BP) and Adjuncts (ECG, eFAST, Echo) must NOT independently satisfy C
  const hasCirculation =
    hasMeaningfulValue(survey?.circulation?.rhythm) ||
    hasMeaningfulValue(survey?.circulation?.crt) ||
    hasMeaningfulValue(survey?.circulation?.peripheralPulses) ||
    hasMeaningfulValue(survey?.circulation?.skinPerfusion) ||
    hasMeaningfulValue(survey?.circulation?.bleeding) ||
    hasMeaningfulValue(survey?.circulation?.ivAccess) ||
    hasMeaningfulValue(legacyPA?.circulation);

  // Domain D: Disability (pupils, reaction, focal deficit, seizure, or legacy disability narrative)
  // Note: Vitals (GCS, GRBS) may support/display inside D, but clinical neuro assessment must be documented
  const hasDisability =
    hasMeaningfulValue(survey?.disability?.pupilReaction) ||
    hasMeaningfulValue(survey?.disability?.pupilsEqual) ||
    hasMeaningfulValue(survey?.disability?.pupilSizeR) ||
    hasMeaningfulValue(survey?.disability?.pupilSizeL) ||
    hasMeaningfulValue(survey?.disability?.focalDeficit) ||
    hasMeaningfulValue(survey?.disability?.seizure) ||
    hasMeaningfulValue(legacyPA?.disability);

  // Domain E: Exposure (skin, hypothermia prevention, log roll, pelvis, long bones, or legacy exposure narrative)
  // Note: Vital (Temp) may support/display inside E, but clinical exposure findings must be documented
  const hasExposure =
    hasMeaningfulValue(survey?.exposure?.skin) ||
    hasMeaningfulValue(survey?.exposure?.hypothermiaPrevention) ||
    hasMeaningfulValue(survey?.exposure?.logRoll) ||
    hasMeaningfulValue(survey?.exposure?.pelvis) ||
    hasMeaningfulValue(survey?.exposure?.longBones) ||
    hasMeaningfulValue(legacyPA?.exposure);

  const hasPrimarySurvey = hasAirway && hasBreathing && hasCirculation && hasDisability && hasExposure;

  // Secondary Survey: Check all major organ systems (General, CVS, RS, PA, CNS, Extremities)
  // Structured secondarySurvey checked first; parsed secondaryAssessment narrative used as fallback
  const parsedSec: Record<string, string> = {};
  if (typeof c.secondaryAssessment === "string" && c.secondaryAssessment.trim()) {
    const text = c.secondaryAssessment;
    const normalizeSecKey = (k: string): string | null => {
      const lower = k.trim().toLowerCase();
      if (lower === "rs" || lower === "respiratory" || lower === "chest") return "RS";
      if (lower === "pa" || lower === "abdomen") return "PA";
      if (lower === "cvs") return "CVS";
      if (lower === "cns") return "CNS";
      if (lower === "general") return "General";
      if (lower === "extremities") return "Extremities";
      return null;
    };

    const firstHeaderMatch = text.match(/(General|CVS|RS|Respiratory|Chest|PA|Abdomen|CNS|Extremities)\s*:/i);
    if (firstHeaderMatch) {
      const preamble = text.substring(0, firstHeaderMatch.index).trim();
      if (preamble) parsedSec.General = preamble;
    } else if (text.trim()) {
      parsedSec.General = text.trim();
    }

    const regex = /(General|CVS|RS|Respiratory|Chest|PA|Abdomen|CNS|Extremities)\s*:\s*(.*?)(?=(General|CVS|RS|Respiratory|Chest|PA|Abdomen|CNS|Extremities)\s*:|$)/igs;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const k = normalizeSecKey(m[1]);
      if (k) {
        parsedSec[k] = parsedSec[k] ? parsedSec[k] + "\n" + m[2].trim() : m[2].trim();
      }
    }
  }

  const ss = c.secondarySurvey;
  const hasGeneral = hasMeaningfulValue(ss?.general) || hasMeaningfulValue(parsedSec.General);
  const hasCVS = hasMeaningfulValue(ss?.cvs) || hasMeaningfulValue(parsedSec.CVS);
  const hasRespiratory = hasMeaningfulValue(ss?.respiratory) || hasMeaningfulValue((ss as any)?.rs) || hasMeaningfulValue(parsedSec.RS);
  const hasAbdomen = hasMeaningfulValue(ss?.abdomen) || hasMeaningfulValue((ss as any)?.pa) || hasMeaningfulValue(parsedSec.PA);
  const hasCNS = hasMeaningfulValue(ss?.cns) || hasMeaningfulValue(parsedSec.CNS);
  const hasExtremities = hasMeaningfulValue(ss?.extremities) || hasMeaningfulValue(parsedSec.Extremities);

  const hasSecondaryExam = hasGeneral && hasCVS && hasRespiratory && hasAbdomen && hasCNS && hasExtremities;

  const isExamPending = !hasPrimarySurvey || !hasSecondaryExam;

  if (isExamPending) {
    pendingSections.push("Clinical Examination");
  }

  // 3. Treatment & Investigation
  // A standard ER case sheet is pending if no medical treatments are logged
  const isTreatmentPending = (!c.treatments || c.treatments.length === 0) && (!c.investigations || c.investigations.length === 0);
  if (isTreatmentPending) {
    pendingSections.push("Treatments / Tests");
  }

  // 4. Progress Notes
  const isNotesPending = !c.progressNotes || !c.progressNotes.trim();
  if (isNotesPending) {
    pendingSections.push("Progress Notes");
  }

  // 5. Disposition & Checklist
  const dd = c.dispositionDetails;
  // A disposition is considered pending if there is no disposition type set, or it is left blank.
  const isDispositionPending = !dd || !dd.dispositionType?.trim();
  
  if (isDispositionPending) {
    pendingSections.push("Disposition Details");
  }

  // If disposition is Discharge, but discharge summary is not compiled yet
  if (dd?.dispositionType === "Discharge" && !c.dischargeInfo) {
    pendingSections.push("Discharge Summary");
  }

  return {
    isPending: pendingSections.length > 0,
    pendingCount: pendingSections.length,
    pendingSections
  };
}
export function generateUHID(dailyCaseCount?: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const count = String(dailyCaseCount !== undefined ? dailyCaseCount + 1 : Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  return `${yy}${mm}${dd}${count}`;
}
