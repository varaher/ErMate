/** Learn hub fed by the ER Guide: generated quiz questions and branching cases are grounded, population-safe and varied. */
import fs from "node:fs";
import { allProtocolTopics } from "./src/data/protocols/index.ts";
import { generateQuestions, topicCorpus, tooSimilar, QUIZ_KIND_LABEL, MAX_LEN } from "./src/lib/protocolQuiz.ts";
import { buildSimulation, canSimulate, simulationTopics, SIM_RIGHT } from "./src/lib/protocolSim.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, extra = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : " " + extra}`); };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const topics = allProtocolTopics();
const byId = new Map(topics.map((x) => [x.id, x]));
const SAME_TOPIC_WRONG = new Set(["disposition"]);

// ---- quiz ----
const all: ReturnType<typeof generateQuestions> = [];
for (let seed = 1; seed <= 6; seed++) all.push(...generateQuestions(topics, { count: 400, seed }));
t("quiz: many questions are available", all.length > 300, String(all.length));
t("quiz: every kind is produced", Object.keys(QUIZ_KIND_LABEL).every((k) => all.some((q) => q.kind === k)));

const bad: string[] = [];
for (const q of all) {
  const topic = byId.get(q.topicId)!;
  const corpus = topicCorpus(topic);
  if (q.options.length !== 4 || new Set(q.options.map(norm)).size !== 4) bad.push(`${q.id} options`);
  if (!(q.correctIndex >= 0 && q.correctIndex < 4)) bad.push(`${q.id} index`);
  const right = q.options[q.correctIndex];
  if (!corpus.includes(norm(right))) bad.push(`${q.id} right answer not in topic`);
  if (right.length > MAX_LEN && q.kind !== "recognise") bad.push(`${q.id} long`);
  if (q.population !== topic.population) bad.push(`${q.id} population tag`);
  q.options.forEach((o, i) => {
    if (i === q.correctIndex) return;
    if (!SAME_TOPIC_WRONG.has(q.kind) && corpus.includes(norm(o))) bad.push(`${q.id} wrong answer is also in this topic: ${o.slice(0, 40)}`);
    if (!SAME_TOPIC_WRONG.has(q.kind) && tooSimilar(o, right)) bad.push(`${q.id} wrong answer too close to right`);
    if (q.kind !== "recognise" && !SAME_TOPIC_WRONG.has(q.kind)) {
      const home = topics.filter((x) => x.population === topic.population && x.id !== topic.id && topicCorpus(x).includes(norm(o)));
      if (!home.length) bad.push(`${q.id} wrong answer is not from a same-population topic: ${o.slice(0, 40)}`);
    }
  });
  if (!q.explanation.includes(topic.title) || !q.source.includes(topic.title)) bad.push(`${q.id} no source`);
}
t("quiz: right answer is always the topic's own text; wrong answers are never in this topic, never too similar", bad.length === 0, bad.slice(0, 5).join(" | "));

// population is never mixed
const popBad = all.filter((q) => {
  const topic = byId.get(q.topicId)!;
  return q.options.some((o, i) => {
    if (i === q.correctIndex || SAME_TOPIC_WRONG.has(q.kind) || q.kind === "recognise") return false;
    return topics.some((x) => x.population !== topic.population && topicCorpus(x).includes(norm(o)) && !topics.some((y) => y.population === topic.population && y.id !== topic.id && topicCorpus(y).includes(norm(o))));
  });
});
t("quiz: adult and paediatric text are never mixed in one question", popBad.length === 0, popBad[0]?.id);
const recog = all.filter((q) => q.kind === "recognise");
t("quiz: 'recognise' options are same-population titles", recog.every((q) => q.options.every((o) => topics.find((x) => x.title === o)?.population === q.population)));
t("quiz: 'recognise' never shows the topic name in the clue", recog.every((q) => !norm(q.prompt).includes(norm(byId.get(q.topicId)!.title.replace(/\(.*?\)/g, "")))));

// seeds
const a1 = generateQuestions(topics, { count: 10, seed: 7 }), a2 = generateQuestions(topics, { count: 10, seed: 7 }), b = generateQuestions(topics, { count: 10, seed: 8 });
t("quiz: same seed gives the same set", JSON.stringify(a1) === JSON.stringify(a2));
t("quiz: a new seed gives a different set", JSON.stringify(a1.map((q) => q.id)) !== JSON.stringify(b.map((q) => q.id)));
t("quiz: 10 asked, 10 returned, varied kinds and topics", a1.length === 10 && new Set(a1.map((q) => q.kind)).size >= 5 && new Set(a1.map((q) => q.topicId)).size >= 7);
t("quiz: no repeated question in a set", new Set(a1.map((q) => q.id)).size === a1.length);

// filters
const peds = generateQuestions(topics, { count: 20, seed: 3, population: "paediatric" });
t("quiz: paediatric filter only gives paediatric topics", peds.length > 0 && peds.every((q) => q.population === "paediatric"));
const one = generateQuestions(topics, { count: 20, seed: 3, topicId: "sepsis-adult" });
t("quiz: one topic filter gives only that topic, and several question types", one.length >= 5 && one.every((q) => q.topicId === "sepsis-adult") && new Set(one.map((q) => q.kind)).size >= 4);
t("quiz: every topic can make at least 3 questions", topics.every((x) => generateQuestions(topics, { count: 50, seed: 1, topicId: x.id }).length >= 3),
  topics.filter((x) => generateQuestions(topics, { count: 50, seed: 1, topicId: x.id }).length < 3).map((x) => x.id).join(","));
t("quiz: draft topics are marked draft on the question", all.every((q) => q.status === byId.get(q.topicId)!.status));
t("quiz: no question claims a strict order for the First 10 minutes", all.every((q) => !/comes FIRST|in order/i.test(q.prompt + q.explanation)));

// ---- simulation ----
const simTopics = simulationTopics(topics);
t("sim: most topics can run as a case", simTopics.length >= 38, String(simTopics.length));
const simBad: string[] = [];
let endsOk = 0;
for (const topic of simTopics) {
  for (const seed of [1, 2, 3]) {
    const c = buildSimulation(topic, topics, seed);
    if (!c) { simBad.push(`${topic.id} no case`); continue; }
    if (c.vitals) simBad.push(`${topic.id} invented vitals`);
    if (!c.generated || c.topicId !== topic.id || c.topicStatus !== topic.status) simBad.push(`${topic.id} flags`);
    const corpus = topicCorpus(topic);
    // explore EVERY reachable node taking only right answers (any order), check each
    const seen = new Set<string>(), queue: { id: string; score: number }[] = [{ id: "start", score: 0 }];
    const finals = new Set<number>();
    let id = "start";
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.id === "simulation_end") { finals.add(cur.score); continue; }
      const key = `${cur.id}@${cur.score}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const step = c.steps[cur.id];
      if (!step) { simBad.push(`${topic.id} missing step ${cur.id}`); continue; }
      const rights = step.options.filter((o) => o.scoreChange > 0);
      const isFirstTen = /^(start|d\d+)$/.test(cur.id);
      if (isFirstTen ? rights.length < 1 : rights.length !== 1) simBad.push(`${topic.id} ${cur.id} has ${rights.length} right answers`);
      if (step.options.length < 3) simBad.push(`${topic.id} ${cur.id} only ${step.options.length} choices`);
      if (new Set(step.options.map((o) => norm(o.text))).size !== step.options.length) simBad.push(`${topic.id} ${cur.id} repeated choice`);
      for (const r of rights) if (!corpus.includes(norm(r.text))) simBad.push(`${topic.id} ${cur.id} right choice is not topic text`);
      for (const w of step.options.filter((o) => o.scoreChange < 0)) {
        if (w.nextStepId !== cur.id) simBad.push(`${topic.id} ${cur.id} wrong choice moves on`);
        if (rights.some((r) => norm(w.text) === norm(r.text))) simBad.push(`${topic.id} ${cur.id} wrong equals right`);
        const ownTopic = corpus.includes(norm(w.text));
        const otherSamePop = topics.some((x) => x.id !== topic.id && x.population === topic.population && topicCorpus(x).includes(norm(w.text)));
        const otherPop = topics.some((x) => x.population !== topic.population && topicCorpus(x).includes(norm(w.text)));
        if (!ownTopic && !otherSamePop) simBad.push(`${topic.id} ${cur.id} wrong choice is invented: ${w.text.slice(0, 40)}`);
        if (!ownTopic && otherPop && !otherSamePop) simBad.push(`${topic.id} ${cur.id} wrong choice from other population`);
      }
      for (const r of rights) queue.push({ id: r.nextStepId, score: cur.score + r.scoreChange });
    }
    const expected = SIM_RIGHT * Object.keys(c.steps).filter((k) => /^(start|d\d+|c\d+)$/.test(k) && !/^d\d+$/.test(k) || false).length;
    const nFirst = Object.keys(c.steps).filter((k) => /^(start|d\d+)$/.test(k)).length;
    const nCrit = Object.keys(c.steps).filter((k) => /^c\d+$/.test(k)).length;
    // n first actions => 2^n - 1 nodes before the end
    const n = Math.round(Math.log2(nFirst + 1));
    if (finals.size !== 1 || ![...finals][0] || [...finals][0] !== SIM_RIGHT * (n + nCrit)) simBad.push(`${topic.id} final score ${[...finals].join("/")} expected ${SIM_RIGHT * (n + nCrit)}`);
    void expected;
    id = finals.size ? "simulation_end" : "";
    if (id === "simulation_end") endsOk++;
    else simBad.push(`${topic.id} never ends`);
    if (!c.steps["simulation_end"] || c.steps["simulation_end"].options.length) simBad.push(`${topic.id} bad end`);
    if (!c.debrief.includes(topic.title)) simBad.push(`${topic.id} debrief`);
    if (topic.status === "draft" && !/DRAFT/.test(c.debrief)) simBad.push(`${topic.id} draft note missing`);
  }
}
t("sim: every case is solvable on the right path, grounded, no invented vitals or choices", simBad.length === 0, simBad.slice(0, 5).join(" | "));
t("sim: right path ends for every topic and seed", endsOk === simTopics.length * 3, `${endsOk}`);
const s1 = buildSimulation(byId.get("sepsis-adult")!, topics, 1)!, s2 = buildSimulation(byId.get("sepsis-adult")!, topics, 99)!;
t("sim: a new seed changes the order of choices", JSON.stringify(s1.steps.start.options.map((o) => o.text)) !== JSON.stringify(s2.steps.start.options.map((o) => o.text)) || JSON.stringify(s1.steps.step2.options.map((o) => o.text)) !== JSON.stringify(s2.steps.step2.options.map((o) => o.text)));
const sepsis = byId.get("sepsis-adult")!;
t("sim: the First 10 minutes is a checklist: two different right actions are offered at the start, and either one leads on", s1.steps.start.options.filter((o) => o.scoreChange > 0).length === 2 && s1.steps.start.options.filter((o) => o.scoreChange > 0).every((o) => sepsis.firstTen!.some((f) => norm(f) === norm(o.text)) && o.nextStepId !== "start"));
t("sim: early adrenaline in anaphylaxis is never scored as wrong", (() => { const an = byId.get("anaphylaxis-adult")!; const c = buildSimulation(an, topics, 5)!; return Object.values(c.steps).every((st) => st.options.every((o) => !/adrenaline 0\.5 mg IM/i.test(o.text) || o.scoreChange > 0)); })());
t("sim: a topic without a first-10 list cannot run (no case rather than a made-up one)", buildSimulation({ ...byId.get("sepsis-adult")!, firstTen: [], sections: [] } as any, topics, 1) === null && !canSimulate({ ...byId.get("sepsis-adult")!, firstTen: [], sections: [] } as any));

// ---- wiring ----
const triv = fs.readFileSync("src/components/TriviaView.tsx", "utf8");
const simv = fs.readFileSync("src/components/SimulationsView.tsx", "utf8");
const learn = fs.readFileSync("src/components/LearnView.tsx", "utf8");
t("trivia screen offers the ER Guide quiz and keeps the board questions", /generateQuestions/.test(triv) && /trivia-guide-go/.test(triv) && /trivia-board-go/.test(triv) && /TRIVIA_QUESTIONS/.test(triv));
t("trivia shows the draft badge, the source, and the missed list", /trivia-draft/.test(triv) && /ER Guide ›/.test(triv) && /trivia-missed/.test(triv));
t("simulations screen builds a case from a topic and hides vitals when absent", /buildSimulation/.test(simv) && /sim-generate-start/.test(simv) && /selectedCase\.vitals &&/.test(simv) && /c\.vitals &&/.test(simv));
t("generated case is rebuilt with a new seed on Try again", /selectedCase\.generated && selectedCase\.topicId\) startGenerated/.test(simv));
t("fake streak banner is gone", !/Weekly Streak Badge|5 Days Active|\+120 XP/.test(learn));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);