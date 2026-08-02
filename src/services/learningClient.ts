export interface FeedbackCorrection {
  id: string;
  field: string;
  ai_output: string;
  corrected_output: string;
  source_context: string;
  corrected_by: string;
  timestamp: string;
  case_type?: string;
  processed?: boolean;
}

export interface LearnedRule {
  id: string;
  rule: string;
  trigger_keywords: string[];
  case_type?: string;
  confidence: 'low' | 'medium' | 'high';
  severity: 'safety_critical' | 'quality';
  supporting_examples: string[];
  approved: boolean;
  active: boolean;
  createdAt: string;
  approvedBy?: string;
}

export async function captureFeedbackCorrection(
  field: string,
  aiOutput: string,
  correctedOutput: string,
  sourceContext: string,
  caseType?: string,
  correctedBy?: string
): Promise<{ captured: boolean; feedback?: FeedbackCorrection }> {
  try {
    if (!aiOutput || !correctedOutput || aiOutput.trim() === correctedOutput.trim()) {
      return { captured: false };
    }

    const response = await fetch('/api/learning/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field,
        ai_output: aiOutput,
        corrected_output: correctedOutput,
        source_context: sourceContext || '',
        case_type: caseType || 'general',
        corrected_by: correctedBy || 'Doctor'
      })
    });

    if (!response.ok) return { captured: false };
    const data = await response.json();
    return { captured: Boolean(data.captured), feedback: data.feedback };
  } catch (err) {
    console.warn('[Learning Client] Feedback capture error:', err);
    return { captured: false };
  }
}

export async function fetchLearningRulesAndCorrections(): Promise<{ rules: LearnedRule[]; corrections: FeedbackCorrection[] }> {
  try {
    const res = await fetch('/api/learning/rules');
    if (!res.ok) return { rules: [], corrections: [] };
    const data = await res.json();
    return { rules: data.rules || [], corrections: data.corrections || [] };
  } catch (err) {
    console.warn('[Learning Client] Fetch rules error:', err);
    return { rules: [], corrections: [] };
  }
}

export async function extractGeneralizableRules(): Promise<{ processedCount: number; newRules: LearnedRule[]; rules: LearnedRule[] }> {
  try {
    const res = await fetch('/api/learning/extract-rules', { method: 'POST' });
    if (!res.ok) throw new Error('Pattern extraction failed');
    return await res.json();
  } catch (err) {
    console.error('[Learning Client] Pattern extraction error:', err);
    return { processedCount: 0, newRules: [], rules: [] };
  }
}

export async function reviewLearnedRule(ruleId: string, approved: boolean, active: boolean, approvedBy?: string): Promise<LearnedRule | null> {
  try {
    const res = await fetch('/api/learning/rules/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, approved, active, approvedBy })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.rule || null;
  } catch (err) {
    console.error('[Learning Client] Review rule error:', err);
    return null;
  }
}

export async function createManualRule(
  ruleText: string,
  triggerKeywords: string[],
  caseType: string,
  severity: 'safety_critical' | 'quality',
  createdBy?: string
): Promise<LearnedRule | null> {
  try {
    const res = await fetch('/api/learning/rules/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleText, triggerKeywords, caseType, severity, createdBy })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.rule || null;
  } catch (err) {
    console.error('[Learning Client] Create manual rule error:', err);
    return null;
  }
}

export async function deleteLearnedRule(ruleId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/learning/rules/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId })
    });
    return res.ok;
  } catch (err) {
    console.error('[Learning Client] Delete rule error:', err);
    return false;
  }
}
