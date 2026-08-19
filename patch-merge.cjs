const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const target = `            onClick={async () => {
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

const replacement = `            onClick={async () => {
              if (onSaveExtractedCase) {
                try {
                  const unappliedMessages = messages.filter(m => m.extractionData && !m.extractionApplied);
                  
                  if (unappliedMessages.length > 0) {
                    const mergedExtraction = unappliedMessages.reduce((acc, m) => {
                      const data = m.extractionData;
                      for (const key in data) {
                        if (data[key] === null || data[key] === undefined || data[key] === "") continue;
                        
                        if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
                          // Deep merge objects (like vitals)
                          acc[key] = { ...(acc[key] || {}), ...data[key] };
                        } else if (Array.isArray(data[key])) {
                          // Concatenate arrays (like treatments, investigations)
                          acc[key] = [...(acc[key] || []), ...data[key]];
                        } else if (typeof data[key] === 'string' && acc[key] && typeof acc[key] === 'string') {
                          // Smart merge strings: Append narrative text so nothing gets lost
                          if (key.match(/complaint|history|notes|symptoms|allergies|medications/i)) {
                            if (!acc[key].includes(data[key])) {
                              acc[key] = acc[key] + " \\n" + data[key];
                            }
                          } else {
                            acc[key] = data[key]; // Overwrite simple strings (e.g., patientName, gender)
                          }
                        } else {
                          acc[key] = data[key];
                        }
                      }
                      return acc;
                    }, {});

                    await onSaveExtractedCase(mergedExtraction, { existingCaseId: activeCaseId, autoNavigate: false });
                    
                    // Mark them all as applied locally so they show the green checkmark if user comes back
                    setMessages(prev => prev.map(m => m.extractionData ? { ...m, extractionApplied: true } : m));
                  } else {
                    // Initialize blank case if there is no data
                    await onSaveExtractedCase({}, { existingCaseId: activeCaseId, autoNavigate: false });
                  }
                } catch (e) {
                  console.warn("[VoiceScribeChatView] Failed to initialize case:", e);
                }
              }
              onOpenCaseSheet(activeCaseId);
            }}`;

if (code.includes(target)) {
  fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code.replace(target, replacement));
  console.log("Patched VoiceScribeChatView.tsx with smart merge logic!");
} else {
  console.error("Target string not found in VoiceScribeChatView.tsx");
}
