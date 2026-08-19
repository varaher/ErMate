const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf-8').split('\n');

const startIndex = lines.findIndex((l, i) => i > 600 && l.includes('currentProfile = profileSnap.data() as UserProfile;'));

if (startIndex !== -1) {
    lines.splice(startIndex + 1, 0, 
        '            // Unblock UI immediately for existing users!',
        '            setProfile(currentProfile);',
        '            setIsLoggedIn(true);',
        '            setAuthLoading(false);'
    );
}

const getDocIndex = lines.findIndex((l, i) => i > startIndex && l.includes('const memberSnap = await getDoc(memberDocRef);'));
if (getDocIndex !== -1) {
    lines[getDocIndex] = '            getDoc(memberDocRef).then(async (memberSnap) => {';
}

const endIndex = lines.findIndex((l, i) => i > getDocIndex && l.includes('          setProfile(currentProfile);'));
if (endIndex !== -1) {
    lines[endIndex - 1] = '            }).catch(e => console.warn("Background invite check failed:", e));';
    lines[endIndex + 2] = '          setAuthLoading(false);';
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
