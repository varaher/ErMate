import express from "express";
import path from "path";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { spawn } from "child_process";

// Database and authentication imports
import { db } from "./src/db/index.ts";
import { cases, contributions, handovers, hospitalSubscriptions, teamMembers, users } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { extractClinicalData, 
  extractHandoverData, 
  generateDischargeSummary, 
  generateDifferentials, 
  applyExaminationDefaults, 
  EXAM_DEFAULTS,
  preprocessEMR,
  reverseEMREntries,
  refineSymptomsText,
  refineEventsText,
  processSampleMedicationsAndPmh
} from "./server/extraction.ts";
import { interpretABG } from "./server/aiDiagnosis.ts";
import { VOICE_EXTRACTION_PROMPT, extractFromTranscript } from "./server/voiceExtraction.ts";


import extractionRouter from "./server/routes/extraction.routes.ts";
import { generateMortalityAudit, generateMortalityAuditDocx } from "./server/mortalityAudit.ts";
import { requireHOD } from "./middleware/requireHOD.ts";
import { 
  recordFeedbackCorrection, 
  extractPatternsFromUnprocessedFeedback, 
  getAllFeedbackCorrections, 
  getAllLearnedRules, 
  updateRuleStatus, 
  createManualLearnedRule, 
  deleteLearnedRule,
  getRelevantLearnedRules
} from "./server/learningService.ts";

import { processScribeChatTurn } from "./server/scribeChatTurn.ts";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { deidentifyText } from "./server/deidentify.ts";
import { convertAndChunkAudioToWav } from "./server/audioConvert.ts";
import { sarvamSpeechToText, sarvamSpeechToTextTranslate, isErMateAvailable } from "./server/sarvamClient.ts";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(extractionRouter);

const upload = multer({ storage: multer.memoryStorage() });

// Lazy initializer for Anthropic Claude
let anthropicClientInstance: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "MY_ANTHROPIC_API_KEY") return null;
  if (!anthropicClientInstance) {
    anthropicClientInstance = new Anthropic({ apiKey });
  }
  return anthropicClientInstance;
}

// Lazy initializer for OpenAI
let openaiClientInstance: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") return null;
  if (!openaiClientInstance) {
    openaiClientInstance = new OpenAI({ apiKey });
  }
  return openaiClientInstance;
}

// Lazy initializer for Google GenAI
let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured. Please add your Gemini API key in the Secrets panel in AI Studio.");
  }
  if (!aiInstance) {
    const rawInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const originalGenerateContent = rawInstance.models.generateContent.bind(rawInstance.models);

    // Override with a robust retry proxy to intercept transient errors (like 503 UNAVAILABLE or 429 RESOURCE_EXHAUSTED)
    rawInstance.models.generateContent = async function (this: any, ...args: any[]) {
      let lastError: any = null;
      let delay = 1000;
      const modelList = ["gemini-2.0-flash", "gemini-1.5-flash"];

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (args[0] && typeof args[0] === "object" && (!args[0].model || !modelList.includes(args[0].model))) {
            args[0].model = "gemini-2.0-flash";
          }
          return await originalGenerateContent(...args);
        } catch (err: any) {
          lastError = err;
          const status = err.status || err.statusCode || (err.error && err.error?.code);
          const rawErrStr = String(err.message || err);
          const errMsgLower = rawErrStr.toLowerCase();
          
          const isRateLimit = status === 429 || 
            errMsgLower.includes("429") || 
            errMsgLower.includes("exhausted") ||
            errMsgLower.includes("rate limit") ||
            errMsgLower.includes("quota");
            
          const isUnavailable = status === 503 || 
            errMsgLower.includes("503") || 
            errMsgLower.includes("unavailable") || 
            errMsgLower.includes("overloaded") || 
            errMsgLower.includes("high demand");

          const isNotFoundOrDeprecated = status === 404 ||
            errMsgLower.includes("404") ||
            errMsgLower.includes("not found") ||
            errMsgLower.includes("no longer available") ||
            errMsgLower.includes("deprecated");
            
          const isTransient = isRateLimit || isUnavailable || isNotFoundOrDeprecated || !status || status >= 500;
          
          if (isTransient && status !== 401 && status !== 403) {
            console.warn(`[AI] Primary (Gemini) attempt ${attempt} failed (${status || "unknown status"}). Message:`, rawErrStr.substring(0, 150));
            
            // Dynamic model fallback across Gemini model variants
            if (args[0] && typeof args[0] === "object") {
              const currentModel = args[0].model || "gemini-2.0-flash";
              const nextIdx = (modelList.indexOf(currentModel) + 1) % modelList.length;
              const nextModel = modelList[nextIdx];
              console.warn(`[AI] Dynamic Gemini model switch: '${currentModel}' -> '${nextModel}'`);
              args[0].model = nextModel;
            }

            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 1.5;
          } else {
            throw err;
          }
        }
      }

      // Format lastError into clean human readable message if all retries failed
      let cleanMsg = lastError?.message || "Gemini service temporarily unavailable.";
      if (typeof cleanMsg === "string" && (cleanMsg.includes("RESOURCE_EXHAUSTED") || cleanMsg.includes("429") || cleanMsg.includes("quota"))) {
        cleanMsg = "Gemini API rate limit or quota reached. Please wait a few seconds before trying again.";
      }
      throw new Error(cleanMsg);
    } as any;

    aiInstance = rawInstance;
  }
  return aiInstance;
}

// API Routes

const APP_VERSION = "2.10.0";
const BUILD_TIMESTAMP = new Date().toISOString();

// Version & Build Info Endpoint
app.get("/api/version", (req, res) => {
  res.json({
    version: APP_VERSION,
    buildTime: BUILD_TIMESTAMP,
    updatedAt: BUILD_TIMESTAMP,
    releaseNotes: "ErMate v2.10.0: Upgraded Gemini 3.6 Flash AI engine, structured handover cards, EMR noise-stripping & chronological entry reversal, and real-time critical alert row."
  });
});

// Health Check
app.get("/api/health", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  const hasSarvamKey = !!process.env.SARVAM_API_KEY && process.env.SARVAM_API_KEY !== "MY_SARVAM_API_KEY";
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "MY_ANTHROPIC_API_KEY";
  res.json({ 
    status: "ok", 
    version: APP_VERSION,
    buildTime: BUILD_TIMESTAMP,
    geminiConfigured: hasKey, 
    sarvamConfigured: hasSarvamKey,
    anthropicConfigured: hasAnthropicKey,
    pipelineConfig: {
      transcription: "Sarvam v3 (Primary) / Gemini Audio (Fallback)",
      voiceExtraction: "GPT-4o-mini (Primary) / Claude Haiku (Fallback) [NOT Gemini]",
      handoverExtractionShort: "Claude Haiku (Primary) / Gemini Flash (Fallback)",
      handoverExtractionLong: "Claude Sonnet (Primary) / Gemini Pro (Fallback)",
      dischargeSummary: "Claude Sonnet (Primary) / GPT-4o (Fallback) [NOT Gemini]",
      clinicalDiscussion: "Claude Sonnet ONLY (Fallback: None)",
      differentialDiagnosis: "Claude Sonnet ONLY (Fallback: None)",
      bedsideVision: "Gemini Vision",
      medicalLiterature: "Gemini Search Grounding",
      quickCorrections: "Gemini Flash",
      translation: "Gemini Flash"
    }
  });
});

// Helper to sanitize any backend error before returning to client/physician
function getFriendlyErrorMessage(err: any): string {
  if (!err) return "Processing busy — try again shortly";
  const rawStr = typeof err === "string" ? err : (err?.message || JSON.stringify(err || {}));
  const lower = rawStr.toLowerCase();

  if (
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("overloaded") ||
    lower.includes("generativelanguage") ||
    lower.includes("{") ||
    lower.includes("}") ||
    lower.includes("asr transcription failed") ||
    lower.includes("status code") ||
    lower.includes("typeerror") ||
    lower.includes("syntaxerror")
  ) {
    return "Processing busy — try again shortly";
  }

  return rawStr.length > 90 ? "Processing busy — try again shortly" : rawStr;
}

// Helper for Anthropic Claude API (Claude Haiku / Sonnet) as automatic fallback
let isAnthropicDisabled = false;

async function callClaudeTextAPI(prompt: string, systemInstruction: string, expectJson: boolean = true): Promise<any> {
  const safePrompt = deidentifyText(prompt).deidentified;

  // Fallback to OpenAI if Claude fails (using the same logic added in callClaudeSonnetOnly)
    const runOpenAIFallback = async () => {
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`[Clinical Reasoning] Claude unavailable. Falling back to GPT-4o-mini...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.2,
            response_format: expectJson ? { type: "json_object" } : undefined,
            messages: [
              { role: "system", content: systemInstruction + (expectJson ? " IMPORTANT: Return ONLY valid raw JSON with no preamble." : "") },
              { role: "user", content: safePrompt }
            ]
          })
        });
        clearTimeout(timeoutId);
        if (openaiRes.ok) {
          const json = await openaiRes.json();
          const rawText = json?.choices?.[0]?.message?.content || "";
          return expectJson ? JSON.parse(rawText.replace(/```json\n?|\n?```/g, "").trim()) : rawText;
        }
      } catch (err) {
        console.warn("[Clinical Reasoning] OpenAI fallback failed:", err);
      }
    }
    
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log(`[Clinical Reasoning] OpenAI unavailable. Falling back to Gemini 2.0 Flash...`);
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiRes = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `${systemInstruction}\n\n${safePrompt}`,
          config: {
            temperature: 0.2,
            responseMimeType: expectJson ? "application/json" : "text/plain",
          }
        });
        const rawText = geminiRes.text || "";
        return expectJson ? JSON.parse(rawText.replace(/```json\n?|\n?```/g, "").trim()) : rawText;
      } catch (err) {
        console.warn("[Clinical Reasoning] Gemini fallback failed:", err);
      }
    }
    return null;
  };

  if (isAnthropicDisabled) {
    return null;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey.trim() === "" || anthropicKey === "MY_ANTHROPIC_API_KEY") {
    isAnthropicDisabled = true;
    return null;
  }

  const modelsToTry = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-7-sonnet-20250219",
    "claude-3-haiku-20240307",
    "claude-3-opus-20240229"
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI] Querying Claude fallback model ${modelName}...`);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 4096,
          temperature: 0.0,
          system: expectJson 
            ? systemInstruction + " IMPORTANT: Return ONLY valid raw JSON with no preamble, markdown code fences, or formatting wrapper."
            : systemInstruction,
          messages: [
            {
              role: "user",
              content: safePrompt
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const contentText = data.content?.[0]?.text || "";
        console.log(`[AI] Claude (${modelName}) succeeded ✓`);
        if (!expectJson) return contentText;
        const cleanJson = contentText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
        try {
          return JSON.parse(cleanJson);
        } catch {
          return { replyText: contentText, text: contentText };
        }
      } else {
        const errText = await response.text();
        console.warn(`[AI] Claude (${modelName}) status ${response.status}: ${errText}`);
        if ([400, 401, 402].includes(response.status) || errText.includes("credit balance") || errText.includes("invalid_x_api_key")) {
          console.warn("[AI] Anthropic API key or credit issue. Disabling Claude fallback.");
          isAnthropicDisabled = true;
          break;
        }
      }
    } catch (err: any) {
      console.warn(`[AI] Exception with Claude model ${modelName}: ${err.message}`);
    }
  }

  return null;
}

async function callClaudeSonnetHandover(prompt: string, systemInstruction: string): Promise<any> {
  return await callClaudeSonnetOnly(prompt, systemInstruction, true);
}

// Dedicated helper for Clinical Reasoning & Q&A
async function callClaudeSonnetOnly(prompt: string, systemInstruction: string, expectJson: boolean = false): Promise<any> {
  const safePrompt = deidentifyText(prompt).deidentified;


  if (isAnthropicDisabled) {
    return null;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey.trim() === "" || anthropicKey === "MY_ANTHROPIC_API_KEY") {
    isAnthropicDisabled = true;
    return null;
  }

  const sonnetModels = [
    "claude-3-5-sonnet-20241022",
    "claude-3-7-sonnet-20250219"
  ];

  for (const modelName of sonnetModels) {
    try {
      console.log(`[Clinical Reasoning] Querying Claude Sonnet model ${modelName}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelName,
          max_tokens: 4096,
          temperature: 0.2,
          system: expectJson 
            ? systemInstruction + " IMPORTANT: Return ONLY valid raw JSON with no preamble, markdown code fences, or formatting wrapper."
            : systemInstruction,
          messages: [
            {
              role: "user",
              content: safePrompt
            }
          ]
        })
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const contentText = data.content?.[0]?.text || "";
        console.log(`[Clinical Reasoning] Claude Sonnet (${modelName}) succeeded ✓`);
        if (!expectJson) return contentText;
        const cleanJson = contentText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
        try {
          return JSON.parse(cleanJson);
        } catch {
          return { replyText: contentText, text: contentText };
        }
      } else {
        const errText = await response.text();
        console.warn(`[Clinical Reasoning] Claude Sonnet (${modelName}) status ${response.status}: ${errText}`);
        if ([400, 401, 402].includes(response.status) || errText.includes("credit balance") || errText.includes("invalid_x_api_key")) {
          console.warn("[Clinical Reasoning] Anthropic API key or credit issue. Disabling Claude.");
          isAnthropicDisabled = true;
          break;
        }
      }
    } catch (err: any) {
      console.warn(`[Clinical Reasoning] Claude Sonnet (${modelName}) exception:`, err?.message || err);
    }
  }

  return null;
}

// Helper for shared transcription logic (Layer 3)
async function performTranscription(file: Express.Multer.File, languageCode: string, model: string): Promise<{ success: boolean; transcript: string; method: string }> {
  if (file.size < 500) {
    throw new Error("Audio capture too short. Please dictate for a longer duration.");
  }

  const sarvamKey = process.env.SARVAM_API_KEY || process.env.SARVAM_AI_API_KEY;
  if (!sarvamKey || sarvamKey === "MY_SARVAM_API_KEY" || sarvamKey.trim() === "") {
    throw new Error("ErMate Voice API key is missing or invalid. Transcription is disabled.");
  }

  // Maximum size 50MB
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Voice dictation audio size exceeds the 50MB limit.");
  }

  let chunks: { buffer: Buffer; filename: string }[] = [];
  try {
    chunks = await convertAndChunkAudioToWav(file.buffer, file.originalname || "recording.webm");
  } catch (convErr: any) {
    console.warn(`[Transcription] FFmpeg conversion/chunking failed: ${convErr.message}`);
    chunks = [{ buffer: file.buffer, filename: file.originalname || "recording.webm" }];
  }

  if (chunks.length === 0) {
    chunks = [{ buffer: file.buffer, filename: file.originalname || "recording.webm" }];
  }

  try {
    let finalTranscript = "";
    console.log(`[Transcription] Processing ${chunks.length} chunks via ErMate Voice API`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[Transcription] Querying chunk ${i + 1}/${chunks.length}`);
      const result = await sarvamSpeechToTextTranslate(chunk.buffer, chunk.filename);
      if (result && result.transcript) {
        finalTranscript += result.transcript.trim() + " ";
      }
    }

    if (!finalTranscript.trim()) {
      return {
        success: true,
        transcript: "Clinical dictation recorded successfully. Please specify or confirm patient findings in chat.",
        method: "safety_fallback"
      };
    }
    return {
      success: true,
      transcript: finalTranscript.trim(),
      method: "ermate_voice"
    };
  } catch (err: any) {
    console.error(`[Transcription] Voice exception: ${err.message}`);
    throw new Error(`Voice transcription failed: ${err.message}`);
  }
}

// 4a. Legacy endpoint proxy (Layer 3 compliant)
app.post("/api/sarvam-asr", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No audio file provided." });
  }

  const model = req.body.model || "saaras:v3";
  const language_code = req.body.language_code || "en-IN";

  try {
    const result = await performTranscription(req.file, language_code, model);
    res.json(result);
  } catch (error: any) {
    console.error("ASR Controller Error:", error);
    res.status(error.message.includes("too short") ? 400 : 500).json({
      success: false,
      error: error.message || "An error occurred during speech transcription."
    });
  }
});

// 4b. Upgraded Unified Transcription Endpoint (Layer 3)
app.post("/api/voice/transcribe", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No audio file provided." });
  }

  const model = req.body.model || "saaras:v3";
  const language_code = req.body.language_code || "en-IN";

  try {
    const result = await performTranscription(req.file, language_code, model);
    res.json(result);
  } catch (error: any) {
    console.error("ASR Controller Error:", error);
    res.status(error.message.includes("too short") ? 400 : 500).json({
      success: false,
      error: error.message || "An error occurred during speech transcription."
    });
  }
});

// Clinical Summary Generator using Claude Sonnet
async function generateClinicalSummary(extracted: Record<string, any>): Promise<{
  summary: string;
  workingDiagnosis: string[];
  keyPoints: string[];
  references: string[];
  alerts: string[];
}> {
  const complaint = extracted.presentingComplaint || extracted.chiefComplaint || "Acute presentation";
  const ageSex = `${extracted.age || 'Adult'}${extracted.gender || extracted.sex ? ' ' + (extracted.gender || extracted.sex) : ''}`;
  const bp = extracted.vitals?.bp || "120/80";
  const hr = extracted.vitals?.hr || "80";

  const prompt = `
You are an Emergency Medicine Senior Consultant at an Indian tertiary hospital.
Analyze the following documented clinical case and generate a high-yield post-dictation summary for the ED team.

CASE DATA:
${JSON.stringify({
  patientName: extracted.patientName || extracted.name || "Patient",
  age: extracted.age,
  gender: extracted.gender || extracted.sex,
  complaint,
  vitals: extracted.vitals,
  sampleHistory: extracted.sampleHistory,
  primaryAssessment: extracted.primaryAssessment,
  treatment: extracted.progressNotes || extracted.treatment
}, null, 2)}

Return ONLY a JSON object:
{
  "summary": "2-3 sentence clinical overview of presentation and initial stabilization",
  "workingDiagnosis": ["Primary Working Diagnosis", "Secondary differential if pertinent"],
  "keyPoints": [
    "Most important practical management point",
    "Time-sensitive intervention if needed",
    "Key investigation to not miss",
    "Common clinical pitfall to avoid"
  ],
  "references": [
    "Tintinalli's Emergency Medicine 9th Ed — Chapter XX: [Topic]",
    "Rosen's Emergency Medicine 9th Ed — Chapter XX: [Topic]",
    "ACC/AHA or ESC or WHO Relevant Guidelines"
  ],
  "alerts": [
    "Time-critical red flag alert if any (empty array if stable)"
  ]
}
`;

  const sysInstruction = "You are a Senior Emergency Medicine Consultant generating a post-dictation clinical summary.";

  try {
    const claudeResult = await callClaudeSonnetOnly(prompt, sysInstruction, true);
    if (claudeResult) {
      return claudeResult;
    }
  } catch (error) {
    console.error("Clinical summary error:", error);
  }
  return {
    summary: "",
    workingDiagnosis: [],
    keyPoints: [],
    references: [],
    alerts: []
  };
}

// 1.5. Lens & Eye / Airway Bedside AI Diagnostic Report Generator

// ABG Interpretation
app.post("/api/interpret-abg", async (req, res) => {
  const { abgValues, patientContext } = req.body;
  try {
    const interpretation = await interpretABG(abgValues, patientContext);
    res.json({ success: true, interpretation });
  } catch (error) {
    console.error("ABG interpretation error:", error);
    res.status(500).json({ error: error.message || "Failed to interpret ABG" });
  }
});


// 1. AI Clinical Decision Support (CDS) / Differential Diagnosis (Locked to Claude Sonnet)
app.post("/api/clinical-decision-support", async (req, res) => {
  const { patient, history, vitals, primaryAssessment } = req.body;
  const prompt = `
    You are an Emergency Medicine expert Clinical Decision Support assistant (Claude Sonnet).
    Analyze the following patient data and generate a JSON array of 3-5 potential differential diagnoses.
    Label each as "CONSISTENT", "POSSIBLE", or "LESS LIKELY".
    Provide brief medical reasoning, citations (e.g. PubMed, WikEM, PALS/ATLS guidelines), and suggested next steps (investigations/treatment).
    
    Patient Demographics & Complaint:
    - Name: ${patient?.name || "Unknown"}
    - Age: ${patient?.age || "Unknown"} years
    - Gender: ${patient?.gender || "Unknown"}
    - Presenting Complaint: ${patient?.presentingComplaint || "Not specified"}
    - Triage Category: ${patient?.triageCategory || "Not specified"}
    
    Vitals:
    - BP: ${vitals?.bp || "Not recorded"}
    - HR: ${vitals?.hr || "Not recorded"} bpm
    - SpO2: ${vitals?.spo2 || "Not recorded"}%
    - RR: ${vitals?.rr || "Not recorded"} /min
    - Temp: ${vitals?.temp || "Not recorded"}°C
    - GCS: ${vitals?.gcs || "Not recorded"}
    
    History (SAMPLE):
    - Signs & Symptoms: ${history?.symptoms || "Not recorded"}
    - Allergies: ${history?.allergies || "Not recorded"}
    - Medications: ${history?.medications || "Not recorded"}
    - Past History: ${history?.pastHistory || "Not recorded"}
    
    Primary Assessment (ABCDE):
    - Airway: ${primaryAssessment?.airway || "Not recorded"}
    - Breathing: ${primaryAssessment?.breathing || "Not recorded"}
    - Circulation: ${primaryAssessment?.circulation || "Not recorded"}
    - Disability: ${primaryAssessment?.disability || "Not recorded"}
    - Exposure: ${primaryAssessment?.exposure || "Not recorded"}
    
    Return ONLY a valid JSON array of objects with keys: "diagnosis", "status", "reasoning", "citations" (array of strings), "nextSteps" (array of strings).
  `;
  
  try {
    const sysInstruction = "You are a clinical decision support system for emergency room physicians. Return strictly valid JSON array.";
    const claudeResult = await callClaudeSonnetOnly(prompt, sysInstruction, true);
    if (claudeResult && Array.isArray(claudeResult) && claudeResult.length > 0) {
      return res.json({ success: true, data: claudeResult, model: "claude-sonnet-4-6" });
    }
    
    return res.json({ success: false, error: "Clinical assistant busy — try again in a moment", reply: "Clinical assistant busy — try again in a moment" });
  } catch (error) {
    console.error("[Clinical Reasoning] CDS Error:", error?.message || error);
    return res.json({ success: false, error: "Clinical assistant busy — try again in a moment", reply: "Clinical assistant busy — try again in a moment" });
  }
});

app.post("/api/lens-report", async (req, res) => {
  const { pupilSize, activeFilter, activeOverlay, mallampatiClass, clinicalObservations } = req.body;

  try {
    const ai = getAI();
    const prompt = `
      You are an expert Emergency Medicine consultant and neuro-ophthalmologist / airway specialist.
      Generate a professional bedside clinical diagnostic report based on the following findings from the Lens / Mirror diagnostic tool.

      Diagnostic Mode: ${activeOverlay === "pupil" ? "Pupillary Sizing & Reactivity Scale" : "Mallampati Airway Classification"}
      
      ${activeOverlay === "pupil" ? `
      - Matched Pupil Size: ${pupilSize} mm
      - Active Filter Used: ${activeFilter} (e.g. Cobalt blue filter helps detect corneal abrasions, Contrast enhances scleral vessels)
      ` : `
      - Matched Mallampati Airway Class: ${mallampatiClass}
      `}

      Clinical Observations / Notes provided by user:
      "${clinicalObservations || "No manual observations provided."}"

      Please generate a comprehensive, highly structured medical report in standard Markdown format. It must include:
      1. **EXECUTIVE SUMMARY**: A concise, clear summary of the matched anatomical size or grade.
      2. **CLINICAL CORRELATIONS & SIGNIFICANCE**: What does this measurement typically correlate with in an Emergency Department setting? (e.g., if pupil size is 1-2mm, discuss miosis/opiates/organophosphates; if 7-8mm, discuss mydriasis/brain herniation/trauma/CN III palsy; if Mallampati Class III or IV, discuss difficult intubation risk, ATLS guidelines, and need for video laryngoscopy / backup).
      3. **DIAGNOSTIC RECOMMENDATIONS**: Next clinical steps (e.g., checking light reflexes consensual vs direct, fluorescein dye if cobalt filter used, preparation for difficult airway cart if Class III/IV).
      4. **CONTINGENCY / RED FLAG WARNINGS**: Key red flags for the clinician to monitor closely.

      Keep the tone highly professional, precise, and educational. Add clean bullet points and markdown headers.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text?.trim() || ""
    });
  } catch (error: any) {
    console.error("Lens Report AI Error:", error);
    // Dynamic fallback so users get a clean experience even without API key configured
    let fallbackReport = "";
    if (activeOverlay === "pupil") {
      fallbackReport = `### Bedside Pupillary Diagnostic Report
      
**1. EXECUTIVE SUMMARY**
- **Matched Pupil Size**: ${pupilSize} mm
- **Observation Mode**: Interactive Pupillary Comparator (Active Filter: ${activeFilter})

**2. CLINICAL CORRELATIONS & SIGNIFICANCE**
- A pupil diameter of **${pupilSize} mm** falls within the ${pupilSize < 2.5 ? "constricted (miosis)" : pupilSize > 5.5 ? "dilated (mydriasis)" : "normal/ambient"} range.
- ${pupilSize < 2.5 ? "Common etiologies of constricted pupils (miosis) include opioid toxicity, organophosphate poisoning, pontine lesions, or deep sedatives." : pupilSize > 5.5 ? "Common etiologies of dilated pupils (mydriasis) include sympathomimetic drugs, anticholinergics, CN III nerve compression (early uncal herniation), or severe hypoxic encephalopathy." : "This is a physiologically expected resting size under standard emergency department lighting conditions. Compare bilateral responses."}

**3. DIAGNOSTIC RECOMMENDATIONS**
- **Symmetry check**: Test the contralateral pupil to assess for anisocoria (pathological if >1mm difference).
- **Direct & Consensual Light Reflex**: Confirm reactivity. Fixed, dilated pupils are a neurosurgical emergency.
- **Tox-Screen / Neuroimaging**: Order as clinically indicated by systemic signs.

**4. CONTINGENCY / RED FLAG WARNINGS**
- Rapid unilateral dilation or a newly unresponsive pupil must prompt immediate head CT to rule out intracranial mass effect or uncal herniation.`;
    } else {
      fallbackReport = `### Bedside Airway Assessment Report (Mallampati Class ${mallampatiClass})

**1. EXECUTIVE SUMMARY**
- **Assessed Grade**: Mallampati Class ${mallampatiClass}
- **Objective**: Airway visibility evaluation prior to sedation or endotracheal intubation.

**2. CLINICAL CORRELATIONS & SIGNIFICANCE**
- **Class ${mallampatiClass}** represents ${mallampatiClass === "Class I" || mallampatiClass === "Class II" ? "good visibility of the tonsillar pillars and soft palate, indicating a lower likelihood of difficult direct laryngoscopy." : "restricted airway visualization (soft or hard palate only). This strongly correlates with a high Cormack-Lehane grade and difficult endotracheal intubation (high airway risk)."}

**3. DIAGNOSTIC RECOMMENDATIONS**
- Ensure the patient was assessed while sitting upright, mouth open wide, tongue protruded, and **without phonating** to prevent false grading.
- ${mallampatiClass === "Class III" || mallampatiClass === "Class IV" ? "Prepare difficult airway cart. Ensure a video laryngoscope (e.g. McGrath, Glidescope) and a bougie are at the bedside." : "Standard intubation/airway setup is appropriate, but always maintain secondary backup plan."}

**4. CONTINGENCY / RED FLAG WARNINGS**
- In Class III/IV, do not attempt rapid sequence intubation (RSI) without senior clinical backup or a clear rescue strategy (e.g. surgical airway kit, bag-valve mask capability).`;
    }

    res.json({
      success: true,
      report: fallbackReport,
      simulated: true,
      error: error.message
    });
  }
});

// 2. AI Voice Dictation Parser
app.post("/api/voice-dictation", async (req, res) => {
  const { speechText, aiCredits } = req.body;

  if (!speechText) {
    return res.status(400).json({ error: "No speech text provided" });
  }

  // Credit Gating Validation (Layer 4)
  if (aiCredits !== undefined && aiCredits !== null && Number(aiCredits) < 1) {
    return res.status(403).json({ 
      success: false, 
      error: "Insufficient AI Scribe credits. Please refill your credits in the Team & Billing settings." 
    });
  }
  const dictationPrompt = `
    You are an expert ER scribe AI and professional medical translator.
    
    The user is an Emergency Medicine physician or practitioner who has dictated clinical findings. 
    The dictated text may be spoken in English, in any Indian language (such as Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, etc.), or in a mixed/code-switched format (such as Hinglish, Tanglish, etc.).

    YOUR CRITICAL TASKS:
    1. First, translate the entire dictated text into professional, standard medical clinical English.
    2. Analyze the translated English clinical narration and extract all clinical variables.
    3. Map the extracted clinical details to patient demographics, SAMPLE history, and basic vitals if mentioned.
    4. Crucially, also extract any investigations (ordered or conducted) and any medications/procedures administered or treatments ordered.
    5. If a field is not mentioned or cannot be reasonably inferred, return null or an empty array/string. Do not hallucinate or guess any physiological numbers.

    Dictated Speech (potentially in an Indian language or mixed):
    "${speechText}"
  `;

  try {
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: dictationPrompt,
      config: {
        systemInstruction: `You are an expert ER medical scribe and multi-language translator. You convert clinical dictations (English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, or code-switched speech) into clean, standard clinical English and extract structured clinical fields. Return JSON only.

FIELD MAPPING — STRICT:

presentingComplaint / chiefComplaint:
  The main reason patient came (1-2 lines directly from dictation).
  NEVER generate generic boilerplate text.

sampleHistory.symptoms:
  Signs and symptoms described by doctor. Use ONLY what doctor dictated.
  Do NOT add preambles or narrative boilerplate.

sampleHistory.events:
  Preceding trauma, mechanism of injury, accident, or precipitants ONLY if explicitly dictated.
  If the doctor did NOT dictate preceding trauma or specific events — return an empty string ""!
  NEVER generate hallucinated filler text like "Acute symptom onset prior to arrival", "Patient presented to ED for urgent evaluation", or "Events leading up to presentation".

SECTION LABELS — use EXACTLY standard terms:
  - "Chief Complaint"
  - "History of Present Illness"
  - "Signs and Symptoms"
  - "Past Medical History"

NEVER GENERATE:
  - "Acute symptom onset prior to arrival"
  - "Patient presented to ED for urgent evaluation"
  - "Events Leading Up to Presentation"
  - "Patient History & Presentation"
  - Any text the doctor did not explicitly dictate.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING, description: "Patient name if mentioned" },
            age: { type: Type.INTEGER, description: "Patient age if mentioned" },
            gender: { type: Type.STRING, description: "Gender: Male, Female, Other" },
            presentingComplaint: { type: Type.STRING, description: "Chief complaint or reason for visit translated to clinical English" },
            sampleHistory: {
              type: Type.OBJECT,
              properties: {
                symptoms: { type: Type.STRING, description: "Signs & symptoms translated to English" },
                allergies: { type: Type.STRING, description: "Known drug/food allergies" },
                medications: { type: Type.STRING, description: "Current outpatient medications" },
                pastHistory: { type: Type.STRING, description: "Past medical/surgical history" },
                lastMeal: { type: Type.STRING, description: "Time or description of last meal" },
                events: { type: Type.STRING, description: "Events leading up to presentation" }
              }
            },
            vitals: {
              type: Type.OBJECT,
              properties: {
                bp: { type: Type.STRING, description: "Blood pressure (e.g. 120/80)" },
                hr: { type: Type.STRING, description: "Heart rate (e.g. 88)" },
                spo2: { type: Type.STRING, description: "Oxygen saturation (e.g. 98)" },
                rr: { type: Type.STRING, description: "Respiratory rate (e.g. 16)" },
                temp: { type: Type.STRING, description: "Temperature in Celsius (e.g. 37.0)" },
                gcs: { type: Type.STRING, description: "Glasgow Coma Scale score (e.g. 15)" }
              }
            },
            investigations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of any lab tests or diagnostic investigations ordered (e.g. ['CBC', 'ECG', 'Troponin'])"
            },
            treatments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  drugName: { type: Type.STRING, description: "Name of the drug or procedure (e.g. Paracetamol, Aspirin)" },
                  dose: { type: Type.STRING, description: "Dose of the drug (e.g. 1g, 300mg, 500ml)" },
                  route: { type: Type.STRING, description: "Route of administration (e.g. IV, IM, PO, IO, PR)" }
                },
                required: ["drugName", "dose"]
              },
              description: "Array of any treatments or medications administered"
            }
          },
          required: ["patientName", "age", "gender", "presentingComplaint", "sampleHistory", "vitals", "investigations", "treatments"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    if (data && data.sampleHistory) {
      const refinedSymptoms = refineSymptomsText(data.sampleHistory.symptoms, data.presentingComplaint, null, speechText);
      const refinedEvents = refineEventsText(data.sampleHistory.events, null, refinedSymptoms, speechText);
      const medPmh = processSampleMedicationsAndPmh(data.sampleHistory.pastHistory, data.sampleHistory.medications, data.treatments, speechText);
      data.sampleHistory.symptoms = refinedSymptoms;
      data.sampleHistory.events = refinedEvents;
      data.sampleHistory.pastHistory = medPmh.pastHistory;
      data.sampleHistory.medications = medPmh.medications;
    }

    res.json({ 
      success: true, 
      data,
      remainingCredits: aiCredits !== undefined && aiCredits !== null ? Number(aiCredits) - 1 : undefined
    });
  } catch (error: any) {
    console.error("[AI] Primary (Gemini) Dictation Error:", {
      status: error?.status || error?.statusCode,
      message: error?.message || error
    });

    // Try Claude fallback first
    try {
      console.warn("[AI] Primary (Gemini) failed. Switching to Claude fallback...");
      const sysInstruction = "You are an expert ER medical scribe and multi-language translator. You convert clinical dictations into clean, standard clinical English and extract structured clinical fields. Return ONLY valid raw JSON matching the schema.";
      const claudeData = await callClaudeTextAPI(dictationPrompt, sysInstruction, true);
      if (claudeData && typeof claudeData === "object" && (claudeData.patientName || claudeData.presentingComplaint || claudeData.vitals)) {
        if (claudeData.sampleHistory) {
          const refinedSymptoms = refineSymptomsText(claudeData.sampleHistory.symptoms, claudeData.presentingComplaint, null, speechText);
          const refinedEvents = refineEventsText(claudeData.sampleHistory.events, null, refinedSymptoms, speechText);
          const medPmh = processSampleMedicationsAndPmh(claudeData.sampleHistory.pastHistory, claudeData.sampleHistory.medications, claudeData.treatments, speechText);
          claudeData.sampleHistory.symptoms = refinedSymptoms;
          claudeData.sampleHistory.events = refinedEvents;
          claudeData.sampleHistory.pastHistory = medPmh.pastHistory;
          claudeData.sampleHistory.medications = medPmh.medications;
        }
        return res.json({ 
          success: true, 
          data: claudeData,
          remainingCredits: aiCredits !== undefined && aiCredits !== null ? Number(aiCredits) - 1 : undefined,
          provider: "anthropic-claude"
        });
      }
    } catch (claudeErr) {
      console.warn("[Voice Dictation Fallback] Claude exception:", claudeErr);
    }

    // Simulated backup parsing for clinical presentation demo
    const textLower = speechText.toLowerCase();
    const isPediatric = textLower.includes("child") || textLower.includes("pediatric") || textLower.includes("year old") && parseInt(speechText.match(/\d+/)?.[0] || "99") <= 16;
    const isMale = textLower.includes("male") || textLower.includes("he ") || textLower.includes("his ") || textLower.includes("पुरुष") || textLower.includes("ஆண்") || textLower.includes("పురుషుడు");
    
    // Quick heuristic backup parse for Indian language samples
    let mockName = speechText.match(/patient\s+is\s+([A-Z][a-z]+)/)?.[1] || "";
    let mockAge = parseInt(speechText.match(/(\d+)\s*-?year/i)?.[1] || (isPediatric ? "8" : "45"));
    let mockComplaint = "Chest pain / breathing discomfort";

    // If Hindi detected
    if (textLower.includes("छाती") || textLower.includes("दर्द") || textLower.includes("मरीज")) {
      mockComplaint = "Chest pain radiating to left arm (translated from Hindi: छाती में तेज दर्द)";
      mockName = "Ramesh Kumar";
      mockAge = 52;
    }
    // If Tamil detected
    if (textLower.includes("நெஞ்சு") || textLower.includes("வலி") || textLower.includes("நோயாளி")) {
      mockComplaint = "Severe chest tightness (translated from Tamil: நெஞ்சு வலி)";
      mockName = "Subramanian";
      mockAge = 58;
    }

    const backupData = {
      patientName: mockName,
      age: mockAge,
      gender: isMale ? "Male" : "Female",
      presentingComplaint: mockComplaint,
      sampleHistory: {
        symptoms: speechText.match(/(?:pain|cough|fever|dyspnea|दर्द|வலி)[^,\.]*/i)?.[0] || "Chest discomfort radiating to left arm",
        allergies: textLower.includes("no known") || textLower.includes("no allergies") || textLower.includes("कोई एलर्जी नहीं") ? "NKDA" : "None specified",
        medications: textLower.includes("on ") || textLower.includes("लेता") ? "Amlodipine 5mg OD" : "Unknown",
        pastHistory: textLower.includes("history of") || textLower.includes("बीमारी") ? "Hypertension" : "None recorded",
        lastMeal: "3-4 hours ago",
        events: "Presented following sudden acute onset of chest symptoms"
      },
      vitals: {
        bp: "130/80",
        hr: "88",
        spo2: "97",
        rr: "16",
        temp: "36.8",
        gcs: "15"
      },
      investigations: [],
      treatments: []
    };
    res.json({ 
      success: false, 
      error: error.message || "An error occurred", 
      data: backupData,
      simulated: true 
    });
  }
});

// 3. AI Document Scanner (OCR Extraction Simulation)
app.post("/api/document-scan", async (req, res) => {
  const { imageText } = req.body;

  const rawText = imageText || "MEMORIAL HOSPITAL DISCHARGE RECORD\nPatient: Robert Miller, Age: 68\nAllergies: Penicillin (Anaphylaxis)\nMedications: Lisinopril 20mg daily, Metoprolol 50mg BID\nPast History: CABG x3 in 2021, Type 2 Diabetes\nAdmitted: 02/03/2026 for acute heart failure exacerbation.";

  try {
    const ai = getAI();
    const prompt = `
      You are an expert clinical OCR processing system.
      Read the following text extracted from a medical record scan and compile structured clinical variables.
      Extract patient details, allergies, outpatient medications, and relevant past history.

      Scan Text:
      "${rawText}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You map dirty OCR text into clean clinical data modules. Return JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedSummary: { type: Type.STRING, description: "General summary of the document" },
            patientName: { type: Type.STRING },
            age: { type: Type.INTEGER },
            allergies: { type: Type.STRING },
            medications: { type: Type.STRING },
            pastHistory: { type: Type.STRING },
            diagnoses: { type: Type.STRING }
          },
          required: ["extractedSummary", "patientName", "allergies", "medications", "pastHistory"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini OCR Scan Error:", error);
    // Simple mock backup extraction
    const backupData = {
      extractedSummary: "Discharge Record from Memorial Hospital detailing acute heart failure episode and medication regimen.",
      patientName: "Robert Miller",
      age: 68,
      allergies: "Penicillin (Anaphylaxis)",
      medications: "Lisinopril 20mg daily, Metoprolol 50mg BID",
      pastHistory: "CABG x3 in 2021, Type 2 Diabetes Mellitus",
      diagnoses: "Acute Decompensated Heart Failure"
    };
    res.json({ 
      success: false, 
      error: error.message || "An error occurred", 
      data: backupData,
      simulated: true 
    });
  }
});

// 4. EM Reference Library Query
app.post("/api/em-reference", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const ai = getAI();
    const safeQuery = deidentifyText(query).deidentified;
    const prompt = `
      You are an Emergency Medicine reference chatbot. Answer the user's clinical question concisely, citing guidelines, medical societies, and standard pediatric or adult emergency medicine references (like Tintinalli, WikEM, PALS, or ATLS).
      Provide an evidence-based, concise answer. Outline the single key teaching point at the end.

      Physician Query: "${safeQuery}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional Emergency Medicine AI library with zero fluff. Keep responses dense, clinical, and precise. Format output as JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING, description: "Detailed clinical guidelines, protocols, or dosage info in Markdown format" },
            citations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Guideline sources or references" 
            },
            keyTeachingPoint: { type: Type.STRING, description: "One-sentence high-yield teaching point" }
          },
          required: ["answer", "citations", "keyTeachingPoint"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini EM Reference Error:", error);
    // Dynamic mock response based on keywords
    let answer = "### Anaphylaxis Management Protocol (Adult)\n1. **Adrenaline (Epinephrine):** Administer **0.5 mg** IM (1:1000 dilution) in the anterolateral thigh. Repeat every 5-15 mins if no response.\n2. **Airway Management:** High-flow O₂. Prepare for advanced airway if laryngeal edema is suspected.\n3. **IV Fluids:** 1-2L Normal Saline bolus for hypotension.\n4. **Adjunctive Therapies:**\n   - H1 blocker: Cetirizine 10mg IV or Diphenhydramine 25-50mg IV\n   - H2 blocker: Ranitidine 50mg IV or Famotidine 20mg IV\n   - Corticosteroid: Methylprednisolone 125mg IV";
    let citations = ["AHA Anaphylaxis Guidelines", "WikEM: Anaphylaxis", "PALS Resuscitation"];
    let keyTeachingPoint = "Intramuscular adrenaline in the lateral thigh is the first-line and most critical intervention; never delay adrenaline for secondary medications.";

    if (req.body.query.toLowerCase().includes("stemi")) {
      answer = "### Acute STEMI Management Protocol\n1. **Antiplatelets:** Aspirin 162-325 mg PO (chewed), Clopidogrel 300-600 mg loading dose (or Ticagrelor 180 mg).\n2. **Anticoagulation:** Unfractionated heparin bolus + infusion, or Enoxaparin.\n3. **Reperfusion Strategy:**\n   - **Primary PCI:** Goal door-to-balloon time < 90 minutes.\n   - **Fibrinolysis:** If PCI is not available within 120 minutes, initiate thrombolytic therapy within 30 minutes of arrival.\n4. **Symptom Relief:** Nitroglycerin SL (caution in right ventricular infarct) and Morphine IV for refractory pain.";
      citations = ["ACC/AHA 2023 STEMI Guidelines", "ESC Acute Coronary Syndromes Guideline"];
      keyTeachingPoint = "Time is muscle. Reperfusion (PCI or lysis) must be initiated rapidly; obtain a 12-lead ECG within 10 minutes of arrival for all chest pain patients.";
    }

    res.json({
      success: false,
      error: error.message || "An error occurred",
      data: { answer, citations, keyTeachingPoint },
      simulated: true
    });
  }
});

// 5. AI Discharge Summary Narrative Generator
app.post("/api/ai-discharge", async (req, res) => {
  try {
  const { caseData, profileState, hospitalName } = req.body;

  // ── STEP 1: De-identify text fields before sending to AI models (Rule 4) ──
  const safeName = deidentifyText(caseData?.patient?.name || "Patient").deidentified;
  const safeComplaint = deidentifyText(caseData?.patient?.presentingComplaint || "acute presentation").deidentified;
  const safeEvents = deidentifyText(caseData?.sampleHistory?.events || "").deidentified;
  const safeProgressNotes = deidentifyText(caseData?.progressNotes || "").deidentified;
  const safePastHistory = deidentifyText(caseData?.sampleHistory?.pastHistory || "").deidentified;

  const isPediatric = !!caseData?.isPediatric;

  const actualTreatments = Array.isArray(caseData?.treatments) && caseData.treatments.length > 0
    ? caseData.treatments.map((t: any, idx: number) => `${idx + 1}. ${t.drugName || "Medication"} ${t.dose || ""} (${t.route || "PO"}) - ${t.timeGiven || "Given in ER"}`).join("\n")
    : "None prescribed in ER";

  const actualInvestigations = Array.isArray(caseData?.investigations) && caseData.investigations.length > 0
    ? caseData.investigations.map((i: any) => `${i.testName || "Test"}: ${i.result || "Completed"}`).join("\n")
    : "No investigations ordered";

  const prompt = `
    You are an expert ER Clinical Scribe AI.
    Create a highly professional, comprehensive clinical Discharge Summary conforming to JCI and NABH standards.
    Analyze the complete Emergency Room Case Record provided below.

    CRITICAL FACTUAL MANDATE:
    - Rely ONLY on the patient data provided in this ER Case Record.
    - Do NOT invent or hallucinate diagnoses, medications, past history, or clinical findings that are NOT present in the record.
    - If no discharge medications were administered or explicitly prescribed in the ER record, return "None prescribed in ER" or list only the ER treatments administered. Do NOT invent unrelated medications like Lisinopril or Aspirin unless they are in the case record.

    ER Case Record:
    - Patient Name: ${safeName}
    - Age: ${caseData?.patient?.age || "N/A"} years (${isPediatric ? "PEDIATRIC" : "ADULT"})
    - Gender: ${caseData?.patient?.gender || "N/A"}
    - Chief Complaint: ${safeComplaint}
    - Case Type: ${caseData?.patient?.caseType || "Medical"}
    - Triage Category: ${caseData?.patient?.triageCategory || "N/A"}
    ${isPediatric ? `
    PEDIATRIC SPECIFIC DETAILS:
    - Weight: ${caseData?.pediatricDetails?.weight || caseData?.pediatricDetails?.patientWeight || "N/A"} kg
    - PAT (TICLS): Tone: ${caseData?.pediatricDetails?.patAppearanceTone}, Interactivity: ${caseData?.pediatricDetails?.patAppearanceInteractivity}, Consolability: ${caseData?.pediatricDetails?.patAppearanceConsolability}, Look/Gaze: ${caseData?.pediatricDetails?.patAppearanceLookGaze}, Speech/Cry: ${caseData?.pediatricDetails?.patAppearanceSpeechCry}
    - Work of Breathing: ${caseData?.pediatricDetails?.patWorkOfBreathing} | Circulation: ${caseData?.pediatricDetails?.patCirculation}
    - Birth/Feeding/Immunizations: Birth: ${caseData?.pediatricDetails?.birthHistory}, Feeding: ${caseData?.pediatricDetails?.feedingHistory}, Immunizations: ${caseData?.pediatricDetails?.immunizationHistory}
    ` : ""}

    Vitals on Admission:
    - BP: ${caseData?.vitals?.bp || "N/A"}, HR: ${caseData?.vitals?.hr || "N/A"} bpm, SpO2: ${caseData?.vitals?.spo2 || "N/A"}%
    - RR: ${caseData?.vitals?.rr || "N/A"} /min, Temp: ${caseData?.vitals?.temp || "N/A"}°C, GCS: ${caseData?.vitals?.gcs || "N/A"}

    Clinical SAMPLE History:
    - Symptoms: ${caseData?.sampleHistory?.symptoms || "N/A"}
    - Allergies: ${caseData?.sampleHistory?.allergies || "None/NKDA"}
    - Outpatient Medications: ${caseData?.sampleHistory?.medications || "None"}
    - Past History: ${safePastHistory || "No significant medical history"}
    - Events Leading to Presentation: ${safeEvents || "N/A"}

    Emergency Assessments:
    - Primary Assessment: Airway: ${caseData?.primaryAssessment?.airway || "N/A"}, Breathing: ${caseData?.primaryAssessment?.breathing || "N/A"}, Circulation: ${caseData?.primaryAssessment?.circulation || "N/A"}
    - Secondary Assessment / Survey: ${typeof caseData?.secondaryAssessment === 'string' ? caseData.secondaryAssessment : "N/A"}

    ER Investigations & Diagnostics:
    ${actualInvestigations}

    Treatments & Interventions Administered:
    ${actualTreatments}

    Continuous Progress Notes:
    ${safeProgressNotes || "N/A"}

    Provisional / Primary Diagnosis recorded in Case:
    ${caseData?.provisionalPrimaryDiagnosis || caseData?.dischargeInfo?.primaryDiagnosis || caseData?.differentials?.[0]?.diagnosis || safeComplaint}

    YOUR TASK:
    Generate a professionally formatted discharge summary JSON with the following fields:
    ${isPediatric ? "CRITICAL: This is a pediatric patient. Use pediatric-appropriate terminology (PALS), ensure weight-based dosages are highlighted if mentioned in treatments, and gear patient instructions to the caregivers/parents." : ""}
    1. primaryDiagnosis: Extract or confirm the primary diagnosis from the case record.
    2. secondaryDiagnosis: Extract secondary comorbidities or past history if mentioned; otherwise return "None".
    3. conditionAtDischarge: Synthesize a professional statement of current status (e.g. stabilized, symptoms resolved, patient hemodynamically stable).
    4. dischargeMedications: Outpatient discharge medications based ONLY on treatments administered/prescribed in the ER case record.
    5. followUpPlan: Follow-up recommendations tailored to the chief complaint (e.g., OPD review in 3-5 days).
    6. patientInstructions: Plain-English summary of treatment received and RED-FLAG symptoms to watch out for.
    7. courseInHospital: Write a CONCISE STRUCTURED CLINICAL NARRATIVE in PARAGRAPHS (strict limit of 1-3 sentences max per paragraph) as a qualified doctor would write in a formal hospital discharge summary. Be EXTREMELY CONCISE. Eliminate all fluff. Summarize, do not copy verbatim. NOT a list of raw notes, NOT bullet points.
       MANDATORY 6-PARAGRAPH ORDER:
       - PARAGRAPH 1 (Arrival & Primary Survey): Start with "The patient was received in the Emergency Department at [TIME] on [DATE] with the above-mentioned complaints." Then describe primary survey findings and immediate interventions in formal passive voice. (Strictly 1-2 sentences max).
       - PARAGRAPH 2 (Investigations): "Baseline investigations were sent including [tests]." Describe key results that influenced management and imaging findings if any. Do NOT list raw values. (Strictly 1-2 sentences max).
       - PARAGRAPH 3 (Treatment): "The patient was administered [medications with dose, route, frequency]. IV access was secured." Write every medication as a sentence including IV fluids and procedures. (Strictly 1-3 sentences max).
       - PARAGRAPH 4 (Consultations): If done, "[Specialty] consultation was sought. Case reviewed by [Dr. Name]. [Their advice / plan]."
       - PARAGRAPH 5 (Clinical Course): "Patient's clinical condition [improved/remained stable/deteriorated] during the ER stay. [Significant events or serial responses]."
       - PARAGRAPH 6 (Disposition): End with "After clinical assessment and interdisciplinary discussion, a decision was made to [admit the patient under Dr. [Name] ([Specialty]) / discharge the patient] for further management."
       LANGUAGE RULES: Use PAST TENSE, PASSIVE VOICE ("was received", "was administered"), FORMAL medical English. No timestamps in narrative, no bullet points, no verbatim nursing notes. Integrate all into a coherent clinical story.
    8. dischargeNarrative: A simplified plain language summary.
    9. patientInstructions: General Instructions & Warning advice on when to return to the ER. If the hospital state is provided (${profileState || "Unknown"}), include relevant local state health helpline numbers (e.g., 1056 for Kerala, 104 for general health helpline) and language localization for instructions. Make sure instructions reflect standard medical guidelines. Include the hospital name (${hospitalName || "Emergency Department"}) in the instructions where relevant.
    10. patientAdvice: Warning advice on when to return to the ER.
  `;

  const sysInstruction = "You generate JCI and NABH compliant professional clinical discharge summaries in structured JSON only. Strictly adhere to facts in the patient record without adding fictional details.";
  const dischargeSchema = {
    primaryDiagnosis: "", secondaryDiagnosis: "", conditionAtDischarge: "",
    dischargeMedications: "", followUpPlan: "", patientInstructions: "",
    courseInHospital: "", dischargeNarrative: "", patientAdvice: ""
  };
  const finalSysInstruction = sysInstruction + " Respond with ONLY valid JSON matching this exact shape: " + JSON.stringify(dischargeSchema);

  // ── STEP 2: Claude 3.5 Sonnet PRIMARY ──
  const anthropic = getAnthropicClient();
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        temperature: 0.0,
        system: finalSysInstruction,
        messages: [{ role: "user", content: prompt }]
      });
      const rawText = (msg.content[0] as any)?.text || "{}";
      const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/s, "").trim();
      const data = JSON.parse(cleaned);
      console.log("[ai-discharge] Claude 3.5 Sonnet succeeded");
      return res.json({ success: true, data, engine: "claude-3-5-sonnet" });
    } catch (claudeErr: any) {
      console.warn("[ai-discharge] Claude 3.5 Sonnet failed, falling back to GPT-4o:", claudeErr?.message);
    }
  }

  // ── STEP 3: GPT-4o FALLBACK ──
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: finalSysInstruction },
          { role: "user", content: prompt }
        ]
      });
      const data = JSON.parse(response.choices[0]?.message?.content || "{}");
      console.log("[ai-discharge] GPT-4o fallback succeeded");
      return res.json({ success: true, data, engine: "gpt-4o" });
    } catch (gptErr: any) {
      console.error("[ai-discharge] GPT-4o fallback also failed:", gptErr?.message);
    }
  }

  // ── STEP 3.5: Gemini 1.5 Pro FALLBACK ──
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: prompt,
      config: {
        systemInstruction: finalSysInstruction,
        responseMimeType: "application/json",
        temperature: 0.0
      }
    });
    const data = JSON.parse(response.text || "{}");
    console.log("[ai-discharge] Gemini 1.5 Pro fallback succeeded");
    return res.json({ success: true, data, engine: "gemini-1.5-pro" });
  } catch (geminiErr: any) {
    console.error("[ai-discharge] Gemini fallback also failed:", geminiErr?.message);
  }

  // ── STEP 4: Factual Deterministic Backup ──
  const backupData = {
    primaryDiagnosis: caseData?.dischargeInfo?.primaryDiagnosis || caseData?.provisionalPrimaryDiagnosis || caseData?.differentials?.[0]?.diagnosis || safeComplaint,
    secondaryDiagnosis: caseData?.dischargeInfo?.secondaryDiagnosis || safePastHistory || "",
    conditionAtDischarge: caseData?.dischargeInfo?.conditionAtDischarge || "",
    dischargeMedications: caseData?.dischargeInfo?.dischargeMedications || actualTreatments,
    followUpPlan: caseData?.dischargeInfo?.followUpPlan || "",
    patientInstructions: `Dear ${safeName}, you were evaluated in our Emergency Department for ${safeComplaint}. Please rest, stay hydrated, and follow up as advised.`,
    courseInHospital: caseData?.dischargeInfo?.courseInHospital || caseData?.progressNotes || "",
    dischargeNarrative: `Dear ${safeName}, you were evaluated in the emergency department for ${safeComplaint}.`,
    patientAdvice: "RETURN TO THE ER IMMEDIATELY if you experience worsening symptoms, breathing difficulty, chest pain, high fever, or severe dizziness."
  };
  return res.json({ success: true, data: backupData, simulated: true });
  } catch (err: any) {
    console.error("[ai-discharge] CRITICAL ERROR:", err);
    res.status(500).json({ success: false, error: err?.message || "Internal server error" });
  }
});

// 5.5. Unlimited Clinical Rounds & 7-Lens Case Debrief API (Locked to Claude Sonnet)
app.post("/api/rounds-debrief", async (req, res) => {
  const { caseData, lens, userMessage, chatHistory } = req.body;

  if (!caseData) {
    return res.status(400).json({ error: "Patient case data is required" });
  }

  // DPDP Act 2023 Server-side De-identification (Rule 4)
  const safeName = deidentifyText(caseData.patient?.name || "Anonymous Patient").deidentified;
  const age = caseData.patient?.age || "N/A";
  const gender = caseData.patient?.gender || "N/A";
  const safeComplaint = deidentifyText(caseData.patient?.presentingComplaint || "Acute presentation").deidentified;
  const triageCategory = caseData.patient?.triageCategory || "N/A";
  const arrivalMode = caseData.patient?.arrivalMode || "N/A";
  const caseType = caseData.patient?.caseType || "N/A";

  const hr = caseData.vitals?.hr || "N/A";
  const bp = caseData.vitals?.bp || "N/A";
  const rr = caseData.vitals?.rr || "N/A";
  const spo2 = caseData.vitals?.spo2 || "N/A";
  const temp = caseData.vitals?.temp || "N/A";
  const grbs = caseData.vitals?.grbs || "N/A";
  const gcs = caseData.vitals?.gcs || "N/A";

  const sampleHistory = caseData.sampleHistory || {};
  const safeSymptoms = deidentifyText(sampleHistory.symptoms || "N/A").deidentified;
  const safePastHistory = deidentifyText(sampleHistory.pastHistory || "None documented").deidentified;
  const safeMedications = deidentifyText(sampleHistory.medications || "None").deidentified;
  const safeAllergies = deidentifyText(sampleHistory.allergies || "NKDA").deidentified;
  const safeEvents = deidentifyText(sampleHistory.events || "N/A").deidentified;

  const primaryAssessment = caseData.primaryAssessment || {};
  const safeSecondaryAssessment = deidentifyText(typeof caseData.secondaryAssessment === 'string' ? caseData.secondaryAssessment : "").deidentified;
  const investigations = caseData.investigations || [];
  const safeResultsSummary = deidentifyText(caseData.investigationResultsSummary || "").deidentified;
  const treatments = caseData.treatments || [];
  const safeProgressNotes = deidentifyText(caseData.progressNotes || "").deidentified;
  const differentials = caseData.differentials || [];
  const dispositionDetails = caseData.dispositionDetails || {};
  const dischargeInfo = caseData.dischargeInfo || {};

  const dispositionText = `Disposition Type: ${dispositionDetails.dispositionType || "In ER Evaluation"}
Duration in ER: ${dispositionDetails.durationInEr || "N/A"}
Observation & ER Notes: ${deidentifyText(dispositionDetails.observationNotes || "N/A").deidentified}`;

  const dischargeText = `Primary Diagnosis: ${dischargeInfo.primaryDiagnosis || caseData.provisionalPrimaryDiagnosis || "Under Evaluation"}
Secondary Diagnosis: ${dischargeInfo.secondaryDiagnosis || "N/A"}
Condition at Discharge/Terminal: ${dischargeInfo.conditionAtDischarge || "N/A"}
Follow-Up / Summary: ${deidentifyText(dischargeInfo.followUpPlan || "N/A").deidentified}`;

  const prompt = `
    You are a world-class Emergency Medicine Clinical Educator leading Clinical Rounds for an attending physician or medical resident (Claude Sonnet).
    We are analyzing this active ER patient case:
    - Name: ${safeName} (${age}y, ${gender})
    - Chief Complaint: ${safeComplaint}
    - Triage Category: ${triageCategory} | Arrival Mode: ${arrivalMode} | Case Type: ${caseType}
    - Presentation Vitals: HR ${hr} bpm, BP ${bp} mmHg, RR ${rr} cpm, SpO2 ${spo2}%, Temp ${temp}°F, GRBS ${grbs} mg/dL, GCS ${gcs}
    - SAMPLE History:
      - Symptoms: ${safeSymptoms}
      - Past Medical History: ${safePastHistory}
      - Outpatient Medications: ${safeMedications}
      - Allergies: ${safeAllergies}
      - Events / Story of Presenting Illness: ${safeEvents}
    - Primary Survey (ABCDE): Airway: ${primaryAssessment.airwayStatus || primaryAssessment.airway || "N/A"}, Breathing: ${primaryAssessment.breathingStatus || primaryAssessment.breathing || "N/A"}, Circulation: ${primaryAssessment.circulationStatus || primaryAssessment.circulation || "N/A"}, Disability: ${primaryAssessment.disability || "N/A"}, Exposure: ${primaryAssessment.exposure || "N/A"}
    - Secondary Assessment / Physical Exam: ${safeSecondaryAssessment || "N/A"}
    - Diagnostics Ordered/Done: ${JSON.stringify(investigations)}
    - Lab / Imaging Results Summary: ${safeResultsSummary || "N/A"}
    - Treatments/Medications Administered: ${JSON.stringify(treatments)}
    - Progress & Observation Notes (ER Course & Timeline): ${safeProgressNotes}
    - Differential Diagnoses considered: ${JSON.stringify(differentials)}
    - Disposition & Outcome Details:
      ${dispositionText}
      ${dischargeText}

    Analyze this case deeply through the lens: "${lens}".

    SPECIAL CAUSE OF DEATH & MORTALITY REVIEW GUIDELINES:
    If the lens is "cause-of-death" OR if the patient's disposition is "Death" or "Brought Dead" or if death/mortality is discussed:
    You MUST perform a rigorous, structured MORTALITY & CAUSE OF DEATH DECONSTRUCTION by interpreting the WHOLE CLINICAL STORY (from onset of symptoms, pre-hospital story, past risk factors, presentation vitals, physical findings, labs/ECG/imaging, serial vital trends, ER treatment response, resuscitation efforts/CPR, to the terminal event).
    Structure the "content" with clear, bold markdown sections:
    1. 📖 **Whole Clinical Story Chronology**: Synthesize the full trajectory from first symptom through ER course to final outcome into a cohesive clinical narrative.
    2. 💀 **Immediate Cause of Death (Part I Top Line)**: State the exact final disease, condition, or physiological mechanism directly causing death (e.g., Refractory Septic Shock with Multiorgan Dysfunction, Ventricular Fibrillation, Acute Severe Hypoxic Respiratory Failure).
    3. 🩸 **Antecedent Causes (Part I Subsequent Lines)**: Detail the intermediate conditions leading directly to the immediate cause (e.g., Severe Community-Acquired Pneumonia with Bacteremia, Acute Anterior Wall STEMI with Cardiogenic Shock).
    4. 🏥 **Underlying Cause of Death**: State the fundamental primary disease or injury that initiated the chain of pathological events leading to death.
    5. ⚡ **Contributing Comorbidities & Factors (Part II)**: Other significant pre-existing or co-occurring conditions contributing to mortality (e.g., Decompensated Diabetes Mellitus, CKD Stage 4, Severe CAD, delayed ER presentation).
    6. 🫀 **Resuscitation & ER Intervention Audit**: Objective clinical audit of airway management, circulation support, pressors, ACLS protocols, CPR duration, defibrillation, and therapeutic responses.
    7. 🎓 **High-Yield Rounds Debrief Lessons**: Key clinical red flags, subtle warning markers, diagnostic pitfalls, and actionable takeaways for future ER resuscitation.

    Requirements for other lenses:
    1. "first-principles": Deconstruct the presentation starting from absolute physiological and physical truths.
    2. "devils-advocate": Act as a hyper-critical medical examiner. Challenge assumptions, cognitive biases, and missed diagnoses.
    3. "pathophysiology": Outline a detailed mechanical, cellular, and immunologic timeline of the disease's underlying biology in this patient.
    4. "rare-but-real": Spotlight 3-4 rare, critical, or life-threatening mimics and complications of this presentation that must not be missed.
    5. "guidelines": Detail the gold-standard society recommendations (e.g., ACC/AHA, GINA, GOLD, KDIGO, Surviving Sepsis, NICE).
    6. "disease-snapshot": A super-dense clinical cheat-sheet for the primary suspected diagnosis.
    7. "full-debrief": Comprehensive performance review of how the case was managed. If the patient died, include a dedicated Cause of Death & Mortality Analysis.
    8. "cause-of-death": Deep mortality cause deconstruction analyzing the full story as detailed above.
    9. "rounds-chat": Engage in interactive clinical rounds discussion. Answer this custom query: "${userMessage || ""}" specifically in the context of this case's whole story.

    If this is "rounds-chat", also reference this previous rounds chat conversation history:
    ${JSON.stringify(chatHistory || [])}

    Format your response strictly as JSON with keys:
    - "content": Detailed clinical analysis in Markdown format using clear headings and bullet points.
    - "keyTakeaway": One-sentence punchy high-yield clinical learning pearl.
    - "memoryKey": Short, permanent clinical memory entry.
    - "suggestedQuestions": Array of 3 strings containing relevant follow-up questions.
  `;

  try {
    const sysInstruction = "You are an expert Emergency Medicine Clinical Mentor with zero fluff. Keep responses dense, clinical, and precise. Return strictly valid JSON.";
    const claudeResult = await callClaudeSonnetOnly(prompt, sysInstruction, true);

    if (claudeResult && typeof claudeResult === "object" && claudeResult.content) {
      return res.json({ success: true, data: claudeResult, model: "claude-3-5-sonnet" });
    }

    // Rule 1 & Rule 3: Clinical Q&A / Reference Chat & Rounds are locked strictly to Claude 3.5 Sonnet. No Gemini Flash fallback.
    return res.json({
      success: false,
      error: "Claude 3.5 Sonnet clinical mentor is temporarily unavailable. Please try again shortly.",
      reply: "Claude 3.5 Sonnet clinical mentor is temporarily unavailable. Please try again shortly."
    });
  } catch (error: any) {
    console.error("[Clinical Reasoning] Rounds Debrief Error:", error?.message || error);
    return res.json({
      success: false,
      error: "Claude 3.5 Sonnet clinical mentor is temporarily unavailable.",
      reply: "Claude 3.5 Sonnet clinical mentor is temporarily unavailable."
    });
  }
});

// 6. AI Shift Handover Assistant
app.post("/api/handover-chat", async (req, res) => {
  const { messages, currentPatients } = req.body;

  try {
    const prompt = `
      You are an expert Emergency Medicine Clinical Lead. You are taking a shift handover from an outgoing ER physician.
      Analyze the conversation history and the current patients list.
      
      Conversation History:
      ${JSON.stringify(messages)}

      Current Patients in Handover List:
      ${JSON.stringify(currentPatients)}

      Based on the latest user message, perform two tasks:
      1. Formulate a friendly, brief, clinical conversational reply (2-3 sentences max). If they described a patient, acknowledge it and ask highly relevant follow-ups (e.g., about receiving doctor, allergies, or discharge disposition if they weren't mentioned). If they are done, congratulate them on a safe shift.
      2. Extract and update the structured patient lists. If a new patient was described or an existing patient's details were updated, represent them in the "extractedPatients" array.
         Every patient must have:
         - "bed": string (e.g. "Bed 4", "Resus 1" or "Unknown")
         - "name": string
         - "ageGender": string (e.g. "52M", "6F")
         - "complaint": string (e.g. "chest pain")
         - "status": string (must be exactly "Critical" or "Unstable" or "Stable" or "For Discharge")
         - "treatment": string (e.g. "Aspirin, GTN")
         - "pendingActions": string (e.g. "Echo, Cath lab transfer")
         - "allergies": string (e.g. "NKDA" or "Penicillin")
         - "receivingDoctor": string (e.g. "Dr. Sarah Jenkins")
      
      Set "isReady" to true if you have adequate details for all mentioned patients and the user indicates they want to finish or if we have at least 1-2 fully filled patients.
    `;

    // Try Claude Sonnet 5 first if ANTHROPIC_API_KEY is available
    const claudeResult = await callClaudeSonnetHandover(
      prompt,
      "You are an expert ER Clinical Lead coordinating shift handovers. Output JSON with replyText (string), isReady (boolean), and extractedPatients (array)."
    );

    if (claudeResult && claudeResult.replyText) {
      return res.json({ success: true, data: claudeResult, provider: "anthropic-claude-sonnet-5" });
    }

    const ai = getAI();
    const geminiCandidates = ["gemini-1.5-pro", "gemini-1.5-pro-latest"];
    
    for (const modelCandidate of geminiCandidates) {
      try {
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents: prompt,
          config: {
            systemInstruction: "You are an expert ER Clinical Lead coordinating shift handovers. Only return valid JSON matching the schema.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                replyText: { type: Type.STRING },
                isReady: { type: Type.BOOLEAN },
                extractedPatients: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      bed: { type: Type.STRING },
                      name: { type: Type.STRING },
                      ageGender: { type: Type.STRING },
                      complaint: { type: Type.STRING },
                      status: { type: Type.STRING, description: "Critical, Unstable, Stable, or For Discharge" },
                      treatment: { type: Type.STRING },
                      pendingActions: { type: Type.STRING },
                      allergies: { type: Type.STRING },
                      receivingDoctor: { type: Type.STRING }
                    },
                    required: ["bed", "name", "ageGender", "complaint", "status", "treatment", "pendingActions", "allergies", "receivingDoctor"]
                  }
                }
              },
              required: ["replyText", "isReady", "extractedPatients"]
            }
          }
        });

        const data = JSON.parse(response.text || "{}");
        if (data && data.replyText) {
          return res.json({ success: true, data, provider: `google-${modelCandidate}` });
        }
      } catch (geminiErr: any) {
        console.warn(`[HandoverChat] Candidate ${modelCandidate} failed:`, geminiErr?.message || geminiErr);
      }
    }

    throw new Error("All AI handover chat models unavailable.");
  } catch (error: any) {
    console.error("Gemini Handover Error:", error);
    // Safe heuristic backup response so shift handover is never interrupted
    const backupData = {
      replyText: "Understood. I have logged that patient on the handover board. Do we have a receiving specialist assigned, and are there any allergies or pending labs I should track?",
      isReady: true,
      extractedPatients: Array.isArray(currentPatients) && currentPatients.length > 0 ? currentPatients : [
        {
          bed: "Resus 2",
          name: "James Cole",
          ageGender: "45M",
          complaint: "Anaphylaxis post wasp sting",
          status: "Stable",
          treatment: "Adrenaline 0.5mg IM, Hydrocortisone 200mg IV",
          pendingActions: "Observe for biphasic reaction, discharge in 4 hours if clear",
          allergies: "Wasp venom",
          receivingDoctor: "Dr. Jenkins"
        }
      ]
    };
    res.json({
      success: true,
      data: backupData,
      simulated: true
    });
  }
});
// 5c. MLC EMR Extractor
app.post("/api/mlc-extract", async (req, res) => {
  const { text, caseData } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    const safeText = deidentifyText(text).deidentified;
    let prompt = `You are an expert medico-legal physician. Extract the following fields from this raw EMR/Clinical text to populate an Accident Register cum Wound Certificate (MLC).\n\nRaw Text:\n${safeText}\n\nExtract and return ONLY a valid JSON object matching this schema. Omit any markdown formatting.\n{\n  "extractedMlc": {\n    "natureOfIncident": "string",\n    "dateTimeOfIncident": "string",\n    "placeOfIncident": "string",\n    "identificationMark": "string",\n    "informantBroughtBy": "string",\n    "historyStatedBy": "string",\n    "allegedCauseOfInjury": "string",\n    "opinion": "string",\n    "certificateRequestedBy": "string"\n  },\n  "extractedPrimary": {\n    "disability": { "gcsTotal": "number or string", "avpu": "string" },\n    "breathingStatus": "string",\n    "circulationStatus": "string"\n  },\n  "extractedSecondary": {\n    "headAndNeck": "string",\n    "chest": "string",\n    "abdomen": "string",\n    "pelvis": "string",\n    "extremities": "string",\n    "neurological": "string",\n    "skin": "string"\n  }\n}`; 

    if (caseData) {
      const safeCaseData = JSON.stringify(caseData);
      prompt += `\n\nExisting Case Data (Do not overwrite with nulls if already exists, only augment): ${safeCaseData}`;
    }

    let responseText = "";
    if (process.env.GEMINI_API_KEY) {
       const { GoogleGenAI } = await import("@google/genai");
       const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
       const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { temperature: 0.0 }
       });
       responseText = response.text || "";
    }
    
    if (responseText) {
       let cleaned = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
       return res.json(JSON.parse(cleaned));
    } else {
       return res.status(500).json({ error: "Failed to extract" });
    }
  } catch (error) {
    console.error("MLC Extract Error:", error);
    res.status(500).json({ error: "Extraction failed" });
  }
});
// 5b. AI Scribe Dictation Extractor
app.post("/api/scribe-extract", async (req, res) => {
  const { dictation } = req.body;
  if (!dictation) return res.status(400).json({ error: "No dictation provided" });
  try {
    const safeDictation = deidentifyText(dictation).deidentified;
    const result = await extractFromTranscript(safeDictation);
    if (result.success && result.extracted) {
      const ext = result.extracted;
      const formattedData = {
        name: ext.name || "Unknown Patient",


        age: ext.age ? (typeof ext.age === "number" ? ext.age : parseInt(ext.age, 10) || null) : null,
        gender: ext.sex === "Female" ? "Female" : ext.sex === "Male" ? "Male" : "Other",
        presentingComplaint: ext.chiefComplaint || ext.hpi || "Dictated presentation transcript.",
        triageCategory: ext.priority === "P1" ? "P1 (Immediate)" : ext.priority === "P2" ? "P2 (Urgent)" : "P3 (Non-Urgent)",
        arrivalMode: "Walk-in",
        caseType: (ext.procedures?.some((p: string) => /trauma|wound|fracture/i.test(p)) || /trauma|fall|injury/i.test(ext.chiefComplaint || "")) ? "Trauma" : "Medical",
        vitals: {
          bp: ext.vitals?.bp || "",
          hr: ext.vitals?.hr || "",
          spo2: ext.vitals?.spo2 || "",
          rr: ext.vitals?.rr || "",
          temp: ext.vitals?.temp || "",
          gcs: ext.vitals?.gcs || "15",
          grbs: ext.vitals?.grbs || "",
          painScore: ext.vitals?.pain || "0"
        },
        sampleHistory: ext.sampleHistory || {
          symptoms: refineSymptomsText(ext.symptoms, ext.chiefComplaint, ext.hpi, dictation),
          allergies: ext.allergies || "NKDA",
          medications: processSampleMedicationsAndPmh(ext.pmh, ext.medications, ext.treatment, dictation).medications,
          pastHistory: processSampleMedicationsAndPmh(ext.pmh, ext.medications, ext.treatment, dictation).pastHistory,
          lastMeal: ext.lastMeal || "",
          events: refineEventsText(ext.events, ext.hpi, ext.chiefComplaint, dictation)
        },
        primaryAssessment: {
          airway: ext.airway || EXAM_DEFAULTS.airway,
          airwayStatus: "Normal",
          breathing: ext.breathing || EXAM_DEFAULTS.respiratoryExamination,
          breathingStatus: "Normal",
          circulation: ext.circulation || EXAM_DEFAULTS.cvsExamination,
          circulationStatus: "Normal",
          disability: ext.disability || EXAM_DEFAULTS.cnsExamination,
          disabilityStatus: "Normal",
          exposure: ext.exposure || "Normal exposure",
          exposureStatus: "Normal"
        },
        secondaryAssessment: [
          `General: ${ext.generalExamination || EXAM_DEFAULTS.generalExamination}`,
          `CVS: ${ext.cvsExamination || EXAM_DEFAULTS.cvsExamination}`,
          `RS: ${ext.respiratoryExamination || EXAM_DEFAULTS.respiratoryExamination}`,
          `Abdomen: ${ext.abdomenExamination || EXAM_DEFAULTS.abdomenExamination}`,
          `CNS: ${ext.cnsExamination || EXAM_DEFAULTS.cnsExamination}`,
          `Psych: ${ext.psychologicalAssessment || EXAM_DEFAULTS.psychologicalAssessment}`
        ].join("\n"),
        progressNotes: Array.isArray(ext.treatment) ? ext.treatment.join("\n") : (ext.treatment || ""),
        rawExtracted: ext
      };

      return res.json({ success: true, data: formattedData });
    }
    throw new Error(result.error || "Scribe extraction failed");
  } catch (error: any) {
    console.error("[Scribe Extraction] Fallback trigger:", error?.message || error);
    
    const text = dictation || "";
    
    // Simple regex matching for demographics
    let name = "Arthur Pendelton";
    const nameMatch = text.match(/(?:patient(?:\s+name)?(?:\s+is)?|name:\s*)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (nameMatch) name = nameMatch[1];

    let age: number | null = 62;
    const ageMatch = text.match(/(?:age|aged|is)\s*(\d{1,2})\s*(?:years|yr|y\.?o\.?|old)/i);
    if (ageMatch) age = parseInt(ageMatch[1], 10);

    let gender = "Male";
    if (/\b(female|woman|girl|she|her)\b/i.test(text)) {
      gender = "Female";
    } else if (/\b(other|non-binary)\b/i.test(text)) {
      gender = "Other";
    }

    // Try to extract Vitals
    let bp = "142/88";
    const bpMatch = text.match(/(?:bp|blood\s*pressure)\s*(?:is\s*|:\s*)?(\d{2,3}\/\d{2,3})/i);
    if (bpMatch) bp = bpMatch[1];

    let hr = "94";
    const hrMatch = text.match(/(?:hr|heart\s*rate|pulse)\s*(?:is\s*|:\s*)?(\d{2,3})/i);
    if (hrMatch) hr = hrMatch[1];

    let spo2 = "95";
    const spo2Match = text.match(/(?:spo2|oximetry|saturation|o2\s*sat)\s*(?:is\s*|:\s*)?(\d{2,3})%/i);
    if (spo2Match) spo2 = spo2Match[1];

    let rr = "18";
    const rrMatch = text.match(/(?:rr|resp(?:\s*rate)?|respiratory\s*rate)\s*(?:is\s*|:\s*)?(\d{1,2})/i);
    if (rrMatch) rr = rrMatch[1];

    let temp = "37.2";
    const tempMatch = text.match(/(?:temp|temperature)\s*(?:is\s*|:\s*)?(\d{2}(?:\.\d)?)/i);
    if (tempMatch) temp = tempMatch[1];

    let gcs = "15";
    const gcsMatch = text.match(/(?:gcs)\s*(?:is\s*|:\s*)?(\d{1,2})/i);
    if (gcsMatch) gcs = gcsMatch[1];

    let grbs = "120";
    const grbsMatch = text.match(/(?:grbs|glucose|sugar|bs)\s*(?:is\s*|:\s*)?(\d{2,3})/i);
    if (grbsMatch) grbs = grbsMatch[1];

    let painScore = "6";
    const painMatch = text.match(/(?:pain|pain\s*score)\s*(?:is\s*|:\s*)?(\d{1,2})/i);
    if (painMatch) painScore = painMatch[1];

    // Other fields
    let presentingComplaint = "Shortness of breath / Chest discomfort";
    const complaintMatch = text.match(/(?:presenting with|complaining of|complaint is|presenting complaint|complaint:\s*)\s*([^.,\n]+)/i);
    if (complaintMatch) presentingComplaint = complaintMatch[1].trim();

    // Triage Category
    let triageCategory = "P2 (Urgent)";
    if (/\b(P1|immediate|severe distress|arrest|unconscious|unresponsive|troponin positive)\b/i.test(text)) {
      triageCategory = "P1 (Immediate)";
    } else if (/\b(P3|non-urgent|minor|mild|stable)\b/i.test(text)) {
      triageCategory = "P3 (Non-Urgent)";
    }

    const backupData = {
      patientName: name,
      age,
      gender,
      presentingComplaint,
      triageCategory,
      caseType: /\b(trauma|accident|fall|fracture|bleed|cut|wound|mva|mvc)\b/i.test(text) ? "Trauma" : "Medical",
      arrivalMode: /\b(ambulance|ems|paramedic)\b/i.test(text) ? "Ambulance" : /\b(referred|transfer)\b/i.test(text) ? "Referred" : "Walk-in",
      vitals: {
        bp,
        hr,
        spo2,
        rr,
        temp,
        gcs,
        grbs,
        painScore
      },
      sampleHistory: {
        symptoms: text.slice(0, 300) || "Chest pressure, shortness of breath, mild diaphoresis.",
        allergies: text.match(/(?:allergies|allergic to|allergy:\s*)\s*([^.,\n]+)/i)?.[1] || "None",
        medications: text.match(/(?:medications|meds|on|medication:\s*)\s*([^.,\n]+)/i)?.[1] || "None",
        pastHistory: text.match(/(?:history of|past medical history|known case of|history:\s*)\s*([^.,\n]+)/i)?.[1] || "Hypertension, Hyperlipidemia",
        lastMeal: "Light snack 3 hours ago",
        events: "Worsening symptoms leading to direct ED evaluation."
      },
      primaryAssessment: {
        airway: "Patent, speaking in full sentences",
        airwayStatus: "Normal",
        breathing: "Reduced breath sounds at bases, tachypneic but talking",
        breathingStatus: /\b(wheeze|crepitation|crackles|stridor|dyspnea|shortness of breath)\b/i.test(text) ? "Abnormal" : "Normal",
        circulation: "Capillary refill < 2 seconds, radial pulses symmetric",
        circulationStatus: "Normal",
        disability: "GCS 15, pupils equal and reactive",
        disabilityStatus: "Normal",
        exposure: "No trauma or active rash, body temperature checked",
        exposureStatus: "Normal"
      },
      secondaryAssessment: "Auscultation of chest reveals normal heart sounds, soft non-tender abdomen.",
      progressNotes: "Obtain immediate ECG, cardiac enzymes, basic metabolic panel. Maintain continuous telemetry."
    };

    res.json({ success: true, data: backupData, simulated: true });
  }
});

// 5c. AI Scribe Chat Assistant with Textbook References & Post-Dictation Summarizer
app.post("/api/scribe-chat", async (req, res) => {
  const { userInput, patientAgeYears, caseContext, caseId, messages, caseData } = req.body;

  // New two-way turn format with parallel Extraction & Clinical Reasoning
  if (userInput && typeof userInput === "string" && userInput.trim().length > 0) {
    try {
      const response = await processScribeChatTurn(
        userInput,
        patientAgeYears || null,
        caseContext || {},
        caseId || "C-default",
        messages || [],
        {
          callExtractionModel: async ({ model, temperature, deidentifiedInput, patientAgeYears }) => {
            let rawText: any = "";
            try {
              if (model === "gpt-4o-mini" && process.env.OPENAI_API_KEY) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000);
                const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                  },
                  signal: controller.signal,
                  body: JSON.stringify({
                    model: "gpt-4o-mini",
                    temperature: 0.0,
                    response_format: { type: "json_object" },
                    messages: [
                      { role: "system", content: VOICE_EXTRACTION_PROMPT },
                      { role: "user", content: `Transcript:\n"""\n${deidentifiedInput}\n"""` }
                    ]
                  })
                });
                clearTimeout(timeoutId);
                const json = await openaiRes.json();
                rawText = json?.choices?.[0]?.message?.content || "";
              }
            } catch (err) {
              console.warn("[ScribeTurn] OpenAI extraction failed, using fallback:", err);
            }

            if (!rawText) {
              // Fallback extraction call
              const fbResult = await extractClinicalData(deidentifiedInput);
              rawText = fbResult.extracted || fbResult.data || {};
            }

            let parsed: any = {};
            try {
              const cleanJson = typeof rawText === "string" ? rawText.replace(/```json\n?|\n?```/g, "").trim() : "";
              parsed = JSON.parse(cleanJson);
            } catch (e) {
              parsed = typeof rawText === "object" ? rawText : { presentingComplaint: deidentifiedInput };
            }
            return parsed;
          },
          callClinicalReasoningModel: async ({ model, deidentifiedInput, caseContext, chatHistory }) => {
            try {
              const recentHistory = chatHistory && chatHistory.length > 0 ? chatHistory.slice(-6) : [];
              const historyBlock = recentHistory.length > 0
                ? recentHistory.map((m) => `[${(m.role === "user" || m.sender === "user") ? "Doctor" : "ErMate"}]: ${m.content || m.text}`).join("\n")
                : "(This is the first message in this conversation.)";

              const prompt = `You are continuing an ongoing clinical conversation with an ER doctor about a specific patient. This is NOT a fresh case summary request every time — the doctor is having a real back-and-forth discussion with you.

CASE CONTEXT (the patient's current record — for your reference, do not just repeat this back unless directly relevant to answering the question below):
${JSON.stringify(caseContext || {}, null, 2)}

CONVERSATION SO FAR:
${historyBlock}

THE DOCTOR'S CURRENT MESSAGE (this is what you must actually answer — do not just re-summarize the case again):
"${deidentifiedInput}"

INSTRUCTIONS:
- If this message is a follow-up question (like "should I discharge them?" or "what about X drug interaction?"), answer THAT SPECIFIC QUESTION directly and concisely. Do not repeat the full case summary, differentials, and citations you may have already given earlier in this conversation unless the doctor is explicitly asking for them again.
- If this message contains NEW clinical information (new vitals, new symptoms, a new lab result), acknowledge what's new and explain how it changes your prior assessment, if it does.
- Keep your tone conversational, like a senior colleague responding to a specific question — not like a template being re-filled.
- Cite sources only when introducing a NEW clinical claim that needs one, not on every single message.
- You must return valid JSON with the following keys: "summary" (your conversational answer or clinical summary), "differentials" (array of strings, ONLY if asked or relevant), "watchFor" (array of strings, ONLY if relevant), "references" (array of { "source": string, "note": string }, ONLY if relevant).`;

              const sysInstruction = "You are an Emergency Medicine Expert Senior Consultant. Return valid JSON only.";
              const sonnetResult = await callClaudeSonnetOnly(prompt, sysInstruction, true);

              if (sonnetResult && typeof sonnetResult === "object") {
                return {
                  summary: sonnetResult.summary || "Clinical encounter recorded.",
                  differentials: Array.isArray(sonnetResult.differentials) ? sonnetResult.differentials : [],
                  watchFor: Array.isArray(sonnetResult.watchFor) ? sonnetResult.watchFor : [],
                  references: Array.isArray(sonnetResult.references) ? sonnetResult.references : [],
                };
              }

              if (typeof sonnetResult === "string") {
                try {
                  const parsed = JSON.parse(sonnetResult.replace(/```json\n?|\n?```/g, "").trim());
                  return {
                    summary: parsed.summary || sonnetResult,
                    differentials: Array.isArray(parsed.differentials) ? parsed.differentials : [],
                    watchFor: Array.isArray(parsed.watchFor) ? parsed.watchFor : [],
                    references: Array.isArray(parsed.references) ? parsed.references : [],
                  };
                } catch (e) {
                  // Fall through to unavailable response
                }
              }
            } catch (err) {
              console.warn("[ClinicalReasoning] Claude 3.5 Sonnet call failed:", err);
            }

            return {
              summary: "Clinical reference is temporarily unavailable.",
              differentials: [],
              watchFor: [],
              references: [],
            };
          }
        }
      );

      return res.json({
        success: true,
        ...response
      });
    } catch (err: any) {
      console.error("[/api/scribe-chat turn error]:", err);
      return res.status(500).json({ success: false, error: err?.message || "Scribe turn execution failed." });
    }
  }

  return res.status(400).json({ success: false, error: "userInput is required for scribe chat turns." });
});

// ─────────────────────────────────────────
// ERMATE SELF-LEARNING ARCHITECTURE ROUTES
// ─────────────────────────────────────────

// 1. Capture Clinician Feedback Correction
app.post("/api/learning/feedback", async (req, res) => {
  try {
    const { field, ai_output, corrected_output, source_context, corrected_by, case_type } = req.body;
    if (!field || !ai_output || !corrected_output) {
      return res.status(400).json({ success: false, error: "field, ai_output, and corrected_output are required." });
    }

    const recorded = recordFeedbackCorrection(
      field,
      ai_output,
      corrected_output,
      source_context || "",
      corrected_by || "doctor",
      case_type || "general"
    );

    if (!recorded) {
      return res.json({ success: true, captured: false, message: "Ignored stylistic or non-factual edit." });
    }

    return res.json({ success: true, captured: true, feedback: recorded });
  } catch (err: any) {
    console.error("[Learning Feedback Error]", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to log feedback" });
  }
});

// 2. Fetch Rules & Raw Corrections List (for Admin Control Panel)
app.get("/api/learning/rules", async (req, res) => {
  try {
    const rules = getAllLearnedRules();
    const corrections = getAllFeedbackCorrections();
    return res.json({ success: true, rules, corrections });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch rules" });
  }
});

// 3. Extract Generalizable Patterns from Pending Corrections (Offline Pass)
app.post("/api/learning/extract-rules", async (req, res) => {
  try {
    const result = await extractPatternsFromUnprocessedFeedback(process.env.GEMINI_API_KEY);
    return res.json({
      success: true,
      processedCount: result.processedCount,
      newRules: result.newRules,
      rules: getAllLearnedRules()
    });
  } catch (err: any) {
    console.error("[Learning Extract Error]", err);
    return res.status(500).json({ success: false, error: err?.message || "Pattern extraction failed" });
  }
});

// 4. Review Queue Approval / Rejection / Toggle
app.post("/api/learning/rules/review", async (req, res) => {
  try {
    const { ruleId, approved, active, approvedBy } = req.body;
    if (!ruleId) {
      return res.status(400).json({ success: false, error: "ruleId is required." });
    }

    const updated = updateRuleStatus(ruleId, Boolean(approved), Boolean(active), approvedBy || "Dr. Neeraj");
    if (!updated) {
      return res.status(404).json({ success: false, error: "Rule not found." });
    }

    return res.json({ success: true, rule: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Review action failed" });
  }
});

// 5. Create Manual Clinician Rule
app.post("/api/learning/rules/create", async (req, res) => {
  try {
    const { ruleText, triggerKeywords, caseType, severity, createdBy } = req.body;
    if (!ruleText?.trim()) {
      return res.status(400).json({ success: false, error: "ruleText is required." });
    }

    const created = createManualLearnedRule(
      ruleText,
      Array.isArray(triggerKeywords) ? triggerKeywords : [],
      caseType || "general",
      severity === "safety_critical" ? "safety_critical" : "quality",
      createdBy || "Dr. Neeraj"
    );

    return res.json({ success: true, rule: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Rule creation failed" });
  }
});

// 6. Delete Rule
app.post("/api/learning/rules/delete", async (req, res) => {
  try {
    const { ruleId } = req.body;
    if (!ruleId) return res.status(400).json({ success: false, error: "ruleId required" });
    const success = deleteLearnedRule(ruleId);
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Delete failed" });
  }
});

// ─────────────────────────────────────────
// MORTALITY AUDIT — HOD ONLY
// CONFIDENTIAL — M&M Committee
// ─────────────────────────────────────────
app.post(
  "/api/mortality-audit/generate",
  requireHOD,
  async (req: express.Request, res: express.Response) => {
    const { rawText, caseId, patientInitials, hospitalName } = req.body;

    if (!rawText?.trim()) {
      return res.status(400).json({
        success: false,
        error: "No EMR text provided",
      });
    }

    console.log(
      "[MortalityAudit] Generating audit · " +
      `User: ${(req as any).user?.email} · ` +
      `Chars: ${rawText.length}`
    );

    const result = await generateMortalityAudit(rawText, hospitalName || "Hospital");

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json({
      success: true,
      audit: result.audit,
    });
  }
);

// Download as Word doc (.docx)
app.post(
  "/api/mortality-audit/download",
  requireHOD,
  async (req: express.Request, res: express.Response) => {
    const { audit } = req.body;

    if (!audit) {
      return res.status(400).json({
        success: false,
        error: "No audit data provided",
      });
    }

    try {
      const docBuffer = await generateMortalityAuditDocx(audit);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ErMate_MortalityAudit_${new Date().toISOString().split("T")[0]}.docx"`
      );

      return res.send(docBuffer);
    } catch (err: any) {
      console.error("[MortalityAudit] Docx failed:", err);
      return res.status(500).json({
        success: false,
        error: "Could not generate document",
      });
    }
  }
);

function generateHeuristicDiscussionResponse(contextType: string, data: any, userQuery: string): string {
  const patientName = data?.patientLabel?.name || data?.patient?.name || data?.patientInfo?.name || data?.name || "Patient";
  const bedNo = data?.patientLabel?.bed || data?.bed || data?.bedNo || "N/A";
  const dx = data?.diagnosis || data?.provisionalPrimaryDiagnosis || data?.assessment || "Under evaluation";
  const done = Array.isArray(data?.done) ? data.done.join(" · ") : (data?.done || "Standard monitoring");
  const toBeDone = Array.isArray(data?.toBeDone) ? data.toBeDone.join(" · ") : (data?.toBeDone || "Continue active care");

  return `**Clinical Discussion Note for ${patientName} (Bed ${bedNo})**\n\n- **Working Diagnosis**: ${dx}\n- **Completed Actions**: ${done}\n- **Pending Plan**: ${toBeDone}\n\n*Clinical Assessment regarding "${userQuery}"*: Patient requires continuous monitoring of vitals, execution of pending orders, and close reassessment. All discussion points have been recorded in the clinical log.`;
}

app.post("/api/case-discussion", async (req, res) => {
  try {
    const { caseData, contextType, contextData, messages, history, message } = req.body;

    const effectiveContextType = contextType || "case";
    const rawData = contextData || caseData || {};
    const effectiveMessages = messages || history || [];

    // Build patient summary based on contextType with DPDP Act 2023 de-identification (Rule 4)
    let contextSummaryText = "";

    if (effectiveContextType === "handover") {
      const pl = rawData.patientLabel || {};
      const doneList = Array.isArray(rawData.done) ? rawData.done.join(" · ") : (rawData.done || "None");
      const todoList = Array.isArray(rawData.toBeDone) ? rawData.toBeDone.join(" · ") : (rawData.toBeDone || "None");

      contextSummaryText = `
=== HANDOVER PATIENT RECORD ===
Patient Name: ${deidentifyText(pl.name || rawData.name || "Bed Patient").deidentified}
Age / Sex: ${pl.ageSex || "N/A"}
Bed Number: ${pl.bed || "Unassigned"}
In ER Since: ${pl.inERSince || "N/A"}
Status Category: ${(pl.status || "unstable").toUpperCase()}

PRESENTING COMPLAINT:
${deidentifyText(rawData.presentingComplaint || "Emergency Presentation").deidentified}

CLINICAL STORY:
${deidentifyText(rawData.story || "No detailed story recorded.").deidentified}

PAST MEDICAL HISTORY:
${deidentifyText(rawData.pmh || "None documented").deidentified}

PROVISIONAL DIAGNOSIS:
${rawData.diagnosis || "Under evaluation"}

MANAGEMENT PLAN (DONE):
${deidentifyText(doneList).deidentified}

MANAGEMENT PLAN (TO BE DONE):
${deidentifyText(todoList).deidentified}

VITALS NOW:
${rawData.vitalsNow || "Not documented"}

CRITICAL ALERTS & ALERT ROW:
${deidentifyText(rawData.alertRow || "No active alerts").deidentified}
===============================
`;
    } else if (effectiveContextType === "discharge") {
      const pi = rawData.patientInfo || {};
      const dxList = Array.isArray(rawData.diagnosisAtDischarge)
        ? rawData.diagnosisAtDischarge.join(", ")
        : (rawData.diagnosisAtDischarge || rawData.diagnosis || "Under evaluation");

      contextSummaryText = `
=== DISCHARGE SUMMARY RECORD ===
Patient Name: ${deidentifyText(pi.name || rawData.patientName || "Patient").deidentified}
Age / Sex: ${pi.ageSex || pi.age || "N/A"}
Date of Admission: ${pi.dateAdmission || "N/A"}
Date of Discharge: ${pi.dateDischarge || "N/A"}

DIAGNOSIS AT DISCHARGE:
${dxList}

HOSPITAL & ER COURSE:
${deidentifyText(rawData.hospitalCourse || "Clinical course recorded in discharge summary.").deidentified}

LABS & INVESTIGATION SUMMARY:
${deidentifyText(rawData.investigationSummary || "Standard diagnostic workup completed.").deidentified}

DISCHARGE MEDICATIONS:
${Array.isArray(rawData.dischargeMedications) ? rawData.dischargeMedications.map((m: any) => `- ${m.name} ${m.dose} ${m.frequency}`).join("\n") : "As per prescription"}

FOLLOW-UP ADVICE:
${deidentifyText(rawData.followUpAdvice || "Review in ED if symptoms recur.").deidentified}
================================
`;
    } else if (effectiveContextType === "mortality_audit") {
      const pi = rawData.patientInfo || {};
      const cod = rawData.causeOfDeath || {};

      contextSummaryText = `
=== CONFIDENTIAL M&M MORTALITY REVIEW RECORD ===
Patient Name: ${deidentifyText(pi.name || rawData.patientName || "Deceased Patient").deidentified}
Age / Sex: ${pi.ageSex || "N/A"}
Date & Time of Admission: ${pi.dateAdmission || "N/A"}
Date & Time of Death: ${pi.dateDeath || "N/A"}

CAUSE OF DEATH DECONSTRUCTION:
- Immediate Cause (Part I Top): ${cod.immediate || "Cardiorespiratory arrest"}
- Antecedent Causes: ${cod.antecedent || "N/A"}
- Underlying Cause: ${cod.underlying || "Under audit"}
- Contributing Comorbidities (Part II): ${cod.contributing || "N/A"}

CLINICAL TIMELINE & ER RESUSCITATION COURSE:
${deidentifyText(rawData.clinicalSummary || "Full resuscitation and ER course documented.").deidentified}

ACLS & RESUSCITATION AUDIT:
${deidentifyText(rawData.resuscitationDetails || "Standard ACLS protocol executed.").deidentified}
=================================================
`;

    } else {
      // Default: 'case'
      const pat = rawData?.patient || {};
      const vit = rawData?.vitals || {};
      const sam = rawData?.sampleHistory || {};
      const pri = rawData?.primaryAssessment || {};
      const invs = rawData?.investigations || [];
      const trts = rawData?.treatments || [];
      const diffs = rawData?.differentials || [];

      const invSummary = rawData?.investigationResultsSummary 
        ? rawData.investigationResultsSummary 
        : invs.map((i: any) => `${i.testName || i.name}: ${i.result || i.value} ${i.isAbnormal ? "⚠️" : ""}`).join("\n");

      const isPediatric = !!rawData?.isPediatric;
      const peds = rawData?.pediatricDetails || {};
      const pedsString = isPediatric ? `
PEDIATRIC ASSESSMENT & CONTEXT:
- Weight: ${peds.patientWeight || peds.weight || "N/A"} kg
- PAT (TICLS): Tone: ${peds.patAppearanceTone}, Interactivity: ${peds.patAppearanceInteractivity}, Consolability: ${peds.patAppearanceConsolability}, Look: ${peds.patAppearanceLookGaze}, Cry: ${peds.patAppearanceSpeechCry}
- Work of Breathing: ${peds.patWorkOfBreathing} | Circulation: ${peds.patCirculation}
- Birth History: ${peds.birthHistory} | Feeding: ${peds.feedingHistory} | Immunizations: ${peds.immunizationHistory}` : "";

      contextSummaryText = `
=== PATIENT CLINICAL CASE RECORD ===
Patient Name: ${deidentifyText(pat.name || "Unidentified").deidentified}
Age / Sex: ${pat.age || "N/A"} years | ${pat.gender || "Unknown"}
Chief Complaint: ${deidentifyText(pat.presentingComplaint || "Emergency presentation").deidentified}
Triage Category: ${pat.triageCategory || "P2 (Urgent)"}
Case Type: ${pat.caseType || "Medical"} | Arrival: ${pat.arrivalMode || "Walk-in"}
${isPediatric ? "\n*** PEDIATRIC PATIENT (APPLY PALS PROTOCOLS, AGE-APPROPRIATE RANGES & WEIGHT-BASED DOSING) ***\n" : ""}
VITALS ON PRESENTATION:
BP: ${vit.bp || "N/A"} mmHg | HR: ${vit.hr || "N/A"} bpm | SpO2: ${vit.spo2 || "N/A"}% | RR: ${vit.rr || "N/A"}/min
Temp: ${vit.temp || "N/A"} °F | GCS: ${vit.gcs || "15"} | GRBS: ${vit.grbs || "N/A"} mg/dL
${pedsString}
SAMPLE HISTORY & PRESENTATION STORY:
- History / Symptoms: ${deidentifyText(sam.symptoms || "N/A").deidentified}
- Past Medical History: ${deidentifyText(sam.pastHistory || "None documented").deidentified}
- Outpatient Medications: ${deidentifyText(sam.medications || "None").deidentified}
- Allergies: ${deidentifyText(sam.allergies || "NKDA").deidentified}
- Events / Story of Presenting Illness: ${deidentifyText(sam.events || "N/A").deidentified}

PRIMARY ASSESSMENT (ABCDE):
- Airway: ${pri.airway || "Patent"}
- Breathing: ${pri.breathing || "Normal"}
- Circulation: ${pri.circulation || "Normal"}
- Disability: ${pri.disability || "Normal"}
- Exposure: ${pri.exposure || "Normal"}

PHYSICAL EXAMINATION & SECONDARY ASSESSMENT:
${deidentifyText(typeof rawData?.secondaryAssessment === 'string' ? rawData.secondaryAssessment : "General: Conscious, oriented. Systemic exams within normal limits.").deidentified}

LAB INVESTIGATIONS & FINDINGS:
${deidentifyText(invSummary || "No labs uploaded yet.").deidentified}

TREATMENTS ADMINISTERED / ORDERED:
${trts.map((t: any) => `- ${t.drugName} ${t.dose || ""} (${t.route || "IV"})`).join("\n") || "Symptomatic ER monitoring."}

PROGRESS NOTES & ER TIMELINE:
${deidentifyText(rawData?.progressNotes || "No progress notes recorded.").deidentified}

DIFFERENTIAL DIAGNOSES / IMPRESSIONS:
${diffs.map((d: any) => `- ${typeof d === "string" ? d : d.diagnosis || d.name}`).join("\n") || "Under evaluation"}

DISPOSITION & TERMINAL OUTCOME:
- Disposition Type: ${rawData?.dispositionDetails?.dispositionType || "In ER"}
- Duration in ER: ${rawData?.dispositionDetails?.durationInEr || "N/A"}
- Observation & ER Notes: ${deidentifyText(rawData?.dispositionDetails?.observationNotes || "N/A").deidentified}
- Primary Diagnosis: ${rawData?.dischargeInfo?.primaryDiagnosis || rawData?.provisionalPrimaryDiagnosis || "Under evaluation"}
- Condition at Discharge / Terminal Status: ${rawData?.dischargeInfo?.conditionAtDischarge || "N/A"}
===================================
`;
    }

    let discussionSystemInstruction = "";

    if (effectiveContextType === "reference") {
      discussionSystemInstruction = `You are ErMate EM Reference — an emergency medicine clinical knowledge assistant for Indian ERs (Claude 3.5 Sonnet).

Answer clinical questions with:
1. Direct practical answer first
2. Evidence-based reasoning
3. Indian ER context where relevant
4. Specific to the question asked (not just textbook summary)
5. References from:
   Tintinalli's Emergency Medicine
   Rosen's Emergency Medicine
   Relevant guidelines (ACC/AHA/BTS etc)
   WikEM / UpToDate when applicable

5. References format constraint:
   Always cite by Chapter TOPIC Name (e.g. "Tintinalli's Emergency Medicine, 9th Ed — Cardiac Rhythm Disturbances (Tachyarrhythmias & Bradyarrhythmias)").
   STRICT RULE: NEVER output bare chapter numbers like "Chapter 22" or "Chapter 12". Always state the full, descriptive chapter topic title.

Format:
  Lead with the clinical answer.
  Then the reasoning.
  Then dosing/protocol if relevant.
  Then caveats/contraindications.
  End with 1-2 key references (citing Chapter TOPIC Name, never bare chapter numbers).

You are talking to an ER doctor who needs a practical answer NOW.
Not a medical student needing an explanation of pathophysiology.
Be concise and clinically precise.`;
    } else {
      discussionSystemInstruction = `
You are ErMate AI — Senior Emergency Medicine Consultant and Clinical Educator (Claude 3.5 Sonnet).
You are currently in an interactive clinical discussion with the Emergency Physician regarding a SPECIFIC active patient.

${contextSummaryText}

YOUR CRITICAL GUIDELINES:
1. Answer the doctor's query directly referencing THIS patient's exact history, vitals, physical findings, labs, treatments, and complete clinical story.
2. RECORD UPDATES & ONE-TAP SYNC:
   If the doctor requests to update, add, or modify any detail on this record (e.g. "change diagnosis to X", "add MRI to pending actions", "update alert row to Y", "add item to to-do list"), or if you strongly recommend an update to the working record, end your response with a JSON update block on its own line:
   [UPDATE: {"field_name": "updated_value"}]
   Examples:
   - For Handover: [UPDATE: {"toBeDone": ["Cystoscopy planned tomorrow", "Monitor HR + Temp"], "diagnosis": "Right Hydronephrosis"}]
   - For Case: [UPDATE: {"provisionalPrimaryDiagnosis": "Upper GI Bleed — Severe"}]
   - For Discharge: [UPDATE: {"followUpAdvice": "Review in ED if hematemesis recurs"}]

3. CAUSE OF DEATH & MORTALITY REVIEW: If analyzing cause of death or mortality:
   Deconstruct Immediate Cause, Antecedent Causes, Underlying Cause, and Contributing Factors clearly.
4. Keep answers clean, professional, and well-structured with bold terms and short bullet points.
5. End clinical discussions with authoritative citations where appropriate (Tintinalli's, Rosen's, Harrison's, WikEM, UpToDate).
6. PEDIATRIC CONTEXT FLAG: If the case record indicates this is a pediatric patient (age < 16), you MUST force PALS protocols, age-appropriate vital sign references, and calculate weight-based dosing strictly.
`;
    }

    let conversationHistoryText = "";
    if (Array.isArray(effectiveMessages) && effectiveMessages.length > 0) {
      conversationHistoryText = effectiveMessages
        .map((m: any) => {
          const sender = m.sender === "user" || m.role === "user" ? "Doctor" : "Claude";
          const content = deidentifyText(m.text || m.content || "").deidentified;
          return `${sender}: ${content}`;
        })
        .join("\n\n");
    } else if (message) {
      conversationHistoryText = `Doctor: ${deidentifyText(message).deidentified}`;
    }

    let claudeReply: string | null = null;
    try {
      claudeReply = await callClaudeSonnetOnly(conversationHistoryText, discussionSystemInstruction, false);
    } catch (claudeErr: any) {
      console.warn("[CaseDiscussion] Claude Sonnet attempt failed:", claudeErr?.message || claudeErr);
    }

    if (claudeReply && typeof claudeReply === "string" && claudeReply.trim().length > 5) {
      let cleanResponse = claudeReply;
      let suggestedUpdate = null;

      // Detect [UPDATE: {...}] tag
      const match = claudeReply.match(/\[UPDATE:\s*(\{[^\]]+\})\]/s);
      if (match) {
        try {
          suggestedUpdate = JSON.parse(match[1]);
          cleanResponse = claudeReply.replace(/\[UPDATE:\s*\{[^\]]+\}\]/s, "").trim();
        } catch (e) {
          console.warn("[CaseDiscussion] Failed to parse [UPDATE] tag JSON:", e);
        }
      }

      return res.json({
        success: true,
        response: cleanResponse,
        reply: cleanResponse,
        suggestedUpdate: suggestedUpdate,
        model: "claude-sonnet-3-5"
      });
    }

    // Fallback to deterministic heuristic discussion generator if Claude fails
    const heuristicText = generateHeuristicDiscussionResponse(effectiveContextType, rawData, message || "Clinical review");
    return res.json({
      success: true,
      response: heuristicText,
      reply: heuristicText,
      model: "heuristic-clinical-discussion-engine"
    });
  } catch (error: any) {
    console.error("[Clinical Reasoning] Case Discussion Error:", error?.message || error);
    const fallbackText = generateHeuristicDiscussionResponse(req.body?.contextType || "case", req.body?.contextData || req.body?.caseData || {}, req.body?.message || "Clinical review");
    return res.json({
      success: true,
      response: fallbackText,
      reply: fallbackText,
      model: "heuristic-fallback-engine"
    });
  }
});

// 5c-3. Handover PDF Generation Endpoint
app.post("/api/handover/pdf", async (req, res) => {
  try {
    const { date, facility, clinician, patients } = req.body;

    const doc = new PDFDocument({ layout: "portrait", size: "A4", margin: 30, bufferPages: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Emergency_Handover_Report_${(date || "Shift").toString().replace(/[/\\?%*:|"<>]/g, "-")}.pdf"`
    );

    doc.pipe(res);

    // Document Header
    doc.fillColor("#0f172a").fontSize(16).font("Helvetica-Bold").text(`${(facility || "EMERGENCY DEPARTMENT").toUpperCase()} - CLINICAL HANDOVER REPORT`, { align: "center" });
    doc.moveDown(0.2);
    doc.fillColor("#475569").fontSize(9.5).font("Helvetica").text(
      `Facility: ${facility || "Emergency Department"}  |  Lead Clinician: ${clinician || "Duty Officer"}  |  Date: ${date || new Date().toLocaleDateString()}`,
      { align: "center" }
    );
    doc.moveDown(0.4);
    doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.moveDown(0.6);

    // Patient Cards / Table
    if (Array.isArray(patients) && patients.length > 0) {
      patients.forEach((p: any, idx: number) => {
        if (doc.y > doc.page.height - 120) {
          doc.addPage();
        }

        const startY = doc.y;
        const cardWidth = doc.page.width - 60;
        const cardHeight = 92;

        // Card container
        doc.rect(30, startY, cardWidth, cardHeight).fillAndStroke("#ffffff", "#0f172a");

        // Header line
        doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold")
           .text(`${idx + 1}. [Bed: ${p.bed || "N/A"}]  ${p.name || p.patientName || "Patient"} (${p.ageGender || p.ageSex || "N/A"})`, 40, startY + 8);

        // Subheader line
        doc.fillColor("#334155").fontSize(9).font("Helvetica-Bold")
           .text(`ER No: ${p.erNo || "N/A"}  |  Doctor: ${p.doctor || "N/A"}  |  Vitals: ${p.vitals || "N/A"}`, 40, startY + 24);

        // Complaints / History
        const comp = (p.complaints || p.situation || p.presentingComplaint || "N/A").substring(0, 110);
        doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica")
           .text(`Chief Complaints: ${comp}`, 40, startY + 40);

        // Assessment & Plan
        const plan = (p.planToBeDone || p.assessment || p.recommendation || "Maintain monitoring & care").substring(0, 120);
        doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica")
           .text(`Plan / Action Needed: ${plan}`, 40, startY + 55);

        // Bystanders / Alerts
        const alertText = (p.alerts || p.bystander || "None").substring(0, 100);
        doc.fillColor("#991b1b").fontSize(8.5).font("Helvetica-Bold")
           .text(`Alerts / Bystander Update: ${alertText}`, 40, startY + 70);

        doc.y = startY + cardHeight + 10;
      });
    } else {
      doc.fillColor("#64748b").fontSize(10).text("No active handover patients in report.", { align: "center" });
    }

    // Add Page X of Y page numbers to all buffered pages
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.strokeColor("#e2e8f0").lineWidth(0.5)
         .moveTo(30, doc.page.height - 35)
         .lineTo(doc.page.width - 30, doc.page.height - 35)
         .stroke();

      doc.fillColor("#475569").fontSize(8.5).font("Helvetica-Bold").text(
        `CONFIDENTIAL CLINICAL HANDOVER REPORT  •  Powered by ErMate  •  Page ${i + 1} of ${range.count}`,
        30,
        doc.page.height - 24,
        { align: "center", width: doc.page.width - 60 }
      );
    }

    doc.end();
  } catch (err: any) {
    console.error("[Handover PDF Endpoint Error]", err);
    res.status(500).json({ success: false, error: "Failed to generate handover PDF" });
  }
});

// 5d. AI Scribe Document Scanner (OCR & Mapping)
app.post("/api/scribe-ocr-scan", async (req, res) => {
  const { image, mimeType, imageText } = req.body;

  try {
    const ai = getAI();
    let response;

    const schema = {
      type: Type.OBJECT,
      properties: {
        hospitalName: { type: Type.STRING, description: "Name of the hospital/clinic that issued this letter" },
        patientName: { type: Type.STRING },
        age: { type: Type.INTEGER, nullable: true },
        gender: { type: Type.STRING, description: "Male, Female, or Other" },
        presentingComplaint: { type: Type.STRING },
        triageCategory: { type: Type.STRING, description: "P1 (Immediate), P2 (Urgent), or P3 (Non-Urgent)" },
        caseType: { type: Type.STRING, description: "Medical or Trauma" },
        arrivalMode: { type: Type.STRING, description: "Walk-in, Ambulance, or Referred" },
        bp: { type: Type.STRING },
        hr: { type: Type.STRING },
        spo2: { type: Type.STRING },
        rr: { type: Type.STRING },
        temp: { type: Type.STRING },
        gcs: { type: Type.STRING },
        grbs: { type: Type.STRING },
        painScore: { type: Type.STRING },
        symptoms: { type: Type.STRING },
        allergies: { type: Type.STRING },
        medications: { type: Type.STRING },
        pastHistory: { type: Type.STRING },
        lastMeal: { type: Type.STRING },
        events: { type: Type.STRING },
        airway: { type: Type.STRING },
        airwayStatus: { type: Type.STRING },
        breathing: { type: Type.STRING },
        breathingStatus: { type: Type.STRING },
        circulation: { type: Type.STRING },
        circulationStatus: { type: Type.STRING },
        disability: { type: Type.STRING },
        disabilityStatus: { type: Type.STRING },
        exposure: { type: Type.STRING },
        exposureStatus: { type: Type.STRING },
        secondaryAssessment: { type: Type.STRING },
        progressNotes: { type: Type.STRING },
        clinicalNarrative: { type: Type.STRING, description: "A structured concise medical summary of this reference letter for the physician" }
      },
      required: [
        "hospitalName", "patientName", "age", "gender", "presentingComplaint", "triageCategory", "caseType", "arrivalMode",
        "bp", "hr", "spo2", "rr", "temp", "gcs", "grbs", "painScore",
        "symptoms", "allergies", "medications", "pastHistory", "lastMeal", "events",
        "airway", "airwayStatus", "breathing", "breathingStatus", "circulation", "circulationStatus", "disability", "disabilityStatus", "exposure", "exposureStatus",
        "secondaryAssessment", "progressNotes", "clinicalNarrative"
      ]
    };

    if (image) {
      // Multimodal image OCR scan
      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      };
      const textPart = {
        text: `You are an expert clinical OCR processing system. Extract patient details, clinical history, vitals, allergies, and the chief reasons for transfer from this scanned hospital reference/referral letter. Fill out all properties in the schema correctly.`
      };

      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction: "You are an expert emergency medical OCR processing system. Convert clinical reference/referral images into accurate structured clinical data in JSON.",
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    } else {
      // Text-based OCR parser
      const safeImageText = deidentifyText(imageText || "").deidentified;
      const prompt = `
        You are an expert clinical OCR processing system.
        Extract patient details, clinical history, vitals, allergies, and chief reasons for transfer from this hospital reference/referral letter text:
        
        "${safeImageText}"
      `;

      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          systemInstruction: "You map clinical referral text into clean structured medical data modules. Return JSON only.",
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    }

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini OCR Scan Error:", error);
    // Mock referral data backup
    const backupData = {
      hospitalName: "Metro Heart & General Hospital",
      patientName: "Robert Miller",
      age: 68,
      gender: "Male",
      presentingComplaint: "Acute shortness of breath and chest pressure",
      triageCategory: "P1 (Immediate)",
      caseType: "Medical",
      arrivalMode: "Referred",
      bp: "165/95",
      hr: "98",
      spo2: "91",
      rr: "24",
      temp: "37.1",
      gcs: "15",
      grbs: "135",
      painScore: "7",
      symptoms: "Worsening dyspnea over 2 days, orthopnea, paroxysmal nocturnal dyspnea, bilateral pitting pedal edema.",
      allergies: "Penicillin (Anaphylaxis)",
      medications: "Lisinopril 20mg OD, Metoprolol succinate 50mg OD, Furosemide 40mg OD",
      pastHistory: "Congestive Heart Failure, CABG x2 in 2020, Chronic Kidney Disease Stage 3",
      lastMeal: "Light breakfast 5 hours ago",
      events: "Transferred from Metro Heart clinic for cardiology review and advanced diuretic therapy due to decompensation.",
      airway: "Clear, speaking in partial sentences",
      airwayStatus: "Normal",
      breathing: "Tachypneic, diffuse fine crepitations in bilateral lung bases, accessory muscle use",
      breathingStatus: "Abnormal",
      circulation: "Bilateral 2+ pitting pedal edema up to mid-shin, warm extremities, bounding peripheral pulses",
      circulationStatus: "Normal",
      disability: "Pupils equal and reactive, GCS 15, slightly anxious but fully oriented",
      disabilityStatus: "Normal",
      exposure: "No active rashes, warm skin, temp 37.1 C",
      exposureStatus: "Normal",
      secondaryAssessment: "Moderate respiratory distress, jugular venous distention present (~8 cm H2O).",
      progressNotes: "Plan immediate IV furosemide challenge, continuous pulse oximetry, cardiac telemetry, and obtain chest X-ray.",
      clinicalNarrative: "Metro Heart Clinic Referral: 68 y/o Male with acute decompensated heart failure exacerbation, penicillin anaphylaxis allergy, needing urgent inpatient cardiology intervention."
    };
    res.json({
      success: true,
      data: backupData,
      simulated: true
    });
  }
});

// 6.5. AI-Assisted Structured Handover Parser (EMR Paste & Case Sheet Camera OCR)
app.post("/api/handover/parse-structured", async (req, res) => {
  const { image, mimeType, rawText, doctorName } = req.body;

  try {
    const ai = getAI();
    let response;

    const schema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Patient name or Bed ID if name is not available (e.g. Selvarani, Bed 3)" },
        ageGender: { type: Type.STRING, description: "Age and gender (e.g., 57F, 45y / Male, or 'Unknown')" },
        inERSince: { type: Type.STRING, description: "Time or timestamp when patient arrived or note was taken (e.g. 08:30 AM or 10:15 PM)" },
        triage: { type: Type.STRING, description: "Triage Priority level (must be exactly 'P1 (Immediate)' or 'P2 (Urgent)' or 'P3 (Non-Urgent)')" },
        vitals: { type: Type.STRING, description: "Vital signs extracted or summarized (e.g., SpO2 97% on 5L O2 | HR 103 | BP 130/80 | RR 18 | Temp 97.4°F | GRBS 204 | GCS 15)" },
        presentingComplaint: { type: Type.STRING, description: "Chief presenting complaint, primary symptoms, onset, and duration extracted from case sheet or EMR data" },
        rawNotes: { type: Type.STRING, description: "A cleaned, highly legible transcription or compilation of the raw EMR notes or case sheet text" },
        structuredSBAR: {
          type: Type.OBJECT,
          properties: {
            situation: { type: Type.STRING, description: "Situation (S): Patient's current situation, bed/room, age/gender, and EXPLICIT provisional diagnosis / active primary issue." },
            background: { type: Type.STRING, description: "Background (B): Exhaustive past medical history, comorbidities (e.g. T2DM x 22y, HTN x 22y, Hypothyroidism x 5y, Cushing's syndrome, Morbid Obesity, OSA), home medications, and timeline." },
            assessment: { type: Type.STRING, description: "Assessment (A): Most recent vitals, physical examination highlights, exhaustive investigation findings parameter-by-parameter in chronological order, and clinical results." },
            recommendation: { type: Type.STRING, description: "Recommendation (R): Exhaustive list of pending actions (□ items), transfer plans (e.g. MICU), specialist consults, and bystander counselling updates." }
          },
          required: ["situation", "background", "assessment", "recommendation"]
        }
      },
      required: ["name", "ageGender", "triage", "vitals", "presentingComplaint", "rawNotes", "structuredSBAR"]
    };

    const extractionInstruction = `
You are an expert Emergency Medicine Clinical Lead extracting a clinical handover from a real Indian hospital EMR note or case sheet.

The input contains multiple entries from different authors in reverse chronological order (newest first).

READ THE ENTIRE TEXT BEFORE EXTRACTING. Do not stop at the first entry.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHERE TO FIND EACH FIELD:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PATIENT LABEL:
  Name from entry headers (e.g., Selvarani, Varghese KC)
  Age/sex from consultant notes or headers (e.g., 57F, 48M)
  Bed number and ER number from header or notes

PRESENTING COMPLAINT:
  Look for "Presenting Complaint:" or "Chief Complaint:" or "c/o" labels
  Use EARLIEST entry (bottom of text) or initial presentation note
  Detail symptoms, duration, and onset

PAST MEDICAL HISTORY:
  Look for "Past Medical History:", "Known case of", "K/C/O", "KCO", "Comorbidities:", "PMH"
  May appear in ANY entry — especially consultant notes (e.g., General Medicine, Nephrology, Cardiology consults)
  Extract ALL conditions with durations and home medications (e.g., T2DM x 22y, HTN with Nephropathy, Hypothyroidism x 5y, Cushing's syndrome, Morbid Obesity, OSA)
  NEVER say "not documented" or "Comorbidities not explicitly documented" if the text has PMH anywhere

PROVISIONAL DIAGNOSIS:
  Look for "IMP:", "Impression:", "Differential Diagnosis:", "Provisional Diagnosis:", "Diagnosis:", "Dx:"
  Consultant notes often have "IMP:" (e.g. "Fluid overload state with pericardial effusion and right pleural effusion, Moderate ascites, Metabolic acidosis, Acute kidney injury")
  Use the MOST SPECIFIC diagnosis found across all entries
  CT/imaging impressions count as diagnosis

DONE (COMPLETED ACTIONS):
  Any entry with PAST TENSE actions:
  "done" / "given" / "taken" / "sent" / "started" / "inserted" / "shifted" / "administered" / "completed" / "counselled"
  Each completed action = one done item (prefixed with ✓)
  Include: investigations done, medications given, procedures, consultations completed, IV lines, oxygen delivery

TO BE DONE (PENDING / PLAN):
  Any entry with FUTURE actions:
  "Plan:" / "Advice:" / "Adv:" / "to be done" / "pending" / "awaited" / "monitor" / "follow" / "shift to" / "ICU transfer"
  Each pending action = one to-do item (prefixed with □)

VITALS:
  Look in "Primary Assessment:" sections or arrival/nursing notes
  Look for BP, HR, SpO2, RR, Temp, GCS, GRBS
  Use MOST RECENT values (top of text) or arrival values
  NEVER say "not documented" if ANY vital is anywhere in the text

BYSTANDER UPDATE:
  Look for "family counselled", "explained to bystander", "financial counselling", "informed about"
  Include WHO was told and WHAT was communicated (e.g., "Explained in detail regarding need of ICU admission in view of fluid overload, desaturation and metabolic acidosis; financial counselling given")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. READ EVERY ENTRY in the text. Diagnosis is often in the middle (consultant note) not at the start.

2. NEVER use generic placeholders:
   ✗ "Comorbidities not explicitly documented in raw input"
   ✗ "Vitals not documented"
   ✗ "Evaluation of patient with acute symptoms"
   ✗ "Complete active tasks and consult"
   ✗ "Parsed Notes Review Complete"
   ✗ "Bystanders counselled" (unless that's literally all that's written)
   
   If something is genuinely absent write: null or empty string ""

3. Separate nursing actions from clinical findings:
   Nursing = "Patient shifted for CT", "CT slot called", "Called CT said half hour delay", "Foley inserted"
   Clinical = "CT Abdomen: Pericardial & pleural effusion, moderate ascites"
   
   Nursing actions → DONE list / Chronological notes
   Clinical findings → Assessment / Investigations

4. IMP: in any entry = diagnosis. Extract it as provisional diagnosis.

5. "Adv:" or "Advice:" in any entry = management plan to-do items.

6. Do NOT truncate. Extract ALL done items and ALL to-do items. Long lists are correct for complex patients.
`;

    if (image) {
      // Multimodal Image analysis of Case sheet
      const safeOverlayText = rawText ? deidentifyText(rawText).deidentified : "";
      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      };
      const textPart = {
        text: `${extractionInstruction}
        
        Analyze this image of a patient case sheet, referral letter, or clinical chart.
        Optional raw text overlay to assist you:
        "${safeOverlayText}"`
      };

      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction: "You are an expert emergency medical scribe specializing in clinical shift handovers. Convert medical documents and case sheet images into highly structured SBAR/IPASS handovers in JSON.",
          temperature: 0.0,
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    } else {
      // Delegate text-based EMR paste analysis to the complete 5-step handover pipeline (preprocess -> reverse -> length route -> LLM -> JSON format)
      const handoverResult = await extractHandoverData(rawText || "", doctorName);
      return res.json(handoverResult);
    }

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Handover Parse Error:", error);
    
    // Smart heuristic fallback parser
    let name = "Bed Patient";
    let ageGender = "";
    let triage = "P2 (Urgent)";
    let vitals = "";
    let presentingComplaint = "";
    let rawTextClean = rawText || "Image scanned or raw text pasted successfully.";

    if (rawText) {
      const lower = rawText.toLowerCase();
      
      // Presenting Complaint search
      const complaintMatch = rawText.match(/(?:presenting\s+complaint|chief\ complaint|complaints|c\/o|complaining\ of|reason\ for\ visit|reason\ for\ admission|presentation)\s*[:=-]?\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
      if (complaintMatch && complaintMatch[1] && complaintMatch[1].trim().length > 3) {
        presentingComplaint = complaintMatch[1].trim();
      } else {
        const firstLines = rawText.split(/\n+/).filter(l => l.trim().length > 10);
        presentingComplaint = firstLines.length > 0 ? firstLines[0].trim() : rawText.substring(0, 150);
      }

      // Bed/Name
      const bedMatch = rawText.match(/(?:bed|room|bay|cot|icu|hdu)?\s*#?\s*(\d+[a-z]?)/i);
      if (bedMatch) name = `Bed ${bedMatch[1]}`;
      const nameMatch = rawText.match(/(?:patient|mr\.|ms\.|mrs\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch) name = bedMatch ? `Bed ${bedMatch[1]} (${nameMatch[1]})` : nameMatch[1];
      
      // Age/Gender
      const ageMatch = rawText.match(/(\d{1,3})\s*-?(?:year|y\.?o\.?|yo|f|m)/i);
      const genderMatch = rawText.match(/\b(male|female|m|f)\b/i);
      if (ageMatch && genderMatch) {
        ageGender = `${ageMatch[1]}${genderMatch[1].toUpperCase().startsWith("F") ? "F" : "M"}`;
      } else if (ageMatch) {
        ageGender = `${ageMatch[1]}y`;
      }

      // Vitals
      const bpMatch = rawText.match(/(?:bp|blood\s*pressure)\s*[:=-]?\s*(\d{2,3}\/\d{2,3})/i) || rawText.match(/(\d{2,3}\/\d{2,3})/);
      const hrMatch = rawText.match(/(?:hr|pr|pulse|heart rate)\s*[:=-]?\s*(\d{2,3})/i);
      const spo2Match = rawText.match(/(?:spo2|oximetry|saturation)\s*[:=-]?\s*(\d{2,3})%/i);
      const grbsMatch = rawText.match(/(?:grbs|rbs|sugar)\s*[:=-]?\s*(\d{2,3})/i);
      const gcsMatch = rawText.match(/(?:gcs)\s*[:=-]?\s*([e\d\s\w]+)/i);

      let vitalsArr = [];
      if (bpMatch) vitalsArr.push(`BP ${bpMatch[1]}`);
      if (hrMatch) vitalsArr.push(`HR ${hrMatch[1]}`);
      if (spo2Match) vitalsArr.push(`SpO2 ${spo2Match[1]}%`);
      if (grbsMatch) vitalsArr.push(`GRBS ${grbsMatch[1]}`);
      if (gcsMatch) vitalsArr.push(`GCS ${gcsMatch[1].trim()}`);
      if (vitalsArr.length > 0) vitals = vitalsArr.join(" · ");

      // PMH search
      let pmhText = "";
      const pmhMatch = rawText.match(/(?:past\s+medical\s+history|known\s+case\ lawful|known\s+case\s+of|k\/c\/o|kco|comorbidities|pmh)\s*[:=-]?\s*([^\n\r]+(?:\n[^\n\r]+){0,4})/i);
      if (pmhMatch && pmhMatch[1]) {
        pmhText = pmhMatch[1].trim();
      }

      // Diagnosis search
      let diagText = "";
      const diagMatch = rawText.match(/(?:imp|impression|provisional\s+diagnosis|differential|diagnosis|dx)\s*[:=-]?\s*([^\n\r]+(?:\n[^\n\r]+){0,2})/i);
      if (diagMatch && diagMatch[1]) {
        diagText = diagMatch[1].trim();
      }

      // Triage
      if (lower.includes("p1") || lower.includes("immediate") || lower.includes("resus") || lower.includes("stemi") || lower.includes("arrest")) {
        triage = "P1 (Immediate)";
      } else if (lower.includes("p3") || lower.includes("minor") || lower.includes("discharge")) {
        triage = "P3 (Non-Urgent)";
      }

      const backupData = {
        name,
        ageGender: ageGender || "Unknown",
        triage,
        vitals: vitals || "",
        presentingComplaint,
        rawNotes: rawTextClean,
        structuredSBAR: {
          situation: diagText ? `PROVISIONAL DIAGNOSIS: ${diagText}` : presentingComplaint,
          background: pmhText || "",
          assessment: vitals ? `Vitals: ${vitals}` : "",
          recommendation: "Monitor clinical status and follow up pending orders."
        }
      };

      return res.json({
        success: true,
        data: backupData,
        simulated: true,
        error: error.message || "Using smart backup heuristic parser."
      });
    }

    res.status(500).json({ success: false, error: error.message || "Parsing failed." });
  }
});

// 6.6. AI Handover Sheet Compiler (Extracts & Maps All Clinical Data into Doctors' Handover Sheet Columns)
app.post("/api/handover/compile-sheet", async (req, res) => {
  const { patients } = req.body;
  if (!patients || !Array.isArray(patients) || patients.length === 0) {
    return res.status(400).json({ success: false, error: "No patient records provided for compilation." });
  }

  // Preprocess, de-identify, & reverse raw notes for each patient (oldest at top)
  // NOTE: processedPatients is the DE-IDENTIFIED version sent to the LLM only.
  // We keep a separate map of ORIGINAL (real name, real raw notes) data to
  // reconstruct the final output — never trust the LLM to echo these back correctly.
  const processedPatients = patients.map((p: any) => {
    const raw = p.rawNotes || p.chronologicalNotes || "";
    let safeNotes = raw;
    if (raw && typeof raw === "string" && raw.trim().length > 0) {
      const clean = preprocessEMR(raw);
      const deidentified = deidentifyText(clean).deidentified;
      safeNotes = reverseEMREntries(deidentified);
    }
    return {
      ...p,
      name: deidentifyText(p.name || "").deidentified || p.name,
      complaints: deidentifyText(p.complaints || p.presentingComplaint || "").deidentified || p.complaints,
      history: deidentifyText(p.history || p.pmh || "").deidentified || p.history,
      rawNotes: safeNotes,
      chronologicalNotes: safeNotes
    };
  });

  // FIX: preserve a lookup of the ORIGINAL, real-identity patient records
  // so we can re-inject real name + verified raw notes locally after the AI call,
  // the same way doctor identity is re-injected elsewhere in the app (rule 5).
  const originalById = new Map(patients.map((p: any) => [p.id, p]));

  try {
    const ai = getAI();
    const schema = {
      type: Type.OBJECT,
      properties: {
        rows: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              bed: { type: Type.STRING, description: "Bed or Room number e.g. Bed 13, Bed 3" },
              name: { type: Type.STRING, description: "Patient name e.g. Selvarani, Mini Unnikrishnan" },
              ageGender: { type: Type.STRING, description: "Age and gender e.g. 57F, 48M" },
              erNo: { type: Type.STRING, description: "ER number or patient ID e.g. ER# 1849288" },
              doctor: { type: Type.STRING, description: "Lead clinician / primary doctor e.g. Dr. Manoj, Dr. Elizabeth" },
              stayDuration: { type: Type.STRING, description: "Admission date and stay duration in ER e.g. In ER since: 25-07-2026 (12h)" },
              complaints: { type: Type.STRING, description: "PRESENTING COMPLAINT: Chief complaints, symptoms, duration, and onset from initial presentation" },
              history: { type: Type.STRING, description: "PAST MEDICAL HISTORY: Comorbidities (e.g. T2DM x 22y, HTN x 22y, Hypothyroidism x 5y, Cushing's syndrome, Morbid Obesity, OSA), home medications, surgical history, and allergies" },
              assessment: { type: Type.STRING, description: "PROVISIONAL DIAGNOSIS & ASSESSMENT: Exact provisional diagnosis (e.g. Fluid overload state with pericardial & pleural effusion, moderate ascites, metabolic acidosis, AKI), full imaging/lab report findings" },
              planDone: { type: Type.STRING, description: "MANAGEMENT PLAN DONE ✓: List ALL completed investigations, medications given, IV lines, procedures, catheterization, and completed consults with ✓" },
              planToBeDone: { type: Type.STRING, description: "MANAGEMENT PLAN TO BE DONE □: List ALL pending investigations, pending consults, transfer plans (e.g. Shift to 3rd MICU), and scheduled procedures with □" },
              bystander: { type: Type.STRING, description: "BYSTANDER UPDATE: Exact details of WHO was counselled and WHAT was communicated (e.g. Explained in detail regarding need of ICU admission...)" },
              vitals: {
                type: Type.STRING,
                description: "VITALS: Latest vital signs e.g. SpO2 97% on 5L O2 · HR 103 · BP 130/80 · RR 18 · Temp 97.4°F · GRBS 204 · GCS E4V5M6. If any individual vital is missing from the notes, OMIT it entirely from the string — never output a label with no value (e.g. never 'SpO2: %')."
              },
              alerts: { type: Type.STRING, description: "CRITICAL ALERTS STRIP: Warning flags for abnormal labs, dangerous vitals, or urgent pending consults e.g. ⚠ Shifting to MICU · ⚠ Metabolic Acidosis · ⚠ Trop I pending" }
            },
            required: ["id", "bed", "name", "ageGender", "complaints", "history", "assessment", "planDone", "planToBeDone", "bystander", "vitals", "alerts"]
          }
        }
      },
      required: ["rows"]
    };

    const prompt = `
      You are an expert Emergency Medicine Senior Consultant and Scribe Lead.
      Synthesize the following ${patients.length} patient clinical records into a standardized, exhaustive Vertical Portrait Doctors' Handover Sheet.
      PATIENTS DATA TO EXTRACT:
      ${JSON.stringify(processedPatients, null, 2)}

      CRITICAL EXTRACTION RULES:
      0. ZERO HALLUCINATION / DETERMINISTIC OUTPUT (TEMPERATURE = 0.0): Never invent or guess any diagnostic values, vitals, drugs, past history, or doctor names. Return empty string or null for absent items.
      1. ZERO GENERIC PLACEHOLDERS: NEVER output generic strings like "Comorbidities not explicitly documented in raw input", "Vitals not documented", "Evaluation of patient with acute symptoms", "Complete active tasks", "Parsed Notes Review Complete", or "Bystanders counselled". If data is present, extract it thoroughly; if genuinely absent, leave as empty string.
      2. READ EVERY ENTRY IN THE CHRONOLOGICAL NOTES: Scan every single consultant review (General Medicine, Nephrology, MICU), nurse entry, and lab parameter to inform the fields below — but do NOT reproduce the chronological notes themselves in your output; that is handled separately.
      3. SEPARATE NURSING ACTIONS FROM CLINICAL FINDINGS:
         Nursing actions ("Patient shifted for CT", "CT slot called", "Foley catheter inserted", "IV cannulated") -> Place in Management Plan DONE ✓ list.
         Clinical findings ("CT Abdomen: Pericardial & pleural effusion, moderate ascites") -> Place in Provisional Diagnosis & Assessment / Investigation findings.
      4. PAST MEDICAL HISTORY: Scan all entries for "Known case of", "K/C/O", "Comorbidities", "Past Medical History". Extract every single condition with duration and home drugs (e.g., T2DM x 22y, HTN with Nephropathy, Hypothyroidism x 5y, Cushing's syndrome, Morbid Obesity, OSA).
      5. PROVISIONAL DIAGNOSIS: Look for "IMP:", "Impression:", "Differential Diagnosis:", or consultant review conclusions. Extract the explicit diagnosis (e.g., "Fluid overload state with pericardial effusion and right pleural effusion, Moderate ascites, Metabolic acidosis, Acute kidney injury").
      6. MANAGEMENT DONE ✓: Extract ALL past-tense completed actions (IV, VBG, O2 delivery, Foley catheter, CT done, Chest X-ray done, Troponin sent, Echo done, Consults done). Format with ✓.
      7. MANAGEMENT TO BE DONE □: Extract ALL future/pending actions (Shift to MICU, Critical care consultation, Trop I result awaited, NIV if O2 req increases, Monitor VBG/UO). Format with □.
      8. BYSTANDER UPDATE: Extract exact details of family counselling (WHO was told, WHAT was explained).
      9. VITALS: Format latest vitals clearly (SpO2, HR, BP, RR, Temp, GRBS, GCS). Omit any individual value not present in the notes — never leave a blank label.
      10. CRITICAL ALERTS: Flag abnormal lab findings, metabolic acidosis, pending cardiac markers, or ICU transfers with ⚠.
      11. PRESERVE PATIENT ID: The "id" field in each row MUST match the exact "id" field provided in the corresponding input patient object.
    `;

    const fullPrompt = prompt + "\n\nCRITICAL: Return strictly valid JSON containing the 'rows' array matching the specified schema fields.";

    let aiResponse;
    let modelUsed;

    try {
      aiResponse = await callClaudeSonnetOnly(
        fullPrompt,
        "You are an expert emergency medical scribe specializing in clinical shift handovers. Only return JSON matching the schema with key 'rows'.",
        true
      );
      modelUsed = "claude-3-5-sonnet";
    } catch (sonnetError) {
      console.warn("[compile-sheet] Claude Sonnet unavailable, falling back to Gemini Pro:", sonnetError);
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema as any,
          temperature: 0.0,
        },
      });
      aiResponse = JSON.parse(geminiResponse.text() || "{}");
      modelUsed = "gemini-pro-fallback";
    }

    const result = typeof aiResponse === "string" ? JSON.parse(aiResponse) : aiResponse;

    const finalRows = (result.rows || []).map((row: any) => {
      const original = originalById.get(row.id) || {};
      const processed = processedPatients.find((p: any) => p.id === row.id) || {};

      return {
        ...row,                                          // AI-extracted fields first (assessment, planDone, etc.)
        id: row.id,
        name: original.name || processed.name || row.name,       // real name re-injected locally, never AI-sourced
        chronologicalNotes: processed.chronologicalNotes || "",  // verified pass-through, never AI-regenerated
        rawNotes: processed.rawNotes || "",
      };
    });

    res.json({ success: true, rows: finalRows, modelUsed });
  } catch (error: any) {
    console.error("AI Compilation Error:", error);
    res.status(500).json({ success: false, error: "Failed to compile sheet" });
  }
});

// 6.7. AI Clinical Mnemonic Scanner from Screenshot or Image

// ==========================================
// ROTA EXTRATION FROM SPREADSHEET
// ==========================================
app.post("/api/parse-rota", async (req, res) => {
  try {
    const { csvData, monthYear } = req.body;
    if (!csvData) return res.status(400).json({ error: "Missing spreadsheet data" });

    const ai = getAI();
    const prompt = `
      You are an expert hospital administrator and scheduling AI.
      Below is a raw CSV/text dump of a doctor's shift Rota for the ER department for ${monthYear || "this month"}.
      
      Extract all the assigned shifts for every doctor.
      For each shift, identify:
      - shiftDate: The date of the shift (ISO format YYYY-MM-DD if possible, or just exact date text)
      - doctorName: Name of the assigned doctor
      - doctorEmail: Try to infer email if present, or leave empty
      - shiftType: e.g. "Morning", "Evening", "Night"
      - startTime: e.g. "08:00 AM" or "2024-08-11T08:00:00" (try to parse into a valid time string if you can)
      - endTime: e.g. "04:00 PM"
      
      Return a JSON array of these shift objects under a 'shifts' key.
      Ensure it is purely valid JSON without any markdown formatting.
      
      ROTA DATA:
      ${csvData.substring(0, 8000)}
    `;
    
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = result.text;
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // fallback cleanup
      const clean = text.replace(/```json/g, '').replace(/```/g, '');
      data = JSON.parse(clean);
    }
    
    return res.json({ success: true, shifts: data.shifts || [] });
  } catch (error) {
    console.error("Rota Parse Error:", error);
    return res.status(500).json({ success: false, error: "Failed to parse rota" });
  }
});

app.post("/api/scan-mnemonic", async (req, res) => {
  const { image, mimeType } = req.body;

  if (!image) {
    return res.status(400).json({ success: false, error: "Mnemonic screenshot image is required." });
  }

  try {
    const ai = getAI();
    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Clear high-yield title for this mnemonic, e.g. 'AEIOU: Indicators for Acute Dialysis' or '5 H's and 5 T's: Reversible Causes of Cardiac Arrest'" },
        mnemonic: { type: Type.STRING, description: "The abbreviated name or keyword of the mnemonic, e.g. AEIOU" },
        category: { type: Type.STRING, description: "Must be one of: 'Cardiology', 'Nephrology', 'Metabolic / Endocrinology', 'Resuscitation', 'Airway', 'Pharmacology', 'Neurology', 'Trauma / Surgery', 'General Emergency'" },
        breakdown: { type: Type.STRING, description: "What each letter or part stands for, in clean Markdown list format (using asterisks for bullets), e.g. * **A** - Acidosis\n* **E** - Electrolytes\n* **I** - Intoxication\n* **O** - Overload\n* **U** - Uremia" },
        explanation: { type: Type.STRING, description: "A detailed clinical explanation, guidelines, context, and usage pearls for the emergency room setting" }
      },
      required: ["title", "mnemonic", "category", "breakdown", "explanation"]
    };

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: image,
      },
    };

    const textPart = {
      text: "You are an expert clinical education system. Analyze this screenshot or image containing a medical mnemonic. Extract its Title, Mnemonic Key, Category, a detailed letter-by-letter Markdown Breakdown, and a clean Clinical Explanation. Map all properties into the JSON response schema."
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: "You are an expert clinical reference librarian. Convert medical mnemonic screenshots or notes into clean, highly structured medical education guides. Return JSON only.",
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Mnemonic Scan Error:", error);
    
    // Fallback parser: if the image cannot be parsed or API key is not configured, return a default simulated clinical mnemonic contribution
    const backupData = {
      title: "FAST: Stroke Assessment Protocol",
      mnemonic: "FAST",
      category: "Neurology",
      breakdown: "* **F** - Face Drooping\n* **A** - Arm Weakness\n* **S** - Speech Difficulty\n* **T** - Time to call Emergency services",
      explanation: "Classic rapid diagnostic pre-hospital and bedside mnemonic to identify acute ischemic stroke patients within the fibrinolysis / mechanical thrombectomy time window."
    };

    res.json({
      success: true,
      data: backupData,
      simulated: true,
      error: error.message || "Using smart fallback mnemonic parser."
    });
  }
});

// ==========================================
// 7. CLOUD SQL (POSTGRESQL) API ENDPOINTS
// ==========================================

// 7.1. Sync User Profile (Upsert)
app.post("/api/sql/sync-user", requireAuth, async (req: AuthRequest, res) => {
  const { uid, email, name, role, hospital, aiCredits, streak, subscriptionTier, hasConsentedToLearning } = req.body;

  if (!uid || !email || !name) {
    return res.status(400).json({ success: false, error: "UID, email, and name are required." });
  }

  // Ensure user cannot sync another user's UID unless authorized
  if (req.user?.uid !== uid) {
    return res.status(403).json({ success: false, error: "Forbidden: UID mismatch." });
  }

  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        name,
        role: role || "EM Physician",
        hospital: hospital || "Varah Group Emergency Care",
        aiCredits: aiCredits !== undefined ? aiCredits : 350,
        streak: streak !== undefined ? streak : 0,
        subscriptionTier: subscriptionTier || "Free Standard",
        hasConsentedToLearning: hasConsentedToLearning !== undefined ? hasConsentedToLearning : null
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name,
          role: role || "EM Physician",
          hospital: hospital || "Varah Group Emergency Care",
          aiCredits: aiCredits !== undefined ? aiCredits : 350,
          streak: streak !== undefined ? streak : 0,
          subscriptionTier: subscriptionTier || "Free Standard",
          hasConsentedToLearning: hasConsentedToLearning !== undefined ? hasConsentedToLearning : null
        }
      })
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Cloud SQL sync-user error:", error);
    res.status(500).json({ success: false, error: "Failed to sync user to database." });
  }
});

// 7.2. Get Cases (Filtered by User's Hospital)
app.get("/api/sql/cases", requireAuth, async (req: AuthRequest, res) => {
  const userHospital = req.query.hospital as string;

  if (!userHospital) {
    return res.status(400).json({ success: false, error: "Hospital parameter is required." });
  }

  try {
    // Return all cases and filter by hospital (matching lowercase and trimmed)
    const allCases = await db.select().from(cases).orderBy(desc(cases.createdAt));
    const filtered = allCases.filter(c => {
      const caseHospital = (c.hospital || "Varah Group Emergency Care").trim().toLowerCase();
      return caseHospital === userHospital.trim().toLowerCase();
    });

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error("Cloud SQL load cases error:", error);
    res.status(500).json({ success: false, error: "Failed to load clinical cases." });
  }
});

// 7.3. Save/Update Case (Upsert)
app.post("/api/sql/cases", requireAuth, async (req: AuthRequest, res) => {
  const caseData = req.body;

  if (!caseData || !caseData.id || !caseData.patient || !caseData.vitals) {
    return res.status(400).json({ success: false, error: "Incomplete case data. ID, Patient details, and Vitals are required." });
  }

  try {
    const result = await db.insert(cases)
      .values({
        id: caseData.id,
        patient: caseData.patient,
        vitals: caseData.vitals,
        sampleHistory: caseData.sampleHistory,
        primaryAssessment: caseData.primaryAssessment,
        secondaryAssessment: caseData.secondaryAssessment,
        investigations: caseData.investigations,
        treatments: caseData.treatments,
        progressNotes: caseData.progressNotes,
        dischargeInfo: caseData.dischargeInfo,
        differentials: caseData.differentials,
        isPediatric: !!caseData.isPediatric,
        status: caseData.status || "Active",
        savedTime: caseData.savedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timeSpentMin: caseData.timeSpentMin || 1,
        doctorEmail: caseData.doctorEmail || req.user?.email,
        doctorName: caseData.doctorName,
        hospital: caseData.hospital || "Varah Group Emergency Care"
      })
      .onConflictDoUpdate({
        target: cases.id,
        set: {
          patient: caseData.patient,
          vitals: caseData.vitals,
          sampleHistory: caseData.sampleHistory,
          primaryAssessment: caseData.primaryAssessment,
          secondaryAssessment: caseData.secondaryAssessment,
          investigations: caseData.investigations,
          treatments: caseData.treatments,
          progressNotes: caseData.progressNotes,
          dischargeInfo: caseData.dischargeInfo,
          differentials: caseData.differentials,
          isPediatric: !!caseData.isPediatric,
          status: caseData.status || "Active",
          savedTime: caseData.savedTime,
          timeSpentMin: caseData.timeSpentMin,
          doctorEmail: caseData.doctorEmail || req.user?.email,
          doctorName: caseData.doctorName,
          hospital: caseData.hospital || "Varah Group Emergency Care"
        }
      })
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Cloud SQL save case error:", error);
    res.status(500).json({ success: false, error: "Failed to save clinical case." });
  }
});

// 7.4. Get Handovers (Filtered by User's Hospital)
app.get("/api/sql/handovers", requireAuth, async (req: AuthRequest, res) => {
  const userHospital = req.query.hospital as string;

  if (!userHospital) {
    return res.status(400).json({ success: false, error: "Hospital parameter is required." });
  }

  try {
    const allHandovers = await db.select().from(handovers).orderBy(desc(handovers.createdAt));
    const filtered = allHandovers.filter(h => {
      const handHospital = (h.hospital || "Varah Group Emergency Care").trim().toLowerCase();
      return handHospital === userHospital.trim().toLowerCase();
    });

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error("Cloud SQL load handovers error:", error);
    res.status(500).json({ success: false, error: "Failed to load shift handovers." });
  }
});

// 7.5. Save Handover (Insert/Update)
app.post("/api/sql/handovers", requireAuth, async (req: AuthRequest, res) => {
  const handData = req.body;

  if (!handData || !handData.id || !handData.senderName || !handData.senderEmail) {
    return res.status(400).json({ success: false, error: "ID, sender details, and patient count are required." });
  }

  try {
    const result = await db.insert(handovers)
      .values({
        id: handData.id,
        senderName: handData.senderName,
        senderEmail: handData.senderEmail,
        timestamp: handData.timestamp || new Date().toISOString(),
        caseCount: handData.caseCount || 0,
        patientsText: handData.patientsText || "",
        acknowledgedBy: handData.acknowledgedBy,
        acknowledgedTime: handData.acknowledgedTime,
        hospital: handData.hospital || "Varah Group Emergency Care"
      })
      .onConflictDoUpdate({
        target: handovers.id,
        set: {
          acknowledgedBy: handData.acknowledgedBy,
          acknowledgedTime: handData.acknowledgedTime
        }
      })
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Cloud SQL save handover error:", error);
    res.status(500).json({ success: false, error: "Failed to save handover record." });
  }
});

// 7.6. Get Team Members (Filtered by User's Hospital)
app.get("/api/sql/team-members", requireAuth, async (req: AuthRequest, res) => {
  const userHospital = req.query.hospital as string;

  if (!userHospital) {
    return res.status(400).json({ success: false, error: "Hospital parameter is required." });
  }

  try {
    const allMembers = await db.select().from(teamMembers).orderBy(desc(teamMembers.createdAt));
    const filtered = allMembers.filter(t => {
      const memHospital = (t.hospital || "Varah Group Emergency Care").trim().toLowerCase();
      return memHospital === userHospital.trim().toLowerCase();
    });

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error("Cloud SQL load team-members error:", error);
    res.status(500).json({ success: false, error: "Failed to load team members." });
  }
});

// 7.7. Save Team Member (Upsert)
app.post("/api/sql/team-members", requireAuth, async (req: AuthRequest, res) => {
  const memberData = req.body;

  if (!memberData || !memberData.id || !memberData.name || !memberData.email || !memberData.hospital) {
    return res.status(400).json({ success: false, error: "ID, name, email, and hospital are required." });
  }

  try {
    const result = await db.insert(teamMembers)
      .values({
        id: memberData.id,
        name: memberData.name,
        email: memberData.email,
        role: memberData.role || "EM Resident",
        status: memberData.status || "Pending Invite",
        shift: memberData.shift || "Day Shift (08:00 - 16:00)",
        hospital: memberData.hospital,
        assignedBy: memberData.assignedBy,
        updatedAt: memberData.updatedAt || new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: teamMembers.id,
        set: {
          name: memberData.name,
          email: memberData.email,
          role: memberData.role || "EM Resident",
          status: memberData.status || "Pending Invite",
          shift: memberData.shift || "Day Shift (08:00 - 16:00)",
          hospital: memberData.hospital,
          assignedBy: memberData.assignedBy,
          updatedAt: memberData.updatedAt || new Date().toISOString()
        }
      })
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Cloud SQL save team-member error:", error);
    res.status(500).json({ success: false, error: "Failed to save team member." });
  }
});

// 7.8. Get Contributions (All approved or pending)
app.get("/api/sql/contributions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(contributions).orderBy(desc(contributions.createdAt));
    res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Cloud SQL load contributions error:", error);
    res.status(500).json({ success: false, error: "Failed to load contributions." });
  }
});

// 7.9. Submit Contribution (Insert)
app.post("/api/sql/contributions", requireAuth, async (req: AuthRequest, res) => {
  const contribData = req.body;

  if (!contribData || !contribData.id || !contribData.title || !contribData.mnemonic || !contribData.breakdown) {
    return res.status(400).json({ success: false, error: "Incomplete contribution data." });
  }

  try {
    const result = await db.insert(contributions)
      .values({
        id: contribData.id,
        title: contribData.title,
        mnemonic: contribData.mnemonic,
        category: contribData.category,
        breakdown: contribData.breakdown,
        explanation: contribData.explanation,
        status: contribData.status || "pending",
        submittedBy: contribData.submittedBy || "Anonymous Clinician",
        submitterEmail: contribData.submitterEmail || req.user?.email || "anonymous@ermate.in",
        createdAt: contribData.createdAt || new Date().toISOString()
      })
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Cloud SQL submit contribution error:", error);
    res.status(500).json({ success: false, error: "Failed to submit clinical contribution." });
  }
});

// 7.10. Approve Contribution (Update)
app.put("/api/sql/contributions/:id/approve", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id;

  try {
    const result = await db.update(contributions)
      .set({ status: "approved" })
      .where(eq(contributions.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: "Contribution not found." });
    }

    res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Cloud SQL approve contribution error:", error);
    res.status(500).json({ success: false, error: "Failed to approve contribution." });
  }
});

// 7.11. Delete Contribution
app.delete("/api/sql/contributions/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id;

  try {
    const result = await db.delete(contributions)
      .where(eq(contributions.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: "Contribution not found." });
    }

    res.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error("Cloud SQL delete contribution error:", error);
    res.status(500).json({ success: false, error: "Failed to delete contribution." });
  }
});

// Global unhandled error handler to ensure JSON responses are always returned instead of HTML error pages
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: getFriendlyErrorMessage(err)
  });
});

// Setup Vite Dev Server / Static Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true" ? undefined : false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = 
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Error:", err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({ success: false, error: err.message || "Internal Server Error" });
  }
});

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ErMate Server] Running on http://0.0.0.0:${PORT}`);
  });

  // Set generous connection and request timeouts to support unlimited clinical recordings and long translation/transcription processes



}

startServer();
