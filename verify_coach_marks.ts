// MARKER: ERMATE-COACH-MARKS-V1
import { readFileSync } from "fs";
import { TOURS, TAB_TO_TOUR, tourForTab, isTourSeen, markTourSeen, markAllToursSeen, resetTours, KV } from "./src/lib/coachTours";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const mem = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) }; };

// data shape
for (const [id, steps] of Object.entries(TOURS)) {
  t(`${id}: has steps`, steps.length > 0);
  t(`${id}: unique step ids`, new Set(steps.map(s => s.id)).size === steps.length);
  t(`${id}: every step has title and body`, steps.every(s => s.title.length > 2 && s.body.length > 10));
}
t("home covers shift, new patient, voice scribe", ["shift", "new-patient", "voice-scribe"].every(id => TOURS.home.some(s => s.id === id)));
t("home covers nav: cases, handover, learn, more", ["nav-cases", "nav-handover", "nav-learn", "nav-more"].every(id => TOURS.home.some(s => s.id === id)));
t("tabs map to existing tours", Object.values(TAB_TO_TOUR).every(v => v in TOURS));
t("tourForTab", tourForTab("dashboard") === "home" && tourForTab("tools") === null);

// seen-state
const s = mem();
t("unseen initially", !isTourSeen("A@x.com", "home", s));
markTourSeen("A@x.com", "home", s);
t("seen after mark, email case-insensitive", isTourSeen("a@X.com", "home", s));
t("other page still unseen", !isTourSeen("a@x.com", "cases", s));
t("other doctor unaffected", !isTourSeen("b@x.com", "home", s));
markAllToursSeen("a@x.com", s);
t("turn off all marks every page", (Object.keys(TOURS) as any[]).every(k => isTourSeen("a@x.com", k, s)));
resetTours("a@x.com", s);
t("replay resets every page", (Object.keys(TOURS) as any[]).every(k => !isTourSeen("a@x.com", k, s)));
markTourSeen("b@x.com", "home", s); resetTours("a@x.com", s);
t("reset leaves other doctors alone", isTourSeen("b@x.com", "home", s));
const bad: KV = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
let threw = false; try { markTourSeen("a@x.com", "home", bad); isTourSeen("a@x.com", "home", bad); resetTours("a@x.com", bad); } catch { threw = true; }
t("blocked storage never throws", !threw);
t("blocked storage reads as unseen", !isTourSeen("a@x.com", "home", bad));

// wiring (source checks)
const app = readFileSync("src/App.tsx", "utf8");
const dash = readFileSync("src/components/DashboardView.tsx", "utf8");
const more = readFileSync("src/components/MoreView.tsx", "utf8");
const coach = readFileSync("src/components/CoachMarks.tsx", "utf8");
t("App mounts CoachMarks once", (app.match(/<CoachMarks/g) || []).length === 1);
t("App blocks tips during case/form/dialogs", /<CoachMarks[\s\S]*blocked=\{Boolean\(selectedCaseId[\s\S]*activeFormMode[\s\S]*showPaywall/.test(app));
t("both navs carry data-coach", (app.match(/data-coach=\{`nav-\$\{tab\.id\}`\}/g) || []).length === 2);
for (const k of ["shift", "new-patient", "voice-scribe", "quick-tools", "stats"]) t(`Home has data-coach="${k}"`, dash.includes(`data-coach="${k}"`));
t("old auto-open tour removed from Home", !dash.includes("<AppTour") && !dash.includes("shouldAutoOpenTour"));
t("More replay resets tips and opens Home", /resetTours\(profile\?\.email\); onNavigateToTab\("dashboard"\)/.test(more) && more.includes('data-testid="take-app-tour"'));
t("every target selector used by tours exists in source", (() => {
  const files = ["src/components/CasesListView.tsx", "src/components/HandoverView.tsx", "src/components/LearnView.tsx", "src/components/MoreView.tsx"].map(f => readFileSync(f, "utf8")).join("\n");
  return ["cases-list-container", "handover-section", "learn-side-nav", "learn-nav-${item.id}", 'id: "erguide"', "learn-nav-classroom", "more-side-nav", "more-landing-", "take-app-tour"].every(x => files.includes(x));
})());
t("Skip, Back, Next, Got it, Escape present", ["Skip", "Back", "Next", "Got it", '"Escape"'].every(x => coach.includes(x)));
t("dialog is labelled and modal", coach.includes('role="dialog"') && coach.includes('aria-modal="true"'));
t("tips are hidden in print", coach.includes("no-print"));
t("no Firestore or clinical data touched", !/firestore|collection\(|setDoc|updateDoc|addDoc/i.test(coach + readFileSync("src/lib/coachTours.ts", "utf8")));
t("respects reduced motion", coach.includes("motion-reduce"));
console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);