// MARKER: ERMATE-HANDBOOK-LINKS-V1
// ErMate Handbook (23 Nov 2026): WikEM-style topic pages linked to each other.
import { readFileSync } from "fs";
import { allProtocolTopics, findTopic } from "./src/data/protocols";
import { linkedTopicIds, resolveLink, backlinks, chipsForTopic } from "./src/data/protocols/protocolViews";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };

const topics = allProtocolTopics();
const handbook = topics.filter((x) => x.firstTen && x.firstTen.length); // new-format pages
const REQUIRED_KINDS = ["symptoms", "pathophysiology", "approach", "differentials", "investigations", "treatment", "disposition", "pitfalls"];

t("46 new-format Handbook pages", handbook.length === 46);
for (const tp of handbook) {
  const kinds = new Set(tp.sections.map((s) => s.kind));
  const missing = REQUIRED_KINDS.filter((k) => !kinds.has(k as any) && !(k === "symptoms" && tp.sections.some((s) => /grade/i.test(s.heading))));
  t(`${tp.id}: has every WikEM section (${missing.join(", ") || "all"})`, missing.length === 0);
  t(`${tp.id}: differentials shown as tiles`, tp.sections.some((s) => s.kind === "differentials" && s.layout === "tiles"));
  t(`${tp.id}: First 10 minutes is 3-6 short steps`, tp.firstTen!.length >= 3 && tp.firstTen!.length <= 6 && tp.firstTen!.every((f) => f.length < 240));
  t(`${tp.id}: draft, never falsely reviewed`, tp.status === "draft" && tp.reviewedOn === "");
  t(`${tp.id}: has dated references`, (tp.references || []).length >= 3 && (tp.references || []).every((r) => /(19|20)\d\d/.test(r) || /verification/i.test(r)));
  t(`${tp.id}: chips include Differentials and Pathophysiology`, chipsForTopic(tp).some((c) => c.kind === "differentials") && chipsForTopic(tp).some((c) => c.kind === "pathophysiology"));
  t(`${tp.id}: never links to itself`, !tp.sections.some((s) => s.items.some((i) => i.link === tp.id)));
}

// Links: every published link resolves; unpublished ones are deliberate placeholders ("Topic coming").
const allLinks = topics.flatMap((tp) => linkedTopicIds(tp));
const unresolved = Array.from(new Set(allLinks.filter((id) => !resolveLink(id, topics))));
t("link ids are kebab-case", allLinks.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)));
t("unresolved links are only planned topics/procedures (shown as Topic coming)", unresolved.every((id) => /-(adult|paeds|procedure)$/.test(id)));
console.log(`   planned topics referenced: ${unresolved.join(", ")}`);
t("cirrhosis links to all 4 branches", ["variceal-bleed-adult", "sbp-adult", "hepatic-encephalopathy-adult", "hrs-aki-adult"].every((id) => linkedTopicIds(findTopic("cirrhosis-liver-adult")!).includes(id)));
t("each branch is linked back from cirrhosis (backlinks)", ["variceal-bleed-adult", "sbp-adult", "hepatic-encephalopathy-adult", "hrs-aki-adult"].every((id) => backlinks(id, topics).some((b) => b.id === "cirrhosis-liver-adult")));
t("branches cross-link (variceal -> HE, SBP -> HRS)", linkedTopicIds(findTopic("variceal-bleed-adult")!).includes("hepatic-encephalopathy-adult") && linkedTopicIds(findTopic("sbp-adult")!).includes("hrs-aki-adult"));
t("resolveLink: unknown id is undefined, not an error", resolveLink("does-not-exist-adult", topics) === undefined && resolveLink(undefined, topics) === undefined);

t("sepsis link from cirrhosis/SBP now resolves", !!resolveLink("sepsis-adult", topics) && linkedTopicIds(findTopic("cirrhosis-liver-adult")!).includes("sepsis-adult"));
t("arrest <-> ROSC linked both ways", linkedTopicIds(findTopic("cardiac-arrest-adult")!).includes("post-rosc-adult") && linkedTopicIds(findTopic("post-rosc-adult")!).includes("cardiac-arrest-adult"));
t("resuscitation chapter listed first", (await import("./src/data/protocols")).PROTOCOL_CHAPTERS[0].id === "resuscitation");

t("trauma chapter second", (await import("./src/data/protocols")).PROTOCOL_CHAPTERS[1].id === "trauma");
t("shock page now opens haemorrhagic shock + tension pneumothorax", ["haemorrhagic-shock-adult", "tension-pneumothorax-adult"].every((id) => !!resolveLink(id, topics) && linkedTopicIds(findTopic("shock-undifferentiated-adult")!).includes(id)));

t("paediatric chapter third, all paediatric", (await import("./src/data/protocols")).PROTOCOL_CHAPTERS[2].id === "paediatric" && (await import("./src/data/protocols")).PROTOCOL_CHAPTERS[2].topics.every((x) => x.population === "paediatric"));
t("no paediatric page links to an adult page", topics.filter((x) => x.population === "paediatric").every((x) => linkedTopicIds(x).every((id) => !/-adult$/.test(id))));

t("toxicology chapter fourth", (await import("./src/data/protocols")).PROTOCOL_CHAPTERS[3].id === "toxicology");
t("OP / poisoning links from bradycardia, arrest, shock now resolve", ["organophosphate-poisoning-adult", "poisoning-approach-adult"].every((id) => !!resolveLink(id, topics)) && linkedTopicIds(findTopic("bradycardia-adult")!).includes("organophosphate-poisoning-adult"));

t("neurology chapter fifth", (await import("./src/data/protocols")).PROTOCOL_CHAPTERS[4].id === "neurology");
t("ICH / hypoglycaemia / alcohol-withdrawal / meningitis links now resolve", ["intracranial-haemorrhage-adult", "hypoglycaemia-adult", "alcohol-withdrawal-adult", "meningitis-adult", "seizure-adult"].every((id) => !!resolveLink(id, topics)));

t("metabolic chapter sixth", (await import("./src/data/protocols")).PROTOCOL_CHAPTERS[5].id === "metabolic");
t("PE, pneumonia, hyperK, hypoNa, adrenal, UGIB, pancreatitis links now resolve", ["pulmonary-embolism-adult", "pneumonia-adult", "hyperkalaemia-adult", "hyponatraemia-adult", "adrenal-crisis-adult", "upper-gi-bleed-adult", "pancreatitis-adult"].every((id) => !!resolveLink(id, topics)));

// Old founder pages still render unchanged.
t("dyspnea and ACS pages kept as authored", !!findTopic("dyspnea-adult") && !!findTopic("cad-acs-adult"));

// Panel
const panel = readFileSync("src/components/ProtocolsPanel.tsx", "utf8");
t("panel: ErMate Handbook title", panel.includes("ErMate Handbook") && panel.includes('data-testid="handbook-title"'));
t("panel: First 10 minutes box", panel.includes('data-testid="handbook-first10"'));
t("panel: differential tiles + Open links", panel.includes('data-testid="handbook-ddx-grid"') && panel.includes('data-testid="handbook-link"'));
t("panel: Topic coming placeholder for unwritten links", panel.includes('data-testid="handbook-topic-coming"'));
t("panel: Back trail and Part of parent", panel.includes('data-testid="handbook-back"') && panel.includes('data-testid="handbook-parent"'));
t("panel: Related topics", panel.includes('data-testid="handbook-related"'));
t("panel: flag, notice, review notes, references kept", ["protocol-flag-step", "protocol-flag-topic", "protocol-notice", "protocol-review-notes", "protocol-references", "local-practice-badge"].every((id) => panel.includes(id)));
t("panel stays AI-free", !/fetch\(|authenticatedFetch|gemini|anthropic|openai|sarvam/i.test(panel));
const guide = readFileSync("src/components/ErGuideView.tsx", "utf8");
t("ER Guide tab renamed to ErMate Handbook", guide.includes('label: "ErMate Handbook"'));
const tours = readFileSync("src/lib/coachTours.ts", "utf8");
t("walkthrough tip for handbook links", tours.includes('feature: "handbook-links"'));

console.log(`\nHandbook links: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);