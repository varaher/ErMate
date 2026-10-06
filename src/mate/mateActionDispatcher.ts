/**
 * MATE Universal Action Dispatcher
 *
 * MATE does not recreate ErMate features here.
 *
 * The router decides WHAT capability the clinician requested.
 * The dispatcher decides WHICH existing ErMate bridge should execute it.
 *
 * Clinical extraction, persistence and clinical schemas remain owned by
 * the existing ErMate workflows.
 */

import type { MateActionCapability } from "./mateContracts";
export type { MateActionCapability };

export interface MateActionRequest {
  capability: MateActionCapability | string;

  /**
   * Existing ErMate case context.
   * Null is valid while a new case is still being established.
   */
  caseId?: string | null;

  /**
   * Target section for case.section.* capabilities.
   */
  sectionId?: string | null;

  /**
   * Target tab for navigation capabilities.
   */
  targetTab?: string | null;

  /**
   * Existing MATE/Scribe session context.
   */
  sessionId?: string | null;

  /**
   * Original clinician utterance.
   */
  utterance?: string;
}

export type MateActionResult =
  | {
      handled: true;
      capability: string;
      message?: string;
      data?: any;
    }
  | {
      handled: false;
      capability: string;
      reason: "UNSUPPORTED_CAPABILITY" | "MISSING_HANDLER" | "ERROR";
      error?: string;
    };

export interface MateActionHandlers {
  /**
   * Bridge into ErMate's EXISTING Case Sheet open workflow.
   */
  openCase?: (request: MateActionRequest) => void | Promise<void>;

  /**
   * Bridge into ErMate's EXISTING Case Sheet section navigation.
   */
  openCaseSection?: (request: MateActionRequest, sectionId: string) => void | Promise<void>;

  /**
   * Bridge into ErMate's EXISTING case summary generator.
   */
  summarizeCase?: (request: MateActionRequest) => string | Promise<string>;

  /**
   * Bridge into ErMate's EXISTING getCasePendingStatus completeness review.
   */
  reviewCaseCompleteness?: (request: MateActionRequest) => any | Promise<any>;

  /**
   * Bridge into ErMate's read-only discharge completeness review.
   */
  reviewDischargeCompleteness?: (request: MateActionRequest) => any | Promise<any>;

  /**
   * Bridge into ErMate's EXISTING 7-Lens / Clinical Rounds debrief.
   */
  reviewRounds?: (request: MateActionRequest) => void | Promise<void>;

  /**
   * Bridge into ErMate's EXISTING top-level navigation (navigateToTab).
   */
  navigateApp?: (request: MateActionRequest, targetTab: string) => void | Promise<void>;
}

/**
 * Execute a MATE capability through an existing ErMate handler.
 *
 * IMPORTANT:
 * - no clinical extraction
 * - no Firestore mutation
 * - no schema persistence
 */
export async function dispatchMateAction(
  request: MateActionRequest,
  handlers: MateActionHandlers = {}
): Promise<MateActionResult> {
  const cap = request.capability;

  // 1. Open Case Sheet
  if (cap === "case.open") {
    if (handlers.openCase) {
      await handlers.openCase(request);
      return { handled: true, capability: cap };
    }
    return { handled: false, capability: cap, reason: "MISSING_HANDLER" };
  }

  // 2. Open Case Sheet Section
  if (cap.startsWith("case.section.") || cap === "case.section") {
    const sectionId = request.sectionId || cap.replace("case.section.", "");
    if (handlers.openCaseSection) {
      await handlers.openCaseSection(request, sectionId);
      return { handled: true, capability: cap };
    }
    return { handled: false, capability: cap, reason: "MISSING_HANDLER" };
  }

  // 3. Summarize Case
  if (cap === "case.summary") {
    if (handlers.summarizeCase) {
      const summaryText = await handlers.summarizeCase(request);
      return { handled: true, capability: cap, message: summaryText };
    }
    return { handled: false, capability: cap, reason: "MISSING_HANDLER" };
  }

  // 4. Review Incomplete Sections
  if (cap === "case.completeness.review") {
    if (handlers.reviewCaseCompleteness) {
      const pendingData = await handlers.reviewCaseCompleteness(request);
      return { handled: true, capability: cap, data: pendingData };
    }
    return { handled: false, capability: cap, reason: "MISSING_HANDLER" };
  }

  // 5. Review Discharge Completeness
  if (cap === "case.discharge.pending") {
    if (handlers.reviewDischargeCompleteness) {
      const dischargeData = await handlers.reviewDischargeCompleteness(request);
      return { handled: true, capability: cap, data: dischargeData };
    }
    return { handled: false, capability: cap, reason: "MISSING_HANDLER" };
  }

  // 6. Clinical Rounds Review
  if (cap === "case.rounds.review") {
    if (handlers.reviewRounds) {
      await handlers.reviewRounds(request);
      return { handled: true, capability: cap };
    }
    return { handled: false, capability: cap, reason: "MISSING_HANDLER" };
  }

  // 7. Top-Level App Navigation
  if (cap.startsWith("navigate.")) {
    const targetTab = request.targetTab || cap.replace("navigate.", "");
    if (handlers.navigateApp) {
      await handlers.navigateApp(request, targetTab);
      return { handled: true, capability: cap };
    }
    return { handled: false, capability: cap, reason: "MISSING_HANDLER" };
  }

  return {
    handled: false,
    capability: cap,
    reason: "UNSUPPORTED_CAPABILITY",
  };
}
