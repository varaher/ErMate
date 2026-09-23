/**
 * ErMate -> MATE App Intelligence Map
 *
 * This is the explicit map of what MATE is allowed to know about and request
 * inside ErMate. MATE must never "discover" privileged actions by guessing UI
 * controls or bypassing ErMate role checks.
 *
 * Source of truth reviewed against current App.tsx / CaseSheetView.tsx.
 */

export type MateTopLevelTab =
  | "dashboard"
  | "analytics"
  | "admin"
  | "handover"
  | "cases"
  | "learn"
  | "profile"
  | "emdrugs"
  | "directory"
  | "mlc"
  | "tools"
  | "more"
  | "team"
  | "logbook";

export type MateCaseSheetTab =
  | "complaints"
  | "primary-survey"
  | "history"
  | "secondary-survey"
  | "investigations"
  | "trends"
  | "treatment"
  | "notes"
  | "disposition"
  | "rounds";

export type MateSurfaceId =
  | `tab:${MateTopLevelTab}`
  | "case-sheet"
  | "case-sheet-print"
  | "scribe"
  | "new-case-full"
  | "new-case-quick"
  | "discharge-summary"
  | "pediatric-calculator"
  | "pocket-mirror"
  | "quick-discharge";

export type MateCapabilityKind =
  | "navigate"
  | "read"
  | "clinical-write"
  | "workflow"
  | "clinical-tool";

export type MateCapabilityRisk =
  | "read-only"
  | "non-destructive-write"
  | "confirmation-required"
  | "destructive";

export interface MateCapability {
  id: string;
  label: string;
  kind: MateCapabilityKind;
  description: string;
  destination?: MateSurfaceId;
  caseSheetTab?: MateCaseSheetTab;
  requiresActiveCase: boolean;
  risk: MateCapabilityRisk;
  /**
   * MATE never grants access itself. ErMate's existing role/navigation guards
   * remain authoritative. "respect-ui" means expose only if current UI/session
   * already allows the destination/action.
   */
  access: "respect-ui";
  enabledInV1: boolean;
}

export const MATE_TOP_LEVEL_SURFACES: Record<MateTopLevelTab, { label: string; description: string }> = {
  dashboard: { label: "Dashboard", description: "Clinical command centre and active-patient overview." },
  analytics: { label: "Analytics", description: "Department/operational analytics where role permits." },
  admin: { label: "Admin", description: "Platform administration where role permits." },
  handover: { label: "Handover", description: "Shift handover registry and handover generation." },
  cases: { label: "Cases", description: "Saved and active clinical cases." },
  learn: { label: "Learn", description: "Clinical references, simulations, trivia and memory." },
  profile: { label: "Profile", description: "Clinician profile and personal settings." },
  emdrugs: { label: "EM Drugs", description: "Emergency medicine drug reference surface." },
  directory: { label: "Doctors Directory", description: "Clinical directory where available." },
  mlc: { label: "MLC", description: "Medico-legal case certificates and related workflow." },
  tools: { label: "Tools", description: "Clinical tools hub including drug/pediatric/reference utilities." },
  more: { label: "More", description: "Additional app functions and settings." },
  team: { label: "Department Team", description: "Department/team workflow where role permits." },
  logbook: { label: "My Log Book", description: "Clinician learning/procedure logbook." },
};

export const MATE_CASE_SHEET_SECTIONS: Record<MateCaseSheetTab, { label: string; clinicalPurpose: string }> = {
  complaints: { label: "Complaints", clinicalPurpose: "Presenting complaints and symptom-focused intake." },
  "primary-survey": { label: "Primary Survey", clinicalPurpose: "ABCDE, vitals and bedside adjunct context." },
  history: { label: "History", clinicalPurpose: "SAMPLE and relevant history including psychological documentation." },
  "secondary-survey": { label: "Secondary Survey", clinicalPurpose: "General, CVS, respiratory, abdomen, CNS and extremities." },
  investigations: { label: "Investigations", clinicalPurpose: "Ordered tests, imaging and investigation results." },
  trends: { label: "Vitals Trends", clinicalPurpose: "Time-series/reassessment vitals without overwriting earlier readings." },
  treatment: { label: "Treatment", clinicalPurpose: "Medications, infusions, procedures and treatment notes." },
  notes: { label: "Clinical Notes", clinicalPurpose: "Chronological progress/addendum notes." },
  disposition: { label: "Disposition", clinicalPurpose: "Disposition status, plan and condition at shift/disposition." },
  rounds: { label: "Clinical Rounds", clinicalPurpose: "Case discussion/debrief; reasoning must not silently write into factual record." },
};

/**
 * V1 capability registry. This is intentionally conservative: navigation and
 * context are enabled first; clinical write capabilities are exposed only through
 * the separate validated Clinical Fact/Task layer.
 */
export const MATE_CAPABILITIES: MateCapability[] = [
  { id: "navigate.dashboard", label: "Open Dashboard", kind: "navigate", description: "Navigate to Dashboard.", destination: "tab:dashboard", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "navigate.cases", label: "Open Cases", kind: "navigate", description: "Navigate to the user's available Cases view.", destination: "tab:cases", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "navigate.handover", label: "Open Handover", kind: "navigate", description: "Navigate to Handover.", destination: "tab:handover", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "navigate.learn", label: "Open Learn", kind: "navigate", description: "Navigate to Learn.", destination: "tab:learn", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "navigate.tools", label: "Open Tools", kind: "navigate", description: "Navigate to clinical tools where available for the current role.", destination: "tab:tools", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "navigate.logbook", label: "Open Log Book", kind: "navigate", description: "Navigate to My Log Book.", destination: "tab:logbook", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "navigate.team", label: "Open Department Team", kind: "navigate", description: "Navigate to Department Team if current role permits.", destination: "tab:team", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "navigate.analytics", label: "Open Analytics", kind: "navigate", description: "Navigate to Analytics if current role permits.", destination: "tab:analytics", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },

  { id: "case.open", label: "Open Case Sheet", kind: "navigate", description: "Open the currently selected/active patient's Case Sheet.", destination: "case-sheet", requiresActiveCase: true, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "case.preview", label: "Preview Case Sheet", kind: "navigate", description: "Open printable/read-only Case Sheet preview for the active case.", destination: "case-sheet-print", requiresActiveCase: true, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "case.scribe", label: "Open / Resume Scribe", kind: "navigate", description: "Open the same-case Scribe session without generating a new case ID.", destination: "scribe", requiresActiveCase: true, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "case.discharge", label: "Open Discharge Summary", kind: "navigate", description: "Open discharge-summary workflow for the active case.", destination: "discharge-summary", requiresActiveCase: true, risk: "read-only", access: "respect-ui", enabledInV1: true },

  ...Object.entries(MATE_CASE_SHEET_SECTIONS).map(([tab, meta]) => ({
    id: `case.section.${tab}`,
    label: `Open ${meta.label}`,
    kind: "navigate" as const,
    description: `Open ${meta.label} inside the active Case Sheet.`,
    destination: "case-sheet" as const,
    caseSheetTab: tab as MateCaseSheetTab,
    requiresActiveCase: true,
    risk: "read-only" as const,
    access: "respect-ui" as const,
    enabledInV1: true,
  })),

  { id: "workflow.new-case", label: "Start New Case", kind: "workflow", description: "Start the standard new-case workflow. Does not create patient data until clinician supplies/approves it.", destination: "new-case-full", requiresActiveCase: false, risk: "non-destructive-write", access: "respect-ui", enabledInV1: true },
  { id: "workflow.quick-discharge", label: "Quick Discharge", kind: "workflow", description: "Open Quick Discharge workflow.", destination: "quick-discharge", requiresActiveCase: false, risk: "non-destructive-write", access: "respect-ui", enabledInV1: true },
  { id: "tool.pediatric-calculator", label: "Pediatric Drug Calculator", kind: "clinical-tool", description: "Open pediatric drug calculator; calculator output is not a patient fact unless explicitly documented.", destination: "pediatric-calculator", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
  { id: "tool.pocket-mirror", label: "Pocket Mirror", kind: "clinical-tool", description: "Open Pocket Mirror tool.", destination: "pocket-mirror", requiresActiveCase: false, risk: "read-only", access: "respect-ui", enabledInV1: true },
];

export function getMateCapability(capabilityId: string): MateCapability | undefined {
  return MATE_CAPABILITIES.find((capability) => capability.id === capabilityId);
}

export function getEnabledMateCapabilities(): MateCapability[] {
  return MATE_CAPABILITIES.filter((capability) => capability.enabledInV1);
}

export function capabilityRequiresCase(capabilityId: string): boolean {
  return Boolean(getMateCapability(capabilityId)?.requiresActiveCase);
}
