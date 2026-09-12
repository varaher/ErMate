import fs from "fs";
let content = fs.readFileSync("src/services/teamInviteService.ts", "utf8");
content = content.replace(
  /const invite: TeamInvite = \{[\s\S]*?revoked: false,\n  \};\n\n  await setDoc\(doc\(db, "teamInvites", token\), invite\);/,
  `const invite: any = {
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

  await setDoc(doc(db, "teamInvites", token), invite as TeamInvite);`
);
fs.writeFileSync("src/services/teamInviteService.ts", content);
