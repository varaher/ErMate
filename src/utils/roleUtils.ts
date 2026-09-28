export type NormalizedRole = "hod" | "consultant" | "resident" | "independent";

export interface UserRoleContext {
  email?: string | null;
  role?: string | null;
  hospital?: string | null;
  hasActiveHospitalMembership?: boolean;
  membershipRole?: string | null;
}

export const EXACT_ADMIN_ROLES = [
  "hod",
  "hod / department lead",
  "hod / shift lead"
] as const;

export function isExactHospitalAdminRole(roleStr?: string | null): boolean {
  if (!roleStr || typeof roleStr !== "string") return false;
  return EXACT_ADMIN_ROLES.includes(roleStr.trim().toLowerCase() as any);
}

/**
 * Normalizes user and membership roles into one of 4 canonical roles:
 * - hod
 * - consultant
 * - resident
 * - independent
 *
 * Rules:
 * - If user has an active hospital team membership with exact admin role ('hod', 'hod / department lead', 'hod / shift lead') -> hod
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

  const roleStr = (context.membershipRole || context.role || "").trim();
  
  // Determine if active hospital membership exists
  const hasHospital = context.hasActiveHospitalMembership !== undefined
    ? context.hasActiveHospitalMembership
    : Boolean(context.hospital && context.hospital.trim() !== "" && context.hospital.toLowerCase() !== "independent" && context.hospital.toLowerCase() !== "none");

  if (!hasHospital && email !== "varahgrp@gmail.com") {
    return "independent";
  }

  if (isExactHospitalAdminRole(roleStr)) {
    return "hod";
  }

  const roleLower = roleStr.toLowerCase();
  if (roleLower.includes("consultant")) {
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
