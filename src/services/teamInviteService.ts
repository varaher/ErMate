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

export async function createTeamInvite(
  hospital: string,
  hodUid: string,
  hodName: string,
  facility: { hospitalAddress?: string; hospitalPhone?: string; state?: string } = {},
  maxUses: number = 10
): Promise<{ token: string; link: string }> {
  const origin = getPublicAppUrl();
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  
  const idToken = await user.getIdToken();
  
  const res = await fetch("/api/team/create-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      maxUses,
      role: "resident"
    })
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to create invite");
  }
  
  const data = await res.json();
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
