const fs = require('fs');
let file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('const server = app.get("/api/test-batch"');
if (startIdx !== -1) {
  const endIdx = content.indexOf('const server = app.listen(PORT');
  if (endIdx !== -1) {
     content = content.slice(0, startIdx) + content.slice(endIdx);
     fs.writeFileSync(file, content);
  }
}
