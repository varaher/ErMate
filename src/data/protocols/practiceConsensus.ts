// Practice-pattern consensus rules for the protocol library. Pure logic, no data collection, no AI.
// The reviewed BASE protocol is always the standard. Observed hospital practice is shown separately,
// and a common habit alone never becomes a recommendation or changes the base.

/** Starting thresholds. These are product decisions: change them here and nowhere else. */
export const CONSENSUS_RULES = {
  /** Share of contributing hospitals that must follow a step (proposed 70%). */
  minShare: 0.7,
  /** Minimum number of contributing hospitals before any consensus is shown. */
  minHospitals: 10,
  /** Minimum number of different states those hospitals must cover. */
  minStates: 3,
  /** Minimum number of different hospital types (e.g. government, private, teaching). */
  minHospitalTypes: 2,
} as const;

/** One hospital answer about one step. De-identified: a hospital counts once, never a doctor. */
export interface PracticeObservation {
  topicId: string;
  /** Stable id of the step inside the protocol, e.g. "cad-acs-adult:avil-before-cag" */
  stepKey: string;
  /** Anonymous hospital key. Many doctors from one hospital still count as one hospital. */
  hospitalKey: string;
  state: string;
  hospitalType: string;
  /** true = this hospital follows the step, false = it does not */
  follows: boolean;
}

export type ConsensusStatus =
  | "not_enough_hospitals"
  | "not_enough_states"
  | "not_enough_hospital_types"
  | "below_threshold"
  | "blocked_by_base_review"
  | "consensus";

export interface StepConsensus {
  stepKey: string;
  hospitals: number;
  following: number;
  share: number;
  states: number;
  hospitalTypes: number;
  status: ConsensusStatus;
  /** Only true for status "consensus". Even then it is shown apart from the base standard. */
  canShowAsIndiaConsensus: boolean;
}

/**
 * Decide whether one step qualifies to be shown as "followed by most contributing Indian hospitals".
 * baseReviewBlocked = the clinical reviewers have marked the step unsafe or contradicted by the base standard:
 * such a step can never be shown as consensus, however common it is.
 */
export function evaluateStepConsensus(
  observations: PracticeObservation[],
  stepKey: string,
  opts?: { baseReviewBlocked?: boolean }
): StepConsensus {
  // one answer per hospital: if a hospital reports both ways, it is counted as NOT following (conservative)
  const byHospital = new Map<string, { follows: boolean; state: string; type: string }>();
  for (const o of observations) {
    if (o.stepKey !== stepKey) continue;
    const prev = byHospital.get(o.hospitalKey);
    byHospital.set(o.hospitalKey, {
      follows: prev ? prev.follows && o.follows : o.follows,
      state: o.state,
      type: o.hospitalType,
    });
  }
  const hospitals = byHospital.size;
  const rows = Array.from(byHospital.values());
  const following = rows.filter((r) => r.follows).length;
  const share = hospitals ? following / hospitals : 0;
  const states = new Set(rows.map((r) => r.state.trim().toLowerCase()).filter(Boolean)).size;
  const hospitalTypes = new Set(rows.map((r) => r.type.trim().toLowerCase()).filter(Boolean)).size;

  let status: ConsensusStatus;
  if (hospitals < CONSENSUS_RULES.minHospitals) status = "not_enough_hospitals";
  else if (states < CONSENSUS_RULES.minStates) status = "not_enough_states";
  else if (hospitalTypes < CONSENSUS_RULES.minHospitalTypes) status = "not_enough_hospital_types";
  else if (share < CONSENSUS_RULES.minShare) status = "below_threshold";
  else if (opts?.baseReviewBlocked) status = "blocked_by_base_review";
  else status = "consensus";

  return { stepKey, hospitals, following, share, states, hospitalTypes, status, canShowAsIndiaConsensus: status === "consensus" };
}