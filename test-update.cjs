const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

code = code.replace(
  /const msgRef = messages\.find\(m => m\.id === msgId\);\n\s*if \(msgRef\) \{[\s\S]*?\}\n\s*\} catch \(e\) \{/,
  `// Update local state first
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, extractionApplied: true } : m));
      // No need to query Firestore from the frontend component here if we don't have the doc ID
    } catch (e) {`
);

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code);
console.log("Patched VoiceScribeChatView.tsx update!");
