const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const interpretABGRoute = `
// ABG Interpretation
app.post("/api/interpret-abg", async (req, res) => {
  const { abgValues, patientContext } = req.body;
  try {
    const interpretation = await interpretABG(abgValues, patientContext);
    res.json({ success: true, interpretation });
  } catch (error) {
    console.error("ABG interpretation error:", error);
    res.status(500).json({ error: error.message || "Failed to interpret ABG" });
  }
});

`;

const cdsRoute = `
// 1. AI Clinical Decision Support (CDS) / Differential Diagnosis (Locked to Claude Sonnet)
app.post("/api/clinical-decision-support", async (req, res) => {
  const { patient, history, vitals, primaryAssessment } = req.body;
  const prompt = \`
    You are an Emergency Medicine expert Clinical Decision Support assistant (Claude Sonnet).
    Analyze the following patient data and generate a JSON array of 3-5 potential differential diagnoses.
    Label each as "CONSISTENT", "POSSIBLE", or "LESS LIKELY".
    Provide brief medical reasoning, citations (e.g. PubMed, WikEM, PALS/ATLS guidelines), and suggested next steps (investigations/treatment).
    
    Patient Demographics & Complaint:
    - Name: \${patient?.name || "Unknown"}
    - Age: \${patient?.age || "Unknown"} years
    - Gender: \${patient?.gender || "Unknown"}
    - Presenting Complaint: \${patient?.presentingComplaint || "Not specified"}
    - Triage Category: \${patient?.triageCategory || "Not specified"}
    
    Vitals:
    - BP: \${vitals?.bp || "Not recorded"}
    - HR: \${vitals?.hr || "Not recorded"} bpm
    - SpO2: \${vitals?.spo2 || "Not recorded"}%
    - RR: \${vitals?.rr || "Not recorded"} /min
    - Temp: \${vitals?.temp || "Not recorded"}°C
    - GCS: \${vitals?.gcs || "Not recorded"}
    
    History (SAMPLE):
    - Signs & Symptoms: \${history?.symptoms || "Not recorded"}
    - Allergies: \${history?.allergies || "Not recorded"}
    - Medications: \${history?.medications || "Not recorded"}
    - Past History: \${history?.pastHistory || "Not recorded"}
    
    Primary Assessment (ABCDE):
    - Airway: \${primaryAssessment?.airway || "Not recorded"}
    - Breathing: \${primaryAssessment?.breathing || "Not recorded"}
    - Circulation: \${primaryAssessment?.circulation || "Not recorded"}
    - Disability: \${primaryAssessment?.disability || "Not recorded"}
    - Exposure: \${primaryAssessment?.exposure || "Not recorded"}
    
    Return ONLY a valid JSON array of objects with keys: "diagnosis", "status", "reasoning", "citations" (array of strings), "nextSteps" (array of strings).
  \`;
  
  try {
    const sysInstruction = "You are a clinical decision support system for emergency room physicians. Return strictly valid JSON array.";
    const claudeResult = await callClaudeSonnetOnly(prompt, sysInstruction, true);
    if (claudeResult && Array.isArray(claudeResult) && claudeResult.length > 0) {
      return res.json({ success: true, data: claudeResult, model: "claude-sonnet-4-6" });
    }
    
    return res.json({ success: false, error: "Clinical assistant busy — try again in a moment", reply: "Clinical assistant busy — try again in a moment" });
  } catch (error) {
    console.error("[Clinical Reasoning] CDS Error:", error?.message || error);
    return res.json({ success: false, error: "Clinical assistant busy — try again in a moment", reply: "Clinical assistant busy — try again in a moment" });
  }
});

`;

const targetAnchor = 'app.post("/api/lens-report", async (req, res) => {';
if (code.includes(targetAnchor)) {
  code = code.replace(targetAnchor, interpretABGRoute + cdsRoute + targetAnchor);
  fs.writeFileSync('server.ts', code);
  console.log("Restored routes successfully!");
} else {
  console.log("Could not find anchor.");
}
