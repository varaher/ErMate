import type { ProtocolChapter, ProtocolTopic } from "./types";
import { DYSPNEA_ADULT } from "./dyspnea";

export const PROTOCOL_CHAPTERS: ProtocolChapter[] = [
  { id: "breathing", title: "Breathing & Airway", topics: [DYSPNEA_ADULT] },
];

export function allProtocolTopics(): ProtocolTopic[] {
  return PROTOCOL_CHAPTERS.flatMap((c) => c.topics);
}

/** Plain-text search over title, summary and every instruction. No AI. */
export function searchProtocols(query: string): ProtocolTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return allProtocolTopics();
  return allProtocolTopics().filter((t) => {
    if (t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)) return true;
    return t.sections.some((s) =>
      s.heading.toLowerCase().includes(q) ||
      s.items.some((i) => (i.label || "").toLowerCase().includes(q) || i.text.toLowerCase().includes(q))
    );
  });
}