const fs = require('fs');
let file = fs.readFileSync('src/components/PrimarySurveySection.tsx', 'utf8');

file = file.replace(/function AccordionItem/g, 'export function AccordionItem');
file = file.replace(/function DropdownSelect/g, 'export function DropdownSelect');
file = file.replace(/function VitalInput/g, 'export function VitalInput');
file = file.replace(/function NotesArea/g, 'export function NotesArea');
file = file.replace(/function MultiSelect/g, 'export function MultiSelect');

fs.writeFileSync('src/components/PrimarySurveySection.tsx', file);
