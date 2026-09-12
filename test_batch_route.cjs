const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('/api/test-batch')) {
    const route = `
app.get("/api/test-batch", async (req, res) => {
  try {
    const { sarvamBatchTranscribe } = require('./server/sarvamBatch.js');
    const dummyBuffer = Buffer.from("dummy audio data");
    const result = await sarvamBatchTranscribe(dummyBuffer, "test.webm", "translate");
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
`;
    content = content.replace('app.listen(PORT', route + '\napp.listen(PORT');
    fs.writeFileSync(file, content);
}
