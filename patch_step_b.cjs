const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// 1. Remove import
code = code.replace(/import VoiceRecorder from "\.\/shared\/VoiceRecorder";\n?/, '');

// 2. Remove standard VoiceRecorder lines
code = code.replace(/.*<VoiceRecorder renderMode="compact-button".*\/>\n?/g, '');

// 3. Remove VoiceRecorder block from Chief Complaint
code = code.replace(/<span className="text-\[10px\] text-slate-400">Microphone dictation supported<\/span>/, '');
code = code.replace(/className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-950/g, 'className="w-full px-3 py-2 bg-white dark:bg-slate-950');
code = code.replace(/<div className="absolute right-2 bottom-3">[\s\S]*?<\/div>/, '');

// 4. Remove Rounds Chat Mic toggle
const roundsRegex = /{roundsUserMessage\.trim\(\) === "" \? \([\s\S]*?\) : \([\s\S]*?<button[\s\S]*?onClick=\{\(\) => handleRoundsChatSend\(\)\}[\s\S]*?className=\{`w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer`\}[\s\S]*?title="Send message"[\s\S]*?>[\s\S]*?<Send className="w-4\.5 h-4\.5" \/>[\s\S]*?<\/button>[\s\S]*?\)}/;

code = code.replace(roundsRegex, `<button
                          type="button"
                          onClick={() => handleRoundsChatSend()}
                          disabled={roundsChatLoading || roundsUserMessage.trim() === ""}
                          className={\`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md \${roundsUserMessage.trim() === "" ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 cursor-pointer"}\`}
                          title="Send message"
                        >
                          <Send className="w-4.5 h-4.5" />
                        </button>`);

// 5. Remove Voice Dictation Modal
// Look for "{/* 1. Voice Dictation Modal Simulation  */}" up to "{/* 2. Document Scanning Modal Simulation  */}"
const modalRegex = /\{\/\* 1\. Voice Dictation Modal Simulation  \*\/\}\n[\s\S]*?(?=\{\/\* 2\. Document Scanning Modal Simulation  \*\/\})/
code = code.replace(modalRegex, '');

// 6. Remove Voice States and Functions
// From `const [isDictating, setIsDictating] = useState(false);` 
// to `const toggleRecording = () => { ... }` inclusive
const statesRegex = /const \[isDictating, setIsDictating\] = useState\(false\);[\s\S]*?const toggleRecording = \(\) => \{\n\s*if \(isListening\) \{\n\s*stopRecording\(\);\n\s*\} else \{\n\s*startRecording\(\);\n\s*\}\n\s*\};\n/
code = code.replace(statesRegex, '');

// Remove handleVoiceSubmit
const voiceSubmitRegex = /\s*\/\/ AI Voice Dictation trigger\n\s*const handleVoiceSubmit = async \(\) => \{[\s\S]*?finally \{\n\s*setAiLoading\(false\);\n\s*\}\n\s*\};\n/
code = code.replace(voiceSubmitRegex, '');

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
