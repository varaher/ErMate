import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";

export interface TeamInvite {
  id: string; // Unique token string
  hospital: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  state?: string;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string; // ISO date string (6 hours)
  maxUses: number;
  usedCount: number;
  revoked: boolean;
}

export function generateInviteToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "inv_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


import { auth } from "../firebase";
import { getPublicAppUrl } from "../utils/publicUrl";

export interface CreateTeamInviteParams {
  hospitalId?: string;
  hospitalName?: string;
  invitedEmail?: string;
  role?: string;
  maxUses?: number;
  expiresHours?: number;
}

export async function createTeamInvite(
  paramsOrHospital?: CreateTeamInviteParams | string,
  hodUid?: string,
  hodName?: string,
  facility: { hospitalAddress?: string; hospitalPhone?: string; state?: string } = {},
  maxUses: number = 10
): Promise<{ token: string; link: string }> {
  const origin = getPublicAppUrl();
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  let params: CreateTeamInviteParams = {};
  if (typeof paramsOrHospital === "object" && paramsOrHospital !== null) {
    params = paramsOrHospital;
  } else if (typeof paramsOrHospital === "string") {
    params = {
      hospitalName: paramsOrHospital,
      maxUses: maxUses
    };
  }

  const userEmail = (user.email || "").trim().toLowerCase();
  const isPlatformAdmin = userEmail === "varahgrp@gmail.com";

  if (isPlatformAdmin) {
    if (!params.hospitalId || !params.hospitalName) {
      // Defensively attempt canonical resolution from team_members/{uid} or users/{uid}
      try {
        const memberSnap = await getDoc(doc(db, "team_members", user.uid));
        if (memberSnap.exists()) {
          const mData = memberSnap.data() as any;
          if (mData.hospitalId) params.hospitalId = String(mData.hospitalId).trim();
          if (mData.hospitalName || mData.hospital) params.hospitalName = String(mData.hospitalName || mData.hospital).trim();
        }
        if (!params.hospitalId || !params.hospitalName) {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (userSnap.exists()) {
            const uData = userSnap.data() as any;
            if (uData.hospitalId) params.hospitalId = String(uData.hospitalId).trim();
            if (uData.hospitalName || uData.hospital) params.hospitalName = String(uData.hospitalName || uData.hospital).trim();
          }
        }
      } catch (e) {
        // resolution failed, check below
      }

      if (!params.hospitalId || !params.hospitalName) {
        throw new Error("Platform admin invites require a valid hospital workspace.");
      }
    }
  }

  const idToken = await user.getIdToken();

  const body: any = {
    maxUses: typeof params.maxUses === "number" && params.maxUses > 0 ? params.maxUses : 10,
    role: params.role || "resident"
  };

  if (params.hospitalId) body.hospitalId = params.hospitalId;
  if (params.hospitalName) body.hospitalName = params.hospitalName;
  if (params.invitedEmail) body.invitedEmail = params.invitedEmail;
  body.expiresHours = 6; // Requirement A.5 & G.4: Invitation link valid for exactly six hours

  const res = await fetch("/api/team/create-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to create invitation link.");
  }

  const link = `${origin}/join/${data.token}`;
  return { token: data.token, link };
}

export async function validateTeamInvite(
  token: string
): Promise<{ valid: boolean; hospital?: string; invite?: TeamInvite; error?: string }> {
  if (!token || !token.trim()) {
    return { valid: false, error: "Missing invitation token." };
  }

  const cleanToken = token.trim();

  try {
    const res = await fetch(`/api/team/invite-preview/${encodeURIComponent(cleanToken)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { valid: false, error: errData.error || "Invalid or expired invitation link." };
    }

    const data = await res.json();
    return {
      valid: true,
      hospital: data.hospitalName,
      invite: {
        id: cleanToken,
        hospital: data.hospitalName,
        hospitalName: data.hospitalName,
        role: data.role,
        expiresAt: data.expiresAt
      } as any
    };
  } catch (err: any) {
    console.warn("Error validating team invite:", err);
    // Fail closed, not open. A read error is never proof of a valid invite.
    return { valid: false, error: "Could not validate invitation link. Please try again or request a new link." };
  }
}

export async function incrementInviteUsage(token: string): Promise<void> {
  // Deprecated: invite consumption is now handled atomically by the backend accept-invite API
  return;
}

/**
 * OPTION 1: Transitions an authenticated user from Individual -> Team workspace
 * by creating a new hospital team workspace.
 */
export async function createHospitalWorkspace(
  hospitalName: string,
  department?: string,
  erPhysicalBedCapacity?: number | null,
  teamName?: string,
  professionalRole?: string
): Promise<{ success: boolean; teamId: string; hospitalId: string; hospitalName: string; teamName: string; role: string; isTeamAdmin: boolean; verificationStatus: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const payload: any = {
    hospitalName,
    department,
    teamName: teamName || hospitalName
  };
  if (typeof erPhysicalBedCapacity === "number" && erPhysicalBedCapacity > 0) {
    payload.erPhysicalBedCapacity = erPhysicalBedCapacity;
  }
  if (professionalRole) {
    payload.professionalRole = professionalRole;
  }

  const res = await fetch("/api/team/create-team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to create hospital workspace.");
  }

  return data;
}

export const createTeamWorkspace = createHospitalWorkspace;

/**
 * Fetches the caller's team workspace details, members, and pending requests from trusted backend.
 */
export async function getMyTeam(): Promise<{
  hasTeam: boolean;
  team?: any;
  members?: any[];
  pendingRequests?: any[];
  isTeamAdmin?: boolean;
  myRole?: string;
  verificationStatus?: string;
  pendingRequest?: any;
}> {
  const user = auth.currentUser;
  if (!user) return { hasTeam: false };
  try {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/team/my-team", {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!res.ok) return { hasTeam: false };
    return await res.json();
  } catch (e) {
    return { hasTeam: false };
  }
}

/**
 * Updates team workspace display configuration.
 */
export async function updateTeamWorkspace(
  teamId: string,
  updates: { teamName?: string; hospitalName?: string; department?: string; erPhysicalBedCapacity?: number }
): Promise<{ success: boolean; message: string; team?: any }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/team/update-team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ teamId, ...updates })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to update team settings.");
  }
  return data;
}

/**
 * Platform Admin action (varahgrp@gmail.com): Institutionally verifies a team.
 */
export async function verifyTeamInstitution(
  teamId: string,
  verify: boolean = true
): Promise<{ success: boolean; message: string; verificationStatus: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/team/verify-team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ teamId, verify })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to verify team.");
  }
  return data;
}

/**
 * Submits an authenticated join request to a team using an invite token.
 * Never activates membership automatically; awaits Team Admin approval.
 */
export async function requestToJoinTeam(
  token: string,
  role?: string
): Promise<{ success: boolean; message: string; status: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const cleanToken = token.trim().replace(/^.*\/join\//, "");

  const res = await fetch("/api/team/request-join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      token: cleanToken,
      role
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to submit join request.");
  }

  return data;
}

/**
 * OPTION 2: Transitions an authenticated user from Individual -> Team workspace
 * by submitting a join request for admin approval.
 */
export async function acceptSecureTeamInvite(
  token: string
): Promise<{ success: boolean; message: string; hospitalId: string; hospitalName: string; role: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const cleanToken = token.trim().replace(/^.*\/join\//, "");

  const res = await fetch("/api/team/accept-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      token: cleanToken
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to accept team invitation.");
  }

  return data;
}

/**
 * Team Admin action: Approve a pending membership request and assign professional role.
 */
export async function approveTeamMember(
  memberId: string,
  role?: string,
  isTeamAdmin?: boolean
): Promise<{ success: boolean; message: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/team/approve-member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      memberId,
      role,
      isTeamAdmin
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to approve member.");
  }

  return data;
}

/**
 * Team Admin action: Decline a pending membership request.
 */
export async function declineTeamMember(memberId: string): Promise<{ success: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/team/decline-member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ memberId })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to decline member.");
  }

  return data;
}

/**
 * Team Admin action: Remove an existing team member.
 */
export async function removeTeamMember(memberId: string): Promise<{ success: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/team/remove-member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ memberId })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to remove member.");
  }

  return data;
}

/**
 * Team Admin action: Appoint or revoke Team Admin status for a member.
 */
export async function setTeamAdminRole(
  memberId: string,
  isTeamAdmin: boolean
): Promise<{ success: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/team/set-team-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ memberId, isTeamAdmin })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to update admin role.");
  }

  return data;
}

/**
 * Team Admin action: Revoke an active team invite link.
 */
export async function revokeTeamInvite(token: string): Promise<{ success: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/team/revoke-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ token })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to revoke invitation.");
  }

  return data;
}

/**
 * Team Admin action: Regenerate the active team invite link (revoking the prior one and issuing a new 7-day token).
 */
export async function regenerateTeamInvite(
  hospitalId?: string,
  role?: string,
  expiresHours?: number
): Promise<{ success: boolean; token: string; link: string; expiresAt: string; message: string }> {
  const origin = getPublicAppUrl();
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/team/regenerate-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      hospitalId,
      role: role || "resident",
      expiresHours: 6 // Requirement A.5 & G.4: Six-hour expiry
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to regenerate invitation link.");
  }

  const link = `${origin}/join/${data.token}`;
  return { ...data, link };
}

/**
 * Team Admin or HOD action: Appoint or revoke a team member as Rota Manager.
 */
export async function setTeamRotaManagerRole(
  memberId: string,
  isRotaManager: boolean
): Promise<{ success: boolean; isRotaManager: boolean; message: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/team/set-rota-manager", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ memberId, isRotaManager })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to update Rota Manager role.");
  }

  return data;
}
