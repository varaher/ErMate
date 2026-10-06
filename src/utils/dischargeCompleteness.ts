/**
 * ErMate — Pure Read-Only Discharge Completeness Engine
 *
 * Invariants:
 * 1. Presence check ONLY — never uses an LLM, never guesses or invents data.
 * 2. Purely deterministic evaluation against current ClinicalCase and DischargeInfo schemas.
 * 3. Identifies missing required discharge fields and pending diagnostic lab/imaging reports.
 */

import { ClinicalCase } from "../types";

export interface DischargeCompletenessReport {
  complete: boolean;
  missing: string[];
  pendingReports: string[];
  isDraft: boolean;
  isFinalized: boolean;
}

/**
 * Checks whether an active case has all required elements for a safe ER discharge.
 */
export function checkDischargeCompleteness(c?: ClinicalCase | null): DischargeCompletenessReport {
  if (!c) {
    return {
      complete: false,
      missing: ["Patient case record"],
      pendingReports: [],
      isDraft: false,
      isFinalized: false,
    };
  }

  const missing: string[] = [];
  const pendingReports: string[] = [];

  const di = c.dischargeInfo;
  const isFinalized = di?.summaryStatus === "FINALIZED";
  const isDraft = !di || di.summaryStatus === "DRAFT" || !di.summaryStatus;

  // 1. Primary Discharge Diagnosis
  const primaryDiag = (di?.primaryDiagnosis || c.provisionalPrimaryDiagnosis || "").trim();
  if (
    !primaryDiag ||
    primaryDiag.toLowerCase() === "under evaluation" ||
    primaryDiag.toLowerCase() === "not documented" ||
    primaryDiag.toLowerCase() === "n/a"
  ) {
    missing.push("Primary Diagnosis");
  }

  // 2. ER Course / Treatment Summary (Must be genuine clinical course or progress notes, NEVER presenting complaint)
  const hasCourse = Boolean(
    (di?.courseInHospital && di.courseInHospital.trim()) ||
    (c.progressNotes && c.progressNotes.trim() && c.progressNotes.trim() !== "Case created via ErMate Voice Scribe dictation.")
  );
  if (!hasCourse) {
    missing.push("ER Clinical Course");
  }

  // 3. Take-Home Discharge Medications
  const hasDischargeMeds = Boolean(
    (di?.dischargeMedications && di.dischargeMedications.trim()) ||
    ((c as any).dischargePrescriptions && (c as any).dischargePrescriptions.length > 0)
  );
  if (!hasDischargeMeds) {
    missing.push("Discharge Medications");
  }

  // 4. Condition at Discharge (Must be explicit condition at discharge/shift, NEVER general physical examination)
  const condition = (
    di?.conditionAtDischarge ||
    di?.dischargeCondition ||
    c.conditionAtShift ||
    (c.dispositionDetails as any)?.conditionAtShift ||
    ""
  ).trim();
  if (!condition) {
    missing.push("Condition at Discharge");
  }

  // 5. Follow-Up Plan & Return Advice
  const followUp = (di?.followUpPlan || "").trim();
  if (!followUp) {
    missing.push("Follow-Up Plan");
  }

  // 6. Disposition Type
  const dispType = (c.dispositionDetails?.dispositionType || di?.dispositionType || "").trim();
  if (!dispType) {
    missing.push("Disposition Type");
  }

  // 7. Check for Pending Investigation Reports
  if (Array.isArray(c.investigations)) {
    for (const inv of c.investigations) {
      if (!inv?.testName) continue;
      const res = (inv.result || "").trim().toLowerCase();
      const resTime = (inv.resultTime || "").trim().toLowerCase();
      if (res === "pending" || res === "ordered" || resTime === "pending") {
        if (!pendingReports.includes(inv.testName)) {
          pendingReports.push(inv.testName);
        }
      }
    }
  }

  return {
    complete: missing.length === 0 && pendingReports.length === 0,
    missing,
    pendingReports,
    isDraft,
    isFinalized,
  };
}
