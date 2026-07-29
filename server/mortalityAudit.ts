// ============================================================
// ErMate — Mortality Audit System
// CONFIDENTIAL — M&M Committee Use Only
// File: server/mortalityAudit.ts
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

// ── The extraction prompt ─────────────────────────────────────
export const MORTALITY_AUDIT_PROMPT = `
You are a senior emergency medicine consultant
conducting a formal mortality audit (M&M review)
for an Indian hospital.

This is a CONFIDENTIAL MEDICO-LEGAL document
for internal quality improvement only.
It is NOT for disclosure outside the institution.

The EMR text below is the complete hospital record.
It may be in REVERSE chronological order.
Read the ENTIRE document before generating the audit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACT AND ANALYSE THESE SECTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

patientInfo:
  name, ageSex, allergy
  dateAdmission: first entry date
  dateDeath: from death/deceased note
  timeOfDeath: from death note
  totalStayDays: calculate from above
  admittingTeam: primary specialty + doctor
  icuTeam: if ICU involved
  emTeam: EM resident + consultant

presentingComplaintAtAdmission:
  The original complaint that brought
  patient to hospital.
  From the EARLIEST entry.

pastHistory:
  All comorbidities
  All surgical history with dates

diagnosisAtDeath:
  Final diagnosis from last clinical notes.
  All active conditions at time of death.

hospitalCourse:
  Write a structured chronological narrative.
  Each paragraph = one phase of the illness.
  Include:
  - Admission presentation and initial workup
  - Key investigation findings and dates
  - Major clinical events with dates
  - Procedures performed with dates
  - Deterioration events
  - Resuscitation if any
  - Goals of care discussion
  - Death circumstances
  
  Write in formal past tense.
  Use paragraph format — NOT bullet points.
  Be comprehensive — this is a medico-legal record.

causeOfDeath:
  immediate: The terminal event
  underlying: The root pathology
  precipitating: What triggered the terminal event
  contributing: string[] — all contributing factors

clinicalDecisionReview:
  Array of decisions made during the admission.
  For each decision:
  {
    decision: what was decided and when
    assessment: "APPROPRIATE" | "APPROPRIATE_WITH_DELAY" |
                "REQUIRES_DISCUSSION" | "NOT_DOCUMENTED"
    rationale: why you assessed it this way
    question: any question this raises for M&M discussion
  }
  
  Review: diagnosis, investigations, timing of
  interventions, consultations, procedures,
  escalation of care, goals of care,
  documentation quality.

keyAuditQuestions:
  string[] — specific questions for M&M discussion.
  These are the most important learning points.
  Phrase as questions to encourage discussion.
  Maximum 6 questions.

preventabilityAssessment:
  category: "NON_PREVENTABLE" |
            "POTENTIALLY_PREVENTABLE" |
            "PREVENTABLE"
  rationale: explain why this category

systemIssuesIdentified:
  string[] — gaps in processes, protocols,
  documentation, communication, or systems
  that may have contributed.
  Be specific and constructive.

learningPoints:
  string[] — specific actionable lessons
  for the clinical team.
  Maximum 6 points.
  Each must be practical and specific.

references:
  string[] — relevant clinical guidelines,
  textbooks, or landmark papers.
  Only cite real, verifiable references.
  Format: "Author/Organisation. Title. Year."
  Maximum 5 references.
  If uncertain of exact citation → omit it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER invent clinical findings not in the EMR.
NEVER fabricate test results or timelines.
NEVER assign blame to individual clinicians —
  focus on systems and processes.
NEVER use patient-identifiable information
  beyond name and age (as in the original record).
ALWAYS be constructive and educational.
ALWAYS acknowledge what was done well.
ALWAYS cite dates from the actual EMR.
If information is absent → state "not documented"
  rather than assuming.

Return strict JSON only. No markdown fences.

{
  "patientInfo": {
    "name": string,
    "ageSex": string,
    "allergy": string | null,
    "dateAdmission": string,
    "dateDeath": string,
    "timeOfDeath": string,
    "totalStayDays": number,
    "admittingTeam": string,
    "icuTeam": string | null,
    "emTeam": string | null
  },
  "presentingComplaintAtAdmission": string,
  "pastHistory": string,
  "diagnosisAtDeath": string[],
  "hospitalCourse": string,
  "causeOfDeath": {
    "immediate": string,
    "underlying": string,
    "precipitating": string,
    "contributing": string[]
  },
  "clinicalDecisionReview": [
    {
      "decision": string,
      "assessment": string,
      "rationale": string,
      "question": string | null
    }
  ],
  "keyAuditQuestions": string[],
  "preventabilityAssessment": {
    "category": string,
    "rationale": string
  },
  "systemIssuesIdentified": string[],
  "learningPoints": string[],
  "references": string[]
}

COMPLETE EMR TEXT:
"""
\${emrText}
"""
`;

// Helper to clean JSON string
function cleanJsonResponse(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// ── Main function ─────────────────────────────────────────────
export async function generateMortalityAudit(
  rawText: string,
  hospitalName: string = "Hospital"
): Promise<{
  success: boolean;
  audit?: Record<string, any>;
  error?: string;
}> {
  // Preprocess raw EMR text
  const cleaned = rawText
    .replace(/Acknowledged By\s*:.*$/gim, "")
    .replace(/Acknowledged DateTime\s*:.*$/gim, "")
    .replace(/VIP SCORE.*$/gim, "")
    .replace(/.*WITHOUT ANY.*DAMAGE.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const prompt = MORTALITY_AUDIT_PROMPT.replace("${emrText}", cleaned);

  // 1. Try Anthropic SDK if ANTHROPIC_API_KEY is available
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== "") {
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-200000",
        max_tokens: 8096,
        temperature: 0.0,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = (msg.content[0] as any)?.text || "";
      const cleanedJson = cleanJsonResponse(raw);
      const audit = JSON.parse(cleanedJson);
      return { success: true, audit };
    } catch (err: any) {
      console.warn("[MortalityAudit] Anthropic API failed, falling back to Gemini:", err?.message || err);
    }
  }

  // 2. Gemini fallback / Primary Engine using @google/genai
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is available.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text || "";
    const cleanedJson = cleanJsonResponse(raw);
    const audit = JSON.parse(cleanedJson);
    return { success: true, audit };
  } catch (err: any) {
    console.error("[MortalityAudit] Generation error:", err?.message || err);
    return {
      success: false,
      error: "Could not generate mortality audit — please try again. " + (err?.message || ""),
    };
  }
}
