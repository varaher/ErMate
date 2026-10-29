// Protocol library data model. Plain data, no AI: what is published is exactly what is shown.
export type ProtocolStatus = "draft" | "reviewed";

/** What a section is for. Drives the jump chips and the "investigations to send" box. Never changes the wording. */
export type ProtocolSectionKind = "recognition" | "assessment" | "first10" | "investigations" | "treatment" | "disposition" | "pitfalls";

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
}

export interface ProtocolSection {
  heading: string;
  /** Optional tag used for jump chips. Untagged sections still show normally. */
  kind?: ProtocolSectionKind;
  /** Optional one-line note under the heading */
  note?: string;
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