import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";

export interface TeamInvite {
  id: string; // Unique token string
  hospital: string;
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

export async function createTeamInvite(
  hospital: string,
  hodUid: string,
  hodName: string,
  maxUses: number = 10
): Promise<{ token: string; link: string }> {
  const token = generateInviteToken();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://ermate.hospital";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const invite: TeamInvite = {
    id: token,
    hospital: hospital.trim(),
    createdByUid: hodUid || "system-hod",
    createdByName: hodName || "HOD / Department Lead",
    createdAt: now.toISOString(),
    expiresAt,
    maxUses,
    usedCount: 0,
    revoked: false,
  };

  try {
    await setDoc(doc(db, "teamInvites", token), invite);
  } catch (err) {
    console.warn("Failed to save team invite document to Firestore:", err);
  }

  const link = `${origin}/join/${token}`;
  return { token, link };
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
      // Legacy fallback support for previously shared hospital name slugs
      if (cleanToken.length >= 3) {
        const rawHospitalName = cleanToken
          .replace(/-er-invite$/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, l => l.toUpperCase());
        return { valid: true, hospital: rawHospitalName };
      }
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
    // Graceful fallback if network fails
    const fallbackName = cleanToken.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    return { valid: true, hospital: fallbackName };
  }
}

export async function incrementInviteUsage(token: string): Promise<void> {
  if (!token) return;
  try {
    const inviteRef = doc(db, "teamInvites", token.trim());
    await updateDoc(inviteRef, {
      usedCount: increment(1)
    });
  } catch (err) {
    console.warn("Could not increment invite usage count:", err);
  }
}
