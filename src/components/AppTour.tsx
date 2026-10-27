import React, { useCallback, useEffect, useState } from "react";
import {
  Sparkles, UserPlus, Mic, ClipboardList, FileText, Users, Award, Wrench, BookOpen, CreditCard, CheckCircle2, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { auth } from "../firebase";

/**
 * AppTour - first-run walkthrough for new users, replayable from More > App > "Take the app tour".
 * Presentation only: it reads/writes one localStorage flag and never touches clinical data.
 */

const SEEN_PREFIX = "ermate_tour_v1_seen_";
export const TOUR_REPLAY_KEY = "ermate_tour_replay";
const NEW_USER_WINDOW_DAYS = 14;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: the tour simply may show again */ }
}
function safeRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** Called from More: ask Home to open the tour the next time it is shown. */
export function requestTourReplay() {
  safeSet(TOUR_REPLAY_KEY, "1");
}

/** True when a replay was requested (consumes the request). */
export function consumeTourReplay(): boolean {
  if (safeGet(TOUR_REPLAY_KEY) !== "1") return false;
  safeRemove(TOUR_REPLAY_KEY);
  return true;
}

export function markTourSeen(email?: string | null) {
  safeSet(SEEN_PREFIX + (email || "anon").toLowerCase(), "1");
}

/** Auto-open only for accounts created in the last 14 days that have not seen the tour. Existing doctors use the replay button. */
export function shouldAutoOpenTour(email?: string | null): boolean {
  if (safeGet(SEEN_PREFIX + (email || "anon").toLowerCase()) === "1") return false;
  const created = auth.currentUser?.metadata?.creationTime;
  if (!created) return false;
  const ts = Date.parse(created);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= NEW_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

interface TourStep {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  /** Optional shortcut that closes the tour and opens that tab. */
  go?: { label: string; tab: string };
}

export const TOUR_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: "Welcome to ErMate",
    body: "Your emergency department companion. Dictate or type a case and get a structured case sheet, a discharge summary and a handover. This one-minute tour shows where everything is.",
  },
  {
    icon: UserPlus,
    title: "Start with New Patient",
    body: "On Home, tap New Patient. AI triage and intake collects the basics, then opens a case sheet for you to work in.",
  },
  {
    icon: Mic,
    title: "Dictate with Voice Scribe",
    body: "Tap Voice Scribe and speak the case the way you would present it, in your own language. ErMate turns it into a structured case sheet. Always review the result before you save it. You stay in charge of the clinical record.",
  },
  {
    icon: ClipboardList,
    title: "One complete case sheet",
    body: "Primary survey, history, vitals, examination, investigations, treatment and disposition all live in one sheet. Use Copy to EMR to paste a clean, line-by-line note into your hospital system.",
  },
  {
    icon: FileText,
    title: "Discharge summaries",
    body: "Generate a discharge summary from the case, then review, edit and copy it. Quick Discharge is there for fast, simple discharges.",
  },
  {
    icon: Users,
    title: "Shift handover",
    body: "Prepare an endorsement for the next doctor from your cases, so nothing is missed at shift change.",
    go: { label: "Open Handover", tab: "handover" },
  },
  {
    icon: Award,
    title: "Your Log Book",
    body: "Keep a personal record of the cases and procedures you have handled.",
    go: { label: "Open Log Book", tab: "logbook" },
  },
  {
    icon: Wrench,
    title: "Tools and ER Guide",
    body: "The Pediatric Drug Calculator, emergency drugs and the ER Guide are one tap away, ready for the bedside.",
    go: { label: "Open Tools", tab: "tools" },
  },
  {
    icon: BookOpen,
    title: "Learn",
    body: "Practise with simulations and look up emergency medicine references between patients.",
    go: { label: "Open Learn", tab: "learn" },
  },
  {
    icon: CreditCard,
    title: "AI credits",
    body: "AI actions such as Voice Scribe and AI discharge use credits. You start with free credits. Check your balance and recharge anytime in More, under Plan & Credits.",
    go: { label: "Open More", tab: "more" },
  },
  {
    icon: CheckCircle2,
    title: "You are all set",
    body: "Replay this tour anytime from More, under App, then Take the app tour. For help, use Help & Support in More.",
  },
];

interface AppTourProps {
  open: boolean;
  email?: string | null;
  onClose: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function AppTour({ open, email, onClose, onNavigateToTab }: AppTourProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const finish = useCallback(() => {
    markTourSeen(email);
    onClose();
  }, [email, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open) return null;

  const step = TOUR_STEPS[index];
  const Icon = step.icon;
  const isFirst = index === 0;
  const isLast = index === TOUR_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="ErMate app tour"
      data-testid="app-tour"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="relative bg-gradient-to-br from-purple-600 to-emerald-600 px-6 pt-6 pb-8 text-white">
          <button
            type="button"
            onClick={finish}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Step {index + 1} of {TOUR_STEPS.length}
          </p>
          <h2 className="text-xl font-extrabold mt-1">{step.title}</h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 min-h-[7.5rem]">{step.body}</p>

          {step.go && onNavigateToTab && (
            <button
              type="button"
              onClick={() => {
                const tab = step.go!.tab;
                finish();
                onNavigateToTab(tab);
              }}
              className="mt-3 text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
            >
              {step.go.label} →
            </button>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-4" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-emerald-500" : "w-1.5 bg-slate-300 dark:bg-slate-700"}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 mt-5">
            {isFirst ? (
              <button
                type="button"
                onClick={finish}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                Skip tour
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 shadow-md cursor-pointer"
              data-testid="app-tour-next"
            >
              {isLast ? "Start using ErMate" : "Next"} {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}