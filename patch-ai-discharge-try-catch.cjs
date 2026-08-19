const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldStart = `app.post("/api/ai-discharge", async (req, res) => {
  const { caseData, profileState, hospitalName } = req.body;`;

const newStart = `app.post("/api/ai-discharge", async (req, res) => {
  try {
  const { caseData, profileState, hospitalName } = req.body;`;

const oldEnd = `  return res.json({ success: true, data: backupData, simulated: true });
});`;

const newEnd = `  return res.json({ success: true, data: backupData, simulated: true });
  } catch (err: any) {
    console.error("[ai-discharge] CRITICAL ERROR:", err);
    res.status(500).json({ success: false, error: err?.message || "Internal server error" });
  }
});`;

if (code.includes(oldStart) && code.includes(oldEnd)) {
  code = code.replace(oldStart, newStart).replace(oldEnd, newEnd);
  fs.writeFileSync('server.ts', code);
  console.log("Patched server.ts with top-level try-catch");
} else {
  console.log("Could not find targets");
}
