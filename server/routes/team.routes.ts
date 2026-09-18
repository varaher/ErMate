import { Router } from "express";
import { requireAuth, AuthRequest } from "../../src/middleware/auth.js";
import { db } from "../../src/lib/firebase-admin.js";
import { FieldValue } from "firebase-admin/firestore";

const router = Router();

router.use(requireAuth);

function generateInviteToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "inv_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

router.post("/create-invite", async (req: AuthRequest, res) => {
  try {
    const { maxUses, invitedEmail, role } = req.body;
    const uid = req.user!.uid;

    const callerMembershipSnap = await db.collection("team_members").doc(uid).get();
    
    if (!callerMembershipSnap.exists) {
      return res.status(403).json({ error: "No active membership found." });
    }
    
    const callerMembership = callerMembershipSnap.data()!;
    if (callerMembership.status !== "active" || callerMembership.role !== "hod") {
      return res.status(403).json({ error: "Only active HODs can create invites." });
    }

    const hospitalId = callerMembership.hospitalId;
    const hospitalName = callerMembership.hospitalName || hospitalId;

    const token = generateInviteToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invite = {
      id: token,
      hospitalId,
      hospitalName,
      createdByUid: uid,
      role: role || "resident",
      invitedEmail: invitedEmail ? invitedEmail.toLowerCase().trim() : null,
      createdAt: now.toISOString(),
      expiresAt,
      maxUses: maxUses || 10,
      usedCount: 0,
      revoked: false
    };

    await db.collection("teamInvites").doc(token).set(invite);

    res.json({ token, invite });
  } catch (error) {
    console.error("Error creating invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/accept-invite", async (req: AuthRequest, res) => {
  try {
    const { token } = req.body;
    const uid = req.user!.uid;
    const email = req.user!.email?.toLowerCase();

    if (!token) return res.status(400).json({ error: "Token required." });

    await db.runTransaction(async (tx) => {
      const inviteRef = db.collection("teamInvites").doc(token.trim());
      const inviteSnap = await tx.get(inviteRef);

      if (!inviteSnap.exists) {
        throw new Error("Invalid or expired invitation link.");
      }

      const invite = inviteSnap.data()!;
      if (invite.revoked) throw new Error("Invitation has been revoked.");
      if (new Date(invite.expiresAt).getTime() < Date.now()) throw new Error("Invitation has expired.");
      if (invite.usedCount >= invite.maxUses) throw new Error("Invitation limit reached.");
      if (invite.invitedEmail && invite.invitedEmail !== email) {
        throw new Error("Invitation is restricted to a different email address.");
      }

      // Verify creator HOD status
      const creatorRef = db.collection("team_members").doc(invite.createdByUid);
      const creatorSnap = await tx.get(creatorRef);
      if (!creatorSnap.exists || creatorSnap.data()!.status !== "active" || creatorSnap.data()!.role !== "hod") {
        throw new Error("The HOD who created this invite is no longer active.");
      }

      // Verify current membership
      const membershipRef = db.collection("team_members").doc(uid);
      const membershipSnap = await tx.get(membershipRef);
      if (membershipSnap.exists) {
        const mem = membershipSnap.data()!;
        if (mem.status === "active") {
          throw new Error(`You already have an active membership at ${mem.hospitalName || mem.hospitalId}. Leave your current team first.`);
        }
      }

      const newMembership = {
        uid,
        hospitalId: invite.hospitalId,
        hospitalName: invite.hospitalName,
        role: invite.role || "resident",
        status: "active",
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        invitedByUid: invite.createdByUid,
        inviteId: invite.id
      };

      tx.set(membershipRef, newMembership);
      tx.update(inviteRef, { usedCount: FieldValue.increment(1) });

      const userRef = db.collection("users").doc(uid);
      tx.update(userRef, {
        hospital: invite.hospitalId,
        subscriptionTier: "Hospital Team Premium (Department Covered)"
      });
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error accepting invite:", error);
    res.status(400).json({ error: error.message || "Could not accept invite." });
  }
});

router.post("/remove-member", async (req: AuthRequest, res) => {
  try {
    const { memberId } = req.body;
    const uid = req.user!.uid;

    if (!memberId) return res.status(400).json({ error: "memberId required" });

    // Step 1: Pre-query the user document if possible
    const targetDocSnap = await db.collection("team_members").doc(memberId).get();
    if (!targetDocSnap.exists) {
      return res.status(404).json({ error: "Member not found." });
    }
    const targetEmail = targetDocSnap.data()!.email;
    let targetUserRef = null;
    
    if (targetEmail) {
      const usersQuery = await db.collection("users").where("email", "==", targetEmail).limit(1).get();
      if (!usersQuery.empty) {
        targetUserRef = usersQuery.docs[0].ref;
      }
    } else {
      // If it's the new schema, memberId IS the targetUid
      targetUserRef = db.collection("users").doc(memberId);
    }

    await db.runTransaction(async (tx) => {
      const callerRef = db.collection("team_members").doc(uid);
      const callerSnap = await tx.get(callerRef);
      
      if (!callerSnap.exists || callerSnap.data()!.status !== "active" || callerSnap.data()!.role !== "hod") {
        throw new Error("Unauthorized. Only active HODs can remove members.");
      }
      
      // Fallback check for legacy hospital field matching
      const callerHospitalId = callerSnap.data()!.hospitalId || callerSnap.data()!.hospital;

      const targetRef = db.collection("team_members").doc(memberId);
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists) throw new Error("Target member not found in transaction.");
      
      const targetHospitalId = targetSnap.data()!.hospitalId || targetSnap.data()!.hospital;

      if (targetHospitalId !== callerHospitalId) {
        throw new Error("Target member is not in your hospital.");
      }

      tx.update(targetRef, {
        status: "inactive",
        updatedAt: new Date().toISOString(),
        removedAt: new Date().toISOString(),
        removedByUid: uid
      });

      if (targetUserRef) {
        tx.update(targetUserRef, {
          hospital: "",
          subscriptionTier: "Free Standard"
        });
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error removing member:", error);
    res.status(400).json({ error: error.message || "Failed to remove member." });
  }
});

router.post("/leave", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email?.toLowerCase() || "";
    const legacyMemId = `mem-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;

    await db.runTransaction(async (tx) => {
      let memRef = db.collection("team_members").doc(uid);
      let memSnap = await tx.get(memRef);

      if (!memSnap.exists) {
        // Fallback to legacy
        memRef = db.collection("team_members").doc(legacyMemId);
        memSnap = await tx.get(memRef);
      }

      // Allow leaving even if 'status' isn't explicitly 'active' in legacy records
      // Just check existence.
      if (!memSnap.exists) {
        throw new Error("No active membership to leave.");
      }
      
      const role = (memSnap.data()!.role || "").toLowerCase();
      if (role.includes("hod") || role.includes("lead")) {
        throw new Error("HOD cannot leave team directly. Please assign a new HOD or contact platform support first.");
      }

      tx.update(memRef, {
        status: "inactive",
        updatedAt: new Date().toISOString(),
        leftAt: new Date().toISOString(),
        reason: "voluntary"
      });

      const userRef = db.collection("users").doc(uid);
      tx.update(userRef, {
        hospital: "",
        subscriptionTier: "Free Standard"
      });
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error leaving team:", error);
    res.status(400).json({ error: error.message || "Failed to leave team." });
  }
});

export default router;
