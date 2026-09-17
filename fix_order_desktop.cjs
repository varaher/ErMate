const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regexDesktopCards = /\{\/\* Card 1: New Patient Intake \*\/\}[\s\S]*?\{\/\* Card 6: iPhone Pocket Mirror \*\/\}/;

const desktopMatch = code.match(regexDesktopCards);

if (desktopMatch) {
  let cardsStr = desktopMatch[0];
  
  const c1Match = cardsStr.match(/\{\/\* Card 1: New Patient Intake \*\/\}[\s\S]*?<\/div>\n\n/);
  const c3Match = cardsStr.match(/\{\/\* Card 3: Voice Scribe Desk \*\/\}[\s\S]*?<\/div>\n\n/);
  const c4Match = cardsStr.match(/\{\/\* Card 4: Shift Handover \*\/\}[\s\S]*?<\/div>\n\n/);
  
  const newCardsStr = 
    c3Match[0] +
    c1Match[0] +
    c4Match[0] +
    "{/* Card 6: iPhone Pocket Mirror */}";
    
  code = code.replace(regexDesktopCards, newCardsStr);
  fs.writeFileSync('src/components/DashboardView.tsx', code);
  console.log("Desktop cards reordered successfully.");
} else {
  console.log("Desktop cards block not found");
}

