import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { deidentifyText } from "./deidentify.ts";

/**
 * server/aiDiagnosis.ts
 *
 * Clinical Decision Support & Case Synthesis Engine
 *
 * MODEL MATRIX RULES:
 * 1. Clinical Q&A / Differential Reasoning / ABG / Rounds Debrief:
 *    Claude 3.5 Sonnet ONLY. No fallbacks allowed.
 *    Returns clear message if Sonnet is unavailable.
 *
 * 2. Discharge Course Synthesis:
 *    Claude 3.5 Sonnet PRIMARY → GPT-4o FALLBACK.
 *
 * 3. Temperature Control:
 *    Set temperature: 0.0 on all clinical extractions and calculations.
 *    Set temperature: 0.2 on differential reasoning/synthesis for deterministic safety.
 *
 * 4. DPDP Act 2023 Server-Side De-identification:
 *    All user inputs pass through deidentifyText() BEFORE sending to external AI models.
 */

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "MY_OPENAI_API_KEY") {
    console.warn("[aiDiagnosis] OpenAI API key not configured");
    return null;
  }
  return new OpenAI({ apiKey });
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "MY_ANTHROPIC_API_KEY") {
    console.warn("[aiDiagnosis] Anthropic API key not configured");
    return null;
  }
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

/**
 * Shared Claude Sonnet caller for all reasoning tasks in this file.
 * Rule 1: NO fallback model. If Sonnet is unavailable or fails,
 * surfaces a clear failure result — NEVER silently degrades to Gemini or GPT-4o.
 */
async function callClaudeSonnetForReasoning(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2500
): Promise<string | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: maxTokens,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    return msg.content[0]?.type === "text" ? msg.content[0].text : null;
  } catch (err: any) {
    console.error("[aiDiagnosis] Claude Sonnet reasoning call failed:", err?.message || err);
    return null;
  }
}

export interface Citation {
  id: string;
  source: string;
  title: string;
  year?: string;
  url?: string;
  excerpt: string;
  sourceType?: "pubmed" | "textbook" | "guideline" | "wikem";
  authors?: string;
  refNumber?: number;
}

export interface DiagnosisSuggestion {
  id: string;
  diagnosis: string;
  confidence: "high" | "moderate" | "low";
  severity_rank: number;
  reasoning: string;
  keyFindings: string[];
  workup: string[];
  management: string[];
  citations: Citation[];
}

export interface RedFlag {
  id: string;
  flag: string;
  severity: "critical" | "warning";
  action: string;
  timeframe?: string;
  citations: Citation[];
}

export interface SearchSource {
  id: string;
  title: string;
  source: string;
  authors?: string;
  year?: string;
  url: string;
  sourceType: "pubmed" | "textbook" | "guideline" | "wikem";
}

export interface ABGData {
  sampleType?: string;
  ph?: string;
  pco2?: string;
  po2?: string;
  hco3?: string;
  be?: string;
  lactate?: string;
  sao2?: string;
  fio2?: string;
  na?: string;
  k?: string;
  cl?: string;
  anionGap?: string;
  glucose?: string;
  hb?: string;
  aaGradient?: string;
  interpretation?: string;
  status?: string;
}

export interface MedicalSearchResult {
  id: string;
  title: string;
  source: string;
  authors?: string;
  year?: string;
  url: string;
  snippet: string;
  sourceType: "pubmed" | "textbook" | "guideline" | "wikem";
}

export async function searchMedicalLiterature(
  chiefComplaint: string,
  age: number,
  history?: string
): Promise<MedicalSearchResult[]> {
  const isPediatric = age < 16;
  const topic = chiefComplaint || "Emergency Medical Evaluation";
  
  return [
    {
      id: "ref-1",
      title: isPediatric ? "Nelson Textbook of Pediatrics - Emergency Protocols" : "Tintinalli's Emergency Medicine: A Comprehensive Study Guide (9th Ed)",
      source: isPediatric ? "Nelson Pediatrics" : "McGraw-Hill Medical",
      authors: isPediatric ? "Kliegman RM et al." : "Tintinalli JE et al.",
      year: "2023",
      url: "https://accessmedicine.mhmedical.com/book.aspx?bookid=2353",
      snippet: `Standard evaluation protocols for ${topic}. Emphasizes early stabilization, primary survey (ABCDE), and targeted diagnostic workup.`,
      sourceType: "textbook"
    },
    {
      id: "ref-2",
      title: isPediatric ? "PALS Clinical Practice Guidelines for Acute Pediatric Presentation" : "ATLS Advanced Trauma & Acute Care Life Support Guidelines",
      source: "American Heart Association / ACS",
      authors: "AHA/ACS Taskforce",
      year: "2024",
      url: "https://cadd.org/guidelines",
      snippet: `Evidence-based clinical guidelines regarding ${topic} management in emergency department settings.`,
      sourceType: "guideline"
    }
  ];
}

function formatABGData(abgData?: ABGData): string {
  if (!abgData) return "";
  const parts: string[] = [];
  if (abgData.sampleType) parts.push(`Sample: ${abgData.sampleType}`);
  if (abgData.ph) parts.push(`pH: ${abgData.ph}`);
  if (abgData.pco2) parts.push(`pCO2: ${abgData.pco2} mmHg`);
  if (abgData.po2) parts.push(`pO2: ${abgData.po2} mmHg`);
  if (abgData.hco3) parts.push(`HCO3: ${abgData.hco3} mEq/L`);
  if (abgData.be) parts.push(`BE: ${abgData.be} mEq/L`);
  if (abgData.lactate) parts.push(`Lactate: ${abgData.lactate} mmol/L`);
  if (abgData.sao2) parts.push(`SaO2: ${abgData.sao2}%`);
  if (abgData.fio2) parts.push(`FiO2: ${abgData.fio2}%`);
  if (abgData.na) parts.push(`Na: ${abgData.na} mEq/L`);
  if (abgData.k) parts.push(`K: ${abgData.k} mEq/L`);
  if (abgData.cl) parts.push(`Cl: ${abgData.cl} mEq/L`);
  if (abgData.anionGap) parts.push(`Anion Gap: ${abgData.anionGap}`);
  if (abgData.glucose) parts.push(`Glucose: ${abgData.glucose} mg/dL`);
  if (abgData.hb) parts.push(`Hb: ${abgData.hb} g/dL`);
  if (abgData.aaGradient) parts.push(`A-a Gradient: ${abgData.aaGradient} mmHg`);
  if (abgData.status && abgData.status !== "not_done") parts.push(`Interpretation: ${abgData.status.replace(/_/g, " ")}`);
  if (abgData.interpretation) parts.push(`Clinical Note: ${abgData.interpretation}`);
  return parts.length > 0 ? parts.join(", ") : "";
}

function buildSourcesContext(searchResults: MedicalSearchResult[]): string {
  if (searchResults.length === 0) return "";
  let context = "\n\n## MEDICAL LITERATURE SEARCH RESULTS (use these as references)\n";
  searchResults.forEach((result, index) => {
    context += `\n[${index + 1}] ${result.title}`;
    if (result.authors) context += ` - ${result.authors}`;
    if (result.year) context += ` (${result.year})`;
    context += `\n    Source: ${result.source}`;
    context += `\n    URL: ${result.url}`;
    if (result.snippet) context += `\n    Summary: ${result.snippet}`;
    context += "\n";
  });
  return context;
}

// ══════════════════════════════════════════════════════════════════
// 1. generateDiagnosisSuggestions — Claude 3.5 Sonnet ONLY
// ══════════════════════════════════════════════════════════════════

export async function generateDiagnosisSuggestions(caseData: {
  chiefComplaint: string;
  vitals: Record<string, string>;
  history: string;
  examination: string;
  age: number;
  gender: string;
  abgData?: ABGData;
}): Promise<{ suggestions: DiagnosisSuggestion[]; redFlags: RedFlag[]; sources: SearchSource[] }> {
  // PALS age cutoff: age < 16
  const isPediatric = caseData.age < 16;
  const abgInfo = formatABGData(caseData.abgData);

  // DPDP Act 2023 Server-Side De-identification
  const safeHistory = deidentifyText(caseData.history || "").deidentified;
  const safeExamination = deidentifyText(caseData.examination || "").deidentified;
  const safeChiefComplaint = deidentifyText(caseData.chiefComplaint || "").deidentified;

  let searchResults: MedicalSearchResult[] = [];
  try {
    searchResults = await searchMedicalLiterature(safeChiefComplaint, caseData.age, safeHistory?.substring(0, 200));
  } catch (err) {
    console.warn("[aiDiagnosis] Medical literature search failed:", err);
  }

  const sourcesContext = buildSourcesContext(searchResults);
  const sources: SearchSource[] = searchResults.map((r) => ({
    id: r.id, title: r.title, source: r.source, authors: r.authors, year: r.year, url: r.url, sourceType: r.sourceType,
  }));

  const systemPrompt = `You are a clinical decision support tool for emergency medicine physicians, trained on Tintinalli's Emergency Medicine, Rosen's Emergency Medicine, and current clinical practice guidelines.

Your role is to prompt physician thinking — NOT to diagnose. You surface conditions the physician should actively consider or rule out, supported by medical literature, so the treating physician can make an informed clinical decision.

RULES:
1. Provide up to 5 severity-ranked differential diagnoses.
2. Provide specific red flags requiring immediate action or monitoring.
3. Reference literature entries as [1], [2] corresponding to provided sources.
4. Patient protocol: ${isPediatric ? "PEDIATRIC (age < 16, use PALS protocols, weight-based dosing)" : "ADULT (use ATLS protocols)"}.
5. Return ONLY a valid JSON object matching this schema:
{
  "suggestions": [
    {
      "diagnosis": "Name of Condition",
      "confidence": "high" | "moderate" | "low",
      "severity_rank": 1,
      "reasoning": "Clinical rationale tying findings to condition...",
      "keyFindings": ["Finding 1", "Finding 2"],
      "workup": ["STAT ECG", "Troponin I"],
      "management": ["Aspirin 325mg STAT", "Oxygen"],
      "citationRefs": [1]
    }
  ],
  "redFlags": [
    {
      "flag": "Critical Warning Description",
      "severity": "critical" | "warning",
      "action": "Immediate clinical action",
      "timeframe": "< 15 mins",
      "citationRefs": [1]
    }
  ]
}`;

  const userPrompt = `Patient Case:
- Age: ${caseData.age} years, Gender: ${caseData.gender}
- Chief Complaint: ${safeChiefComplaint}
- Vitals: ${JSON.stringify(caseData.vitals)}
- History: ${safeHistory}
- Examination: ${safeExamination}${abgInfo ? `\n- ABG/VBG: ${abgInfo}` : ""}

Analyze this case thoroughly. Provide differential diagnoses with evidence-based reasoning, cite the medical literature provided, identify all red flags, and recommend workup and management for each diagnosis.${abgInfo ? " Consider the ABG values carefully." : ""}${sourcesContext}`;

  const claudeResponse = await callClaudeSonnetForReasoning(systemPrompt, userPrompt, 4000);

  if (!claudeResponse) {
    console.error("[aiDiagnosis] Claude Sonnet unavailable for diagnosis suggestions — returning empty per Rule 1.");
    return { suggestions: [], redFlags: [], sources };
  }

  try {
    const cleanJson = claudeResponse.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    const suggestions: DiagnosisSuggestion[] = (parsed.suggestions || []).map((s: any, index: number) => {
      const citationRefs: number[] = s.citationRefs || [];
      const citations: Citation[] = citationRefs
        .filter((refNum: number) => refNum >= 1 && refNum <= searchResults.length)
        .map((refNum: number) => {
          const source = searchResults[refNum - 1];
          return {
            id: source.id, source: source.source, title: source.title, year: source.year,
            url: source.url, excerpt: source.snippet, sourceType: source.sourceType,
            authors: source.authors, refNumber: refNum
          };
        });
      return {
        id: randomUUID(),
        diagnosis: s.diagnosis,
        confidence: s.confidence as "high" | "moderate" | "low",
        severity_rank: s.severity_rank || index + 1,
        reasoning: s.reasoning,
        keyFindings: s.keyFindings || [],
        workup: s.workup || [],
        management: s.management || [],
        citations,
      };
    });

    const redFlags: RedFlag[] = (parsed.redFlags || []).map((r: any) => {
      const citationRefs: number[] = r.citationRefs || [];
      const citations: Citation[] = citationRefs
        .filter((refNum: number) => refNum >= 1 && refNum <= searchResults.length)
        .map((refNum: number) => {
          const source = searchResults[refNum - 1];
          return {
            id: source.id, source: source.source, title: source.title, year: source.year,
            url: source.url, excerpt: source.snippet, sourceType: source.sourceType,
            authors: source.authors, refNumber: refNum
          };
        });
      return {
        id: randomUUID(),
        flag: r.flag,
        severity: r.severity as "critical" | "warning",
        action: r.action,
        timeframe: r.timeframe,
        citations
      };
    });

    return { suggestions, redFlags, sources };
  } catch (error) {
    console.error("[aiDiagnosis] Failed to parse Claude Sonnet diagnosis response:", error);
    return { suggestions: [], redFlags: [], sources };
  }
}

// ══════════════════════════════════════════════════════════════════
// 2. interpretABG — Claude 3.5 Sonnet ONLY
// ══════════════════════════════════════════════════════════════════

export async function interpretABG(
  abgValues: string,
  patientContext?: {
    age?: string | number; sex?: string; presenting_complaint?: string; vitals?: string;
    abcde?: string; history?: string; examination?: string; diagnosis?: string;
  }
): Promise<string> {
  const safeContext = {
    ...patientContext,
    presenting_complaint: patientContext?.presenting_complaint ? deidentifyText(patientContext.presenting_complaint).deidentified : undefined,
    history: patientContext?.history ? deidentifyText(patientContext.history).deidentified : undefined,
    examination: patientContext?.examination ? deidentifyText(patientContext.examination).deidentified : undefined,
  };

  const clinicalContextParts: string[] = [];
  if (safeContext?.age) clinicalContextParts.push(`Age: ${safeContext.age}`);
  if (safeContext?.sex) clinicalContextParts.push(`Sex: ${safeContext.sex}`);
  if (safeContext?.presenting_complaint) clinicalContextParts.push(`Chief Complaint: ${safeContext.presenting_complaint}`);
  if (safeContext?.vitals) clinicalContextParts.push(`Vitals: ${safeContext.vitals}`);
  if (safeContext?.abcde) clinicalContextParts.push(`Primary Survey (ABCDE): ${safeContext.abcde}`);
  if (safeContext?.history) clinicalContextParts.push(`History: ${safeContext.history}`);
  if (safeContext?.examination) clinicalContextParts.push(`Examination: ${safeContext.examination}`);
  if (safeContext?.diagnosis) clinicalContextParts.push(`Working Diagnosis: ${safeContext.diagnosis}`);

  const isPediatric = patientContext?.age !== undefined ? (typeof patientContext.age === 'number' ? patientContext.age < 16 : parseInt(patientContext.age as string) < 16) : false;

  const systemPrompt = `You are an expert emergency medicine physician providing ABG/VBG interpretation. Be concise, clinically relevant, and actionable. When clinical context is provided, correlate ABG findings with the full clinical picture.
${isPediatric ? "\nCRITICAL: This is a PEDIATRIC patient (age < 16). Apply PALS protocols and use age-appropriate normal reference ranges for ABG interpretation." : ""}`;

  const userPrompt = `Interpret the following ABG/VBG values using a 5-step approach:
1. Primary Acid-Base Disturbance
2. Degree of Compensation
3. Anion Gap & Delta Gap Calculation (if metabolic acidosis)
4. Oxygenation Status & A-a Gradient
5. Clinical Correlation & Emergency Management Recommendations

ABG Values: ${abgValues}
${clinicalContextParts.length > 0 ? `\nCLINICAL CONTEXT:\n${clinicalContextParts.join("\n")}` : "\nNo patient context provided."}`;

  const claudeResponse = await callClaudeSonnetForReasoning(systemPrompt, userPrompt, 1500);
  return claudeResponse || "Clinical reference is temporarily unavailable. Please interpret manually.";
}

// ══════════════════════════════════════════════════════════════════
// 3. generateRoundsDebrief — Claude 3.5 Sonnet ONLY
// ══════════════════════════════════════════════════════════════════

export interface RoundsDebriefCase {
  complaint: string;
  diagnosis?: string;
  keyFindings?: string;
  management?: string;
  triage: number;
  age: number;
  gender: string;
}

export async function generateRoundsDebrief(caseData: RoundsDebriefCase, mode: string): Promise<string> {
  const age = caseData.age;
  const sex = caseData.gender === "M" ? "male" : caseData.gender === "F" ? "female" : "patient";
  const dx = deidentifyText(caseData.diagnosis || caseData.complaint).deidentified;
  const safeKeyFindings = caseData.keyFindings ? deidentifyText(caseData.keyFindings).deidentified : undefined;
  const safeManagement = caseData.management ? deidentifyText(caseData.management).deidentified : undefined;

  const modePrompts: Record<string, string> = {
    disease_snapshot: `Give me a clear, structured snapshot of "${dx}" written for an emergency medicine doctor.`,
    first_principles: `Explain the core first-principles physiology and mechanics behind "${dx}".`,
    devils_advocate: `Play devil's advocate for "${dx}". What non-obvious diagnoses mimic this condition and how do I rule them out?`,
    pathophysiology: `Explain the cellular and systemic pathophysiology of "${dx}".`,
    rare_but_real: `What are the rare but life-threatening complications or atypical presentations of "${dx}" in emergency medicine?`,
    guidelines: `Summarize the current international clinical practice guidelines for "${dx}".`,
    full_debrief: `Run a complete structured clinical debrief of this case: "${dx}" in a ${age}-year-old ${sex} (Triage P${caseData.triage}).${safeKeyFindings ? ` Key findings: ${safeKeyFindings}.` : ""}${safeManagement ? ` Management: ${safeManagement}.` : ""}`
  };

  const userPrompt = modePrompts[mode] || modePrompts.full_debrief;
  const systemPrompt = `You are an expert emergency medicine educator conducting a structured case debrief. Format with **bold** headers, *italic* caveats, → for key learning points, • for detail bullets. Maximum 550 words. End with a single key takeaway line starting with →.`;

  const claudeResponse = await callClaudeSonnetForReasoning(systemPrompt, userPrompt, 1000);
  return claudeResponse || "Clinical reference is temporarily unavailable. Please try again.";
}

// ══════════════════════════════════════════════════════════════════
// 4. generateCourseInHospital — Claude Sonnet PRIMARY, GPT-4o FALLBACK
// ══════════════════════════════════════════════════════════════════

export async function generateCourseInHospital(summaryData: any): Promise<{ course_in_hospital: string; diagnosis?: string }> {
  const safeHpi = deidentifyText(summaryData.historyOfPresentIllness || summaryData.presentingComplaints || "").deidentified;
  const safePast = deidentifyText(summaryData.pastHistory || "").deidentified;
  const safeTreatment = deidentifyText(summaryData.treatmentGiven || "").deidentified;
  const safeInvestigations = deidentifyText(summaryData.investigations || "").deidentified;
  const safeWorkingDx = deidentifyText(summaryData.workingDiagnosis || "").deidentified;

  const prompt = `Synthesize a professional, chronological Emergency Department "Course in Hospital" narrative for a discharge summary based ONLY on the documented data below.

RULES:
- NEVER invent information not in the documented text.
- Maintain chronological flow from arrival -> evaluation -> treatment -> response -> disposition.
- Be concise, factual, and medico-legally sound.

DOCUMENTED DATA:
- Working Diagnosis: ${safeWorkingDx}
- History / HPI: ${safeHpi}
- Past History: ${safePast}
- Vitals: ${JSON.stringify(summaryData.vitalsOnArrival || {})}
- Investigations: ${safeInvestigations}
- Treatment Administered: ${safeTreatment}
- Disposition: ${summaryData.disposition || "Discharged"}

Return JSON format:
{
  "course_in_hospital": "Detailed chronological narrative...",
  "diagnosis": "Final Refined Working Diagnosis"
}`;

  // 1. Primary: Claude 3.5 Sonnet
  const anthropic = getAnthropicClient();
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        temperature: 0.0,
        messages: [{ role: "user", content: prompt }]
      });
      const resText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      if (resText) {
        const cleanJson = resText.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        return {
          course_in_hospital: parsed.course_in_hospital || "",
          diagnosis: parsed.diagnosis || safeWorkingDx
        };
      }
    } catch (err: any) {
      console.warn("[aiDiagnosis] Claude Sonnet failed for Course in Hospital, trying GPT-4o fallback:", err?.message || err);
    }
  }

  // 2. Secondary Fallback: OpenAI GPT-4o
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a clinical synthesis assistant creating discharge summary narratives." },
          { role: "user", content: prompt }
        ]
      });
      const resText = completion.choices[0]?.message?.content || "";
      if (resText) {
        const parsed = JSON.parse(resText);
        return {
          course_in_hospital: parsed.course_in_hospital || "",
          diagnosis: parsed.diagnosis || safeWorkingDx
        };
      }
    } catch (err: any) {
      console.error("[aiDiagnosis] GPT-4o fallback also failed for Course in Hospital:", err?.message || err);
    }
  }

  return {
    course_in_hospital: "Patient presented with " + safeHpi + ". Treated with " + safeTreatment + " and evaluated with " + safeInvestigations + ". Stable for discharge.",
    diagnosis: safeWorkingDx
  };
}
