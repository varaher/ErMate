const fs = require('fs');
let content = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

content = content.replace(
  'toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied to Case Sheet`;',
  'toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Case sheet extracted and saved.`;'
);

content = content.replace(
  '{msg.extractionApplied ? "✅ Copied to Case Sheet" : "Copy to Case Sheet"}',
  '{msg.extractionApplied ? "✅ Case sheet extracted and saved." : "Copy to Case Sheet"}'
);

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', content, 'utf8');
