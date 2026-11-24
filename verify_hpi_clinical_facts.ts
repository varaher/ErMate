// MARKER: ERMATE-HPI-CLINICAL-FACTS-V1
// Audit 23 Nov 2026: the number check alone cannot catch invented non-numeric findings.
// The clinical facts guard must reject: negatives turned positive, positives negated, added symptoms /
// conditions / referrals — and must still accept a faithful HPI.
import { readFileSync } from "fs";
import {
  buildSafeCaseText, cleanHpiOutput, clinicalFactsProblem, conceptMentions, writeHpiFromCase, type HpiCaseInput,
} from "./server/caseSummaryHpi";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };

const caseA: HpiCaseInput = {
  sex: "Male",
  presentingComplaint: "Fever with chills and breathing difficulty since today morning",
  symptoms: "Cough with sputum. No vomiting, no chest pain, no loss of consciousness.",
  events: "Went to a local hospital first, given Inj Lasix and symptomatic treatment",
  currentHpi: "Came here for further management as he is on regular follow-up with Pulmonology department",
  pastHistory: "COPD, hypertension",
};
const safeA = buildSafeCaseText(caseA);

// --- Faithful HPI is accepted
const good = "The patient presented to the Emergency Department with complaints of fever with chills and breathing difficulty since today morning, with cough and sputum. He initially sought medical attention at a local hospital, where Inj. Lasix and symptomatic treatment were administered. He is a known case of COPD and hypertension and is on regular follow-up with the Pulmonology department, and presented here for further management. There was no vomiting, chest pain or loss of consciousness.";
t("faithful HPI accepted", cleanHpiOutput(good, safeA) !== null);
t("faithful HPI: no problem reported", clinicalFactsProblem(good, safeA) === null);

// --- 1. Negative turned positive
t("'no vomiting' -> 'vomiting' rejected", cleanHpiOutput("The patient presented with fever with chills and breathing difficulty since today morning, associated with vomiting.", safeA) === null);
t("'no chest pain' -> 'chest pain' rejected", clinicalFactsProblem("The patient presented with fever and chest pain.", safeA) !== null);
t("'no LOC' -> 'loss of consciousness' rejected", clinicalFactsProblem("He had an episode of loss of consciousness.", safeA) !== null);

// --- 2. Positive negated
t("'cough' -> 'no cough' rejected", clinicalFactsProblem("The patient presented with fever. There was no cough.", safeA) !== null);
t("'fever' -> 'denies fever' rejected", clinicalFactsProblem("The patient denies fever and presented with breathing difficulty.", safeA) !== null);

// --- 3. Added symptoms / conditions / history
t("added symptom (headache) rejected", clinicalFactsProblem("The patient presented with fever, breathing difficulty and headache.", safeA) !== null);
t("added condition (diabetes) rejected", clinicalFactsProblem("He is a known diabetic with COPD.", safeA) !== null);
t("added habit (smoking) rejected", clinicalFactsProblem("He is a chronic smoker with COPD.", safeA) !== null);
t("added negative not in case (no headache) rejected", clinicalFactsProblem("The patient presented with fever. No headache.", safeA) !== null);
t("added department (Cardiology) rejected", clinicalFactsProblem("He is on regular follow-up with the Cardiology department.", safeA) !== null);

// --- 4. Referral / outside care invented
const caseB: HpiCaseInput = { sex: "Female", presentingComplaint: "Abdominal pain since 2 days", symptoms: "Vomiting 3 episodes" };
const safeB = buildSafeCaseText(caseB);
t("faithful short HPI accepted", cleanHpiOutput("The patient presented to the Emergency Department with complaints of abdominal pain since 2 days, with 3 episodes of vomiting.", safeB) !== null);
t("invented referral from local hospital rejected", cleanHpiOutput("The patient presented with abdominal pain since 2 days and was referred from a local hospital.", safeB) === null);
t("invented fever rejected", cleanHpiOutput("The patient presented with abdominal pain and fever since 2 days.", safeB) === null);

// --- 5. Synonyms are understood (no false rejection)
t("synonym: 'breathlessness' for 'breathing difficulty' accepted", clinicalFactsProblem("The patient presented with fever and breathlessness.", safeA) === null);
t("synonym: 'shortness of breath' accepted", clinicalFactsProblem("He complained of shortness of breath.", safeA) === null);
t("abbreviation: case 'HTN' allows HPI 'hypertension'", clinicalFactsProblem("He is hypertensive.", buildSafeCaseText({ presentingComplaint: "Headache", pastHistory: "HTN" })) === null);

// --- 6. Negation parsing
const m = conceptMentions("No fever, vomiting or headache. Has cough.");
t("negation list: fever / vomiting / headache negated", ["fever", "vomiting", "headache"].every((c) => m.negated.has(c)));
t("negation list: cough positive", m.positive.has("cough") && !m.negated.has("cough"));
const m2 = conceptMentions("No fever but has vomiting.");
t("negation stops at 'but'", m2.negated.has("fever") && m2.positive.has("vomiting"));

const caseC = buildSafeCaseText({ presentingComplaint: "Fall from bike, pain in right leg", events: "Fall from bike at 7 pm" });
t("'could not walk after the fall' is not read as 'no fall'", clinicalFactsProblem("The patient presented after a fall from bike with pain in the right leg. He could not walk after the fall.", caseC) === null);
t("'since' ends a negation (no fever since ...)", conceptMentions("No fever since morning, cough present").positive.has("cough"));

// --- 7. Missing information: nothing usable -> keep existing / template, never invent
(async () => {
  const badModel = async () => "The patient presented with abdominal pain since 2 days, fever and headache, and was referred from a local hospital.";
  const r1 = await writeHpiFromCase(caseB, { primary: badModel, fallback: badModel });
  t("both models invent -> falls back to template (only recorded facts)", r1.source === "template" && !!r1.hpi && !/fever|headache|referred/i.test(r1.hpi));
  const r2 = await writeHpiFromCase({ ...caseB, currentHpi: "Doctor wrote: pain started after food" }, { primary: badModel, fallback: badModel });
  t("existing HPI is kept when AI output is rejected", r2.hpi === null && /existing HPI kept/.test(r2.reason || ""));
  const goodModel = async () => "The patient presented to the Emergency Department with complaints of abdominal pain since 2 days, with 3 episodes of vomiting.";
  const r3 = await writeHpiFromCase(caseB, { primary: badModel, fallback: goodModel });
  t("fallback model used when primary invents", r3.source === "ai" && /abdominal pain/.test(r3.hpi || ""));

  // --- 8. Prompt carries the new rules
  const src = readFileSync("server/caseSummaryHpi.ts", "utf8");
  t("prompt: keep negatives as negatives", src.includes("Keep every recorded negative as a negative"));
  t("prompt: conflicting details are left out", src.includes("leave that detail out rather than choosing one"));
  t("guard wired into cleanHpiOutput", /clinicalFactsProblem\(t, safeText\)/.test(src));

  console.log(`\nHPI clinical facts guard: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();