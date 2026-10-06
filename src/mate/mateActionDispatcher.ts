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
   * Existing MATE/Scribe session context.
   */
  sessionId?: string | null;

  /**
   * Original clinician utterance.
   *
   * Retained as context only. The dispatcher does not perform clinical
   * extraction from this text.
   */
  utterance?: string;
}

export type MateActionResult =
  | {
      handled: true;
      capability: string;
    }
  | {
      handled: false;
      capability: string;
      reason: "UNSUPPORTED_CAPABILITY";
    };

export interface MateActionHandlers {
  /**
   * Bridge into ErMate's EXISTING Case Sheet open/preview workflow.
   */
  openCase?: (request: MateActionRequest) => void | Promise<void>;

  /**
   * Reserved bridge into ErMate's EXISTING 7-Lens / Clinical Rounds workflow.
   *
   * It is deliberately not executed until its vertical slice is wired.
   */
  reviewRounds?: (request: MateActionRequest) => void | Promise<void>;
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
  if (request.capability === "case.open") {
    if (handlers.openCase) {
      await handlers.openCase(request);
      return { handled: true, capability: request.capability };
    }

    return {
      handled: false,
      capability: request.capability,
      reason: "UNSUPPORTED_CAPABILITY",
    };
  }

  if (request.capability === "case.rounds.review") {
    if (handlers.reviewRounds) {
      await handlers.reviewRounds(request);
      return { handled: true, capability: request.capability };
    }

    return {
      handled: false,
      capability: request.capability,
      reason: "UNSUPPORTED_CAPABILITY",
    };
  }

  return {
    handled: false,
    capability: request.capability,
    reason: "UNSUPPORTED_CAPABILITY",
  };
}
