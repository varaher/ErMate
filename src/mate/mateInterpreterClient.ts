/**
 * ErMate — MATE Interpreter Client
 *
 * Client-side integration for calling POST /api/mate/interpret
 * using authenticatedFetch.
 *
 * Invariants:
 * 1. Attaches Firebase bearer token via authenticatedFetch.
 * 2. If user is unauthenticated, throws AuthRequiredError.
 * 3. Gracefully returns fallback response if network/server fails.
 */

import { authenticatedFetch, AuthRequiredError } from "../services/authenticatedFetch";
import type {
  MateInterpretation,
  MateInterpretationRequestBody,
} from "./mateInterpretationTypes";
import { sanitizeInterpretation } from "./mateInterpretationSanitizer";

export async function interpretWithServer(
  body: MateInterpretationRequestBody
): Promise<{ success: boolean; data: MateInterpretation; isAuthError?: boolean }> {
  try {
    const res = await authenticatedFetch("/api/mate/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 401) {
        return {
          success: false,
          isAuthError: true,
          data: {
            conversationalReply: "Your session needs to be refreshed. Please sign in again.",
            tasks: [],
            needsClarification: false,
            confidence: "LOW",
          },
        };
      }
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Server interpretation failed");
    }

    const json = await res.json();
    const data = sanitizeInterpretation(json.data);
    return { success: true, data };
  } catch (err: any) {
    if (err instanceof AuthRequiredError) {
      return {
        success: false,
        isAuthError: true,
        data: {
          conversationalReply: "Your session needs to be refreshed. Please sign in again.",
          tasks: [],
          needsClarification: false,
          confidence: "LOW",
        },
      };
    }
    return {
      success: false,
      data: {
        conversationalReply: "Sorry, I didn't quite get that. Which patient are you referring to?",
        tasks: [],
        needsClarification: false,
        confidence: "LOW",
      },
    };
  }
}
