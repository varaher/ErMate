import { Router } from "express";
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts";
import { db, adminAuth } from "../../src/lib/firebase-admin.ts";
import { checkDeleteRequest, deleteAccount, type DeletionDeps } from "../services/accountDeletion.ts";

const router = Router();

const deps: DeletionDeps = {
  hasActiveTeamMembership: async (uid) => {
    const m = await db.collection("team_members").doc(uid).get();
    if (!m.exists) return false;
    const st = String(m.data()?.status || "").trim().toLowerCase();
    return st === "active" || st === "active (joined)";
  },
  findOwned: async (collection, filters) => {
    let q: any = db.collection(collection);
    for (const [f, v] of filters) q = q.where(f, "==", v);
    const snap = await q.get();
    return snap.docs.map((d: any) => d.ref);
  },
  docRef: (collection, id) => db.collection(collection).doc(id),
  recursiveDelete: (ref) => db.recursiveDelete(ref),
  deleteAuthUser: async (uid) => {
    try { await adminAuth.deleteUser(uid); }
    catch (e: any) { if (e?.code !== "auth/user-not-found") throw e; }
  },
  logDeletion: async (entry) => { await db.collection("accountDeletionLog").add(entry); },
};

/** POST /api/account/delete  { confirm: "DELETE" }  — owner only, needs a login within the last 5 minutes. */
router.post("/delete", requireAuth, async (req: AuthRequest, res) => {
  const uid = String(req.user?.uid || "");
  const gate = checkDeleteRequest(req.body, (req.user as any)?.auth_time);
  if (gate.ok === false) return res.status(gate.code === "RECENT_LOGIN_REQUIRED" ? 401 : 400).json({ success: false, code: gate.code, error: gate.message });
  try {
    const result = await deleteAccount(deps, uid);
    if (result.ok === false) return res.status(409).json({ success: false, code: result.code, error: result.message });
    return res.json({ success: true, deleted: result.deleted });
  } catch (e: any) {
    console.error("[account-delete] failed for", uid, e?.message || e);
    return res.status(500).json({ success: false, error: "Could not finish deleting your account. Nothing further was changed; please try again." });
  }
});

export default router;
