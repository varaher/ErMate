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


export async function createTeamInvite(
  hospital: string,
  hodUid: string,
  hodName: string,
  facility: { hospitalAddress?: string; hospitalPhone?: string; state?: string } = {},
  maxUses: number = 10
): Promise<{ token: string; link: string }> {
  const token = generateInviteToken();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://ermate.hospital";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const invite: any = {
    id: token,
    hospital: hospital.trim(),
    createdByUid: hodUid,
    createdByName: hodName,
    createdAt: now.toISOString(),
    expiresAt,
    maxUses,
    usedCount: 0,
    revoked: false,
  };
  if (facility.hospitalAddress?.trim()) invite.hospitalAddress = facility.hospitalAddress.trim();
  if (facility.hospitalPhone?.trim()) invite.hospitalPhone = facility.hospitalPhone.trim();
  if (facility.state?.trim()) invite.state = facility.state.trim();

  await setDoc(doc(db, "teamInvites", token), invite as TeamInvite);

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
