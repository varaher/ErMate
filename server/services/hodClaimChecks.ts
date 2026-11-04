/**
 * Shared HOD-claim helpers, used by POST /api/team/approve-hod-claim and the admin portal's HOD Requests page,
 * so both show and enforce the same warnings.
 */

/** Same hospital ID the approval endpoint has always produced. */
export function resolveHodHospital(claim: any, explicitId?: unknown, explicitName?: unknown): { hospitalId: string; hospitalName: string } {
  const hospitalName = String(explicitName || claim?.hospital || "").trim();
  const rawId = String(explicitId || claim?.hospitalId || "").trim();
  const hospitalId = rawId || hospitalName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
  return { hospitalId, hospitalName };
}

const isActive = (m: any) => {
  const st = String(m?.status || "").trim().toLowerCase();
  return st === "active" || st === "active (joined)";
};
const isHodRole = (role: unknown) => String(role || "").trim().toLowerCase().startsWith("hod");

/**
 * Things the platform admin must see before approving:
 *  - the hospital already has an active HOD (approving makes two)
 *  - the claimant is an active member of a DIFFERENT hospital (approving moves them out of that team)
 */
export async function hodApprovalWarnings(db: any, claimantUid: string, hospitalId: string, hospitalName: string): Promise<string[]> {
  const warnings: string[] = [];
  if (!claimantUid || !hospitalId) return warnings;

  const own = await db.collection("team_members").doc(claimantUid).get();
  if (own.exists) {
    const m = own.data() || {};
    const otherHospital = String(m.hospitalId || "").trim();
    if (isActive(m) && otherHospital && otherHospital !== hospitalId) {
      warnings.push(`This doctor is an active member of ${m.hospitalName || m.hospital || otherHospital}. Approving moves them out of that team.`);
    }
  }

  const sameHospital = await db.collection("team_members").where("hospitalId", "==", hospitalId).get();
  const hods = sameHospital.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => m.id !== claimantUid && isActive(m) && isHodRole(m.role));
  if (hods.length > 0) {
    const names = hods.map((h: any) => h.name || h.email || h.id).join(", ");
    warnings.push(`${hospitalName || hospitalId} already has an HOD (${names}). Approving makes ${hods.length + 1} HODs.`);
  }
  return warnings;
}