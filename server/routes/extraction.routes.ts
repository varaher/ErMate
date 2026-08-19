// ============================================================
// ErMate — Express Routes for Extraction
// File: server/routes/extraction.routes.ts
// ============================================================

import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  extractClinicalData,
  extractHandoverData,
  generateDischargeSummary,
  generateDifferentials,
} from '../extraction.ts';
import { generateDischargeSummary as generateEMRDischargeSummary } from '../dischargeSummary.ts';

const router = Router();

// ── Route 1: Voice dictation → case extraction ────────────────
// Called after Sarvam transcribes the audio
router.post(
  '/api/voice/extract-clinical',
  async (req: Request, res: Response) => {
    const transcript = req.body.transcript || req.body.dictation;

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({
        success: false,
        error: 'No transcript provided',
      });
    }

    console.log('[Route] extract-clinical — length:', transcript.length);

    const result = await extractClinicalData(transcript);

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json({
      success: true,
      data: result.data || result.extracted,
      extracted: result.extracted || result.data,
      isHeuristicFallback: result.isHeuristicFallback || false
    });
  }
);

// ── Route 2: Paste EMR & Case Sheet Image → handover extraction ─────────────────
router.post(
  '/api/handover/parse-structured',
  async (req: Request, res: Response) => {
    const { image, mimeType, rawText, doctorName, patientName } = req.body;

    const hasText = typeof rawText === 'string' && rawText.trim().length > 0;
    const hasImage = typeof image === 'string' && image.length > 10;

    if (!hasText && !hasImage) {
      return res.status(400).json({
        success: false,
        error: 'No text or image provided for handover extraction',
      });
    }

    console.log('[Route] parse-structured — text length:', hasText ? rawText.length : 0, 'hasImage:', hasImage);

    // If an image is uploaded (e.g. handwritten case sheet / camera scan)
    if (hasImage) {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('ErMate API key is missing');
        }
        const ai = new GoogleGenAI({ apiKey });

        const schema = {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Patient name or Bed ID if name is not available" },
            ageGender: { type: Type.STRING, description: "Age and gender (e.g., 57F, 45y / Male, or 'Unknown')" },
            inERSince: { type: Type.STRING, description: "Time or timestamp when patient arrived" },
            triage: { type: Type.STRING, description: "Triage Priority level ('P1 (Immediate)', 'P2 (Urgent)', 'P3 (Non-Urgent)')" },
            vitals: { type: Type.STRING, description: "Vital signs extracted or summarized" },
            presentingComplaint: { type: Type.STRING, description: "Chief presenting complaint, primary symptoms, onset, duration" },
            rawNotes: { type: Type.STRING, description: "Transcription or compilation of raw text" },
            structuredSBAR: {
              type: Type.OBJECT,
              properties: {
                situation: { type: Type.STRING, description: "Situation (S): Bed/room, age/gender, and provisional diagnosis." },
                background: { type: Type.STRING, description: "Background (B): Comorbidities and past medical history." },
                assessment: { type: Type.STRING, description: "Assessment (A): Most recent vitals, physical exam highlights, investigations." },
                recommendation: { type: Type.STRING, description: "Recommendation (R): Pending actions, transfers, consults." }
              },
              required: ["situation", "background", "assessment", "recommendation"]
            }
          },
          required: ["name", "ageGender", "triage", "vitals", "presentingComplaint", "rawNotes", "structuredSBAR"]
        };

        const imagePart = {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: image,
          },
        };
        const textPart = {
          text: `You are an expert Emergency Medicine Clinical Lead extracting a clinical handover from a case sheet photo or referral letter. Extract ALL clinical information (patient name, age/gender, triage, vitals, chief complaints, PMH, diagnosis, done actions, pending tasks). Text overlay: "${rawText || ""}"`
        };

        const candidates = ['gemini-2.0-flash', 'gemini-1.5-flash'];
        let parsedData: any = null;

        for (const modelCandidate of candidates) {
          try {
            const resp = await ai.models.generateContent({
              model: modelCandidate,
              contents: { parts: [imagePart, textPart] },
              config: {
                systemInstruction: "You are an expert emergency medical scribe specializing in clinical shift handovers. Convert medical documents and case sheet images into highly structured SBAR handovers in JSON.",
                temperature: 0.0,
                responseMimeType: "application/json",
                responseSchema: schema
              }
            });
            if (resp.text) {
              parsedData = JSON.parse(resp.text);
              break;
            }
          } catch (mErr) {
            console.warn(`[Parse-Structured Vision] Candidate ${modelCandidate} failed:`, mErr);
          }
        }

        if (parsedData) {
          return res.json({ success: true, data: parsedData, extracted: parsedData });
        }
      } catch (imgErr) {
        console.warn("[Parse-Structured] Image vision failed, falling back to text pipeline:", imgErr);
      }
    }

    // Default to full 5-step handover pipeline
    const result = await extractHandoverData(rawText || "Uploaded Case Sheet Photo", doctorName, patientName);
    return res.json(result);
  }
);

// ── Route 3: Generate discharge summary from registered case ─────
router.post(
  '/api/discharge-summary',
  async (req: Request, res: Response) => {
    const { caseData } = req.body;

    if (!caseData) {
      return res.status(400).json({
        success: false,
        error: 'No case data provided',
      });
    }

    const result = await generateDischargeSummary(caseData);

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json(result);
  }
);

// ── Route 3b: Direct EMR Paste → Generate structured Discharge Summary ──
router.post(
  '/api/discharge-summary/generate',
  async (req: Request, res: Response) => {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'No EMR text provided',
      });
    }

    console.log('[Route] discharge-summary/generate — length:', rawText.length);

    const result = await generateEMRDischargeSummary(rawText);

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json(result);
  }
);

// ── Route 4: Generate differentials ──────────────────────────
router.post(
  '/api/differentials',
  async (req: Request, res: Response) => {
    const { caseData } = req.body;

    if (!caseData) {
      return res.status(400).json({
        success: false,
        error: 'No case data provided',
      });
    }

    const result = await generateDifferentials(caseData);

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json(result);
  }
);

export default router;
