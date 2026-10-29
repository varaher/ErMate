/**
 * Page walkthroughs ("coach marks"): which steps each page shows, and the one-time-seen flags.
 * Pure data and storage helpers. No Firebase, no clinical data.
 *
 * MANDATORY RULE: every new user-facing feature ships with a tip here.
 *  1. Add a step to the right tour with `v` = the next version number for that tour and `feature` = a short name.
 *  2. Add the same name to REQUIRED_FEATURES in verify_feature_tips.ts.
 *  3. Doctors who already finished the tour see ONLY the steps newer than what they have seen. New doctors see all.
 * verify_feature_tips.ts fails the update if a feature has no tip, or a tip points at something that is not in the app.
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
  /** Tour version this step was added in. Omitted = 1. Returning doctors only see steps newer than what they saw. */
  v?: number;
  /** Short name of the feature this step announces (checked by verify_feature_tips.ts). */
  feature?: string;
}

export type TourId = "home" | "cases" | "handover" | "learn" | "more" | "scribe" | "protocols";

/** App tab id -> tour shown the first time that tab is opened. */
export const TAB_TO_TOUR: Record<string, TourId> = {
  dashboard: "home",
  cases: "cases",
  handover: "handover",
  learn: "learn",
  more: "more",
  scribe: "scribe",
};

export const TOURS: Record<TourId, CoachStep[]> = {
  home: [
    { id: "shift", target: { sel: '[data-coach="shift"]' }, title: "Start your shift", body: "Check in when your duty begins. Cases you create are tied to your shift, so handover stays accurate. Off shift, records are locked." },
    { id: "new-patient", target: { sel: '[data-coach="new-patient"]' }, title: "New Patient", body: "Tap here to start a case. Type it in manually, or let AI triage ask the questions. ErMate then opens a case sheet for you to work in." },
    { id: "voice-scribe", target: { sel: '[data-coach="voice-scribe"]' }, title: "Voice Scribe", body: "Prefer talking? Dictate a short summary in your own language. ErMate listens and fills the case sheet for you to review before you save." },
    { id: "quick-tools", target: { sel: '[data-coach="quick-tools"]' }, title: "Quick tools", body: "ER Guide for protocols and drugs, pediatric dosing by weight, and SBAR shift handover. All one tap away at the bedside." },
    { id: "stats", target: { sel: '[data-coach="stats"]' }, title: "Your ED at a glance", body: "Active, waiting and today's patients update as you work." },
    { id: "plan-banner", v: 2, feature: "plan-banner", target: { sel: '[data-coach="plan-banner"]' }, title: "Your plan", body: "This strip shows your trial days left or plan status. Tap View plans any time to see options or activate." },
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
    { id: "critical-badge", v: 2, feature: "critical-badge", title: "Red CRITICAL badge", body: "When saved vitals cross a danger limit (for example low BP, very high heart rate, low SpO2 or GCS 8 or less), a red badge appears on that patient on Home, Cases, Handover and the case sheet. It is a prompt to look at the patient, not a diagnosis." },
  ],
  handover: [
    { id: "intro", title: "Shift handover", body: "Build a clear handover for the next doctor. Review everything before you hand over." },
    { id: "choice-cards", v: 2, feature: "handover-choice", title: "Two ways to start", body: "Pick \"Patients in ErMate\" to tick patients you already added, or \"Paste from hospital EMR\" to paste an existing handover and let ErMate organise it." },
    { id: "compile", target: { sel: "#handover-section h3", text: "Compile Sheet" }, title: "Compile the sheet", body: "Pulls your active patients into one handover sheet. Edit any cell, then print or share." },
  ],
  learn: [
    { id: "sections", target: { sel: '[data-testid="learn-side-nav"]' }, title: "Learn sections", body: "ER Guide, EM Reference, Simulations, Trivia and your Clinical Memory Log. Tap any to switch." },
    { id: "erguide", target: { sel: '[data-testid="learn-nav-erguide"]' }, title: "ER Guide", body: "Presentation-based pathways, drugs, RSI and sedation. Open it when you meet a patient and want the next step." },
    { id: "classroom", target: { sel: '[data-testid="learn-nav-classroom"]' }, title: "Classroom", body: "Residents can open the Google Classroom portal from here." },
  ],
  scribe: [
    { id: "ask-critical", v: 2, feature: "mate-critical-query", title: "Ask who is critical", body: "Say or type \"who is critical?\" and ErMate lists the patients whose saved vitals are in the danger range. When you apply new vitals, a red message tells you if a patient has just become critical." },
    { id: "mate-voice", v: 2, feature: "mate-voice", target: { sel: '[data-coach="mate-voice"]' }, title: "Hear replies spoken", body: "This speaker button makes ErMate read its replies aloud. It starts off. Tap it to turn on, tap again to turn off. Your choice is remembered on this device." },
  ],
  protocols: [
    { id: "chips", v: 2, feature: "protocol-chips", target: { sel: '[data-testid="protocol-chips"]' }, title: "Jump to a section", body: "Tap a chip to go straight to that part of the protocol, such as investigations or disposition." },
    { id: "investigations", v: 2, feature: "protocol-investigations", target: { sel: '[data-testid="protocol-investigations-box"]' }, title: "Investigations at a glance", body: "The tests this protocol suggests are collected in one box so you can order them quickly." },
    { id: "flag", v: 2, feature: "protocol-flag", target: { sel: '[data-testid="protocol-flag-step"]' }, title: "Flag a concern", body: "Think a step is wrong, outdated or unsafe? Tap Flag and tell us. Reviewers see it. Protocols marked Draft are still under review." },
  ],
  more: [
    { id: "menu", target: { sel: '[data-testid="more-side-nav"], [data-testid^="more-landing-"]' }, title: "Everything else", body: "Plan and credits, profile, notifications and Clinical Tools such as Log Book and Analytics live here." },
    { id: "replay", target: { sel: '[data-testid="take-app-tour"]' }, title: "Replay the walkthrough", body: "Tap here to see all the page tips again." },
  ],
};

// ---------- seen-state (device storage, keyed by email) ----------
// Stored value = highest step version the doctor has seen on that page ("1" from the first release).
// Missing = never seen. A separate "off" flag records "Turn off all tips".

const PREFIX = "ermate_coach_v1_";
const norm = (email: string | null | undefined) => (email || "anon").trim().toLowerCase();
const keyFor = (email: string | null | undefined, tour: TourId) => `${PREFIX}${norm(email)}_${tour}`;
const offKey = (email: string | null | undefined) => `${PREFIX}${norm(email)}__off`;

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function defaultStore(): KV | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

const stepVersion = (s: CoachStep) => s.v ?? 1;
export const tourVersion = (tour: TourId): number => TOURS[tour].reduce((m, s) => Math.max(m, stepVersion(s)), 1);

function seenVersion(email: string | null | undefined, tour: TourId, store: KV | null): number {
  try {
    const raw = store?.getItem(keyFor(email, tour));
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch { return 0; }
}

function tipsOff(email: string | null | undefined, store: KV | null): boolean {
  try { return store?.getItem(offKey(email)) === "1"; } catch { return false; }
}

/** Steps this doctor has not seen yet: everything for a new doctor, only newer steps for a returning one. */
export function unseenSteps(email: string | null | undefined, tour: TourId, store: KV | null = defaultStore()): CoachStep[] {
  if (tipsOff(email, store)) return [];
  const seen = seenVersion(email, tour, store);
  return TOURS[tour].filter((s) => stepVersion(s) > seen);
}

export function isTourSeen(email: string | null | undefined, tour: TourId, store: KV | null = defaultStore()): boolean {
  return unseenSteps(email, tour, store).length === 0;
}

export function markTourSeen(email: string | null | undefined, tour: TourId, store: KV | null = defaultStore()): void {
  try { store?.setItem(keyFor(email, tour), String(tourVersion(tour))); } catch { /* storage blocked: the tip may show again */ }
}

export function markAllToursSeen(email: string | null | undefined, store: KV | null = defaultStore()): void {
  (Object.keys(TOURS) as TourId[]).forEach((t) => markTourSeen(email, t, store));
  try { store?.setItem(offKey(email), "1"); } catch { /* ignore */ }
}

/** Replay: forget every page tour for this doctor so each shows again, new tips included. */
export function resetTours(email: string | null | undefined, store: KV | null = defaultStore()): void {
  try {
    (Object.keys(TOURS) as TourId[]).forEach((t) => store?.removeItem(keyFor(email, t)));
    store?.removeItem(offKey(email));
  } catch { /* ignore */ }
}

export function tourForTab(tab: string): TourId | null {
  return TAB_TO_TOUR[tab] ?? null;
}

/** A page that is not a tab (for example the Protocols reader) asks for its tour. CoachMarks listens. */
export const COACH_REQUEST_EVENT = "ermate:coach-request";
export function requestTour(tour: TourId): void {
  try { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COACH_REQUEST_EVENT, { detail: tour })); } catch { /* ignore */ }
}