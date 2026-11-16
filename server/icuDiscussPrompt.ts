/**
 * ICU thinking-partner prompts — used by /api/rounds-debrief (7-lens) and
 * /api/case-discussion (Discuss) when the client sends an ICU stay record.
 *
 * The record is built on the client by src/icu/icuDiscussContext.ts (no names,
 * UHID or calendar dates) and is de-identified AGAIN here before any LLM call (Rule 4).
 * Model routing is unchanged: the existing Claude Sonnet failover helpers are used (Rule 1).
 */
import { deidentifyText } from "./deidentify.ts";

const MAX_RECORD = 26_000;
const MAX_HISTORY_TURNS = 12;

export interface IcuChatPayload {
  icuRecord: string;
  patient?: { age?: number | null; gender?: string | null };
}

/** True when the request body carries an ICU stay record. */
export function isIcuPayload(data: any): data is IcuChatPayload {
  return !!data && typeof data === "object" && typeof data.icuRecord === "string" && data.icuRecord.trim().length > 0;
}

/** De-identified, length-capped ICU record text. */
export function safeIcuRecord(data: IcuChatPayload): string {
  const raw = String(data.icuRecord || "").slice(0, MAX_RECORD);
  return deidentifyText(raw).deidentified || "No ICU notes documented yet.";
}

const ICU_SAFETY_RULES = `
ABSOLUTE RULES FOR THIS ICU RECORD:
1. Use ONLY what is written in the record. "Not documented" means the doctor did not record it — never assume it is normal, never invent a value, dose, time, or finding.
2. When your reasoning needs a value that is not documented, say plainly that it is not documented and what it would change.
3. Items marked "[carried forward — not yet confirmed]" were copied from an earlier note; treat them as unconfirmed for today.
4. "(unit not stated)" temperatures: do not assume °C or °F.
5. Draft notes are not signed — say so if you rely on them.
6. Your answers are suggestions for the treating doctor. You never change the note; the doctor decides what to dictate.
7. Times are relative ICU days ("Day 3, 4 AM"). Do not invent calendar dates.
8. Do not refer to the patient by name or ID — say "this patient".`;

const SEVEN_LENSES = `
THE 7 CLINICAL LENSES:
1. First Principles — which organ systems are failing and why (oxygen delivery, perfusion, acid–base, clearance).
2. Pathophysiology — the disease process as it is evolving over this ICU stay.
3. Guidelines — critical-care evidence (Surviving Sepsis, ARDSNet, KDIGO, ESICM/SCCM, PADIS, etc.).
4. Devil's Advocate — challenge the working diagnosis: anchoring, premature closure, missed sources, iatrogenic causes.
5. Rare but Real — atypical causes and dangerous ICU complications (VAP, CLABSI, CAUTI, mesenteric ischaemia, HIT, adrenal insufficiency, abdominal compartment syndrome…).
6. Disease Snapshot — bedside priorities for today, targets, and classic ICU pitfalls.
7. Full Debrief / Cause of Death — whole-stay synthesis, or a structured mortality review if the patient died.`;

/** Full prompt for /api/rounds-debrief (JSON response, same schema as ER Rounds). */
export function buildIcuRoundsPrompt(args: {
  data: IcuChatPayload;
  userMessage: string;
  history: any[];
  lens?: string | null;
}): string {
  const record = safeIcuRecord(args.data);
  const hist = Array.isArray(args.history) ? args.history.slice(-MAX_HISTORY_TURNS) : [];
  const histText = hist
    .map((m: any) => {
      const who = m?.role === "user" || m?.sender === "user" ? "Doctor" : "Mentor";
      return `${who}: ${deidentifyText(String(m?.content || m?.text || "")).deidentified}`;
    })
    .join("\n\n");
  const ask = deidentifyText(args.userMessage || "").deidentified
    || (args.lens ? `Debrief this ICU patient through the ${args.lens} lens.` : "Prepare me for ICU rounds on this patient.");

  return `
You are a senior Critical Care consultant leading ICU teaching rounds for an intensivist, registrar or resident.

${record}

${ICU_SAFETY_RULES}

${SEVEN_LENSES}

Conversation so far:
${histText || "(none)"}

Doctor's current request:
"${ask}"
${args.lens && args.lens !== "auto" ? `\nRequested lens: ${args.lens} — focus on it and include it in "usedLenses".` : ""}

RESPONSE STYLE:
- Conversational teaching, not a report dump (unless a full debrief is asked for).
- Short direct answer, then 3–6 high-yield bullets tied to THIS patient's trajectory across the stay, then one teaching question when useful.
- Think in ICU terms: trajectory over days, organ support, lines and their days, de-escalation, FAST HUGS gaps, what must happen today.
- QUIZ MODE: if asked "Quiz me" or the doctor is answering a question — evaluate the answer briefly, then ask exactly ONE new question.
- CONSULTANT QUESTIONS: if asked to prepare teaching rounds — key objectives, 5–10 questions with expected answers and common mistakes.

Respond strictly in valid JSON:
{
  "content": "markdown teaching response",
  "usedLenses": ["First Principles"],
  "keyTakeaway": "one sentence",
  "suggestedQuestions": ["follow-up 1", "follow-up 2"]
}`;
}

export const ICU_ROUNDS_SYSTEM =
  "You are a senior Critical Care consultant and educator leading ICU rounds with zero fluff. Use only documented facts; never invent values. Return strictly valid JSON.";

/** Context block + system instruction for /api/case-discussion (free-text response, no record updates). */
export function buildIcuDiscussSystem(data: IcuChatPayload): string {
  const record = safeIcuRecord(data);
  return `
You are ErMate AI — senior Critical Care consultant and thinking partner. You are discussing ONE specific ICU patient with the treating doctor.

${record}

${ICU_SAFETY_RULES}

HOW TO ANSWER:
1. Answer the doctor's question directly, referencing this patient's documented trajectory across the stay (problems, support, results, lines, FAST HUGS).
2. Short, structured answers: bold key terms, brief bullets. No lecture on missing documentation unless asked ("what is missing?").
3. You may use the 7 lenses (first principles, pathophysiology, guidelines, devil's advocate, rare but real, snapshot, full debrief) when helpful, and say which you used.
4. Do NOT output any [UPDATE: ...] block — ICU notes are only changed by the doctor's own dictation.
5. Paediatric patient (age 16 or under): use paediatric ranges and weight-based dosing; if weight is not documented, say so instead of assuming.
6. Cite critical-care sources where appropriate (Surviving Sepsis, ARDSNet, KDIGO, Marino's The ICU Book, Oh's Intensive Care Manual).`;
}