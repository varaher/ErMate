import Anthropic from "@anthropic-ai/sdk";
import { deidentifyText } from "./deidentify.ts";
let anthropicClient: Anthropic | null = null;
let anthropicDisabledUntilInLearning = 0; // epoch ms; 0 = not disabled

function getAnthropic(): Anthropic | null {
  if (Date.now() < anthropicDisabledUntilInLearning) return null;
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

export type RulePopulation = 'adult' | 'paediatric';

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
  /** Verified reviewer identity, taken from the authenticated token (never from the request body). */
  approvedBy?: string;
  approvedByUid?: string;
  /** If set, the rule is only ever used for this population; unknown population never matches it. */
  population?: RulePopulation;
  /** Shipped with the code, not learned from any clinician. */
  builtIn?: boolean;
}

// In-memory ONLY — NOT persisted. Resets on every server restart/redeploy.
// Firestore persistence is not built yet. Do not treat this as durable storage.
//
// No simulated corrections and no fabricated approval records: until real,
// consented capture exists this list stays empty.
let feedbackCorrectionsStore: FeedbackCorrection[] = [];

// One built-in documentation-fidelity rule. It is shipped with the code (builtIn),
// has no reviewer record, and only preserves what the doctor dictated. It never
// recommends CT over MRI or the reverse.
let learnedRulesStore: LearnedRule[] = [
  {
    id: "builtin_investigation_fidelity",
    rule: "Record every investigation exactly as it appears in the source text. Do not change CT to MRI or MRI to CT, and do not add an investigation that was not mentioned.",
    trigger_keywords: ["CT", "MRI", "X-ray", "CXR", "ultrasound", "USG"],
    case_type: "general",
    confidence: "high",
    severity: "quality",
    supporting_examples: [],
    approved: true,
    active: true,
    createdAt: "2026-11-28T00:00:00.000Z",
    builtIn: true
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

  // DPDP Act 2023 — de-identify BEFORE storage. This is the only place
  // PHI can enter the learning pipeline, so it must be stripped here,
  // not downstream. A rule built from un-de-identified text can later
  // surface in a completely different patient's generation prompt via
  // formatLearnedRulesPromptBlock(), so this is a cross-patient leakage
  // control, not just a storage-hygiene one.
  const deidAiOutput = deidentifyText(aiOutput || "").deidentified;
  const deidCorrectedOutput = deidentifyText(correctedOutput || "").deidentified;
  const deidSourceContext = deidentifyText(sourceContext || "Direct clinician field edit").deidentified;

  const correction: FeedbackCorrection = {
    id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    field,
    ai_output: deidAiOutput,
    corrected_output: deidCorrectedOutput,
    source_context: deidSourceContext,
    corrected_by: correctedBy,
    timestamp: new Date().toISOString(),
    case_type: caseType || "general",
    processed: false
  };

  feedbackCorrectionsStore.unshift(correction);
  return correction;
}

// 2. Pattern Extraction Pass (Offline LLM Processing)
export type LlmCaller = (prompt: string) => Promise<string | null>;
export type ExtractStatus = 'ok' | 'nothing_to_process' | 'llm_unavailable' | 'llm_failed' | 'no_pattern';

async function callClaudeForRules(prompt: string): Promise<string | null> {
  const anthropic = getAnthropic();
  if (!anthropic) return null;
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    temperature: 0.0,
    messages: [{ role: "user", content: prompt }]
  });
  return (msg.content[0] as any)?.text || "";
}

// Only 401 (bad key) and 402/credit-balance mean the key itself is the problem.
function maybeTripBreaker(err: any) {
  if (err?.status === 401 || err?.status === 402 || String(err?.message || "").includes("credit balance")) {
    anthropicDisabledUntilInLearning = Date.now() + 5 * 60 * 1000;
  }
}

/**
 * Turns pending corrections into PROPOSED rules (never active, never approved).
 * If the model is unavailable, fails, or finds no generalizable pattern, NO rule is
 * created: a one-off correction must never become a general clinical rule by fallback.
 * Corrections are marked processed only after a valid answer (including an empty one).
 */
export async function extractPatternsFromUnprocessedFeedback(
  opts: { llm?: LlmCaller } = {}
): Promise<{ newRules: LearnedRule[]; processedCount: number; status: ExtractStatus }> {
  const unprocessed = feedbackCorrectionsStore.filter(c => !c.processed);
  if (unprocessed.length === 0) {
    return { newRules: [], processedCount: 0, status: 'nothing_to_process' };
  }

  const prompt = `
You are reviewing clinician corrections to AI-generated clinical documentation in ErMate Emergency System.
For each correction below, determine if it reveals a GENERALIZABLE documentation pattern (something likely to recur) or a ONE-OFF error.
Only propose rules about how the AI should record what was dictated. Never propose treatment recommendations. If nothing generalizes, return [].

Corrections Batch:
${JSON.stringify(unprocessed, null, 2)}

Return a JSON ARRAY of generalizable rules. Each object MUST strictly follow this JSON schema:
[
  {
    "rule": "Short, specific instruction for the AI generation model",
    "trigger_keywords": ["keyword1", "keyword2", "keyword3"],
    "case_type": "category e.g. syncope_workup, trauma, drug_dosing",
    "population": "adult" | "paediatric" | omit if it applies to both,
    "confidence": "high" | "medium" | "low",
    "severity": "safety_critical" | "quality",
    "supporting_examples": ["Brief summary of original error and correction"]
  }
]

Do NOT wrap output in markdown fences if possible, or return valid JSON inside \`\`\`json.
`;

  let text: string | null;
  try {
    text = await (opts.llm || callClaudeForRules)(prompt);
  } catch (err: any) {
    console.warn("[Learning Pattern Extraction] model call failed; no rules created:", err?.message || err);
    maybeTripBreaker(err);
    return { newRules: [], processedCount: 0, status: 'llm_failed' };
  }
  if (text === null) return { newRules: [], processedCount: 0, status: 'llm_unavailable' };

  let extractedList: any[];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("no JSON array in reply");
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error("reply is not an array");
    extractedList = parsed;
  } catch (err: any) {
    console.warn("[Learning Pattern Extraction] unreadable reply; no rules created:", err?.message || err);
    return { newRules: [], processedCount: 0, status: 'llm_failed' };
  }

  const newRules: LearnedRule[] = [];
  extractedList.forEach((item, index) => {
    const ruleText = typeof item?.rule === "string" ? item.rule.trim() : "";
    const keywords = Array.isArray(item?.trigger_keywords)
      ? item.trigger_keywords.filter((k: any) => typeof k === "string" && k.trim().length > 0).map((k: string) => k.trim())
      : [];
    // A rule with no text or no trigger keyword could never be matched to a case: drop it.
    if (ruleText.length < 10 || ruleText.length > 600 || keywords.length === 0) return;
    const ruleObj: LearnedRule = {
      id: `r_${Date.now()}_${index}`,
      rule: ruleText,
      trigger_keywords: keywords,
      case_type: item.case_type || "general",
      confidence: item.confidence === "high" || item.confidence === "low" ? item.confidence : "medium",
      severity: item.severity === "safety_critical" ? "safety_critical" : "quality",
      supporting_examples: Array.isArray(item.supporting_examples) ? item.supporting_examples.map(String) : [],
      approved: false, // Requires clinician human sign-off!
      active: false,
      createdAt: new Date().toISOString(),
      ...(item.population === "adult" || item.population === "paediatric" ? { population: item.population as RulePopulation } : {})
    };
    learnedRulesStore.unshift(ruleObj);
    newRules.push(ruleObj);
  });

  unprocessed.forEach(c => c.processed = true);
  return { newRules, processedCount: unprocessed.length, status: newRules.length ? 'ok' : 'no_pattern' };
}

// 3. Retrieve Relevant Learned Rules at Generation Time

/**
 * Best-effort age group from the source text. Returns null when unsure, and unsure
 * never matches a population-specific rule. Durations ("diabetes for 10 years") are
 * deliberately not read as ages.
 */
export function inferPopulation(text: string = ""): RulePopulation | null {
  const t = String(text || "");
  const ageYears = (n: string) => (parseInt(n, 10) >= 18 ? 'adult' : 'paediatric') as RulePopulation;
  let m = t.match(/\b(\d{1,3})\s*[- ]?\s*(?:days?|weeks?|wks?|months?|mos?)[- ]?old\b/i);
  if (m) return 'paediatric';
  m = t.match(/\b(\d{1,3})\s*[- ]?\s*(?:years?|yrs?)[- ]?old\b/i)
    || t.match(/\b(\d{1,3})\s*(?:yo|y\/o|yom|yof)\b/i)
    || t.match(/\b(\d{1,3})\s*(?:y|yrs?|years?)\s*[,\/]?\s*(?:m|f|male|female|man|woman|boy|girl)\b/i)
    || t.match(/\bage[d:]?\s*(\d{1,3})\b/i);
  if (m) return ageYears(m[1]);
  if (/\b(?:neonate|newborn|infant|toddler|paediatric|pediatric)\b/i.test(t)) return 'paediatric';
  return null;
}

function keywordHits(rule: LearnedRule, text: string): number {
  let hits = 0;
  for (const kw of rule.trigger_keywords) {
    const k = (kw || "").trim();
    if (!k) continue;
    const re = new RegExp(`(?<![A-Za-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "i");
    if (re.test(text)) hits++;
  }
  return hits;
}

/**
 * A rule is considered ONLY if it is relevant to this case (a trigger keyword appears in the
 * source text, or its case_type equals the requested one) and its population fits. Severity
 * only ranks rules that already qualified; severity alone never qualifies a rule.
 */
export function getRelevantLearnedRules(
  sourceContext: string = "",
  caseType?: string,
  maxRules: number = 8,
  population?: RulePopulation | null
): LearnedRule[] {
  const text = sourceContext || "";
  const lowerCaseType = (caseType || "").toLowerCase();
  const pop = population === undefined ? inferPopulation(text) : population;

  const scored: { rule: LearnedRule; score: number }[] = [];
  for (const rule of learnedRulesStore) {
    if (!rule.active || !rule.approved) continue;
    if (rule.population && rule.population !== pop) continue;

    let relevance = keywordHits(rule, text) * 3;
    if (rule.case_type && lowerCaseType && rule.case_type.toLowerCase() === lowerCaseType) relevance += 10;
    if (relevance <= 0) continue;

    scored.push({ rule, score: relevance + (rule.severity === 'safety_critical' ? 5 : 0) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxRules).map(item => item.rule);
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

export interface Reviewer { email: string; uid: string }

/** reviewer must come from the verified token, never from the request body. */
export function updateRuleStatus(ruleId: string, approved: boolean, active: boolean, reviewer: Reviewer): LearnedRule | null {
  const rule = learnedRulesStore.find(r => r.id === ruleId);
  if (rule) {
    rule.approved = approved;
    rule.active = approved && active; // an unapproved rule can never be active
    if (approved) {
      rule.approvedBy = reviewer.email;
      rule.approvedByUid = reviewer.uid;
    } else {
      delete rule.approvedBy;
      delete rule.approvedByUid;
    }
    return rule;
  }
  return null;
}

export function createManualLearnedRule(
  ruleText: string,
  triggerKeywords: string[],
  caseType: string,
  severity: 'safety_critical' | 'quality',
  creator: Reviewer
): LearnedRule {
  const newRule: LearnedRule = {
    id: `r_${Date.now()}`,
    rule: ruleText,
    trigger_keywords: triggerKeywords.length > 0 ? triggerKeywords : ["general"],
    case_type: caseType || "general",
    confidence: "high",
    severity: severity || "quality",
    supporting_examples: [`Directly authored by ${creator.email}`],
    approved: true, // Manual admin creation is auto-approved
    active: true,
    createdAt: new Date().toISOString(),
    approvedBy: creator.email,
    approvedByUid: creator.uid
  };
  learnedRulesStore.unshift(newRule);
  return newRule;
}

export function deleteLearnedRule(ruleId: string): boolean {
  const initialLen = learnedRulesStore.length;
  learnedRulesStore = learnedRulesStore.filter(r => r.id !== ruleId);
  return learnedRulesStore.length < initialLen;
}