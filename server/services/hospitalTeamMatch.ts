/**
 * One-team-per-hospital matching service (server/services/hospitalTeamMatch.ts).
 * Ensures that if a hospital already has a live team with active members, doctors from
 * the same hospital are guided to request to join that team rather than creating duplicates.
 */

export interface HospitalIdentity {
  name: string;
  nameKey: string;
  directoryId: string | null;
  district: string | null;
}

export interface ExistingHospitalTeamMatch {
  teamId: string;
  teamName: string;
  hospitalName: string;
  activeMembers: number;
}

/** Normalized key for comparing hospital names across minor punctuation/casing differences. */
export function hospitalKey(raw: unknown): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isActiveMemberStatus(status: unknown): boolean {
  const s = String(status || "").trim().toLowerCase();
  return s === "active" || s === "active (joined)";
}

/** Extracts canonical hospital identity from a user document and/or an explicit hospital name. */
export function identityFromUser(user: any, explicitHospitalName?: unknown): HospitalIdentity {
  const name = String(
    explicitHospitalName ||
      user?.hospitalName ||
      user?.hospital ||
      ""
  ).trim();
  const directoryId =
    typeof user?.hospitalDirectoryId === "string" && user.hospitalDirectoryId.trim()
      ? user.hospitalDirectoryId.trim()
      : typeof user?.facilityId === "string" && user.facilityId.trim()
      ? user.facilityId.trim()
      : null;
  const districtRaw = user?.district || user?.place || "";
  const district =
    typeof districtRaw === "string" && districtRaw.trim()
      ? districtRaw.trim().toLowerCase()
      : null;

  return {
    name,
    nameKey: hospitalKey(name),
    directoryId,
    district,
  };
}

/**
 * Looks up an existing live team for the given hospital identity.
 * A team counts as live if it has at least one active member.
 */
export async function findExistingHospitalTeam(
  db: any,
  identity: HospitalIdentity
): Promise<ExistingHospitalTeamMatch | null> {
  if (!db || (!identity.nameKey && !identity.directoryId)) {
    return null;
  }

  const teamsSnap = await db.collection("teams").get();
  const candidates: Array<{ id: string; data: any }> = [];

  for (const docSnap of teamsSnap.docs) {
    const data = docSnap.data() || {};
    const teamId = String(data.id || docSnap.id || "").trim();
    if (!teamId) continue;

    const dirMatch =
      Boolean(identity.directoryId) &&
      Boolean(data.hospitalDirectoryId) &&
      String(data.hospitalDirectoryId).trim() === identity.directoryId;

    const teamKey = String(data.hospitalNameKey || hospitalKey(data.hospitalName || data.teamName || "")).trim();
    const nameMatch = Boolean(identity.nameKey) && Boolean(teamKey) && teamKey === identity.nameKey;

    if (!dirMatch && !nameMatch) continue;

    // If both specify a district and they differ (and directoryId did not explicitly match), skip.
    const teamDistrict = typeof data.district === "string" && data.district.trim() ? data.district.trim().toLowerCase() : null;
    if (!dirMatch && identity.district && teamDistrict && identity.district !== teamDistrict) {
      continue;
    }

    candidates.push({ id: teamId, data });
  }

  if (candidates.length === 0) return null;

  let best: ExistingHospitalTeamMatch | null = null;
  for (const c of candidates) {
    const membersSnap = await db
      .collection("team_members")
      .where("hospitalId", "==", c.id)
      .get();
    const activeMembers = membersSnap.docs.filter((d: any) => isActiveMemberStatus(d.data()?.status)).length;
    if (activeMembers <= 0) continue;

    const match: ExistingHospitalTeamMatch = {
      teamId: c.id,
      teamName: String(c.data.teamName || c.data.hospitalName || "ED Team"),
      hospitalName: String(c.data.hospitalName || identity.name || ""),
      activeMembers,
    };
    if (!best || match.activeMembers > best.activeMembers) {
      best = match;
    }
  }

  return best;
}
