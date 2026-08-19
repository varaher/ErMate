const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf-8').split('\n');

const brokenIndex = lines.findIndex(l => l.includes('console.warn("Offline or error checking profile/invites, using fallback profile:", err);'));

if (brokenIndex !== -1) {
    // Insert '} catch (err) {' right above it
    lines.splice(brokenIndex, 0, '        } catch (err) {');
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
