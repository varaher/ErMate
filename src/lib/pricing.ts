/**
 * Single source of truth for ErMate individual pricing. Used by the server (order amount + credit grant)
 * and by the UI (display only). The client NEVER supplies an amount or credit count.
 * All prices are in paise and INCLUDE GST. Purchases are one-time Razorpay orders (no auto-renewal).
 */
export type PlanKind = "plan" | "refill";

export interface PlanPrice {
  kind: PlanKind;
  amountPaise: number;
  credits: number;
  label: string;
  /** For kind "plan": days of Individual Pro entitlement granted (extends from current expiry if still active). */
  periodDays?: number;
}

export const PLAN_PRICING: Record<string, PlanPrice> = {
  individual_pro_monthly: { kind: "plan",   amountPaise: 60000,  credits: 300,  label: "Individual Pro (1 month)", periodDays: 30 },
  credits_refill_150:     { kind: "refill", amountPaise: 30000,  credits: 150,  label: "150 credits recharge" },
  credits_refill_350:     { kind: "refill", amountPaise: 70000,  credits: 350,  label: "350 credits recharge" },
  credits_refill_500:     { kind: "refill", amountPaise: 100000, credits: 500,  label: "500 credits recharge" },
};

/** Price per credit charged to the user, GST inclusive (informational; amounts above are the authority). */
export const RUPEES_PER_CREDIT = 2;
/** Target value of AI work (our cost to serve) delivered per credit, in rupees. Calibrate against real vendor bills. */
export const TARGET_COST_PER_CREDIT_RUPEES = 1.5;

/**
 * Credits deducted per successful AI action. A credit is consumed only AFTER a successful response.
 * These are STARTING weights: calibrate them against real vendor costs using the creditUsage ledger.
 * Actions not listed here (case sheet, saving, viewing, triage, handover PDF, team, logbook) are free.
 */
export const CREDIT_COSTS = {
  stt: 1,                    // Sarvam speech-to-text, per transcription request
  scribe_chat: 1,            // dictation / pasted-sheet extraction turn
  scribe_extract: 1,
  voice_dictation: 1,
  voice_extract: 1,
  ai_discharge: 3,           // AI discharge draft
  discharge_summary: 3,
  case_discussion: 1,
  handover_chat: 1,
  em_reference: 1,
  decision_support: 1,
  differentials: 1,
  interpret_abg: 1,
  lens_report: 2,
  rounds_debrief: 3,
  vision_scan: 2,            // document / OCR / MLC scan
  scan_mnemonic: 1,
  parse_rota: 2,
  handover_parse: 2,
  handover_compile: 2,
  mortality_audit: 3,
} as const;
export type CreditAction = keyof typeof CREDIT_COSTS;

export const PLAN_KEYS = Object.keys(PLAN_PRICING);
export const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString("en-IN")}`;
