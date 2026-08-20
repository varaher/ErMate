const fs = require('fs');
const file = 'src/components/CaseSheetView.tsx';
let content = fs.readFileSync(file, 'utf8');

// The block we want to replace starts around `<h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">\n                    Chief Complaints & Patient Demographics\n                  </h3>`
// and ends right before the "Presenting Chief Complaint" textarea

content = content.replace(
  /Chief Complaints & Patient Demographics/g,
  "Chief Complaints"
);

content = content.replace(
  /Review and edit primary patient demographics and presenting complaints./g,
  "Review and edit presenting complaints."
);

fs.writeFileSync(file, content);
