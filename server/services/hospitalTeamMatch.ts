/**
 * One team per hospital (Neeraj, 20 Nov 2026): once a hospital has a team, other doctors there
 * request to join it instead of creating a second one.
 *
 * Matching a doctor's hospital to an existing team:
 *  - both sides have a hospital-directory id (name + district + state) → the ids must be equal;
 *  - otherwise the hospital names must match (punctuation/case ignored) and, when both districts
 *    are known, the districts must match too (so "General Hospital" in two districts stay apart).
 * Only teams with at least one active member count; an abandoned team never blocks a hospital.
 */

/** Same normalisation as src/utils/hospitalDirectory.ts directoryKey(): "M.B.M. Hospital, Kochi" → "mbm-hospital-kochi". */
export function hospitalKey(text: unknown): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[.'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export interface HospitalIdentity {
  nameKey: string;
  directoryId?: string;
  district?: string;
}

export function sameHospital(a: HospitalIdentity, b: HospitalIdentity): boolean {
  if (!a.nameKey && !a.directoryId) return false;
  if (a.directoryId && b.directoryId) return a.directoryId === b.directoryId;
  if (!a.nameKey || a.nameKey !== b.nameKey) return false;
  const da = hospitalKey(a.district);
  const dbk = hospitalKey(b.district);
  return !da || !dbk || da === dbk;
}

/** The doctor's hospital from their profile (users/{uid}). If a different hospital name is given, only the name is used. */
export function identityFromUser(user: any, overrideHospitalName?: string): HospitalIdentity {
  const profileName = String(user?.workplaceName || user?.hospitalLabel || user?.hospitalName || user?.hospital || "").trim();
  const name = String(overrideHospitalName || profileName).trim();
  const nameKey = hospitalKey(name);
  const sameAsProfile = !!profileName && hospitalKey(profileName) === nameKey;
  return {
    nameKey,
    directoryId: sameAsProfile && user?.hospitalDirectoryId ? String(user.hospitalDirectoryId) : undefined,
    district: sameAsProfile && user?.district ? String(user.district) : undefined,
  };
}

/** A team's hospital. Older teams didn't store directory/district, so the creator's profile fills the gap. */
export function identityFromTeam(team: any, creator?: any): HospitalIdentity {
  const nameKey = String(team?.hospitalNameKey || "") || hospitalKey(team?.hospitalName);
  const creatorMatches = !!creator && hospitalKey(creator.workplaceName || creator.hospitalLabel || creator.hospitalName || creator.hospital) === nameKey;
  return {
    nameKey,
    directoryId: team?.hospitalDirectoryId || (creatorMatches && creator.hospitalDirectoryId ? String(creator.hospitalDirectoryId) : undefined),
    district: team?.district || (creatorMatches && creator.district ? String(creator.district) : undefined),
  };
}

export interface ExistingHospitalTeam {
  teamId: string;
  teamName: string;
  hospitalName: string;
  activeMembers: number;
}

const isActive = (s: unknown) => {
  const v = String(s || "").trim().toLowerCase();
  return v === "active" || v === "active (joined)";
};

/**
 * Finds a live team for this hospital. Reads the teams collection (small: one per hospital);
 * add an index on hospitalNameKey if it ever grows into thousands.
 */
export async function findExistingHospitalTeam(db: any, mine: HospitalIdentity, excludeTeamId?: string): Promise<ExistingHospitalTeam | null> {
  if (!mine.nameKey && !mine.directoryId) return null;
  const teamsSnap = await db.collection("teams").limit(2000).get();
  const creatorCache = new Map<string, any>();
  for (const docSnap of teamsSnap.docs) {
    if (excludeTeamId && docSnap.id === excludeTeamId) continue;
    const team = docSnap.data() || {};
    // Cheap pre-filter: name or directory id must be able to match.
    const quickName = String(team.hospitalNameKey || "") || hospitalKey(team.hospitalName);
    if (quickName !== mine.nameKey && !(mine.directoryId && team.hospitalDirectoryId === mine.directoryId)) continue;

    let creator: any = undefined;
    const creatorUid = String(team.createdByUid || "");
    if (creatorUid && (!team.hospitalDirectoryId || !team.district)) {
      if (!creatorCache.has(creatorUid)) {
        const u = await db.collection("users").doc(creatorUid).get().catch(() => null);
        creatorCache.set(creatorUid, u && u.exists ? u.data() : null);
      }
      creator = creatorCache.get(creatorUid) || undefined;
    }
    if (!sameHospital(mine, identityFromTeam(team, creator))) continue;

    const membersSnap = await db.collection("team_members").where("hospitalId", "==", docSnap.id).get();
    const activeMembers = membersSnap.docs.filter((d: any) => isActive(d.data()?.status)).length;
    if (activeMembers === 0) continue;

    return {
      teamId: docSnap.id,
      teamName: String(team.teamName || team.hospitalName || "Hospital team"),
      hospitalName: String(team.hospitalName || ""),
      activeMembers,
    };
  }
  return null;
}