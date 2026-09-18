const fs = require('fs');

let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

if (!content.includes('import { collection, query, onSnapshot }')) {
  content = content.replace(
    'import { auth } from "../firebase";',
    'import { auth, db } from "../firebase";\nimport { collection, query, onSnapshot } from "firebase/firestore";'
  );
}
content = content.replace(
  'TriageCategory, TeamMember, ArrivalMode } from "../types";',
  'TriageCategory, TeamMember, ArrivalMode, LogbookEntry } from "../types";'
);

fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
