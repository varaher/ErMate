const fs = require('fs');
let content = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const targetStr = `                    // Mark them all as applied locally so they show the green checkmark if user comes back
                    setMessages(prev => prev.map(m => m.extractionData ? { ...m, extractionApplied: true } : m));
                  } else {
                    // Initialize blank case if there is no data
                    await onSaveExtractedCase({}, { existingCaseId: activeCaseId, autoNavigate: false });
                  }
                } catch (e) {`;

const replacementStr = `                    // Mark them all as applied locally so they show the green checkmark if user comes back
                    setMessages(prev => prev.map(m => m.extractionData ? { ...m, extractionApplied: true } : m));
                  } else {
                    // Only initialize blank case if there are literally zero messages with extraction data (meaning no dictation happened)
                    if (messages.filter(m => m.extractionData).length === 0) {
                      await onSaveExtractedCase({}, { existingCaseId: activeCaseId, autoNavigate: false });
                    }
                  }
                } catch (e) {`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  console.log("Updated Open Case Sheet logic");
} else {
  console.log("Failed to find target string in VoiceScribeChatView.tsx");
}

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', content, 'utf8');
