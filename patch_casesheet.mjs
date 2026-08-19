import fs from 'fs';
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');

// 1. Remove the "Rounds" tab from the tab bar
code = code.replace('{ id: "rounds", label: "🎓 Rounds", icon: Sparkles },', '');

// 2. We can leave the rendering of `activeTab === "rounds"` in there just in case, or remove it.
// It's a huge block of code. Let's not risk a bad regex, just let it be dead code, or we can replace the tab with null.

// 3. Remove showPostSaveModal UI.
// The post save modal starts at: `{/* 3. Post-Save Clinical Debrief Nudge Modal */}`
// and goes until the end of the `showPostSaveModal` block.
// Wait, I can just change `setShowPostSaveModal(true)` to not do that.
code = code.replace(/setShowPostSaveModal\(true\)/g, '/* setShowPostSaveModal(true) removed */');

fs.writeFileSync('src/components/CaseSheetView.tsx', code);
