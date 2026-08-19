import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const target1 = `app.post("/api/ai-discharge", async (req, res) => {
  const { caseData } = req.body;`;

const replacement1 = `app.post("/api/ai-discharge", async (req, res) => {
  const { caseData, profileState, hospitalName } = req.body;`;

content = content.replace(target1, replacement1);

const target2 = `    8. dischargeNarrative: A simplified plain language summary.
    9. patientAdvice: Warning advice on when to return to the ER.
  \`;`;

const replacement2 = `    8. dischargeNarrative: A simplified plain language summary.
    9. patientInstructions: General Instructions & Warning advice on when to return to the ER. If the hospital state is provided (\${profileState || "Unknown"}), include relevant local state health helpline numbers (e.g., 1056 for Kerala, 104 for general health helpline) and language localization for instructions. Make sure instructions reflect standard medical guidelines. Include the hospital name (\${hospitalName || "Emergency Department"}) in the instructions where relevant.
    10. patientAdvice: Warning advice on when to return to the ER.
  \`;`;

content = content.replace(target2, replacement2);

fs.writeFileSync('server.ts', content);
