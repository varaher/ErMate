const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// The exact string to match
const oldStr = `          } else {
            currentProfile = profileSnap.data() as UserProfile;
            // For existing profiles, check if they have a pending team invite that wasn't incorporated yet
            const emailClean = (user.email || "").trim().toLowerCase();
            const memberId = \`mem-\${emailClean.replace(/[^a-zA-Z0-9]/g, "-")}\`;
            const memberDocRef = doc(db, "team_members", memberId);
            const memberSnap = await getDoc(memberDocRef);
            if (memberSnap.exists()) {
              const mData = memberSnap.data();`;

const newStr = `          } else {
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
            if (memberSnap.exists()) {
              const mData = memberSnap.data();`;

content = content.replace(oldStr, newStr);

const oldStrEnd = `                });
              }
            }
          }
          setProfile(currentProfile);
          setIsLoggedIn(true);
        } catch (err) {`;

const newStrEnd = `                });
              }
            }
            }).catch(e => console.warn("Background invite check failed:", e));
          }
          setProfile(currentProfile);
          setIsLoggedIn(true);
          setAuthLoading(false); // unblock new users
        } catch (err) {`;

content = content.replace(oldStrEnd, newStrEnd);

fs.writeFileSync('src/App.tsx', content);
