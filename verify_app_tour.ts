// MARKER: ERMATE-APP-TOUR-V1
// The step-by-step modal (AppTour.tsx) is kept as a component; Home now uses CoachMarks (see verify_coach_marks.ts).
import { readFileSync } from "fs";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };
const tour = readFileSync("src/components/AppTour.tsx", "utf8");
const dash = readFileSync("src/components/DashboardView.tsx", "utf8");
const more = readFileSync("src/components/MoreView.tsx", "utf8");

const stepCount = (tour.match(/^\s{4}title: "/gm) || []).length;
t("tour has 11 steps", stepCount === 11);
t("every step has a body", (tour.match(/^\s{4}body: "/gm) || []).length === stepCount);
t("tour is a labelled modal dialog", tour.includes('role="dialog"') && tour.includes('aria-modal="true"'));
t("skip available on first step and via X", tour.includes("Skip tour") && tour.includes('aria-label="Skip tour"'));
t("Escape closes the tour", tour.includes('"Escape"'));
t("finish marks tour as seen", /const finish[\s\S]*markTourSeen\(email\)/.test(tour));
t("auto-open only for accounts created within 14 days", tour.includes("NEW_USER_WINDOW_DAYS = 14") && tour.includes("metadata?.creationTime"));
t("auto-open does nothing when account age unknown", /if \(!created\) return false/.test(tour));
t("seen flag is per user email", tour.includes('SEEN_PREFIX + (email || "anon").toLowerCase()'));
t("storage access is guarded", (tour.match(/try \{/g) || []).length >= 3);
t("replay request consumed once", /consumeTourReplay[\s\S]*safeRemove\(TOUR_REPLAY_KEY\)/.test(tour));
t("shortcut steps close the tour before navigating", /finish\(\);\s*onNavigateToTab\(tab\)/.test(tour));
t("tour does not touch clinical storage/Firestore", !/firestore|collection\(|setDoc|updateDoc|addDoc/i.test(tour));
t("purple + emerald theme kept", tour.includes("from-purple-600 to-emerald-600"));
t("does not print", tour.includes("no-print"));
t("Home no longer auto-opens the modal tour", !dash.includes("<AppTour"));
t("More replay button exists", more.includes('data-testid="take-app-tour"'));
t("tour tab shortcuts exist as real tabs", ["handover","logbook","tools","learn","more"].every(x => tour.includes(`tab: "${x}"`)));
console.log(`\nApp tour: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);