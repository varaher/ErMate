const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const old_add = /const handleAddTeamMember = async \([\s\S]*?throw err;\s*\}/g;

const start_idx = content.indexOf('const handleAddTeamMember = async');
const end_idx = content.indexOf('};', content.indexOf('throw err;', start_idx)) + 2;

const new_add = `const handleAddTeamMember = async (name: string, email: string, role: string, shift: string) => {
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const idToken = await auth.currentUser.getIdToken();
      
      const res = await fetch("/api/team/create-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${idToken}\`
        },
        body: JSON.stringify({ invitedEmail: email, role, maxUses: 1 })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate invite");
      }
      
      const data = await res.json();
      const origin = typeof window !== "undefined" ? window.location.origin : "https://ermate.hospital";
      const link = \`\${origin}/join/\${data.token}\`;
      
      triggerNotification("Invite Generated", \`Secure invite link created for \${email}. Please share this link: \${link}\`, "success");
      // Could auto-copy to clipboard here
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link).catch(() => {});
      }
    } catch (err: any) {
      console.error("Error creating invite:", err);
      alert(err.message || "Failed to create invite.");
    }
  }`;

if (start_idx > -1) {
  content = content.slice(0, start_idx) + new_add + content.slice(end_idx);
  fs.writeFileSync('src/App.tsx', content);
}
