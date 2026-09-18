const fs = require('fs');

let content = fs.readFileSync('src/services/teamInviteService.ts', 'utf8');

const old_create = `export async function createTeamInvite(
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

  const link = \`\${origin}/join/\${token}\`;
  return { token, link };
}`;

const new_create = `import { auth } from "../firebase";

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
      "Authorization": \`Bearer \${idToken}\`
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
  const link = \`\${origin}/join/\${data.token}\`;
  return { token: data.token, link };
}`;

content = content.replace(old_create, new_create);

const old_increment = `export async function incrementInviteUsage(token: string): Promise<void> {
  if (!token) return;
  try {
    const inviteRef = doc(db, "teamInvites", token.trim());
    await updateDoc(inviteRef, {
      usedCount: increment(1)
    });
  } catch (err) {
    console.warn("Could not increment invite usage count:", err);
  }
}`;

const new_increment = `export async function incrementInviteUsage(token: string): Promise<void> {
  // Deprecated: invite consumption is now handled atomically by the backend accept-invite API
  return;
}`;

content = content.replace(old_increment, new_increment);

fs.writeFileSync('src/services/teamInviteService.ts', content);
