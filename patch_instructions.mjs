import fs from 'fs';

let content = fs.readFileSync('src/components/DischargeSummaryView.tsx', 'utf8');

// Replace 1: Add patientInstructions to UI edit form
const target1 = `                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Follow-Up advice & emergency criteria</label>
                  <textarea
                    rows={3}
                    value={followUpPlan}
                    onChange={(e) => setFollowUpPlan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>`;
const replacement1 = `                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">Follow-Up advice & emergency criteria</label>
                  <textarea
                    rows={2}
                    value={followUpPlan}
                    onChange={(e) => setFollowUpPlan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase text-[9px]">General Instructions / Safe-Return Warnings</label>
                  <textarea
                    rows={2}
                    value={patientInstructions}
                    onChange={(e) => setPatientInstructions(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-lg leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>`;

content = content.replace(target1, replacement1);

// Replace 2: Add patientInstructions to print sheet
const target2 = `  <div className="font-bold mt-4">Follow-Up Advice:</div>
  <div>{followUpPlan}</div>

  <div className="mt-8 flex gap-8">`;
const replacement2 = `  <div className="font-bold mt-4">Follow-Up Advice:</div>
  <div>{followUpPlan}</div>

  <div className="font-bold mt-4">General Instructions:</div>
  <div>{patientInstructions}</div>

  <div className="mt-8 flex gap-8">`;

content = content.replace(target2, replacement2);

// Replace 3: Add patientInstructions to markdown generator (Markdown/Word)
const target3 = `**FOLLOW-UP PLAN & SAFE-RETURN WARNINGS:**
--------------------------------------------------
\${followUpPlan || "None recorded"}

**ATTENDING CLINICIANS:**`;
const replacement3 = `**FOLLOW-UP PLAN:**
--------------------------------------------------
\${followUpPlan || "None recorded"}

**GENERAL INSTRUCTIONS & SAFE-RETURN WARNINGS:**
--------------------------------------------------
\${patientInstructions || "Emergency warnings: return immediately if you experience breathing difficulty, high fever, chest tightness or severe pain."}

**ATTENDING CLINICIANS:**`;

content = content.replace(target3, replacement3);

// Replace 4: Add patientInstructions to HTML generator
const target4 = `<strong>FOLLOW-UP PLAN & SAFE-RETURN WARNINGS:</strong>
<hr/>
\${followUpPlan || "None recorded"}<br/>
<br/>
<strong>ATTENDING CLINICIANS:</strong>`;
const replacement4 = `<strong>FOLLOW-UP PLAN:</strong>
<hr/>
\${followUpPlan || "None recorded"}<br/>
<br/>
<strong>GENERAL INSTRUCTIONS & SAFE-RETURN WARNINGS:</strong>
<hr/>
\${patientInstructions || "Emergency warnings: return immediately if you experience breathing difficulty, high fever, chest tightness or severe pain."}<br/>
<br/>
<strong>ATTENDING CLINICIANS:</strong>`;

content = content.replace(target4, replacement4);

fs.writeFileSync('src/components/DischargeSummaryView.tsx', content);
