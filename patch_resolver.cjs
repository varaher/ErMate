const fs = require('fs');

let content = fs.readFileSync('src/utils/workspaceResolver.ts', 'utf8');

const oldCheck = `        if (!hospitalId || hospitalId.trim() === "") {
          throw new Error("Active membership is missing hospital ID. Cannot safely create hospital case.");
        }`;

const newCheck = `        if (!hospitalId || hospitalId.trim() === "") {
          throw new Error("Active membership is missing hospital ID. Cannot safely create hospital case.");
        }

        const validRoles = ["hod", "consultant", "resident"];
        if (!data.role || !validRoles.includes(data.role.toLowerCase())) {
          console.warn(\`[Administrative Warning] User \${uid} has active membership for \${hospitalId} but role '\${data.role}' is malformed or missing.\`);
        }`;

content = content.replace(oldCheck, newCheck);
fs.writeFileSync('src/utils/workspaceResolver.ts', content);
