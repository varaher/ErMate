/** Package 1: learning engine safety (relevance, population, no fallback rules, token identity, honest wording). */
import fs from "node:fs";
import {
  getRelevantLearnedRules, inferPopulation, extractPatternsFromUnprocessedFeedback, recordFeedbackCorrection,
  getAllLearnedRules, getAllFeedbackCorrections, updateRuleStatus, createManualLearnedRule,
} from "./server/learningService.ts";
import { buildHandoverPrompt } from "./server/handover.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const rd = (p: string) => fs.readFileSync(p, "utf8");
const admin = { email: "reviewer-one", uid: "uid-reviewer" };
const second = { email: "reviewer-two", uid: "uid-2" };

// --- no fabricated data
t("no simulated corrections ship", getAllFeedbackCorrections().length === 0);
t("no fabricated approvals: only one built-in rule, no reviewer on it", getAllLearnedRules().length === 1 && getAllLearnedRules()[0].builtIn === true && !getAllLearnedRules()[0].approvedBy);
t("no hard-coded personal reviewer names remain in the learning service", !/dr_neeraj|Dr\. Neeraj|ermate\.ai/.test(rd("server/learningService.ts")));
const srv = rd("server.ts");
const learnBlock = srv.slice(srv.indexOf("2. Fetch Rules"), srv.indexOf("MORTALITY AUDIT"));
t("no hard-coded reviewer name in the learning routes", !/Dr\. Neeraj/.test(learnBlock));

// --- built-in imaging rule: fidelity only, relevance first
const builtin = getAllLearnedRules()[0];
t("imaging rule preserves what was dictated, never recommends one modality", /exactly as it appears/.test(builtin.rule) && !/never output|primary emergency imaging|prefer/i.test(builtin.rule));
t("no imaging mention -> no rule injected (active alone never qualifies)", getRelevantLearnedRules("45 year old male with chest pain, ECG normal, started aspirin", "handover_synthesis").length === 0);
t("CT mentioned -> built-in rule used", getRelevantLearnedRules("45 year old male, CT brain done, no bleed", "handover_synthesis").length === 1);
t("'ct' inside other words does not match", getRelevantLearnedRules("doctor noted fracture of the distal radius", "handover_synthesis").length === 0);

// --- severity ranks only after relevance; population gating
const safety = createManualLearnedRule("For paediatric asthma do not start antibiotics without documented consolidation.", ["asthma", "wheeze"], "paediatric_asthma", "safety_critical", admin);
safety.population = "paediatric";
const adultSafety = createManualLearnedRule("Record exact BP readings in adult handovers.", ["blood pressure", "BP"], "general_er", "safety_critical", admin);
adultSafety.population = "adult";
t("safety rules not injected into an unrelated adult trauma case", getRelevantLearnedRules("34 year old male road traffic accident, femur fracture", "handover_synthesis").every(r => r.id !== safety.id && r.id !== adultSafety.id));
t("paediatric asthma rule used for a child with asthma", getRelevantLearnedRules("5 year old boy, wheeze, asthma exacerbation", "handover_synthesis").some(r => r.id === safety.id));
t("paediatric rule NOT used for an adult with asthma", !getRelevantLearnedRules("40 year old male, asthma, wheeze", "handover_synthesis").some(r => r.id === safety.id));
t("paediatric rule NOT used when age is unknown", !getRelevantLearnedRules("asthma, wheeze, nebulised", "handover_synthesis").some(r => r.id === safety.id));
t("adult BP rule not used for a child", !getRelevantLearnedRules("6 year old girl, BP 100/60", "handover_synthesis").some(r => r.id === adultSafety.id));
t("adult BP rule used for an adult", getRelevantLearnedRules("62 year old male, BP 142/88", "handover_synthesis").some(r => r.id === adultSafety.id));
t("age inference: durations are not ages; neonates are paediatric",
  inferPopulation("diabetes for 10 years, fever 2 days") === null && inferPopulation("3 week old newborn") === "paediatric"
  && inferPopulation("45 yo male") === "adult" && inferPopulation("8 y/o girl") === "paediatric" && inferPopulation("72 year old man") === "adult" && inferPopulation("12 yrs boy") === "paediatric");
t("unapproved or inactive rules are never used", (() => {
  const r = createManualLearnedRule("Test rule about dengue platelets.", ["dengue"], "general", "quality", admin);
  updateRuleStatus(r.id, false, true, admin);
  return getRelevantLearnedRules("dengue fever", "handover_synthesis").every(x => x.id !== r.id) && r.active === false;
})());

// --- reviewer identity from the token
const r2 = createManualLearnedRule("Document dengue warning signs as dictated.", ["dengue"], "general", "quality", admin);
t("creator identity is the verified token identity", r2.approvedBy === admin.email && r2.approvedByUid === admin.uid && r2.supporting_examples[0].includes(admin.email));
const upd = updateRuleStatus(r2.id, true, true, second)!;
t("approving records the verified reviewer", upd.approvedBy === second.email && upd.approvedByUid === second.uid);
const rej = updateRuleStatus(r2.id, false, true, admin)!;
t("rejecting clears reviewer and deactivates", rej.approved === false && rej.active === false && !rej.approvedBy);
t("routes read identity from req.user and never from the body", /req\.user\?\.uid/.test(learnBlock) && !/req\.body[^;]*(approvedBy|createdBy)/.test(learnBlock) && !/\bapprovedBy\b\s*\|\|/.test(learnBlock));
t("admin routes still require the platform admin", (learnBlock.match(/requirePlatformAdmin/g) || []).length >= 5);

// --- extraction: no fallback rules
(async () => {
  const before = getAllLearnedRules().length;
  recordFeedbackCorrection("imaging", "MRI brain", "CT brain non-contrast", "syncope", "tester", "syncope_workup");
  t("a correction was captured for the test", getAllFeedbackCorrections().length === 1 && getAllFeedbackCorrections()[0].processed === false);

  const noKey = await extractPatternsFromUnprocessedFeedback({ llm: async () => null });
  t("model unavailable -> no rules, correction stays pending", noKey.status === "llm_unavailable" && noKey.newRules.length === 0 && getAllLearnedRules().length === before && getAllFeedbackCorrections()[0].processed === false);

  const failed = await extractPatternsFromUnprocessedFeedback({ llm: async () => { throw new Error("boom"); } });
  t("model call fails -> no rules, correction stays pending", failed.status === "llm_failed" && getAllLearnedRules().length === before && getAllFeedbackCorrections()[0].processed === false);

  const junk = await extractPatternsFromUnprocessedFeedback({ llm: async () => "sorry, I cannot do that" });
  t("unreadable reply -> no rules, correction stays pending", junk.status === "llm_failed" && getAllLearnedRules().length === before && getAllFeedbackCorrections()[0].processed === false);

  const empty = await extractPatternsFromUnprocessedFeedback({ llm: async () => "[]" });
  t("valid empty answer -> no rules, correction marked processed (not turned into a rule)", empty.status === "no_pattern" && empty.newRules.length === 0 && getAllLearnedRules().length === before && getAllFeedbackCorrections()[0].processed === true);

  recordFeedbackCorrection("imaging", "MRI", "CT chest", "trauma", "tester", "trauma");
  const bad = await extractPatternsFromUnprocessedFeedback({ llm: async () => JSON.stringify([{ rule: "x", trigger_keywords: ["a"] }, { rule: "A proper long rule with no keywords", trigger_keywords: [] }]) });
  t("rules with no text or no trigger keyword are dropped", bad.newRules.length === 0 && getAllLearnedRules().length === before);

  recordFeedbackCorrection("imaging", "MRI", "CT abdomen", "pain", "tester", "abdomen");
  const good = await extractPatternsFromUnprocessedFeedback({ llm: async () => JSON.stringify([{ rule: "Record imaging modality exactly as dictated.", trigger_keywords: ["CT abdomen"], severity: "quality" }]) });
  t("a real pattern becomes a PROPOSED rule only (not approved, not active, no reviewer)", good.newRules.length === 1 && good.newRules[0].approved === false && good.newRules[0].active === false && !good.newRules[0].approvedBy);
  t("proposed rule is not injected until approved", getRelevantLearnedRules("CT abdomen done", "handover_synthesis").every(r => r.id !== good.newRules[0].id));
  const svc = rd("server/learningService.ts");
  t("no fallback rule generation code remains", !/Fallback pattern extraction|strictly prefer/.test(svc));

  // --- handover prompt integration
  t("handover prompt: unrelated case has no learned-rules block", !/LEARNED CORRECTIONS/.test(buildHandoverPrompt("45 year old male, chest pain, ECG normal")));
  t("handover prompt includes the built-in rule when a CT is mentioned", /LEARNED CORRECTIONS/.test(buildHandoverPrompt("45 year old male, CT brain normal")));

  // --- capture stays disabled
  t("client capture flag is false", /LEARNING_CAPTURE_CLIENT_ENABLED = false/.test(rd("src/services/learningClient.ts")));
  t("server capture route still rejects", /app\.post\("\/api\/learning\/feedback", requireAuth, learningFeedbackRejectHandler\)/.test(srv));
  t("no route calls recordFeedbackCorrection", !/recordFeedbackCorrection/.test(srv));

  // --- honest wording
  const cm = rd("src/components/ConsentModal.tsx"), priv = rd("public/privacy.html");
  t("consent modal no longer claims current training or collection", !/smarter|clinical brain|first clinical AI|make differential diagnosis|train ErMate's voice model/.test(cm));
  t("consent modal says nothing is used for training today and that consent will be asked again", /does not train on your cases today/.test(cm) && /Nothing\. No recordings, transcripts, corrections or diagnoses/.test(cm) && /ask for your consent again/.test(cm));
  t("consent modal says voice is sent unmasked", /voice recordings are sent unmasked/.test(cm));
  t("privacy policy states no model training today and separate consent later", /do not currently use your recordings, transcripts, cases or corrections to train any AI model/.test(priv) && /separate consent/.test(priv));

  console.log(fail ? `${fail} FAILED` : "ALL PASS");
  process.exit(fail ? 1 : 0);
})();