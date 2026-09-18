const fs = require('fs');
let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

const regex = /\/\/ Stats computations[\s\S]*?link\.click\(\);\n        document\.body\.removeChild\(link\);\n      \};/;

const newStats = `      // Stats computations
      const totalCasesCount = activeLogs.length;
      const p1Count = activeLogs.filter(c => c.triageCategory?.includes("P1")).length;
      const p2Count = activeLogs.filter(c => c.triageCategory?.includes("P2")).length;
      const p3Count = activeLogs.filter(c => c.triageCategory?.includes("P3")).length;

      // Procedures counts
      const procMap: Record<string, number> = {};
      let totalProcsPerformed = 0;
      activeLogs.forEach(c => {
        (c.procedures || []).forEach((p: string) => {
          procMap[p] = (procMap[p] || 0) + 1;
          totalProcsPerformed++;
        });
      });
      const uniqueProcsCount = Object.keys(procMap).length;

      const handleCSVExport = () => {
        const headers = [
          "Date Seen", 
          "Snapshot Type",
          "Hospital/Clinic",
          "Age Group", 
          "Gender", 
          "Triage Level", 
          "Case Category", 
          "Procedures Performed"
        ];

        const rows = activeLogs.map(c => [
          c.dateSeen || "",
          c.isSnapshot ? "Verified Record" : "Legacy Local",
          c.hospitalNameAtTime || "Independent",
          c.ageGroup || "N/A",
          c.gender || "N/A",
          c.triageCategory || "N/A",
          c.caseCategory || "General Case",
          (c.procedures || []).join("; ")
        ]);

        const csvContent = [headers, ...rows].map(e => e.map(val => \`"\${String(val).replace(/"/g, '""')}"\`).join(",")).join("\\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", \`ErMate_Logbook_\${profile.name.replace(/\\s+/g, "_")}.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };`;

content = content.replace(regex, newStats);
fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
