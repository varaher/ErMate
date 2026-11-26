// MARKER: ERMATE-FREE-PRO-V1 (26 Nov 2026) — ErMate Free / Pro business model regression gate.
import { readFileSync } from "fs";
import { execSync } from "child_process";
import {
  computeAccess, canUseFeature, canOpenGuideTab, FREE_GUIDE_TABS, PRO_FEATURES, GRACE_DAYS, trialMilestone, trialPopupText, LOCKED_BODY,
} from "./src/lib/access";
import { publishAccess, getAccess, resetAccessForTests, guardPro, onProUpgradeRequest, hasRecentHandover } from "./src/lib/entitlements";
import { PLAN_PRICING, CORE_AUTOPAY, CREDIT_COSTS, FREE_STARTER_CREDITS } from "./src/lib/pricing";
import { decideAccess, isPlanExpired, downgradeIfExpired } from "./server/services/creditMeter";

let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const read = (p: string) => readFileSync(p, "utf8");
const DAY = 86400000;
const NOW = Date.parse("2027-02-01T10:00:00+05:30");
const expiredTrial = computeAccess({ accountCreatedAt: "2026-01-01T00:00:00Z", email: "doc@x.in", now: NOW });

// 1, 2, 3, 5. Expired trial -> Free, never locked; manual documentation and log book allowed
t("1. expired trial moves to Free", expiredTrial.state === "free" && expiredTrial.isPro === false);
t("1. expired trial can create and save a manual case", expiredTrial.canCreate === true);
const app = read("src/App.tsx");
t("1. new-case guard only depends on canCreate", app.includes("if (access.canCreate) return true;") && app.includes("!isExistingPersistentCase && !access.canCreate"));
t("2. discharge summary is never behind the access check", !/showDischarge[^\n]*access\.(isPro|canCreate)/.test(app) && !read("src/components/DischargeSummariesPanel.tsx").includes("entitlements"));
t("3. log book sync has no plan check", !/access|entitlement|isPro/i.test(read("src/utils/logbookSync.ts")));
t("5. manual routes are not metered (no credit cost for case sheet/save/logbook)", !Object.keys(CREDIT_COSTS).some(k => /case_sheet|save|logbook|manual|print/.test(k)));
t("5. zero credits blocks only AI", decideAccess(0, CREDIT_COSTS.ai_discharge).allow === false && expiredTrial.canCreate);

// 4. Free user can buy and use credits
t("4. credit meter checks balance, not plan", decideAccess(50, 1).allow === true);
const meterSrc = read("server/services/creditMeter.ts");
t("4. meter decision has no Pro requirement", !/decideAccess[\s\S]{0,400}individual pro/i.test(meterSrc));
const payRoutes = read("server/routes/payments.ts");
t("4. recharge order not tied to Pro", !/refill[\s\S]{0,200}subscriptionTier/.test(payRoutes));
t("4. starter credits unchanged", FREE_STARTER_CREDITS === 100);

// 6. Drug dilutions + paediatric dosing free
t("6. paediatric dosing tab free", canOpenGuideTab(expiredTrial, "pediatric"));
t("6. free guide tabs", ["rsi", "vent", "mnemonics", "pediatric", "pocketmirror"].every(x => FREE_GUIDE_TABS.includes(x)));
t("6. Drug dilutions has no plan gate", !/entitlements|guardPro|isPro/.test(read("src/components/DrugDilutionsView.tsx")));
t("6. Pro tabs locked for Free", !canOpenGuideTab(expiredTrial, "protocols") && !canOpenGuideTab(expiredTrial, "ventgfx"));

// 7. Free user tapping a Pro feature sees the upgrade sheet
resetAccessForTests();
t("7. fail-open before App publishes", getAccess().isPro === true);
publishAccess(expiredTrial);
let asked: string | null = null;
const off = onProUpgradeRequest(f => { asked = f; });
t("7. guard blocks and opens the sheet", guardPro("handover") === false && asked === "handover");
off();
t("7. no sheet mounted -> fail open (no dead button)", guardPro("icu") === true);
publishAccess(computeAccess({ accountCreatedAt: "2026-01-01T00:00:00Z", email: "doc@x.in", subscriptionTier: "Individual Pro", tierExpiresAt: "2027-02-20T00:00:00Z", now: NOW }));
t("7. Pro doctor passes every gate", (Object.keys(PRO_FEATURES) as any[]).every(f => canUseFeature(getAccess(), f)));
const sheet = read("src/components/AccessBanner.tsx");
t("7. one upgrade sheet, Continue with Free", sheet.includes("export function ProUpgradeSheet") && sheet.includes("Continue with Free") && sheet.includes("export function ProUpgradeHost"));
t("7. App mounts the sheet and publishes access", app.includes("<ProUpgradeHost") && app.includes("publishAccess(access)"));
for (const [f, needle] of [
  ["src/components/ErGuideView.tsx", "canOpenGuideTab"], ["src/components/HandoverView.tsx", 'feature="handover"'],
  ["src/icu/IcuHomeView.tsx", 'guardPro("icu")'], ["src/components/LearnView.tsx", 'feature="simulations"'],
  ["src/components/AnalyticsView.tsx", 'feature="analytics"'], ["src/components/ProfileSettingsView.tsx", 'guardPro("logbook-export")'],
  ["src/components/TeamStartCard.tsx", 'guardPro("teams-create")'], ["src/components/DashboardView.tsx", 'guardPro("handover")'],
] as const) t(`7. gate wired: ${f}`, read(f).includes(needle));

// 8, 9. Pricing untouched
const starter = PLAN_PRICING.individual_pro_monthly;
t("8. Rs 600 = 300 credits + 30 days", starter.amountPaise === 60000 && starter.credits === 300 && starter.periodDays === 30);
t("9. Rs 350 AutoPay adds no credits", CORE_AUTOPAY.amountPaise === 35000 && CORE_AUTOPAY.credits === 0 && read("server/services/autopay.ts").includes("aiCredits is deliberately NOT written"));
const card = read("src/components/CreditsPlanCard.tsx");
t("8. presented as Pro Starter, not an activation fee", card.includes("ErMate Pro Starter") && !/activation fee/i.test(card) && card.includes("Renewals do not include AI credits"));

// 10. Expiry keeps credits; grace matches between app and server
(async () => {
  const store: Record<string, any> = { "users/u1": { aiCredits: 42, subscriptionTier: "Individual Pro", tierExpiresAt: new Date(NOW - 10 * DAY).toISOString() } };
  const db = { collection: () => ({ doc: (id: string) => ({ id }) }), runTransaction: async (fn: any) => fn({ get: async (r: any) => ({ exists: true, data: () => store["users/" + r.id] }), update: (r: any, u: any) => Object.assign(store["users/" + r.id], u) }) };
  await downgradeIfExpired(db, "u1", new Date(NOW));
  t("10. expiry keeps credit balance", store["users/u1"].aiCredits === 42 && store["users/u1"].subscriptionTier === "Free Standard");
  const exp = NOW - 2 * DAY;
  const inGrace = computeAccess({ accountCreatedAt: "2026-01-01T00:00:00Z", subscriptionTier: "Individual Pro", tierExpiresAt: new Date(exp).toISOString(), now: NOW });
  t("13. grace: app keeps Pro and server does not downgrade (same window)", inGrace.state === "grace" && inGrace.isPro && !isPlanExpired({ subscriptionTier: "Individual Pro", tierExpiresAt: new Date(exp).toISOString() }, NOW));
  const after = NOW + (GRACE_DAYS + 1) * DAY;
  t("13. after grace: both say ended", isPlanExpired({ subscriptionTier: "Individual Pro", tierExpiresAt: new Date(exp).toISOString() }, after)
    && computeAccess({ accountCreatedAt: "2026-01-01T00:00:00Z", subscriptionTier: "Individual Pro", tierExpiresAt: new Date(exp).toISOString(), now: after }).state === "free");

  // 11. Hospital-covered and owner keep Pro
  t("11. hospital-covered member is Pro", computeAccess({ accountCreatedAt: "2020-01-01T00:00:00Z", coveredByTeam: true, now: NOW }).isPro);
  t("11. owner is Pro", computeAccess({ accountCreatedAt: "2020-01-01T00:00:00Z", email: "varahgrp@gmail.com", now: NOW }).isPro);
  t("11. legacy Pro without expiry stays Pro", computeAccess({ accountCreatedAt: "2020-01-01T00:00:00Z", subscriptionTier: "Individual Pro", now: NOW }).isPro);

  // 12. Records stay accessible
  t("12. cases list has no plan gate", !/entitlements|guardPro/.test(read("src/components/CasesListView.tsx")));
  t("12. case sheet/print have no plan gate", !/entitlements|guardPro/.test(read("src/components/CaseSheetPrintView.tsx")));

  // 13. Cross-device: access is a pure function of server-owned profile fields
  t("13. same profile -> same access on any device", JSON.stringify(computeAccess({ accountCreatedAt: "2026-01-01T00:00:00Z", now: NOW })) === JSON.stringify(computeAccess({ accountCreatedAt: "2026-01-01T00:00:00Z", now: NOW })));

  // 14. Patient care never interrupted
  const icu = read("src/icu/IcuHomeView.tsx");
  t("14. admitted ICU patients still open", icu.includes("onClick={() => setOpenAdmissionId(adm.id)}"));
  t("14. handover continuity within 24 h", hasRecentHandover([new Date(NOW - 3 * 3600000).toISOString()], NOW) && !hasRecentHandover([new Date(NOW - 30 * 3600000).toISOString()], NOW) && !hasRecentHandover([undefined, "x"], NOW));
  t("14. existing cases stay editable", app.includes("isExistingPersistentCase"));
  t("14. trial-end text promises free documentation", trialMilestone(expiredTrial) === 0 && trialPopupText(0, 0, "").big === "ErMate Free" && LOCKED_BODY.includes("stay free"));

  // 15 (+8, 9, 10). Existing payment suites still pass: duplicate webhooks, fulfilment, AutoPay, expiry/refunds
  for (const suite of ["verify_payments_individual_plan.ts", "verify_autopay.ts", "verify_expiry_refund_verified.ts", "verify_credits_ui.ts"]) {
    let ok = true; try { execSync(`npx tsx ${suite}`, { stdio: "pipe" }); } catch { ok = false; }
    t(`15. ${suite} passes`, ok);
  }
  t("15. fulfilment is idempotent (duplicate status)", read("server/services/paymentFulfillment.ts").includes('return { status: "duplicate" }'));

  console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);
})();