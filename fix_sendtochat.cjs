const fs = require('fs');
const content = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const regex = /const sendToChat = async \(text: string\) => \{[\s\S]*?\n  \};\n\n  const handleLensClick/m;
const match = content.match(regex);
if (match) {
  const replacement = `const sendToChat = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setInputText("");
    setIsSending(true);

    const userMsg: Message = {
      id: \`u-\${Date.now()}\`,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      mode: currentMode,
    };

    setMessages((prev) => [...prev, userMsg]);
    persistMessage({
      id: userMsg.id,
      role: "user",
      type: "text",
      content: trimmed,
      timestamp: new Date().toISOString(),
    });

    try {
      if (currentMode === "discuss") {
        // ── DISCUSS MODE — Claude Sonnet only, read-only, via /api/case-discussion.
        // No AbortController/timeout — per explicit request, discuss-mode
        // (and dictation, below) now wait indefinitely for a response.
        // suggestedUpdate is deliberately ignored — discuss-mode conversations
        // never write to the real case sheet, regardless of what the model proposes.
        const res = await fetch("/api/case-discussion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            contextType: isDiscussionOnly ? "general" : "case",
            contextData: isDiscussionOnly ? {} : (caseData || {}),
            caseData: isDiscussionOnly ? {} : (caseData || {}),
            history: messages,
            messages: [...messages, userMsg].map((m) => ({
              sender: m.sender === "user" ? "user" : "ai",
              text: m.text,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");

        const replyText = data.response || data.reply || "I've reviewed the case, but couldn't form a clear answer just now.";
        const aiMsg: Message = {
          id: \`ai-\${Date.now()}\`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "discuss",
        };
        setMessages((prev) => [...prev, aiMsg]);
        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
        });
      } else {
        // ── DICTATION MODE — GPT-4o-mini extraction (parallel) + Claude
        // Sonnet reasoning, via /api/scribe-chat. No timeout, as above.
        const res = await fetch("/api/scribe-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userInput: trimmed,
            caseId: activeCaseId,
            caseData: caseData || {},
            patientAgeYears: caseData?.patient?.age || null,
            caseContext: caseData || {},
            messages: messages,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");

        const replyText = data.reply || data.aiReply || data.summary || "Processed case details.";
        const rawFieldsToExtract = data.unappliedExtraction || data.updatedCaseSheetFields || data.extractedFields;
        const fieldsToExtract = hasDisplayableExtraction(rawFieldsToExtract) ? rawFieldsToExtract : undefined;
        const dischargeDraft = data.dischargeDraft;

        const aiMsg: Message = {
          id: \`ai-\${Date.now()}\`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "dictation",
          extractionData: fieldsToExtract,
          extractionApplied: false,
          dischargeDraft: dischargeDraft,
          dischargeApplied: false,
        };

        setMessages((prev) => [...prev, aiMsg]);
        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
          unappliedExtraction: fieldsToExtract ? JSON.parse(JSON.stringify(fieldsToExtract)) : undefined,
          dischargeDraft: dischargeDraft,
        });
      }
    } catch (err: any) {
      console.error("[VoiceScribeChatView] Send failed:", err);
      const errMsg: Message = {
        id: \`err-\${Date.now()}\`,
        sender: "ai",
        text: \`⚠️ Could not reach clinical assistant (\${err.message || "network error"}). Your message was saved.\`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleLensClick`;

  const newContent = content.replace(regex, replacement);
  fs.writeFileSync('src/components/VoiceScribeChatView.tsx', newContent, 'utf8');
  console.log('Replaced successfully');
} else {
  console.error('Match not found');
}
