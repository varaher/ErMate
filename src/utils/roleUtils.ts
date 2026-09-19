export type NormalizedRole = "hod" | "consultant" | "resident" | "independent";

export interface UserRoleContext {
  email?: string | null;
  role?: string | null;
  hospital?: string | null;
  hasActiveHospitalMembership?: boolean;
  membershipRole?: string | null;
}

/**
 * Normalizes user and membership roles into one of 4 canonical roles:
 * - hod
 * - consultant
 * - resident
 * - independent
 *
 * Rules:
 * - If user has an active hospital team membership with role containing hod/head/lead/owner -> hod
 * - Else if user has active hospital team membership with consultant -> consultant
 * - Else if user has active hospital team membership with resident/doctor/physician/smo/cmo -> resident
 * - Else if user has no active hospital membership -> independent
 * - varahgrp@gmail.com remains platform admin / HOD-equivalent for management views.
 */
export function getNormalizedRole(context: UserRoleContext): NormalizedRole {
  const email = (context.email || "").toLowerCase().trim();
  if (email === "varahgrp@gmail.com") {
    return "hod";
  }

  const roleStr = (context.membershipRole || context.role || "").toLowerCase().trim();
  
  // Determine if active hospital membership exists
  const hasHospital = context.hasActiveHospitalMembership !== undefined
    ? context.hasActiveHospitalMembership
    : Boolean(context.hospital && context.hospital.trim() !== "" && context.hospital.toLowerCase() !== "independent" && context.hospital.toLowerCase() !== "none");

  if (!hasHospital && email !== "varahgrp@gmail.com") {
    return "independent";
  }

  if (
    roleStr.includes("hod") ||
    roleStr.includes("head") ||
    roleStr.includes("lead") ||
    roleStr.includes("owner")
  ) {
    return "hod";
  }

  if (roleStr.includes("consultant")) {
    return "consultant";
  }

  if (
    roleStr.includes("resident") ||
    roleStr.includes("doctor") ||
    roleStr.includes("physician") ||
    roleStr.includes("smo") ||
    roleStr.includes("cmo")
  ) {
    return "resident";
  }

  // If user has hospital membership but raw role is undefined/unrecognized, default to resident
  if (hasHospital) {
    return "resident";
  }

  return "independent";
}

export function isHODRole(context: UserRoleContext): boolean {
  return getNormalizedRole(context) === "hod";
}

export function isPlatformAdmin(email?: string | null): boolean {
  return (email || "").toLowerCase().trim() === "varahgrp@gmail.com";
}

export function getRoleDisplayLabel(normalizedRole: NormalizedRole, rawRole?: string | null): string {
  switch (normalizedRole) {
    case "hod":
      return rawRole && rawRole.toLowerCase().includes("hod") ? rawRole : "HOD / Department Lead";
    case "consultant":
      return rawRole && rawRole.toLowerCase().includes("consultant") ? rawRole : "Senior Consultant";
    case "resident":
      return rawRole || "EM Resident";
    case "independent":
      return "Independent Clinician";
  }
}
