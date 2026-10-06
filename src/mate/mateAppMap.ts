/**
 * ErMate — MATE Universal App Capability Map
 *
 * Single source of truth for MATE-addressable ErMate views, surfaces,
 * and Case Sheet sections.
 *
 * Invariants:
 * 1. MATE does NOT grant permissions: every capability adheres to existing UI/role authorization.
 * 2. MATE does NOT recreate features: destinations point to existing App.tsx tabs and handlers.
 * 3. Read vs Operational vs Write modes are strictly categorized.
 */

import { MateAccessMode } from "./mateContracts";

export type MateCapabilityCategory = "navigation" | "case" | "section";

export interface MateAppCapability {
  id: string;
  label: string;
  category: MateCapabilityCategory;
  requiresActiveCase: boolean;
  accessMode: MateAccessMode;
  destination: string;
  description: string;
  requiredRoles?: ("resident" | "consultant" | "hod" | "independent")[];
}

export const MATE_APP_CAPABILITIES: Record<string, MateAppCapability> = {
  // ── TOP-LEVEL NAVIGATION ──────────────────────────────────────────
  "navigate.dashboard": {
    id: "navigate.dashboard",
    label: "Dashboard",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "dashboard",
    description: "Main Emergency Department triage and active bedside census dashboard.",
  },
  "navigate.cases": {
    id: "navigate.cases",
    label: "Cases",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "cases",
    description: "Case log, search, and historical case records repository.",
  },
  "navigate.handover": {
    id: "navigate.handover",
    label: "Handover",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "handover",
    description: "Shift-to-shift clinician clinical handover board.",
  },
  "navigate.learn": {
    id: "navigate.learn",
    label: "Learn",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "learn",
    description: "Emergency medicine protocols, clinical pearls, and guideline learning.",
  },
  "navigate.tools": {
    id: "navigate.tools",
    label: "Tools",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "tools",
    description: "Clinical calculators, emergency drug infusion guides, and pocket mirror.",
  },
  "navigate.logbook": {
    id: "navigate.logbook",
    label: "My Log Book",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "logbook",
    description: "Clinician procedural logbook and duty shift activity history.",
  },
  "navigate.team": {
    id: "navigate.team",
    label: "Department Team",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "team",
    description: "Department roster, duty scheduling, and team verification.",
    requiredRoles: ["hod"],
  },
  "navigate.analytics": {
    id: "navigate.analytics",
    label: "Analytics",
    category: "navigation",
    requiresActiveCase: false,
    accessMode: "OPERATIONAL",
    destination: "analytics",
    description: "Emergency department volume, triage acuity trends, and shift metrics.",
    requiredRoles: ["hod", "consultant"],
  },

  // ── CASE WORKFLOWS ────────────────────────────────────────────────
  "case.open": {
    id: "case.open",
    label: "Open Case Sheet",
    category: "case",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "case-sheet-view",
    description: "Opens the full interactive clinical case sheet for the active patient.",
  },
  "case.preview": {
    id: "case.preview",
    label: "Preview Case Sheet",
    category: "case",
    requiresActiveCase: true,
    accessMode: "READ",
    destination: "case-sheet-preview",
    description: "Displays a non-destructive read-only preview of the case sheet with pending updates.",
  },
  "case.scribe": {
    id: "case.scribe",
    label: "Scribe Dictation",
    category: "case",
    requiresActiveCase: true,
    accessMode: "WRITE",
    destination: "scribe-chat-view",
    description: "Voice and chat AI clinical dictation lane for the patient.",
  },
  "case.discharge": {
    id: "case.discharge",
    label: "Discharge Summary",
    category: "case",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "discharge-summary-view",
    description: "Opens the comprehensive 9-section discharge summary view.",
  },
  "case.summary": {
    id: "case.summary",
    label: "Case Summary",
    category: "case",
    requiresActiveCase: true,
    accessMode: "READ",
    destination: "mate-summary",
    description: "Generates an objective, de-identified clinical case summary of the patient.",
  },
  "case.completeness.review": {
    id: "case.completeness.review",
    label: "Review Incomplete Sections",
    category: "case",
    requiresActiveCase: true,
    accessMode: "READ",
    destination: "case-pending-status",
    description: "Checks all clinical sections and lists any missing documentation without guessing.",
  },
  "case.discharge.pending": {
    id: "case.discharge.pending",
    label: "Review Pending Discharge Items",
    category: "case",
    requiresActiveCase: true,
    accessMode: "READ",
    destination: "discharge-completeness-status",
    description: "Audits discharge diagnosis, medications, follow-up, and pending reports.",
  },
  "case.rounds.review": {
    id: "case.rounds.review",
    label: "Clinical Rounds Debrief",
    category: "case",
    requiresActiveCase: true,
    accessMode: "READ",
    destination: "rounds-debrief",
    description: "In-depth case debrief across 7 emergency medicine clinical lenses via Claude Sonnet.",
  },

  // ── CASE SHEET SECTIONS ───────────────────────────────────────────
  "case.section.complaints": {
    id: "case.section.complaints",
    label: "Presenting Complaints",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-complaints",
    description: "Navigates to the chief complaint, onset, and duration section.",
  },
  "case.section.primary-survey": {
    id: "case.section.primary-survey",
    label: "Primary Survey (ABCDE)",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-primary-survey",
    description: "Navigates to the Airway, Breathing, Circulation, Disability, Exposure resuscitation survey.",
  },
  "case.section.history": {
    id: "case.section.history",
    label: "SAMPLE History",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-history",
    description: "Navigates to symptoms, allergies, medications, past history, and precipitating events.",
  },
  "case.section.secondary-survey": {
    id: "case.section.secondary-survey",
    label: "Secondary Survey",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-secondary-survey",
    description: "Navigates to the head-to-toe systemic physical examination.",
  },
  "case.section.investigations": {
    id: "case.section.investigations",
    label: "Investigations & Labs",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-investigations",
    description: "Navigates to lab tests, ABG/VBG blood gas analysis, ECG, and imaging reports.",
  },
  "case.section.trends": {
    id: "case.section.trends",
    label: "Vitals & Reassessments",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-vitals",
    description: "Navigates to serial vital signs flow sheet and clinical reassessment timeline.",
  },
  "case.section.treatment": {
    id: "case.section.treatment",
    label: "ER Treatment Given",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-treatment",
    description: "Navigates to acute emergency medications, fluids, and interventions administered in ER.",
  },
  "case.section.notes": {
    id: "case.section.notes",
    label: "Clinical Progress Notes",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-notes",
    description: "Navigates to chronological doctor observations and progress notes.",
  },
  "case.section.disposition": {
    id: "case.section.disposition",
    label: "Disposition & Plan",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-disposition",
    description: "Navigates to ER disposition type, observation notes, admission, or transfer details.",
  },
  "case.section.rounds": {
    id: "case.section.rounds",
    label: "Clinical Rounds Section",
    category: "section",
    requiresActiveCase: true,
    accessMode: "OPERATIONAL",
    destination: "section-rounds",
    description: "Navigates to the 7-lens Clinical Rounds analysis panel.",
  },
};

/**
 * Helper to check if a capability is allowed for a user role.
 */
export function isCapabilityAllowedForRole(
  capabilityId: string,
  userRole?: string | null
): boolean {
  const cap = MATE_APP_CAPABILITIES[capabilityId];
  if (!cap) return false;
  if (!cap.requiredRoles || cap.requiredRoles.length === 0) return true;
  if (!userRole) return false;
  const normalized = userRole.toLowerCase().trim();
  return cap.requiredRoles.some((r) => normalized.includes(r));
}
