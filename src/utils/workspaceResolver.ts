import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export interface WorkspaceOwnership {
  workspaceType: "individual" | "hospital";
  ownerUid: string | null;
  hospitalId: string | null;
}

export class WorkspaceResolutionError extends Error {
  code: string;
  isWorkspaceResolutionError: true;

  constructor(message: string, code: string = "WORKSPACE_RESOLUTION_FAILED") {
    super(message);
    this.name = "WorkspaceResolutionError";
    this.code = code;
    this.isWorkspaceResolutionError = true;
    Object.setPrototypeOf(this, WorkspaceResolutionError.prototype);
  }
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
 * - CRITICAL FAIL-CLOSED SAFETY RULE:
 *   If Firestore read fails due to network, permissions, offline, or transient error,
 *   DO NOT assume Individual workspace. Throw WorkspaceResolutionError to prevent
 *   silent downgrade of a verified Team clinician into a personal workspace.
 */
export async function resolveWorkspaceForUser(uid: string): Promise<WorkspaceOwnership> {
  if (!uid) {
    throw new WorkspaceResolutionError("Cannot resolve workspace without authenticated UID.", "MISSING_UID");
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
        // Institutional Verification (Option A):
        // Unverified teams must NOT save real patient records in a shared hospital workspace.
        // Individual clinical use continues under Individual workspace permissions.
        const isUnverified = data.verificationStatus === "unverified" || data.isInstitutionallyVerified === false;
        if (isUnverified) {
          return {
            workspaceType: "individual",
            ownerUid: uid,
            hospitalId: null
          };
        }

        const rawHospitalId = data.hospitalId || data.hospital;
        const hospitalId = typeof rawHospitalId === "string" ? rawHospitalId.trim() : "";
        
        if (!hospitalId) {
          throw new WorkspaceResolutionError(
            "Active membership is missing hospital ID. Cannot safely create hospital case.",
            "MALFORMED_MEMBERSHIP"
          );
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

    // Successful read completed: No active, verified canonical membership found -> Individual workspace
    return {
      workspaceType: "individual",
      ownerUid: uid,
      hospitalId: null
    };

  } catch (error: any) {
    // If it's already our WorkspaceResolutionError, rethrow directly
    if (error instanceof WorkspaceResolutionError || error.isWorkspaceResolutionError) {
      throw error;
    }
    
    // Fail-closed on all unexpected Firestore, network, permission, or offline read errors
    console.error("[WorkspaceResolver] Fail-closed: unable to read team_members to verify workspace:", error);
    throw new WorkspaceResolutionError(
      "Unable to verify your workspace right now. Please retry.",
      error?.code || "STORAGE_READ_ERROR"
    );
  }
}
