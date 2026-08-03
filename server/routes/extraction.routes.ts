// ============================================================
// ErMate — Express Routes for Extraction
// File: server/routes/extraction.routes.ts
// ============================================================

import { Router, Request, Response } from 'express';
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

// ── Route 2: Paste EMR → handover extraction ─────────────────
router.post(
  '/api/handover/parse-structured',
  async (req: Request, res: Response) => {
    const { rawText, doctorName } = req.body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'No text provided',
      });
    }

    console.log('[Route] parse-structured — length:', rawText.length);

    const result = await extractHandoverData(rawText, doctorName);

    if (!result.success) {
      return res.status(500).json(result);
    }

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
