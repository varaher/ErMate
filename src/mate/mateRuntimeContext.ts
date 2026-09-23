import type { MateCaseSheetTab, MateSurfaceId, MateTopLevelTab } from "./mateAppMap";

/**
 * Runtime context supplied by ErMate to MATE on every turn.
 *
 * MATE must never infer patient identity/case ownership from conversation text
 * when ErMate already has authoritative UI context. The host app supplies IDs;
 * the model receives only the minimum clinical context required by the task.
 */
export interface MateRuntimeContext {
  activeTopLevelTab: MateTopLevelTab;
  activeSurface: MateSurfaceId;
  activeCaseId: string | null;
  activeCaseSheetTab: MateCaseSheetTab | null;
  hasActiveScribeSession: boolean;
  isCaseSheetDirty: boolean;
  isVoiceBusy: boolean;
  userRole: string | null;
  /** Capabilities already filtered by ErMate's existing role/session rules. */
  allowedCapabilityIds: string[];
}

export interface MateHostUiState {
  activeTab: MateTopLevelTab;
  selectedCaseId?: string | null;
  viewCaseSheetPrintId?: string | null;
  activeFormMode?: "full" | "quick" | null;
  showDischargeSummaryId?: string | null;
  showVoiceScribeChat?: boolean;
  activeScribeCaseId?: string | null;
  showPediatricCalculator?: boolean;
  showPocketMirror?: boolean;
  showQuickDischarge?: boolean;
  caseSheetTab?: MateCaseSheetTab | null;
  hasActiveScribeSession?: boolean;
  isCaseSheetDirty?: boolean;
  isVoiceBusy?: boolean;
  userRole?: string | null;
  allowedCapabilityIds?: string[];
}

/**
 * Convert existing App.tsx state into a single deterministic surface identity.
 * Precedence mirrors ErMate's current modal/workspace rendering: specific
 * clinical workspaces win over the underlying top-level tab.
 */
export function resolveMateRuntimeContext(state: MateHostUiState): MateRuntimeContext {
  let activeSurface: MateSurfaceId = `tab:${state.activeTab}`;
  let activeCaseId: string | null = state.selectedCaseId || null;

  if (state.viewCaseSheetPrintId) {
    activeSurface = "case-sheet-print";
    activeCaseId = state.viewCaseSheetPrintId;
  } else if (state.showDischargeSummaryId) {
    activeSurface = "discharge-summary";
    activeCaseId = state.showDischargeSummaryId;
  } else if (state.showVoiceScribeChat) {
    activeSurface = "scribe";
    activeCaseId = state.activeScribeCaseId || state.selectedCaseId || null;
  } else if (state.activeFormMode === "full") {
    activeSurface = "new-case-full";
  } else if (state.activeFormMode === "quick") {
    activeSurface = "new-case-quick";
  } else if (state.showPediatricCalculator) {
    activeSurface = "pediatric-calculator";
  } else if (state.showPocketMirror) {
    activeSurface = "pocket-mirror";
  } else if (state.showQuickDischarge) {
    activeSurface = "quick-discharge";
  } else if (state.selectedCaseId) {
    activeSurface = "case-sheet";
    activeCaseId = state.selectedCaseId;
  }

  return {
    activeTopLevelTab: state.activeTab,
    activeSurface,
    activeCaseId,
    activeCaseSheetTab: activeSurface === "case-sheet" ? state.caseSheetTab || null : null,
    hasActiveScribeSession: Boolean(state.hasActiveScribeSession),
    isCaseSheetDirty: Boolean(state.isCaseSheetDirty),
    isVoiceBusy: Boolean(state.isVoiceBusy),
    userRole: state.userRole || null,
    allowedCapabilityIds: state.allowedCapabilityIds || [],
  };
}

export function mateHasActiveCase(context: MateRuntimeContext): boolean {
  return Boolean(context.activeCaseId);
}

export function mateContextSummary(context: MateRuntimeContext): string {
  const parts = [
    `surface=${context.activeSurface}`,
    `topLevel=${context.activeTopLevelTab}`,
    `case=${context.activeCaseId || "none"}`,
  ];
  if (context.activeCaseSheetTab) parts.push(`caseSection=${context.activeCaseSheetTab}`);
  if (context.isCaseSheetDirty) parts.push("unsavedCaseChanges=true");
  if (context.isVoiceBusy) parts.push("voiceBusy=true");
  return parts.join("; ");
}
