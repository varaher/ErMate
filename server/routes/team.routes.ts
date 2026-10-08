import { Router } from "express";
import { randomBytes } from "crypto";
import { adminAuth, db, PROJECT_ID, FIRESTORE_DATABASE_ID } from "../../src/lib/firebase-admin.ts";
import { requireAuth, AuthRequest } from "../../src/middleware/auth.ts";

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
  "nurse",
  "doctor",
  "fellow",
  "medical_officer",
  "scribe specialist",
  "hod",
  "hod / department lead",
  "hod / shift lead"
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

    const inviteDoc = await db.collection("teamInvites").doc(token).get();
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
      hospitalName: data.hospitalName || "",
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

// ── POST /create-invite ─────────────────────────────────────────────────────
router.post("/create-invite", async (req: AuthRequest, res) => {
  try {
    const { invitedEmail, role, maxUses, expiresHours, hospitalId, hospitalName } = req.body || {};
    const uid = req.user!.uid;
    const isAdmin = isPlatformAdminReq(req);

    let callerHospitalId = "";
    let callerHospitalName = "";

    if (!isAdmin) {
      const callerSnap = await getDocWithRestFallback("team_members", uid, req.headers.authorization);
      if (!callerSnap.exists) {
        return res.status(403).json({ error: "Only active verified HODs can create invites." });
      }
      const caller = callerSnap.data!;
      if (!isVerifiedHod(caller)) {
        return res.status(403).json({ error: "Only active verified HODs can create invites." });
      }
      callerHospitalId = caller.hospitalId;
      callerHospitalName = caller.hospitalName || caller.hospital || "";
    } else {
  const requestedHospitalId =
    String(hospitalId || "").trim();

  const requestedHospitalName =
    String(hospitalName || "").trim();

  if (!requestedHospitalId || !requestedHospitalName) {
    return res.status(400).json({
      error:
        "Platform admin invites require both hospitalId and hospitalName."
    });
  }

  callerHospitalId = requestedHospitalId;
  callerHospitalName = requestedHospitalName;
}
    

    let targetRole = "resident";

if (role) {
  const normRole =
    String(role).trim().toLowerCase();

  if (!INVITE_ALLOWED_ROLES.has(normRole)) {
    return res.status(400).json({
      error:
        `Role "${role}" is not permitted for invitation.`
    });
  }

  if (
    isExactHospitalAdminRole(normRole) &&
    !isAdmin
  ) {
    return res.status(403).json({
      error:
        "Only the platform administrator can create an invitation for an HOD or leadership role."
    });
  }

  targetRole = normRole;
}
   const token = `inv_${randomBytes(24).toString("hex")}`;
    const hours = typeof expiresHours === "number" && expiresHours > 0 ? expiresHours : 48;
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
    const uses = typeof maxUses === "number" && maxUses > 0 ? maxUses : 1;

    const inviteDoc = {
      id: token,
      token,
      hospitalId: callerHospitalId,
      hospitalName: callerHospitalName,
      role: targetRole,
      invitedEmail: invitedEmail ? String(invitedEmail).trim().toLowerCase() : null,
      maxUses: uses,
      usedCount: 0,
      revoked: false,
      expiresAt,
      createdAt: nowIso(),
      createdByUid: uid,
      createdByPlatformAdmin: isAdmin
    };

    /*
 * Create the invitation and its security audit event
 * atomically.
 *
 * IMPORTANT:
 * - Never write the invitation token into the audit log.
 * - Audit identity comes from the verified Firebase
 *   request, never from client-supplied UID/email.
 */
    try {
      const inviteRef = db.collection("teamInvites").doc(token);
      const auditRef = db.collection("teamAuditLog").doc();
      const batch = db.batch();
      batch.set(inviteRef, inviteDoc);
      batch.set(auditRef, {
        id: auditRef.id,
        eventType: "TEAM_INVITE_CREATED",
        actorUid: uid,
        actorEmail: (req.user?.email || "").trim().toLowerCase(),
        actorType: isAdmin ? "platform_admin" : "hospital_hod",
        hospitalId: callerHospitalId,
        hospitalName: callerHospitalName,
        targetEmail: invitedEmail ? String(invitedEmail).trim().toLowerCase() : null,
        targetRole: targetRole,
        maxUses: uses,
        expiresAt: expiresAt,
        createdAt: nowIso()
      });
      await batch.commit();
    } catch (batchError: any) {
      console.warn("Firestore Admin batch commit failed (likely missing IAM service account in Cloud Run sandbox):", batchError.message);
      // Fallback: persist via Firestore REST API with the caller's verified ID token
      const authHeader = req.headers.authorization;
      if (authHeader) {
        try {
          const restUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/teamInvites?documentId=${encodeURIComponent(token)}`;
          const fields: Record<string, any> = {
            id: { stringValue: token },
            token: { stringValue: token },
            hospitalId: { stringValue: callerHospitalId },
            hospitalName: { stringValue: callerHospitalName },
            role: { stringValue: targetRole },
            maxUses: { integerValue: uses },
            usedCount: { integerValue: 0 },
            revoked: { booleanValue: false },
            expiresAt: { stringValue: expiresAt },
            createdAt: { stringValue: nowIso() },
            createdByUid: { stringValue: uid },
            createdByPlatformAdmin: { booleanValue: isAdmin }
          };
          if (invitedEmail) {
            fields.invitedEmail = { stringValue: String(invitedEmail).trim().toLowerCase() };
          }
          const restRes = await fetch(restUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader
            },
            body: JSON.stringify({ fields })
          });
          if (!restRes.ok) {
            const errJson = await restRes.json().catch(() => ({}));
            console.warn("Firestore REST fallback write failed:", errJson);
            throw new Error(errJson.error?.message || "Failed to persist invite via REST");
          }
        } catch (restErr: any) {
          console.warn("REST fallback error:", restErr.message);
          throw batchError;
        }
      } else {
        throw batchError;
      }
    }

    return res.json({
      success: true,
      token,
      expiresAt,
      role: targetRole,
      hospitalName: callerHospitalName
    });
  } catch (error: any) {
    console.error("Error creating invite:", error);
    return res.status(400).json({ error: error.message || "Failed to create invite." });
  }
});

// ── POST /accept-invite ─────────────────────────────────────────────────────
router.post("/accept-invite", async (req: AuthRequest, res) => {
  try {
    const { token } = req.body || {};
    const uid = req.user!.uid;
    const userEmail = (req.user!.email || "").trim().toLowerCase();

    if (!token) return res.status(400).json({ error: "Invite token is required." });

    const inviteRef = db.collection("teamInvites").doc(token);
    const inviteSnap = await inviteRef.get();

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
      if (creator.status !== "active") {
        return res.status(400).json({ error: "Invite creator is not active." });
      }
      if (creator.membershipVerified !== true) {
        return res.status(400).json({ error: "Invite creator membership is not verified." });
      }
      if (!isExactHospitalAdminRole(creator.role)) {
        return res.status(400).json({ error: "Invite creator does not have verified HOD role." });
      }
      if (!creator.hospitalId || creator.hospitalId !== invite.hospitalId) {
        return res.status(400).json({ error: "Invite creator does not belong to the invited hospital." });
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
      /*
 * Re-check email restriction using the invitation
 * snapshot read inside this transaction.
 *
 * This prevents the pre-transaction validation
 * from being the only identity check.
 */
if (currentInv.invitedEmail) {
  const currentTargetEmail =
    String(currentInv.invitedEmail)
      .trim()
      .toLowerCase();

  if (req.user!.email_verified !== true) {
    throw new Error(
      "Please verify your email address before accepting this department invitation."
    );
  }

  if (currentTargetEmail !== userEmail) {
    throw new Error(
      "This invite is restricted to a different email address."
    );
  }
}
// Validate the role from the invite snapshot
// read inside this transaction.
const normalizedInviteRole =
  String(currentInv.role || "resident")
    .trim()
    .toLowerCase();

if (
  !INVITE_ALLOWED_ROLES.has(
    normalizedInviteRole
  )
) {
  throw new Error(
    "Invitation contains an invalid clinical role."
  );
}
if (
  isExactHospitalAdminRole(normalizedInviteRole) &&
  currentInv.createdByPlatformAdmin !== true
) {
  throw new Error(
    "HOD or leadership invitations may only be issued by the platform administrator."
  );
}
      const memberRef = db.collection("team_members").doc(uid);
      const userRef = db.collection("users").doc(uid);
      const existingMemberSnap = await tx.get(memberRef);

if (existingMemberSnap.exists) {
  const existingMember = existingMemberSnap.data()!;

  if (
    existingMember.status === "active" &&
    existingMember.membershipVerified === true
  ) {
    throw new Error(
      "You already have an active hospital membership. Leave your current team before accepting another invitation."
    );
  }

  const historyRef =
    memberRef.collection("history").doc();

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

      tx.set(memberRef, {
        id: uid,
        uid: uid,
        email: userEmail,
        name: req.user!.name || userEmail.split("@")[0],
   hospitalId: currentInv.hospitalId,
hospitalName: currentInv.hospitalName || "",
hospital: currentInv.hospitalName || "",
role: normalizedInviteRole,
        status: "active",
        membershipVerified: true,
        joinedAt: nowIso(),
        updatedAt: nowIso(),
        inviteToken: token,
        invitedByUid: currentInv.createdByUid || null
      });

      tx.set(
        userRef,
        {
          hospital: currentInv.hospitalName || "",
          hospitalId: currentInv.hospitalId,
          subscriptionTier: "Hospital Team Premium (Department Covered)"
        },
        { merge: true }
      );

      /*
       * Security audit:
       * Record successful invitation acceptance in the
       * SAME transaction as membership activation.
       *
       * Do not store the invitation token in the audit log.
       */
      const acceptanceAuditRef = db.collection("teamAuditLog").doc();

      tx.set(
        acceptanceAuditRef,
        {
          id: acceptanceAuditRef.id,
          eventType: "TEAM_INVITE_ACCEPTED",
          actorUid: uid,
          actorEmail: userEmail,
          actorType: "invited_user",
          hospitalId: currentInv.hospitalId,
          hospitalName: currentInv.hospitalName || "",
          targetUid: uid,
          targetEmail: userEmail,
          targetRole: normalizedInviteRole,
          invitedByUid: currentInv.createdByUid || null,
          inviteCreatedByPlatformAdmin: currentInv.createdByPlatformAdmin === true,
          membershipVerified: true,
          previousMembershipArchived: existingMemberSnap.exists,
          createdAt: nowIso()
        }
      );
    });

    return res.json({
      success: true,
      
    });
  } catch (error: any) {
    console.error("Error accepting invite:", error);
    return res.status(400).json({ error: error.message || "Failed to accept invite." });
  }
});

// ── POST /request-join ───────────────────────────────────────────────────────
router.post("/request-join", async (req: AuthRequest, res) => {
  try {
    const { hospitalId, hospitalName, role } = req.body || {};
    const uid = req.user!.uid;
    const email = (req.user!.email || "").trim().toLowerCase();
    const requestedHospitalId = String(hospitalId || "").trim();
    const requestedHospitalName = String(hospitalName || "").trim();
if (!requestedHospitalId) {
  return res.status(400).json({
    error: "Hospital ID is required."
  });
}

    const memberRef = db.collection("team_members").doc(uid);
   

    let safeRole = "resident";
    if (role) {
      const normRole = String(role).trim().toLowerCase();
     if (
  !isExactHospitalAdminRole(normRole) &&
  INVITE_ALLOWED_ROLES.has(normRole)
) {
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
        "You already have an active verified hospital membership."
      );
    }

    if (current.status === "pending_approval") {
      throw new Error(
        "A join request is already pending approval."
      );
    }

    /*
     * Preserve the previous canonical membership/request
     * before replacing it with a new join request.
     *
     * This keeps cancelled, rejected, inactive, or other
     * non-current states available for audit/history.
     */
    const historyRef =
      memberRef.collection("history").doc();

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
    name:
      req.user!.name ||
      email.split("@")[0],

    hospitalId: requestedHospitalId,
    hospitalName: requestedHospitalName,
    hospital: requestedHospitalName,

    role: safeRole,

    status: "pending_approval",
    requestProvenance:
      "authenticated_join_request",
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
            "Only active verified HODs can approve members."
          );
        }

        const caller =
          callerSnap.data()!;

        if (!isVerifiedHod(caller)) {
          throw new Error(
            "Only active verified HODs can approve members."
          );
        }

        if (
          !caller.hospitalId ||
          caller.hospitalId !== latestTarget.hospitalId
        ) {
          throw new Error(
            "Target member is not in your hospital."
          );
        }

        finalHospitalId =
          caller.hospitalId;

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

      const userRef =
        db.collection("users").doc(latestTarget.uid);

      tx.update(targetRef, {
        status: "active",
        membershipVerified: true,

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
          subscriptionTier:
            "Hospital Team Premium (Department Covered)"
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

    // HOD / leadership roles may only be assigned
    // by the configured platform administrator.
    if (
      isExactHospitalAdminRole(normalizedRole) &&
      !isAdmin
    ) {
      return res.status(403).json({
        error:
          "Only the platform administrator can assign an HOD or leadership role."
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
        target.status !== "active" ||
        target.membershipVerified !== true
      ) {
        throw new Error(
          "Only active verified members can have their role changed."
        );
      }

      let caller: any = null;

      if (!isAdmin) {
        const callerRef =
          db.collection("team_members").doc(callerUid);

        const callerSnap = await tx.get(callerRef);

        if (!callerSnap.exists) {
          throw new Error(
            "Only active verified HODs can change roles."
          );
        }

        caller = callerSnap.data()!;

        if (!isVerifiedHod(caller)) {
          throw new Error(
            "Only active verified HODs can change roles."
          );
        }

        if (
          !caller.hospitalId ||
          caller.hospitalId !== target.hospitalId
        ) {
          throw new Error(
            "Target member is not in your hospital."
          );
        }
      }

      const previousRole =
        String(target.role || "").trim().toLowerCase();

      if (previousRole === normalizedRole) {
        throw new Error(
          "Member already has this role."
        );
      }

      // Never leave a hospital without an active verified HOD.
      if (
        isVerifiedHod(target) &&
        !isExactHospitalAdminRole(normalizedRole)
      ) {
        const hodsSnap = await tx.get(
          db
            .collection("team_members")
            .where("hospitalId", "==", target.hospitalId)
        );

        const otherHods = hodsSnap.docs.filter(
          (docSnap) =>
            docSnap.id !== targetRef.id &&
            isVerifiedHod(docSnap.data())
        );

        if (otherHods.length === 0) {
          throw new Error(
            "Cannot change the role of the only active verified HOD. Assign another HOD first."
          );
        }
      }

      tx.update(targetRef, {
        role: normalizedRole,
        updatedAt: nowIso()
      });

      tx.set(
        userRef,
        {
          role: normalizedRole
        },
        { merge: true }
      );

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
        return res.status(403).json({ error: "Only active verified HODs can decline members." });
      }
      const caller = callerSnap.data()!;
      if (!isVerifiedHod(caller)) {
        return res.status(403).json({ error: "Only active verified HODs can decline members." });
      }
      if (caller.hospitalId !== target.hospitalId) {
        return res.status(403).json({ error: "Target member is not in your hospital." });
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
       * /remove-member is for an existing active,
       * verified team member.
       *
       * Pending join requests must use
       * /decline-member instead.
       */
      if (
        target.status !== "active" ||
        target.membershipVerified !== true
      ) {
        throw new Error(
          "Only active verified members can be removed."
        );
      }

      if (!isAdmin) {
        const callerRef =
          db.collection("team_members").doc(callerUid);

        const callerSnap =
          await tx.get(callerRef);

        if (!callerSnap.exists) {
          throw new Error(
            "Only active verified HODs can remove members."
          );
        }

        const caller =
          callerSnap.data()!;

        if (!isVerifiedHod(caller)) {
          throw new Error(
            "Only active verified HODs can remove members."
          );
        }

        if (
          !caller.hospitalId ||
          caller.hospitalId !== target.hospitalId
        ) {
          throw new Error(
            "Target member is not in your hospital."
          );
        }
      }

      /*
       * Never leave a hospital without
       * an active verified HOD.
       */
      if (isVerifiedHod(target)) {
        const hodsSnap =
          await tx.get(
            db
              .collection("team_members")
              .where(
                "hospitalId",
                "==",
                target.hospitalId
              )
          );

        const otherHods =
          hodsSnap.docs.filter(
            (docSnap) =>
              docSnap.id !== targetUid &&
              isVerifiedHod(docSnap.data())
          );

        if (otherHods.length === 0) {
          throw new Error(
            "Cannot remove the only active verified HOD of this hospital. Assign another HOD first."
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
if (
  me.status !== "active" ||
  me.membershipVerified !== true
) {
  throw new Error(
    "No active verified membership to leave."
  );
}
      if (isExactHospitalAdminRole(me.role)) {
       if (!isVerifiedHod(me)) {
          throw new Error("Only an active verified HOD can leave a leadership role.");
        }

        const hodsSnap = await tx.get(
          db.collection("team_members").where("hospitalId", "==", me.hospitalId)
        );
        const otherHods = hodsSnap.docs.filter((d) => d.id !== uid && isVerifiedHod(d.data()));
        if (otherHods.length === 0) {
          throw new Error("Cannot leave department: You are the sole active verified HOD for this hospital. Please assign another HOD first.");
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

// ── POST /create-team (Create Hospital Workspace) ───────────────────────────
// OPTION 1: Transition from Individual -> Team workspace.
// Establishes canonical team_members/{uid} with verified trusted status.
const handleCreateTeam = async (req: AuthRequest, res: any) => {
  try {
    const uid = req.user!.uid;
    const userEmail = (req.user!.email || "").trim().toLowerCase();
    const { hospitalName, hospitalId: explicitHospitalId, department } = req.body || {};

    const rawHospitalName = String(hospitalName || "").trim();
    if (!rawHospitalName || rawHospitalName.length < 2) {
      return res.status(400).json({ error: "A valid hospital name (at least 2 characters) is required." });
    }

    const resolvedHospitalId = (
      String(explicitHospitalId || "").trim() ||
      rawHospitalName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32)
    ).trim();

    if (!resolvedHospitalId) {
      return res.status(400).json({ error: "Could not resolve a valid hospital identifier." });
    }

    const memberRef = db.collection("team_members").doc(uid);
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const existingSnap = await tx.get(memberRef);
      if (existingSnap.exists) {
        const existing = existingSnap.data()!;
        if (existing.status === "active" && existing.membershipVerified === true) {
          throw new Error("You already have an active hospital membership. Leave your current team before creating a new workspace.");
        }
      }

      const now = nowIso();
      const assignedRole = "HOD / Department Lead";

      tx.set(memberRef, {
        id: uid,
        uid: uid,
        email: userEmail,
        name: req.user!.name || userEmail.split("@")[0],
        hospitalId: resolvedHospitalId,
        hospitalName: rawHospitalName,
        hospital: rawHospitalName,
        role: assignedRole,
        department: department ? String(department).trim() : "Emergency Medicine",
        status: "active",
        membershipVerified: true,
        verifiedAt: now,
        verifiedBy: uid,
        joinedAt: now,
        updatedAt: now,
        requestProvenance: "create_hospital_workspace",
        shift: "Active"
      });

      tx.set(userRef, {
        hospital: rawHospitalName,
        hospitalId: resolvedHospitalId,
        hospitalName: rawHospitalName,
        role: assignedRole,
        subscriptionTier: "Hospital Team Premium (Department Covered)",
        updatedAt: now
      }, { merge: true });

      const auditRef = db.collection("teamAuditLog").doc();
      tx.set(auditRef, {
        action: "create_hospital_workspace",
        actorUid: uid,
        actorEmail: userEmail,
        actorRole: assignedRole,
        hospitalId: resolvedHospitalId,
        hospitalName: rawHospitalName,
        timestamp: now
      });
    });

    return res.status(200).json({
      success: true,
      message: "Hospital workspace created successfully.",
      hospitalId: resolvedHospitalId,
      hospitalName: rawHospitalName,
      role: "HOD / Department Lead"
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "Failed to create hospital workspace." });
  }
};

router.post("/create-team", handleCreateTeam);
router.post("/create-workspace", handleCreateTeam);

export default router;
