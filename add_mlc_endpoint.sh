sed -i '1576a\
// 5c. MLC EMR Extractor\
app.post("/api/mlc-extract", async (req, res) => {\
  const { text, caseData } = req.body;\
  if (!text) return res.status(400).json({ error: "No text provided" });\
\
  try {\
    let prompt = `You are an expert medico-legal physician. Extract the following fields from this raw EMR/Clinical text to populate an Accident Register cum Wound Certificate (MLC).\n\nRaw Text:\\n${text}\\n\\nExtract and return ONLY a valid JSON object matching this schema. Omit any markdown formatting.\\n{\\n  "extractedMlc": {\\n    "natureOfIncident": "string",\\n    "dateTimeOfIncident": "string",\\n    "placeOfIncident": "string",\\n    "identificationMark": "string",\\n    "informantBroughtBy": "string",\\n    "historyStatedBy": "string",\\n    "allegedCauseOfInjury": "string",\\n    "opinion": "string",\\n    "certificateRequestedBy": "string"\\n  },\\n  "extractedPrimary": {\\n    "disability": { "gcsTotal": "number or string", "avpu": "string" },\\n    "breathingStatus": "string",\\n    "circulationStatus": "string"\\n  },\\n  "extractedSecondary": {\\n    "headAndNeck": "string",\\n    "chest": "string",\\n    "abdomen": "string",\\n    "pelvis": "string",\\n    "extremities": "string",\\n    "neurological": "string",\\n    "skin": "string"\\n  }\\n}`; \
\
    if (caseData) {\
      prompt += `\\n\\nExisting Case Data (Do not overwrite with nulls if already exists, only augment): ${JSON.stringify(caseData)}`;\
    }\
\
    // Use gemini for extraction\
    let responseText = "";\
    if (process.env.GEMINI_API_KEY) {\
       const { GoogleGenAI } = await import("@google/genai");\
       const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });\
       const response = await ai.models.generateContent({\
          model: "gemini-2.5-flash",\
          contents: prompt,\
          config: { temperature: 0.0 }\
       });\
       responseText = response.text || "";\
    }\
    \
    if (responseText) {\
       let cleaned = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();\
       return res.json(JSON.parse(cleaned));\
    } else {\
       return res.status(500).json({ error: "Failed to extract" });\
    }\
  } catch (error) {\
    console.error("MLC Extract Error:", error);\
    res.status(500).json({ error: "Extraction failed" });\
  }\
});\
' server.ts
