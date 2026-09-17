const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

// GCS Grid
const gcsGridOld = `<div className="grid grid-cols-3 gap-3">`;
const gcsGridNew = `<div className="grid grid-cols-3 gap-2 md:gap-3">`;
code = code.replace(gcsGridOld, gcsGridNew);

// Pupils Grid
const pupilGridOld = `<div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">`;
const pupilGridNew = `<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-2 md:mb-3">`;
code = code.replace(pupilGridOld, pupilGridNew);

// GRBS Grid
const grbsGridOld = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">`;
const grbsGridNew = `<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">`;
code = code.replace(grbsGridOld, grbsGridNew);

// Seizure - spans 2 on mobile if needed, or we just let it take 1 of 2. Wait, GRBS and Seizure and Posturing.
// Let's make Seizure take col-span-2 on mobile.
const szOld = `<QuickSelect
            label="Seizure Activity"`;
const szNew = `<div className="col-span-2 sm:col-span-1"><QuickSelect
            label="Seizure Activity"`;
const szOldEnd = `onChange={(v) => onChange("disability.seizure", v)}
          />`;
const szNewEnd = `onChange={(v) => onChange("disability.seizure", v)}
          /></div>`;
if (code.includes(szOld)) {
  code = code.replace(szOld, szNew);
  code = code.replace(szOldEnd, szNewEnd);
}

// Exposure grid 1
const expGrid1Old = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">`;
const expGrid1New = `<div className="grid grid-cols-2 sm:grid-cols-2 gap-2 md:gap-3 mb-2 md:mb-3">`;
code = code.replace(expGrid1Old, expGrid1New);

// Hypothermia prevention
const hypoOld = `<QuickSelect
            label="Hypothermia Prevention"`;
const hypoNew = `<div className="col-span-2 sm:col-span-1"><QuickSelect
            label="Hypothermia Prevention"`;
const hypoOldEnd = `onChange={(v) => onChange("exposure.hypothermia", v)}
          />`;
const hypoNewEnd = `onChange={(v) => onChange("exposure.hypothermia", v)}
          /></div>`;
if (code.includes(hypoOld)) {
  code = code.replace(hypoOld, hypoNew);
  code = code.replace(hypoOldEnd, hypoNewEnd);
}

// Exposure grid 2
const expGrid2Old = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">`;
const expGrid2New = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">`;
code = code.replace(expGrid2Old, expGrid2New);

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Updated disability and exposure");
