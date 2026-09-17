const fs = require('fs');
let code = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

const o2Old = `<TextInput
            label="O₂ Delivery"`;
const o2New = `<div className="col-span-2 sm:col-span-1"><TextInput
            label="O₂ Delivery"`;

const o2OldEnd = `onChange={(v) => onChange("breathing.o2Delivery", v)}
          />`;
const o2NewEnd = `onChange={(v) => onChange("breathing.o2Delivery", v)}
          /></div>`;

if(code.includes(o2Old)) {
    code = code.replace(o2Old, o2New);
    code = code.replace(o2OldEnd, o2NewEnd);
}

const rhythmOld = `<QuickSelect
            label="Rhythm"`;
const rhythmNew = `<div className="col-span-2 sm:col-span-1"><QuickSelect
            label="Rhythm"`;

const rhythmOldEnd = `onChange={(v) => onChange("circulation.rhythm", v.toLowerCase())}
          />`;
const rhythmNewEnd = `onChange={(v) => onChange("circulation.rhythm", v.toLowerCase())}
          /></div>`;

if(code.includes(rhythmOld)) {
    code = code.replace(rhythmOld, rhythmNew);
    code = code.replace(rhythmOldEnd, rhythmNewEnd);
}

fs.writeFileSync('src/components/PrimarySurveySection.tsx', code);
console.log("Updated cols");
