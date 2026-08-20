import { generateUHID } from "../utils/caseHelper";
import React from "react";
import { Mic, PenLine, ClipboardList, User, Heart, ChevronRight, X } from "lucide-react";
import { ClinicalCase } from "../types";

/**
 * NewPatientEntryMenu.tsx
 *
 * Explicit entry-method menu, replacing implicit routing. Every path
 * converges into the SAME ClinicalCase shape via createNewCase() below
 * — Voice Scribe, manual typing, triage-first, or direct Adult/
 * Pediatric selection all produce structurally identical cases, so
 * View/Edit/Download/Copy/Discharge Summary work identically
 * regardless of entry method (same guarantee as mapToClinicalCase/
 * mapFromClinicalCase from earlier today).
 *
 * PEDIATRIC AGE CUTOFF — CORRECTED: the reference screenshot's copy
 * said "For patients aged 16" but the actual pediatric routing logic
 * built today (isPediatricPatient(), pediatricClinicalRanges.ts) uses
 * UNDER 18, matching your PALS-based design. This component uses 18
 * as the source of truth. If 16 was actually intentional (some
 * hospital protocols do use 16), this needs an explicit decision —
 * change PEDIATRIC_AGE_CUTOFF below, not the copy alone, so the menu
 * label and the actual routing logic can never disagree again.
 */

export const PEDIATRIC_AGE_CUTOFF = 16;

export type EntryMethod = "speak" | "type" | "triage" | "adult-direct" | "pediatric-direct";

interface Props {
  onSelect: (method: EntryMethod, newCase: ClinicalCase) => void;
  onClose: () => void;
  currentUserName: string;
  hospitalName: string;
}

// ── Shared case factory — every entry method produces this exact shape ──

function createNewCase(
  createdByName: string,
  hospital: string,
  forcedPediatric?: boolean
): ClinicalCase {
  const now = new Date().toISOString();
  return {
    id: `CASE-${Date.now()}`,
    status: "Triage",
    savedTime: now,
    timeSpentMin: 0,
    // If entry method explicitly forces pediatric/adult (direct
    // selection), isPediatric is set now. Otherwise it starts
    // undefined-equivalent (false) and gets corrected the moment a
    // real age is entered/extracted — see recomputeIsPediatric() below,
    // which every downstream flow (voice extraction, manual Patient
    // tab, triage) MUST call whenever age changes.
    isPediatric: forcedPediatric ?? false,
    patient: {
      name: "",
      age: 0,
      gender: "",
      uhid: generateUHID(),
      triageCategory: "" as any, // intentionally empty, not a fabricated default — see triage-skip note below
      presentingComplaint: "",
      arrivalMode: "Walk-in",
      dateOpened: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " | " + new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
      isMlc: false,
      caseType: "Medical",
    },
    vitals: {
      bp: "",
      hr: "",
      spo2: "",
      rr: "",
      temp: "",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6",
      grbs: "",
      avpu: "Alert",
      painScore: "",
    },
    sampleHistory: { symptoms: "", allergies: "", medications: "", pastHistory: "", lastMeal: "", events: "" },
    primaryAssessment: { airway: "", breathing: "", circulation: "", disability: "", exposure: "" },
    secondaryAssessment: "",
    investigations: [],
    treatments: [],
    differentials: [],
    progressNotes: "",
    dischargeInfo: null,
    createdByName,
    hospital,
    createdAt: now,
  } as unknown as ClinicalCase;
}

/**
 * Call this whenever a case's age becomes known/changes (voice
 * extraction result, manual Patient-tab entry, triage form) — NEVER
 * decide pediatric-vs-adult routing once and leave it stale. This is
 * the single source of truth so the age cutoff can never drift
 * between different parts of the app.
 */
export function recomputeIsPediatric(ageYears: number): boolean {
  return ageYears > 0 && ageYears < PEDIATRIC_AGE_CUTOFF;
}

/**
 * If a doctor skips triage entirely (Adult/Pediatric direct, or Speak
 * the Case without a triage step), triageCategory stays "" rather
 * than a fabricated default like "P2". Every consumer of
 * triageCategory (dashboard badges, Handover alert rows) MUST treat
 * "" as "Not yet triaged" and render that explicitly — never silently
 * treat a blank category as P2/P3, and never crash on it either.
 */
export function isTriageCategoryPending(category?: string | null | any): boolean {
  if (typeof category !== "string") return true;
  return !category || category.trim() === "";
}

// ══════════════════════════════════════════════════════════════════

export default function NewPatientEntryMenu({ onSelect, onClose, currentUserName, hospitalName }: Props) {
  const handleChoice = (method: EntryMethod) => {
    const forcedPediatric =
      method === "adult-direct" ? false :
      method === "pediatric-direct" ? true :
      undefined;

    const newCase = createNewCase(currentUserName, hospitalName, forcedPediatric);
    onSelect(method, newCase);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-end z-50">
      <div className="w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl px-5 pt-3 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-5" />

        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">New Patient</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Speak the case — get a copyable note in seconds</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white p-1 transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Primary CTA — Speak the Case */}
        <button
          onClick={() => handleChoice("speak")}
          className="w-full flex items-center gap-4 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-600/80 rounded-2xl px-4 py-4 mt-5 transition-colors cursor-pointer"
        >
          <span className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/20">
            <Mic className="text-white" size={22} />
          </span>
          <div className="flex-1 text-left">
            <p className="text-indigo-950 dark:text-white font-extrabold text-base">Speak the Case</p>
            <p className="text-indigo-900/70 dark:text-slate-400 text-xs sm:text-sm mt-0.5">Dictate naturally — AI writes the note, ready to copy into any EMR. Correct it by chatting.</p>
          </div>
          <ChevronRight className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" size={20} />
        </button>

        {/* Secondary options */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl mt-4 divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-transparent overflow-hidden">
          <MenuRow
            icon={<PenLine size={18} />}
            title="Prefer to type it in?"
            subtitle="Manual form — all fields, AI diagnosis, ABG analysis"
            onClick={() => handleChoice("type")}
          />
          <MenuRow
            icon={<ClipboardList size={18} />}
            title="Start with Triage"
            subtitle="Full triage → case sheet"
            onClick={() => handleChoice("triage")}
          />
          <MenuRow
            icon={<User size={18} />}
            title="Adult Case Sheet"
            subtitle="Quick start, skip triage"
            onClick={() => handleChoice("adult-direct")}
          />
          <MenuRow
            icon={<Heart size={18} />}
            title="Pediatric Case Sheet"
            subtitle={`For patients under ${PEDIATRIC_AGE_CUTOFF}`}
            onClick={() => handleChoice("pediatric-direct")}
          />
        </div>
      </div>
    </div>
  );
}

function MenuRow({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors text-left cursor-pointer">
      <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-emerald-700 dark:text-emerald-400">
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-slate-900 dark:text-white font-bold text-sm">{title}</p>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight className="text-slate-400 dark:text-slate-600 flex-shrink-0" size={18} />
    </button>
  );
}
