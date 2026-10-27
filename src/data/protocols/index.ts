import type { ProtocolChapter, ProtocolTopic } from "./protocolTypes";
import { DYSPNEA_ADULT } from "./dyspnea";
import { CAD_ACS_ADULT } from "./cad_acs";
import { CIRRHOSIS_ADULT } from "./cirrhosis";

export const PROTOCOL_CHAPTERS: ProtocolChapter[] = [
  { id: "breathing", title: "Breathing & Airway", topics: [DYSPNEA_ADULT] },
  { id: "cardiac", title: "Cardiac & Chest Pain", topics: [CAD_ACS_ADULT] },
  { id: "gi-hepatic", title: "GI & Liver", topics: [CIRRHOSIS_ADULT] },
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
    if ((t.keywords || []).some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
    return t.sections.some((s) =>
      s.heading.toLowerCase().includes(q) ||
      s.items.some((i) => (i.label || "").toLowerCase().includes(q) || i.text.toLowerCase().includes(q))
    );
  });
}