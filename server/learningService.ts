import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;
let isAnthropicDisabledInLearning = false;

function getAnthropic(): Anthropic | null {
  if (isAnthropicDisabledInLearning) return null;
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey.trim() !== "" && apiKey !== "MY_ANTHROPIC_API_KEY") {
      anthropicClient = new Anthropic({ apiKey });
    }
  }
  return anthropicClient;
}

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

// In-memory backing store (hydrated and mirrored to Firestore/JSON in production)
let feedbackCorrectionsStore: FeedbackCorrection[] = [
  {
    id: "corr_001",
    field: "imaging_modality",
    ai_output: "MRI Brain requested for syncope workup",
    corrected_output: "CT Brain + C-Spine non-contrast",
    source_context: "72y M syncope with collapse. CT Brain + C-Spine ordered in ER.",
    corrected_by: "dr.varah@ermate.ai",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    case_type: "syncope_workup",
    processed: true
  },
  {
    id: "corr_002",
    field: "imaging_modality",
    ai_output: "MRI Brain",
    corrected_output: "CT Brain non-contrast",
    source_context: "Fall from height, head injury, CT Brain ordered immediately.",
    corrected_by: "dr.ananya@ermate.ai",
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    case_type: "trauma_head_injury",
    processed: true
  }
];

let learnedRulesStore: LearnedRule[] = [
  {
    id: "r_001",
    rule: "When source text specifies 'CT Brain', 'CT C-Spine', or emergency head trauma/syncope, never substitute or output 'MRI Brain'. CT is the primary emergency imaging modality for trauma/syncope.",
    trigger_keywords: ["CT Brain", "MRI Brain", "C-Spine", "head trauma", "syncope"],
    case_type: "syncope_workup",
    confidence: "high",
    severity: "safety_critical",
    supporting_examples: [
      "AI output 'MRI Brain' corrected to 'CT Brain + C-Spine non-contrast'",
      "AI output 'MRI Brain' corrected to 'CT Brain non-contrast'"
    ],
    approved: true,
    active: true,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    approvedBy: "dr_neeraj"
  },
  {
    id: "r_002",
    rule: "For paediatric acute asthma presentations, do not recommend routine antibiotics (Azithromycin/Amoxicillin) unless there is clear documented fever with focal pulmonary consolidation on chest X-ray.",
    trigger_keywords: ["asthma", "paediatric", "wheeze", "azithromycin", "antibiotic"],
    case_type: "paediatric_asthma",
    confidence: "high",
    severity: "safety_critical",
    supporting_examples: [
      "Removed empirical Azithromycin from paediatric asthma management plan"
    ],
    approved: true,
    active: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    approvedBy: "dr_neeraj"
  },
  {
    id: "r_003",
    rule: "When documenting vitals in handover summary, preserve exact blood pressure readings (e.g. 142/88 mmHg) rather than rounding or categorizing as 'Mild Hypertension'.",
    trigger_keywords: ["vitals", "BP", "blood pressure", "hypertension"],
    case_type: "general_er",
    confidence: "medium",
    severity: "quality",
    supporting_examples: [
      "Replaced 'Mild Hypertension' with exact 'BP 142/88 mmHg' in handover card"
    ],
    approved: false, // Pending review in queue
    active: false,
    createdAt: new Date().toISOString()
  }
];

// Helper to filter factual vs purely stylistic edits
export function isFactualCorrection(aiOutput: string, correctedOutput: string): boolean {
  if (!aiOutput || !correctedOutput) return false;
  const cleanAI = aiOutput.trim().toLowerCase();
  const cleanCorr = correctedOutput.trim().toLowerCase();
  if (cleanAI === cleanCorr) return false;

  // Ignore simple spacing or punctuation changes
  const normalizedAI = cleanAI.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  const normalizedCorr = cleanCorr.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  if (normalizedAI === normalizedCorr) return false;

  // If text contains numbers, drugs, modalities, or key medical terms that differ, it's factual
  return true;
}

// 1. Capture Clinician Feedback
export function recordFeedbackCorrection(
  field: string,
  aiOutput: string,
  correctedOutput: string,
  sourceContext: string,
  correctedBy: string = "clinician",
  caseType?: string
): FeedbackCorrection | null {
  if (!isFactualCorrection(aiOutput, correctedOutput)) {
    return null; // Discard purely stylistic or identical edits
  }

  const correction: FeedbackCorrection = {
    id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    field,
    ai_output: aiOutput,
    corrected_output: correctedOutput,
    source_context: sourceContext || "Direct clinician field edit",
    corrected_by: correctedBy,
    timestamp: new Date().toISOString(),
    case_type: caseType || "general",
    processed: false
  };

  feedbackCorrectionsStore.unshift(correction);
  return correction;
}

// 2. Pattern Extraction Pass (Offline LLM Processing)
export async function extractPatternsFromUnprocessedFeedback(apiKey?: string): Promise<{ newRules: LearnedRule[]; processedCount: number }> {
  const unprocessed = feedbackCorrectionsStore.filter(c => !c.processed);
  if (unprocessed.length === 0) {
    return { newRules: [], processedCount: 0 };
  }

  const prompt = `
You are reviewing clinician corrections to AI-generated clinical documentation in ErMate Emergency System.
For each correction below, determine if it reveals a GENERALIZABLE clinical rule or pattern (something likely to recur) or a ONE-OFF error.

Corrections Batch:
${JSON.stringify(unprocessed, null, 2)}

Return a JSON ARRAY of generalizable rules. Each object MUST strictly follow this JSON schema:
[
  {
    "rule": "Short, specific instruction for the AI generation model",
    "trigger_keywords": ["keyword1", "keyword2", "keyword3"],
    "case_type": "category e.g. syncope_workup, trauma, drug_dosing",
    "confidence": "high" | "medium" | "low",
    "severity": "safety_critical" | "quality",
    "supporting_examples": ["Brief summary of original error and correction"]
  }
]

Do NOT wrap output in markdown fences if possible, or return valid JSON inside \`\`\`json.
`;

  let extractedList: any[] = [];

  // Primary Engine: Claude Sonnet (claude-3-5-sonnet-20241022) for high clinical precision and rule extraction
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }]
      });

      const text = (msg.content[0] as any)?.text || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedList = JSON.parse(jsonMatch[0]);
      }
    } catch (err: any) {
      console.warn("[Learning Pattern Extraction] Claude Sonnet unavailable or credit limit reached, failing over to Gemini 2.5 Flash:", err?.message || err);
      if (err?.status === 400 || err?.status === 401 || err?.status === 402 || String(err?.message || "").includes("credit balance")) {
        isAnthropicDisabledInLearning = true;
      }
    }
  }

  // Secondary Fallback: Gemini 2.5 Flash if Claude Sonnet is unavailable
  if (extractedList.length === 0) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const text = response.text || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedList = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.error("[Learning Pattern Extraction - Gemini Fallback Error]", err);
      }
    }
  }

  // Fallback pattern extraction if offline or no key
  if (extractedList.length === 0) {
    unprocessed.forEach(c => {
      extractedList.push({
        rule: `When generating field '${c.field}', strictly prefer '${c.corrected_output.slice(0, 100)}' over '${c.ai_output.slice(0, 100)}' when context includes '${c.source_context.slice(0, 60)}'.`,
        trigger_keywords: [c.field, c.case_type || "general"],
        case_type: c.case_type || "general",
        confidence: "medium",
        severity: c.field.includes("drug") || c.field.includes("dose") || c.field.includes("modality") ? "safety_critical" : "quality",
        supporting_examples: [`Correction in ${c.field}: "${c.ai_output}" -> "${c.corrected_output}"`]
      });
    });
  }

  const newRules: LearnedRule[] = [];
  extractedList.forEach((item, index) => {
    const ruleObj: LearnedRule = {
      id: `r_${Date.now()}_${index}`,
      rule: item.rule || "Extracted rule",
      trigger_keywords: Array.isArray(item.trigger_keywords) ? item.trigger_keywords : ["clinical"],
      case_type: item.case_type || "general",
      confidence: item.confidence === "high" || item.confidence === "low" ? item.confidence : "medium",
      severity: item.severity === "safety_critical" ? "safety_critical" : "quality",
      supporting_examples: Array.isArray(item.supporting_examples) ? item.supporting_examples : ["Clinician edit"],
      approved: false, // Requires clinician human sign-off!
      active: false,
      createdAt: new Date().toISOString()
    };
    learnedRulesStore.unshift(ruleObj);
    newRules.push(ruleObj);
  });

  // Mark processed
  unprocessed.forEach(c => c.processed = true);

  return { newRules, processedCount: unprocessed.length };
}

// 3. Retrieve Relevant Learned Rules at Generation Time
export function getRelevantLearnedRules(sourceContext: string = "", caseType?: string, maxRules: number = 8): LearnedRule[] {
  const activeRules = learnedRulesStore.filter(r => r.active && r.approved);
  if (activeRules.length === 0) return [];

  const lowerContext = (sourceContext || "").toLowerCase();
  const lowerCaseType = (caseType || "").toLowerCase();

  // Score rules by relevance
  const scored = activeRules.map(rule => {
    let score = 0;

    // Safety-critical rules get automatic boost
    if (rule.severity === 'safety_critical') {
      score += 5;
    }

    if (rule.case_type && lowerCaseType && rule.case_type.toLowerCase() === lowerCaseType) {
      score += 10;
    }

    rule.trigger_keywords.forEach(kw => {
      if (kw && lowerContext.includes(kw.toLowerCase())) {
        score += 3;
      }
    });

    return { rule, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top N rules with positive score or high severity
  return scored
    .filter(item => item.score > 0 || item.rule.severity === 'safety_critical')
    .slice(0, maxRules)
    .map(item => item.rule);
}

// 4. Format Rules into System Prompt Block
export function formatLearnedRulesPromptBlock(rules: LearnedRule[]): string {
  if (!rules || rules.length === 0) return "";

  const formattedRules = rules
    .map((r, i) => `${i + 1}. [${r.severity.toUpperCase()}] ${r.rule}`)
    .join("\n");

  return `
LEARNED CORRECTIONS & CLINICIAN RULES (RELEVANT TO THIS CASE):
These are real clinical corrections made by senior emergency physicians in past encounters. Apply them strictly — they take precedence over default assumptions:
${formattedRules}
`;
}

// 5. Store Accessors for Admin
export function getAllFeedbackCorrections(): FeedbackCorrection[] {
  return feedbackCorrectionsStore;
}

export function getAllLearnedRules(): LearnedRule[] {
  return learnedRulesStore;
}

export function updateRuleStatus(ruleId: string, approved: boolean, active: boolean, approvedBy?: string): LearnedRule | null {
  const rule = learnedRulesStore.find(r => r.id === ruleId);
  if (rule) {
    rule.approved = approved;
    rule.active = active;
    if (approvedBy) rule.approvedBy = approvedBy;
    return rule;
  }
  return null;
}

export function createManualLearnedRule(
  ruleText: string,
  triggerKeywords: string[],
  caseType: string,
  severity: 'safety_critical' | 'quality',
  createdBy: string = "Dr. Neeraj"
): LearnedRule {
  const newRule: LearnedRule = {
    id: `r_${Date.now()}`,
    rule: ruleText,
    trigger_keywords: triggerKeywords.length > 0 ? triggerKeywords : ["general"],
    case_type: caseType || "general",
    confidence: "high",
    severity: severity || "quality",
    supporting_examples: [`Directly authored by ${createdBy}`],
    approved: true, // Manual admin creation is auto-approved
    active: true,
    createdAt: new Date().toISOString(),
    approvedBy: createdBy
  };
  learnedRulesStore.unshift(newRule);
  return newRule;
}

export function deleteLearnedRule(ruleId: string): boolean {
  const initialLen = learnedRulesStore.length;
  learnedRulesStore = learnedRulesStore.filter(r => r.id !== ruleId);
  return learnedRulesStore.length < initialLen;
}
