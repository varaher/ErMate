import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export interface WorkspaceOwnership {
  workspaceType: "individual" | "hospital";
  ownerUid: string | null;
  hospitalId: string | null;
}

/**
 * Resolves the authoritative workspace ownership metadata for a user.
 * Validates the user's trusted canonical team_members document.
 * 
 * CORE PRODUCT INVARIANT:
 * - If active AND verified membership -> hospital workspace
 * - If inactive, unverified, or no membership -> individual workspace
 * - Selecting professional role (HOD/Consultant/Resident) or profile hospital
 *   does NOT create hospital/team membership.
 */
export async function resolveWorkspaceForUser(uid: string): Promise<WorkspaceOwnership> {
  if (!uid) {
    throw new Error("Cannot resolve workspace without authenticated UID.");
  }

  try {
    const memberRef = doc(db, "team_members", uid);
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      const data = memberSnap.data();
      const status = String(data.status || "").toLowerCase().trim();
      const isActive = status === "active" || status === "active (joined)";
      const isVerified = data.membershipVerified === true;
      
      if (isActive && isVerified) {
        const rawHospitalId = data.hospitalId || data.hospital;
        const hospitalId = typeof rawHospitalId === "string" ? rawHospitalId.trim() : "";
        
        if (!hospitalId) {
          throw new Error("Active membership is missing hospital ID. Cannot safely create hospital case.");
        }

        const validRoles = ["hod", "consultant", "resident"];
        if (!data.role || !validRoles.includes(String(data.role).toLowerCase())) {
          console.warn(`[Administrative Warning] User ${uid} has active membership for ${hospitalId} but role '${data.role}' is malformed or missing.`);
        }

        return {
          workspaceType: "hospital",
          ownerUid: null,
          hospitalId: hospitalId
        };
      }
    }

    // No active, verified canonical membership found -> default to Individual workspace
    return {
      workspaceType: "individual",
      ownerUid: uid,
      hospitalId: null
    };

  } catch (error: any) {
    console.error("Error resolving workspace ownership:", error);
    // If it's our malformed error, rethrow
    if (error.message?.includes("missing hospital ID")) {
      throw error;
    }
    
    // For network/permission errors, fail-safe to individual workspace so clinical tools continue working
    return {
      workspaceType: "individual",
      ownerUid: uid,
      hospitalId: null
    };
  }
}
