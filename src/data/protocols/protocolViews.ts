import type { ProtocolItem, ProtocolSection, ProtocolSectionKind, ProtocolTopic } from "./protocolTypes";

// Pure helpers over the protocol data. No AI, no network, never rewrites a protocol's wording.
// The same helpers feed the on-screen chips and (next step) MATE's spoken answers.

export const KIND_CHIPS: Array<{ kind: ProtocolSectionKind; label: string }> = [
  { kind: "first10", label: "First 10 min" },
  { kind: "investigations", label: "Investigations" },
  { kind: "treatment", label: "Treatment" },
  { kind: "disposition", label: "Disposition" },
  { kind: "pitfalls", label: "Pitfalls" },
];

/** True when this section holds investigations to send (tagged as such, or contains flagged items). */
function hasInvestigations(s: ProtocolSection): boolean {
  return s.kind === "investigations" || s.items.some((i) => i.investigation);
}

/** Chips to show for a topic: only kinds the topic actually has. */
export function chipsForTopic(topic: ProtocolTopic): Array<{ kind: ProtocolSectionKind; label: string }> {
  return KIND_CHIPS.filter((c) =>
    c.kind === "investigations"
      ? topic.sections.some(hasInvestigations)
      : topic.sections.some((s) => s.kind === c.kind)
  );
}

/** Index of the section a chip should jump to, or -1. */
export function sectionIndexForKind(topic: ProtocolTopic, kind: ProtocolSectionKind): number {
  return topic.sections.findIndex((s) => (kind === "investigations" ? hasInvestigations(s) : s.kind === kind));
}

/** Exactly the authored investigation steps (label + text as written), in protocol order. */
export function investigationItems(topic: ProtocolTopic): ProtocolItem[] {
  const out: ProtocolItem[] = [];
  for (const s of topic.sections) {
    if (s.kind === "investigations") out.push(...s.items);
    else out.push(...s.items.filter((i) => i.investigation));
  }
  return out;
}

/** One plain sentence per step, e.g. "Labs: CBC, CRP, ...". Used on screen and by voice. */
export function itemLine(item: ProtocolItem): string {
  return item.label ? `${item.label}: ${item.text}` : item.text;
}

/** Spoken-friendly answer for "investigations for <topic>". Always states Draft or Reviewed. */
export function speakInvestigations(topic: ProtocolTopic): string {
  const items = investigationItems(topic);
  const status = topic.status === "reviewed" ? `Reviewed ${topic.reviewedOn}.` : "Draft protocol, not yet clinically reviewed.";
  if (!items.length) return `${topic.title}: this protocol does not list investigations. ${status}`;
  return `${topic.title}. Investigations: ${items.map(itemLine).join(" ")} ${status}`;
}