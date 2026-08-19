const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

// Add import for updateChatMessage
if (!code.includes('updateChatMessage')) {
  code = code.replace(
    /import \{ subscribeChatHistory, appendChatMessage, generateNewCaseId \} from "\.\.\/services\/scribeChatStorage";/,
    `import { subscribeChatHistory, appendChatMessage, generateNewCaseId, updateChatMessage } from "../services/scribeChatStorage";`
  );
}

// Update handleApplyExtraction
code = code.replace(
  /const handleApplyExtraction = \(msgId: string, data: Partial<ClinicalCase>\) => \{[\s\S]*?setMessages\(prev => prev\.map\(m => m\.id === msgId \? \{ \.\.\.m, extractionApplied: true \} : m\)\);\n    \} catch \(e\) \{/g,
  `const handleApplyExtraction = async (msgId: string, data: Partial<ClinicalCase>) => {
    try {
      if (onSaveExtractedCase) {
        await onSaveExtractedCase(data, { existingCaseId: activeCaseId, autoNavigate: false });
      } else if (onCaseSheetUpdated) {
        onCaseSheetUpdated(data);
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, extractionApplied: true } : m));
      
      const msgRef = messages.find(m => m.id === msgId);
      if (msgRef) {
        const hMsg = (messages as any).find?.((h: any) => h.id === msgId); // won't work well, but let's query Firestore.
        // Actually, just find the docId by finding the matching message in the subscription array if we had it.
        // Better: let's query scribeChatMessages by id == msgId
      }
    } catch (e) {`
);

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code);
console.log("Patched VoiceScribeChatView.tsx 2");
