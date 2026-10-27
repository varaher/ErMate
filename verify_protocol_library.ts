// MARKER: ERMATE-PROTOCOL-LIBRARY-V2
import { readFileSync } from "fs";
import { PROTOCOL_CHAPTERS, allProtocolTopics, searchProtocols } from "./src/data/protocols";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };

const topics = allProtocolTopics();
const ids = topics.map((x) => x.id);
t("3 adult protocols published", topics.length === 3 && ids.includes("dyspnea-adult") && ids.includes("cad-acs-adult") && ids.includes("cirrhosis-liver-adult"));
t("topic ids unique", new Set(ids).size === ids.length);
t("all draft, none falsely marked reviewed", topics.every((x) => x.status === "draft" && x.reviewedOn === ""));
t("adult and paediatric never mixed", topics.every((x) => x.population === "adult"));
t("every topic has a source and sections", topics.every((x) => x.source.length > 10 && x.sections.length >= 5));
t("every item has text", topics.every((x) => x.sections.every((s) => s.items.length > 0 && s.items.every((i) => i.text.trim().length > 3))));
t("chapters list the new topics", PROTOCOL_CHAPTERS.some((c) => c.id === "cardiac") && PROTOCOL_CHAPTERS.some((c) => c.id === "gi-hepatic"));

const cad = topics.find((x) => x.id === "cad-acs-adult")!;
const allCad = cad.sections.flatMap((s) => s.items);
const avil = allCad.filter((i) => /avil/i.test(i.label || "") || /pheniramine/i.test(i.label || ""));
t("Avil before CAG exists exactly once", avil.length === 1);
t("Avil is tagged local practice with the hospital named", avil[0]?.tier === "local" && avil[0]?.origin === "Rajagiri Hospital ED");
t("Avil step says it is not in the written protocol", /not in the written/i.test(avil[0]?.text || ""));
t("only the Avil step is local practice", allCad.filter((i) => i.tier === "local").length === 1);
t("PCI is never delayed for antihistamine (critical warning)", allCad.some((i) => i.critical && /never delay time-critical primary PCI/i.test(i.text)));
t("guideline note says universal premedication is not required", allCad.some((i) => /not an established guideline requirement/i.test(i.text)));
t("STEMI: cath lab without waiting for troponin", allCad.some((i) => i.critical && /Do not wait for troponin/.test(i.text)));
t("ECG within 10 minutes", allCad.some((i) => /within 10 minutes/.test(i.text)));
t("aspirin 300 mg, SL GTN 0.4 mg, atorvastatin 80 mg present", ["300 mg chewed", "0.4 mg", "Atorvastatin 80 mg"].every((x) => allCad.some((i) => i.text.includes(x))));
t("UFH dosing present", allCad.some((i) => i.text.includes("60 units/kg IV (max 4000 units)")));
t("RV infarction: avoid preload reduction", allCad.some((i) => /avoid preload reduction with RV infarction/.test(i.text)));
t("cardiac topic carries the not-an-order-set notice", /Not an approved clinical order set/.test(cad.notice || ""));

const cir = topics.find((x) => x.id === "cirrhosis-liver-adult")!;
const allCir = cir.sections.flatMap((s) => s.items);
t("SBP threshold PMN 250", allCir.some((i) => i.text.includes("250")));
t("octreotide 50 mcg bolus then 50 mcg/h", allCir.some((i) => /octreotide 50 micrograms IV bolus then 50 micrograms\/hour/.test(i.text)));
t("restrictive transfusion Hb 7", allCir.some((i) => /Hb 7 g\/dL/.test(i.text)));
t("no routine TXA / FFP", allCir.some((i) => /Avoid routine TXA/.test(i.text)));
t("four branches A-D present", ["Branch A", "Branch B", "Branch C", "Branch D"].every((b) => cir.sections.some((s) => s.heading.startsWith(b))));
t("cirrhosis review notes carried", (cir.reviewNotes || []).length === 4);
t("dyspnea review notes carried, content kept", (topics.find((x) => x.id === "dyspnea-adult")!.reviewNotes || []).length === 3 && topics.find((x) => x.id === "dyspnea-adult")!.sections.length >= 8);

t("search by complaint: chest pain -> ACS", searchProtocols("chest pain").some((x) => x.id === "cad-acs-adult"));
t("search by complaint: hematemesis -> cirrhosis", searchProtocols("hematemesis").some((x) => x.id === "cirrhosis-liver-adult"));
t("search by complaint: breathlessness -> dyspnea", searchProtocols("breathlessness").some((x) => x.id === "dyspnea-adult"));
t("search by drug: avil finds ACS", searchProtocols("avil").some((x) => x.id === "cad-acs-adult"));
t("empty search returns all", searchProtocols("").length === 3);
t("nonsense search returns none", searchProtocols("zzzzqqq").length === 0);

const panel = readFileSync("src/components/ProtocolsPanel.tsx", "utf8");
t("panel shows local-practice badge", panel.includes('data-testid="local-practice-badge"') && panel.includes("not a guideline requirement"));
t("panel shows notice, review notes, references", panel.includes("protocol-notice") && panel.includes("protocol-review-notes") && panel.includes("protocol-references"));
const dataSrc = ["cad_acs", "cirrhosis", "dyspnea", "index", "types"].map((f) => readFileSync(`src/data/protocols/${f}.ts`, "utf8")).join("\n");
t("library stays AI-free: no fetch / API / model imports", !/fetch\(|authenticatedFetch|gemini|anthropic|openai|sarvam/i.test(dataSrc + panel));
console.log(`\nProtocol library: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);