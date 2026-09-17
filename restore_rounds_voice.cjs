const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// 1. Restore VoiceRecorder import at the top
if (!code.includes('import VoiceRecorder')) {
    code = code.replace(/import React, \{ useState, useEffect, useRef \} from "react";/, 'import React, { useState, useEffect, useRef } from "react";\nimport VoiceRecorder from "./shared/VoiceRecorder";');
}

// 2. Restore the ternary for Clinical Rounds
const buttonRegex = /<button\n\s*type="button"\n\s*onClick=\{\(\) => handleRoundsChatSend\(\)\}\n\s*disabled=\{roundsChatLoading \|\| roundsUserMessage\.trim\(\) === ""\}\n\s*className=\{`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md \$\{roundsUserMessage\.trim\(\) === "" \? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 cursor-pointer"\}`\}\n\s*title="Send message"\n\s*>\n\s*<Send className="w-4\.5 h-4\.5" \/>\n\s*<\/button>/;

const replacement = `{roundsUserMessage.trim() === "" ? (
                          <VoiceRecorder 
                            renderMode="compact-button"
                            onTranscript={(txt) => setRoundsUserMessage(prev => prev ? \`\${prev} \${txt}\` : txt)} 
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRoundsChatSend()}
                            disabled={roundsChatLoading}
                            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                            title="Send message"
                          >
                            <Send className="w-4.5 h-4.5" />
                          </button>
                        )}`;

code = code.replace(buttonRegex, replacement);

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
