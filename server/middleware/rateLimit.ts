import type { Request, Response, NextFunction } from "express";

/**
 * Small in-memory per-client rate limiter for /api (no new dependency).
 * Keyed by client IP (first X-Forwarded-For hop on Cloud Run). Generous so a
 * hospital NAT is not throttled in normal use; it exists to stop abuse bursts.
 * The Razorpay webhook is exempt (signature-verified, comes from Razorpay IPs).
 */
export function apiRateLimit(opts: { windowMs?: number; max?: number } = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 300;
  const hits = new Map<string, { n: number; reset: number }>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS" || req.originalUrl.startsWith("/api/payments/webhook")) return next();
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      lastSweep = now;
    }
    const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const key = fwd || req.ip || "unknown";
    let e = hits.get(key);
    if (!e || e.reset <= now) { e = { n: 0, reset: now + windowMs }; hits.set(key, e); }
    e.n += 1;
    if (e.n > max) {
      res.setHeader("Retry-After", String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ success: false, error: "Too many requests. Please wait a minute and try again." });
    }
    next();
  };
}
