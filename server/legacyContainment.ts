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
 * Default-deny: everything except POST-handled /sync-user returns 410, for every
 * HTTP method, with or without credentials.
 */
export function legacySqlGuard(req: Request, res: Response, next: NextFunction) {
  if (normaliseSqlSubPath(req.path) === SQL_ALLOWED_PATH) return next();
  return res.status(410).json({
    success: false,
    code: "LEGACY_SQL_API_DISABLED",
    error: "This legacy endpoint has been permanently disabled.",
  });
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
