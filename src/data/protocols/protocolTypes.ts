// ErMate Handbook data model. Plain data, no AI: what is published is exactly what is shown.
// WikEM-style topic pages (Neeraj, 23 Nov 2026): First 10 minutes, symptoms, pathophysiology, approach,
// differentials (linked to their own topics), investigations, treatment, procedures, disposition, pitfalls.
export type ProtocolStatus = "draft" | "reviewed";

/** What a section is for. Drives the jump chips and the "investigations to send" box. Never changes the wording. */
export type ProtocolSectionKind =
  | "recognition"
  | "symptoms"
  | "pathophysiology"
  | "approach"
  | "assessment"
  | "first10"
  | "differentials"
  | "investigations"
  | "treatment"
  | "procedures"
  | "disposition"
  | "pitfalls";

export interface ProtocolItem {
  /** Short label, e.g. "Anaphylaxis" */
  label?: string;
  /** The instruction exactly as authored */
  text: string;
  /** Shown in red (life-threatening step or safety warning) */
  critical?: boolean;
  /**
   * Where the step comes from. Omitted = written protocol / guideline-based step.
   * "local" = a practice followed at a named hospital that is NOT a guideline requirement. It is shown with a
   * purple badge and the hospital's name, and is never presented as the standard of care.
   */
  tier?: "guideline" | "local";
  /** Hospital / department that follows a "local" step, e.g. "Rajagiri Hospital ED" */
  origin?: string;
  /** True when this step is an investigation to send / perform (used by the "investigations to send" box) */
  investigation?: boolean;
  /**
   * Id of another Handbook topic this step opens ("Open Variceal bleed →").
   * A link to a topic that is not written yet shows as "Topic coming" and never breaks.
   */
  link?: string;
}

export interface ProtocolSection {
  heading: string;
  /** Optional tag used for jump chips. Untagged sections still show normally. */
  kind?: ProtocolSectionKind;
  /** Optional one-line note under the heading */
  note?: string;
  /** "tiles" = shown as a grid of tiles (used for differentials). Default: list. */
  layout?: "list" | "tiles";
  items: ProtocolItem[];
}

export interface ProtocolTopic {
  id: string;
  title: string;
  summary: string;
  /** "adult" or "paediatric": protocols are never mixed */
  population: "adult" | "paediatric";
  status: ProtocolStatus;
  version: string;
  /** ISO date of last clinical review; empty while draft */
  reviewedOn: string;
  source: string;
  /** Presenting complaints / words a doctor would search for (e.g. "chest pain", "hematemesis") */
  keywords?: string[];
  /** Shown in amber above the protocol (e.g. "not an approved order set") */
  notice?: string;
  /** The red "First 10 minutes" box at the top of the page: immediate actions, in order. */
  firstTen?: string[];
  /** Id of the parent pathway (e.g. variceal bleed → decompensated cirrhosis). Shown as "Part of …". */
  parent?: string;
  /** Governance notes for the clinical reviewer: corrections still required before sign-off */
  reviewNotes?: string[];
  /** Verification bibliography (recommended sources, not proof that each step was validated) */
  references?: string[];
  sections: ProtocolSection[];
}

export interface ProtocolChapter {
  id: string;
  title: string;
  topics: ProtocolTopic[];
}