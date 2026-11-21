/**
 * POST /api/case-sheet/hpi-from-case
 * Writes the History of Present Illness from the whole recorded case (server/caseSummaryHpi.ts).
 * Protected by requireAuth. Not credit-metered (a few paise per case, part of preparing the sheet).
 * Body: HpiCaseInput — history fields only; no patient name / UHID is sent by the app.
 */
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts";
import { writeHpiFromCase, defaultHpiModels, type HpiCaseInput } from "../caseSummaryHpi.ts";

const router = Router();

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim() || key === "MY_ANTHROPIC_API_KEY") return null;
  anthropicClient = new Anthropic({ apiKey: key });
  return anthropicClient;
}

const field = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : null);

router.post("/hpi-from-case", requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    const input: HpiCaseInput = {
      sex: field(b.sex),
      presentingComplaint: field(b.presentingComplaint),
      symptoms: field(b.symptoms),
      events: field(b.events),
      currentHpi: field(b.currentHpi),
      pastHistory: field(b.pastHistory),
      surgicalHistory: field(b.surgicalHistory),
      medications: field(b.medications),
      arrivalMode: field(b.arrivalMode),
      notes: field(b.notes),
    };
    const result = await writeHpiFromCase(input, defaultHpiModels(getAnthropic));
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[HPI from case] failed:", error?.message || error);
    // Never fabricate: the app keeps whatever HPI the case already has.
    return res.status(503).json({ success: false, hpi: null, source: "none", error: "Could not write the HPI right now." });
  }
});

export default router;