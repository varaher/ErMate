// ============================================================
// ErMate — Mortality Audit System
// CONFIDENTIAL — M&M Committee Use Only
// File: server/mortalityAudit.ts
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { deidentifyText } from "./deidentify.ts";
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, 
  WidthType, BorderStyle, AlignmentType, ShadingType 
} from "docx";

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
  phiProtected?: { count: number; phiFound: string[]; details: Record<string, number> };
  error?: string;
}> {
  // DPDP Act 2023 On-The-Fly PHI De-identification (Local India Cloud Run)
  const phiResult = deidentifyText(rawText);
  if (phiResult.phiCount > 0) {
    console.log(`[MortalityAudit] DPDP Protection Active: Stripped ${phiResult.phiCount} PHI item(s)`);
  }

  // Preprocess de-identified EMR text
  const cleaned = phiResult.deidentified
    .replace(/Acknowledged By\s*:.*$/gim, "")
    .replace(/Acknowledged DateTime\s*:.*$/gim, "")
    .replace(/VIP SCORE.*$/gim, "")
    .replace(/.*WITHOUT ANY.*DAMAGE.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const prompt = MORTALITY_AUDIT_PROMPT.replace("${emrText}", cleaned);

  const phiProtected = {
    count: phiResult.phiCount,
    phiFound: phiResult.phiFound,
    details: phiResult.details
  };

  // 1. Primary Model: Claude Sonnet
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.trim() !== "" && anthropicKey !== "MY_ANTHROPIC_API_KEY") {
    try {
      console.log("[MortalityAudit] Attempting primary model: Claude Sonnet...");
      const anthropic = new Anthropic({
        apiKey: anthropicKey,
      });

      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8096,
        temperature: 0.0,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = (msg.content[0] as any)?.text || "";
      const cleanedJson = cleanJsonResponse(raw);
      const audit = JSON.parse(cleanedJson);
      return { success: true, audit, phiProtected };
    } catch (err: any) {
      console.warn("[MortalityAudit] Claude Sonnet primary failed, trying fallback:", err?.message || err);
    }
  }

  // 2. Fallback Model: GPT-4o
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== "") {
    try {
      console.log("[MortalityAudit] Attempting fallback model: GPT-4o...");
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a senior emergency medicine consultant producing a confidential medico-legal M&M mortality audit in strict JSON format.",
          },
          { role: "user", content: prompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content || "";
      const cleanedJson = cleanJsonResponse(raw);
      const audit = JSON.parse(cleanedJson);
      return { success: true, audit, phiProtected };
    } catch (err: any) {
      console.warn("[MortalityAudit] GPT-4o fallback failed:", err?.message || err);
    }
  }

  // 3. Fallback Model: Gemini Candidates (gemini-2.0-flash / gemini-1.5-flash)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const geminiCandidates = ["gemini-2.0-flash", "gemini-1.5-flash"];
    
    for (const modelCandidate of geminiCandidates) {
      try {
        console.log(`[MortalityAudit] Attempting fallback model: ${modelCandidate}...`);
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents: prompt,
          config: {
            temperature: 0.0,
            responseMimeType: "application/json",
          },
        });

        const raw = response.text || "";
        const cleanedJson = cleanJsonResponse(raw);
        const audit = JSON.parse(cleanedJson);
        if (audit && typeof audit === "object") {
          return { success: true, audit, phiProtected };
        }
      } catch (err: any) {
        console.warn(`[MortalityAudit] Gemini candidate ${modelCandidate} failed:`, err?.message || err);
      }
    }
  }

  // If both Claude Sonnet and GPT-4o fail or are unavailable:
  console.error("[MortalityAudit] Both Claude Sonnet and GPT-4o failed or lack API keys.");
  return {
    success: false,
    error: "Audit generation unavailable. Please try again later.",
  };
}

// ── Word Document (.docx) Generator for Mortality Audit ────────
export async function generateMortalityAuditDocx(audit: Record<string, any>): Promise<Buffer> {
  const info = audit.patientInfo || {};
  const cause = audit.causeOfDeath || {};
  const preventability = audit.preventabilityAssessment || {};

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header
          new Paragraph({
            text: "CONFIDENTIAL MEDICO-LEGAL RECORD — FOR INTERNAL QUALITY IMPROVEMENT ONLY",
            heading: HeadingLevel.HEADING_3,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "FORMAL MORTALITY & MORBIDITY (M&M) AUDIT REPORT",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),

          // Patient Information Table
          new Paragraph({ text: "1. PATIENT INFORMATION", heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Patient Name / ID: ", bold: true }), new TextRun(info.name || "N/A")] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Age / Sex: ", bold: true }), new TextRun(info.ageSex || "N/A")] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date of Admission: ", bold: true }), new TextRun(info.dateAdmission || "N/A")] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date & Time of Death: ", bold: true }), new TextRun(`${info.dateDeath || "N/A"} (${info.timeOfDeath || ""})`)] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Stay (Days): ", bold: true }), new TextRun(String(info.totalStayDays ?? "N/A"))] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Known Allergies: ", bold: true }), new TextRun(info.allergy || "None Documented")] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "" }),

          // Presenting Complaint & Past History
          new Paragraph({ text: "2. CLINICAL PRESENTATION & PAST HISTORY", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: "Presenting Complaint: ", bold: true }), new TextRun(audit.presentingComplaintAtAdmission || "N/A")] }),
          new Paragraph({ children: [new TextRun({ text: "Past Medical / Surgical History: ", bold: true }), new TextRun(audit.pastHistory || "N/A")] }),
          new Paragraph({ text: "" }),

          // Diagnosis at Death
          new Paragraph({ text: "3. DIAGNOSES AT TIME OF DEATH", heading: HeadingLevel.HEADING_1 }),
          ...(Array.isArray(audit.diagnosisAtDeath)
            ? audit.diagnosisAtDeath.map((dx: string) => new Paragraph({ text: `• ${dx}` }))
            : [new Paragraph({ text: audit.diagnosisAtDeath || "N/A" })]),
          new Paragraph({ text: "" }),

          // Hospital Course
          new Paragraph({ text: "4. CHRONOLOGICAL HOSPITAL COURSE", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: audit.hospitalCourse || "N/A" }),
          new Paragraph({ text: "" }),

          // Cause of Death Breakdown
          new Paragraph({ text: "5. CAUSE OF DEATH DECONSTRUCTION", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: "Immediate Cause (Part I): ", bold: true }), new TextRun(cause.immediate || "N/A")] }),
          new Paragraph({ children: [new TextRun({ text: "Precipitating Cause: ", bold: true }), new TextRun(cause.precipitating || "N/A")] }),
          new Paragraph({ children: [new TextRun({ text: "Underlying Pathology: ", bold: true }), new TextRun(cause.underlying || "N/A")] }),
          new Paragraph({
            children: [
              new TextRun({ text: "Contributing Factors (Part II): ", bold: true }),
              new TextRun(Array.isArray(cause.contributing) ? cause.contributing.join("; ") : cause.contributing || "None"),
            ],
          }),
          new Paragraph({ text: "" }),

          // Preventability Assessment
          new Paragraph({ text: "6. PREVENTABILITY ASSESSMENT", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: "Category: ", bold: true }), new TextRun(preventability.category || "N/A")] }),
          new Paragraph({ children: [new TextRun({ text: "Rationale: ", bold: true }), new TextRun(preventability.rationale || "N/A")] }),
          new Paragraph({ text: "" }),

          // System Issues Identified
          new Paragraph({ text: "7. SYSTEM & PROCESS ISSUES IDENTIFIED", heading: HeadingLevel.HEADING_1 }),
          ...(Array.isArray(audit.systemIssuesIdentified)
            ? audit.systemIssuesIdentified.map((issue: string) => new Paragraph({ text: `• ${issue}` }))
            : [new Paragraph({ text: audit.systemIssuesIdentified || "None identified" })]),
          new Paragraph({ text: "" }),

          // Key Learning Points
          new Paragraph({ text: "8. KEY ACTIONABLE LEARNING POINTS", heading: HeadingLevel.HEADING_1 }),
          ...(Array.isArray(audit.learningPoints)
            ? audit.learningPoints.map((lp: string) => new Paragraph({ text: `• ${lp}` }))
            : [new Paragraph({ text: audit.learningPoints || "N/A" })]),
          new Paragraph({ text: "" }),

          // References
          new Paragraph({ text: "9. VERIFIABLE CLINICAL REFERENCES", heading: HeadingLevel.HEADING_1 }),
          ...(Array.isArray(audit.references)
            ? audit.references.map((ref: string) => new Paragraph({ text: `• ${ref}` }))
            : [new Paragraph({ text: audit.references || "N/A" })]),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
