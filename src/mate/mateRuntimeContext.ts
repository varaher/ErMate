/**
 * ErMate — MATE Runtime UI Context
 *
 * Captures the current browser UI state for contextual decision-making.
 *
 * Invariants:
 * 1. UI/runtime context ONLY: never store clinical data, diagnoses, or patient facts here.
 * 2. Does NOT replace or duplicate ClinicalCase.
 * 3. Ephemeral: discarded on page reload or user logout.
 */

import { isCapabilityAllowedForRole, MATE_APP_CAPABILITIES } from "./mateAppMap";

export interface MateRuntimeContext {
  activeTopLevelTab: string;
  activeSurface: "dashboard" | "cases" | "case-sheet" | "discharge-summary" | "handover" | "modal" | "other";
  activeCaseId: string | null;
  activeCaseSheetTab: string | null;
  hasActiveScribeSession: boolean;
  isCaseSheetDirty: boolean;
  isVoiceBusy: boolean;
  userRole: string;
  allowedCapabilityIds: string[];
}

export function createDefaultRuntimeContext(params?: Partial<MateRuntimeContext>): MateRuntimeContext {
  const userRole = params?.userRole || "resident";
  const allowedCapabilityIds = Object.keys(MATE_APP_CAPABILITIES).filter((capId) =>
    isCapabilityAllowedForRole(capId, userRole)
  );

  return {
    activeTopLevelTab: params?.activeTopLevelTab || "dashboard",
    activeSurface: params?.activeSurface || "dashboard",
    activeCaseId: params?.activeCaseId || null,
    activeCaseSheetTab: params?.activeCaseSheetTab || null,
    hasActiveScribeSession: params?.hasActiveScribeSession ?? false,
    isCaseSheetDirty: params?.isCaseSheetDirty ?? false,
    isVoiceBusy: params?.isVoiceBusy ?? false,
    userRole,
    allowedCapabilityIds,
  };
}
