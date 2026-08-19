const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newRoute = `
// ==========================================
// ROTA EXTRATION FROM SPREADSHEET
// ==========================================
app.post("/api/parse-rota", async (req, res) => {
  try {
    const { csvData, monthYear } = req.body;
    if (!csvData) return res.status(400).json({ error: "Missing spreadsheet data" });

    const ai = getAI();
    const prompt = \`
      You are an expert hospital administrator and scheduling AI.
      Below is a raw CSV/text dump of a doctor's shift Rota for the ER department for \${monthYear || "this month"}.
      
      Extract all the assigned shifts for every doctor.
      For each shift, identify:
      - shiftDate: The date of the shift (ISO format YYYY-MM-DD if possible, or just exact date text)
      - doctorName: Name of the assigned doctor
      - doctorEmail: Try to infer email if present, or leave empty
      - shiftType: e.g. "Morning", "Evening", "Night"
      - startTime: e.g. "08:00 AM" or "2024-08-11T08:00:00" (try to parse into a valid time string if you can)
      - endTime: e.g. "04:00 PM"
      
      Return a JSON array of these shift objects under a 'shifts' key.
      Ensure it is purely valid JSON without any markdown formatting.
      
      ROTA DATA:
      \${csvData.substring(0, 8000)}
    \`;
    
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = result.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // fallback cleanup
      const clean = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
      data = JSON.parse(clean);
    }
    
    return res.json({ success: true, shifts: data.shifts || [] });
  } catch (error) {
    console.error("Rota Parse Error:", error);
    return res.status(500).json({ success: false, error: "Failed to parse rota" });
  }
});
`;

if (!code.includes('/api/parse-rota')) {
  code = code.replace('app.post("/api/scan-mnemonic"', newRoute + '\napp.post("/api/scan-mnemonic"');
  fs.writeFileSync('server.ts', code);
  console.log("Added /api/parse-rota");
} else {
  console.log("Route already exists");
}
