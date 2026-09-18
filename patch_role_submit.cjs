const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const old_regex = /const handleRoleSelectionSubmit = async \(\) => {[\s\S]*?triggerNotification\([\s\S]*?\);\s*\} catch \(err[^}]*\}\s*\};\s*}/g;

const start_idx = content.indexOf('const handleRoleSelectionSubmit');
const end_idx = content.indexOf('};', content.indexOf('triggerNotification', start_idx)) + 2;

const new_func = `const handleRoleSelectionSubmit = async () => {
    if (!auth.currentUser || !initialHospital) return;
    try {
      const activeInviteToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ermate_pending_invite_token") : "";
      
      if (activeInviteToken) {
        const idToken = await auth.currentUser.getIdToken();
        const res = await fetch("/api/team/accept-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": \`Bearer \${idToken}\`
          },
          body: JSON.stringify({ token: activeInviteToken })
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to accept invite");
        }
        
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("ermate_pending_invite_token");
        }
        
        setProfile(prev => ({ ...prev, hospital: initialHospital, subscriptionTier: "Hospital Team Premium (Department Covered)" }));
        setShowRoleSelectionModal(false);
        triggerNotification("Joined Department", \`Successfully joined \${initialHospital}.\`, "success");
      } else {
        throw new Error("You must have a valid invitation link to join a department.");
      }
    } catch (err: any) {
      console.error("Error updating hospital affiliation:", err);
      alert(err.message || "Failed to update affiliation. Please try again.");
    }
  }`;

// I'll replace it manually with slice
if (start_idx > -1) {
  // Let's find the closing brace of the catch block
  const catch_idx = content.indexOf('catch', start_idx);
  const closing_brace_idx = content.indexOf('};', catch_idx);
  content = content.slice(0, start_idx) + new_func + content.slice(closing_brace_idx + 2);
  fs.writeFileSync('src/App.tsx', content);
}

