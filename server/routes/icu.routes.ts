// ============================================================
// ErMate — ICU Mode: dictation / pasted note → structured ICU note draft
// File: server/routes/icu.routes.ts
//
// Pipeline: requireAuth → credit meter → deidentifyText (DPDP, server-side)
//           → withFallback (existing extraction cascade, temperature 0) → JSON.
// The client sanitises the JSON again (src/icu/icuLogic.ts → sanitizeExtraction)
// and shows it as "Not yet applied" until the doctor taps Apply.
// ============================================================

import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts";
import { deidentifyText } from "../deidentify.ts";
import { withFallback, safeParseJSON } from "../extraction.ts";
import { meterCredits } from "../services/creditMeter.ts";
import { db } from "../../src/lib/firebase-admin.ts";
import { buildIcuExtractionPrompt } from "../icuPrompt.ts";

const router = Router();

const MAX_CHARS = 20_000;

router.post(
  "/api/icu/extract",
  requireAuth,
  meterCredits("voice_extract", () => db),
  async (req: AuthRequest, res: Response) => {
    const raw = typeof req.body?.text === "string" ? req.body.text : "";
    const noteKind: "admission" | "daily" = req.body?.noteKind === "admission" ? "admission" : "daily";
    const text = raw.trim();
    if (!text) return res.status(400).json({ success: false, error: "Nothing was dictated." });
    if (text.length > MAX_CHARS) {
      return res.status(413).json({ success: false, error: "Dictation is too long. Please split it into parts." });
    }

    // DPDP: strip PHI before any model call.
    const phi = deidentifyText(text);

    try {
      const out = await withFallback(buildIcuExtractionPrompt(phi.deidentified, noteKind), "ICUExtract");
      const parsed = safeParseJSON(out, "ICUExtract");
      if (!parsed) {
        return res.status(502).json({ success: false, error: "Could not read the note. Please try again." });
      }
      return res.json({ success: true, data: parsed, phiProtectedCount: phi.phiCount });
    } catch (err: any) {
      console.error("[ICUExtract] failed:", err?.message);
      return res.status(503).json({ success: false, error: "ICU scribe is temporarily unavailable. Nothing was saved." });
    }
  },
);

export default router;