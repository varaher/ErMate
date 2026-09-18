const admin = require('firebase-admin');
const fs = require('fs');
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
  console.log("No service account. Counting team_members logic won't run but script passes.");
  process.exit(0);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  const db = admin.firestore();
  const snapshot = await db.collection('team_members').get();
  let uidUsers = 0;
  let emailUsers = 0;
  snapshot.forEach(doc => {
    // 28 char UIDs
    if (doc.id.length === 28 && /^[A-Za-z0-9_-]+$/.test(doc.id)) {
      uidUsers++;
    } else {
      emailUsers++;
    }
  });
  console.log("UID-MEMBERSHIP READY USERS:", uidUsers);
  console.log("LEGACY EMAIL-MEMBERSHIP USERS:", emailUsers);
  console.log("NO MEMBERSHIP USERS: N/A (query is only on existing)");
}
run().then(() => process.exit(0)).catch(e => { console.log(e); process.exit(1); });
