import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export interface WorkspaceOwnership {
  workspaceType: "individual" | "hospital";
  ownerUid: string | null;
  hospitalId: string | null;
}

/**
 * Resolves the authoritative workspace ownership metadata for a new case.
 * Validates the user's trusted team_members document.
 * 
 * If active membership -> hospital workspace
 * If inactive/no membership -> individual workspace
 * If malformed active membership -> throws error
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
      
      if (data.status === "active") {
        const hospitalId = data.hospitalId || data.hospital; // Check both for safety during migration
        
        if (!hospitalId || hospitalId.trim() === "") {
          throw new Error("Active membership is missing hospital ID. Cannot safely create hospital case.");
        }

        const validRoles = ["hod", "consultant", "resident"];
        if (!data.role || !validRoles.includes(data.role.toLowerCase())) {
          console.warn(`[Administrative Warning] User ${uid} has active membership for ${hospitalId} but role '${data.role}' is malformed or missing.`);
        }

        return {
          workspaceType: "hospital",
          ownerUid: null,
          hospitalId: hospitalId
        };
      }
    }

    // No active membership found
    return {
      workspaceType: "individual",
      ownerUid: uid,
      hospitalId: null
    };

  } catch (error: any) {
    console.error("Error resolving workspace ownership:", error);
    // If it's our malformed error, rethrow
    if (error.message.includes("missing hospital ID")) {
      throw error;
    }
    
    // For network/permission errors, fail safe rather than misclassifying
    throw new Error("Failed to verify membership status for workspace selection.");
  }
}
