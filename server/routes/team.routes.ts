import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { adminAuth, db, PROJECT_ID, FIRESTORE_DATABASE_ID } from "../../src/lib/firebase-admin.ts";
import { requireAuth, AuthRequest } from "../../src/middleware/auth.ts";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

async function getDocWithRestFallback(collectionPath: string, docId: string, authHeader?: string): Promise<{ exists: boolean; data?: any }> {
  try {
    const snap = await db.collection(collectionPath).doc(docId).get();
    return { exists: snap.exists, data: snap.data() };
  } catch (err: any) {
    if (authHeader) {
      try {
        const restUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/${collectionPath}/${encodeURIComponent(docId)}`;
        const res = await fetch(restUrl, { headers: { Authorization: authHeader } });
        if (res.status === 404) return { exists: false };
        if (res.ok) {
          const docJson: any = await res.json();
          const data: Record<string, any> = {};
          if (docJson.fields) {
            for (const [key, valObj] of Object.entries<any>(docJson.fields)) {
              if (valObj.stringValue !== undefined) data[key] = valObj.stringValue;
              else if (valObj.booleanValue !== undefined) data[key] = valObj.booleanValue;
              else if (valObj.integerValue !== undefined) data[key] = Number(valObj.integerValue);
              else if (valObj.doubleValue !== undefined) data[key] = Number(valObj.doubleValue);
              else if (valObj.nullValue !== undefined) data[key] = null;
              else data[key] = valObj;
            }
          }
          return { exists: true, data };
        }
      } catch (restErr: any) {
        console.warn(`REST fallback read failed for ${collectionPath}/${docId}:`, restErr.message);
      }
    }
    throw err;
  }
}

const router = Router();

const PLATFORM_ADMIN_EMAIL = "varahgrp@gmail.com";

const EXACT_ADMIN_ROLES = new Set([
  "hod",
  "hod / department lead",
  "hod / shift lead"
]);

const INVITE_ALLOWED_ROLES = new Set([
  "resident",
  "consultant",
  "senior consultant",
  "em resident",
  "em intern",
  "em_physician",
  "emergency physician",
  "nurse",
  "doctor",
  "fellow",
  "medical_officer",
  "medical officer",
  "scribe specialist",
  "hod",
  "hod / department lead",
  "hod / shift lead",
  "emt",
  "other"
]);

function isExactHospitalAdminRole(role?: string): boolean {
  if (!role) return false;
  return EXACT_ADMIN_ROLES.has(role.trim().toLowerCase());
}

function isVerifiedHod(member: any): boolean {
  if (!member) return false;
  return (
    member.status === "active" &&
    member.membershipVerified === true &&
    isExactHospitalAdminRole(member.role) &&
    !!member.hospitalId
  );
}

function isTeamAdmin(member: any): boolean {
  if (!member) return false;
  const status = String(member.status || "").trim().toLowerCase();
  if (status !== "active" && status !== "active (joined)") return false;
  if (member.isTeamAdmin === true || member.teamRole === "admin" || member.isAdmin === true) {
    return true;
  }
  // Backward compatibility: existing active verified HODs are also team admins
  if (member.membershipVerified === true && isExactHospitalAdminRole(member.role)) {
    return true;
  }
  return false;
}

function isPlatformAdminReq(req: AuthRequest): boolean {
  const email = (req.user?.email || "").trim().toLowerCase();
  return email === PLATFORM_ADMIN_EMAIL;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── GET /invite-preview/:token ───────────────────────────────────────────────
router.get("/invite-preview/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: "Token is required." });

    const cleanToken = String(token).trim();
    const tokenHash = hashInviteToken(cleanToken);
    let inviteDoc = await db.collection("teamInvites").doc(tokenHash).get();
    if (!inviteDoc.exists) {
      inviteDoc = await db.collection("teamInvites").doc(cleanToken).get();
    }
    if (!inviteDoc.exists) {
      return res.status(404).json({ error: "Invite not found or expired." });
    }

    const data = inviteDoc.data()!;
    if (data.revoked) {
      return res.status(400).json({ error: "Invite has been revoked." });
    }
    if (data.expiresAt && new Date(data.expiresAt) <= new Date()) {
      return res.status(400).json({ error: "Invite has expired." });
    }
    if (typeof data.maxUses === "number" && (data.usedCount || 0) >= data.maxUses) {
      return res.status(400).json({ error: "Invite usage limit exceeded." });
    }

    return res.json({
      valid: true,
      teamId: data.teamId || data.hospitalId || "",
      teamName: data.teamName || data.hospitalName || "",
      hospitalName: data.hospitalName || "",
      department: data.department || "Emergency Medicine",
      role: data.role || "resident",
      expiresAt: data.expiresAt
    });
  } catch (error: any) {
    console.error("Error previewing invite:", error);
    return res.status(400).json({ error: error.message || "Failed to load invite preview." });
  }
});

// All subsequent routes require authentication
router.use(requireAuth);

router.post("/create-invite", async (req: AuthRequest, res) => {
  try {
    const { invitedEmail, role, maxUses, expiresHours, hospitalId, hospitalName } = req.body || {};
    const uid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);

    let callerHospitalId = "";
    let callerHospitalName = "";
    let callerTeamName = "";
    let callerDepartment = "Emergency Medicine";

    if (!isAdmin) {
      const callerSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only Team Admins can create invites." });
      }
      const caller = callerSnap.data!;
      if (!isTeamAdmin(caller)) {
        return res.status(403).json({ error: "Only Team Admins can create invites." });
      }
      callerHospitalId = caller.hospitalId;
      callerHospitalName = caller.hospitalName || caller.hospital || "";
      callerTeamName = caller.teamName || callerHospitalName;
      callerDepartment = caller.department || "Emergency Medicine";
    } else {
      const requestedHospitalId = String(hospitalId || "").trim();
      const requestedHospitalName = String(hospitalName || "").trim();

      if (!requestedHospitalId || !requestedHospitalName) {
        return res.status(400).json({
          error: "Platform admin invites require both hospitalId and hospitalName."
        });
      }

      callerHospitalId = requestedHospitalId;
      callerHospitalName = requestedHospitalName;
      callerTeamName = requestedHospitalName;
    }

    let targetRole = "resident";
    if (role) {
      const normRole = String(role).trim().toLowerCase();
      if (!INVITE_ALLOWED_ROLES.has(normRole)) {
        return res.status(400).json({
          error: `Role "${role}" is not permitted for invitation.`
        });
      }
      targetRole = normRole;
    }

    const token = `inv_${randomBytes(16).toString("hex")}`;
    const tokenHash = hashInviteToken(token);
    // Requirement A.5 & G.4: Invitation link valid for exactly six hours (6 hours)
    const hours = 6;
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
    const uses = typeof maxUses === "number" && maxUses > 0 ? maxUses : null;

    // Requirement G.2: Replace plaintext token persistence with securely hashed token storage
    const inviteDoc: any = {
      id: tokenHash,
      tokenHash,
      teamId: callerHospitalId,
      hospitalId: callerHospitalId,
      hospitalName: callerHospitalName,
      teamName: callerTeamName,
      department: callerDepartment,
      role: targetRole,
      invitedEmail: invitedEmail ? String(invitedEmail).trim().toLowerCase() : null,
      maxUses: uses,
      usedCount: 0,
      revoked: false,
      isReusable: true,
      expiresAt,
      createdAt: nowIso(),
      createdByUid: uid,
      createdByPlatformAdmin: isAdmin
    };

    try {
      const inviteRef = db.collection("teamInvites").doc(tokenHash);
      const auditRef = db.collection("teamAuditLog").doc();
      const teamRef = db.collection("teams").doc(callerHospitalId);

      const batch = db.batch();
      batch.set(inviteRef, inviteDoc);
      batch.set(teamRef, {
        activeInviteTokenHash: tokenHash,
        activeInviteExpiresAt: expiresAt,
        updatedAt: nowIso()
      }, { merge: true });

      // Security requirement: Never place raw invitation tokens in audit logs!
      batch.set(auditRef, {
        id: auditRef.id,
        eventType: "TEAM_INVITE_CREATED",
        actorUid: uid,
        actorEmail: (req.user?.email || "").trim().toLowerCase(),
        actorType: isAdmin ? "platform_admin" : "team_admin",
        hospitalId: callerHospitalId,
        hospitalName: callerHospitalName,
        targetEmail: invitedEmail ? String(invitedEmail).trim().toLowerCase() : null,
        targetRole: targetRole,
        expiresAt: expiresAt,
        createdAt: nowIso()
      });
      await batch.commit();
    } catch (batchError: any) {
      console.warn("Batch commit fallback:", batchError.message);
      // Fallback: write doc directly
      await db.collection("teamInvites").doc(tokenHash).set(inviteDoc);
    }

    return res.json({
      success: true,
      token,
      expiresAt,
      role: targetRole,
      hospitalName: callerHospitalName,
      teamName: callerTeamName
    });
  } catch (error: any) {
    console.error("Error creating invite:", error);
    return res.status(400).json({ error: error.message || "Failed to create invite." });
  }
});

// ── POST /revoke-invite ─────────────────────────────────────────────────────
router.post("/revoke-invite", async (req: AuthRequest, res) => {
  try {
    const { token } = req.body || {};
    const uid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);

    if (!token) {
      return res.status(400).json({ error: "Token is required." });
    }

    const rawToken = String(token).trim();
    const tokenHash = hashInviteToken(rawToken);
    let inviteRef = db.collection("teamInvites").doc(tokenHash);
    let inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      inviteRef = db.collection("teamInvites").doc(rawToken);
      inviteSnap = await inviteRef.get();
    }
    if (!inviteSnap.exists) {
      return res.status(404).json({ error: "Invitation not found." });
    }

    const invite = inviteSnap.data()!;
    if (!isAdmin) {
      const callerSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only Team Admins can revoke invites." });
      }
      const caller = callerSnap.data!;
      const callerTeamId = caller.teamId || caller.hospitalId;
      if (!isTeamAdmin(caller) || callerTeamId !== invite.hospitalId) {
        return res.status(403).json({ error: "You are not authorized to revoke invites for this team." });
      }
    }

    await inviteRef.update({
      revoked: true,
      revokedAt: nowIso(),
      revokedByUid: uid
    });

    if (invite.hospitalId) {
      const teamRef = db.collection("teams").doc(invite.hospitalId);
      await teamRef.set({
        activeInviteToken: null,
        activeInviteTokenHash: null,
        activeInviteExpiresAt: null,
        updatedAt: nowIso()
      }, { merge: true }).catch(() => {});
    }

    const auditRef = db.collection("teamAuditLog").doc();
    await auditRef.set({
      id: auditRef.id,
      eventType: "TEAM_INVITE_REVOKED",
      actorUid: uid,
      actorEmail: (req.user?.email || "").trim().toLowerCase(),
      hospitalId: invite.hospitalId,
      createdAt: nowIso()
    }).catch(() => {});

    return res.json({ success: true, message: "Invitation link revoked successfully." });
  } catch (error: any) {
    console.error("Error revoking invite:", error);
    return res.status(400).json({ error: error.message || "Failed to revoke invitation." });
  }
});

// ── POST /regenerate-invite ─────────────────────────────────────────────────
router.post("/regenerate-invite", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);
    const { hospitalId, role } = req.body || {};

    let callerHospitalId = "";
    let callerHospitalName = "";
    let callerTeamName = "";
    let callerDepartment = "Emergency Medicine";

    if (!isAdmin) {
      const callerSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only Team Admins can regenerate invites." });
      }
      const caller = callerSnap.data!;
      if (!isTeamAdmin(caller)) {
        return res.status(403).json({ error: "Only Team Admins can regenerate invites." });
      }
      callerHospitalId = caller.teamId || caller.hospitalId;
      callerHospitalName = caller.hospitalName || caller.hospital || "";
      callerTeamName = caller.teamName || callerHospitalName;
      callerDepartment = caller.department || "Emergency Medicine";
    } else {
      callerHospitalId = String(hospitalId || "").trim();
      if (!callerHospitalId) {
        return res.status(400).json({ error: "hospitalId is required." });
      }
      const teamSnap = await db.collection("teams").doc(callerHospitalId).get();
      if (teamSnap.exists) {
        const tData = teamSnap.data()!;
        callerHospitalName = tData.hospitalName || callerHospitalId;
        callerTeamName = tData.teamName || callerHospitalName;
        callerDepartment = tData.department || "Emergency Medicine";
      } else {
        callerHospitalName = callerHospitalId;
        callerTeamName = callerHospitalId;
      }
    }

    if (!callerHospitalId) {
      return res.status(400).json({ error: "Could not resolve team ID for invitation regeneration." });
    }

    // 1. Revoke existing active invite for this team
    const teamRef = db.collection("teams").doc(callerHospitalId);
    const teamSnap = await teamRef.get();
    if (teamSnap.exists) {
      const oldHash = teamSnap.data()?.activeInviteTokenHash;
      const oldToken = teamSnap.data()?.activeInviteToken;
      if (oldHash) {
        await db.collection("teamInvites").doc(oldHash).update({
          revoked: true,
          revokedAt: nowIso(),
          revokedByUid: uid
        }).catch(() => {});
      }
      if (oldToken) {
        await db.collection("teamInvites").doc(oldToken).update({
          revoked: true,
          revokedAt: nowIso(),
          revokedByUid: uid
        }).catch(() => {});
      }
    }

    // 2. Generate new secure 6-hour token (Requirement A.5 & G.4)
    const token = `inv_${randomBytes(16).toString("hex")}`;
    const tokenHash = hashInviteToken(token);
    const hours = 6;
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
    const now = nowIso();

    // Requirement G.2: Replace plaintext token persistence with securely hashed token storage
    const inviteDoc: any = {
      id: tokenHash,
      tokenHash,
      teamId: callerHospitalId,
      hospitalId: callerHospitalId,
      hospitalName: callerHospitalName,
      teamName: callerTeamName,
      department: callerDepartment,
      role: role || "resident",
      maxUses: null,
      usedCount: 0,
      revoked: false,
      isReusable: true,
      expiresAt,
      createdAt: now,
      createdByUid: uid,
      createdByPlatformAdmin: isAdmin
    };

    const inviteRef = db.collection("teamInvites").doc(tokenHash);
    const auditRef = db.collection("teamAuditLog").doc();

    const batch = db.batch();
    batch.set(inviteRef, inviteDoc);
    batch.set(teamRef, {
      activeInviteTokenHash: tokenHash,
      activeInviteExpiresAt: expiresAt,
      updatedAt: now
    }, { merge: true });

    // Security: Never place raw token in audit log
    batch.set(auditRef, {
      id: auditRef.id,
      eventType: "TEAM_INVITE_REGENERATED",
      actorUid: uid,
      actorEmail: (req.user?.email || "").trim().toLowerCase(),
      actorType: isAdmin ? "platform_admin" : "team_admin",
      hospitalId: callerHospitalId,
      expiresAt,
      createdAt: now
    });

    await batch.commit();

    return res.json({
      success: true,
      token,
      expiresAt,
      hospitalName: callerHospitalName,
      teamName: callerTeamName,
      message: "New invitation link generated successfully."
    });
  } catch (error: any) {
    console.error("Error regenerating invite:", error);
    return res.status(400).json({ error: error.message || "Failed to regenerate invitation." });
  }
});

// ── POST /accept-invite ─────────────────────────────────────────────────────
router.post("/accept-invite", async (req: AuthRequest, res) => {
  try {
    const { token } = req.body || {};
    const uid = req.user!.uid;
    const userEmail = (req.user!.email || "").trim().toLowerCase();

    if (!token) return res.status(400).json({ error: "Invite token is required." });

    const rawToken = String(token).trim();
    const tokenHash = hashInviteToken(rawToken);
    let inviteRef = db.collection("teamInvites").doc(tokenHash);
    let inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      inviteRef = db.collection("teamInvites").doc(rawToken);
      inviteSnap = await inviteRef.get();
    }

    if (!inviteSnap.exists) {
      return res.status(400).json({ error: "Invalid invite token." });
    }

    const invite = inviteSnap.data()!;

    if (invite.revoked) {
      return res.status(400).json({ error: "This invite has been revoked." });
    }
    if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) {
      return res.status(400).json({ error: "This invite has expired." });
    }
    if (typeof invite.maxUses === "number" && (invite.usedCount || 0) >= invite.maxUses) {
      return res.status(400).json({ error: "This invite has exceeded its maximum allowed uses." });
    }

   if (invite.invitedEmail) {
  const targetEmail =
    String(invite.invitedEmail)
      .trim()
      .toLowerCase();

  /*
   * Email-restricted hospital invitations require
   * proof that the authenticated Firebase email
   * has actually been verified.
   *
   * This does NOT block normal ErMate login for
   * legacy/unverified independent users.
   */
  if (req.user!.email_verified !== true) {
    return res.status(403).json({
      error:
        "Please verify your email address before accepting this department invitation."
    });
  }

  if (targetEmail !== userEmail) {
    return res.status(400).json({
      error:
        "This invite is restricted to a different email address."
    });
  }
}

    // Provenance verification
    if (invite.createdByPlatformAdmin === true) {
      if (!invite.createdByUid) {
        return res.status(400).json({ error: "Platform admin invite missing creator UID." });
      }
      try {
        const creatorAuth = await adminAuth.getUser(invite.createdByUid);
        const creatorEmail = (creatorAuth.email || "").trim().toLowerCase();
        if (creatorAuth.uid !== invite.createdByUid || creatorEmail !== PLATFORM_ADMIN_EMAIL) {
          return res.status(400).json({ error: "Invite creator is not the configured platform admin." });
        }
      } catch (authErr: any) {
        return res.status(400).json({ error: "Invite creator is not the configured platform admin." });
      }
    } else {
      if (!invite.createdByUid) {
        return res.status(400).json({ error: "Invite creator UID is missing." });
      }
      const creatorSnap = await db.collection("team_members").doc(invite.createdByUid).get();
      if (!creatorSnap.exists) {
        return res.status(400).json({ error: "Invite creator membership not found." });
      }
      const creator = creatorSnap.data()!;
      const creatorStatus = String(creator.status || "").trim().toLowerCase();
      if (creatorStatus !== "active" && creatorStatus !== "active (joined)") {
        return res.status(400).json({ error: "Invite creator is not active." });
      }
      if (!isTeamAdmin(creator)) {
        return res.status(400).json({ error: "Invite creator does not have Team Admin role." });
      }
      const creatorTeamId = creator.teamId || creator.hospitalId;
      if (!creatorTeamId || creatorTeamId !== invite.hospitalId) {
        return res.status(400).json({ error: "Invite creator does not belong to the invited team." });
      }
    }

    await db.runTransaction(async (tx) => {
      const invTx = await tx.get(inviteRef);
      if (!invTx.exists) throw new Error("Invite does not exist.");
      const currentInv = invTx.data()!;
      if (currentInv.revoked) throw new Error("Invite was revoked.");
      if (currentInv.expiresAt && new Date(currentInv.expiresAt) <= new Date()) throw new Error("Invite expired.");
      if (typeof currentInv.maxUses === "number" && (currentInv.usedCount || 0) >= currentInv.maxUses) {
        throw new Error("Invite usage limit reached.");
      }

      if (currentInv.invitedEmail) {
        const currentTargetEmail = String(currentInv.invitedEmail).trim().toLowerCase();
        if (req.user!.email_verified !== true) {
          throw new Error("Please verify your email address before accepting this department invitation.");
        }
        if (currentTargetEmail !== userEmail) {
          throw new Error("This invite is restricted to a different email address.");
        }
      }

      const normalizedInviteRole = String(currentInv.role || "resident").trim().toLowerCase();

      const memberRef = db.collection("team_members").doc(uid);
      const existingMemberSnap = await tx.get(memberRef);

      if (existingMemberSnap.exists) {
        const existingMember = existingMemberSnap.data()!;
        if (existingMember.status === "active" && existingMember.membershipVerified === true) {
          throw new Error("You already have an active hospital membership. Leave your current team before requesting to join another team.");
        }
        if (existingMember.status === "pending_approval") {
          return;
        }

        const historyRef = memberRef.collection("history").doc();
        tx.set(historyRef, {
          ...existingMember,
          archivedAt: nowIso(),
          archivedReason: "replaced_by_invite"
        });
      }

      tx.update(inviteRef, {
        usedCount: (currentInv.usedCount || 0) + 1,
        lastUsedAt: nowIso(),
        updatedAt: nowIso()
      });

      // Opening/accepting link sets status to pending_approval. Admin approval required!
      tx.set(memberRef, {
        id: uid,
        uid: uid,
        email: userEmail,
        name: req.user!.name || userEmail.split("@")[0],
        teamId: currentInv.teamId || currentInv.hospitalId,
        hospitalId: currentInv.hospitalId,
        hospitalName: currentInv.hospitalName || "",
        hospital: currentInv.hospitalName || "",
        teamName: currentInv.teamName || currentInv.hospitalName || "",
        department: currentInv.department || "Emergency Medicine",
        role: normalizedInviteRole,
        isTeamAdmin: false,
        teamRole: "member",
        status: "pending_approval",
        requestProvenance: "authenticated_join_request",
        membershipVerified: false,
        requestedAt: nowIso(),
        updatedAt: nowIso(),
        inviteToken: token,
        invitedByUid: currentInv.createdByUid || null
      });

      // Never elevate subscription automatically upon accepting invitation
      const acceptanceAuditRef = db.collection("teamAuditLog").doc();
      tx.set(acceptanceAuditRef, {
        id: acceptanceAuditRef.id,
        eventType: "TEAM_JOIN_REQUESTED",
        actorUid: uid,
        actorEmail: userEmail,
        actorType: "applicant",
        hospitalId: currentInv.hospitalId,
        hospitalName: currentInv.hospitalName || "",
        targetUid: uid,
        targetEmail: userEmail,
        targetRole: normalizedInviteRole,
        invitedByUid: currentInv.createdByUid || null,
        membershipVerified: false,
        createdAt: nowIso()
      });
    });

    return res.json({
      success: true,
      message: "Join request submitted. Waiting for Admin approval.",
      status: "pending_approval"
    });
  } catch (error: any) {
    console.error("Error accepting invite:", error);
    return res.status(400).json({ error: error.message || "Failed to submit join request." });
  }
});

// ── POST /request-join ───────────────────────────────────────────────────────
router.post("/request-join", async (req: AuthRequest, res) => {
  try {
    const { hospitalId, hospitalName, role, token } = req.body || {};
    const uid = req.user!.uid;
    const email = (req.user!.email || "").trim().toLowerCase();

    let requestedHospitalId = String(hospitalId || "").trim();
    let requestedHospitalName = String(hospitalName || "").trim();
    let requestedTeamName = requestedHospitalName;
    let requestedDepartment = "Emergency Medicine";

    if (token) {
      const cleanToken = String(token).trim();
      const tokenHash = hashInviteToken(cleanToken);
      let inviteSnap = await db.collection("teamInvites").doc(tokenHash).get();
      if (!inviteSnap.exists) {
        inviteSnap = await db.collection("teamInvites").doc(cleanToken).get();
      }
      if (!inviteSnap.exists) {
        return res.status(400).json({ error: "Invalid or expired invitation token." });
      }
      const invite = inviteSnap.data()!;
      if (invite.revoked) return res.status(400).json({ error: "Invitation was revoked." });
      if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) {
        return res.status(400).json({ error: "Invitation has expired." });
      }
      requestedHospitalId = invite.hospitalId;
      requestedHospitalName = invite.hospitalName || "";
      requestedTeamName = invite.teamName || invite.hospitalName || "";
      requestedDepartment = invite.department || "Emergency Medicine";
    }

    if (!requestedHospitalId) {
      return res.status(400).json({
        error: "Hospital ID or invitation token is required."
      });
    }

    const memberRef = db.collection("team_members").doc(uid);

    let safeRole = "resident";
    if (role) {
      const normRole = String(role).trim().toLowerCase();
      if (INVITE_ALLOWED_ROLES.has(normRole)) {
        safeRole = normRole;
      }
    }

    await db.runTransaction(async (tx) => {
      const currentSnap = await tx.get(memberRef);

      if (currentSnap.exists) {
        const current = currentSnap.data()!;

        if (
          current.status === "active" &&
          current.membershipVerified === true
        ) {
          throw new Error(
            "You already have an active verified hospital membership. Leave your current team first."
          );
        }

        if (current.status === "pending_approval") {
          return;
        }

        const historyRef = memberRef.collection("history").doc();
        tx.set(historyRef, {
          ...current,
          archivedAt: nowIso(),
          archivedReason: "replaced_by_join_request"
        });
      }

      tx.set(memberRef, {
        id: uid,
        uid: uid,
        email,
        name: req.user!.name || email.split("@")[0],
        teamId: requestedHospitalId,
        hospitalId: requestedHospitalId,
        hospitalName: requestedHospitalName,
        hospital: requestedHospitalName,
        teamName: requestedTeamName,
        department: requestedDepartment,
        role: safeRole,
        isTeamAdmin: false,
        teamRole: "member",
        status: "pending_approval",
        requestProvenance: "authenticated_join_request",
        membershipVerified: false,
        requestedAt: nowIso(),
        updatedAt: nowIso()
      });
  /*
 * Security audit:
 * Record the authenticated clinician's department
 * join request in the SAME transaction.
 */
const joinAuditRef =
  db.collection("teamAuditLog").doc();

tx.set(
  joinAuditRef,
  {
    id: joinAuditRef.id,

    eventType:
      "TEAM_JOIN_REQUESTED",

    actorUid:
      uid,

    actorEmail:
      email,

    actorType:
      "applicant",

    hospitalId:
      requestedHospitalId,

    hospitalName:
      requestedHospitalName,

    targetUid:
      uid,

    targetEmail:
      email,

    targetRole:
      safeRole,

    requestProvenance:
      "authenticated_join_request",

    membershipVerified:
      false,

    previousMembershipArchived:
      currentSnap.exists,

    createdAt:
      nowIso()
  }
);
});
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error requesting to join:", error);
    return res.status(400).json({ error: error.message || "Failed to submit join request." });
  }
});
// ── POST /cancel-request ────────────────────────────────────────────────────
router.post("/cancel-request", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const memberRef = db.collection("team_members").doc(uid);

    await db.runTransaction(async (tx) => {
      const memberSnap = await tx.get(memberRef);

      if (!memberSnap.exists) {
        throw new Error("No pending join request found.");
      }

      const member = memberSnap.data()!;

      if (
        member.status !== "pending_approval" ||
        member.requestProvenance !== "authenticated_join_request" ||
        member.membershipVerified === true
      ) {
        throw new Error(
          "No pending join request is available to cancel."
        );
      }

      if (
        member.uid !== uid ||
        memberSnap.id !== uid
      ) {
        throw new Error(
          "Membership identity does not match the authenticated user."
        );
      }

      tx.update(memberRef, {
        status: "cancelled",
        cancelledAt: nowIso(),
        cancelledByUid: uid,
        updatedAt: nowIso()
      });
      /*
 * Security audit:
 * Record cancellation of the clinician's pending
 * department join request in the SAME transaction.
 */
const cancelAuditRef =
  db.collection("teamAuditLog").doc();

tx.set(
  cancelAuditRef,
  {
    id: cancelAuditRef.id,

    eventType:
      "TEAM_JOIN_REQUEST_CANCELLED",

    actorUid:
      uid,

    actorEmail:
      (req.user?.email || member.email || "")
        .trim()
        .toLowerCase(),

    actorType:
      "applicant",

    hospitalId:
      member.hospitalId || "",

    hospitalName:
      member.hospitalName ||
      member.hospital ||
      "",

    targetUid:
      uid,

    targetEmail:
      (member.email || req.user?.email || "")
        .trim()
        .toLowerCase(),

    targetRole:
      member.role || "",

    previousStatus:
      "pending_approval",

    newStatus:
      "cancelled",

    requestProvenance:
      member.requestProvenance ||
      "authenticated_join_request",

    membershipVerified:
      false,

    createdAt:
      nowIso()
  }
);
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error cancelling join request:", error);

    return res.status(400).json({
      error:
        error.message ||
        "Failed to cancel join request."
    });
  }
});
// ── POST /approve-member ────────────────────────────────────────────────────
router.post("/approve-member", async (req: AuthRequest, res) => {
  try {
    const {
      memberId,
      hospitalId,
      hospitalName
    } = req.body || {};

    const callerUid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);

    if (!memberId) {
      return res.status(400).json({
        error: "memberId is required."
      });
    }

    if (callerUid === String(memberId)) {
      return res.status(400).json({
        error: "Applicants cannot approve their own request."
      });
    }

    // Platform admin must explicitly choose the hospital.
    // Never trust the applicant's requested hospital as platform authority.
    const requestedHospitalId =
      isAdmin ? String(hospitalId || "").trim() : "";

    const requestedHospitalName =
      isAdmin ? String(hospitalName || "").trim() : "";

    if (
      isAdmin &&
      (!requestedHospitalId || !requestedHospitalName)
    ) {
      return res.status(400).json({
        error:
          "Platform admin approval requires both hospitalId and hospitalName."
      });
    }

    const targetRef =
      db.collection("team_members").doc(String(memberId));

    // Initial validation before Firebase Auth lookup.
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return res.status(404).json({
        error: "Member not found."
      });
    }

    const target = targetSnap.data()!;

    if (target.status !== "pending_approval") {
      return res.status(400).json({
        error: "Member is not pending approval."
      });
    }

    if (
      target.requestProvenance !==
      "authenticated_join_request"
    ) {
      return res.status(400).json({
        error: "Invalid request provenance."
      });
    }

    if (target.membershipVerified === true) {
      return res.status(400).json({
        error: "Member is already verified."
      });
    }

    if (
      String(memberId) !== target.uid ||
      targetRef.id !== target.uid
    ) {
      return res.status(400).json({
        error:
          "Target document ID does not match target.uid."
      });
    }

    // Verify applicant identity against Firebase Auth.
    let authUser: any;

    try {
      authUser = await adminAuth.getUser(target.uid);
    } catch (e: any) {
      return res.status(400).json({
        error:
          `Applicant does not exist in Firebase Auth: ${e.message}`
      });
    }

    if (
      !authUser ||
      authUser.uid !== target.uid
    ) {
      return res.status(400).json({
        error:
          "Target UID does not match Firebase Auth UID."
      });
    }

    const authEmail =
      (authUser.email || "")
        .trim()
        .toLowerCase();

    const targetEmail =
      (target.email || "")
        .trim()
        .toLowerCase();

    if (
      !authEmail ||
      authEmail !== targetEmail
    ) {
      return res.status(400).json({
        error:
          "Target email does not match Firebase Auth email."
      });
    }

    /*
     * Final authorization and activation happen transactionally.
     *
     * This prevents a join request, caller role, hospital,
     * membership state, or verification state from changing
     * between the earlier checks and activation.
     */
    await db.runTransaction(async (tx) => {
      const latestTargetSnap =
        await tx.get(targetRef);

      if (!latestTargetSnap.exists) {
        throw new Error(
          "Member request no longer exists."
        );
      }

      const latestTarget =
        latestTargetSnap.data()!;

      if (
        latestTarget.status !== "pending_approval" ||
        latestTarget.requestProvenance !==
          "authenticated_join_request" ||
        latestTarget.membershipVerified === true
      ) {
        throw new Error(
          "Member request is no longer eligible for approval."
        );
      }

      if (
        latestTarget.uid !== String(memberId) ||
        latestTargetSnap.id !== String(memberId)
      ) {
        throw new Error(
          "Target membership identity is invalid."
        );
      }

      const latestTargetEmail =
        String(latestTarget.email || "")
          .trim()
          .toLowerCase();

      if (
        !latestTargetEmail ||
        latestTargetEmail !== authEmail
      ) {
        throw new Error(
          "Target email no longer matches Firebase Auth email."
        );
      }

      let finalHospitalId = "";
      let finalHospitalName = "";
      let finalHospital = "";
      let finalLegacyHospitalNames: string[] = [];

      if (isAdmin) {
        /*
         * Platform admin authority comes from the explicit
         * hospital selected by the platform admin.
         *
         * Do NOT use the applicant's hospitalId/hospitalName.
         */
        finalHospitalId =
          requestedHospitalId;

        finalHospitalName =
          requestedHospitalName;

        finalHospital =
          requestedHospitalName;

        finalLegacyHospitalNames = [];
      } else {
        /*
         * Normal approval requires the caller's canonical
         * team_members/{uid} document to still be an active,
         * verified HOD at transaction time.
         */
        const callerRef =
          db.collection("team_members").doc(callerUid);

        const callerSnap =
          await tx.get(callerRef);

        if (!callerSnap.exists) {
          throw new Error(
            "Only Team Admins can approve members."
          );
        }

        const caller =
          callerSnap.data()!;

        if (!isTeamAdmin(caller)) {
          throw new Error(
            "Only Team Admins can approve members."
          );
        }

        const callerTeamId = caller.teamId || caller.hospitalId;
        const targetTeamId = latestTarget.teamId || latestTarget.hospitalId;
        if (
          !callerTeamId ||
          callerTeamId !== targetTeamId
        ) {
          throw new Error(
            "Target member is not in your team."
          );
        }

        finalHospitalId =
          callerTeamId;

        finalHospitalName =
          caller.hospitalName ||
          caller.hospital ||
          "";

        finalHospital =
          caller.hospital ||
          caller.hospitalName ||
          "";

        finalLegacyHospitalNames =
          Array.isArray(caller.legacyHospitalNames)
            ? caller.legacyHospitalNames
            : [];
      }

      const approvedRole = req.body.role ? String(req.body.role).trim() : (latestTarget.role || "Resident");
      const isAppointedAdmin = req.body.isTeamAdmin === true || req.body.teamRole === "admin";

      // Check if the team is institutionally verified
      let isInstVerified = false;
      const teamSnap = await tx.get(db.collection("teams").doc(finalHospitalId));
      if (teamSnap.exists && teamSnap.data()?.verificationStatus === "verified") {
        isInstVerified = true;
      }

      const userRef =
        db.collection("users").doc(latestTarget.uid);

      tx.update(targetRef, {
        status: "active",
        membershipVerified: isInstVerified,
        verificationStatus: isInstVerified ? "verified" : "unverified",
        role: approvedRole,
        isTeamAdmin: isAppointedAdmin,
        teamRole: isAppointedAdmin ? "admin" : "member",
        teamId: finalHospitalId,
        hospitalId: finalHospitalId,
        hospitalName: finalHospitalName,
        hospital: finalHospital,
        legacyHospitalNames:
          finalLegacyHospitalNames,

        approvedAt: nowIso(),
        approvedByUid: callerUid,
        updatedAt: nowIso()
      });

      tx.set(
        userRef,
        {
          hospital: finalHospital,
          hospitalId: finalHospitalId,
          hospitalName: finalHospitalName,
          teamId: finalHospitalId,
          role: approvedRole,
          isTeamAdmin: isAppointedAdmin,
          teamRole: isAppointedAdmin ? "admin" : "member",
          updatedAt: nowIso()
        },
        { merge: true }
      );
      /*
 * Security audit:
 * Record successful department membership approval
 * in the SAME transaction as membership activation.
 */
const approvalAuditRef =
  db.collection("teamAuditLog").doc();

tx.set(
  approvalAuditRef,
  {
    id: approvalAuditRef.id,

    eventType:
      "TEAM_MEMBER_APPROVED",

    actorUid:
      callerUid,

    actorEmail:
      (req.user?.email || "")
        .trim()
        .toLowerCase(),

    actorType:
      isAdmin
        ? "platform_admin"
        : "hospital_hod",

    hospitalId:
      finalHospitalId,

    hospitalName:
      finalHospitalName,

    targetUid:
      latestTarget.uid,

    targetEmail:
      String(latestTarget.email || "")
        .trim()
        .toLowerCase(),

    targetRole:
      latestTarget.role || "",

    previousStatus:
      "pending_approval",

    newStatus:
      "active",

    requestProvenance:
      latestTarget.requestProvenance ||
      "authenticated_join_request",

    membershipVerified:
      true,

    approvedByUid:
      callerUid,

    createdAt:
      nowIso()
  }
);
    });

    return res.json({
      success: true
    });
  } catch (error: any) {
    console.error(
      "Error approving member:",
      error
    );

    const message =
      error.message ||
      "Failed to approve member.";

    const status =
      message.includes(
        "Only active verified HODs"
      ) ||
      message.includes(
        "not in your hospital"
      )
        ? 403
        : message.includes(
            "no longer exists"
          )
          ? 404
          : 400;

    return res.status(status).json({
      error: message
    });
  }
});
// ── POST /update-role ───────────────────────────────────────────────────────
router.post("/update-role", async (req: AuthRequest, res) => {
  try {
    const { memberId, role } = req.body || {};
    const callerUid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);

    if (!memberId) {
      return res.status(400).json({
        error: "memberId is required."
      });
    }

    if (!role) {
      return res.status(400).json({
        error: "role is required."
      });
    }

    if (String(memberId) === callerUid) {
      return res.status(400).json({
        error: "You cannot change your own role."
      });
    }

    const normalizedRole =
      String(role).trim().toLowerCase();

    if (!INVITE_ALLOWED_ROLES.has(normalizedRole)) {
      return res.status(400).json({
        error: "Invalid clinical role."
      });
    }

    const targetRef =
      db.collection("team_members").doc(String(memberId));

    const userRef =
      db.collection("users").doc(String(memberId));

    const logRef =
      db.collection("roleChangeLog").doc();

    await db.runTransaction(async (tx) => {
      const targetSnap = await tx.get(targetRef);

      if (!targetSnap.exists) {
        throw new Error("Target member not found.");
      }

      const target = targetSnap.data()!;

      if (
        target.uid !== String(memberId) ||
        targetSnap.id !== String(memberId)
      ) {
        throw new Error(
          "Target membership identity is invalid."
        );
      }

      if (
        target.status !== "active" &&
        target.status !== "active (joined)"
      ) {
        throw new Error(
          "Only active members can have their role changed."
        );
      }

      let caller: any = null;

      if (!isAdmin) {
        const callerRef =
          db.collection("team_members").doc(callerUid);

        const callerSnap = await tx.get(callerRef);

        if (!callerSnap.exists) {
          throw new Error(
            "Only Team Admins can change roles."
          );
        }

        caller = callerSnap.data()!;

        if (!isTeamAdmin(caller)) {
          throw new Error(
            "Only Team Admins can change roles."
          );
        }

        const callerTeamId = caller.teamId || caller.hospitalId;
        const targetTeamId = target.teamId || target.hospitalId;
        if (
          !callerTeamId ||
          callerTeamId !== targetTeamId
        ) {
          throw new Error(
            "Target member is not in your team."
          );
        }
      }

      const previousRole =
        String(target.role || "").trim().toLowerCase();

      // If updating admin status, ensure hospital is never left without an admin
      if (req.body.isTeamAdmin === false && isTeamAdmin(target)) {
        const membersSnap = await tx.get(
          db
            .collection("team_members")
            .where("hospitalId", "==", target.hospitalId)
        );

        const otherAdmins = membersSnap.docs.filter(
          (docSnap) =>
            docSnap.id !== targetRef.id &&
            isTeamAdmin(docSnap.data())
        );

        if (otherAdmins.length === 0) {
          throw new Error(
            "Cannot remove the only Team Admin. Appoint another Team Admin first."
          );
        }
      }

      const updates: any = {
        updatedAt: nowIso()
      };

      if (normalizedRole) {
        updates.role = normalizedRole;
      }

      if (req.body.isTeamAdmin !== undefined) {
        updates.isTeamAdmin = Boolean(req.body.isTeamAdmin);
        updates.teamRole = req.body.isTeamAdmin ? "admin" : "member";
      }

      tx.update(targetRef, updates);

      if (normalizedRole) {
        tx.set(
          userRef,
          {
            role: normalizedRole
          },
          { merge: true }
        );
      }

      tx.set(logRef, {
        targetUid: String(memberId),
        targetEmail: target.email || "",
        hospitalId: target.hospitalId || "",
        previousRole,
        newRole: normalizedRole,
        changedByUid: callerUid,
        changedByPlatformAdmin: isAdmin,
        changedAt: nowIso()
      });
      /*
 * Uniform security audit:
 * Preserve the dedicated roleChangeLog above,
 * and also record the role change in teamAuditLog.
 */
const roleAuditRef =
  db.collection("teamAuditLog").doc();

tx.set(
  roleAuditRef,
  {
    id: roleAuditRef.id,

    eventType:
      "TEAM_MEMBER_ROLE_CHANGED",

    actorUid:
      callerUid,

    actorEmail:
      (req.user?.email || "")
        .trim()
        .toLowerCase(),

    actorType:
      isAdmin
        ? "platform_admin"
        : "hospital_hod",

    hospitalId:
      target.hospitalId || "",

    hospitalName:
      target.hospitalName ||
      target.hospital ||
      "",

    targetUid:
      String(memberId),

    targetEmail:
      String(target.email || "")
        .trim()
        .toLowerCase(),

    previousRole:
      previousRole,

    newRole:
      normalizedRole,

    membershipVerified:
      target.membershipVerified === true,

    status:
      target.status || "",

    changedByUid:
      callerUid,

    createdAt:
      nowIso()
  }
);
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating member role:", error);

    const message =
      error.message || "Failed to update member role.";

    const status =
      message.includes("Only active verified HODs") ||
      message.includes("not in your hospital") ||
      message.includes("platform administrator")
        ? 403
        : 400;

    return res.status(status).json({
      error: message
    });
  }
});
// ── POST /decline-member ────────────────────────────────────────────────────
router.post("/decline-member", async (req: AuthRequest, res) => {
  try {
    const { memberId } = req.body || {};
    const callerUid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);

    if (!memberId) return res.status(400).json({ error: "memberId is required." });

    const targetRef = db.collection("team_members").doc(String(memberId));
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ error: "Member not found." });
    }

    const target = targetSnap.data()!;
    if (target.status !== "pending_approval") {
  return res.status(400).json({
    error: "Only pending join requests can be declined."
  });
}

if (
  target.requestProvenance !==
  "authenticated_join_request"
) {
  return res.status(400).json({
    error: "Invalid join request provenance."
  });
}

if (target.membershipVerified === true) {
  return res.status(400).json({
    error: "Verified active memberships cannot be declined."
  });
}

if (
  String(memberId) !== target.uid ||
  targetRef.id !== target.uid
) {
  return res.status(400).json({
    error: "Target document ID does not match target.uid."
  });
}

    if (!isAdmin) {
      const callerSnap = await db.collection("team_members").doc(callerUid).get();
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only Team Admins can decline members." });
      }
      const caller = callerSnap.data()!;
      if (!isTeamAdmin(caller)) {
        return res.status(403).json({ error: "Only Team Admins can decline members." });
      }
      const callerTeamId = caller.teamId || caller.hospitalId;
      const targetTeamId = target.teamId || target.hospitalId;
      if (!callerTeamId || callerTeamId !== targetTeamId) {
        return res.status(403).json({ error: "Target member is not in your team." });
      }
    }

   await db.runTransaction(async (tx) => {
  const latestSnap = await tx.get(targetRef);

  if (!latestSnap.exists) {
    throw new Error("Member request no longer exists.");
  }

  const latest = latestSnap.data()!;
if (
  latest.status !== "pending_approval" ||
  latest.requestProvenance !== "authenticated_join_request" ||
  latest.membershipVerified === true
) {
    throw new Error(
      "Member request is no longer pending approval."
    );
  }

  tx.update(targetRef, {
    status: "rejected",
    declinedAt: nowIso(),
    declinedByUid: callerUid,
    updatedAt: nowIso()
  });
  /*
 * Security audit:
 * Record rejection of a pending department join
 * request in the SAME transaction.
 */
const declineAuditRef =
  db.collection("teamAuditLog").doc();

tx.set(
  declineAuditRef,
  {
    id: declineAuditRef.id,

    eventType:
      "TEAM_MEMBER_DECLINED",

    actorUid:
      callerUid,

    actorEmail:
      (req.user?.email || "")
        .trim()
        .toLowerCase(),

    actorType:
      isAdmin
        ? "platform_admin"
        : "hospital_hod",

    hospitalId:
      latest.hospitalId || "",

    hospitalName:
      latest.hospitalName ||
      latest.hospital ||
      "",

    targetUid:
      latest.uid,

    targetEmail:
      String(latest.email || "")
        .trim()
        .toLowerCase(),

    targetRole:
      latest.role || "",

    previousStatus:
      "pending_approval",

    newStatus:
      "rejected",

    requestProvenance:
      latest.requestProvenance ||
      "authenticated_join_request",

    membershipVerified:
      false,

    declinedByUid:
      callerUid,

    createdAt:
      nowIso()
  }
);
});
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error declining member:", error);
    return res.status(400).json({ error: error.message || "Failed to decline member." });
  }
});

// ── POST /remove-member ─────────────────────────────────────────────────────
router.post("/remove-member", async (req: AuthRequest, res) => {
  try {
    const { memberId } = req.body || {};

    const callerUid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);

    if (!memberId) {
      return res.status(400).json({
        error: "memberId is required."
      });
    }

    const targetUid = String(memberId).trim();

    if (!targetUid) {
      return res.status(400).json({
        error: "Invalid memberId."
      });
    }

    if (targetUid === callerUid) {
      return res.status(400).json({
        error:
          "Use Leave Team to remove yourself."
      });
    }

    const targetRef =
      db.collection("team_members").doc(targetUid);

    const userRef =
      db.collection("users").doc(targetUid);

    await db.runTransaction(async (tx) => {
      /*
       * Canonical runtime membership only:
       * team_members/{firebaseAuthUid}
       *
       * Legacy mem-* documents are never trusted
       * for authorization or member removal.
       */
      const targetSnap =
        await tx.get(targetRef);

      if (!targetSnap.exists) {
        throw new Error(
          "Member not found."
        );
      }

      const target =
        targetSnap.data()!;

      if (
        target.uid !== targetUid ||
        targetSnap.id !== targetUid
      ) {
        throw new Error(
          "Target membership identity is invalid."
        );
      }

      /*
       * /remove-member is for an existing active team member.
       * Pending join requests must use /decline-member instead.
       */
      if (
        target.status !== "active" &&
        target.status !== "active (joined)"
      ) {
        throw new Error(
          "Only active members can be removed."
        );
      }

      if (!isAdmin) {
        const callerRef =
          db.collection("team_members").doc(callerUid);

        const callerSnap =
          await tx.get(callerRef);

        if (!callerSnap.exists) {
          throw new Error(
            "Only Team Admins can remove members."
          );
        }

        const caller =
          callerSnap.data()!;

        if (!isTeamAdmin(caller)) {
          throw new Error(
            "Only Team Admins can remove members."
          );
        }

        const callerTeamId = caller.teamId || caller.hospitalId;
        const targetTeamId = target.teamId || target.hospitalId;
        if (
          !callerTeamId ||
          callerTeamId !== targetTeamId
        ) {
          throw new Error(
            "Target member is not in your team."
          );
        }
      }

      /*
       * Never leave a team without an active Team Admin.
       */
      if (isTeamAdmin(target)) {
        const targetTeamId = target.teamId || target.hospitalId;
        const adminsSnap =
          await tx.get(
            db
              .collection("team_members")
              .where(
                "hospitalId",
                "==",
                targetTeamId
              )
          );

        const otherAdmins =
          adminsSnap.docs.filter(
            (docSnap) =>
              docSnap.id !== targetUid &&
              docSnap.data().status === "active" &&
              isTeamAdmin(docSnap.data())
          );

        if (otherAdmins.length === 0) {
          throw new Error(
            "Cannot remove the only Team Admin of this team. Appoint another Team Admin first."
          );
        }
      }

      tx.update(targetRef, {
        status: "inactive",
        removedAt: nowIso(),
        removedByUid: callerUid,
        updatedAt: nowIso(),
        reason: "removed_from_team"
      });

      /*
       * Clear hospital access mirror on users/{uid}.
       * Authority remains team_members/{uid}.
       */
      tx.set(
        userRef,
        {
          hospital: "",
          hospitalId: "",
          subscriptionTier:
            "Free Standard"
        },
        { merge: true }
      );
      /*
 * Security audit:
 * Record removal of an active verified clinician
 * from the department in the SAME transaction.
 */
const removalAuditRef =
  db.collection("teamAuditLog").doc();

tx.set(
  removalAuditRef,
  {
    id: removalAuditRef.id,

    eventType:
      "TEAM_MEMBER_REMOVED",

    actorUid:
      callerUid,

    actorEmail:
      (req.user?.email || "")
        .trim()
        .toLowerCase(),

    actorType:
      isAdmin
        ? "platform_admin"
        : "hospital_hod",

    hospitalId:
      target.hospitalId || "",

    hospitalName:
      target.hospitalName ||
      target.hospital ||
      "",

    targetUid:
      targetUid,

    targetEmail:
      String(target.email || "")
        .trim()
        .toLowerCase(),

    targetRole:
      target.role || "",

    previousStatus:
      "active",

    newStatus:
      "inactive",

    membershipVerifiedAtRemoval:
      target.membershipVerified === true,

    reason:
      "removed_from_team",

    removedByUid:
      callerUid,

    createdAt:
      nowIso()
  }
);
    });

    return res.json({
      success: true
    });
  } catch (error: any) {
    console.error(
      "Error removing member:",
      error
    );

    const message =
      error.message ||
      "Failed to remove member.";

    const status =
      message.includes(
        "Only active verified HODs"
      ) ||
      message.includes(
        "not in your hospital"
      )
        ? 403
        : message.includes(
            "Member not found"
          )
          ? 404
          : 400;

    return res.status(status).json({
      error: message
    });
  }
});

// ── POST /leave ─────────────────────────────────────────────────────────────
router.post("/leave", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
   

    await db.runTransaction(async (tx) => {
     const memRef = db.collection("team_members").doc(uid);
const memSnap = await tx.get(memRef);
     

      if (!memSnap.exists) throw new Error("No active membership to leave.");
      const me = memSnap.data()!;
      if (me.status !== "active" && me.status !== "active (joined)") {
        throw new Error("No active membership to leave.");
      }
      if (isTeamAdmin(me)) {
        const teamId = me.teamId || me.hospitalId;
        const membersSnap = await tx.get(
          db.collection("team_members").where("hospitalId", "==", teamId)
        );
        const activeMembers = membersSnap.docs.filter((d) => d.data().status === "active");
        const otherAdmins = activeMembers.filter((d) => d.id !== uid && isTeamAdmin(d.data()));
        if (activeMembers.length > 1 && otherAdmins.length === 0) {
          throw new Error("Cannot leave team: You are the sole active Team Admin. Please appoint another Team Admin first.");
        }
      }

      const userRef = db.collection("users").doc(uid);
tx.update(memRef, {
  status: "inactive",
  leftAt: nowIso(),
  updatedAt: nowIso(),
  reason: "voluntary"
});
     tx.set(
  userRef,
  {
    hospital: "",
    hospitalId: "",
    subscriptionTier: "Free Standard"
  },
  { merge: true }
);
/*
 * Security audit:
 * Record voluntary departure from the department
 * in the SAME transaction.
 */
const leaveAuditRef =
  db.collection("teamAuditLog").doc();

tx.set(
  leaveAuditRef,
  {
    id: leaveAuditRef.id,

    eventType:
      "TEAM_MEMBER_LEFT",

    actorUid:
      uid,

    actorEmail:
      (req.user?.email || me.email || "")
        .trim()
        .toLowerCase(),

    actorType:
      "member",

    hospitalId:
      me.hospitalId || "",

    hospitalName:
      me.hospitalName ||
      me.hospital ||
      "",

    targetUid:
      uid,

    targetEmail:
      String(me.email || req.user?.email || "")
        .trim()
        .toLowerCase(),

    targetRole:
      me.role || "",

    previousStatus:
      "active",

    newStatus:
      "inactive",

    membershipVerifiedAtLeave:
      me.membershipVerified === true,

    reason:
      "voluntary",

    createdAt:
      nowIso()
  }
);
});

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error leaving team:", error);
    return res.status(400).json({ error: error.message || "Failed to leave team." });
  }
});

// ── POST /approve-hod-claim ────────────────────────────────────────────────
router.post("/approve-hod-claim", async (req: AuthRequest, res) => {
  try {
    if (!isPlatformAdminReq(req)) {
      return res.status(403).json({
        error: "Forbidden. Only the platform administrator (varahgrp@gmail.com) can approve HOD claims."
      });
    }

    const { claimId, hospitalId: explicitHospitalId, hospitalName: explicitHospitalName } = req.body || {};
    if (!claimId) {
      return res.status(400).json({ error: "claimId is required." });
    }

    const claimRef = db.collection("hodClaimRequests").doc(String(claimId));
    const claimSnap = await claimRef.get();
    if (!claimSnap.exists) {
      return res.status(404).json({ error: "HOD claim request not found." });
    }

    const claim = claimSnap.data()!;
    if (claim.status !== "pending") {
      return res.status(400).json({ error: "Claim is not pending approval." });
    }

    const claimantUid = String(claim.claimedByUid || "").trim();
    if (!claimantUid) {
      return res.status(400).json({ error: "Claim does not have a valid claimant UID." });
    }

    // Verify claimant identity in Firebase Auth
    let claimantRecord;
    try {
      claimantRecord = await adminAuth.getUser(claimantUid);
    } catch {
      return res.status(400).json({ error: "Claimant Firebase user record not found." });
    }

    // Resolve canonical hospitalId and hospitalName
    const rawHospitalName = String(explicitHospitalName || claim.hospital || "").trim();
    if (!rawHospitalName) {
      return res.status(400).json({ error: "Hospital name cannot be resolved." });
    }

    const rawHospitalId = String(explicitHospitalId || claim.hospitalId || "").trim();
    const resolvedHospitalId = rawHospitalId || rawHospitalName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);

    const now = nowIso();
    const adminUid = req.user!.uid;
    const adminEmail = req.user!.email || PLATFORM_ADMIN_EMAIL;

    const batch = db.batch();

    // 1. Establish canonical team_members/{claimedByUid}
    const memberRef = db.collection("team_members").doc(claimantUid);
    batch.set(
      memberRef,
      {
        id: claimantUid,
        uid: claimantUid,
        name: claim.claimedByName || claimantRecord.displayName || "Dr. HOD",
        email: (claim.claimedByEmail || claimantRecord.email || "").trim().toLowerCase(),
        role: "HOD / Department Lead",
        status: "active",
        membershipVerified: true,
        hospitalId: resolvedHospitalId,
        hospital: rawHospitalName,
        hospitalName: rawHospitalName,
        assignedBy: adminEmail,
        approvedBy: adminUid,
        approvedAt: now,
        updatedAt: now,
        requestProvenance: "platform_admin_approved_hod_claim",
        shift: "Active"
      },
      { merge: true }
    );

    // 2. Update users/{claimedByUid} profile mirror
    const userRef = db.collection("users").doc(claimantUid);
    batch.set(
      userRef,
      {
        role: "HOD / Department Lead",
        hospital: rawHospitalName,
        hospitalId: resolvedHospitalId,
        hospitalName: rawHospitalName,
        state: claim.state || "",
        place: claim.place || "",
        updatedAt: now
      },
      { merge: true }
    );

    // 3. Update hodClaimRequests/{claimId} -> approved
    batch.update(claimRef, {
      status: "approved",
      reviewedAt: now,
      reviewedBy: adminUid,
      reviewedByEmail: adminEmail,
      resolvedHospitalId,
      resolvedHospitalName: rawHospitalName
    });

    // 4. Add teamAuditLog entry
    const auditRef = db.collection("teamAuditLog").doc();
    batch.set(auditRef, {
      action: "approve_hod_claim",
      actorUid: adminUid,
      actorEmail: adminEmail,
      actorRole: "platform_admin",
      targetUid: claimantUid,
      targetEmail: (claim.claimedByEmail || claimantRecord.email || "").trim().toLowerCase(),
      claimId,
      hospitalId: resolvedHospitalId,
      hospitalName: rawHospitalName,
      assignedRole: "HOD / Department Lead",
      timestamp: now
    });

    await batch.commit();

    return res.json({
      success: true,
      message: `Approved ${claim.claimedByName} as HOD of ${rawHospitalName}.`,
      hospitalId: resolvedHospitalId,
      hospitalName: rawHospitalName
    });
  } catch (err: any) {
    console.error("Error approving HOD claim:", err);
    return res.status(500).json({
      error: err.message || "Failed to approve HOD claim."
    });
  }
});

// ── GET /my-team ────────────────────────────────────────────────────────────
router.get("/my-team", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const memberSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);

    if (!memberSnap.exists) {
      return res.json({ hasTeam: false });
    }

    const member = memberSnap.data!;
    const status = String(member.status || "").trim().toLowerCase();

    if (status === "pending_approval") {
      return res.json({
        hasTeam: false,
        pendingRequest: {
          teamId: member.teamId || member.hospitalId,
          hospitalName: member.hospitalName || member.hospital,
          teamName: member.teamName || member.hospitalName || member.hospital,
          department: member.department || "Emergency Medicine",
          status: "pending_approval",
          requestedAt: member.requestedAt || member.createdAt
        }
      });
    }

    if (status !== "active" && status !== "active (joined)") {
      return res.json({ hasTeam: false });
    }

    const teamId = member.teamId || member.hospitalId || member.hospital;
    if (!teamId) {
      return res.json({ hasTeam: false });
    }

    // Load team document
    let teamData: any = null;
    const teamSnap = await getDocWithRestFallback("teams", teamId, req.headers.authorization);
    if (teamSnap.exists) {
      teamData = teamSnap.data!;
    } else {
      teamData = {
        id: teamId,
        teamName: member.teamName || member.hospitalName || member.hospital || "Emergency Team",
        hospitalName: member.hospitalName || member.hospital || "Hospital",
        department: member.department || "Emergency Medicine",
        erPhysicalBedCapacity: 30,
        verificationStatus: member.membershipVerified ? "verified" : "unverified",
        isInstitutionallyVerified: member.membershipVerified || false
      };
    }

    const callerIsAdmin = isTeamAdmin(member) || isPlatformAdminReq(req);

    // Fetch team members
    const membersSnap = await db.collection("team_members")
      .where("hospitalId", "==", teamId)
      .get()
      .catch(async () => {
        return db.collection("team_members").where("hospital", "==", member.hospital || teamId).get();
      });

    const members: any[] = [];
    const pendingRequests: any[] = [];

    membersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const mStatus = String(data.status || "").trim().toLowerCase();
      const item = {
        id: docSnap.id,
        uid: data.uid || docSnap.id,
        name: data.name || (data.email ? data.email.split("@")[0] : "Clinician"),
        email: data.email || "",
        role: data.role || "Resident",
        status: data.status || "active",
        isTeamAdmin: isTeamAdmin(data),
        teamRole: isTeamAdmin(data) ? "admin" : "member",
        verificationStatus: data.verificationStatus || (data.membershipVerified ? "verified" : "unverified"),
        shift: data.shift || "Active",
        joinedAt: data.joinedAt || data.createdAt
      };

      if (mStatus === "active" || mStatus === "active (joined)") {
        members.push(item);
      } else if (mStatus === "pending_approval" && callerIsAdmin) {
        pendingRequests.push(item);
      }
    });

    return res.json({
      hasTeam: true,
      team: {
        id: teamId,
        teamName: teamData.teamName || member.teamName || member.hospitalName || teamId,
        hospitalName: teamData.hospitalName || member.hospitalName || member.hospital || teamId,
        department: teamData.department || member.department || "Emergency Medicine",
        erPhysicalBedCapacity: teamData.erPhysicalBedCapacity || 30,
        verificationStatus: teamData.verificationStatus || (member.membershipVerified ? "verified" : "unverified"),
        isInstitutionallyVerified: teamData.isInstitutionallyVerified || member.membershipVerified || false,
        activeInviteToken: callerIsAdmin ? (teamData.activeInviteToken || null) : null,
        activeInviteExpiresAt: callerIsAdmin ? (teamData.activeInviteExpiresAt || null) : null
      },
      members,
      pendingRequests: callerIsAdmin ? pendingRequests : [],
      isTeamAdmin: callerIsAdmin,
      myRole: member.role || "Resident",
      verificationStatus: teamData.verificationStatus || (member.membershipVerified ? "verified" : "unverified")
    });
  } catch (error: any) {
    console.error("Error loading my team:", error);
    return res.status(500).json({ error: error.message || "Failed to load team data." });
  }
});

// ── POST /update-team ───────────────────────────────────────────────────────
router.post("/update-team", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);
    const { teamId, teamName, hospitalName, department, erPhysicalBedCapacity } = req.body || {};

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required." });
    }

    if (!isAdmin) {
      const callerSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only Team Admins can update team settings." });
      }
      const caller = callerSnap.data!;
      if (!isTeamAdmin(caller)) {
        return res.status(403).json({ error: "Only Team Admins can update team settings." });
      }
      const callerTeamId = caller.teamId || caller.hospitalId;
      if (callerTeamId !== teamId) {
        return res.status(403).json({ error: "You are not an admin of this team." });
      }
    }

    const updates: any = { updatedAt: nowIso() };
    if (teamName && String(teamName).trim().length >= 2) {
      updates.teamName = String(teamName).trim();
    }
    if (hospitalName && String(hospitalName).trim().length >= 2) {
      updates.hospitalName = String(hospitalName).trim();
    }
    if (department && String(department).trim().length >= 2) {
      updates.department = String(department).trim();
    }
    const parsedCap = typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0 && erPhysicalBedCapacity <= 1000
      ? erPhysicalBedCapacity
      : parseInt(erPhysicalBedCapacity, 10);
    if (Number.isInteger(parsedCap) && parsedCap > 0 && parsedCap <= 1000) {
      updates.erPhysicalBedCapacity = parsedCap;
    }

    const teamRef = db.collection("teams").doc(teamId);
    await teamRef.set(updates, { merge: true });

    if (updates.erPhysicalBedCapacity || updates.teamName || updates.hospitalName) {
      const shiftRef = db.collection("hospital_shifts").doc(teamId);
      const shiftUpdates: any = { updatedAt: nowIso() };
      if (updates.erPhysicalBedCapacity) shiftUpdates.erPhysicalBedCapacity = updates.erPhysicalBedCapacity;
      if (updates.teamName) shiftUpdates.teamName = updates.teamName;
      if (updates.hospitalName) shiftUpdates.hospital = updates.hospitalName;
      await shiftRef.set(shiftUpdates, { merge: true }).catch(() => {});
    }

    const auditRef = db.collection("teamAuditLog").doc();
    await auditRef.set({
      id: auditRef.id,
      eventType: "TEAM_UPDATED",
      actorUid: uid,
      actorEmail: (req.user?.email || "").trim().toLowerCase(),
      teamId,
      updates,
      createdAt: nowIso()
    }).catch(() => {});

    return res.json({ success: true, message: "Team settings updated successfully.", team: updates });
  } catch (error: any) {
    console.error("Error updating team:", error);
    return res.status(400).json({ error: error.message || "Failed to update team settings." });
  }
});

// ── POST /set-team-admin ────────────────────────────────────────────────────
router.post("/set-team-admin", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);
    const { memberId, isTeamAdmin: targetIsAdmin } = req.body || {};

    if (!memberId) {
      return res.status(400).json({ error: "memberId is required." });
    }

    const targetRef = db.collection("team_members").doc(String(memberId));
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ error: "Member not found." });
    }
    const target = targetSnap.data()!;

    if (!isAdmin) {
      const callerSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only Team Admins can appoint admins." });
      }
      const caller = callerSnap.data!;
      if (!isTeamAdmin(caller)) {
        return res.status(403).json({ error: "Only Team Admins can appoint admins." });
      }
      const callerTeamId = caller.teamId || caller.hospitalId;
      const targetTeamId = target.teamId || target.hospitalId;
      if (callerTeamId !== targetTeamId) {
        return res.status(403).json({ error: "Target member is not in your team." });
      }
    }

    const willBeAdmin = Boolean(targetIsAdmin);

    // If revoking admin, ensure at least one admin remains
    if (!willBeAdmin && isTeamAdmin(target)) {
      const teamId = target.teamId || target.hospitalId;
      const membersSnap = await db.collection("team_members").where("hospitalId", "==", teamId).get();
      const otherAdmins = membersSnap.docs.filter(
        d => d.id !== String(memberId) && d.data().status === "active" && isTeamAdmin(d.data())
      );
      if (otherAdmins.length === 0) {
        return res.status(400).json({ error: "Cannot remove the only Team Admin. Appoint another Admin first." });
      }
    }

    await targetRef.update({
      isTeamAdmin: willBeAdmin,
      teamRole: willBeAdmin ? "admin" : "member",
      updatedAt: nowIso()
    });

    const userRef = db.collection("users").doc(String(memberId));
    await userRef.set({
      isTeamAdmin: willBeAdmin,
      teamRole: willBeAdmin ? "admin" : "member",
      updatedAt: nowIso()
    }, { merge: true }).catch(() => {});

    const auditRef = db.collection("teamAuditLog").doc();
    await auditRef.set({
      id: auditRef.id,
      eventType: willBeAdmin ? "TEAM_ADMIN_APPOINTED" : "TEAM_ADMIN_REVOKED",
      actorUid: uid,
      actorEmail: (req.user?.email || "").trim().toLowerCase(),
      targetUid: String(memberId),
      targetEmail: target.email || "",
      teamId: target.teamId || target.hospitalId,
      createdAt: nowIso()
    }).catch(() => {});

    return res.json({
      success: true,
      message: willBeAdmin ? "Member appointed as Team Admin." : "Team Admin status revoked.",
      isTeamAdmin: willBeAdmin
    });
  } catch (error: any) {
    console.error("Error setting team admin:", error);
    return res.status(400).json({ error: error.message || "Failed to update admin role." });
  }
});

router.post("/appoint-admin", async (req: any, res: any) => {
  req.body.isTeamAdmin = true;
  return (router as any).handle(req, res);
});

// ── POST /set-rota-manager (Appoint or Revoke Rota Manager — Team Admin / HOD / Platform Admin) ──
router.post("/set-rota-manager", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);
    const { memberId, isRotaManager } = req.body || {};

    if (!memberId) {
      return res.status(400).json({ error: "memberId is required." });
    }

    const callerSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);
    if (!isAdmin) {
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only Team Admins or HODs can assign Rota Manager permissions." });
      }
      const caller = callerSnap.data!;
      if (!isTeamAdmin(caller)) {
        return res.status(403).json({ error: "Only Team Admins or HODs can assign Rota Manager permissions." });
      }
    }

    const targetRef = db.collection("team_members").doc(String(memberId));
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ error: "Team member not found." });
    }

    const willBeRotaManager = isRotaManager === true;
    await targetRef.update({
      isRotaManager: willBeRotaManager,
      rotaManager: willBeRotaManager,
      updatedAt: nowIso()
    });

    const userRef = db.collection("users").doc(String(memberId));
    await userRef.set({
      isRotaManager: willBeRotaManager,
      rotaManager: willBeRotaManager,
      updatedAt: nowIso()
    }, { merge: true }).catch(() => {});

    const auditRef = db.collection("teamAuditLog").doc();
    await auditRef.set({
      id: auditRef.id,
      eventType: willBeRotaManager ? "ROTA_MANAGER_APPOINTED" : "ROTA_MANAGER_REVOKED",
      actorUid: uid,
      actorEmail: (req.user?.email || "").trim().toLowerCase(),
      targetUid: String(memberId),
      createdAt: nowIso()
    }).catch(() => {});

    return res.json({
      success: true,
      message: willBeRotaManager ? "Member appointed as Rota Manager." : "Rota Manager permission revoked.",
      isRotaManager: willBeRotaManager
    });
  } catch (error: any) {
    console.error("Error setting rota manager:", error);
    return res.status(400).json({ error: error.message || "Failed to update rota manager role." });
  }
});

// ── POST /verify-team (Institutional Verification — Platform Admin only) ─────
router.post("/verify-team", async (req: AuthRequest, res) => {
  try {
    if (!isPlatformAdminReq(req)) {
      return res.status(403).json({ error: "Only the platform administrator (varahgrp@gmail.com) can perform institutional verification." });
    }

    const { teamId, verify } = req.body || {};
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required." });
    }

    const isVerified = verify !== false;
    const now = nowIso();

    const teamRef = db.collection("teams").doc(String(teamId));
    await teamRef.set({
      verificationStatus: isVerified ? "verified" : "unverified",
      isInstitutionallyVerified: isVerified,
      verifiedAt: isVerified ? now : null,
      verifiedBy: isVerified ? req.user!.uid : null,
      updatedAt: now
    }, { merge: true });

    // Update active members in the team
    const membersSnap = await db.collection("team_members").where("hospitalId", "==", String(teamId)).get();
    const batch = db.batch();
    membersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === "active" || data.status === "active (joined)") {
        batch.update(docSnap.ref, {
          verificationStatus: isVerified ? "verified" : "unverified",
          membershipVerified: isVerified,
          updatedAt: now
        });
      }
    });
    await batch.commit();

    const auditRef = db.collection("teamAuditLog").doc();
    await auditRef.set({
      id: auditRef.id,
      eventType: isVerified ? "TEAM_INSTITUTIONALLY_VERIFIED" : "TEAM_VERIFICATION_REVOKED",
      actorUid: req.user!.uid,
      actorEmail: PLATFORM_ADMIN_EMAIL,
      teamId: String(teamId),
      createdAt: now
    }).catch(() => {});

    return res.json({
      success: true,
      message: isVerified ? "Team has been institutionally verified." : "Team institutional verification revoked.",
      verificationStatus: isVerified ? "verified" : "unverified"
    });
  } catch (error: any) {
    console.error("Error verifying team:", error);
    return res.status(400).json({ error: error.message || "Failed to verify team." });
  }
});

// ── POST /create-team (WhatsApp-Style Team Creation) ────────────────────────
const handleCreateTeam = async (req: AuthRequest, res: any) => {
  try {
    const uid = req.user!.uid;
    const userEmail = (req.user!.email || "").trim().toLowerCase();
    const { teamName, hospitalName, workplaceName, department, erPhysicalBedCapacity, professionalRole } = req.body || {};

    const rawHospitalName = String(hospitalName || workplaceName || "").trim();
    if (!rawHospitalName || rawHospitalName.length < 2) {
      return res.status(400).json({ error: "A valid hospital or workplace name (at least 2 characters) is required." });
    }

    const cleanTeamName = String(teamName || "").trim() || `${rawHospitalName} ER Team`;
    const cleanDepartment = String(department || "").trim() || "Emergency Medicine";

    let parsedBedCapacity = 30;
    if (erPhysicalBedCapacity !== undefined && erPhysicalBedCapacity !== null && String(erPhysicalBedCapacity).trim() !== "") {
      const cap = Number(erPhysicalBedCapacity);
      if (!Number.isInteger(cap) || cap < 1 || cap > 1000) {
        return res.status(400).json({ error: "ER Physical Bed Capacity must be a strict integer between 1 and 1000." });
      }
      parsedBedCapacity = cap;
    }

    // Secure unique team identifier generated on trusted backend
    const prefix = rawHospitalName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "team";
    const uniqueTeamId = `team_${prefix}_${Date.now()}_${randomBytes(4).toString("hex")}`;

    const memberRef = db.collection("team_members").doc(uid);
    const userRef = db.collection("users").doc(uid);
    const teamRef = db.collection("teams").doc(uniqueTeamId);
    const shiftRef = db.collection("hospital_shifts").doc(uniqueTeamId);

    // Resolve creator's professional designation (NEVER automatically forced to HOD!)
    let creatorClinicalRole = "Emergency Physician";
    if (professionalRole && typeof professionalRole === "string" && professionalRole.trim()) {
      creatorClinicalRole = professionalRole.trim();
    } else {
      const existingUserSnap = await userRef.get().catch(() => null);
      if (existingUserSnap && existingUserSnap.exists) {
        const uData = existingUserSnap.data()!;
        if (uData.role) creatorClinicalRole = uData.role;
      }
    }

    await db.runTransaction(async (tx) => {
      const existingSnap = await tx.get(memberRef);
      if (existingSnap.exists) {
        const existing = existingSnap.data()!;
        // Requirement G.7: Protect team creation against overwriting existing memberships
        if (existing.status === "active") {
          throw new Error("You already have an active hospital team membership. Leave your current team before creating a new workspace.");
        }
        if (existing.status === "pending_approval") {
          throw new Error("You currently have a pending join request for another team. Cancel that request before creating a new workspace.");
        }
      }

      const now = nowIso();

      // 1. Canonical team/workspace record (unverified by default)
      tx.set(teamRef, {
        id: uniqueTeamId,
        teamName: cleanTeamName,
        hospitalName: rawHospitalName,
        department: cleanDepartment,
        erPhysicalBedCapacity: parsedBedCapacity,
        createdByUid: uid,
        createdByEmail: userEmail,
        createdAt: now,
        updatedAt: now,
        verificationStatus: "unverified",
        isInstitutionallyVerified: false,
        activeInviteToken: null,
        activeInviteExpiresAt: null
      });

      // 2. Creator becomes first Team Admin while preserving their professional role!
      tx.set(memberRef, {
        id: uid,
        uid: uid,
        email: userEmail,
        name: req.user!.name || userEmail.split("@")[0],
        teamId: uniqueTeamId,
        hospitalId: uniqueTeamId,
        hospitalName: rawHospitalName,
        hospital: rawHospitalName,
        teamName: cleanTeamName,
        department: cleanDepartment,
        role: creatorClinicalRole,
        isTeamAdmin: true,
        teamRole: "admin",
        status: "active",
        verificationStatus: "unverified",
        membershipVerified: false,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
        requestProvenance: "create_team",
        shift: "Active"
      });

      // 3. User document update (do not elevate to hospital team premium!)
      tx.set(userRef, {
        hospital: rawHospitalName,
        hospitalId: uniqueTeamId,
        hospitalName: rawHospitalName,
        teamId: uniqueTeamId,
        teamName: cleanTeamName,
        department: cleanDepartment,
        erPhysicalBedCapacity: parsedBedCapacity,
        isTeamAdmin: true,
        teamRole: "admin",
        updatedAt: now
      }, { merge: true });

      // 4. Initial bed capacity in hospital_shifts
      tx.set(shiftRef, {
        id: uniqueTeamId,
        hospitalId: uniqueTeamId,
        hospital: rawHospitalName,
        teamName: cleanTeamName,
        erPhysicalBedCapacity: parsedBedCapacity,
        updatedAt: now,
        updatedByUid: uid,
        updatedByEmail: userEmail
      }, { merge: true });

      // 5. Audit log
      const auditRef = db.collection("teamAuditLog").doc();
      tx.set(auditRef, {
        id: auditRef.id,
        eventType: "TEAM_CREATED",
        actorUid: uid,
        actorEmail: userEmail,
        actorRole: creatorClinicalRole,
        isTeamAdmin: true,
        teamId: uniqueTeamId,
        hospitalId: uniqueTeamId,
        hospitalName: rawHospitalName,
        teamName: cleanTeamName,
        createdAt: now
      });
    });

    return res.status(200).json({
      success: true,
      message: "Your team has been created.",
      teamId: uniqueTeamId,
      hospitalId: uniqueTeamId,
      hospitalName: rawHospitalName,
      teamName: cleanTeamName,
      department: cleanDepartment,
      role: creatorClinicalRole,
      isTeamAdmin: true,
      verificationStatus: "unverified"
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "Failed to create team workspace." });
  }
};

router.post("/create-team", handleCreateTeam);
router.post("/create-workspace", handleCreateTeam);

export default router;
