const fs = require('fs');
let code = fs.readFileSync('src/hooks/useBoundChat.ts', 'utf8');

const target = `      // Create new session
      const welcomeMsg = buildWelcomeMessage(context);
      const newSessionData = {
        contextType: context.type,
        contextId: context.id,
        contextRef: \`\${context.type}s/\${context.id}\`,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        createdBy: currentUserUid,
        messages: [welcomeMsg],
        pendingUpdates: null,
      };`;

const replacement = `      // Create new session
      const welcomeMsg = buildWelcomeMessage(context);
      const newSessionData = {
        contextType: context.type,
        contextId: context.id,
        contextRef: \`\${context.type}s/\${context.id}\`,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        createdBy: currentUserUid,
        messages: [welcomeMsg],
        pendingUpdates: null,
      };

      // Trigger automatic AI summary generation asynchronously
      setTimeout(async () => {
        try {
          const summaryPrompt = "Please provide a concise clinical summary of this case based on the provided record, and then ask me what I would like to focus on or what follow-up queries I have.";
          setSending(true);
          const response = await fetch('/api/case-discussion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: summaryPrompt,
              contextType: context.type,
              contextData: context.data,
              caseData: context.data,
              history: [],
              messages: [{ sender: 'user', text: summaryPrompt }]
            }),
          });
          const data = await response.json();
          const assistantContent = data.response || "Summary unavailable.";
          const assistantMsg = {
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString()
          };
          
          setMessages(prev => {
            const newMsgs = [...prev, assistantMsg];
            // Save local
            localStorage.setItem(
              \`ermate_chat_session_\${context.type}_\${context.id}\`,
              JSON.stringify({ id: newDocId, messages: newMsgs })
            );
            return newMsgs;
          });
          
          if (db && newDocId) {
             updateDoc(doc(db, 'chatSessions', newDocId), {
                messages: [welcomeMsg, assistantMsg],
                lastMessageAt: serverTimestamp()
             }).catch(() => {});
          }
        } catch (e) {
          console.warn('Failed to auto-generate summary', e);
        } finally {
          setSending(false);
        }
      }, 500);
`;

if (code.includes(target)) {
  fs.writeFileSync('src/hooks/useBoundChat.ts', code.replace(target, replacement));
  console.log("Patched auto-summary for new sessions!");
} else {
  console.log("Target not found!");
}
