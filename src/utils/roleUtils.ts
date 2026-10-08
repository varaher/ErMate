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
 * - Else if user has no active verified hospital membership -> independent
 * - varahgrp@gmail.com remains platform admin / HOD-equivalent for management views.
 *
 * CORE PRODUCT INVARIANT:
 * PROFESSIONAL ROLE != TEAM MEMBERSHIP
 * PROFILE HOSPITAL NAME != TEAM MEMBERSHIP
 * Team membership exists ONLY when there is an active, verified team_members document.
 */
export function getNormalizedRole(context: UserRoleContext): NormalizedRole {
  const email = (context.email || "").toLowerCase().trim();
  if (email === "varahgrp@gmail.com") {
    return "hod";
  }

  // Active hospital membership MUST be explicitly true.
  // Never infer hospital team membership from profile.hospital or profile.role.
  const hasActiveHospital = context.hasActiveHospitalMembership === true;

  if (!hasActiveHospital) {
    return "independent";
  }

  // Team authorization role is derived strictly from canonical membershipRole.
  const memberRoleStr = (context.membershipRole || "").trim();

  if (isExactHospitalAdminRole(memberRoleStr)) {
    return "hod";
  }

  const roleLower = memberRoleStr.toLowerCase();
  if (roleLower.includes("consultant")) {
    return "consultant";
  }

  if (
    roleLower.includes("resident") ||
    roleLower.includes("doctor") ||
    roleLower.includes("physician") ||
    roleLower.includes("smo") ||
    roleLower.includes("cmo")
  ) {
    return "resident";
  }

  // Default fallback for active member with unspecified role
  return "resident";
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
      return rawRole ? `${rawRole} (Individual)` : "Independent Clinician";
  }
}
