const fs = require('fs');

let content = fs.readFileSync('src/components/SignUpView.tsx', 'utf8');

const old_block = `        const newProfile: UserProfile = {
          name: formattedName,
          email: email.trim().toLowerCase(),
          role: "EM Resident", // Hardcoded - all public signups register as EM Resident
          hospital: hospital.trim(),
          state: stateName.trim(),
          hospitalAddress: hospitalAddress.trim(),
          aiCredits: credits,
          streak: 1, // new user streak starts at 1
          subscriptionTier: acceptOffer && initialHospital ? "Hospital Team Premium (Department Covered)" : subTier,
          age: parsedAge
        };

        // Write user profile to firestore
        await setDoc(doc(db, "users", user.uid), newProfile);

        // If registered via team invite token, increment usage
        const activeInviteToken = inviteToken || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ermate_pending_invite_token") : "");
        if (activeInviteToken) {
          await incrementInviteUsage(activeInviteToken);
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("ermate_pending_invite_token");
          }
        }

        // Auto-add or update team member registration
        if (acceptOffer && hospital.trim()) {
          const emailClean = email.trim().toLowerCase();
          const memberId = \`mem-\${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}\`;
          const memberDocRef = doc(db, "team_members", memberId);
          await setDoc(memberDocRef, {
            id: memberId,
            name: formattedName,
            email: emailClean,
            role: "EM Resident",
            status: "Active (Joined)",
            shift: "off",
            hospital: hospital.trim(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }`;

const new_block = `        const activeInviteToken = inviteToken || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ermate_pending_invite_token") : "");

        const newProfile: UserProfile = {
          name: formattedName,
          email: email.trim().toLowerCase(),
          role: "EM Resident", // Hardcoded - all public signups register as EM Resident
          hospital: activeInviteToken ? "" : hospital.trim(), // Use blank if invited, let backend populate it
          state: stateName.trim(),
          hospitalAddress: hospitalAddress.trim(),
          aiCredits: credits,
          streak: 1, // new user streak starts at 1
          subscriptionTier: activeInviteToken ? "Free Standard" : subTier,
          age: parsedAge
        };

        // Write user profile to firestore
        await setDoc(doc(db, "users", user.uid), newProfile);

        // Accept team invite securely via backend
        if (activeInviteToken) {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/team/accept-invite", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": \`Bearer \${idToken}\`
            },
            body: JSON.stringify({ token: activeInviteToken })
          });
          
          if (!res.ok) {
            console.error("Failed to accept invite on backend", await res.text());
          } else {
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.removeItem("ermate_pending_invite_token");
            }
            // Update local state to reflect what backend did
            newProfile.hospital = hospital.trim();
            newProfile.subscriptionTier = "Hospital Team Premium (Department Covered)";
          }
        } else if (acceptOffer && hospital.trim() && !activeInviteToken) {
          // Individual signing up manually claiming a team without invite (should be rare)
          // Do nothing special. team_members should not be written by client.
        }`;

content = content.replace(old_block, new_block);
fs.writeFileSync('src/components/SignUpView.tsx', content);
