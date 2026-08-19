sed -i '1613,1626c\
// 5b. AI Scribe Dictation Extractor\
app.post("/api/scribe-extract", async (req, res) => {\
  const { dictation } = req.body;\
  if (!dictation) return res.status(400).json({ error: "No dictation provided" });\
  try {\
    const safeDictation = deidentifyText(dictation).deidentified;\
    const result = await extractFromTranscript(safeDictation);\
    if (result.success && result.extracted) {\
      const ext = result.extracted;\
      const formattedData = {\
        name: ext.name || "Unknown Patient",\
' server.ts
