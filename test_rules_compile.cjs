const fs = require('fs');
const { execSync } = require('child_process');

try {
  let output = execSync('npx firebase emulators:start --only firestore --project test-ermate', { encoding: 'utf-8', stdio: 'pipe' });
  console.log("COMPILE PASS");
} catch(err) {
  console.log("COMPILE FAIL");
}
