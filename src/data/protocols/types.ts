// Protocol library data model. Plain data, no AI: what is published is exactly what is shown.
export type ProtocolStatus = "draft" | "reviewed";

export interface ProtocolItem {
  /** Short label, e.g. "Anaphylaxis" */
  label?: string;
  /** The instruction exactly as authored */
  text: string;
  /** Shown in red (life-threatening step or safety warning) */
  critical?: boolean;
}

export interface ProtocolSection {
  heading: string;
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
  sections: ProtocolSection[];
}

export interface ProtocolChapter {
  id: string;
  title: string;
  topics: ProtocolTopic[];
}