const fs = require('fs');

let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// Find the tabs array starting at `const tabs = [` or just the array inside `{[ ... ].map`
// It is around line 2870. Let's do a precise string replacement.

const oldTabsStr = `            {[
              { id: "complaints", label: "Chief Complaints", icon: ClipboardCheck },
              { id: "primary-survey", label: "Primary Survey", icon: Activity },
              { id: "history", label: "History (SAMPLE)", icon: Clock },
              { id: "secondary-survey", label: "Secondary Survey", icon: Eye },
              { id: "investigations", label: "Investigations", icon: FileCheck },
              { id: "treatment", label: "Treatment", icon: Heart },
              { id: "notes", label: "Notes", icon: FileText },
              { id: "disposition", label: "Disposition", icon: LogOut },
              ...(currentCase.isPediatric || (currentCase.patient.age !== null && currentCase.patient.age < 16) ? [{ id: "pediatrics-sheet", label: "Pediatrics Sheet", icon: Baby }] : []),
              { id: "trends", label: "Vitals Trends", icon: TrendingUp },
              { id: "rounds", label: "Rounds & Debrief", icon: BookOpen },
            ].map((tab) => {`;

const newTabsStr = `            {[
              ...(currentCase.isPediatric || (currentCase.patient.age !== null && currentCase.patient.age < 16) ? [{ id: "pediatrics-sheet", label: "Pediatrics Sheet", icon: Baby }] : []),
              { id: "complaints", label: "Chief Complaints", icon: ClipboardCheck },
              { id: "primary-survey", label: "Primary Survey", icon: Activity },
              { id: "history", label: "History (SAMPLE)", icon: Clock },
              { id: "secondary-survey", label: "Secondary Survey", icon: Eye },
              { id: "investigations", label: "Investigations", icon: FileCheck },
              { id: "treatment", label: "Treatment", icon: Heart },
              { id: "notes", label: "Notes", icon: FileText },
              { id: "disposition", label: "Disposition", icon: LogOut },
              { id: "trends", label: "Vitals Trends", icon: TrendingUp },
              { id: "rounds", label: "Rounds & Debrief", icon: BookOpen },
            ].map((tab) => {`;

if (content.includes(oldTabsStr)) {
  content = content.replace(oldTabsStr, newTabsStr);
  fs.writeFileSync('src/components/CaseSheetView.tsx', content, 'utf8');
  console.log("Successfully updated tabs order");
} else {
  console.log("Could not find the exact tabs string. Attempting alternative...");
  
  // Alternative regex if spacing is slightly different
  const altRegex = /\{\[\s*\{\s*id:\s*"complaints"[^\]]+\]\.map\(\(tab\)\s*=>\s*\{/s;
  const match = content.match(altRegex);
  if (match) {
    let block = match[0];
    // Remove the pediatrics line from its current position
    const pedsLine = `              ...(currentCase.isPediatric || (currentCase.patient.age !== null && currentCase.patient.age < 16) ? [{ id: "pediatrics-sheet", label: "Pediatrics Sheet", icon: Baby }] : []),\n`;
    block = block.replace(pedsLine, "");
    
    // Insert it at the top
    block = block.replace(/\{\[\s*/, `{[
${pedsLine}`);
    
    content = content.replace(match[0], block);
    fs.writeFileSync('src/components/CaseSheetView.tsx', content, 'utf8');
    console.log("Successfully updated tabs order (alternative)");
  } else {
    console.log("Could not find the tabs array.");
  }
}

