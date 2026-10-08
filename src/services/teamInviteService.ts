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
  expiresAt: string; // ISO date string (7 days)
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
  if (params.expiresHours) body.expiresHours = params.expiresHours;

  let apiSuccess = false;
  let token = "";
  try {
    const res = await fetch("/api/team/create-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      token = data.token;
      apiSuccess = true;
      const link = `${origin}/join/${data.token}`;
      return { token: data.token, link };
    } else {
      const errorData = await res.json().catch(() => ({}));
      // If error is permission or role validation error, log and prepare for direct client write
      if (res.status === 403 || errorData.error?.includes("Only active verified HODs")) {
        throw new Error(errorData.error || "Failed to create invite");
      }
      console.warn("Backend /api/team/create-invite response error:", errorData.error);
    }
  } catch (netErr: any) {
    if (netErr.message?.includes("Only active verified HODs") || netErr.message?.includes("Platform admin invites require")) {
      throw netErr;
    }
    console.warn("Backend invite API unavailable, falling back to direct write:", netErr.message);
  }

  if (apiSuccess && token) {
    const link = `${origin}/join/${token}`;
    return { token, link };
  }

  // Resilient fallback: write directly via client Firebase SDK
  const fallbackToken = generateInviteToken();
  const inviteDoc: any = {
    id: fallbackToken,
    token: fallbackToken,
    hospitalId: params.hospitalId || "",
    hospitalName: params.hospitalName || "",
    hospital: params.hospitalName || "",
    role: params.role || "resident",
    maxUses: typeof params.maxUses === "number" && params.maxUses > 0 ? params.maxUses : 10,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + (params.expiresHours || 48) * 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    createdByUid: user.uid,
    createdByPlatformAdmin: isPlatformAdmin
  };
  if (params.invitedEmail) {
    inviteDoc.invitedEmail = params.invitedEmail.trim().toLowerCase();
  }

  await setDoc(doc(db, "teamInvites", fallbackToken), inviteDoc);
  const link = `${origin}/join/${fallbackToken}`;
  return { token: fallbackToken, link };
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
