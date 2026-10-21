/** Display-only helpers for AI credits. The server owns the balance; nothing here grants or checks access. */
export const LOW_CREDIT_THRESHOLD = 20;

export type CreditLevel = "unknown" | "ok" | "low" | "empty";

export function creditLevel(balance: unknown): CreditLevel {
  if (typeof balance !== "number" || !Number.isFinite(balance)) return "unknown";
  if (balance < 1) return "empty";
  if (balance < LOW_CREDIT_THRESHOLD) return "low";
  return "ok";
}

export function formatDay(iso: string | undefined | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export interface PlanStatus {
  label: "Free" | "Individual Pro" | "Individual Pro (expired)";
  validTill: string; // formatted day, "" when none
  active: boolean;
}

/** Tier + expiry shown to the user. Expiry is display-only for now; the server does not yet downgrade on expiry. */
export function planStatus(tier: unknown, tierExpiresAt: unknown, now: number = Date.now()): PlanStatus {
  const isPro = typeof tier === "string" && tier.toLowerCase().includes("individual pro");
  if (!isPro) return { label: "Free", validTill: "", active: false };
  const exp = typeof tierExpiresAt === "string" ? Date.parse(tierExpiresAt) : NaN;
  if (Number.isFinite(exp) && exp < now) return { label: "Individual Pro (expired)", validTill: formatDay(tierExpiresAt as string), active: false };
  return { label: "Individual Pro", validTill: Number.isFinite(exp) ? formatDay(tierExpiresAt as string) : "", active: true };
}

/** Human labels for what spends credits (grouped so the list stays short). */
export const CREDIT_USE_LABELS: Array<{ label: string; actions: string[] }> = [
  { label: "Voice transcription", actions: ["stt"] },
  { label: "Dictation / pasted-sheet extraction", actions: ["scribe_chat", "scribe_extract", "voice_dictation", "voice_extract"] },
  { label: "AI discharge draft", actions: ["ai_discharge", "discharge_summary"] },
  { label: "MATE / case discussion, handover chat, reference, differentials, ABG", actions: ["case_discussion", "handover_chat", "em_reference", "decision_support", "differentials", "interpret_abg"] },
  { label: "Document / photo scans", actions: ["vision_scan", "scan_mnemonic"] },
  { label: "Rounds debrief", actions: ["rounds_debrief"] },
  { label: "Handover & rota parsing", actions: ["handover_parse", "handover_compile", "parse_rota"] },
  { label: "Lens report", actions: ["lens_report"] },
  { label: "Mortality audit (M&M)", actions: ["mortality_audit"] },
];
