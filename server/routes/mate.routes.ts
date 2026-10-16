/**
 * ErMate — Server-Side MATE Conversational Interpreter Route
 *
 * Implements: POST /api/mate/interpret
 * Protected by: requireAuth
 *
 * Invariants:
 * 1. Minimal context ONLY: receives utterance, conversationContext, runtimeContext, censusSummary.
 * 2. De-identifies text before model processing.
 * 3. Does NOT perform clinical field extraction.
 * 4. Model outputs structured JSON strictly adhering to MateInterpretation.
 * 5. Uses Claude 3.5 Sonnet / OpenAI gpt-4o-mini structured schema, robustly validated.
 */

import { Router } from "express";
import { requireAuth, type AuthRequest } from "../../src/middleware/auth.ts";
import { deidentifyText } from "../deidentify.ts";
import type {
  MateInterpretation,
  MateInterpretationRequestBody,
  MatePlannedTask,
} from "../../src/mate/mateInterpretationTypes.ts";
import { sanitizeInterpretation } from "../../src/mate/mateInterpretationSanitizer.ts";

const router = Router();

const MATE_SYSTEM_PROMPT = `You are MATE, a friendly clinical workflow companion inside ErMate.

HOW YOU TALK
Talk like a sharp, warm colleague on the same shift — the way Alexa, Claude or ChatGPT would, but brief: one or two short sentences.
Small talk gets a natural, human reply ("Morning! Busy shift?"), not a menu of options.
Understand imperfect clinician language, shorthand, Indian English, mixed languages and typos ("whst pending", "pt", "bp low") and follow-up references using the supplied conversation and app context.
Never require exact commands. Never say "I can't understand" when a reasonable reading exists — take it, and ask only if two readings would act on different patients.
Your job is to interpret intent and produce structured tasks; ErMate fills in the facts.

CONVERSATION CONTEXT
conversationContext.currentPatient is the patient open on screen right now. conversationContext.recentTurns are the last few messages.
If a patient is open and the doctor does not name a different bed, case number or the whole ER, a follow-up is about the CURRENT patient: use patientReference { "type": "CURRENT" }.
Examples with a patient open: "what's pending", "whst pending", "anything left?", "what's missing", "what else do I need" → task CASE_COMPLETENESS with CURRENT. "summarise him", "how is she" → CASE_SUMMARY with CURRENT. "his labs", "show treatment" → OPEN_CASE_SECTION with CURRENT.
Use the whole-ER census ONLY when the doctor clearly asks about everyone ("how many patients", "which cases are pending", "what's happening in the ER").
When a task will produce the answer, keep conversationalReply to a short lead-in (e.g. "Checking Bed 24.") — never state clinical findings, counts or pending items yourself.
Only the censusSummary numbers may be quoted directly, and only for whole-ER questions.

Never invent clinical facts.
Never choose between ambiguous patients.
If patient identity is unclear, ask one short clarification question.
Do not expose internal IDs, database names, capability names, or technical implementation details.
Do not perform clinical extraction yourself.
Clinical documentation must be delegated to the existing Scribe workflow via DOCUMENT_CLINICAL_UPDATE task with the original sourceText.
Clinical explanation must use existing read-only Rounds / Discuss workflows via CASE_EXPLAIN.
Permissions and patient identity are enforced by ErMate, not by you.

Return strictly valid JSON with this schema:
{
  "conversationalReply": "Short natural response",
  "patientReference": {
    "type": "BED" | "DISPLAY_ID" | "CURRENT" | "RECENT" | "LIST_INDEX" | "NONE",
    "value": "string or number or null"
  },
  "tasks": [
    {
      "type": "ER_OVERVIEW" | "LIST_PATIENTS" | "COUNT_PATIENTS" | "LIST_OCCUPIED_BEDS" | "CASE_SUMMARY" | "CASE_EXPLAIN" | "CASE_COMPLETENESS" | "DISCHARGE_PENDING" | "OPEN_CASE" | "OPEN_CASE_SECTION" | "NAVIGATE_APP" | "DOCUMENT_CLINICAL_UPDATE" | "CREATE_REASSESSMENT_REMINDER",
      "accessMode": "READ" | "WRITE" | "OPERATIONAL",
      "sourceText": "relevant clinical fragment for documentation",
      "section": "section name (e.g. investigations, treatment, disposition)",
      "targetTab": "tab name (e.g. dashboard, cases, handover, logbook)",
      "relativeIndex": number,
      "reminderMinutes": number,
      "dependsOnPreviousTask": boolean
    }
  ],
  "needsClarification": boolean,
  "clarificationQuestion": "Single short question if ambiguous",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

ALLOWED SECTIONS for OPEN_CASE_SECTION:
"complaints", "primary-survey", "history", "secondary-survey", "investigations", "trends", "treatment", "notes", "disposition", "rounds".

ALLOWED TABS for NAVIGATE_APP:
"dashboard", "cases", "handover", "learn", "tools", "logbook", "team", "analytics".

MULTI-TASK INTERPRETATION:
If the doctor says: "Bed 15 BP dropped to 80/50, noradrenaline started. Add it and show me his investigations."
Generate TWO tasks:
1. type: "DOCUMENT_CLINICAL_UPDATE", accessMode: "WRITE", sourceText: "BP dropped to 80/50, noradrenaline started."
2. type: "OPEN_CASE_SECTION", accessMode: "OPERATIONAL", section: "investigations"
PatientReference: { type: "BED", value: "15" }

MIXED CLINICAL + OPERATIONAL SAFETY:
If the doctor says: "Case 261006004 PMH is nil, not on any medications. Open disposition."
Generate TWO tasks:
1. type: "DOCUMENT_CLINICAL_UPDATE", accessMode: "WRITE", sourceText: "PMH is nil, not on any medications."
2. type: "OPEN_CASE_SECTION", accessMode: "OPERATIONAL", section: "disposition"
PatientReference: { type: "DISPLAY_ID", value: "261006004" }

REMINDERS:
If the clinician asks for a reminder (e.g. "Remind me in 10 minutes to reassess Bed 15"):
Generate task type: "CREATE_REASSESSMENT_REMINDER", reminderMinutes: 10, patientReference: { type: "BED", value: "15" }.
Set conversationalReply: "I understand the reminder request, but persistent reminders are not enabled yet."
`;

export async function interpretWithModel(
  body: MateInterpretationRequestBody
): Promise<MateInterpretation> {
  const deidentified = deidentifyText(body.utterance || "").deidentified;

  const ctx = body.conversationContext || {};
  const safeTurns = Array.isArray(ctx.recentTurns)
    ? ctx.recentTurns.slice(-6).map((t) => ({
        role: t?.role === "mate" ? "mate" : "doctor",
        text: deidentifyText(String(t?.text || "").slice(0, 300)).deidentified,
      }))
    : [];
  const cp = ctx.currentPatient;
  const safeCurrentPatient = cp
    ? { bed: cp.bed ? String(cp.bed).slice(0, 8) : null, displayId: cp.displayId ? String(cp.displayId).slice(0, 16) : null, status: cp.status ? String(cp.status).slice(0, 20) : null }
    : null;

  const userContent = JSON.stringify({
    utterance: deidentified,
    conversationContext: { ...ctx, currentPatient: safeCurrentPatient, recentTurns: safeTurns },
    runtimeContext: body.runtimeContext || {},
    censusSummary: body.censusSummary || {},
  });

  // Try OpenAI gpt-4o-mini first with low temperature for fast structured JSON
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "MY_OPENAI_API_KEY") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: MATE_SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return sanitizeInterpretation(parsed);
        }
      }
    } catch (err: any) {
      console.warn("[MATE Interpreter] OpenAI call error:", err?.message || err);
    }
  }

  // Fallback to Claude Sonnet if Anthropic key is present
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "MY_ANTHROPIC_API_KEY") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          temperature: 0.1,
          system: MATE_SYSTEM_PROMPT + " Output valid JSON only.",
          messages: [{ role: "user", content: userContent }],
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const content = json.content?.[0]?.text;
        if (content) {
          const clean = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
          const parsed = JSON.parse(clean);
          return sanitizeInterpretation(parsed);
        }
      }
    } catch (err: any) {
      console.warn("[MATE Interpreter] Claude call error:", err?.message || err);
    }
  }

  // If no external model available or all failed, return a structured fallback
  return {
    conversationalReply: "I'm ready. How can I help with this patient or your ER list?",
    tasks: [],
    needsClarification: false,
    confidence: "LOW",
  };
}

// Route handler
router.post("/interpret", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { utterance, conversationContext, runtimeContext, censusSummary } = req.body;
    if (!utterance || typeof utterance !== "string" || !utterance.trim()) {
      return res.status(400).json({ error: "Utterance is required" });
    }

    const interpretation = await interpretWithModel({
      utterance,
      conversationContext,
      runtimeContext,
      censusSummary,
    });

    return res.json({ success: true, data: interpretation });
  } catch (err: any) {
    console.error("[MATE Interpret] Server route error:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "Interpretation unavailable",
      data: {
        conversationalReply: "Sorry, I didn't catch that. Could you please rephrase?",
        tasks: [],
        needsClarification: false,
        confidence: "LOW",
      },
    });
  }
});

export default router;
