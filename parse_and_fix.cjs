const fs = require('fs');

let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

// The mobile section
let mobileStart = code.indexOf('{/* Mobile Minimalist Action Pad (Visible on Mobile only) */}');
let mobileEnd = code.indexOf('{/* Desktop Detailed Grid (Visible on Desktop only) */}');

let mobileCode = code.slice(mobileStart, mobileEnd);

// Extract the 6 cards in mobile
const mCardNewPat = mobileCode.match(/\{\/\* Card 1: New Patient Intake \*\/\}[\s\S]*?<\/button>/)[0];
const mCardPeds = mobileCode.match(/\{\/\* Card 2: Pediatric Dosing \(Mobile\) \*\/\}[\s\S]*?<\/button>/)[0];
const mCardScribe = mobileCode.match(/\{\/\* Card 3: Voice Scribe Desk \*\/\}[\s\S]*?<\/button>/)[0];
const mCardHandover = mobileCode.match(/\{\/\* Card 4: Shift Handover \*\/\}[\s\S]*?<\/button>/)[0];
const mCardMirror = mobileCode.match(/\{\/\* Card 5: iPhone Pocket Mirror \*\/\}[\s\S]*?<\/button>/)[0];
const mCardDrugs = mobileCode.match(/\{\/\* Card 6: EM Drugs & Procedures \(Mobile\) \*\/\}[\s\S]*?<\/button>/)[0];

const newMobileCode = `{/* Mobile Minimalist Action Pad (Visible on Mobile only) */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          ${mCardScribe}
          ${mCardNewPat}
          ${mCardHandover}
          ${mCardPeds}
          ${mCardMirror}
          ${mCardDrugs}
        </div>\n\n        `;

// The desktop section
let desktopStart = code.indexOf('{/* Desktop Detailed Grid (Visible on Desktop only) */}');
let desktopEnd = code.indexOf('{/* 2. Stats Cards Row */}');

let desktopCode = code.slice(desktopStart, desktopEnd);

// Extract the cards in desktop
const dCardNewPat = desktopCode.match(/\{\/\* Card 1: New Patient Intake \*\/\}[\s\S]*?<\/div>\s*<\/div>/)[0];
const dCardScribe = desktopCode.match(/\{\/\* Card 3: Voice Scribe Desk \*\/\}[\s\S]*?<\/div>\s*<\/div>/)[0];
const dCardHandover = desktopCode.match(/\{\/\* Card 4: Shift Handover \*\/\}[\s\S]*?<\/div>\s*<\/div>/)[0];
const dCardMirror = desktopCode.match(/\{\/\* Card 6: iPhone Pocket Mirror \*\/\}[\s\S]*?<\/div>\s*<\/div>/)[0];
const dCardDrugs = desktopCode.match(/\{\/\* Card 7: EM Drugs & Procedures \(Desktop\) \*\/\}[\s\S]*?<\/div>\s*<\/div>/)[0];

const newDesktopCode = `{/* Desktop Detailed Grid (Visible on Desktop only) */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${dCardScribe}
          ${dCardNewPat}
          ${dCardHandover}
          ${dCardMirror}
          ${dCardDrugs}
        </div>
      </div>

      `;

let newCode = code.slice(0, mobileStart) + newMobileCode + newDesktopCode + code.slice(desktopEnd);
fs.writeFileSync('src/components/DashboardView.tsx', newCode);
console.log("Success replacing cards via precise javascript logic.");
