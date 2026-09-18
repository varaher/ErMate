const fs = require('fs');

let content = fs.readFileSync('server/routes/team.routes.ts', 'utf8');

const old_remove = `router.post("/remove-member", async (req: AuthRequest, res) => {
  try {
    const { targetUid } = req.body;
    const uid = req.user!.uid;

    if (!targetUid) return res.status(400).json({ error: "targetUid required" });

    await db.runTransaction(async (tx) => {
      const callerRef = db.collection("team_members").doc(uid);
      const callerSnap = await tx.get(callerRef);
      
      if (!callerSnap.exists || callerSnap.data()!.status !== "active" || callerSnap.data()!.role !== "hod") {
        throw new Error("Unauthorized. Only active HODs can remove members.");
      }
      const callerHospitalId = callerSnap.data()!.hospitalId;

      const targetRef = db.collection("team_members").doc(targetUid);
      const targetSnap = await tx.get(targetRef);

      if (!targetSnap.exists || targetSnap.data()!.hospitalId !== callerHospitalId) {
        throw new Error("Target member is not in your hospital.");
      }

      tx.update(targetRef, {
        status: "inactive",
        updatedAt: new Date().toISOString(),
        removedAt: new Date().toISOString(),
        removedByUid: uid
      });

      const targetUserRef = db.collection("users").doc(targetUid);
      tx.update(targetUserRef, {
        hospital: "",
        subscriptionTier: "Free Standard"
      });
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error removing member:", error);
    res.status(400).json({ error: error.message || "Failed to remove member." });
  }
});`;

const new_remove = `router.post("/remove-member", async (req: AuthRequest, res) => {
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
});`;

content = content.replace(old_remove, new_remove);

const old_leave = `router.post("/leave", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email?.toLowerCase();`;

const old_leave_full = `router.post("/leave", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;

    await db.runTransaction(async (tx) => {
      const memRef = db.collection("team_members").doc(uid);
      const memSnap = await tx.get(memRef);

      if (!memSnap.exists || memSnap.data()!.status !== "active") {
        throw new Error("No active membership to leave.");
      }

      if (memSnap.data()!.role === "hod") {
        // Safe HOD leave policy - reject if they are HOD, require admin re-assignment.
        // Or if we want to allow, we'd need to check if other HODs exist. For now, deny to be safe.
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
});`;

const new_leave_full = `router.post("/leave", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email?.toLowerCase() || "";
    const legacyMemId = \`mem-\${email.replace(/[^a-zA-Z0-9]/g, "-")}\`;

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
});`;

content = content.replace(old_leave_full, new_leave_full);

fs.writeFileSync('server/routes/team.routes.ts', content);
