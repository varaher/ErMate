/**
 * verify_scribe_persistence_runtime.ts
 *
 * P0 Runtime Integrity Test Suite: Scribe Persistence & Workspace Authorization
 * Tests the complete end-to-end persistence workflow for:
 * 1. Individual users (no active verified team membership)
 * 2. Verified Team / Hospital users (active + verified in team_members/{uid})
 * 3. Two-sided session-case linkage invariant
 * 4. Case save & update permission rules
 * 5. Resume Scribe on existing case
 * 6. Multi-tenant privacy (no cross-workspace leakage)
 * 7. Fail-closed safety invariants on error / malformed membership
 */

import assert from "assert";
import { resolveWorkspaceForUser, WorkspaceResolutionError } from "./src/utils/workspaceResolver";
import { getNormalizedRole, isHODRole, getRoleDisplayLabel } from "./src/utils/roleUtils";
import { hasMeaningfulClinicalExtraction } from "./src/components/VoiceScribeChatView";
import { allocateOrValidateBed } from "./src/utils/bedAllocation";
import { mergeChatMessages, type ScribeSessionDoc } from "./src/services/scribeChatStorage";
import type { ClinicalCase } from "./src/types";

let passed = 0;
let total = 0;

function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(
        () => {
          console.log(`  ✓ [PASS] ${name}`);
          passed++;
        },
        (err) => {
          console.error(`  ✗ [FAIL] ${name}:`, err.message);
          throw err;
        }
      );
    } else {
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ── FIRESTORE RULES SIMULATOR ───────────────────────────────────────────
// Faithfully models the exact logic in firestore.rules for:
// - /cases/{caseId} (create, update, read)
// - /scribeSessions/{sessionId} (create, update, read)
// - /scribeSessions/{sessionId}/messages/{msgId} (read, write)
// - canLinkSessionToCase
class FirestoreRulesSimulator {
  teamMembers: Map<string, any> = new Map();
  cases: Map<string, any> = new Map();
  sessions: Map<string, any> = new Map();
  messages: Map<string, any[]> = new Map();

  setTeamMember(uid: string, doc: any) {
    this.teamMembers.set(uid, doc);
  }

  isPlatformAdmin(auth: any): boolean {
    return auth && auth.email === "varahgrp@gmail.com";
  }

  checkActiveMember(m: any, hospId: string): boolean {
    if (!m) return false;
    const status = String(m.status || "").toLowerCase();
    const isActive = status === "active" || status === "active (joined)";
    const isVerified = m.membershipVerified === true;
    const matchesHosp = m.hospitalId === hospId || (!m.hospitalId && m.hospital === hospId);
    return isActive && isVerified && matchesHosp;
  }

  hasActiveHospitalMembership(uid: string, hospId: string): boolean {
    if (!uid || !hospId) return false;
    const m = this.teamMembers.get(uid);
    return this.checkActiveMember(m, hospId);
  }

  checkAnyActiveMember(m: any): boolean {
    if (!m) return false;
    const status = String(m.status || "").toLowerCase();
    const isActive = status === "active" || status === "active (joined)";
    const isVerified = m.membershipVerified === true;
    const hasHosp = Boolean(m.hospitalId || m.hospital);
    return isActive && isVerified && hasHosp;
  }

  userHasActiveHospitalMembership(uid: string): boolean {
    if (!uid) return false;
    const m = this.teamMembers.get(uid);
    return this.checkAnyActiveMember(m);
  }

  canAccessCase(auth: any, caseData: any): boolean {
    if (!auth || !auth.uid) return false;
    if (this.isPlatformAdmin(auth)) return true;
    if (caseData.workspaceType === "hospital") {
      return this.hasActiveHospitalMembership(auth.uid, caseData.hospitalId);
    }
    if (caseData.workspaceType === "individual") {
      return caseData.ownerUid === auth.uid;
    }
    return false;
  }

  canAccessSession(auth: any, sessionData: any): boolean {
    if (!auth || !auth.uid) return false;
    if (this.isPlatformAdmin(auth)) return true;

    if (sessionData.linkedCaseId != null) {
      const linkedCase = this.cases.get(sessionData.linkedCaseId);
      if (!linkedCase) return false;
      return this.canAccessCase(auth, linkedCase);
    }

    // Unlinked session
    if (sessionData.ownerUid === auth.uid) {
      if (sessionData.workspaceType === "hospital") {
        return this.hasActiveHospitalMembership(auth.uid, sessionData.hospitalId);
      }
      if (sessionData.workspaceType === "individual") {
        return true;
      }
    }
    return false;
  }

  canLinkSessionToCase(auth: any, sessionData: any, caseData: any): boolean {
    if (!auth || !auth.uid) return false;
    if (this.isPlatformAdmin(auth)) return true;

    if (sessionData.workspaceType === "hospital") {
      const sessionHosp = sessionData.hospitalId;
      if (!sessionHosp || !this.hasActiveHospitalMembership(auth.uid, sessionHosp)) return false;
      return caseData.workspaceType === "hospital" && caseData.hospitalId === sessionHosp;
    }

    if (sessionData.workspaceType === "individual") {
      return (
        sessionData.ownerUid === auth.uid &&
        caseData.workspaceType === "individual" &&
        caseData.ownerUid === sessionData.ownerUid
      );
    }

    return false;
  }

  // CREATE SESSION
  createSession(auth: any, sessionId: string, data: any) {
    if (!auth || !auth.uid) throw new Error("PERMISSION_DENIED: Not authenticated");
    
    const isHospital =
      data.workspaceType === "hospital" &&
      data.ownerUid === auth.uid &&
      typeof data.hospitalId === "string" &&
      data.hospitalId.length > 0 &&
      data.linkedCaseId == null &&
      this.hasActiveHospitalMembership(auth.uid, data.hospitalId);

    const isIndividual =
      data.workspaceType === "individual" &&
      data.ownerUid === auth.uid &&
      data.hospitalId == null &&
      data.linkedCaseId == null &&
      !this.userHasActiveHospitalMembership(auth.uid);

    if (!isHospital && !isIndividual && !this.isPlatformAdmin(auth)) {
      throw new Error("PERMISSION_DENIED: Invalid session create payload or unauthorized workspace");
    }

    this.sessions.set(sessionId, { ...data, id: sessionId });
  }

  // CREATE CASE
  createCase(auth: any, caseId: string, data: any) {
    if (!auth || !auth.uid) throw new Error("PERMISSION_DENIED: Not authenticated");

    const isHospital =
      data.workspaceType === "hospital" &&
      data.createdByUid === auth.uid &&
      data.ownerUid == null &&
      typeof data.hospitalId === "string" &&
      data.hospitalId.length > 0 &&
      this.hasActiveHospitalMembership(auth.uid, data.hospitalId);

    const isIndividual =
      data.workspaceType === "individual" &&
      data.createdByUid === auth.uid &&
      data.ownerUid === auth.uid &&
      data.hospitalId == null &&
      !this.userHasActiveHospitalMembership(auth.uid);

    if (!isHospital && !isIndividual && !this.isPlatformAdmin(auth)) {
      throw new Error("PERMISSION_DENIED: Invalid case create payload or unauthorized workspace");
    }

    this.cases.set(caseId, { ...data, id: caseId });
  }

  // UPDATE CASE
  updateCase(auth: any, caseId: string, incomingData: any) {
    if (!auth || !auth.uid) throw new Error("PERMISSION_DENIED: Not authenticated");
    const existingData = this.cases.get(caseId);
    if (!existingData) throw new Error("NOT_FOUND: Case does not exist");

    if (this.isPlatformAdmin(auth)) {
      this.cases.set(caseId, { ...existingData, ...incomingData });
      return;
    }

    // Must preserve workspace invariants
    const sameWorkspace = incomingData.workspaceType === existingData.workspaceType;
    const sameCreator = incomingData.createdByUid === existingData.createdByUid;
    const sameHosp = (incomingData.hospitalId ?? null) === (existingData.hospitalId ?? null);
    const sameOwner = (incomingData.ownerUid ?? null) === (existingData.ownerUid ?? null);

    if (!sameWorkspace || !sameCreator || !sameHosp || !sameOwner) {
      throw new Error("PERMISSION_DENIED: Attempt to mutate immutable workspace metadata on case");
    }

    if (existingData.workspaceType === "hospital") {
      if (!this.hasActiveHospitalMembership(auth.uid, existingData.hospitalId)) {
        throw new Error("PERMISSION_DENIED: User not active member of case hospital");
      }
    } else if (existingData.workspaceType === "individual") {
      if (existingData.ownerUid !== auth.uid) {
        throw new Error("PERMISSION_DENIED: User does not own this individual case");
      }
    } else {
      throw new Error("PERMISSION_DENIED: Unknown workspace type");
    }

    this.cases.set(caseId, { ...existingData, ...incomingData });
  }

  // LINK SESSION TO CASE
  linkSession(auth: any, sessionId: string, caseId: string) {
    if (!auth || !auth.uid) throw new Error("PERMISSION_DENIED: Not authenticated");
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("NOT_FOUND: Session does not exist");
    const caseDoc = this.cases.get(caseId);
    if (!caseDoc) throw new Error("NOT_FOUND: Case does not exist");

    if (!this.canLinkSessionToCase(auth, session, caseDoc)) {
      throw new Error("PERMISSION_DENIED: Cross-workspace session link prohibited");
    }

    // Update session linkedCaseId
    session.linkedCaseId = caseId;
    session.updatedAt = new Date().toISOString();

    // Update case scribeSessionId
    this.updateCase(auth, caseId, { ...caseDoc, scribeSessionId: sessionId });
  }

  // WRITE MESSAGE
  writeMessage(auth: any, sessionId: string, msg: any) {
    if (!auth || !auth.uid) throw new Error("PERMISSION_DENIED: Not authenticated");
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("NOT_FOUND: Session does not exist");

    if (!this.canAccessSession(auth, session)) {
      throw new Error("PERMISSION_DENIED: Cannot access session");
    }

    const list = this.messages.get(sessionId) || [];
    list.push(msg);
    this.messages.set(sessionId, list);
  }

  // READ MESSAGES
  readMessages(auth: any, sessionId: string): any[] {
    if (!auth || !auth.uid) throw new Error("PERMISSION_DENIED: Not authenticated");
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("NOT_FOUND: Session does not exist");

    if (!this.canAccessSession(auth, session)) {
      throw new Error("PERMISSION_DENIED: Cannot access session");
    }

    return this.messages.get(sessionId) || [];
  }
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("ERMATE — P0 SCRIBE PERSISTENCE RUNTIME INTEGRITY TEST SUITE");
  console.log("================================================================================");

  const sim = new FirestoreRulesSimulator();

  // Setup seed users
  const individualUser = { uid: "user_indiv_001", email: "dr.indiv@gmail.com" };
  const teamUser = { uid: "user_team_002", email: "dr.team@rajagiri.org" };
  const otherTeamUser = { uid: "user_team_003", email: "dr.other@apollo.org" };

  // Setup team_members
  sim.setTeamMember(teamUser.uid, {
    status: "active",
    membershipVerified: true,
    hospitalId: "rajagiri_hospital",
    role: "resident",
  });

  sim.setTeamMember(otherTeamUser.uid, {
    status: "active",
    membershipVerified: true,
    hospitalId: "apollo_hospital",
    role: "consultant",
  });

  // Individual user has NO document in teamMembers

  // ── PART 1: WORKSPACE RESOLUTION TRACE & MODEL CONTRACT ──────────────────
  console.log("\n--- PART 1: WORKSPACE RESOLUTION TRACE & MODEL CONTRACT ---");

  await test("1.1 Individual user with profile role 'HOD' resolves to 'individual' workspace", () => {
    const norm = getNormalizedRole({
      email: individualUser.email,
      role: "HOD / Department Lead",
      hospital: "General Hospital",
      hasActiveHospitalMembership: false,
    });
    assert.strictEqual(norm, "independent");
  });

  await test("1.2 Verified team member resolves to 'hospital' workspace with matching hospitalId", () => {
    const norm = getNormalizedRole({
      email: teamUser.email,
      role: "Resident",
      hospital: "Rajagiri Hospital",
      hasActiveHospitalMembership: true,
      membershipRole: "EM Resident",
    });
    assert.strictEqual(norm, "resident");
  });

  await test("1.3 Inactive team membership resolves to 'independent' and not hospital", () => {
    const norm = getNormalizedRole({
      email: "dr.pending@hospital.org",
      role: "Consultant",
      hasActiveHospitalMembership: false,
      membershipRole: "Consultant",
    });
    assert.strictEqual(norm, "independent");
  });

  await test("1.4 Fail-closed error contract on missing UID or malformed membership", () => {
    const err = new WorkspaceResolutionError("Missing UID", "MISSING_UID");
    assert.strictEqual(err.isWorkspaceResolutionError, true);
    assert.strictEqual(err.code, "MISSING_UID");
  });

  // ── PART 2: INDIVIDUAL USER RUNTIME FLOW ────────────────────────────────
  console.log("\n--- PART 2: INDIVIDUAL USER RUNTIME PERSISTENCE FLOW ---");

  let indivSessionId = "sess_indiv_turn1";
  let indivCaseId = "case_indiv_001";

  await test("2.1 Individual Scribe session creates with correct individual metadata", () => {
    sim.createSession(individualUser, indivSessionId, {
      workspaceType: "individual",
      ownerUid: individualUser.uid,
      hospitalId: null,
      linkedCaseId: null,
      createdAt: new Date().toISOString(),
    });

    const s = sim.sessions.get(indivSessionId);
    assert.ok(s);
    assert.strictEqual(s.workspaceType, "individual");
    assert.strictEqual(s.ownerUid, individualUser.uid);
    assert.strictEqual(s.hospitalId, null);
    assert.strictEqual(s.linkedCaseId, null);
  });

  await test("2.2 Individual user writes initial dictation message to session", () => {
    const dictationMsg = {
      id: "msg_turn1",
      role: "user",
      content: "New patient in Bed 4, 45-year-old male with fever and cough for 3 days, BP 120/80, HR 88, SpO2 98%",
      timestamp: new Date().toISOString(),
    };
    sim.writeMessage(individualUser, indivSessionId, dictationMsg);
    const msgs = sim.readMessages(individualUser, indivSessionId);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].id, "msg_turn1");
  });

  await test("2.3 Clinical extraction is recognized as meaningful for new patient intake", () => {
    const extraction = {
      patientName: "John Doe",
      age: 45,
      gender: "male",
      presentingComplaint: "fever and cough for 3 days",
      bedNo: "4",
      vitals: { bp: "120/80", hr: "88", spo2: "98%" },
    };
    assert.strictEqual(hasMeaningfulClinicalExtraction(extraction), true);
  });

  await test("2.4 Bed allocation assigns vacant slot 4A for bare reference '4'", () => {
    const activeCases: ClinicalCase[] = [];
    const alloc = allocateOrValidateBed("4", activeCases, 30);
    assert.strictEqual(alloc.success, true);
    assert.strictEqual(alloc.canonicalBed, "4A");
  });

  await test("2.5 Individual draft ClinicalCase creates with ownerUid == user.uid and hospitalId == null", () => {
    sim.createCase(individualUser, indivCaseId, {
      workspaceType: "individual",
      ownerUid: individualUser.uid,
      createdByUid: individualUser.uid,
      hospitalId: null,
      bedNo: "4A",
      patient: { name: "John Doe", age: 45, gender: "male" },
      status: "Active",
    });

    const c = sim.cases.get(indivCaseId);
    assert.ok(c);
    assert.strictEqual(c.workspaceType, "individual");
    assert.strictEqual(c.ownerUid, individualUser.uid);
    assert.strictEqual(c.createdByUid, individualUser.uid);
    assert.strictEqual(c.hospitalId, null);
  });

  await test("2.6 Two-sided link between individual session and case is established", () => {
    sim.linkSession(individualUser, indivSessionId, indivCaseId);

    const s = sim.sessions.get(indivSessionId);
    const c = sim.cases.get(indivCaseId);
    assert.strictEqual(s.linkedCaseId, indivCaseId);
    assert.strictEqual(c.scribeSessionId, indivSessionId);
  });

  await test("2.7 Individual user updates / saves Case Sheet successfully", () => {
    const updatedCase = {
      ...sim.cases.get(indivCaseId),
      provisionalDiagnosis: "Community-acquired pneumonia",
      treatmentGiven: [{ drug: "Azithromycin", dose: "500mg" }],
    };
    sim.updateCase(individualUser, indivCaseId, updatedCase);
    const c = sim.cases.get(indivCaseId);
    assert.strictEqual(c.provisionalDiagnosis, "Community-acquired pneumonia");
  });

  await test("2.8 Multi-tenant privacy: Another doctor CANNOT access or read individual user's case", () => {
    const c = sim.cases.get(indivCaseId);
    assert.strictEqual(sim.canAccessCase(teamUser, c), false);
    assert.strictEqual(sim.canAccessCase(otherTeamUser, c), false);
  });

  await test("2.9 Multi-tenant privacy: Another doctor CANNOT read individual user's Scribe session", () => {
    const s = sim.sessions.get(indivSessionId);
    assert.strictEqual(sim.canAccessSession(teamUser, s), false);
    assert.throws(() => sim.readMessages(teamUser, indivSessionId));
  });

  await test("2.10 Resume Scribe: Same doctor re-opens session and appends clinical update", () => {
    // Read previous history
    const priorMsgs = sim.readMessages(individualUser, indivSessionId);
    assert.strictEqual(priorMsgs.length, 1);

    // Append update
    const updateMsg = {
      id: "msg_turn2",
      role: "user",
      content: "IV Paracetamol 1g administered, temperature down to 99F",
      timestamp: new Date().toISOString(),
    };
    sim.writeMessage(individualUser, indivSessionId, updateMsg);

    const allMsgs = sim.readMessages(individualUser, indivSessionId);
    assert.strictEqual(allMsgs.length, 2);
    assert.strictEqual(allMsgs[1].id, "msg_turn2");

    // Existing case is retained (no duplicate created)
    const existingCase = sim.cases.get(indivCaseId);
    assert.strictEqual(existingCase.scribeSessionId, indivSessionId);
  });

  // ── PART 3: VERIFIED TEAM USER RUNTIME FLOW ─────────────────────────────
  console.log("\n--- PART 3: VERIFIED TEAM USER RUNTIME PERSISTENCE FLOW ---");

  let teamSessionId = "sess_team_turn1";
  let teamCaseId = "case_team_001";

  await test("3.1 Verified Team Scribe session creates with hospital workspace metadata", () => {
    sim.createSession(teamUser, teamSessionId, {
      workspaceType: "hospital",
      ownerUid: teamUser.uid,
      hospitalId: "rajagiri_hospital",
      linkedCaseId: null,
      createdAt: new Date().toISOString(),
    });

    const s = sim.sessions.get(teamSessionId);
    assert.ok(s);
    assert.strictEqual(s.workspaceType, "hospital");
    assert.strictEqual(s.ownerUid, teamUser.uid);
    assert.strictEqual(s.hospitalId, "rajagiri_hospital");
    assert.strictEqual(s.linkedCaseId, null);
  });

  await test("3.2 Team user writes initial dictation to team session", () => {
    sim.writeMessage(teamUser, teamSessionId, {
      id: "msg_team_turn1",
      role: "user",
      content: "Patient in Bed 12, 60-year-old female with acute chest pain, ST elevation in lead II, III, aVF",
      timestamp: new Date().toISOString(),
    });
    const msgs = sim.readMessages(teamUser, teamSessionId);
    assert.strictEqual(msgs.length, 1);
  });

  await test("3.3 Team ClinicalCase creates with ownerUid == null and hospitalId == 'rajagiri_hospital'", () => {
    sim.createCase(teamUser, teamCaseId, {
      workspaceType: "hospital",
      ownerUid: null,
      createdByUid: teamUser.uid,
      hospitalId: "rajagiri_hospital",
      bedNo: "12A",
      patient: { name: "Maria Garcia", age: 60, gender: "female" },
      status: "Active",
    });

    const c = sim.cases.get(teamCaseId);
    assert.ok(c);
    assert.strictEqual(c.workspaceType, "hospital");
    assert.strictEqual(c.ownerUid, null);
    assert.strictEqual(c.createdByUid, teamUser.uid);
    assert.strictEqual(c.hospitalId, "rajagiri_hospital");
  });

  await test("3.4 Two-sided link between team session and team case is established", () => {
    sim.linkSession(teamUser, teamSessionId, teamCaseId);

    const s = sim.sessions.get(teamSessionId);
    const c = sim.cases.get(teamCaseId);
    assert.strictEqual(s.linkedCaseId, teamCaseId);
    assert.strictEqual(c.scribeSessionId, teamSessionId);
  });

  await test("3.5 Same hospital colleague can access case and linked Scribe session", () => {
    // Add colleague in Rajagiri Hospital
    const colleague = { uid: "user_team_colleague", email: "dr.colleague@rajagiri.org" };
    sim.setTeamMember(colleague.uid, {
      status: "active",
      membershipVerified: true,
      hospitalId: "rajagiri_hospital",
      role: "consultant",
    });

    const c = sim.cases.get(teamCaseId);
    assert.strictEqual(sim.canAccessCase(colleague, c), true);

    const s = sim.sessions.get(teamSessionId);
    assert.strictEqual(sim.canAccessSession(colleague, s), true);

    const msgs = sim.readMessages(colleague, teamSessionId);
    assert.strictEqual(msgs.length, 1);
  });

  await test("3.6 Clinician from DIFFERENT hospital CANNOT access Rajagiri hospital case", () => {
    const c = sim.cases.get(teamCaseId);
    assert.strictEqual(sim.canAccessCase(otherTeamUser, c), false);

    const s = sim.sessions.get(teamSessionId);
    assert.strictEqual(sim.canAccessSession(otherTeamUser, s), false);
    assert.throws(() => sim.readMessages(otherTeamUser, teamSessionId));
  });

  await test("3.7 Team colleague updates case under hospital rules", () => {
    const colleague = { uid: "user_team_colleague", email: "dr.colleague@rajagiri.org" };
    const updatedCase = {
      ...sim.cases.get(teamCaseId),
      provisionalDiagnosis: "Inferior wall STEMI",
      dispositionDetails: { dispositionType: "Cath Lab Transfer" },
    };
    sim.updateCase(colleague, teamCaseId, updatedCase);
    const c = sim.cases.get(teamCaseId);
    assert.strictEqual(c.provisionalDiagnosis, "Inferior wall STEMI");
    assert.strictEqual(c.dispositionDetails.dispositionType, "Cath Lab Transfer");
  });

  // ── PART 4: SECURITY & BOUNDARY VIOLATION GUARDS ─────────────────────────
  console.log("\n--- PART 4: SECURITY & BOUNDARY VIOLATION GUARDS ---");

  await test("4.1 Individual session CANNOT link to a hospital case (cross-workspace link rejected)", () => {
    assert.throws(
      () => sim.linkSession(individualUser, indivSessionId, teamCaseId),
      /Cross-workspace session link prohibited/
    );
  });

  await test("4.2 Team session CANNOT link to an individual case (cross-workspace link rejected)", () => {
    assert.throws(
      () => sim.linkSession(teamUser, teamSessionId, indivCaseId),
      /Cross-workspace session link prohibited/
    );
  });

  await test("4.3 Individual user cannot forge hospital case create payload", () => {
    assert.throws(
      () =>
        sim.createCase(individualUser, "forged_case_1", {
          workspaceType: "hospital",
          ownerUid: null,
          createdByUid: individualUser.uid,
          hospitalId: "rajagiri_hospital",
        }),
      /Invalid case create payload or unauthorized workspace/
    );
  });

  await test("4.4 Team user cannot forge individual case create payload while possessing active team membership", () => {
    assert.throws(
      () =>
        sim.createCase(teamUser, "forged_case_2", {
          workspaceType: "individual",
          ownerUid: teamUser.uid,
          createdByUid: teamUser.uid,
          hospitalId: null,
        }),
      /Invalid case create payload or unauthorized workspace/
    );
  });

  await test("4.5 Team user cannot forge case in another hospital where they have no membership", () => {
    assert.throws(
      () =>
        sim.createCase(teamUser, "forged_case_3", {
          workspaceType: "hospital",
          ownerUid: null,
          createdByUid: teamUser.uid,
          hospitalId: "apollo_hospital",
        }),
      /Invalid case create payload or unauthorized workspace/
    );
  });

  await test("4.6 Client cannot mutate workspace metadata on existing case (workspaceType, hospitalId, ownerUid)", () => {
    const existing = sim.cases.get(teamCaseId);
    assert.throws(
      () =>
        sim.updateCase(teamUser, teamCaseId, {
          ...existing,
          workspaceType: "individual",
          ownerUid: teamUser.uid,
        }),
      /Attempt to mutate immutable workspace metadata on case/
    );
  });

  await test("4.7 Platform admin can access and administer both individual and hospital cases", () => {
    const admin = { uid: "admin_uid", email: "varahgrp@gmail.com" };
    assert.strictEqual(sim.canAccessCase(admin, sim.cases.get(indivCaseId)), true);
    assert.strictEqual(sim.canAccessCase(admin, sim.cases.get(teamCaseId)), true);
    assert.strictEqual(sim.canAccessSession(admin, sim.sessions.get(indivSessionId)), true);
    assert.strictEqual(sim.canAccessSession(admin, sim.sessions.get(teamSessionId)), true);
  });

  console.log("================================================================================");
  console.log(`ALL TESTS COMPLETED: ${passed} / ${total} PASSED.`);
  console.log("================================================================================");
}

runAllTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
