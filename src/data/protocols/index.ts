import type { ProtocolChapter, ProtocolTopic } from "./protocolTypes";
import { DYSPNEA_ADULT } from "./dyspnea";
import { CAD_ACS_ADULT } from "./cad_acs";
import { CIRRHOSIS_ADULT } from "./cirrhosis";
import { VARICEAL_BLEED_ADULT } from "./variceal_bleed";
import { SBP_ADULT } from "./sbp";
import { HEPATIC_ENCEPHALOPATHY_ADULT } from "./hepatic_encephalopathy";
import { HRS_AKI_ADULT } from "./hrs_aki";

/** ErMate Handbook chapters. A topic can link to any other topic by id (see protocolViews.resolveLink). */
export const PROTOCOL_CHAPTERS: ProtocolChapter[] = [
  { id: "breathing", title: "Breathing & Airway", topics: [DYSPNEA_ADULT] },
  { id: "cardiac", title: "Cardiac & Chest Pain", topics: [CAD_ACS_ADULT] },
  {
    id: "gi-hepatic",
    title: "GI & Liver",
    topics: [CIRRHOSIS_ADULT, VARICEAL_BLEED_ADULT, SBP_ADULT, HEPATIC_ENCEPHALOPATHY_ADULT, HRS_AKI_ADULT],
  },
];

export function allProtocolTopics(): ProtocolTopic[] {
  return PROTOCOL_CHAPTERS.flatMap((c) => c.topics);
}

export function findTopic(id: string | undefined): ProtocolTopic | undefined {
  if (!id) return undefined;
  return allProtocolTopics().find((t) => t.id === id);
}

/** Plain-text search over title, summary, First 10 minutes and every instruction. No AI. */
export function searchProtocols(query: string): ProtocolTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return allProtocolTopics();
  return allProtocolTopics().filter((t) => {
    if (t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)) return true;
    if ((t.keywords || []).some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
    if ((t.firstTen || []).some((f) => f.toLowerCase().includes(q))) return true;
    return t.sections.some((s) =>
      s.heading.toLowerCase().includes(q) ||
      s.items.some((i) => (i.label || "").toLowerCase().includes(q) || i.text.toLowerCase().includes(q))
    );
  });
}