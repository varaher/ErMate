import { readFileSync } from "fs";
import { creditLevel, planStatus, formatDay, LOW_CREDIT_THRESHOLD, CREDIT_USE_LABELS } from "./src/lib/creditDisplay";
import { CREDIT_COSTS } from "./src/lib/pricing";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL", n)); };

// A. levels
t("unknown", creditLevel(undefined) === "unknown" && creditLevel("5") === "unknown" && creditLevel(NaN) === "unknown");
t("empty at 0", creditLevel(0) === "empty" && creditLevel(-3) === "empty");
t("low 1..19", creditLevel(1) === "low" && creditLevel(LOW_CREDIT_THRESHOLD - 1) === "low");
t("ok at 20+", creditLevel(LOW_CREDIT_THRESHOLD) === "ok" && creditLevel(300) === "ok");

// B. plan status
const now = Date.parse("2026-10-20T00:00:00Z");
t("free tier", planStatus("Free Standard", undefined, now).label === "Free" && !planStatus("Free Standard", undefined, now).active);
t("pro active with date", planStatus("Individual Pro", "2026-11-19T10:00:00.000Z", now).active && /Nov/.test(planStatus("Individual Pro", "2026-11-19T10:00:00.000Z", now).validTill));
t("pro expired", planStatus("Individual Pro", "2026-10-01T00:00:00Z", now).label === "Individual Pro (expired)" && !planStatus("Individual Pro", "2026-10-01T00:00:00Z", now).active);
t("pro without expiry still shown active", planStatus("Individual Pro", undefined, now).active);
t("bad date handled", formatDay("nope") === "" && formatDay(undefined) === "");

// C. cost list covers every metered action exactly once
const listed = CREDIT_USE_LABELS.flatMap(g => g.actions).sort();
const all = Object.keys(CREDIT_COSTS).sort();
t("what-uses-credits list covers every action once", JSON.stringify(listed) === JSON.stringify(all));

// D. wiring
const card = readFileSync("src/components/CreditsPlanCard.tsx", "utf8");
const more = readFileSync("src/components/MoreView.tsx", "utf8");
const psv = readFileSync("src/components/ProfileSettingsView.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const hdr = readFileSync("src/components/GlobalHeader.tsx", "utf8");
const meter = readFileSync("server/services/creditMeter.ts", "utf8");
t("More screen shows the credits card", /<CreditsPlanCard/.test(more));
t("More screen refreshes app profile", /onProfileRefreshed=\{onProfileRefreshed\}/.test(more));
t("both More/Profile tabs pass refresh handler", (app.match(/onProfileRefreshed=\{\(f\) =>/g) || []).length === 2);
t("profile settings reuses the shared card", /<CreditsPlanCard/.test(psv) && !/startRealCheckout|loadRazorpayScript/.test(psv));
t("only one checkout implementation", (card.match(/\/api\/payments\/create-order/g) || []).length === 1 && !/api\/payments\/create-order/.test(psv));
t("covered accounts have personal checkout disabled", /exempt/.test(card) && card.indexOf("disabled={disabled}") > 0);
t("browser callback never grants", /confirm\(payment\)/.test(card) && !/aiCredits\s*[:=]\s*[^;]*\+/.test(card));
t("polls for confirmation after payment", /for \(let i = 0; i < 18; i\+\+\)/.test(card));
t("empty + low notices", /credits-empty-notice/.test(card) && /credits-low-notice/.test(card));
t("states free features stay free", /use no credits/.test(card) && /does not renew automatically/.test(card));
t("header chip present", /header-credit-chip/.test(hdr));
t("header chip opens More", /onNavigateToTab\("more"\)/.test(hdr));
t("App passes coveredByTeam to header", /coveredByTeam=\{isVerifiedTeamUser\}/.test(app));
t("server 402 message names a real screen", /More > Team & Subscription/.test(meter) && !/Profile > Subscription/.test(meter));
t("UserProfile has tierExpiresAt", /tierExpiresAt\?: string/.test(readFileSync("src/types.ts", "utf8")));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
