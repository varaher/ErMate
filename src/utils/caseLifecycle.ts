/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Case Lifecycle & 24-Hour Incomplete Case Soft Archive Engine
 *
 * Locked invariants:
 * 1. Never hard-delete clinical records: archive is strictly metadata-based (soft archive).
 * 2. Only incomplete / draft / pending active cases are eligible for 24h archival.
 * 3. Completed / finalized records or records with active duty sessions are never auto-archived.
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

  // Rule 3: Physical Bed Safety Invariant
  // Active bedside patients occupying an ER bed are physically in the department.
  // 24 hours + incomplete documentation alone is NOT proof the patient left the ER.
  // Fail-safe: Established physical bed occupants remain active in census and must
  // never be automatically archived or have their bed marked as vacant.
  const hasActiveBed = Boolean((c.bedNo && String(c.bedNo).trim() !== "") || (c.patient?.bed && String(c.patient.bed).trim() !== ""));
  if (hasActiveBed) {
    return false;
  }

  // Rule 4: Only incomplete/draft cases are eligible
  const pending = getCasePendingStatus(c);
  if (!pending.isPending) return false;

  // Rule 5: Must be >= 24 hours old
  const createdDate = getCaseCreationTimestamp(c);
  if (!createdDate) return false;

  const ageMs = now.getTime() - createdDate.getTime();
  return ageMs >= INCOMPLETE_CASE_ARCHIVE_MS;
}

/**
 * Filters out archived cases from active department lists, bedside censuses,
 * and MATE operational reference resolver.
 */
export function filterActiveNonArchivedCases(cases: ClinicalCase[]): ClinicalCase[] {
  if (!cases || !Array.isArray(cases)) return [];
  return cases.filter(c => !isCaseArchived(c));
}
