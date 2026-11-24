/**
 * server/caseSummaryHpi.ts
 *
 * Writes the History of Present Illness from the WHOLE recorded case, in the hospital's style
 * (Neeraj, 21 Nov 2026), e.g.:
 *   "The patient presented to the Emergency Department with complaints of fever with chills and
 *    breathing difficulty since today morning. He initially sought medical attention at a local
 *    hospital, where Inj. Lasix and symptomatic treatment were administered. The patient presented to
 *    our Emergency Department for further evaluation and management, as he is on regular follow-up
 *    with the Pulmonology department at our hospital."
 *
 * Safety:
 *  - Only recorded facts. Every number in the HPI must exist in the case (else the AI text is rejected).
 *  - Clinical facts guard: no symptom / condition / referral that is not in the case; recorded negatives
 *    stay negative and recorded positives are never negated (clinicalFactsProblem).
 *  - Identifiers removed (deidentifyText) before any model sees the text; placeholders never reach the HPI.
 *  - Extraction cascade: GPT-4o-mini → Claude Haiku, temperature 0. No Gemini.
 *  - If no model is available: a plain template from the complaint and events, or nothing (the
 *    existing HPI is kept).
 */
import { deidentifyText } from "./deidentify.ts";

export interface HpiCaseInput {
  sex?: string | null;
  presentingComplaint?: string | null;
  symptoms?: string | null;
  events?: string | null;
  /** HPI dictated so far (may hold outside treatment / reason for coming). */
  currentHpi?: string | null;
  pastHistory?: string | null;
  surgicalHistory?: string | null;
  medications?: string | null;
  arrivalMode?: string | null;
  /** Free notes that may mention referral / treatment elsewhere. */
  notes?: string | null;
}

export interface HpiResult {
  hpi: string | null;
  source: "ai" | "template" | "none";
  reason?: string;
}

const FIELDS: [keyof HpiCaseInput, string][] = [
  ["presentingComplaint", "Presenting complaint"],
  ["symptoms", "Signs and symptoms"],
  ["events", "Events / onset / mechanism"],
  ["currentHpi", "History dictated so far"],
  ["pastHistory", "Past medical history"],
  ["surgicalHistory", "Surgical history"],
  ["medications", "Current medications"],
  ["arrivalMode", "Arrival mode"],
  ["notes", "Other notes"],
];

const str = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export function hasHistoryContent(input: HpiCaseInput): boolean {
  return [input.presentingComplaint, input.symptoms, input.events, input.currentHpi].some((v) => str(v).length > 0);
}

/** De-identified, labelled case text for the model. */
export function buildSafeCaseText(input: HpiCaseInput): string {
  return FIELDS
    .map(([k, label]) => {
      const v = str(input[k]);
      if (!v || k === "sex") return "";
      return `${label}: ${deidentifyText(v).deidentified}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
}

export function pronounFor(sex: unknown): "He" | "She" | null {
  const s = str(sex).toLowerCase();
  if (/^(m|male|man|boy)\b/.test(s)) return "He";
  if (/^(f|female|woman|girl)\b/.test(s)) return "She";
  return null;
}

export const HPI_SYSTEM_PROMPT = [
  "You write the History of Present Illness (HPI) for an Indian hospital emergency department case record.",
  "Write ONE paragraph of 2 to 6 sentences, past tense, formal clinical English, in this hospital's style:",
  "1) \"The patient presented to the Emergency Department with complaints of <complaints, each with its duration as recorded>.\"",
  "2) Onset, events or mechanism of injury, if recorded.",
  "3) Care taken before arrival, if recorded (where, and what was given).",
  "4) Why the patient came here (referral, follow-up, worsening), if recorded.",
  "5) Known conditions only if they are recorded AND relevant to the complaint.",
  "STRICT RULES:",
  "- Use ONLY facts written in the case. Never add symptoms, negatives, durations, doses, drugs, findings, diagnoses or reasons that are not written.",
  "- Do not include vitals, examination findings, investigations, ED treatment, diagnosis or plan.",
  "- Bracketed placeholders such as [PATIENT] or [HOSPITAL] are removed identifiers. Never copy them. Refer to the patient as \"the patient\" or the given pronoun; write \"a local hospital\" only if the case says the patient went to another hospital first.",
  "- Do not invent a hospital department, a time, or a number. Write durations and numbers exactly as written in the case.",
  "- Keep every recorded negative as a negative (\"no vomiting\" stays \"no vomiting\"). Do not add negatives that are not written.",
  "- If two parts of the case disagree (for example different durations), leave that detail out rather than choosing one.",
  "- Output the paragraph only: no heading, no quotes, no bullet points.",
].join("\n");

export function buildUserPrompt(safeText: string, pronoun: "He" | "She" | null): string {
  return `${pronoun ? `Pronoun for the patient: ${pronoun}.` : "Sex not recorded: use \"the patient\", never he or she."}\n\nCASE:\n"""\n${safeText}\n"""`;
}

/** Numbers in the HPI must all come from the case (guards against invented durations/doses). */
const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", "a couple of": "2", single: "1", once: "1", twice: "2",
};
export function numbersAreFromCase(hpi: string, caseText: string): boolean {
  const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) || []).map((n) => String(parseFloat(n)));
  const words = Object.entries(NUMBER_WORDS)
    .filter(([w]) => new RegExp(`\\b${w}\\b`, "i").test(caseText))
    .map(([, d]) => d);
  const allowed = new Set([...nums(caseText), ...words]);
  return nums(hpi).every((n) => allowed.has(n));
}

/**
 * Clinical facts guard (audit 23 Nov 2026). The number check cannot catch a negative turned positive
 * ("no vomiting" → "vomiting") or an added symptom / condition / referral. This deterministic check
 * works on a fixed vocabulary of clinical concepts (with synonyms and abbreviations):
 *   A. every concept the HPI mentions must appear somewhere in the case;
 *   B. a concept the case only ever negates must not be stated as present in the HPI;
 *   C. a concept the case only ever states as present must not be negated in the HPI.
 * Anything it cannot verify is rejected (null over hallucination).
 */
export const HPI_CONCEPTS: Record<string, RegExp> = {
  fever: /\b(fever|febrile|pyrexia|temperature rise|chills|rigors?)\b/i,
  vomiting: /\b(vomit\w*|emesis|throwing up)\b/i,
  nausea: /\bnause\w*\b/i,
  diarrhoea: /\b(diarrh\w*|loose stools?|loose motions?)\b/i,
  constipation: /\bconstipat\w*\b/i,
  headache: /\b(headaches?|cephalgia)\b/i,
  chest_pain: /\b(chest (pain|discomfort|tightness|heaviness)|angina)\b/i,
  abdominal_pain: /\b((abdominal|abdomen|epigastric|stomach|belly|flank|loin) (pain|discomfort|cramps?)|pain (in|over) the (abdomen|epigastrium))\b/i,
  back_pain: /\bback ?(pain|ache)\b/i,
  breathlessness: /\b(breathless\w*|shortness of breath|sob|dyspn\w*|breathing difficulty|difficulty (in )?breathing|respiratory distress)\b/i,
  cough: /\bcough\w*\b/i,
  sputum: /\b(sputum|phlegm|expectoration)\b/i,
  haemoptysis: /\bha?emoptysis\b/i,
  wheeze: /\bwheez\w*\b/i,
  palpitations: /\bpalpitations?\b/i,
  syncope: /\b(syncop\w*|faint\w*|black ?outs?|passed out|collapse\w*)\b/i,
  loc: /\b(loss of consciousness|loc|unconscious\w*|unresponsive)\b/i,
  giddiness: /\b(giddiness|dizz\w*|vertigo|lightheaded\w*)\b/i,
  seizure: /\b(seizures?|convulsions?|fits|epileptic|tonic.clonic)\b/i,
  weakness: /\b(weakness|hemiparesis|paralysis|paresis|numbness)\b/i,
  slurred_speech: /\b(slurr\w* (of )?speech|dysarthria|aphasia)\b/i,
  confusion: /\b(confus\w*|altered sensorium|disorient\w*|drows\w*|delirium)\b/i,
  haematemesis: /\b(ha?ematemesis|vomiting (of )?blood|blood in vomit)\b/i,
  melaena: /\b(mela?ena|black (tarry )?stools?)\b/i,
  bleeding: /\b(bleed\w*|ha?emorrhag\w*)\b/i,
  jaundice: /\b(jaundice\w*|icter\w*|yellowish discolou?ration)\b/i,
  rash: /\b(rash\w*|urticaria|hives)\b/i,
  swelling: /\b(swelling|oedema|edema)\b/i,
  dysuria: /\b(dysuria|burning micturition|painful urination)\b/i,
  urine_output: /\b(oliguria|anuria|reduced urine|decreased urine)\b/i,
  trauma: /\b(rta|road traffic|accident|assault\w*|injur\w*|trauma\w*)\b/i,
  fall: /\b(falls?|fell|fallen)\b/i,
  bite: /\b(snake ?bite|bitten|dog bite|bite)\b/i,
  poisoning: /\b(poison\w*|overdose|ingest\w*|consumed|intake of)\b/i,
  diabetes: /\b(diabet\w*|dm|t2dm|t1dm)\b/i,
  hypertension: /\b(hypertensi\w*|htn)\b/i,
  heart_disease: /\b(cad|ihd|coronary|heart disease|heart failure|cardiac failure|mi|myocardial infarction|angioplasty|cabg|ptca)\b/i,
  kidney_disease: /\b(ckd|renal failure|kidney disease|dialysis)\b/i,
  asthma_copd: /\b(asthma\w*|copd|bronchial asthma)\b/i,
  stroke_history: /\b(cva|stroke)\b/i,
  tb: /\b(tb|tuberculosis|koch'?s)\b/i,
  thyroid: /\b(thyroid|hypothyroid\w*|hyperthyroid\w*)\b/i,
  liver_disease: /\b(cirrhosis|cld|chronic liver disease|liver disease)\b/i,
  epilepsy: /\bepilep\w*\b/i,
  cancer: /\b(cancer|malignan\w*|carcinoma|tumou?r|chemotherapy)\b/i,
  pregnancy: /\b(pregnan\w*|gravid\w*|antenatal|lmp)\b/i,
  alcohol: /\b(alcohol\w*|ethanol|drinker|drinking)\b/i,
  smoking: /\b(smok\w*|tobacco|beedi|bidi)\b/i,
  surgery: /\b(surger\w*|operated|operation|post.?op\w*)\b/i,
  // "[HOSPITAL]" = a hospital name removed by de-identification, i.e. care elsewhere was recorded.
  outside_care: /\[hospital[^\]]*\]|\b(local hospital|another hospital|outside hospital|other hospital|private hospital|nursing home|clinic|phc|chc|taluk|district hospital|general hospital|referred|referral|first aid|medical college)\b/i,
  follow_up: /\b(follow.?up|regular (review|treatment)|under treatment)\b/i,
  dept_pulmonology: /\b(pulmonology|chest medicine|respiratory medicine)\b/i,
  dept_cardiology: /\b(cardiology)\b/i,
  dept_nephrology: /\b(nephrology)\b/i,
  dept_neurology: /\b(neurology)\b/i,
  dept_gastroenterology: /\b(gastroenterology|gastro)\b/i,
  dept_oncology: /\b(oncology)\b/i,
  dept_general_medicine: /\b(medicine department|general medicine|internal medicine)\b/i,
  dept_general_surgery: /\b(surgery department|general surgery)\b/i,
  dept_orthopaedics: /\b(orthopa?edics)\b/i,
  dept_obgyn: /\b(obstetrics|gyna?ecology|obg)\b/i,
  dept_psychiatry: /\b(psychiatry)\b/i,
  dept_urology: /\b(urology)\b/i,
  dept_ent: /\b(ent department|otolaryngology)\b/i,
};

const NEGATION_START = /\b(no|not|nil|denies|denied|denying|without|absence of|negative for|never|free of|neither|nor)\b/gi;
const CLAUSE_END = /[.;:!?]|\b(but|however|although|though|then|with|after|before|following|since|due to|because|and (?:had|has|have|was|is|were|developed|complained|complains|reports?|noticed|started))\b/i;

/** Splits text into (negated parts, the rest). A negated part runs from a negation word to the end of its clause. */
function splitNegated(text: string): { negated: string[]; rest: string } {
  const negated: string[] = [];
  let rest = "";
  let i = 0;
  NEGATION_START.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NEGATION_START.exec(text))) {
    if (m.index < i) continue;
    rest += text.slice(i, m.index);
    const after = text.slice(m.index + m[0].length);
    const end = after.search(CLAUSE_END);
    let span = end === -1 ? after : after.slice(0, end);
    // "not" / "never" negate only the words right after them ("could not walk after the fall").
    if (/^(not|never)$/i.test(m[0])) {
      const short = span.match(/^\s*(?:\S+\s+){0,2}\S+/);
      span = short ? short[0] : span;
    }
    negated.push(span);
    i = m.index + m[0].length + span.length;
    NEGATION_START.lastIndex = i;
  }
  rest += text.slice(i);
  return { negated, rest };
}

export function conceptMentions(text: string): { any: Set<string>; positive: Set<string>; negated: Set<string> } {
  const { negated, rest } = splitNegated(text);
  const any = new Set<string>(), positive = new Set<string>(), neg = new Set<string>();
  for (const [id, re] of Object.entries(HPI_CONCEPTS)) {
    const inRest = re.test(rest);
    const inNeg = negated.some((n) => re.test(n));
    if (inRest) positive.add(id);
    if (inNeg) neg.add(id);
    if (inRest || inNeg) any.add(id);
  }
  return { any, positive, negated: neg };
}

/** Returns null when the HPI is faithful to the case, else a short reason. */
export function clinicalFactsProblem(hpi: string, caseText: string): string | null {
  const h = conceptMentions(hpi);
  const c = conceptMentions(caseText);
  for (const id of h.any) {
    if (!c.any.has(id)) return `adds "${id}" not in the case`;
  }
  for (const id of h.positive) {
    if (c.negated.has(id) && !c.positive.has(id)) return `states "${id}" that the case records as absent`;
  }
  for (const id of h.negated) {
    if (c.positive.has(id) && !c.negated.has(id)) return `negates "${id}" that the case records as present`;
  }
  return null;
}

/** Cleans model output; returns null if it is unusable. */
export function cleanHpiOutput(raw: unknown, safeText: string): string | null {
  let t = str(raw)
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^(history of present(ing)? illness|hpi)\s*[:\-]\s*/i, "")
    .trim();
  if (!t) return null;
  t = t.replace(/\[(PATIENT|NAME|PT)[^\]]*\]/gi, "the patient");
  if (/\[[A-Za-z][A-Za-z0-9 _-]*\]/.test(t)) return null; // other placeholders leaked → reject
  if (t.length > 1500) return null;
  if (!numbersAreFromCase(t, safeText)) return null;
  const problem = clinicalFactsProblem(t, safeText);
  if (problem) {
    console.warn(`[HPI from case] rejected: ${problem}`);
    return null;
  }
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Plain template used only when no model is available and the case has no HPI yet. */
export function templateHpi(input: HpiCaseInput): string | null {
  const complaint = str(input.presentingComplaint) || str(input.symptoms);
  if (!complaint) return null;
  const c = complaint.replace(/[.\s]+$/, "");
  const lower = /^[A-Z][a-z]/.test(c) ? c.charAt(0).toLowerCase() + c.slice(1) : c;
  const parts = [`The patient presented to the Emergency Department with complaints of ${lower}.`];
  const ev = str(input.events).replace(/[.\s]+$/, "");
  if (ev && !c.toLowerCase().includes(ev.toLowerCase())) parts.push(`${ev.charAt(0).toUpperCase()}${ev.slice(1)}.`);
  return parts.join(" ");
}

export interface HpiModels {
  /** GPT-4o-mini (primary). Returns text or throws. */
  primary?: (system: string, user: string) => Promise<string>;
  /** Claude Haiku (fallback). Returns text or throws. */
  fallback?: (system: string, user: string) => Promise<string>;
}

export async function writeHpiFromCase(input: HpiCaseInput, models: HpiModels): Promise<HpiResult> {
  if (!hasHistoryContent(input)) return { hpi: null, source: "none", reason: "no history recorded" };
  const safeText = buildSafeCaseText(input);
  const user = buildUserPrompt(safeText, pronounFor(input.sex));

  for (const [name, call] of [["gpt-4o-mini", models.primary], ["claude-haiku", models.fallback]] as const) {
    if (!call) continue;
    try {
      const out = cleanHpiOutput(await call(HPI_SYSTEM_PROMPT, user), safeText);
      if (out) return { hpi: out, source: "ai" };
      console.warn(`[HPI from case] ${name} output rejected by safety checks`);
    } catch (e: any) {
      console.warn(`[HPI from case] ${name} failed:`, e?.message || e);
    }
  }
  // No usable AI text: never replace an HPI the case already has.
  if (str(input.currentHpi)) return { hpi: null, source: "none", reason: "AI unavailable; existing HPI kept" };
  const t = templateHpi(input);
  return t ? { hpi: t, source: "template" } : { hpi: null, source: "none", reason: "nothing to write" };
}

/** Real model callers (used by the route). */
export function defaultHpiModels(getAnthropic: () => any): HpiModels {
  return {
    primary: process.env.OPENAI_API_KEY
      ? async (system, user) => {
          const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
            body: JSON.stringify({
              model: "gpt-4o-mini", temperature: 0, max_tokens: 500,
              messages: [{ role: "system", content: system }, { role: "user", content: user }],
            }),
          });
          if (!r.ok) throw new Error(`OpenAI ${r.status}`);
          const j: any = await r.json();
          return String(j?.choices?.[0]?.message?.content || "");
        }
      : undefined,
    fallback: async (system, user) => {
      const anthropic = getAnthropic();
      if (!anthropic) throw new Error("Anthropic not configured");
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 500, temperature: 0,
        system, messages: [{ role: "user", content: user }],
      });
      return String((msg?.content?.[0] as any)?.text || "");
    },
  };
}