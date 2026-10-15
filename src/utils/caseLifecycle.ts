/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Case Lifecycle & 24-Hour Incomplete Case Soft Archive Engine
 *
 * Locked invariants:
 * 1. Never hard-delete clinical records: archive is strictly metadata-based (soft archive).
 * 2. Only incomplete / draft / pending cases are eligible for 24h archival. The 24 hours run from
 *    the LAST EDIT (or creation if never edited), so a case being worked on is never archived.
 * 3. Completed / finalized / discharged records are never auto-archived.
 * 4. Archived cases are excluded from active dashboard cards and MATE bed census,
 *    but remain retrievable and viewable in Case Log / history.
 */

import { ClinicalCase } from "../types";
import { getCasePendingStatus } from "./caseHelper";

export const INCOMPLETE_CASE_ARCHIVE_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Checks whether a case has already been soft-archived.
 */
export function isCaseArchived(c: ClinicalCase): boolean {
  if (!c) return false;
  return Boolean(c.archivedAt && String(c.archivedAt).trim() !== "");
}

/**
 * Resolves the canonical creation timestamp of a case from available date fields.
 */
export function getCaseCreationTimestamp(c: ClinicalCase): Date | null {
  if (!c) return null;

  if (c.createdAt) {
    const d = new Date(c.createdAt);
    if (!isNaN(d.getTime())) return d;
  }

  if (c.savedTime) {
    const d = new Date(c.savedTime);
    if (!isNaN(d.getTime())) return d;
  }

  if (c.currentAssignmentAt) {
    const d = new Date(c.currentAssignmentAt);
    if (!isNaN(d.getTime())) return d;
  }

  if (c.patient?.dateOpened) {
    const d = new Date(c.patient.dateOpened);
    if (!isNaN(d.getTime())) return d;
    const parts = c.patient.dateOpened.split("|");
    if (parts.length > 1) {
      const dPart = new Date(parts[1].trim());
      if (!isNaN(dPart.getTime())) return dPart;
      const dWithYear = new Date(`${parts[1].trim()} ${new Date().getFullYear()}`);
      if (!isNaN(dWithYear.getTime())) return dWithYear;
    }
  }

  return null;
}

export function getCaseLastActivityTimestamp(c: ClinicalCase): Date | null {
  const created = getCaseCreationTimestamp(c);
  const edited = c?.lastEditedAt ? new Date(c.lastEditedAt) : null;
  const editedOk = edited && !isNaN(edited.getTime()) ? edited : null;
  if (created && editedOk) return editedOk.getTime() > created.getTime() ? editedOk : created;
  return editedOk || created;
}

/**
 * Evaluates whether an active/triage case qualifies for 24-hour soft-archive.
 *
 * Eligibility criteria:
 * - Not already archived (idempotent)
 * - Status is NOT "Discharged" (completed/discharged records are never auto-archived)
 * - Discharge summary status is NOT "FINALIZED"
 * - Case is clinically incomplete (getCasePendingStatus(c).isPending === true)
 * - Elapsed age from creation timestamp is >= 24 hours
 */
export function isCaseEligibleFor24hArchive(c: ClinicalCase, now = new Date()): boolean {
  if (!c || !c.id) return false;

  // Rule 1: Idempotency - skip already archived cases
  if (isCaseArchived(c)) return false;

  // Rule 2: Never archive formally discharged or finalized records
  if (c.status === "Discharged") return false;
  if (c.dischargeInfo?.summaryStatus === "FINALIZED") return false;

  // Rule 4: Only incomplete/draft cases are eligible
  const pending = getCasePendingStatus(c);
  if (!pending.isPending) return false;

  // Rule 5: Must be >= 24 hours since the last edit (or creation if never edited)
  const lastActivity = getCaseLastActivityTimestamp(c);
  if (!lastActivity) return false;
  const ageMs = now.getTime() - lastActivity.getTime();
  return ageMs >= INCOMPLETE_CASE_ARCHIVE_MS;
}

/**
 * True when any clinical information has been documented on the case.
 */
export function hasAnyClinicalContent(c: ClinicalCase): boolean {
  if (!c) return false;
  const filled = (v: unknown) => typeof v === "string" ? v.trim().length > 0 : v !== null && v !== undefined && v !== false;
  const p: any = c.patient || {};
  if (filled(p.presentingComplaint) || filled(p.name) || filled(p.age)) return true;
  const v: any = c.vitals || {};
  if (["hr", "bp", "rr", "spo2", "temp", "gcs", "grbs"].some(k => filled(v[k]))) return true;
  const sh: any = c.sampleHistory || {};
  if (Object.values(sh).some(filled)) return true;
  if ((c.treatments || []).length > 0 || (c.investigations || []).length > 0) return true;
  if ((c.notes || []).length > 0 || filled(c.progressNotes)) return true;
  if (filled(c.provisionalPrimaryDiagnosis) || filled((c as any).bedNo)) return true;
  // Primary survey: look at recorded VALUES only (field names never count as content).
  const hasText = (val: unknown, depth = 0): boolean => {
    if (depth > 6 || val === null || val === undefined) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (typeof val === "number" || val === true) return true;
    if (Array.isArray(val)) return val.some(x => hasText(x, depth + 1));
    if (typeof val === "object") return Object.values(val as Record<string, unknown>).some(x => hasText(x, depth + 1));
    return false;
  };
  if (hasText(c.primaryAssessment)) return true;
  return false;
}

/**
 * Filters out archived cases from active department lists, bedside censuses,
 * and MATE operational reference resolver.
 */
export function filterActiveNonArchivedCases(cases: ClinicalCase[]): ClinicalCase[] {
  if (!cases || !Array.isArray(cases)) return [];
  return cases.filter(c => !isCaseArchived(c));
}
