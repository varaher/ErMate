/**
 * src/utils/profileCompleteness.ts
 *
 * Deterministic helpers for ErMate clinical onboarding and save eligibility:
 * 1. isClinicalProfileComplete(profile, erPhysicalBedCapacity?)
 * 2. canPersistClinicalData({ user, profile, canonicalMembership, erPhysicalBedCapacity? })
 *
 * INVARIANTS:
 * - Profile completion != Team authorization.
 * - Profile hospital/role is informational only.
 * - Every user starts Individual.
 * - An incomplete profile allows trial exploration (in-memory case dictation,
 *   calculators, demo, review) but blocks persistent writing of new cases until
 *   the clinical profile is complete.
 */

import type { UserProfile } from "../types";

export interface ProfileCompletenessResult {
  isComplete: boolean;
  missingFields: string[];
}

export function getProfileCompletenessDetails(
  profile?: UserProfile | null,
  erPhysicalBedCapacity?: number | null
): ProfileCompletenessResult {
  const missing: string[] = [];

  if (!profile) {
    return {
      isComplete: false,
      missingFields: ["Doctor Name", "Professional Role", "Hospital / Workplace Name", "Department", "ER Physical Bed Capacity"],
    };
  }

  // 1. Doctor Name
  const name = String(profile.name || "").trim();
  if (!name || name.length < 2) {
    missing.push("Doctor Name");
  }

  // 2. Professional Role
  const role = String(profile.role || "").trim();
  if (!role || role.length < 2) {
    missing.push("Professional Role");
  }

  // 3. Hospital / Workplace Name (personal workplace metadata only)
  const workplace = String(profile.workplaceName || profile.hospital || profile.hospitalLabel || "").trim();
  if (!workplace || workplace.length < 2) {
    missing.push("Hospital / Workplace Name");
  }

  // 4. Department
  const department = String(profile.department || "").trim();
  if (!department || department.length < 2) {
    missing.push("Department");
  }

  // 5. ER Physical Bed Capacity
  const capacity =
    typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0
      ? erPhysicalBedCapacity
      : typeof (profile as any).erPhysicalBedCapacity === "number" && (profile as any).erPhysicalBedCapacity > 0
      ? (profile as any).erPhysicalBedCapacity
      : null;

  if (!capacity || !Number.isInteger(capacity) || capacity <= 0) {
    missing.push("ER Physical Bed Capacity");
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

export function isClinicalProfileComplete(
  profile?: UserProfile | null,
  erPhysicalBedCapacity?: number | null
): boolean {
  return getProfileCompletenessDetails(profile, erPhysicalBedCapacity).isComplete;
}

export interface CanPersistClinicalDataParams {
  user?: { uid: string; email?: string | null } | null;
  profile?: UserProfile | null;
  canonicalMembership?: {
    status?: string | null;
    membershipVerified?: boolean | null;
    hospitalId?: string | null;
    role?: string | null;
  } | null;
  erPhysicalBedCapacity?: number | null;
  hasExistingCase?: boolean; // Existing historical cases are never blocked from updates
}

export interface ClinicalSaveGateResult {
  canSave: boolean;
  reason?: string;
  isTrialOnly: boolean;
}

/**
 * Centralized clinical save eligibility gate.
 *
 * Rules:
 * - Unauthenticated -> blocked
 * - Authenticated + Existing historical case update -> allowed (never breaks existing patient data)
 * - Authenticated + Verified active Team member -> save allowed (canonical membership is root-of-trust)
 * - Authenticated + Complete profile + Individual -> save allowed
 * - Authenticated + Incomplete profile -> persistent new case saving blocked, trial mode allowed
 */
export function canPersistClinicalData(
  params: CanPersistClinicalDataParams
): ClinicalSaveGateResult {
  const { user, profile, canonicalMembership, erPhysicalBedCapacity, hasExistingCase } = params;

  if (!user || !user.uid) {
    return {
      canSave: false,
      reason: "Authentication required to save cases.",
      isTrialOnly: true,
    };
  }

  // Existing historical cases are never destroyed or locked from updates
  if (hasExistingCase) {
    return {
      canSave: true,
      isTrialOnly: false,
    };
  }

  // Active verified team members have canonical hospital authority and are not downgraded
  const isVerifiedTeam = Boolean(
    canonicalMembership &&
    (canonicalMembership.status === "active" || canonicalMembership.status === "Active (Joined)") &&
    canonicalMembership.membershipVerified === true &&
    canonicalMembership.hospitalId
  );

  if (isVerifiedTeam) {
    return {
      canSave: true,
      isTrialOnly: false,
    };
  }

  // For individual clinicians, profile must be complete
  const complete = isClinicalProfileComplete(profile, erPhysicalBedCapacity);
  if (!complete) {
    return {
      canSave: false,
      reason: "Complete your profile to enable permanent case saving.",
      isTrialOnly: true,
    };
  }

  return {
    canSave: true,
    isTrialOnly: false,
  };
}
