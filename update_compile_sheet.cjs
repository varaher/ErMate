const fs = require('fs');

const fileContent = fs.readFileSync('server.ts', 'utf8');

const targetFunctionStart = fileContent.indexOf('app.post("/api/handover/compile-sheet"');
if (targetFunctionStart === -1) {
  console.error('Could not find start of function');
  process.exit(1);
}

// Find the end of the function. We will match until the next endpoint or EOF.
// The next endpoint is: "// 6.7. AI Clinical Mnemonic Scanner"
const targetFunctionEnd = fileContent.indexOf('// 6.7. AI Clinical Mnemonic Scanner', targetFunctionStart);
if (targetFunctionEnd === -1) {
  console.error('Could not find end of function');
  process.exit(1);
}

const replacement = `app.post("/api/handover/compile-sheet", async (req, res) => {
  const { patients } = req.body;
  if (!patients || !Array.isArray(patients) || patients.length === 0) {
    return res.status(400).json({ success: false, error: "No patient records provided." });
  }

  const processedPatients = patients.map((p: any) => {
    const raw = p.rawNotes || p.chronologicalNotes || "";
    let safeNotes = raw;
    if (raw && typeof raw === "string" && raw.trim().length > 0) {
      const clean = preprocessEMR(raw);
      const deidentified = deidentifyText(clean).deidentified;
      safeNotes = reverseEMREntries(deidentified);
    }
    return { ...p, rawNotes: safeNotes, chronologicalNotes: safeNotes };
  });

  const schema = {
    type: Type.OBJECT,
    properties: {
      rows: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            bed: { type: Type.STRING, description: "Bed or Room number" },
            name: { type: Type.STRING, description: "Patient name" },
            assessment: {
              type: Type.STRING,
              description: "The current working diagnosis or clinical impression, extracted from the MOST RECENT note. If no diagnosis or impression has been documented anywhere in the notes, return exactly: 'Not yet established'. Never return 'Under evaluation' if any diagnosis, differential, or impression exists in the text."
            },
            planDone: {
              type: Type.STRING,
              description: "Concrete completed actions only — meds given, labs drawn, imaging performed, procedures done. Max 3 bullet-style items, 1 line each. Use the most recent 24h of notes as priority."
            },
            planToBeDone: {
              type: Type.STRING,
              description: "Concrete pending/ordered-but-not-yet-done actions — pending labs, scheduled imaging, consults awaited, planned meds not yet given. Max 3 bullet-style items, 1 line each."
            },
            vitals: {
              type: Type.STRING,
              description: "The LATEST recorded vital signs only, in format 'BP x/x | HR x | SpO2 x% | RR x | Temp x'. If any individual value is missing from the notes, omit that value entirely rather than leaving a blank — do not output a label with no value."
            },
            alerts: {
              type: Type.STRING,
              description: "Only genuinely critical/actionable flags: pending critical labs, abnormal vitals, allergy warnings. Return empty string if none. Never fabricate an alert."
            }
          },
          required: ["id", "bed", "name", "assessment", "planDone", "planToBeDone", "vitals", "alerts"]
        }
      }
    }
  };

  const prompt = \`You are compiling a shift handover sheet for emergency physicians. You will be given raw, timestamped chronological clinical notes for each patient — this includes nursing entries, doctor entries, and repeated timestamp blocks going back through multiple shifts.

Your task is EXTRACTION, not summarization of the narrative. For each patient:
1. Scan the ENTIRE chronological history, oldest to newest.
2. For each output field, extract only the CURRENT/LATEST value — ignore superseded earlier values.
3. Do NOT copy raw note sentences verbatim into output fields. Rewrite extracted facts concisely in your own words.
4. Do NOT pad any field with boilerplate phrases like "Under evaluation" or "Monitor vitals" unless there is genuinely no information in the notes to extract — check the full text first.
5. If a value is truly not present anywhere in the notes, follow the null-handling instructions in each field's schema description exactly. Do not guess or invent a value.
6. Keep every field short enough to fit on a single printed handover row — this document must remain scannable in under 10 seconds per patient.

Input data (chronological, oldest first, PHI already stripped): \${JSON.stringify(processedPatients)}\`;

  try {
    let aiResponse;
    let modelUsed = "claude-3-5-sonnet";

    try {
      const fullPrompt = prompt + "\\n\\nCRITICAL: Return strictly valid JSON containing the 'rows' array matching the specified schema fields.";
      aiResponse = await callClaudeSonnetOnly(fullPrompt, "You are an expert emergency medical scribe specializing in clinical shift handovers. Only return JSON matching the schema with key 'rows'.", true);
    } catch (sonnetError) {
      console.warn("[compile-sheet] Claude Sonnet unavailable, falling back to Gemini Pro:", sonnetError);
      modelUsed = "gemini-pro-fallback";
      const ai = getAI();
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema as any,
          temperature: 0.0,
        },
      });
      aiResponse = JSON.parse(geminiResponse.text() || "{}");
    }

    const result = typeof aiResponse === "string" ? JSON.parse(aiResponse) : aiResponse;
    
    // Merge the AI extracted sparse fields back into the original patient object
    // This ensures fields like ageGender, erNo, complaints, etc., remain available for UI rendering
    // while overriding them with the AI's succinct extractions.
    const finalRows = (result.rows || []).map((row: any) => {
      const originalPatient = processedPatients.find((p: any) => p.id === row.id) || {};
      return {
        ...originalPatient,
        ...row,
        // Crucial: Nullify chronologicalNotes to prevent 20-page printouts of raw data
        chronologicalNotes: undefined,
        rawNotes: undefined
      };
    });

    res.json({ success: true, rows: finalRows, modelUsed });
  } catch (error) {
    console.error("AI Compilation Error:", error);
    res.status(500).json({ success: false, error: "Failed to compile sheet" });
  }
});\n\n`;

const newContent = fileContent.substring(0, targetFunctionStart) + replacement + fileContent.substring(targetFunctionEnd);
fs.writeFileSync('server.ts', newContent, 'utf8');
console.log('Update successful');
