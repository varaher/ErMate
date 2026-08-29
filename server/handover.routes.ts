// ============================================================
// ErMate — Express Routes for Handover
// File: server/handover.routes.ts
// ============================================================

import { Router, Request, Response } from 'express';
import { extractHandover } from './handover.ts';

const router = Router();

router.post(
  '/api/handover/parse-structured',
  async (req: Request, res: Response) => {
    const { rawText, doctorName, patientName } = req.body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'No text provided',
      });
    }

    const result = await extractHandover(rawText, doctorName, patientName);

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json(result);
  }
);

export default router;