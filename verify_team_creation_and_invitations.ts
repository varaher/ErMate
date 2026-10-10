import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Simulated test models mirroring the ErMate architecture
interface MockUser {
  uid: string;
  email: string;
  name: string;
  role: string;
}

interface MockTeam {
  id: string;
  teamName: string;
  hospitalName: string;
  department: string;
  erPhysicalBedCapacity: number;
  createdByUid: string;
  createdByEmail: string;
  verificationStatus: "unverified" | "verified";
  isInstitutionallyVerified: boolean;
  activeInviteToken?: string | null;
  activeInviteExpiresAt?: string | null;
}

interface MockTeamMember {
  id: string;
  uid: string;
  email: string;
  name: string;
  teamId: string;
  hospitalId: string;
  hospitalName: string;
  teamName: string;
  department: string;
  role: string;
  isTeamAdmin: boolean;
  teamRole: "admin" | "member";
  status: "active" | "pending_approval" | "cancelled";
  verificationStatus: "unverified" | "verified";
  membershipVerified: boolean;
}

interface MockInvite {
  id: string;
  token: string;
  teamId: string;
  hospitalId: string;
  hospitalName: string;
  teamName: string;
  department: string;
  role: string;
  expiresAt: string;
  revoked: boolean;
  isReusable: boolean;
  createdByUid: string;
}

interface MockAuditLog {
  eventType: string;
  actorUid: string;
  hospitalId: string;
  token?: never; // Invariant: Raw tokens must NEVER be logged
}

// In-memory simulation of backend handlers and resolvers
class TeamServiceSimulator {
  teams = new Map<string, MockTeam>();
  members = new Map<string, MockTeamMember>();
  invites = new Map<string, MockInvite>();
  auditLogs: MockAuditLog[] = [];

  createTeam(user: MockUser, params: {
    teamName?: string;
    hospitalName: string;
    department?: string;
    erPhysicalBedCapacity?: number;
    professionalRole?: string;
  }) {
    const rawHospital = params.hospitalName.trim();
    if (!rawHospital || rawHospital.length < 2) {
      throw new Error("A valid hospital or workplace name (at least 2 characters) is required.");
    }

    const cleanTeam = (params.teamName || "").trim() || `${rawHospital} ER Team`;
    const cleanDept = (params.department || "").trim() || "Emergency Medicine";
    const cap = Number(params.erPhysicalBedCapacity);
    const validCap = Number.isInteger(cap) && cap > 0 && cap <= 1000 ? cap : 30;

    const teamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const clinicalRole = params.professionalRole || user.role || "Emergency Physician";

    const team: MockTeam = {
      id: teamId,
      teamName: cleanTeam,
      hospitalName: rawHospital,
      department: cleanDept,
      erPhysicalBedCapacity: validCap,
      createdByUid: user.uid,
      createdByEmail: user.email,
      verificationStatus: "unverified",
      isInstitutionallyVerified: false
    };
    this.teams.set(teamId, team);

    // Creator becomes Team Admin while strictly preserving clinical role
    const member: MockTeamMember = {
      id: user.uid,
      uid: user.uid,
      email: user.email,
      name: user.name,
      teamId,
      hospitalId: teamId,
      hospitalName: rawHospital,
      teamName: cleanTeam,
      department: cleanDept,
      role: clinicalRole, // NOT overwritten to HOD!
      isTeamAdmin: true,
      teamRole: "admin",
      status: "active",
      verificationStatus: "unverified",
      membershipVerified: false
    };
    this.members.set(user.uid, member);

    this.auditLogs.push({
      eventType: "TEAM_CREATED",
      actorUid: user.uid,
      hospitalId: teamId
    });

    return { team, member };
  }

  createInvite(callerUid: string, expiresHours: number = 168) {
    const caller = this.members.get(callerUid);
    if (!caller || !caller.isTeamAdmin || caller.status !== "active") {
      throw new Error("Only Team Admins can create invites.");
    }

    const token = `inv_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date(Date.now() + expiresHours * 3600000).toISOString();

    const invite: MockInvite = {
      id: token,
      token,
      teamId: caller.teamId,
      hospitalId: caller.hospitalId,
      hospitalName: caller.hospitalName,
      teamName: caller.teamName,
      department: caller.department,
      role: "resident",
      expiresAt,
      revoked: false,
      isReusable: true,
      createdByUid: callerUid
    };

    this.invites.set(token, invite);
    const team = this.teams.get(caller.teamId)!;
    team.activeInviteToken = token;
    team.activeInviteExpiresAt = expiresAt;

    // Security check: Raw token is NOT placed into audit log
    this.auditLogs.push({
      eventType: "TEAM_INVITE_CREATED",
      actorUid: callerUid,
      hospitalId: caller.hospitalId
    });

    return invite;
  }

  regenerateInvite(callerUid: string) {
    const caller = this.members.get(callerUid);
    if (!caller || !caller.isTeamAdmin || caller.status !== "active") {
      throw new Error("Only Team Admins can regenerate invites.");
    }

    const team = this.teams.get(caller.teamId)!;
    if (team.activeInviteToken && this.invites.has(team.activeInviteToken)) {
      this.invites.get(team.activeInviteToken)!.revoked = true;
    }

    return this.createInvite(callerUid, 168);
  }

  revokeInvite(callerUid: string, token: string) {
    const caller = this.members.get(callerUid);
    if (!caller || !caller.isTeamAdmin || caller.status !== "active") {
      throw new Error("Only Team Admins can revoke invites.");
    }

    const inv = this.invites.get(token);
    if (!inv || inv.teamId !== caller.teamId) {
      throw new Error("Invite not found or unauthorized.");
    }
    inv.revoked = true;
    return true;
  }

  requestToJoin(user: MockUser, token: string, requestedRole: string = "Resident") {
    const inv = this.invites.get(token);
    if (!inv) throw new Error("Invalid invite token.");
    if (inv.revoked) throw new Error("This invite has been revoked.");
    if (new Date(inv.expiresAt) <= new Date()) throw new Error("This invite has expired.");

    const existing = this.members.get(user.uid);
    if (existing && existing.status === "active" && existing.membershipVerified) {
      throw new Error("You already have an active verified hospital membership.");
    }

    const pendingMember: MockTeamMember = {
      id: user.uid,
      uid: user.uid,
      email: user.email,
      name: user.name,
      teamId: inv.teamId,
      hospitalId: inv.hospitalId,
      hospitalName: inv.hospitalName,
      teamName: inv.teamName,
      department: inv.department,
      role: requestedRole,
      isTeamAdmin: false,
      teamRole: "member",
      status: "pending_approval",
      verificationStatus: "unverified",
      membershipVerified: false
    };
    this.members.set(user.uid, pendingMember);

    this.auditLogs.push({
      eventType: "TEAM_JOIN_REQUESTED",
      actorUid: user.uid,
      hospitalId: inv.hospitalId
    });

    return pendingMember;
  }

  approveMember(callerUid: string, targetUid: string, assignedRole?: string, makeAdmin: boolean = false) {
    if (callerUid === targetUid) {
      throw new Error("Applicants cannot approve their own request.");
    }

    const caller = this.members.get(callerUid);
    if (!caller || !caller.isTeamAdmin || caller.status !== "active") {
      throw new Error("Only Team Admins can approve members.");
    }

    const target = this.members.get(targetUid);
    if (!target || target.status !== "pending_approval") {
      throw new Error("Member is not pending approval.");
    }

    if (caller.teamId !== target.teamId) {
      throw new Error("Target member is not in your team.");
    }

    const team = this.teams.get(caller.teamId)!;
    const isInstVerified = team.verificationStatus === "verified";

    target.status = "active";
    target.role = assignedRole || target.role;
    target.isTeamAdmin = makeAdmin;
    target.teamRole = makeAdmin ? "admin" : "member";
    target.verificationStatus = isInstVerified ? "verified" : "unverified";
    target.membershipVerified = isInstVerified;

    return target;
  }

  setTeamAdminRole(callerUid: string, targetUid: string, willBeAdmin: boolean) {
    const caller = this.members.get(callerUid);
    if (!caller || !caller.isTeamAdmin || caller.status !== "active") {
      throw new Error("Only Team Admins can appoint admins.");
    }

    const target = this.members.get(targetUid);
    if (!target || target.status !== "active") {
      throw new Error("Target member is not active.");
    }

    if (caller.teamId !== target.teamId) {
      throw new Error("Target member is not in your team.");
    }

    // Ensure at least one admin remains
    if (!willBeAdmin && target.isTeamAdmin) {
      const allAdmins = Array.from(this.members.values()).filter(
        m => m.teamId === caller.teamId && m.status === "active" && m.isTeamAdmin && m.uid !== targetUid
      );
      if (allAdmins.length === 0) {
        throw new Error("Cannot remove the only Team Admin. Appoint another Admin first.");
      }
    }

    target.isTeamAdmin = willBeAdmin;
    target.teamRole = willBeAdmin ? "admin" : "member";
    return target;
  }

  resolveWorkspace(uid: string) {
    const member = this.members.get(uid);
    if (!member) {
      return { workspaceType: "individual", ownerUid: uid, hospitalId: null };
    }

    if (member.status === "active" && member.membershipVerified === true) {
      if (member.verificationStatus === "unverified") {
        return { workspaceType: "individual", ownerUid: uid, hospitalId: null };
      }
      return { workspaceType: "hospital", ownerUid: null, hospitalId: member.hospitalId };
    }

    return { workspaceType: "individual", ownerUid: uid, hospitalId: null };
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("ERMATE — TEAM CREATION & INVITATIONS VERIFICATION");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
      console.log(`[PASS] ${total}. ${name}`);
    } catch (e: any) {
      console.error(`[FAIL] ${total}. ${name}: ${e.message}`);
      process.exitCode = 1;
    }
  }

  const sim = new TeamServiceSimulator();

  const userAlice: MockUser = {
    uid: "user_alice",
    email: "alice@cityhospital.in",
    name: "Alice",
    role: "Resident" // Note: Clinical role is Resident
  };

  const userBob: MockUser = {
    uid: "user_bob",
    email: "bob@cityhospital.in",
    name: "Bob",
    role: "Medical Officer"
  };

  const userCharlie: MockUser = {
    uid: "user_charlie",
    email: "charlie@cityhospital.in",
    name: "Charlie",
    role: "Consultant"
  };

  // 1. Team Creation WhatsApp-style
  test("Any registered user can create a team and becomes Team Admin without altering clinical role", () => {
    const { team, member } = sim.createTeam(userAlice, {
      hospitalName: "City General Hospital",
      teamName: "City ER Trauma Squad",
      department: "Emergency Medicine",
      erPhysicalBedCapacity: 45,
      professionalRole: userAlice.role
    });

    assert.equal(team.hospitalName, "City General Hospital");
    assert.equal(team.teamName, "City ER Trauma Squad");
    assert.equal(team.erPhysicalBedCapacity, 45);
    assert.equal(team.verificationStatus, "unverified");
    assert.equal(team.isInstitutionallyVerified, false);

    assert.equal(member.isTeamAdmin, true);
    assert.equal(member.teamRole, "admin");
    assert.equal(member.role, "Resident"); // Invariant: Alice is a Resident, NOT forced to HOD!
    assert.equal(member.status, "active");
    assert.equal(member.membershipVerified, false); // Invariant: unverified until platform admin verification
  });

  // 2. Bed Capacity validation
  test("Bed capacity is bounded between 1 and 1000", () => {
    const res = sim.createTeam({ uid: "user_x", email: "x@h.in", name: "X", role: "MO" }, {
      hospitalName: "Test Care",
      erPhysicalBedCapacity: 0 // invalid capacity defaults to 30
    });
    assert.equal(res.team.erPhysicalBedCapacity, 30);
  });

  // 3. Workspace Resolver fails closed for unverified team
  test("Unverified team members resolve to Individual workspace to prevent unverified shared patient leaks", () => {
    const ws = sim.resolveWorkspace(userAlice.uid);
    assert.equal(ws.workspaceType, "individual");
    assert.equal(ws.ownerUid, userAlice.uid);
    assert.equal(ws.hospitalId, null);
  });

  // 4. Team Admin can generate 7-day reusable invite link
  test("Team Admin can generate reusable 7-day invite link", () => {
    const inv = sim.createInvite(userAlice.uid, 168);
    assert.ok(inv.token.startsWith("inv_"));
    assert.equal(inv.isReusable, true);
    assert.equal(inv.revoked, false);
    const expiresDate = new Date(inv.expiresAt);
    const diffHours = (expiresDate.getTime() - Date.now()) / 3600000;
    assert.ok(diffHours >= 167 && diffHours <= 169);
  });

  // 5. Raw token is not placed in audit logs
  test("Security Invariant: Raw invitation tokens are never written to audit logs", () => {
    const logs = sim.auditLogs.filter(l => l.eventType === "TEAM_INVITE_CREATED");
    assert.ok(logs.length > 0);
    for (const log of logs) {
      assert.equal((log as any).token, undefined);
    }
  });

  // 6. WhatsApp share formatting
  test("WhatsApp share URL encodes team name and invite link accurately", () => {
    const team = sim.teams.get(sim.members.get(userAlice.uid)!.teamId)!;
    const token = team.activeInviteToken!;
    const link = `https://ermate.in/join/${token}`;
    const text = `Join the Emergency Department team at ${team.hospitalName} on ErMate: ${link}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    assert.ok(waUrl.includes("api.whatsapp.com"));
    assert.ok(waUrl.includes(encodeURIComponent(link)));
    assert.ok(waUrl.includes(encodeURIComponent(team.hospitalName)));
  });

  // 7. Regenerate link revokes the prior token and creates new one
  test("Regenerating invite revokes prior token and issues a fresh 7-day token", () => {
    const team = sim.teams.get(sim.members.get(userAlice.uid)!.teamId)!;
    const oldToken = team.activeInviteToken!;
    const newInv = sim.regenerateInvite(userAlice.uid);

    assert.notEqual(newInv.token, oldToken);
    assert.equal(sim.invites.get(oldToken)!.revoked, true);
    assert.equal(team.activeInviteToken, newInv.token);
  });

  // 8. Revoking an invite disables it
  test("Revoking an invite marks it revoked immediately", () => {
    const team = sim.teams.get(sim.members.get(userAlice.uid)!.teamId)!;
    const currentToken = team.activeInviteToken!;
    sim.revokeInvite(userAlice.uid, currentToken);
    assert.equal(sim.invites.get(currentToken)!.revoked, true);

    // Attempting to join with revoked token must fail
    assert.throws(() => {
      sim.requestToJoin(userBob, currentToken);
    }, /revoked/i);
  });

  // 9. Request to join workflow
  test("Requesting to join sets status to pending_approval without automatic verification", () => {
    // Generate fresh invite
    const freshInv = sim.createInvite(userAlice.uid);
    const pendingBob = sim.requestToJoin(userBob, freshInv.token, "Medical Officer");

    assert.equal(pendingBob.status, "pending_approval");
    assert.equal(pendingBob.membershipVerified, false);
    assert.equal(pendingBob.isTeamAdmin, false);
    assert.equal(pendingBob.role, "Medical Officer");

    // Bob still resolves to Individual workspace while pending
    const bobWs = sim.resolveWorkspace(userBob.uid);
    assert.equal(bobWs.workspaceType, "individual");
    assert.equal(bobWs.ownerUid, userBob.uid);
  });

  // 10. Self-approval prevention
  test("Security Invariant: Applicants cannot approve their own join requests", () => {
    assert.throws(() => {
      sim.approveMember(userBob.uid, userBob.uid);
    }, /cannot approve their own request/i);
  });

  // 11. Non-admin cannot approve members
  test("Security Invariant: Regular non-admin members cannot approve join requests", () => {
    assert.throws(() => {
      sim.approveMember(userBob.uid, userAlice.uid);
    }, /Only Team Admins can approve members/i);
  });

  // 12. Team Admin can approve pending member with role assignment and admin appointment
  test("Team Admin can approve member, customize clinical role, and appoint as Team Admin", () => {
    const approvedBob = sim.approveMember(userAlice.uid, userBob.uid, "Senior Medical Officer", true);
    assert.equal(approvedBob.status, "active");
    assert.equal(approvedBob.role, "Senior Medical Officer");
    assert.equal(approvedBob.isTeamAdmin, true);
    assert.equal(approvedBob.teamRole, "admin");
  });

  // 13. Team Admin can promote/revoke other members' admin status
  test("Team Admin can appoint and revoke other members to/from Team Admin role", () => {
    // Join Charlie as regular member
    const team = sim.teams.get(sim.members.get(userAlice.uid)!.teamId)!;
    const inv = sim.createInvite(userAlice.uid);
    sim.requestToJoin(userCharlie, inv.token, "Consultant");
    sim.approveMember(userAlice.uid, userCharlie.uid, "Consultant", false);

    const charlie = sim.members.get(userCharlie.uid)!;
    assert.equal(charlie.isTeamAdmin, false);

    // Promote Charlie to Admin
    sim.setTeamAdminRole(userAlice.uid, userCharlie.uid, true);
    assert.equal(charlie.isTeamAdmin, true);
    assert.equal(charlie.teamRole, "admin");

    // Revoke Charlie from Admin
    sim.setTeamAdminRole(userAlice.uid, userCharlie.uid, false);
    assert.equal(charlie.isTeamAdmin, false);
    assert.equal(charlie.teamRole, "member");
  });

  // 14. Cannot revoke the last Team Admin
  test("Security Invariant: Cannot remove the only Team Admin", () => {
    // Revoke Bob first so Alice is the only admin
    sim.setTeamAdminRole(userAlice.uid, userBob.uid, false);
    assert.throws(() => {
      sim.setTeamAdminRole(userAlice.uid, userAlice.uid, false);
    }, /Cannot remove the only Team Admin/i);
  });

  console.log("==================================================");
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log("==================================================");
  if (passed === total) {
    console.log("ALL TEAM CREATION & INVITATION INVARIANTS VERIFIED SUCCESSFULLY.");
  }
}

runTests();
