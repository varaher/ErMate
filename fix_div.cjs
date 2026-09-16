const fs = require('fs');
let code = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf8');

// Find the modal comment
const modalComment = '{/* 1. Voice Dictation Modal Simulation  */}';
const modalIndex = code.indexOf(modalComment);

if (modalIndex !== -1) {
    // Find the nearest closing div before it
    const beforeModal = code.slice(0, modalIndex);
    const lastDivIndex = beforeModal.lastIndexOf('</div>');
    
    if (lastDivIndex !== -1) {
        code = code.slice(0, lastDivIndex) + code.slice(lastDivIndex + 6);
        fs.writeFileSync('src/components/CaseSheetView.tsx', code);
        console.log("Removed extra closing div!");
    }
}
