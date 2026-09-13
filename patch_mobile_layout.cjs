const fs = require('fs');
const path = 'src/components/VoiceScribeChatView.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace the input container logic
const oldInputSection = `<div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLensMenu(v => !v)}
            className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0"
            title="Clinical lenses"
          >
            <MoreVertical size={18} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAttachment}
            className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 disabled:opacity-40"
            title="Attach an image (PDF/Word not yet supported)"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleAttachmentSelected}
            className="hidden"
          />

          <div className="flex-1 flex gap-2">
            <textarea
              ref={inputTextareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputText.trim() && !isSending) {
                    sendToChat(inputText);
                  }
                }
              }}
              placeholder={currentMode === "discuss" ? "Ask anything about this case..." : "Type clinical details / questions..."}
              disabled={isSending}
              rows={1}
              className="flex-1 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 resize-none overflow-y-auto leading-relaxed"
              style={{ maxHeight: "160px" }}
            />
          </div>
          {inputText.trim() ? (
            <button
              onClick={() => sendToChat(inputText)}
              disabled={isSending}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-full cursor-pointer shadow-md transition-all flex items-center justify-center shrink-0 w-10 h-10"
            >
              <Send size={16} className="mr-0.5" />
            </button>
          ) : (
            <VoiceRecorder
              renderMode="compact-button"
              onTranscript={sendToChat}
              disabled={isSending}
            />
          )}
        </div>`;

const newInputSection = `<div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Left Controls */}
          <div className="flex items-center gap-1 order-2 sm:order-1">
            <button
              type="button"
              onClick={() => setShowLensMenu(v => !v)}
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0"
              title="Clinical lenses"
            >
              <MoreVertical size={18} />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment}
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 disabled:opacity-40"
              title="Attach an image (PDF/Word not yet supported)"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleAttachmentSelected}
              className="hidden"
            />
          </div>

          {/* Textarea */}
          <div className="flex-1 flex min-w-0 w-full order-1 sm:order-2 basis-full sm:basis-auto">
            <textarea
              ref={inputTextareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputText.trim() && !isSending) {
                    sendToChat(inputText);
                  }
                }
              }}
              placeholder={currentMode === "discuss" ? "Ask anything about this case..." : "Type clinical details / questions..."}
              disabled={isSending}
              rows={1}
              className="flex-1 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 resize-none overflow-y-auto leading-relaxed"
              style={{ maxHeight: "160px" }}
            />
          </div>

          {/* Right Controls */}
          <div className="flex items-center shrink-0 order-3 sm:order-3 ml-auto sm:ml-0">
            {inputText.trim() ? (
              <button
                onClick={() => sendToChat(inputText)}
                disabled={isSending}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-full cursor-pointer shadow-md transition-all flex items-center justify-center shrink-0 w-10 h-10"
              >
                <Send size={16} className="mr-0.5" />
              </button>
            ) : (
              <VoiceRecorder
                renderMode="compact-button"
                onTranscript={sendToChat}
                disabled={isSending}
              />
            )}
          </div>
        </div>`;

if (code.includes(oldInputSection)) {
  code = code.replace(oldInputSection, newInputSection);
  
  // Safe area padding for the bottom bar
  const oldPadding = `<div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 relative">`;
  const newPadding = `<div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 relative" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>`;
  code = code.replace(oldPadding, newPadding);

  fs.writeFileSync(path, code);
  console.log("Patched VoiceScribeChatView.tsx");
} else {
  console.error("Could not find the target code in VoiceScribeChatView.tsx");
}
