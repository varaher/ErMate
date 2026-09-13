const fs = require('fs');

// 1. Patch QuickDischargeIntake.tsx
let qdCode = fs.readFileSync('src/components/QuickDischargeIntake.tsx', 'utf8');
qdCode = qdCode.replace('function createQuickDischargeCase(', 'export function createQuickDischargeCase(');
fs.writeFileSync('src/components/QuickDischargeIntake.tsx', qdCode);
console.log('Patched QuickDischargeIntake.tsx');

// 2. Patch scribeChatTurn.ts
let scribeCode = fs.readFileSync('server/scribeChatTurn.ts', 'utf8');
scribeCode = scribeCode.replace(
  'ageQuestionNeeded?: boolean;',
  'ageQuestionNeeded?: boolean;\n  dischargeIntent?: boolean;'
);

const isDischargeReqBlockRegex = /if \(isDischargeReq\) \{[\s\S]*?catch \(err: any\) \{[\s\S]*?\}\n  \}/;
const newDischargeBlock = `if (isDischargeReq) {
    const dischargeMessage: ScribeChatMessage = {
      id: "ds-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      role: "assistant",
      timestamp: new Date().toISOString(),
      type: "clinical-reasoning",
      content: "I'll open the Discharge Summary view with these details for you now.",
    };

    return {
      extractionMessage: dischargeMessage,
      reasoningMessage: dischargeMessage,
      dischargeIntent: true,
      reply: dischargeMessage.content,
    };
  }`;
scribeCode = scribeCode.replace(isDischargeReqBlockRegex, newDischargeBlock);

scribeCode = scribeCode.replace(
  /content: "Case details extracted for review\.",/g,
  'content: "✅ Details captured from your update.",'
);

fs.writeFileSync('server/scribeChatTurn.ts', scribeCode);
console.log('Patched scribeChatTurn.ts');

// 3. Patch VoiceScribeChatView.tsx
let chatCode = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

chatCode = chatCode.replace(
  'onSaveExtractedCase?: (extracted: any, options?: { autoNavigate?: boolean; existingCaseId?: string | null }) => Promise<string>;',
  'onSaveExtractedCase?: (extracted: any, options?: { autoNavigate?: boolean; existingCaseId?: string | null }) => Promise<string>;\n  onPrepareDischarge?: (extraction: Record<string, any>, sourceMessageId: string, caseId: string) => void;'
);

chatCode = chatCode.replace(
  'dischargeApplied?: boolean;',
  'dischargeApplied?: boolean;\n  dischargeIntent?: boolean;'
);

const sendToChatBlock = `        const dischargeDraft = data.dischargeDraft;

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
        };`;
const newSendToChatBlock = `        const dischargeIntent = data.dischargeIntent;

        const aiMsg: Message = {
          id: \`ai-\${Date.now()}\`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "dictation",
          extractionData: fieldsToExtract,
          extractionApplied: false,
          dischargeIntent: dischargeIntent,
        };`;
chatCode = chatCode.replace(sendToChatBlock, newSendToChatBlock);

const appendMsgBlock = `        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
        });`;
const newAppendMsgBlock = `        persistMessage({
          id: aiMsg.id,
          role: "assistant",
          type: "text",
          content: replyText,
          timestamp: new Date().toISOString(),
        });

        if (dischargeIntent && onPrepareDischarge) {
           const mergedPending = mergeExtractionUpTo([...messages, userMsg, aiMsg], aiMsg.id);
           onPrepareDischarge(mergedPending, aiMsg.id, activeCaseId!);
        }`;
chatCode = chatCode.replace(appendMsgBlock, newAppendMsgBlock);

const dischargeDraftRenderRegex = /\{msg\.dischargeDraft && \([\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\)\}/;
chatCode = chatCode.replace(dischargeDraftRenderRegex, '');

const singleButtonBlock = `<div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">

        <button
          disabled={msg.extractionApplied}
          onClick={() => handleApplyExtraction(msg.id, merged)}
          className={\`w-full py-1.5 rounded text-xs font-bold transition-all \${
            msg.extractionApplied
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 opacity-80"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          }\`}
        >
          {msg.extractionApplied
            ? "✅ Copied to Case Sheet"
            : "Copy to Case Sheet"}
        </button>

      </div>`;

const twoButtonsBlock = `<div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-2">
        <button
          disabled={msg.extractionApplied}
          onClick={() => handleApplyExtraction(msg.id, merged)}
          className={\`flex-1 py-1.5 rounded text-xs font-bold transition-all cursor-pointer \${
            msg.extractionApplied
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 opacity-80"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          }\`}
        >
          {msg.extractionApplied
            ? "✅ Copied to Case Sheet"
            : "Prepare Case Sheet"}
        </button>
        <button
          onClick={() => onPrepareDischarge?.(merged, msg.id, activeCaseId!)}
          className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          Prepare Discharge Summary
        </button>
      </div>`;
chatCode = chatCode.replace(singleButtonBlock, twoButtonsBlock);

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', chatCode);
console.log('Patched VoiceScribeChatView.tsx');

// 4. Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

if (!appCode.includes('import QuickDischargeIntake, { createQuickDischargeCase }')) {
  appCode = appCode.replace(
    'import QuickDischargeIntake from "./components/QuickDischargeIntake";',
    'import QuickDischargeIntake, { createQuickDischargeCase } from "./components/QuickDischargeIntake";'
  );
}

const voiceScribePropRegex = /onSaveExtractedCase=\{handleSaveExtractedVoiceCase\}/;
const newProps = `onSaveExtractedCase={handleSaveExtractedVoiceCase}
              onPrepareDischarge={(extraction, msgId, chatCaseId) => {
                const targetCaseId = chatCaseId || voiceScribeCaseId;
                if (!targetCaseId) return;
                
                const existingCase = cases.find(c => c.id === targetCaseId);

                if (existingCase) {
                  // Ensure any new details are persisted to the existing case before opening discharge summary
                  handleSaveExtractedVoiceCase(extraction, { existingCaseId: targetCaseId, autoNavigate: false });
                  setShowVoiceScribeChat(false);
                  setSelectedCaseId(targetCaseId);
                  setShowDischargeSummaryId(targetCaseId);
                } else {
                  // No case saved yet, create the minimal quick discharge case
                  const minimalCase = createQuickDischargeCase(
                    extraction,
                    profile?.email || auth?.currentUser?.email || "doctor@ermate.ai",
                    profile?.hospital || "General Hospital"
                  );
                  // Override generic CASE-XXXX id to preserve the active link with the chat session
                  minimalCase.id = targetCaseId;
                  
                  handleSaveCase(minimalCase);
                  setQuickDischargeCase(minimalCase);
                  
                  setShowVoiceScribeChat(false);
                  setSelectedCaseId(targetCaseId);
                  setShowDischargeSummaryId(targetCaseId);
                }
              }}`;
appCode = appCode.replace(voiceScribePropRegex, newProps);

fs.writeFileSync('src/App.tsx', appCode);
console.log('Patched App.tsx');

