const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace cases query
content = content.replace(
  /const casesQuery = collection\(db, "cases"\);/,
  `const casesQuery = userHospital ? query(collection(db, "cases"), where("hospital", "==", userHospital)) : (profile.email ? query(collection(db, "cases"), where("doctorEmail", "==", profile.email)) : collection(db, "cases"));`
);

// Replace handovers query
content = content.replace(
  /const handoversQuery = collection\(db, "handovers"\);/,
  `const handoversQuery = userHospital ? query(collection(db, "handovers"), where("hospital", "==", userHospital)) : (profile.email ? query(collection(db, "handovers"), where("doctorEmail", "==", profile.email)) : collection(db, "handovers"));`
);

// Replace quick_paste_patients query
content = content.replace(
  /const quickPasteQuery = collection\(db, "quick_paste_patients"\);/,
  `const quickPasteQuery = userHospital ? query(collection(db, "quick_paste_patients"), where("hospital", "==", userHospital)) : (profile.email ? query(collection(db, "quick_paste_patients"), where("createdByEmail", "==", profile.email)) : collection(db, "quick_paste_patients"));`
);

// Replace team_members query
content = content.replace(
  /const teamQuery = collection\(db, "team_members"\);/,
  `const teamQuery = userHospital ? query(collection(db, "team_members"), where("hospital", "==", userHospital)) : collection(db, "team_members");`
);

// Replace contributions query
content = content.replace(
  /const contributionsQuery = collection\(db, "contributions"\);/,
  `const contributionsQuery = userHospital ? query(collection(db, "contributions"), where("hospital", "==", userHospital)) : collection(db, "contributions");`
);

fs.writeFileSync('src/App.tsx', content);
