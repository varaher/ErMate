import { Router } from "express";
import { requireAuth, AuthRequest } from "../../src/middleware/auth.js";
import { db } from "../../src/lib/firebase-admin.js";

const router = Router();

router.post("/sync-case", requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const { caseId } = req.body;
    const uid = req.user?.uid;
    
    if (!caseId || !uid) {
      return res.status(400).json({ error: "caseId and uid are required" });
    }

    const caseRef = db.collection("cases").doc(caseId);
    const caseSnap = await caseRef.get();

    if (!caseSnap.exists) {
      return res.status(404).json({ error: "Case not found" });
    }

    const caseData = caseSnap.data() as any;

    // 12. BACKEND CASE ACCESS CHECK
    let allowed = false;
    if (caseData.workspaceType === "individual") {
      if (caseData.ownerUid === uid) {
        allowed = true;
      }
    } else if (caseData.workspaceType === "hospital") {
      const memberSnap = await db.collection("team_members").doc(uid).get();
      if (memberSnap.exists) {
        const memberData = memberSnap.data();
        if (memberData?.status === "active" && (memberData.hospitalId === caseData.hospitalId || memberData.hospital === caseData.hospitalId || memberData.hospital === caseData.hospital)) {
           allowed = true;
        }
      }
    } else if (!caseData.workspaceType) {
        // legacy case fallback - if we allow it in Phase 3A for sync? The instruction said:
        // "DO NOT loop through historical cases. Legacy backfill is Phase 3B."
        // But if someone edits a legacy case, it might come here. 
        // We'll just allow it if they are the doctorEmail matching this user.
    }

    if (!allowed) {
      // Actually, check legacy case fallback logic
      const userSnap = await db.collection("users").doc(uid).get();
      const userEmail = userSnap.data()?.email;
      
      if (!caseData.workspaceType && userEmail && caseData.doctorEmail?.toLowerCase() === userEmail.toLowerCase()) {
         allowed = true;
      }

      if (!allowed) {
         return res.status(403).json({ error: "Unauthorized access to source case" });
      }
    }

    // 13. WHOSE LOGBOOK GETS THE CASE?
    // Auto-sync a hospital case to a user's Log Book ONLY if that user is the
    // appropriately attributed doctor according to the existing intended Log Book semantics.
    const userSnap = await db.collection("users").doc(uid).get();
    const userEmail = userSnap.data()?.email?.toLowerCase()?.trim();
    
    let isAttributedDoctor = false;
    if (caseData.createdByUid === uid) {
      isAttributedDoctor = true;
    } else if (!caseData.createdByUid && caseData.doctorEmail && userEmail && caseData.doctorEmail.toLowerCase().trim() === userEmail) {
      isAttributedDoctor = true;
    }

    if (!isAttributedDoctor) {
      return res.status(200).json({ status: "ignored", reason: "Case not attributed to this doctor's personal log book." });
    }

    // Extract Allowlisted fields ONLY (Rule 4, 5, 6, 7, 8)
    const entryId = `${uid}_${caseId}`;
    
    // Procedures (allowlisted)
    let proceduresPerformed: string[] = [];
    if (Array.isArray(caseData.proceduresChecked)) {
      proceduresPerformed = [...caseData.proceduresChecked];
    }
    
    const now = new Date().toISOString();
    
    const snapshot = {
      entryId,
      ownerUid: uid,
      sourceCaseId: caseId,
      sourceType: caseData.workspaceType || "hospital", // default to hospital if unknown
      hospitalIdAtTime: caseData.hospitalId || caseData.hospital || null,
      hospitalNameAtTime: caseData.hospitalName || caseData.hospital || null,
      roleAtTime: null, // we can get from team_members if needed
      // Extract just the date
      dateSeen: (() => {
        const potentialDates = [caseData.dateSeen, caseData.createdAt, caseData.arrivalDateTime];
        for (const pd of potentialDates) {
           if (typeof pd === 'string') {
             if (/^\d{4}-\d{2}-\d{2}$/.test(pd)) {
               return pd;
             }
             if (pd.includes('T')) {
               const datePart = pd.split('T')[0];
               if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                 return datePart;
               }
             }
           }
        }
        return "unknown"; 
      })(),
      ageGroup: (() => {
        if (caseData.patient?.age != null && caseData.patient?.age !== "") {
          const ageStr = String(caseData.patient.age).toLowerCase();
          if (ageStr.includes('month') || ageStr.includes('day') || ageStr.includes('week') || ageStr.includes('hr') || ageStr.includes('hour')) {
            return "pediatric";
          }
          const age = parseInt(ageStr, 10);
          if (!isNaN(age)) {
            return age <= 16 ? "pediatric" : "adult";
          }
        }
        return "unknown";
      })(),
      gender: caseData.patient?.gender || null,
      triageCategory: caseData.vitals?.triageCategory || null,
      caseCategory: caseData.triageCategory || null, // Might be stored elsewhere
      proceduresPerformed,
      // skills: [], // user edited
      // learningPoints: "", // user edited
      updatedAt: now
    };
    
    const logbookRef = db.collection(`users/${uid}/logbook`).doc(entryId);
    const existingSnap = await logbookRef.get();
    
    if (!existingSnap.exists) {
      await logbookRef.set({
        ...snapshot,
        createdAt: now
      });
    } else {
      await logbookRef.update(snapshot);
    }
    
    res.json({ status: "success", entryId });
  } catch (error: any) {
    console.error("Logbook sync error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
