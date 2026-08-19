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

  // 2. Examination (Airway, Breathing, Circulation, Disability, Exposure assessment descriptions)
  const pa = c.primaryAssessment;
  const isExamPending = !pa || 
    !pa.airway?.trim() || 
    !pa.breathing?.trim() || 
    !pa.circulation?.trim() || 
    !pa.disability?.trim() || 
    !pa.exposure?.trim();

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
