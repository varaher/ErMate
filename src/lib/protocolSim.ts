/**
 * "Run the case" simulation generated from one Handbook topic. No AI, no network, free.
 *
 * The case is a sequence of decisions taken from the topic's own First 10 minutes (in the authored order), then up to
 * two of its critical (red) steps. The First 10 minutes list is treated as a CHECKLIST done in any order (the Handbook does not
 * say every step must come before another), so any remaining step is a right choice. The right choice is always the Handbook
 * text exactly as authored. Wrong choices are real Handbook text too: a listed pitfall of this topic, or a first action of a
 * different topic of the same population. A wrong choice costs points and you try again.
 *
 * No patient story, vitals or numbers are invented: the briefing is the topic's own summary. A story-style case with
 * vitals comes later from the AI vignette step, grounded in the same text.
 */
import type { ProtocolTopic } from "../data/protocols/protocolTypes";
import type { SimulationCase, SimulationStep } from "../data/simulations";
import { distractorTopics, firstTenOf, makeRng, MAX_LEN, shuffle, tooSimilar, topicCorpus } from "./protocolQuiz";

const MAX_STEPS = 7;
export const SIM_RIGHT = 10;
export const SIM_PITFALL = -10;
export const SIM_OTHER = -10;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ok = (s: string) => s.length > 0 && s.length <= MAX_LEN;

/** Can this topic make a case? It needs at least 3 usable first actions. */
export function canSimulate(t: ProtocolTopic): boolean {
  return firstTenOf(t).filter(ok).length >= 3;
}

export function simulationTopics(all: ProtocolTopic[]): ProtocolTopic[] {
  return all.filter(canSimulate);
}

interface Decision { text: string; heading: string; critical: boolean }

function decisionsOf(t: ProtocolTopic): Decision[] {
  const first = firstTenOf(t).filter(ok);
  const out: Decision[] = first.map((x) => ({ text: x, heading: "First 10 minutes", critical: false }));
  const seen = out.map((d) => d.text);
  let extra = 0;
  for (const s of t.sections) {
    for (const i of s.items) {
      if (!i.critical || extra >= 2) continue;
      const txt = (i.label?.trim() ? `${i.label.trim()}: ${i.text.trim()}` : i.text.trim());
      if (!ok(txt) || seen.some((x) => tooSimilar(x, txt))) continue;
      out.push({ text: txt, heading: s.heading, critical: true });
      seen.push(txt);
      extra++;
    }
  }
  return out.slice(0, MAX_STEPS);
}

function pitfallsOf(t: ProtocolTopic): string[] {
  const out: string[] = [];
  for (const s of t.sections) if (s.kind === "pitfalls") for (const i of s.items) {
    const txt = i.label?.trim() ? `${i.label.trim()}: ${i.text.trim()}` : i.text.trim();
    if (ok(txt)) out.push(txt);
  }
  return out;
}

export function buildSimulation(topic: ProtocolTopic, all: ProtocolTopic[], seed: number = 1): SimulationCase | null {
  if (!canSimulate(topic)) return null;
  const rnd = makeRng(seed);
  const decisions = decisionsOf(topic);
  if (decisions.length < 3) return null;

  const pits = shuffle(pitfallsOf(topic), rnd);
  const corpus = topicCorpus(topic);
  const others = shuffle(
    distractorTopics(topic, all).flatMap((o) => firstTenOf(o).filter(ok).map((text) => ({ text, from: o.title }))),
    rnd,
  );
  const usedOther = new Set<string>();
  const pickOther = (against: string[]) => {
    const fits = (o: { text: string }) => !corpus.includes(norm(o.text)) && !against.some((a) => tooSimilar(a, o.text));
    // prefer one not yet shown in this case; when a small population has run out, reuse (never twice in the same step)
    const c = others.find((o) => !usedOther.has(o.text) && fits(o)) || others.find(fits);
    if (c) usedOther.add(c.text);
    return c;
  };

  const firstOnes = decisions.filter((d) => !d.critical).slice(0, 5);
  const crits = decisions.filter((d) => d.critical);
  const n = firstOnes.length;
  const full = (1 << n) - 1;
  const steps: { [key: string]: SimulationStep } = {};
  const usedPit = new Set<string>();
  const nodeId = (mask: number) => (mask === 0 ? "start" : `d${mask}`);
  const afterFirst = crits.length ? "c1" : "simulation_end";

  const wrongOptions = (here: string, rightTexts: string[], againstExtra: string[], rightHint: string, want: number): SimulationStep["options"] => {
    const out: SimulationStep["options"] = [];
    const pit = pits.find((p) => !usedPit.has(p) && !rightTexts.some((r) => tooSimilar(p, r))) || pits.find((p) => !rightTexts.some((r) => tooSimilar(p, r)));
    if (pit) {
      usedPit.add(pit);
      out.push({ text: pit, nextStepId: here, feedback: `This is a listed pitfall for ${topic.title}: ${pit}`, scoreChange: SIM_PITFALL });
    }
    while (out.length < want) {
      const o = pickOther([...rightTexts, ...againstExtra, ...out.map((x) => x.text)]);
      if (!o) break;
      out.push({ text: o.text, nextStepId: here, feedback: `Not what the Handbook does here. This belongs to ${o.from}, not ${topic.title}. ${rightHint}`, scoreChange: SIM_OTHER });
    }
    return out;
  };

  // First 10 minutes: a checklist in ANY order. Each node = the set of actions already done.
  for (let mask = 0; mask < full; mask++) {
    const here = nodeId(mask);
    const remaining = firstOnes.map((d, i) => ({ d, i })).filter(({ i }) => !(mask & (1 << i)));
    const offered = shuffle(remaining, makeRng(seed * 7919 + mask)).slice(0, Math.min(2, remaining.length));
    const done = n - remaining.length;
    const options: SimulationStep["options"] = offered.map(({ d, i }) => ({
      text: d.text,
      nextStepId: nodeId(mask | (1 << i)) === nodeId(full) ? afterFirst : nodeId(mask | (1 << i)),
      feedback: `Right. Handbook › ${topic.title} › ${d.heading}: ${d.text}`,
      scoreChange: SIM_RIGHT,
    }));
    const hint = `A step still to do here: ${offered[0].d.text}`;
    options.push(...wrongOptions(here, offered.map(({ d }) => d.text), [], hint, 4 - options.length));
    steps[here] = {
      id: here,
      text: `First 10 minutes, action ${done + 1} of ${n}: what do you do next? (The Handbook list is a checklist: choose any step that is right for now.)`,
      options: shuffle(options, rnd),
    };
  }

  // Critical steps: one at a time
  crits.forEach((d, k) => {
    const here = `c${k + 1}`;
    const next = k + 1 < crits.length ? `c${k + 2}` : "simulation_end";
    const options: SimulationStep["options"] = [
      { text: d.text, nextStepId: next, feedback: `Right. Handbook › ${topic.title} › ${d.heading}: ${d.text}`, scoreChange: SIM_RIGHT },
      ...wrongOptions(here, [d.text], [], `The step for this point is: ${d.text}`, 3),
    ];
    steps[here] = { id: here, text: `Critical step ${k + 1} of ${crits.length}: which is the right move?`, options: shuffle(options, rnd) };
  });

  steps["simulation_end"] = { id: "simulation_end", text: `Case complete: ${topic.title}`, options: [] };

  const points = decisions.map((d, i) => `${i + 1}. ${d.text}`).join("\n");
  const pitText = pitfallsOf(topic).slice(0, 4);
  const debrief = [
    `The Handbook steps for ${topic.title} (the first-10-minutes list is a checklist, not a strict order):`,
    points,
    pitText.length ? `Pitfalls to remember:\n${pitText.map((p) => `- ${p}`).join("\n")}` : "",
    topic.status === "draft" ? "This topic is still a DRAFT in the ErMate Handbook (not yet clinically signed off). Check it against your hospital protocol." : "",
  ].filter(Boolean).join("\n\n");

  return {
    id: `gen-${topic.id}-${seed}`,
    title: `Run the case: ${topic.title}`,
    description: topic.summary,
    difficulty: "Intermediate",
    initialState: `${topic.summary} No patient numbers are shown: you are choosing steps from the Handbook.`,
    steps,
    debrief,
    generated: true,
    topicId: topic.id,
    topicStatus: topic.status,
  };
}