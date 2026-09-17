const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');
if (code.includes('navContainerRef.current')) {
  console.log("Scroll logic present");
} else {
  console.log("Scroll logic missing");
}
if (code.includes('Next: {labels[nextId]}')) {
  console.log("Footer present");
} else {
  console.log("Footer missing");
}
