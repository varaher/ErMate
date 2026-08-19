const fs = require('fs');
let code = fs.readFileSync('src/components/TeamRosterBoard.tsx', 'utf8');

if (!code.includes('<WorkspaceRotaSyncModal')) {
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
  );
}
`;
  code = code.replace(/<\/div>\s*\);\s*\}\s*$/, modalComponent);
  fs.writeFileSync('src/components/TeamRosterBoard.tsx', code);
  console.log("Fixed footer");
} else {
  console.log("Already fixed");
}
