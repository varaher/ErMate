sed -i '1613c\
// 5b. AI Scribe Dictation Extractor\
app.post("/api/scribe-extract", async (req, res) => {\
  const { dictation } = req.body;\
  if (!dictation) return res.status(400).json({ error: "No dictation provided" });\
  try {\
    const safeDictation = deidentifyText(dictation).deidentified;\
    const extractRes = await extractFromTranscript(safeDictation);\
    if (!extractRes.success || !extractRes.extracted) {\
      return res.status(500).json({ error: extractRes.error || "Failed to extract" });\
    }\
    const ext = extractRes.extracted;\
    res.json({\
      success: true,\
      extractedCase: {\
        patient: {\
          name: ext.name || "Unknown Patient",
' server.ts
