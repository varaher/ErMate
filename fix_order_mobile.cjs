const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regexMobileCards = /\{\/\* Card 1: New Patient Intake \*\/\}[\s\S]*?\{\/\* Card 5: iPhone Pocket Mirror \*\/\}/;

const mobileMatch = code.match(regexMobileCards);

if (mobileMatch) {
  let cardsStr = mobileMatch[0];
  
  const c1Match = cardsStr.match(/\{\/\* Card 1: New Patient Intake \*\/\}[\s\S]*?<\/button>\n/);
  const c2Match = cardsStr.match(/\{\/\* Card 2: Pediatric Dosing \(Mobile\) \*\/\}[\s\S]*?<\/button>\n/);
  const c3Match = cardsStr.match(/\{\/\* Card 3: Voice Scribe Desk \*\/\}[\s\S]*?<\/button>\n/);
  const c4Match = cardsStr.match(/\{\/\* Card 4: Shift Handover \*\/\}[\s\S]*?<\/button>\n/);
  
  const newCardsStr = 
    c3Match[0] + "\n" +
    c1Match[0] + "\n" +
    c4Match[0] + "\n" +
    c2Match[0] + "\n" +
    "{/* Card 5: iPhone Pocket Mirror */}";
    
  code = code.replace(regexMobileCards, newCardsStr);
  fs.writeFileSync('src/components/DashboardView.tsx', code);
  console.log("Mobile cards reordered successfully.");
} else {
  console.log("Mobile cards block not found");
}

