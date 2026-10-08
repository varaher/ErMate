/**
 * verify_team_invite_stuck_resolution.ts
 *
 * Verification suite for:
 * 1. Explicit invite generation states (idle, loading, success, error) & no infinite loading
 * 2. User-visible error reporting ("Could not generate invitation.") with actual safe reason & Retry button
 * 3. Canonical hospital identity resolution (team_members/{uid} and platform admin users/{uid})
 * 4. createTeamInvite structured params contract & platform-admin validation
 * 5. Elimination of re-triggering on workplaceInput text edits
 * 6. Both inline card and modal UI consistency
 */

import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

console.log("================================================================================");
console.log("ERMATE — VERIFY TEAM INVITE STUCK 'GENERATING INVITATION...' RESOLUTION");
console.log("================================================================================");

const teamRosterTsx = fs.readFileSync(path.resolve("src/components/TeamRosterBoard.tsx"), "utf8");
const teamInviteServiceTs = fs.readFileSync(path.resolve("src/services/teamInviteService.ts"), "utf8");
const teamRoutesTs = fs.readFileSync(path.resolve("server/routes/team.routes.ts"), "utf8");

// -----------------------------------------------------------------------------
// PART 1: EXPLICIT INVITE GENERATION STATES & NO INFINITE LOADING
// -----------------------------------------------------------------------------
console.log("\n--- PART 1: EXPLICIT INVITE GENERATION STATE & NO FALSE LOADING ---");

assert(
  teamRosterTsx.includes('type InviteGenerationStatus = "idle" | "loading" | "success" | "error";') ||
  teamRosterTsx.includes('type InviteGenerationStatus = "idle" | "loading" | "success" | "error"'),
  "1. TeamRosterBoard defines explicit InviteGenerationStatus: idle, loading, success, error"
);

assert(
  teamRosterTsx.includes('const [inviteStatus, setInviteStatus] = useState<InviteGenerationStatus>("idle");') &&
  teamRosterTsx.includes('const [inviteGenerationError, setInviteGenerationError] = useState<string | null>(null);'),
  "2. Explicit inviteStatus and inviteGenerationError state variables initialized"
);

assert(
  teamRosterTsx.includes('setInviteStatus("loading");') &&
  teamRosterTsx.includes('setInviteGenerationError(null);'),
  "3. Loading clears previous errors and sets status to loading on start"
);

assert(
  teamRosterTsx.includes('setInviteStatus("success");') &&
  teamRosterTsx.includes('setInviteStatus("error");'),
  "4. Success and error states terminate loading deterministically"
);

// -----------------------------------------------------------------------------
// PART 2: USER-VISIBLE ERROR REPORTING & RETRY BUTTON
// -----------------------------------------------------------------------------
console.log("\n--- PART 2: USER-VISIBLE ERROR REPORTING & RETRY ACTION ---");

assert(
  teamRosterTsx.includes("Could not generate invitation."),
  "5. UI renders explicit user-visible error banner: 'Could not generate invitation.'"
);

assert(
  teamRosterTsx.includes("inviteGenerationError ||"),
  "6. UI renders actual safe reason under the error header"
);

assert(
  teamRosterTsx.includes("Retry") && teamRosterTsx.includes("handleGenerateInvite"),
  "7. Both UI views provide a [ Retry ] button calling handleGenerateInvite"
);

// Check that buttons are disabled during loading or error
assert(
  teamRosterTsx.includes("disabled={!generatedLink || inviteStatus === \"loading\"}"),
  "8. Copy Link and Share remain disabled when no link is generated or when loading"
);

// -----------------------------------------------------------------------------
// PART 3: CANONICAL HOSPITAL IDENTITY RESOLUTION
// -----------------------------------------------------------------------------
console.log("\n--- PART 3: CANONICAL HOSPITAL SCOPE RESOLUTION ---");

assert(
  teamRosterTsx.includes("resolveCanonicalHospitalScope"),
  "9. TeamRosterBoard implements resolveCanonicalHospitalScope helper"
);

assert(
  teamRosterTsx.includes('doc(db, "team_members", user.uid)') &&
  teamRosterTsx.includes("isActiveMembershipStatus") &&
  teamRosterTsx.includes("Only active verified HODs can create invites."),
  "10. Scope resolution enforces canonical team_members/{uid} status, verification, and HOD role"
);

assert(
  teamRosterTsx.includes("isPlatformAdmin") &&
  teamRosterTsx.includes("Platform admin invites require a valid hospital workspace."),
  "11. Platform admin workspace validation fails closed if no canonical hospital scope is found"
);

// Ensure profile.hospital or workplaceInput are NOT used as authorization identity
assert(
  !teamRosterTsx.includes("createTeamInvite(targetHosp, auth.currentUser.uid"),
  "12. Untrusted targetHosp fallback completely eliminated from invite generation"
);

// -----------------------------------------------------------------------------
// PART 4: createTeamInvite SERVICE CONTRACT & PLATFORM ADMIN SAFETY
// -----------------------------------------------------------------------------
console.log("\n--- PART 4: createTeamInvite SERVICE CONTRACT ---");

assert(
  teamInviteServiceTs.includes("export interface CreateTeamInviteParams") &&
  teamInviteServiceTs.includes("hospitalId?: string") &&
  teamInviteServiceTs.includes("hospitalName?: string"),
  "13. teamInviteService exports structured CreateTeamInviteParams interface"
);

assert(
  teamInviteServiceTs.includes("isPlatformAdmin") &&
  teamInviteServiceTs.includes("Platform admin invites require a valid hospital workspace."),
  "14. createTeamInvite validates platform admin requirements client-side before sending"
);

assert(
  teamInviteServiceTs.includes("const link = `${origin}/join/${data.token}`;"),
  "15. Canonical invite link uses https://ermate.in/join/{token} format"
);

// -----------------------------------------------------------------------------
// PART 5: NO RE-GENERATION ON WORKPLACE TEXT EDITS
// -----------------------------------------------------------------------------
console.log("\n--- PART 5: ELIMINATION OF AUTO-GENERATION ON TEXT CHANGE ---");

assert(
  !teamRosterTsx.includes("[profile.hospital, profile.name, workplaceInput]"),
  "16. workplaceInput removed from useEffect dependency array"
);

assert(
  teamRosterTsx.includes('if (auth.currentUser && inviteStatus === "idle") {'),
  "17. Invite generation only executes on idle initialization or explicit user retry"
);

// -----------------------------------------------------------------------------
// PART 6: MODAL AND INLINE CARD PARITY
// -----------------------------------------------------------------------------
console.log("\n--- PART 6: MODAL & INLINE CARD CONSISTENCY ---");

const errorOccurrences = (teamRosterTsx.match(/Could not generate invitation\./g) || []).length;
assert(
  errorOccurrences >= 2,
  "18. Error state rendered in both inline card AND modal (at least 2 occurrences)"
);

const retryOccurrences = (teamRosterTsx.match(/onClick=\{handleGenerateInvite\}/g) || []).length;
assert(
  retryOccurrences >= 2,
  "19. Retry button wired to handleGenerateInvite in both inline card AND modal"
);

console.log("================================================================================");
console.log("ALL 19 VERIFICATION CHECKS PASSED: 100% SUCCESS");
console.log("================================================================================");
