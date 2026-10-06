/**
 * ErMate — MATE Census & Runtime Context Orientation
 *
 * Provides deterministic orientation metrics from the active census:
 * - activePatientCount
 * - occupiedBeds
 * - unassignedCount
 * - incompleteCount
 * - triageCounts
 *
 * Invariants:
 * 1. Only reads active, non-archived cases already visible to the clinician.
 * 2. Purely read-only; does NOT store or duplicate ClinicalCase.
 * 3. Never invents data or guesses.
 */

import { ClinicalCase } from "../types";
import { getCasePendingStatus } from "../utils/caseHelper";

export interface MateCensusOrientation {
  activePatientCount: number;
  occupiedBeds: string[];
  unassignedCount: number;
  incompleteCount: number;
  triageCounts: {
    p1: number;
    p2: number;
    p3: number;
  };
}

export function computeCensusOrientation(cases: ClinicalCase[]): MateCensusOrientation {
  const activeCases = (cases || []).filter(
    (c) => c && c.status !== "Discharged" && !(c as any).isArchived && !(c as any).archivedAt
  );

  const occupiedBeds: string[] = [];
  let unassignedCount = 0;
  let incompleteCount = 0;
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;

  for (const c of activeCases) {
    const bed = (c.bedNo || c.patient?.bed || "").trim();
    if (bed) {
      if (!occupiedBeds.includes(bed)) {
        occupiedBeds.push(bed);
      }
    } else {
      unassignedCount++;
    }

    const triage = (c.patient?.triageCategory || "").toUpperCase();
    if (triage === "P1" || triage.includes("RESUSCITATION")) p1++;
    else if (triage === "P2" || triage.includes("EMERGENT")) p2++;
    else if (triage === "P3" || triage.includes("URGENT") || triage.includes("NON-URGENT")) p3++;

    const pending = getCasePendingStatus(c);
    if (pending.isPending && pending.pendingCount > 0) {
      incompleteCount++;
    }
  }

  return {
    activePatientCount: activeCases.length,
    occupiedBeds: occupiedBeds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    unassignedCount,
    incompleteCount,
    triageCounts: { p1, p2, p3 },
  };
}

export function formatErOverviewMessage(orientation: MateCensusOrientation): string {
  const { activePatientCount, triageCounts, incompleteCount, occupiedBeds, unassignedCount } = orientation;

  if (activePatientCount === 0) {
    return "Your ER currently has no active patients. Bedside census is clear.";
  }

  const parts: string[] = [];
  parts.push(`You have **${activePatientCount} active patient${activePatientCount > 1 ? "s" : ""}** in the ER.`);

  const triageBreakdown: string[] = [];
  if (triageCounts.p1 > 0) triageBreakdown.push(`**${triageCounts.p1} P1**`);
  if (triageCounts.p2 > 0) triageBreakdown.push(`**${triageCounts.p2} P2**`);
  if (triageCounts.p3 > 0) triageBreakdown.push(`**${triageCounts.p3} P3**`);
  if (triageBreakdown.length > 0) {
    parts.push(`Triage Acuity: ${triageBreakdown.join(", ")}.`);
  }

  if (incompleteCount > 0) {
    parts.push(`**${incompleteCount}** case${incompleteCount > 1 ? "s have" : " has"} incomplete sections.`);
  }

  if (occupiedBeds.length > 0) {
    parts.push(`Occupied Beds: ${occupiedBeds.join(", ")}.`);
  }
  if (unassignedCount > 0) {
    parts.push(`Unassigned: ${unassignedCount} patient${unassignedCount > 1 ? "s" : ""}.`);
  }

  return parts.join("\n");
}
