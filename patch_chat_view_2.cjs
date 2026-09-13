const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const oldBlockStart = `{msg.mode === "dictation" && msg.sender === "ai" && msg.extractionData !== undefined && hasDisplayableExtraction(mergeExtractionUpTo(messages, msg.id)) && (() => {`;
const oldBlockEnd = `                );
              })()}`;

const newBlock = `{msg.mode === "dictation" &&
 msg.sender === "ai" &&
 msg.extractionData !== undefined &&
 (() => {

  const merged = mergeExtractionUpTo(messages, msg.id);
  const entries = getDisplayableExtractionEntries(merged);

  if (entries.length === 0) return null;

  return (
    <div className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">

      <div className="bg-slate-200 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
        CAPTURED FROM YOUR UPDATE
      </div>

      <div className="p-3 text-xs space-y-2 text-slate-600 dark:text-slate-400 max-h-[340px] overflow-y-auto">

        {entries.map(([key, val]) => (
          <div key={key}>
            <strong className="text-slate-800 dark:text-slate-200">
              {humanizeFieldLabel(key)}:
            </strong>{" "}
            {formatExtractionEntryValue(key, val)}
          </div>
        ))}

      </div>

      <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">

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

      </div>
    </div>
  );
})()}`;

const startIndex = code.indexOf(oldBlockStart);
const endIndex = code.indexOf(oldBlockEnd, startIndex) + oldBlockEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  const before = code.substring(0, startIndex);
  const after = code.substring(endIndex);
  fs.writeFileSync('src/components/VoiceScribeChatView.tsx', before + newBlock + after);
  console.log('Patched UI block in VoiceScribeChatView.tsx');
} else {
  console.error('Could not find the UI block in VoiceScribeChatView.tsx');
}
