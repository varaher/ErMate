const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the else block for existing users
const oldBlock = `          } else {
            currentProfile = profileSnap.data() as UserProfile;
            // For existing profiles, check if they have a pending team invite that wasn't incorporated yet
            const emailClean = (user.email || "").trim().toLowerCase();
            const memberId = \`mem-\${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}\`;
            const memberDocRef = doc(db, "team_members", memberId);
            const memberSnap = await getDoc(memberDocRef);
            if (memberSnap.exists()) {`;

const newBlock = `          } else {
            currentProfile = profileSnap.data() as UserProfile;
            
            // Unblock UI immediately for existing users!
            setProfile(currentProfile);
            setIsLoggedIn(true);
            setAuthLoading(false);

            // For existing profiles, check if they have a pending team invite that wasn't incorporated yet
            const emailClean = (user.email || "").trim().toLowerCase();
            const memberId = \`mem-\${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}\`;
            const memberDocRef = doc(db, "team_members", memberId);
            getDoc(memberDocRef).then(async (memberSnap) => {
            if (memberSnap.exists()) {`;

content = content.replace(oldBlock, newBlock);

// We need to close the .then() block at the end of the if (memberSnap.exists()) { ... }
const oldEndBlock = `                });
              }
            }
          }
          setProfile(currentProfile);
          setIsLoggedIn(true);
        } catch (err) {`;

const newEndBlock = `                });
              }
            }
            }).catch(e => console.warn("Background invite check failed:", e));
          }
          setProfile(currentProfile);
          setIsLoggedIn(true);
          setAuthLoading(false); // Make sure it's unblocked for new users as well
        } catch (err) {`;

content = content.replace(oldEndBlock, newEndBlock);

fs.writeFileSync('src/App.tsx', content);
