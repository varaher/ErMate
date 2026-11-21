/**
 * The one list of team roles (Teams audit M5, 20 Nov 2026).
 * Used by every role dropdown on the Team page (approve, add clinician, change designation).
 * Every entry, lower-cased, must also be in INVITE_ALLOWED_ROLES in server/routes/team.routes.ts
 * (verify_teams_batch_b.ts checks this), otherwise the server rejects it as "Invalid clinical role".
 *
 * HOD (Neeraj, 20 Nov 2026): the team's own lead/admin can make a member HOD — no platform
 * approval needed. On the server, HOD also makes that member a Team Admin.
 */
export const TEAM_ROLE_OPTIONS: string[] = [
  "HOD",
  "Emergency Physician",
  "Consultant",
  "Senior Consultant",
  "Senior Resident",
  "Resident",
  "EM Resident",
  "EM Intern",
  "Medical Officer",
  "Fellow",
  "Staff Nurse",
  "Clinical Pharmacist",
  "Scribe Specialist",
];

/** Display label for a stored role (the server may store it lower-cased, e.g. "senior consultant"). */
export function teamRoleLabel(role: unknown): string {
  const raw = String(role || "").trim();
  if (!raw) return "";
  const match = TEAM_ROLE_OPTIONS.find((r) => r.toLowerCase() === raw.toLowerCase().replace(/_/g, " "));
  if (match) return match;
  if (/^hod\b/i.test(raw)) return "HOD";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Dropdown options for a member: the shared list, plus their current role if it is something else (e.g. HOD). */
export function teamRoleOptionsFor(currentRole: unknown): string[] {
  const label = teamRoleLabel(currentRole);
  return label && !TEAM_ROLE_OPTIONS.includes(label) ? [label, ...TEAM_ROLE_OPTIONS] : TEAM_ROLE_OPTIONS;
}