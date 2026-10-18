/**
 * MARKER: ERMATE-BATCH0-PA-PB-V2
 * Batch 0 safety containment (P-A legacy SQL, P-B learning capture, B3 log redaction).
 *
 * These guards are deliberately NOT configurable. No environment variable can
 * re-open the routes they cover: re-enabling requires new code that performs
 * server-side hospital-membership, ownership and role authorization, plus
 * purpose-specific consent and tenant isolation for learning capture.
 */
import type { NextFunction, Request, Response } from "express";

/** Only this path under /api/sql stays reachable (it enforces uid === token uid). */
export const SQL_ALLOWED_PATH = "/sync-user";

/** Normalise a path relative to the /api/sql mount: lower-case, no trailing slash. */
function normaliseSqlSubPath(p: string): string {
  const lower = String(p || "/").toLowerCase();
  const trimmed = lower.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * P-A. Mount with app.use("/api/sql", legacySqlGuard) BEFORE any /api/sql route.
 * Default-deny: everything except `POST /sync-user` returns 410. The exception is
 * pinned to BOTH method and path, so a future handler on another verb cannot slip through.
 */
export function legacySqlGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method === "POST" && normaliseSqlSubPath(req.path) === SQL_ALLOWED_PATH) return next();
  return res.status(410).json({
    success: false,
    code: "LEGACY_SQL_API_DISABLED",
    error: "This legacy endpoint has been permanently disabled.",
  });
}

/**
 * S3. The SQL users row is only an identity mirror. role / hospital / aiCredits /
 * subscriptionTier / consent are server-owned (Firestore rules + payments webhook), so
 * NOTHING the client sends for them is ever stored. On update only email + name change.
 */
export interface SyncUserRecord {
  insert: {
    uid: string; email: string; name: string; role: string; hospital: string;
    aiCredits: number; streak: number; subscriptionTier: string; hasConsentedToLearning: null;
  };
  update: { email: string; name: string };
}

export function buildSyncUserRecord(
  body: { uid?: unknown; email?: unknown; name?: unknown } | null | undefined,
  token: { uid?: string; email?: string } | null | undefined
): SyncUserRecord | null {
  const uid = String(token?.uid || "");
  const name = String(body?.name ?? "").trim().slice(0, 200);
  const email = String(token?.email || body?.email || "").trim().slice(0, 320);
  if (!uid || !email || !name) return null;
  return {
    insert: {
      uid, email, name,
      role: "EM Physician",
      hospital: "Varah Group Emergency Care",
      aiCredits: 350,
      streak: 0,
      subscriptionTier: "Free Standard",
      hasConsentedToLearning: null,
    },
    update: { email, name },
  };
}

/**
 * Credit gate: decided ONLY from the server-side stored balance, never from the request body.
 * Unknown / missing balance does not block clinical use (fail open); a stored balance < 1 does.
 */
export function evaluateCreditGate(storedCredits: unknown): { allowed: boolean; remaining?: number } {
  if (typeof storedCredits !== "number" || !Number.isFinite(storedCredits)) return { allowed: true };
  if (storedCredits < 1) return { allowed: false, remaining: storedCredits };
  return { allowed: true, remaining: storedCredits - 1 };
}

/**
 * P-B. Capture of clinician corrections is closed. The decision never reads
 * the request body, the caller's claimed identity, any environment flag or any
 * stored consent value, so none of those can authorise collection.
 */
export function learningCaptureDecision(): { allowed: false; code: string } {
  return { allowed: false, code: "LEARNING_CAPTURE_DISABLED" };
}

export function learningFeedbackRejectHandler(_req: Request, res: Response) {
  const d = learningCaptureDecision();
  return res.status(403).json({
    success: false,
    captured: false,
    code: d.code,
    error: "Learning capture is disabled. Nothing was stored.",
  });
}

/**
 * B3. Use when logging errors from the global Express error handlers.
 * body-parser attaches the raw request text to `err.body` (and V8 parse
 * messages can echo a snippet of it), so a malformed-JSON POST would otherwise
 * write submitted content, including clinical text, to the server logs.
 * Any error carrying a body, or a body-parser parse failure, is reduced to
 * non-content fields. All other errors are returned unchanged.
 */
export function errorForLog(err: any): any {
  if (
    err &&
    typeof err === "object" &&
    (err.type === "entity.parse.failed" || "body" in err)
  ) {
    return {
      name: err.name,
      type: err.type,
      status: err.status ?? err.statusCode,
      message: "Request body rejected (content withheld from logs)",
    };
  }
  return err;
}
