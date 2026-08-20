const fs = require('fs');
const fileContent = fs.readFileSync('server.ts', 'utf8');

const targetFunctionStart = fileContent.indexOf('app.post("/api/handover/compile-sheet"');
if (targetFunctionStart === -1) {
  console.error('Could not find start of function');
  process.exit(1);
}

const targetFunctionEnd = fileContent.indexOf('// 6.7. AI Clinical Mnemonic Scanner', targetFunctionStart);
if (targetFunctionEnd === -1) {
  console.error('Could not find end of function');
  process.exit(1);
}

const replacement = `app.post("/api/handover/compile-sheet", async (req, res) => {
  const { patients } = req.body;
  if (!patients || !Array.isArray(patients) || patients.length === 0) {
    return res.status(400).json({ success: false, error: "No patient records provided for compilation." });
  }

  // Preprocess, de-identify, & reverse raw notes for each patient (oldest at top)
  // NOTE: processedPatients is the DE-IDENTIFIED version sent to the LLM only.
  // We keep a separate map of ORIGINAL (real name, real raw notes) data to
  // reconstruct the final output — never trust the LLM to echo these back correctly.
  const processedPatients = patients.map((p: any) => {
    const raw = p.rawNotes || p.chronologicalNotes || "";
    let safeNotes = raw;
    if (raw && typeof raw === "string" && raw.trim().length > 0) {
      const clean = preprocessEMR(raw);
      const deidentified = deidentifyText(clean).deidentified;
      safeNotes = reverseEMREntries(deidentified);
    }
    return {
      ...p,
      name: deidentifyText(p.name || "").deidentified || p.name,
      complaints: deidentifyText(p.complaints || p.presentingComplaint || "").deidentified || p.complaints,
      history: deidentifyText(p.history || p.pmh || "").deidentified || p.history,
      rawNotes: safeNotes,
      chronologicalNotes: safeNotes
    };
  });

  // FIX: preserve a lookup of the ORIGINAL, real-identity patient records
  // so we can re-inject real name + verified raw notes locally after the AI call,
  // the same way doctor identity is re-injected elsewhere in the app (rule 5).
  const originalById = new Map(patients.map((p: any) => [p.id, p]));

  try {
    const ai = getAI();
    const schema = {
      type: Type.OBJECT,
      properties: {
        rows: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              bed: { type: Type.STRING, description: "Bed or Room number e.g. Bed 13, Bed 3" },
              name: { type: Type.STRING, description: "Patient name e.g. Selvarani, Mini Unnikrishnan" },
              ageGender: { type: Type.STRING, description: "Age and gender e.g. 57F, 48M" },
              erNo: { type: Type.STRING, description: "ER number or patient ID e.g. ER# 1849288" },
              doctor: { type: Type.STRING, description: "Lead clinician / primary doctor e.g. Dr. Manoj, Dr. Elizabeth" },
              stayDuration: { type: Type.STRING, description: "Admission date and stay duration in ER e.g. In ER since: 25-07-2026 (12h)" },
              complaints: { type: Type.STRING, description: "PRESENTING COMPLAINT: Chief complaints, symptoms, duration, and onset from initial presentation" },
              history: { type: Type.STRING, description: "PAST MEDICAL HISTORY: Comorbidities (e.g. T2DM x 22y, HTN x 22y, Hypothyroidism x 5y, Cushing's syndrome, Morbid Obesity, OSA), home medications, surgical history, and allergies" },
              assessment: { type: Type.STRING, description: "PROVISIONAL DIAGNOSIS & ASSESSMENT: Exact provisional diagnosis (e.g. Fluid overload state with pericardial & pleural effusion, moderate ascites, metabolic acidosis, AKI), full imaging/lab report findings" },
              planDone: { type: Type.STRING, description: "MANAGEMENT PLAN DONE ✓: List ALL completed investigations, medications given, IV lines, procedures, catheterization, and completed consults with ✓" },
              planToBeDone: { type: Type.STRING, description: "MANAGEMENT PLAN TO BE DONE □: List ALL pending investigations, pending consults, transfer plans (e.g. Shift to 3rd MICU), and scheduled procedures with □" },
              bystander: { type: Type.STRING, description: "BYSTANDER UPDATE: Exact details of WHO was counselled and WHAT was communicated (e.g. Explained in detail regarding need of ICU admission...)" },
              vitals: {
                type: Type.STRING,
                description: "VITALS: Latest vital signs e.g. SpO2 97% on 5L O2 · HR 103 · BP 130/80 · RR 18 · Temp 97.4°F · GRBS 204 · GCS E4V5M6. If any individual vital is missing from the notes, OMIT it entirely from the string — never output a label with no value (e.g. never 'SpO2: %')."
              },
              alerts: { type: Type.STRING, description: "CRITICAL ALERTS STRIP: Warning flags for abnormal labs, dangerous vitals, or urgent pending consults e.g. ⚠ Shifting to MICU · ⚠ Metabolic Acidosis · ⚠ Trop I pending" }
            },
            required: ["id", "bed", "name", "ageGender", "complaints", "history", "assessment", "planDone", "planToBeDone", "bystander", "vitals", "alerts"]
          }
        }
      },
      required: ["rows"]
    };

    const prompt = \`
      You are an expert Emergency Medicine Senior Consultant and Scribe Lead.
      Synthesize the following \${patients.length} patient clinical records into a standardized, exhaustive Vertical Portrait Doctors' Handover Sheet.
      PATIENTS DATA TO EXTRACT:
      \${JSON.stringify(processedPatients, null, 2)}

      CRITICAL EXTRACTION RULES:
      0. ZERO HALLUCINATION / DETERMINISTIC OUTPUT (TEMPERATURE = 0.0): Never invent or guess any diagnostic values, vitals, drugs, past history, or doctor names. Return empty string or null for absent items.
      1. ZERO GENERIC PLACEHOLDERS: NEVER output generic strings like "Comorbidities not explicitly documented in raw input", "Vitals not documented", "Evaluation of patient with acute symptoms", "Complete active tasks", "Parsed Notes Review Complete", or "Bystanders counselled". If data is present, extract it thoroughly; if genuinely absent, leave as empty string.
      2. READ EVERY ENTRY IN THE CHRONOLOGICAL NOTES: Scan every single consultant review (General Medicine, Nephrology, MICU), nurse entry, and lab parameter to inform the fields below — but do NOT reproduce the chronological notes themselves in your output; that is handled separately.
      3. SEPARATE NURSING ACTIONS FROM CLINICAL FINDINGS:
         Nursing actions ("Patient shifted for CT", "CT slot called", "Foley catheter inserted", "IV cannulated") -> Place in Management Plan DONE ✓ list.
         Clinical findings ("CT Abdomen: Pericardial & pleural effusion, moderate ascites") -> Place in Provisional Diagnosis & Assessment / Investigation findings.
      4. PAST MEDICAL HISTORY: Scan all entries for "Known case of", "K/C/O", "Comorbidities", "Past Medical History". Extract every single condition with duration and home drugs (e.g., T2DM x 22y, HTN with Nephropathy, Hypothyroidism x 5y, Cushing's syndrome, Morbid Obesity, OSA).
      5. PROVISIONAL DIAGNOSIS: Look for "IMP:", "Impression:", "Differential Diagnosis:", or consultant review conclusions. Extract the explicit diagnosis (e.g., "Fluid overload state with pericardial effusion and right pleural effusion, Moderate ascites, Metabolic acidosis, Acute kidney injury").
      6. MANAGEMENT DONE ✓: Extract ALL past-tense completed actions (IV, VBG, O2 delivery, Foley catheter, CT done, Chest X-ray done, Troponin sent, Echo done, Consults done). Format with ✓.
      7. MANAGEMENT TO BE DONE □: Extract ALL future/pending actions (Shift to MICU, Critical care consultation, Trop I result awaited, NIV if O2 req increases, Monitor VBG/UO). Format with □.
      8. BYSTANDER UPDATE: Extract exact details of family counselling (WHO was told, WHAT was explained).
      9. VITALS: Format latest vitals clearly (SpO2, HR, BP, RR, Temp, GRBS, GCS). Omit any individual value not present in the notes — never leave a blank label.
      10. CRITICAL ALERTS: Flag abnormal lab findings, metabolic acidosis, pending cardiac markers, or ICU transfers with ⚠.
      11. PRESERVE PATIENT ID: The "id" field in each row MUST match the exact "id" field provided in the corresponding input patient object.
    \`;

    const fullPrompt = prompt + "\\n\\nCRITICAL: Return strictly valid JSON containing the 'rows' array matching the specified schema fields.";

    let aiResponse;
    let modelUsed;

    try {
      aiResponse = await callClaudeSonnetOnly(
        fullPrompt,
        "You are an expert emergency medical scribe specializing in clinical shift handovers. Only return JSON matching the schema with key 'rows'.",
        true
      );
      modelUsed = "claude-3-5-sonnet";
    } catch (sonnetError) {
      console.warn("[compile-sheet] Claude Sonnet unavailable, falling back to Gemini Pro:", sonnetError);
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
      modelUsed = "gemini-pro-fallback";
    }

    const result = typeof aiResponse === "string" ? JSON.parse(aiResponse) : aiResponse;

    const finalRows = (result.rows || []).map((row: any) => {
      const original = originalById.get(row.id) || {};
      const processed = processedPatients.find((p: any) => p.id === row.id) || {};

      return {
        ...row,                                          // AI-extracted fields first (assessment, planDone, etc.)
        id: row.id,
        name: original.name || processed.name || row.name,       // real name re-injected locally, never AI-sourced
        chronologicalNotes: processed.chronologicalNotes || "",  // verified pass-through, never AI-regenerated
        rawNotes: processed.rawNotes || "",
      };
    });

    res.json({ success: true, rows: finalRows, modelUsed });
  } catch (error: any) {
    console.error("AI Compilation Error:", error);
    res.status(500).json({ success: false, error: "Failed to compile sheet" });
  }
});\n\n`;

const newContent = fileContent.substring(0, targetFunctionStart) + replacement + fileContent.substring(targetFunctionEnd);
fs.writeFileSync('server.ts', newContent, 'utf8');
console.log('Update successful');
