const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const target = `            onClick={async () => {
              if (onSaveExtractedCase) {
                try {
                  await onSaveExtractedCase({}, { existingCaseId: activeCaseId, autoNavigate: false });
                } catch (e) {
                  console.warn("[VoiceScribeChatView] Failed to initialize case:", e);
                }
              }
              onOpenCaseSheet(activeCaseId);
            }}`;

const replacement = `            onClick={async () => {
              if (onSaveExtractedCase) {
                try {
                  const lastExtraction = [...messages].reverse().find(m => m.extractionData && !m.extractionApplied)?.extractionData || {};
                  await onSaveExtractedCase(lastExtraction, { existingCaseId: activeCaseId, autoNavigate: false });
                } catch (e) {
                  console.warn("[VoiceScribeChatView] Failed to initialize case:", e);
                }
              }
              onOpenCaseSheet(activeCaseId);
            }}`;

if (code.includes(target)) {
  fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code.replace(target, replacement));
  console.log("Patched Open Case Sheet button");
} else {
  console.log("Target not found!");
}
