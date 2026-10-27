// MARKER: ERMATE-PWA-UPDATE-V1
import { readFileSync } from "fs";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };
const b = readFileSync("src/components/PWABadge.tsx", "utf8");
const v = readFileSync("vite.config.ts", "utf8");
const h = readFileSync("src/utils/hardRefresh.ts", "utf8");

t("vite: registerType is prompt (new SW waits, never swaps mid-work)", /registerType:\s*'prompt'/.test(v));
t("vite: skipWaiting false", /skipWaiting:\s*false/.test(v));
t("vite: old caches cleaned", /cleanupOutdatedCaches:\s*true/.test(v));
t("badge: registration captured", b.includes("onRegisteredSW"));
t("badge: checks on foreground", b.includes('visibilitychange') && b.includes("checkForUpdate"));
t("badge: checks when network returns", b.includes("'online'"));
t("badge: periodic check", b.includes("setInterval") && b.includes("UPDATE_CHECK_MS"));
t("badge: throttled checks", b.includes("MIN_GAP_BETWEEN_CHECKS_MS"));
t("badge: skips check while offline", b.includes("navigator.onLine === false"));
t("badge: auto-apply uses the clinical safety gate", b.includes("getBlockingReasonsDeep"));
t("badge: auto-apply only when backgrounded or just opened", b.includes("document.hidden") && b.includes("JUST_OPENED_WINDOW_MS"));
t("badge: unsafe -> retries, never forces", b.includes("AUTO_APPLY_RETRY_MS"));
t("badge: manual update also gated", /handleManualUpdate[\s\S]*getBlockingReasonsDeep/.test(b));
t("badge: manual blocked shows reason", b.includes("blockedNote"));
t("badge: cleanup of listeners/timers", b.includes("removeEventListener") && b.includes("clearInterval"));
t("safety gate covers voice recording + critical ops + cloud sync", h.includes("isGlobalVoiceRecordingActive") && h.includes("getActiveCriticalOps") && h.includes("waitForPendingWrites"));
t("PWABadge still mounted in App", readFileSync("src/App.tsx", "utf8").includes("<PWABadge />"));
t("no extra storage clearing", !/localStorage\.clear|sessionStorage\.clear|indexedDB\.deleteDatabase|clearPersistence/.test(b));
console.log(`\nPWA update: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);