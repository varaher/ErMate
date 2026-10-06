import { Firestore, doc, runTransaction } from "firebase/firestore";

/**
 * ErMate Safe Clinical Case ID Architecture (P0 Patch 1)
 * 
 * Separates ClinicalCase into two distinct identifiers:
 * 1. INTERNAL ID (ClinicalCase.id):
 *    - Globally unique, collision-resistant UUID (crypto.randomUUID).
 *    - Immutable database document key in Firestore /cases/{id}.
 *    - Used internally for all Scribe sessions, MATE linkages, and routes.
 * 
 * 2. DISPLAY ID (ClinicalCase.displayId):
 *    - Human-facing daily clinical case number in format: YYMMDD### (e.g. 261005001).
 *    - Reset daily, strictly monotonic from 001 to 999.
 *    - Atomically generated via Firestore transaction on case_counters/{YYYY-MM-DD}.
 *    - Fallback for legacy cases: displays existing id (displayId || id).
 */

/**
 * Generate a collision-resistant UUID for internal ClinicalCase identity.
 */
export function generateInternalCaseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC4122 version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC4122 variant
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Fail closed if no secure cryptographic random source is available
  throw new Error("Cryptographically secure random generator unavailable. Cannot generate ClinicalCase identity safely.");
}

/**
 * Returns date keys for displayId formatting:
 * dateKey: "YYYY-MM-DD" (for case_counters doc path)
 * prefixYYMMDD: "YYMMDD" (e.g. "261005" for 05 Oct 2026)
 */
export function getCaseDateKey(date: Date = new Date()): { dateKey: string; prefixYYMMDD: string } {
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    prefixYYMMDD: `${yy}${mm}${dd}`,
  };
}

/**
 * Formats a displayId from date and sequence.
 * Enforces 3-digit sequence (001 - 999).
 * Fails closed if sequence exceeds 999 (no wraparound).
 */
export function formatDisplayId(date: Date, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid display ID sequence: ${sequence}. Sequence must be a positive integer.`);
  }
  if (sequence > 999) {
    throw new Error(`Daily display ID range exhausted (maximum 999 cases reached for date).`);
  }
  const { prefixYYMMDD } = getCaseDateKey(date);
  return `${prefixYYMMDD}${String(sequence).padStart(3, "0")}`;
}

/**
 * Atomically reserve the next daily display sequence using a Firestore transaction.
 * Target document: case_counters/{YYYY-MM-DD}
 */
export async function reserveNextDisplaySequence(
  dbInstance: Firestore,
  targetDate: Date = new Date()
): Promise<{ displayId: string; sequence: number; dateKey: string }> {
  const { dateKey, prefixYYMMDD } = getCaseDateKey(targetDate);
  const counterRef = doc(dbInstance, "case_counters", dateKey);

  const sequence = await runTransaction(dbInstance, async (transaction) => {
    const snap = await transaction.get(counterRef);
    if (!snap.exists()) {
      const firstSeq = 1;
      transaction.set(counterRef, {
        dateKey,
        lastSequence: firstSeq,
        updatedAt: new Date().toISOString(),
      });
      return firstSeq;
    }

    const data = snap.data();
    const currentSeq = typeof data.lastSequence === "number" ? data.lastSequence : 0;
    if (currentSeq >= 999) {
      throw new Error(`Daily display ID range exhausted (maximum 999 cases reached for ${dateKey}).`);
    }

    const nextSeq = currentSeq + 1;
    transaction.update(counterRef, {
      lastSequence: nextSeq,
      updatedAt: new Date().toISOString(),
    });
    return nextSeq;
  });

  const displayId = `${prefixYYMMDD}${String(sequence).padStart(3, "0")}`;
  return { displayId, sequence, dateKey };
}

/**
 * Clinician UI Display Helper:
 * Prefers human-facing displayId (e.g. 261005001), falls back to legacy id (e.g. C-2976).
 * Never exposes raw internal UUID in standard UI.
 */
export function getDisplayCaseId(c?: { displayId?: string | null; id: string } | null): string {
  if (!c) return "";
  return c.displayId || c.id;
}
