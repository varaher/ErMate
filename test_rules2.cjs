const fs = require('fs');
const { execSync } = require('child_process');

try {
  let output = execSync('npx firebase deploy --dry-run --only firestore:rules', { encoding: 'utf-8', stdio: 'pipe' });
  console.log("COMPILE PASS");
} catch(err) {
  console.log("COMPILE FAIL");
  console.log(err.stderr || err.stdout);
}
