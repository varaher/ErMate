import { Router } from "express";
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts";
import { db } from "../../src/lib/firebase-admin.ts";
import { validateProtocolFlag, underDailyFlagLimit } from "../../src/lib/protocolFlag.ts";

const router = Router();

// Per-server-instance memory of each user's recent flags (spam guard; the real record is in Firestore).
const recentByUser = new Map<string, number[]>();

/**
 * POST /api/protocol-flags
 * A logged-in user flags a concern on a protocol (or one step). Stored privately for the reviewers.
 * It never changes any protocol and returns nothing about other users' flags.
 */
router.post("/", requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: "Please sign in to flag a concern." });

    const parsed = validateProtocolFlag(req.body);
    if (!parsed.ok || !parsed.value) return res.status(400).json({ success: false, error: parsed.error || "Invalid flag." });

    const now = Date.now();
    const mine = (recentByUser.get(uid) || []).filter((t) => now - t < 24 * 60 * 60 * 1000);
    if (!underDailyFlagLimit(mine, now)) {
      return res.status(429).json({ success: false, error: "You have sent many flags today. Please try again tomorrow." });
    }

    await db.collection("protocolFlags").add({
      ...parsed.value,
      uid,
      email: req.user?.email || "",
      status: "open",
      createdAt: new Date(now).toISOString(),
    });
    mine.push(now);
    recentByUser.set(uid, mine);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[protocol-flags] save failed:", error?.message || error);
    return res.status(500).json({ success: false, error: "Could not send your flag. Please try again." });
  }
});

export default router;