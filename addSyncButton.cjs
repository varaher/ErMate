const fs = require('fs');
let code = fs.readFileSync('src/components/TeamRosterBoard.tsx', 'utf8');

const importStatement = `import { WorkspaceRotaSyncModal } from "./shared/WorkspaceRotaSyncModal";\n`;
if (!code.includes('WorkspaceRotaSyncModal')) {
  // inject import at the top
  code = code.replace('import React', importStatement + 'import React');
  
  // add state
  const stateRegex = /const \[isAddingNewShift, setIsAddingNewShift\] = useState\(false\);/;
  if (stateRegex.test(code)) {
    code = code.replace(stateRegex, 'const [isAddingNewShift, setIsAddingNewShift] = useState(false);\n  const [showWorkspaceSync, setShowWorkspaceSync] = useState(false);\n');
  } else {
    // fallback
    const firstState = /const \[addShiftName, setAddShiftName\]/;
    code = code.replace(firstState, 'const [showWorkspaceSync, setShowWorkspaceSync] = useState(false);\n  const [addShiftName, setAddShiftName]');
  }

  // add button
  const addShiftBtnRegex = /<button\s+type="button"\s+onClick=\{[^}]+\}\s+className="px-3\.5 py-2 bg-indigo-600[^"]+"[^>]*>[\s\S]*?<\/button>/;
  const syncBtn = `
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceSync(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  <span>Sync via Workspace</span>
                </button>
  `;
  
  const modifiedCode = code.replace(addShiftBtnRegex, match => syncBtn + match + '\n              </div>');
  
  // add modal to the bottom
  const modalComponent = `
      {showWorkspaceSync && (
        <WorkspaceRotaSyncModal
          onClose={() => setShowWorkspaceSync(false)}
          onSuccess={(count) => {
             setShowWorkspaceSync(false);
             alert(\`Successfully synced \${count} shifts to Google Calendar!\`);
          }}
        />
      )}
    </div>
  `;
  code = modifiedCode.replace(/<\/div>\s*$/, modalComponent);
  
  fs.writeFileSync('src/components/TeamRosterBoard.tsx', code);
  console.log("Added button and modal successfully.");
} else {
  console.log("Already added");
}
