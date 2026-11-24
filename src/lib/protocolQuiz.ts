/**
 * Quiz questions generated from the ErMate Handbook (EM Guide). No AI, no network, free.
 *
 * Rules (Neeraj, 24 Nov 2026):
 *  - The right answer is ALWAYS the Handbook text exactly as authored. Nothing is reworded or invented.
 *  - Wrong answers are Handbook text from OTHER topics of the SAME population (adult and paediatric are never mixed),
 *    never from a related topic (parent, linked or linking), and never text that also appears in this topic.
 *  - Items longer than MAX_LEN are skipped, not shortened (shortening would change the authored text).
 *  - Same seed gives the same questions; a new seed gives a new set.
 */
import type { ProtocolItem, ProtocolTopic } from "../data/protocols/protocolTypes";

export type QuizKind =
  | "first10"
  | "critical"
  | "pitfall"
  | "differential"
  | "investigation"
  | "disposition"
  | "recognise";

export const QUIZ_KIND_LABEL: Record<QuizKind, string> = {
  first10: "First 10 minutes",
  critical: "Critical step",
  pitfall: "Pitfall",
  differential: "Differential",
  investigation: "Investigation",
  disposition: "Disposition",
  recognise: "Recognise the topic",
};

export interface GeneratedQuestion {
  id: string;
  kind: QuizKind;
  topicId: string;
  topicTitle: string;
  population: "adult" | "paediatric";
  /** "draft" until the clinical reviewer signs the topic off. Shown on the question. */
  status: "draft" | "reviewed";
  prompt: string;
  options: string[];
  correctIndex: number;
  /** What the Handbook says, with where it says it. */
  explanation: string;
  /** "Sepsis and septic shock (adult) › First 10 minutes" */
  source: string;
}

export const MAX_LEN = 240;
const OPTIONS = 4;

/** Small deterministic random generator (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 3));

/** True when two texts share so many words that one could pass for the other. */
export function tooSimilar(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return true;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  wa.forEach((w) => { if (wb.has(w)) shared++; });
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

const itemText = (i: ProtocolItem) => (i.label?.trim() ? `${i.label.trim()}: ${i.text.trim()}` : i.text.trim());
const usable = (s: string) => s.length > 0 && s.length <= MAX_LEN;

/** Everything a topic says, normalised, so a wrong answer is never something the topic itself states. */
export function topicCorpus(t: ProtocolTopic): string {
  const parts = [t.title, t.summary, ...(t.firstTen || [])];
  for (const s of t.sections) for (const i of s.items) parts.push(i.label || "", i.text);
  return norm(parts.join(" . "));
}

function relatedIds(t: ProtocolTopic): Set<string> {
  const ids = new Set<string>([t.id]);
  if (t.parent) ids.add(t.parent);
  for (const s of t.sections) for (const i of s.items) if (i.link) ids.add(i.link);
  return ids;
}

/** Topics whose text may be used for wrong answers: same population, not this topic, not related by parent or link either way. */
export function distractorTopics(topic: ProtocolTopic, all: ProtocolTopic[]): ProtocolTopic[] {
  const mine = relatedIds(topic);
  return all.filter((o) => {
    if (o.population !== topic.population || mine.has(o.id)) return false;
    if (relatedIds(o).has(topic.id)) return false;
    return true;
  });
}

/** Handbook pieces of one kind, as plain strings, with where each came from. */
interface Piece { text: string; topicId: string; critical?: boolean; label?: string; body?: string; sectionHeading: string }

export function firstTenOf(t: ProtocolTopic): string[] {
  if (t.firstTen && t.firstTen.length) return t.firstTen.map((x) => x.trim()).filter(Boolean);
  const sec = t.sections.find((s) => s.kind === "first10");
  return sec ? sec.items.map(itemText).filter(Boolean) : [];
}

function sectionsOf(t: ProtocolTopic, kind: string) {
  return t.sections.filter((s) => s.kind === kind);
}

function piecesOf(t: ProtocolTopic, kind: QuizKind): Piece[] {
  const out: Piece[] = [];
  const push = (text: string, sectionHeading: string, extra: Partial<Piece> = {}) => {
    if (usable(text)) out.push({ text, topicId: t.id, sectionHeading, ...extra });
  };
  switch (kind) {
    case "first10": {
      const heading = t.firstTen?.length ? "First 10 minutes" : (sectionsOf(t, "first10")[0]?.heading || "First 10 minutes");
      firstTenOf(t).forEach((x) => push(x, heading));
      break;
    }
    case "critical":
      for (const s of t.sections) for (const i of s.items) if (i.critical) push(itemText(i), s.heading, { critical: true });
      break;
    case "pitfall":
      for (const s of sectionsOf(t, "pitfalls")) for (const i of s.items) push(itemText(i), s.heading);
      break;
    case "differential":
      for (const s of sectionsOf(t, "differentials")) for (const i of s.items) if (i.label?.trim()) push(i.label.trim(), s.heading, { label: i.label.trim(), body: i.text.trim() });
      break;
    case "investigation":
      for (const s of sectionsOf(t, "investigations")) for (const i of s.items) push(itemText(i), s.heading);
      break;
    case "disposition":
      for (const s of sectionsOf(t, "disposition")) for (const i of s.items) if (i.label?.trim()) push(i.text.trim(), s.heading, { label: i.label.trim() });
      break;
    default:
      break;
  }
  return out;
}

const KIND_ORDER: QuizKind[] = ["first10", "critical", "differential", "pitfall", "investigation", "disposition", "recognise"];

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function finish(
  q: Omit<GeneratedQuestion, "options" | "correctIndex" | "id"> & { correct: string; wrong: string[] },
  rnd: () => number,
): GeneratedQuestion | null {
  const wrong: string[] = [];
  for (const w of q.wrong) if (!wrong.some((x) => norm(x) === norm(w)) && norm(w) !== norm(q.correct)) wrong.push(w);
  if (wrong.length < OPTIONS - 1) return null;
  const options = shuffle([q.correct, ...wrong.slice(0, OPTIONS - 1)], rnd);
  const { correct, wrong: _w, ...rest } = q;
  return { ...rest, id: `${q.topicId}:${q.kind}:${hash(correct)}`, options, correctIndex: options.indexOf(correct) };
}

/** Wrong answers for a piece: other topics' pieces of the same kind that do not resemble anything this topic says. */
function wrongFrom(topic: ProtocolTopic, all: ProtocolTopic[], kind: QuizKind, correct: string, rnd: () => number, want = OPTIONS - 1): string[] {
  const corpus = topicCorpus(topic);
  const pool = shuffle(
    distractorTopics(topic, all).flatMap((o) => piecesOf(o, kind)).map((p) => p.text),
    rnd,
  );
  const out: string[] = [];
  for (const cand of pool) {
    if (out.length >= want) break;
    if (tooSimilar(cand, correct)) continue;
    if (corpus.includes(norm(cand))) continue;
    if (out.some((x) => tooSimilar(x, cand))) continue;
    out.push(cand);
  }
  return out;
}

function candidatesFor(topic: ProtocolTopic, all: ProtocolTopic[], rnd: () => number): GeneratedQuestion[] {
  const base = { topicId: topic.id, topicTitle: topic.title, population: topic.population, status: topic.status } as const;
  const res: GeneratedQuestion[] = [];
  const add = (q: GeneratedQuestion | null) => { if (q && !res.some((r) => r.id === q.id)) res.push(q); };

  // Which action belongs in the first 10 minutes (wrong answers: other topics' first actions)
  for (const p of shuffle(piecesOf(topic, "first10"), rnd).slice(0, 2)) {
    add(finish({ ...base, kind: "first10", prompt: `Which of these is part of the first 10 minutes for ${topic.title}?`, correct: p.text, wrong: wrongFrom(topic, all, "first10", p.text, rnd), explanation: `Handbook › ${topic.title} › ${p.sectionHeading}: ${p.text}`, source: `${topic.title} › ${p.sectionHeading}` }, rnd));
  }

  // Critical (red) steps
  for (const p of shuffle(piecesOf(topic, "critical"), rnd).slice(0, 2)) {
    add(finish({ ...base, kind: "critical", prompt: `Which of these is a critical (red) step for ${topic.title}?`, correct: p.text, wrong: wrongFrom(topic, all, "critical", p.text, rnd), explanation: `Handbook › ${topic.title} › ${p.sectionHeading}: ${p.text}`, source: `${topic.title} › ${p.sectionHeading}` }, rnd));
  }

  // Pitfalls
  for (const p of shuffle(piecesOf(topic, "pitfall"), rnd).slice(0, 2)) {
    add(finish({ ...base, kind: "pitfall", prompt: `Which of these is a listed pitfall in ${topic.title}?`, correct: p.text, wrong: wrongFrom(topic, all, "pitfall", p.text, rnd), explanation: `Handbook › ${topic.title} › ${p.sectionHeading}: ${p.text}`, source: `${topic.title} › ${p.sectionHeading}` }, rnd));
  }

  // Differentials (answer = a label the topic lists; wrong = labels of other topics that this topic does not list)
  for (const p of shuffle(piecesOf(topic, "differential"), rnd).slice(0, 2)) {
    add(finish({ ...base, kind: "differential", prompt: `Which of these is listed in the differential diagnosis of ${topic.title}?`, correct: p.text, wrong: wrongFrom(topic, all, "differential", p.text, rnd), explanation: `Handbook › ${topic.title} › ${p.sectionHeading}: ${p.label}${p.body ? ` — ${p.body}` : ""}`, source: `${topic.title} › ${p.sectionHeading}` }, rnd));
  }

  // Investigations
  for (const p of shuffle(piecesOf(topic, "investigation"), rnd).slice(0, 2)) {
    add(finish({ ...base, kind: "investigation", prompt: `Which of these investigations does the Handbook list for ${topic.title}?`, correct: p.text, wrong: wrongFrom(topic, all, "investigation", p.text, rnd), explanation: `Handbook › ${topic.title} › ${p.sectionHeading}: ${p.text}`, source: `${topic.title} › ${p.sectionHeading}` }, rnd));
  }

  // Disposition (wrong answers: the other destinations of the SAME topic, so the destination is what is tested)
  for (const s of sectionsOf(topic, "disposition")) {
    const rows = s.items.filter((i) => i.label?.trim() && usable(i.text.trim()));
    if (rows.length < 2) continue;
    const pick = shuffle(rows, rnd)[0];
    const others = rows.filter((r) => r !== pick).map((r) => r.text.trim());
    const extra = wrongFrom(topic, all, "disposition", pick.text, rnd, 3); // filler only when the topic has fewer than 4 destinations
    add(finish({ ...base, kind: "disposition", prompt: `${topic.title}: which of these is listed under "${pick.label!.trim()}"?`, correct: pick.text.trim(), wrong: others.length >= OPTIONS - 1 ? shuffle(others, rnd) : [...shuffle(others, rnd), ...extra], explanation: `Handbook › ${topic.title} › ${s.heading} › ${pick.label!.trim()}: ${pick.text.trim()}`, source: `${topic.title} › ${s.heading}` }, rnd));
    break;
  }

  // Recognise the topic from its own summary (skipped when the summary names the topic)
  const key = norm(topic.title.replace(/\(.*?\)/g, ""));
  if (topic.summary && usable(topic.summary.trim()) && key && !norm(topic.summary).includes(key)) {
    const others = shuffle(distractorTopics(topic, all), rnd).map((o) => o.title).filter((tt) => !tooSimilar(tt, topic.title));
    add(finish({ ...base, kind: "recognise", prompt: `Which Handbook topic is this? “${topic.summary.trim()}”`, correct: topic.title, wrong: others, explanation: `Handbook › ${topic.title}: ${topic.summary.trim()}`, source: topic.title }, rnd));
  }

  return res;
}

export interface QuizOptions {
  count?: number;
  seed?: number;
  /** Only this topic */
  topicId?: string;
  /** Only this population */
  population?: "adult" | "paediatric";
  /** Only these kinds */
  kinds?: QuizKind[];
}

/** A varied set: kinds and topics are rotated so the same topic or the same type does not repeat in a row. */
export function generateQuestions(all: ProtocolTopic[], opts: QuizOptions = {}): GeneratedQuestion[] {
  const count = Math.max(1, opts.count ?? 10);
  const seed = opts.seed ?? 1;
  const rnd = makeRng(seed);
  let topics = all;
  if (opts.topicId) topics = all.filter((t) => t.id === opts.topicId);
  if (opts.population) topics = topics.filter((t) => t.population === opts.population);

  const byKind = new Map<QuizKind, GeneratedQuestion[]>();
  for (const t of shuffle(topics, rnd)) {
    for (const q of candidatesFor(t, all, rnd)) {
      if (opts.kinds && !opts.kinds.includes(q.kind)) continue;
      if (!byKind.has(q.kind)) byKind.set(q.kind, []);
      byKind.get(q.kind)!.push(q);
    }
  }
  const lanes = KIND_ORDER.filter((k) => byKind.has(k)).map((k) => shuffle(byKind.get(k)!, rnd));
  const picked: GeneratedQuestion[] = [];
  const topicUse = new Map<string, number>();
  let guard = 0;
  while (picked.length < count && lanes.some((l) => l.length) && guard++ < 10000) {
    for (const lane of lanes) {
      if (picked.length >= count) break;
      if (!lane.length) continue;
      // prefer the least-used topic in this lane
      let best = 0;
      for (let i = 1; i < lane.length; i++) if ((topicUse.get(lane[i].topicId) || 0) < (topicUse.get(lane[best].topicId) || 0)) best = i;
      const q = lane.splice(best, 1)[0];
      topicUse.set(q.topicId, (topicUse.get(q.topicId) || 0) + 1);
      picked.push(q);
    }
  }
  return shuffle(picked, rnd);
}