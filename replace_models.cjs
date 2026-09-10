const fs = require('fs');
const glob = require('glob');

const replacements = [
  { from: /"claude-3-5-sonnet-20241022"/g, to: '"claude-sonnet-4-6"' },
  { from: /'claude-3-5-sonnet-20241022'/g, to: "'claude-sonnet-4-6'" },
  { from: /"claude-3-7-sonnet-20250219"/g, to: '"claude-sonnet-4-5-20250929"' },
  { from: /'claude-3-7-sonnet-20250219'/g, to: "'claude-sonnet-4-5-20250929'" },
  { from: /"claude-3-5-haiku-20241022"/g, to: '"claude-haiku-4-5-20251001"' },
  { from: /'claude-3-5-haiku-20241022'/g, to: "'claude-haiku-4-5-20251001'" },
  { from: /'claude-3-5-haiku-20241022-retry'/g, to: "'claude-haiku-4-5-20251001-retry'" }
];

const files = [
  'server.ts',
  'server/mortalityAudit.ts',
  'server/handover.ts',
  'server/aiDiagnosis.ts',
  'server/dischargeSummary.ts',
  'server/extraction.ts',
  'server/learningService.ts',
  'server/voiceExtraction.ts'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
});
