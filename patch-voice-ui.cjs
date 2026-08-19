const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const oldMapCode = `{Object.entries(msg.extractionData).map(([key, val]) => (
                      <div key={key}>
                        <strong className="text-slate-800 dark:text-slate-200">{key}:</strong>{" "}
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </div>
                    ))}`;

const newMapCode = `{Object.entries(msg.extractionData)
                      .filter(([key, val]) => {
                        if (key === 'isPediatric') return false;
                        if (val === null || val === undefined || val === '') return false;
                        if (Array.isArray(val) && val.length === 0) return false;
                        if (typeof val === 'object' && Object.keys(val).length === 0) return false;
                        return true;
                      })
                      .map(([key, val]) => {
                        let displayVal = "";
                        if (Array.isArray(val)) {
                          displayVal = val.map(item => {
                            if (typeof item === 'object' && item !== null) {
                              return Object.values(item).filter(v => v !== null && v !== '').join(' ');
                            }
                            return String(item);
                          }).join(', ');
                        } else if (typeof val === 'object' && val !== null) {
                          displayVal = Object.entries(val)
                            .filter(([k, v]) => v !== null && v !== '')
                            .map(([k, v]) => \`\${k}: \${v}\`)
                            .join(', ');
                        } else {
                          displayVal = String(val);
                        }
                        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        return (
                          <div key={key}>
                            <strong className="text-slate-800 dark:text-slate-200">{displayKey}:</strong>{" "}
                            {displayVal}
                          </div>
                        );
                      })}`;

code = code.replace(oldMapCode, newMapCode);

// Also change "✓ Applied to Case Sheet" to "✅ Copied to Case Sheet" to match what user asked
code = code.replace(
  /msg\.extractionApplied \? "✓ Applied to Case Sheet" : "Copy to Case Sheet"/,
  `msg.extractionApplied ? "✅ Copied to Case Sheet" : "Copy to Case Sheet"`
);

// We can also add a success toast on handleApplyExtraction
// Let's see what it has
fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code);
console.log("Patched UI!");
