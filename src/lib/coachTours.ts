/**
 * Page walkthroughs ("coach marks"): which steps each page shows, and the one-time-seen flags.
 * Pure data and storage helpers. No Firebase, no clinical data.
 */

export interface CoachTarget {
  /** CSS selector (comma list allowed). The first VISIBLE match is lit. */
  sel: string;
  /** Optional: only match elements whose text contains this. */
  text?: string;
}

export interface CoachStep {
  id: string;
  /** No target = a centred card (page introduction). A missing target on screen = the step is skipped. */
  target?: CoachTarget;
  title: string;
  body: string;
}

export type TourId = "home" | "cases" | "handover" | "learn" | "more";

/** App tab id -> tour shown the first time that tab is opened. */
export const TAB_TO_TOUR: Record<string, TourId> = {
  dashboard: "home",
  cases: "cases",
  handover: "handover",
  learn: "learn",
  more: "more",
};

export const TOURS: Record<TourId, CoachStep[]> = {
  home: [
    { id: "shift", target: { sel: '[data-coach="shift"]' }, title: "Start your shift", body: "Check in when your duty begins. Cases you create are tied to your shift, so handover stays accurate. Off shift, records are locked." },
    { id: "new-patient", target: { sel: '[data-coach="new-patient"]' }, title: "New Patient", body: "Tap here to start a case. Type it in manually, or let AI triage ask the questions. ErMate then opens a case sheet for you to work in." },
    { id: "voice-scribe", target: { sel: '[data-coach="voice-scribe"]' }, title: "Voice Scribe", body: "Prefer talking? Dictate a short summary in your own language. ErMate listens and fills the case sheet for you to review before you save." },
    { id: "quick-tools", target: { sel: '[data-coach="quick-tools"]' }, title: "Quick tools", body: "ER Guide for protocols and drugs, pediatric dosing by weight, and SBAR shift handover. All one tap away at the bedside." },
    { id: "stats", target: { sel: '[data-coach="stats"]' }, title: "Your ED at a glance", body: "Active, waiting and today's patients update as you work." },
    { id: "nav-cases", target: { sel: '[data-coach="nav-cases"]' }, title: "Cases", body: "Every patient you have seen. Open a case to edit it, print the case sheet, Copy to EMR, or write the discharge summary." },
    { id: "nav-scribe", target: { sel: '[data-coach="nav-scribe"]' }, title: "Ask ErMate", body: "Talk through a case or ask a clinical question. Good for a second opinion while you work." },
    { id: "nav-handover", target: { sel: '[data-coach="nav-handover"]' }, title: "Handover", body: "Prepare a handover for the next team from your active cases, so nothing is missed at shift change." },
    { id: "nav-learn", target: { sel: '[data-coach="nav-learn"]' }, title: "Learn", body: "ER Guide, references, simulations and trivia for the time between patients." },
    { id: "nav-more", target: { sel: '[data-coach="nav-more"]' }, title: "More", body: "Plan and credits, profile, settings, and your Log Book. You can replay this walkthrough from here any time." },
  ],
  cases: [
    { id: "registry", target: { sel: "#cases-list-container h1" }, title: "Your case registry", body: "All saved patients are listed here. Search, open a case, print it, or write the discharge summary." },
    { id: "triage-case", target: { sel: "#cases-list-container button", text: "Standard Triage Case" }, title: "Standard case", body: "Starts a full case with AI triage and intake." },
    { id: "quick-case", target: { sel: "#cases-list-container button", text: "Quick Case" }, title: "Quick Case", body: "A short form for a fast entry when the department is busy. Complete the sheet later." },
    { id: "search", target: { sel: "#cases-list-container input" }, title: "Find a patient", body: "Search by name, complaint or ER number, and filter the list." },
  ],
  handover: [
    { id: "intro", title: "Shift handover", body: "Build a clear handover for the next doctor from your cases. You can also paste an older handover and let ErMate organise it. Review everything before you hand over." },
    { id: "compile", target: { sel: "#handover-section h3", text: "Compile Sheet" }, title: "Compile the sheet", body: "Pulls your active patients into one handover sheet. Edit any cell, then print or share." },
  ],
  learn: [
    { id: "sections", target: { sel: '[data-testid="learn-side-nav"]' }, title: "Learn sections", body: "ER Guide, EM Reference, Simulations, Trivia and your Clinical Memory Log. Tap any to switch." },
    { id: "erguide", target: { sel: '[data-testid="learn-nav-erguide"]' }, title: "ER Guide", body: "Presentation-based pathways, drugs, RSI and sedation. Open it when you meet a patient and want the next step." },
    { id: "classroom", target: { sel: '[data-testid="learn-nav-classroom"]' }, title: "Classroom", body: "Residents can open the Google Classroom portal from here." },
  ],
  more: [
    { id: "menu", target: { sel: '[data-testid="more-side-nav"], [data-testid^="more-landing-"]' }, title: "Everything else", body: "Plan and credits, profile, notifications and Clinical Tools such as Log Book and Analytics live here." },
    { id: "replay", target: { sel: '[data-testid="take-app-tour"]' }, title: "Replay the walkthrough", body: "Tap here to see all the page tips again." },
  ],
};

// ---------- seen-state (device storage, keyed by email) ----------

const PREFIX = "ermate_coach_v1_";
const keyFor = (email: string | null | undefined, tour: TourId) => `${PREFIX}${(email || "anon").trim().toLowerCase()}_${tour}`;

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function defaultStore(): KV | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function isTourSeen(email: string | null | undefined, tour: TourId, store: KV | null = defaultStore()): boolean {
  try { return store?.getItem(keyFor(email, tour)) === "1"; } catch { return false; }
}

export function markTourSeen(email: string | null | undefined, tour: TourId, store: KV | null = defaultStore()): void {
  try { store?.setItem(keyFor(email, tour), "1"); } catch { /* storage blocked: the tip may show again */ }
}

export function markAllToursSeen(email: string | null | undefined, store: KV | null = defaultStore()): void {
  (Object.keys(TOURS) as TourId[]).forEach((t) => markTourSeen(email, t, store));
}

/** Replay: forget every page tour for this doctor so each shows again on its next visit. */
export function resetTours(email: string | null | undefined, store: KV | null = defaultStore()): void {
  try { (Object.keys(TOURS) as TourId[]).forEach((t) => store?.removeItem(keyFor(email, t))); } catch { /* ignore */ }
}

export function tourForTab(tab: string): TourId | null {
  return TAB_TO_TOUR[tab] ?? null;
}