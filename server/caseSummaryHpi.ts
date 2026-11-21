/**
 * server/caseSummaryHpi.ts
 *
 * Writes the History of Present Illness from the WHOLE recorded case, in the hospital's style
 * (Neeraj, 21 Nov 2026), e.g.:
 *   "The patient presented to the Emergency Department with complaints of fever with chills and
 *    breathing difficulty since today morning. He initially sought medical attention at a local
 *    hospital, where Inj. Lasix and symptomatic treatment were administered. The patient presented to
 *    our Emergency Department for further evaluation and management, as he is on regular follow-up
 *    with the Pulmonology department at our hospital."
 *
 * Safety:
 *  - Only recorded facts. Every number in the HPI must exist in the case (else the AI text is rejected).
 *  - Identifiers removed (deidentifyText) before any model sees the text; placeholders never reach the HPI.
 *  - Extraction cascade: GPT-4o-mini → Claude Haiku, temperature 0. No Gemini.
 *  - If no model is available: a plain template from the complaint and events, or nothing (the
 *    existing HPI is kept).
 */
import { deidentifyText } from "./deidentify.ts";

export interface HpiCaseInput {
  sex?: string | null;
  presentingComplaint?: string | null;
  symptoms?: string | null;
  events?: string | null;
  /** HPI dictated so far (may hold outside treatment / reason for coming). */
  currentHpi?: string | null;
  pastHistory?: string | null;
  surgicalHistory?: string | null;
  medications?: string | null;
  arrivalMode?: string | null;
  /** Free notes that may mention referral / treatment elsewhere. */
  notes?: string | null;
}

export interface HpiResult {
  hpi: string | null;
  source: "ai" | "template" | "none";
  reason?: string;
}

const FIELDS: [keyof HpiCaseInput, string][] = [
  ["presentingComplaint", "Presenting complaint"],
  ["symptoms", "Signs and symptoms"],
  ["events", "Events / onset / mechanism"],
  ["currentHpi", "History dictated so far"],
  ["pastHistory", "Past medical history"],
  ["surgicalHistory", "Surgical history"],
  ["medications", "Current medications"],
  ["arrivalMode", "Arrival mode"],
  ["notes", "Other notes"],
];

const str = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export function hasHistoryContent(input: HpiCaseInput): boolean {
  return [input.presentingComplaint, input.symptoms, input.events, input.currentHpi].some((v) => str(v).length > 0);
}

/** De-identified, labelled case text for the model. */
export function buildSafeCaseText(input: HpiCaseInput): string {
  return FIELDS
    .map(([k, label]) => {
      const v = str(input[k]);
      if (!v || k === "sex") return "";
      return `${label}: ${deidentifyText(v).deidentified}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
}

export function pronounFor(sex: unknown): "He" | "She" | null {
  const s = str(sex).toLowerCase();
  if (/^(m|male|man|boy)\b/.test(s)) return "He";
  if (/^(f|female|woman|girl)\b/.test(s)) return "She";
  return null;
}

export const HPI_SYSTEM_PROMPT = [
  "You write the History of Present Illness (HPI) for an Indian hospital emergency department case record.",
  "Write ONE paragraph of 2 to 6 sentences, past tense, formal clinical English, in this hospital's style:",
  "1) \"The patient presented to the Emergency Department with complaints of <complaints, each with its duration as recorded>.\"",
  "2) Onset, events or mechanism of injury, if recorded.",
  "3) Care taken before arrival, if recorded (where, and what was given).",
  "4) Why the patient came here (referral, follow-up, worsening), if recorded.",
  "5) Known conditions only if they are recorded AND relevant to the complaint.",
  "STRICT RULES:",
  "- Use ONLY facts written in the case. Never add symptoms, negatives, durations, doses, drugs, findings, diagnoses or reasons that are not written.",
  "- Do not include vitals, examination findings, investigations, ED treatment, diagnosis or plan.",
  "- Bracketed placeholders such as [PATIENT] or [HOSPITAL] are removed identifiers. Never copy them. Refer to the patient as \"the patient\" or the given pronoun; write \"a local hospital\" only if the case says the patient went to another hospital first.",
  "- Do not invent a hospital department, a time, or a number. Write durations and numbers exactly as written in the case.",
  "- Output the paragraph only: no heading, no quotes, no bullet points.",
].join("\n");

export function buildUserPrompt(safeText: string, pronoun: "He" | "She" | null): string {
  return `${pronoun ? `Pronoun for the patient: ${pronoun}.` : "Sex not recorded: use \"the patient\", never he or she."}\n\nCASE:\n"""\n${safeText}\n"""`;
}

/** Numbers in the HPI must all come from the case (guards against invented durations/doses). */
const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", "a couple of": "2", single: "1", once: "1", twice: "2",
};
export function numbersAreFromCase(hpi: string, caseText: string): boolean {
  const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) || []).map((n) => String(parseFloat(n)));
  const words = Object.entries(NUMBER_WORDS)
    .filter(([w]) => new RegExp(`\\b${w}\\b`, "i").test(caseText))
    .map(([, d]) => d);
  const allowed = new Set([...nums(caseText), ...words]);
  return nums(hpi).every((n) => allowed.has(n));
}

/** Cleans model output; returns null if it is unusable. */
export function cleanHpiOutput(raw: unknown, safeText: string): string | null {
  let t = str(raw)
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^(history of present(ing)? illness|hpi)\s*[:\-]\s*/i, "")
    .trim();
  if (!t) return null;
  t = t.replace(/\[(PATIENT|NAME|PT)[^\]]*\]/gi, "the patient");
  if (/\[[A-Za-z][A-Za-z0-9 _-]*\]/.test(t)) return null; // other placeholders leaked → reject
  if (t.length > 1500) return null;
  if (!numbersAreFromCase(t, safeText)) return null;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Plain template used only when no model is available and the case has no HPI yet. */
export function templateHpi(input: HpiCaseInput): string | null {
  const complaint = str(input.presentingComplaint) || str(input.symptoms);
  if (!complaint) return null;
  const c = complaint.replace(/[.\s]+$/, "");
  const lower = /^[A-Z][a-z]/.test(c) ? c.charAt(0).toLowerCase() + c.slice(1) : c;
  const parts = [`The patient presented to the Emergency Department with complaints of ${lower}.`];
  const ev = str(input.events).replace(/[.\s]+$/, "");
  if (ev && !c.toLowerCase().includes(ev.toLowerCase())) parts.push(`${ev.charAt(0).toUpperCase()}${ev.slice(1)}.`);
  return parts.join(" ");
}

export interface HpiModels {
  /** GPT-4o-mini (primary). Returns text or throws. */
  primary?: (system: string, user: string) => Promise<string>;
  /** Claude Haiku (fallback). Returns text or throws. */
  fallback?: (system: string, user: string) => Promise<string>;
}

export async function writeHpiFromCase(input: HpiCaseInput, models: HpiModels): Promise<HpiResult> {
  if (!hasHistoryContent(input)) return { hpi: null, source: "none", reason: "no history recorded" };
  const safeText = buildSafeCaseText(input);
  const user = buildUserPrompt(safeText, pronounFor(input.sex));

  for (const [name, call] of [["gpt-4o-mini", models.primary], ["claude-haiku", models.fallback]] as const) {
    if (!call) continue;
    try {
      const out = cleanHpiOutput(await call(HPI_SYSTEM_PROMPT, user), safeText);
      if (out) return { hpi: out, source: "ai" };
      console.warn(`[HPI from case] ${name} output rejected by safety checks`);
    } catch (e: any) {
      console.warn(`[HPI from case] ${name} failed:`, e?.message || e);
    }
  }
  // No usable AI text: never replace an HPI the case already has.
  if (str(input.currentHpi)) return { hpi: null, source: "none", reason: "AI unavailable; existing HPI kept" };
  const t = templateHpi(input);
  return t ? { hpi: t, source: "template" } : { hpi: null, source: "none", reason: "nothing to write" };
}

/** Real model callers (used by the route). */
export function defaultHpiModels(getAnthropic: () => any): HpiModels {
  return {
    primary: process.env.OPENAI_API_KEY
      ? async (system, user) => {
          const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
            body: JSON.stringify({
              model: "gpt-4o-mini", temperature: 0, max_tokens: 500,
              messages: [{ role: "system", content: system }, { role: "user", content: user }],
            }),
          });
          if (!r.ok) throw new Error(`OpenAI ${r.status}`);
          const j: any = await r.json();
          return String(j?.choices?.[0]?.message?.content || "");
        }
      : undefined,
    fallback: async (system, user) => {
      const anthropic = getAnthropic();
      if (!anthropic) throw new Error("Anthropic not configured");
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 500, temperature: 0,
        system, messages: [{ role: "user", content: user }],
      });
      return String((msg?.content?.[0] as any)?.text || "");
    },
  };
}