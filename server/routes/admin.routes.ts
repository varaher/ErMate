/**
 * Admin portal API — /api/admin/*  (platform admin only)
 *
 * Every figure comes from a real record. Nothing here estimates from case counts or fills a default:
 *  - users / hospitals / locations : Firebase Auth + users + team_members + hospital_directory + hospital_subscriptions
 *  - AI usage and cost             : aiUsageDaily (written by server/services/aiUsage.ts for every vendor call)
 *  - revenue                       : creditLedger, creditRefunds, autopaySubscriptions, autopayMismatches, paymentIntents
 *  - provider balances             : providerBalances (entered by the admin until vendor billing sync exists)
 *
 * Writes (each one audit-logged to adminAuditLog): HOD reject, credit adjust, provider balance entry.
 * HOD approval stays on the existing POST /api/team/approve-hod-claim.
 * No patient content is ever returned: cases are only counted.
 */
import { Router, type Response, type NextFunction } from "express";
import { adminAuth, db } from "../../src/lib/firebase-admin.ts";
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts";
import { computeAccess, OWNER_EMAIL } from "../../src/lib/access.ts";
import { RUPEES_PER_CREDIT, TARGET_COST_PER_CREDIT_RUPEES } from "../../src/lib/pricing.ts";
import { hospitalSlug } from "../services/creditMeter.ts";
import { hodApprovalWarnings, resolveHodHospital } from "../services/hodClaimChecks.ts";
import { istDay, usageKey } from "../services/aiUsage.ts";
import { usdToInrRate } from "../services/aiPrices.ts";

const router = Router();
const DAY_MS = 24 * 60 * 60 * 1000;

// ───────────────────────── access ─────────────────────────

/**
 * Platform admin only: the owner email, VERIFIED by Firebase (Google sign-in always is),
 * and — when ADMIN_UIDS is set — one of those exact Firebase UIDs.
 */
export function requirePlatformAdminVerified(req: AuthRequest, res: Response, next: NextFunction) {
  const email = String(req.user?.email || "").trim().toLowerCase();
  if (email !== OWNER_EMAIL) return res.status(403).json({ error: "Not available." });
  if (req.user?.email_verified !== true) {
    return res.status(403).json({ code: "EMAIL_NOT_VERIFIED", error: "Sign in with Google, or verify this email address first." });
  }
  const allow = String(process.env.ADMIN_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (allow.length > 0 && !allow.includes(String(req.user?.uid || ""))) return res.status(403).json({ error: "Not available." });
  return next();
}

router.use(requireAuth, requirePlatformAdminVerified);
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

// ───────────────────────── helpers ─────────────────────────

function rangeDays(q: any): number {
  const n = Math.round(Number(q?.days));
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : 30;
}
/** First IST day of a range ending today. days=1 → today only. */
function sinceDay(days: number): string {
  return istDay(new Date(Date.now() - (days - 1) * DAY_MS));
}
function istDayStartIso(day: string): string {
  return new Date(`${day}T00:00:00+05:30`).toISOString();
}
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const numOr0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const norm = (s: unknown) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isActiveMember = (m: any) => ["active", "active (joined)"].includes(String(m?.status || "").trim().toLowerCase());
const isHodRole = (r: unknown) => String(r || "").trim().toLowerCase().startsWith("hod");
const money = (n: number) => Math.round(n * 100) / 100;

async function allDocs(collection: string): Promise<any[]> {
  const snap = await db.collection(collection).get();
  return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
}

async function listAuthUsers(): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  let token: string | undefined = undefined;
  do {
    const page: any = await adminAuth.listUsers(1000, token);
    for (const u of page.users) out.set(u.uid, u);
    token = page.pageToken;
  } while (token);
  return out;
}

async function adminAudit(req: AuthRequest, action: string, details: Record<string, any>) {
  await db.collection("adminAuditLog").add({
    at: new Date().toISOString(),
    action,
    actorUid: req.user?.uid || null,
    actorEmail: req.user?.email || null,
    ...details,
  });
}

/** Sum aiUsageDaily docs from `fromDay` (inclusive) to today. */
async function loadUsage(fromDay: string) {
  const snap = await db.collection("aiUsageDaily").where("day", ">=", fromDay).get();
  const days: any[] = snap.docs.map((d: any) => d.data() || {});
  const totals = { calls: 0, costInr: 0, failed: 0 };
  const byProvider: Record<string, { calls: number; costInr: number; failed: number }> = {};
  const byFeatureModel: Record<string, any> = {};
  const byUser: Record<string, { calls: number; costInr: number }> = {};
  const byDayProvider: Record<string, Record<string, number>> = {};
  const labels: Record<string, any> = {};

  for (const d of days) {
    totals.calls += numOr0(d.totals?.calls);
    totals.costInr += numOr0(d.totals?.costInr);
    totals.failed += numOr0(d.totals?.failed);
    for (const [p, v] of Object.entries<any>(d.byProvider || {})) {
      const t = (byProvider[p] ||= { calls: 0, costInr: 0, failed: 0 });
      t.calls += numOr0(v.calls); t.costInr += numOr0(v.costInr); t.failed += numOr0(v.failed);
      ((byDayProvider[d.day] ||= {})[p] = (byDayProvider[d.day]?.[p] || 0) + numOr0(v.costInr));
    }
    for (const [k, v] of Object.entries<any>(d.byFeatureModel || {})) {
      const t = (byFeatureModel[k] ||= { calls: 0, costInr: 0, failed: 0, inputTokens: 0, outputTokens: 0, audioSeconds: 0 });
      for (const f of ["calls", "costInr", "failed", "inputTokens", "outputTokens", "audioSeconds"]) t[f] += numOr0(v[f]);
    }
    for (const [u, v] of Object.entries<any>(d.byUser || {})) {
      const t = (byUser[u] ||= { calls: 0, costInr: 0 });
      t.calls += numOr0(v.calls); t.costInr += numOr0(v.costInr);
    }
    Object.assign(labels, d.labels || {});
  }
  return { totals, byProvider, byFeatureModel, byUser, byDayProvider, labels, daysWithData: days.length };
}

function planFor(user: any, authUser: any, member: any, subs: Map<string, any>) {
  const covered = !!member && isActiveMember(member) && member.membershipVerified === true &&
    [member.hospitalId, member.teamId, hospitalSlug(member.hospital)].map(x => str(x)).filter(Boolean).some(id => subs.get(id)?.active === true);
  const access = computeAccess({
    accountCreatedAt: authUser?.metadata?.creationTime ? new Date(authUser.metadata.creationTime).toISOString() : null,
    email: authUser?.email || user?.email,
    subscriptionTier: user?.subscriptionTier,
    tierExpiresAt: user?.tierExpiresAt,
    coveredByTeam: covered,
  });
  const label = covered ? "Hospital plan"
    : access.state === "exempt" ? "Owner"
    : access.state === "paid" ? "Paid"
    : access.state === "grace" ? "Grace"
    : access.state === "trial" ? "Trial"
    : "Expired";
  return { state: access.state, label, daysLeft: access.daysLeft, endsAt: access.endsAt, covered };
}

// ───────────────────────── users ─────────────────────────

async function buildUsers() {
  const [authUsers, profiles, members, subsList, autopay, usage] = await Promise.all([
    listAuthUsers(), allDocs("users"), allDocs("team_members"), allDocs("hospital_subscriptions"),
    allDocs("autopaySubscriptions"), loadUsage(sinceDay(30)),
  ]);
  const profileByUid = new Map(profiles.map(p => [p.id, p]));
  const memberByUid = new Map(members.map(m => [m.id, m]));
  const subs = new Map(subsList.map(s => [s.id, s]));
  const autopayByUid = new Map(autopay.map(a => [a.id, a]));
  const uids = new Set<string>([...authUsers.keys(), ...profileByUid.keys()]);

  const rows = [...uids].map(uid => {
    const a = authUsers.get(uid), p = profileByUid.get(uid) || {}, m = memberByUid.get(uid);
    const plan = planFor(p, a, m, subs);
    const u = usage.byUser[usageKey(uid)];
    const lastActive = a?.metadata?.lastRefreshTime || a?.metadata?.lastSignInTime || null;
    const memberActive = !!m && isActiveMember(m);
    return {
      uid,
      name: str(p.name) || str(a?.displayName) || "",
      email: str(a?.email) || str(p.email),
      emailVerified: a?.emailVerified === true,
      disabled: a?.disabled === true,
      inAuth: !!a,
      hasProfile: profileByUid.has(uid),
      createdAt: a?.metadata?.creationTime ? new Date(a.metadata.creationTime).toISOString() : str(p.createdAt) || null,
      lastActiveAt: lastActive ? new Date(lastActive).toISOString() : null,
      role: memberActive ? str(m.role) : str(p.role),
      workspace: memberActive ? "Hospital team" : "Independent",
      hospital: memberActive ? (str(m.hospitalName) || str(m.hospital)) : (str(p.workplaceName) || str(p.hospitalLabel) || str(p.hospital)),
      hospitalId: memberActive ? str(m.hospitalId) : "",
      place: str(p.place), district: str(p.district), state: str(p.state),
      plan: plan.label, planState: plan.state, planDaysLeft: plan.daysLeft, planEndsAt: plan.endsAt,
      credits: typeof p.aiCredits === "number" ? p.aiCredits : null,
      hasPurchased: p.hasPurchased === true,
      autopayStatus: autopayByUid.get(uid)?.status || null,
      aiCalls30d: u?.calls || 0,
      aiCost30d: money(u?.costInr || 0),
    };
  });
  rows.sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || "")));
  return { rows, usageDays: usage.daysWithData };
}

router.get("/users", async (_req, res) => {
  try {
    const { rows, usageDays } = await buildUsers();
    res.json({ asOf: new Date().toISOString(), users: rows, usageDaysLogged: usageDays });
  } catch (e: any) {
    console.error("[admin/users]", e?.message || e);
    res.status(500).json({ error: "Could not load users." });
  }
});

// ───────────────────────── hospitals ─────────────────────────

router.get("/hospitals", async (_req, res) => {
  try {
    const [members, directory, subsList, profiles] = await Promise.all([
      allDocs("team_members"), allDocs("hospital_directory"), allDocs("hospital_subscriptions"), allDocs("users"),
    ]);
    const subs = new Map(subsList.map(s => [s.id, s]));
    const dirByName = new Map(directory.map(d => [norm(d.name), d]));
    const teams = new Map<string, any>();
    for (const m of members) {
      if (!isActiveMember(m)) continue;
      const id = str(m.hospitalId) || hospitalSlug(m.hospital);
      if (!id) continue;
      const t = teams.get(id) || { hospitalId: id, name: str(m.hospitalName) || str(m.hospital) || id, members: 0, verifiedMembers: 0, hods: [] as string[] };
      t.members += 1;
      if (m.membershipVerified === true) t.verifiedMembers += 1;
      if (isHodRole(m.role)) t.hods.push(str(m.name) || str(m.email) || m.id);
      teams.set(id, t);
    }
    const profileCountByName = new Map<string, number>();
    for (const p of profiles) {
      const k = norm(p.workplaceName || p.hospitalLabel || p.hospital);
      if (k) profileCountByName.set(k, (profileCountByName.get(k) || 0) + 1);
    }

    const teamRows = [...teams.values()];
    const caseCounts = await Promise.all(teamRows.slice(0, 60).map(async t => {
      try { return (await db.collection("cases").where("hospitalId", "==", t.hospitalId).count().get()).data().count as number; }
      catch { return null; }
    }));

    const usedDir = new Set<string>();
    const rows: any[] = teamRows.map((t, i) => {
      const dir = dirByName.get(norm(t.name));
      if (dir) usedDir.add(dir.id);
      const sub = subs.get(t.hospitalId) || subs.get(hospitalSlug(t.name));
      return {
        hospitalId: t.hospitalId, name: t.name,
        place: str(dir?.place), district: str(dir?.district), state: str(dir?.state),
        directoryStatus: dir ? (str(dir.status) || "unverified") : "not in directory",
        hasTeam: true, members: t.members, verifiedMembers: t.verifiedMembers, hods: t.hods,
        doctorsListingIt: profileCountByName.get(norm(t.name)) || 0,
        subscriptionActive: sub?.active === true,
        cases: i < 60 ? caseCounts[i] : null,
      };
    });
    for (const d of directory) {
      if (usedDir.has(d.id)) continue;
      rows.push({
        hospitalId: d.id, name: str(d.name), place: str(d.place), district: str(d.district), state: str(d.state),
        directoryStatus: str(d.status) || "unverified", hasTeam: false, members: 0, verifiedMembers: 0, hods: [],
        doctorsListingIt: profileCountByName.get(norm(d.name)) || 0, subscriptionActive: false, cases: null,
      });
    }
    rows.sort((a, b) => Number(b.hasTeam) - Number(a.hasTeam) || b.members - a.members || b.doctorsListingIt - a.doctorsListingIt || a.name.localeCompare(b.name));
    res.json({ asOf: new Date().toISOString(), hospitals: rows });
  } catch (e: any) {
    console.error("[admin/hospitals]", e?.message || e);
    res.status(500).json({ error: "Could not load hospitals." });
  }
});

// ───────────────────────── HOD requests ─────────────────────────

router.get("/hod-claims", async (req, res) => {
  try {
    const status = ["pending", "approved", "rejected"].includes(String(req.query.status)) ? String(req.query.status) : "pending";
    const snap = await db.collection("hodClaimRequests").where("status", "==", status).get();
    let claims: any[] = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
    claims.sort((a, b) => String(b.reviewedAt || b.createdAt || "").localeCompare(String(a.reviewedAt || a.createdAt || "")));
    if (status !== "pending") claims = claims.slice(0, 100);

    const directory = status === "pending" ? await allDocs("hospital_directory") : [];
    const dirByName = new Map(directory.map(d => [norm(d.name), d]));

    const out = await Promise.all(claims.map(async c => {
      const base = {
        id: c.id, status: c.status, hospital: str(c.hospital), place: str(c.place), state: str(c.state), pincode: str(c.pincode),
        claimedByUid: str(c.claimedByUid), claimedByName: str(c.claimedByName), claimedByEmail: str(c.claimedByEmail),
        reason: str(c.reason), createdAt: c.createdAt || null, reviewedAt: c.reviewedAt || null,
        rejectionNote: c.rejectionNote || null, resolvedHospitalName: c.resolvedHospitalName || null,
      };
      if (status !== "pending") return base;
      const { hospitalId, hospitalName } = resolveHodHospital(c);
      const [warnings, authUser, profile] = await Promise.all([
        hodApprovalWarnings(db, base.claimedByUid, hospitalId, hospitalName).catch(() => ["Could not check existing HODs and memberships."]),
        base.claimedByUid ? adminAuth.getUser(base.claimedByUid).catch(() => null) : Promise.resolve(null),
        base.claimedByUid ? db.collection("users").doc(base.claimedByUid).get().then((s: any) => (s.exists ? s.data() : null)).catch(() => null) : Promise.resolve(null),
      ]);
      if (authUser && authUser.emailVerified !== true) warnings.push("The doctor's email address is not verified.");
      if (!authUser) warnings.push("No sign-in account found for this doctor.");
      const dir = dirByName.get(norm(hospitalName));
      return {
        ...base,
        hospitalId,
        district: str(profile?.district),
        beds: typeof profile?.erPhysicalBedCapacity === "number" ? profile.erPhysicalBedCapacity : null,
        emailVerified: authUser?.emailVerified === true,
        directoryStatus: dir ? (str(dir.status) || "unverified") : "not in directory",
        warnings,
      };
    }));
    res.json({ status, claims: out });
  } catch (e: any) {
    console.error("[admin/hod-claims]", e?.message || e);
    res.status(500).json({ error: "Could not load HOD requests." });
  }
});

router.post("/hod-claims/:id/reject", async (req: AuthRequest, res) => {
  try {
    const reason = str(req.body?.reason);
    if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: "Give a reason (3 to 500 characters). The doctor will see it." });
    const claimRef = db.collection("hodClaimRequests").doc(String(req.params.id));
    const snap = await claimRef.get();
    if (!snap.exists) return res.status(404).json({ error: "HOD request not found." });
    const claim = snap.data() || {};
    if (claim.status !== "pending") return res.status(400).json({ error: "This request has already been decided." });

    const now = new Date().toISOString();
    const batch = db.batch();
    batch.update(claimRef, {
      status: "rejected", reviewedAt: now, reviewedBy: req.user!.uid, reviewedByEmail: req.user!.email || null, rejectionNote: reason,
    });
    batch.set(db.collection("teamAuditLog").doc(), {
      action: "reject_hod_claim", actorUid: req.user!.uid, actorEmail: req.user!.email || null, actorRole: "platform_admin",
      targetUid: claim.claimedByUid || null, targetEmail: claim.claimedByEmail || null, claimId: snap.id,
      hospitalName: claim.hospital || null, reason, timestamp: now,
    });
    batch.set(db.collection("adminAuditLog").doc(), {
      at: now, action: "hod_claim_rejected", actorUid: req.user!.uid, actorEmail: req.user!.email || null,
      targetUid: claim.claimedByUid || null, claimId: snap.id, hospital: claim.hospital || null, reason,
    });
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    console.error("[admin/hod-reject]", e?.message || e);
    res.status(500).json({ error: "Could not reject the request." });
  }
});

// ───────────────────────── credits ─────────────────────────

router.post("/credits/adjust", async (req: AuthRequest, res) => {
  try {
    const uid = str(req.body?.uid);
    const delta = Number(req.body?.delta);
    const reason = str(req.body?.reason);
    if (!uid) return res.status(400).json({ error: "Choose a doctor." });
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10000) return res.status(400).json({ error: "Change must be a whole number between -10000 and 10000, not 0." });
    if (reason.length < 3 || reason.length > 300) return res.status(400).json({ error: "Give a reason (3 to 300 characters)." });

    const userRef = db.collection("users").doc(uid);
    const result = await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return null;
      const before = numOr0(snap.data()?.aiCredits);
      const after = Math.max(0, before + delta);
      const now = new Date().toISOString();
      tx.update(userRef, { aiCredits: after });
      tx.set(db.collection("adminAuditLog").doc(), {
        at: now, action: "credits_adjusted", actorUid: req.user!.uid, actorEmail: req.user!.email || null,
        targetUid: uid, delta, applied: after - before, before, after, reason,
      });
      return { before, after };
    });
    if (!result) return res.status(404).json({ error: "That doctor has no profile yet." });
    res.json({ success: true, ...result });
  } catch (e: any) {
    console.error("[admin/credits]", e?.message || e);
    res.status(500).json({ error: "Could not change credits." });
  }
});

// ───────────────────────── AI usage ─────────────────────────

router.get("/usage", async (req, res) => {
  try {
    const days = rangeDays(req.query);
    const from = sinceDay(days);
    const [usage, profiles] = await Promise.all([loadUsage(from), allDocs("users")]);
    const nameByKey = new Map(profiles.map(p => [usageKey(p.id), { uid: p.id, name: str(p.name), email: str(p.email) }]));
    const rows = Object.entries<any>(usage.byFeatureModel).map(([k, v]) => ({
      feature: usage.labels[k]?.feature || k, provider: usage.labels[k]?.provider || "", model: usage.labels[k]?.model || "",
      calls: v.calls, failed: v.failed, inputTokens: v.inputTokens, outputTokens: v.outputTokens,
      audioSeconds: Math.round(v.audioSeconds), costInr: money(v.costInr),
    })).sort((a, b) => b.costInr - a.costInr || b.calls - a.calls);
    const byUser = Object.entries(usage.byUser).map(([k, v]) => ({
      ...(nameByKey.get(k) || { uid: k === "_anonymous" ? "" : k, name: k === "_anonymous" ? "Not signed in / background" : "", email: "" }),
      calls: v.calls, costInr: money(v.costInr),
    })).sort((a, b) => b.costInr - a.costInr).slice(0, 100);
    const daily = Object.entries(usage.byDayProvider).map(([day, p]) => ({ day, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, money(v)])) }))
      .sort((a, b) => a.day.localeCompare(b.day));
    res.json({
      days, from, usdInrRate: usdToInrRate(),
      totals: { ...usage.totals, costInr: money(usage.totals.costInr) },
      byProvider: Object.entries(usage.byProvider).map(([provider, v]) => ({ provider, ...v, costInr: money(v.costInr) })).sort((a, b) => b.costInr - a.costInr),
      rows, byUser, daily, daysWithData: usage.daysWithData,
    });
  } catch (e: any) {
    console.error("[admin/usage]", e?.message || e);
    res.status(500).json({ error: "Could not load AI usage." });
  }
});

// ───────────────────────── provider dues ─────────────────────────

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic (Claude)", usageKey: "anthropic", kind: "prepaid" },
  { id: "openai", name: "OpenAI", usageKey: "openai", kind: "prepaid" },
  { id: "sarvam", name: "Sarvam (speech)", usageKey: "sarvam", kind: "prepaid" },
  { id: "google_ai", name: "Google Gemini (AI)", usageKey: "google", kind: "postpaid" },
  { id: "google_cloud", name: "Google Cloud (Cloud Run, Firestore)", usageKey: null, kind: "postpaid" },
  { id: "razorpay", name: "Razorpay fees", usageKey: null, kind: "deducted" },
  { id: "hostinger", name: "Hostinger & other fixed costs", usageKey: null, kind: "fixed" },
] as const;

router.get("/providers", async (_req, res) => {
  try {
    const entries = new Map((await allDocs("providerBalances")).map(e => [e.id, e]));
    const today = istDay();
    const monthStart = `${today.slice(0, 7)}-01`;
    const entryDays = [...entries.values()].map(e => str(e.enteredDay)).filter(Boolean);
    const earliest = [monthStart, sinceDay(7), ...entryDays].sort()[0];
    const floor = sinceDay(120);
    const snap = await db.collection("aiUsageDaily").where("day", ">=", earliest < floor ? floor : earliest).get();
    const days = snap.docs.map((d: any) => d.data() || {});
    const spend = (p: string, from: string) => days.filter(d => d.day >= from).reduce((s, d) => s + numOr0(d.byProvider?.[p]?.costInr), 0);

    const rows = PROVIDERS.map(p => {
      const e = entries.get(p.id);
      const month = p.usageKey ? money(spend(p.usageKey, monthStart)) : null;
      const last7 = p.usageKey ? spend(p.usageKey, sinceDay(7)) : 0;
      const sinceEntry = p.usageKey && e?.enteredDay ? money(spend(p.usageKey, e.enteredDay)) : null;
      const entered = typeof e?.amountInr === "number" ? e.amountInr : null;
      const left = p.kind === "prepaid" && entered !== null && sinceEntry !== null ? money(entered - sinceEntry) : null;
      const perDay = last7 / 7;
      return {
        id: p.id, name: p.name, kind: p.kind,
        spentThisMonth: month, spentLast7Days: p.usageKey ? money(last7) : null,
        entered: e ? { amountInr: entered, note: str(e.note), enteredAt: e.enteredAt || null, enteredDay: e.enteredDay || null } : null,
        spentSinceEntry: sinceEntry,
        estimatedBalanceLeft: left,
        daysLeftAtCurrentUse: left !== null && perDay > 0 ? Math.max(0, Math.floor(left / perDay)) : null,
      };
    });
    res.json({ asOf: new Date().toISOString(), month: today.slice(0, 7), providers: rows });
  } catch (e: any) {
    console.error("[admin/providers]", e?.message || e);
    res.status(500).json({ error: "Could not load provider dues." });
  }
});

router.post("/providers/:id", async (req: AuthRequest, res) => {
  try {
    const p = PROVIDERS.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "Unknown provider." });
    const amountInr = Number(req.body?.amountInr);
    const note = str(req.body?.note).slice(0, 200);
    if (!Number.isFinite(amountInr) || amountInr < 0 || amountInr > 10_000_000) return res.status(400).json({ error: "Enter an amount in rupees." });
    const now = new Date();
    const entry = { amountInr: money(amountInr), note, kind: p.kind, enteredAt: now.toISOString(), enteredDay: istDay(now), enteredBy: req.user!.email || null };
    await db.collection("providerBalances").doc(p.id).set(entry);
    await adminAudit(req, "provider_balance_entered", { provider: p.id, amountInr: entry.amountInr, note });
    res.json({ success: true });
  } catch (e: any) {
    console.error("[admin/providers:set]", e?.message || e);
    res.status(500).json({ error: "Could not save." });
  }
});

// ───────────────────────── revenue ─────────────────────────

async function buildRevenue(days: number) {
  const fromIso = istDayStartIso(sinceDay(days));
  const [ledgerSnap, refundSnap, autopay, mismatches, intentMismatch] = await Promise.all([
    db.collection("creditLedger").where("createdAt", ">=", fromIso).get(),
    db.collection("creditRefunds").where("at", ">=", fromIso).get(),
    allDocs("autopaySubscriptions"),
    db.collection("autopayMismatches").get(),
    db.collection("paymentIntents").where("status", "==", "mismatch").get(),
  ]);
  const ledger = ledgerSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
  const refunds = refundSnap.docs.map((d: any) => d.data() || {});
  const type = (l: any) => (l.source === "autopay" ? "Renewal ₹350" : l.kind === "plan" ? "Activation ₹600" : "Credit recharge");
  const totals = { grossInr: 0, refundsInr: 0, netInr: 0, payments: ledger.length, activations: 0, renewals: 0, recharges: 0, creditsSold: 0 };
  for (const l of ledger) {
    totals.grossInr += numOr0(l.amountPaise) / 100;
    totals.creditsSold += numOr0(l.creditsGranted);
    const t = type(l);
    if (t.startsWith("Renewal")) totals.renewals++; else if (t.startsWith("Activation")) totals.activations++; else totals.recharges++;
  }
  totals.refundsInr = refunds.reduce((s, r) => s + numOr0(r.amountPaise) / 100, 0);
  totals.netInr = money(totals.grossInr - totals.refundsInr);
  totals.grossInr = money(totals.grossInr); totals.refundsInr = money(totals.refundsInr);

  const statusCounts: Record<string, number> = {};
  for (const a of autopay) statusCounts[String(a.status || "unknown")] = (statusCounts[String(a.status || "unknown")] || 0) + 1;
  const autopayIssues = autopay.filter(a => ["pending", "halted"].includes(String(a.status)) || (a.lastFailureAt && a.lastFailureAt >= fromIso))
    .map(a => ({ uid: a.id, status: a.status, lastFailureAt: a.lastFailureAt || null, nextChargeAt: a.nextChargeAt || null }));
  const problems = [
    ...mismatches.docs.map((d: any) => ({ source: "AutoPay", id: d.id, ...(d.data() || {}) })),
    ...intentMismatch.docs.map((d: any) => ({ source: "Checkout", id: d.id, uid: d.data()?.uid, reason: d.data()?.mismatchReason, at: d.data()?.updatedAt })),
  ].map(p => ({ source: p.source, id: p.id, uid: p.uid || null, reason: p.reason || "", at: p.at || null }));

  const payments = ledger.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 300).map(l => ({
    paymentId: l.paymentId || l.id, uid: l.uid || null, type: type(l), amountInr: numOr0(l.amountPaise) / 100,
    credits: numOr0(l.creditsGranted), refundedInr: numOr0(l.refundedPaise) / 100, at: l.createdAt || null,
  }));
  return { totals, payments, autopay: { statusCounts, issues: autopayIssues }, problems };
}

router.get("/revenue", async (req, res) => {
  try {
    const days = rangeDays(req.query);
    const r = await buildRevenue(days);
    const profiles = await allDocs("users");
    const who = new Map(profiles.map(p => [p.id, { name: str(p.name), email: str(p.email) }]));
    const named = (x: any) => ({ ...x, name: who.get(x.uid)?.name || "", email: who.get(x.uid)?.email || "" });
    res.json({ days, ...r, payments: r.payments.map(named), autopay: { ...r.autopay, issues: r.autopay.issues.map(named) }, problems: r.problems.map(named) });
  } catch (e: any) {
    console.error("[admin/revenue]", e?.message || e);
    res.status(500).json({ error: "Could not load revenue." });
  }
});

// ───────────────────────── overview ─────────────────────────

router.get("/overview", async (req, res) => {
  try {
    const days = rangeDays(req.query);
    const from = sinceDay(days);
    const fromIso = istDayStartIso(from);
    const [{ rows: users }, usage, revenue, pendingHod, casesTotal, casesInRange, creditUseSnap, directory] = await Promise.all([
      buildUsers(), loadUsage(from), buildRevenue(days),
      db.collection("hodClaimRequests").where("status", "==", "pending").count().get(),
      db.collection("cases").count().get(),
      db.collection("cases").where("createdAt", ">=", fromIso).count().get(),
      db.collection("creditUsage").where("at", ">=", fromIso).get(),
      allDocs("hospital_directory"),
    ]);

    const teamHospitals = new Set(users.filter(u => u.workspace === "Hospital team" && u.hospitalId).map(u => u.hospitalId));
    const creditsByUid: Record<string, number> = {};
    for (const d of creditUseSnap.docs) {
      const c = d.data() || {};
      creditsByUid[c.uid] = (creditsByUid[c.uid] || 0) + numOr0(c.cost);
    }
    const creditsUsed = Object.values(creditsByUid).reduce((s, n) => s + n, 0);
    const costOfChargedUse = Object.keys(creditsByUid).reduce((s, uid) => s + numOr0(usage.byUser[usageKey(uid)]?.costInr), 0);

    const plans: Record<string, number> = {};
    for (const u of users) plans[u.plan] = (plans[u.plan] || 0) + 1;

    res.json({
      asOf: new Date().toISOString(), days, from,
      users: {
        total: users.length,
        newInRange: users.filter(u => u.createdAt && u.createdAt >= fromIso).length,
        activeInRange: users.filter(u => u.lastActiveAt && u.lastActiveAt >= fromIso).length,
        plans,
        locationMissing: users.filter(u => !u.state).length,
      },
      hospitals: {
        withTeams: teamHospitals.size,
        inDirectory: directory.length,
        verifiedInDirectory: directory.filter(d => d.status === "verified").length,
      },
      cases: { total: casesTotal.data().count, inRange: casesInRange.data().count },
      revenue: revenue.totals,
      ai: {
        costInr: money(usage.totals.costInr), calls: usage.totals.calls, failed: usage.totals.failed, daysWithData: usage.daysWithData,
        byProvider: Object.entries(usage.byProvider).map(([provider, v]) => ({ provider, costInr: money(v.costInr), calls: v.calls })).sort((a, b) => b.costInr - a.costInr),
      },
      profitAfterAi: money(revenue.totals.netInr - usage.totals.costInr),
      costPerCredit: {
        creditsUsed, costInr: money(costOfChargedUse),
        perCredit: creditsUsed > 0 ? money(costOfChargedUse / creditsUsed) : null,
        priceInr: RUPEES_PER_CREDIT, targetInr: TARGET_COST_PER_CREDIT_RUPEES,
      },
      alerts: {
        hodPending: pendingHod.data().count,
        autopayIssues: revenue.autopay.issues.length,
        paymentProblems: revenue.problems.length,
      },
      recentSignups: users.slice(0, 6).map(u => ({ uid: u.uid, name: u.name, email: u.email, hospital: u.hospital, place: u.place, district: u.district, state: u.state, plan: u.plan, createdAt: u.createdAt })),
    });
  } catch (e: any) {
    console.error("[admin/overview]", e?.message || e);
    res.status(500).json({ error: "Could not load the overview." });
  }
});

// ───────────────────────── audit ─────────────────────────

router.get("/audit", async (_req, res) => {
  try {
    const [admin, team, roles] = await Promise.all([
      db.collection("adminAuditLog").orderBy("at", "desc").limit(150).get(),
      db.collection("teamAuditLog").orderBy("timestamp", "desc").limit(150).get(),
      db.collection("roleChangeLog").limit(300).get(),
    ]);
    const pick = (x: any, ...keys: string[]) => keys.map(k => x?.[k]).find(v => typeof v === "string" && v) || "";
    const SKIP = new Set(["at", "timestamp", "createdAt", "changedAt", "action", "actorUid", "actorEmail", "actorRole"]);
    const detail = (x: any) => Object.entries(x).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== "" && typeof v !== "object")
      .slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(" · ");
    const rows = [
      ...admin.docs.map((d: any) => ({ source: "Admin", ...(d.data() || {}) })),
      ...team.docs.map((d: any) => ({ source: "Team", ...(d.data() || {}) })),
      ...roles.docs.map((d: any) => ({ source: "Role change", ...(d.data() || {}) })),
    ].map((x: any) => ({
      source: x.source,
      at: pick(x, "at", "timestamp", "changedAt", "createdAt") || null,
      action: pick(x, "action", "type", "event") || (x.source === "Role change" ? "role_change" : ""),
      actor: pick(x, "actorEmail", "changedByEmail", "changedBy", "actorUid"),
      detail: detail(x),
    })).sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 300);
    res.json({ rows });
  } catch (e: any) {
    console.error("[admin/audit]", e?.message || e);
    res.status(500).json({ error: "Could not load the audit log." });
  }
});

router.get("/me", (req: AuthRequest, res) => {
  res.json({ ok: true, email: req.user?.email || null });
});

export default router;