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

export async function createTeamInvite(
  hospital: string,
  hodUid: string,
  hodName: string,
  facility: { hospitalAddress?: string; hospitalPhone?: string; state?: string } = {},
  maxUses: number = 10
): Promise<{ token: string; link: string }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://ermate.hospital";
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
    const inviteRef = doc(db, "teamInvites", cleanToken);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      // No fallback. An invite must exist in Firestore to be valid.
      // If truly old pre-migration links need support, backfill real
      // teamInvites documents for those known slugs instead of trusting
      // arbitrary client input here.
      return { valid: false, error: "Invalid or expired invitation link." };
    }

    const invite = inviteSnap.data() as TeamInvite;

    if (invite.revoked) {
      return { valid: false, error: "This department invitation link has been revoked." };
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return { valid: false, error: "This department invitation link has expired." };
    }

    if (invite.usedCount >= invite.maxUses) {
      return { valid: false, error: "This department invitation link has reached its maximum usage limit." };
    }

    return { valid: true, hospital: invite.hospital, invite };
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
