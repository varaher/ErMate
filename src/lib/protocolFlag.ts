// "Flag a concern" on a protocol step. Pure validation + limits, shared by the server route and tests.
// A flag NEVER edits a protocol: it is only a private note to the reviewers.

export const FLAG_REASONS = ["dose", "outdated", "unsafe", "unclear", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  dose: "Dose looks wrong",
  outdated: "Outdated",
  unsafe: "Unsafe",
  unclear: "Unclear",
  other: "Other",
};

export const FLAG_LIMITS = {
  /** Flags one user can send in 24 hours (spam guard). */
  perUserPerDay: 20,
  maxComment: 1000,
  maxStepText: 300,
} as const;

export interface ProtocolFlagInput {
  topicId: string;
  topicVersion: string;
  /** Empty string = the flag is about the whole protocol, not one step. */
  stepKey: string;
  stepLabel: string;
  reason: FlagReason;
  comment: string;
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export interface ProtocolFlagValidation {
  ok: boolean;
  value?: ProtocolFlagInput;
  error?: string;
}

export function validateProtocolFlag(body: any): ProtocolFlagValidation {
  if (!body || typeof body !== "object") return { ok: false, error: "Missing flag details." };
  const topicId = clean(body.topicId, 80);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(topicId)) return { ok: false, error: "Unknown protocol." };
  const reason = body.reason as FlagReason;
  if (!FLAG_REASONS.includes(reason)) return { ok: false, error: "Please choose a reason." };
  const stepKey = clean(body.stepKey, 80);
  if (stepKey && !/^[a-z0-9-]+:\d{1,3}:\d{1,3}$/.test(stepKey)) return { ok: false, error: "Invalid step." };
  return {
    ok: true,
    value: {
      topicId,
      topicVersion: clean(body.topicVersion, 20),
      stepKey,
      stepLabel: clean(body.stepLabel, FLAG_LIMITS.maxStepText),
      reason,
      comment: clean(body.comment, FLAG_LIMITS.maxComment),
    },
  };
}

/** True while a user is still under the daily limit. `timestamps` are ms of this user's earlier flags. */
export function underDailyFlagLimit(timestamps: number[], now: number = Date.now()): boolean {
  const recent = timestamps.filter((t) => now - t < 24 * 60 * 60 * 1000);
  return recent.length < FLAG_LIMITS.perUserPerDay;
}