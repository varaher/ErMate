const fs = require('fs');
let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

const oldMyCases = `      const myCases = cases.filter(c => c.doctorEmail?.toLowerCase().trim() === profile.email.toLowerCase().trim());
      const hasRealLogs = myCases.length > 0;
      const activeLogs = myCases;`;

const newMyCases = `      const legacyCases = cases.filter(c => c.doctorEmail?.toLowerCase().trim() === profile.email.toLowerCase().trim());
      
      const unifiedLogs = [];
      const seenSourceIds = new Set();
      
      logbookEntries.forEach(entry => {
        unifiedLogs.push({
          id: entry.entryId,
          isSnapshot: true,
          dateSeen: entry.dateSeen || entry.createdAt.split('T')[0],
          ageGroup: entry.ageGroup || null,
          gender: entry.gender || null,
          triageCategory: entry.triageCategory || null,
          caseCategory: entry.caseCategory || null,
          procedures: entry.proceduresPerformed || [],
          hospitalNameAtTime: entry.hospitalNameAtTime || null,
          sourceCaseId: entry.sourceCaseId || null
        });
        if (entry.sourceCaseId) seenSourceIds.add(entry.sourceCaseId);
      });
      
      legacyCases.forEach(c => {
        if (!seenSourceIds.has(c.id)) {
           unifiedLogs.push({
             id: c.id,
             isSnapshot: false,
             dateSeen: c.savedTime ? c.savedTime.split('T')[0] : (c.patient.dateOpened || null),
             ageGroup: c.isPediatric ? "pediatric" : "adult",
             gender: c.patient.gender || null,
             triageCategory: c.patient.triageCategory || null,
             caseCategory: c.patient.caseType || c.provisionalPrimaryDiagnosis || null,
             procedures: getCaseProcedures(c),
             hospitalNameAtTime: c.hospital || null,
             sourceCaseId: c.id
           });
        }
      });
      
      unifiedLogs.sort((a, b) => new Date(b.dateSeen || 0).getTime() - new Date(a.dateSeen || 0).getTime());
      
      const hasRealLogs = unifiedLogs.length > 0;
      const activeLogs = unifiedLogs;`;

content = content.replace(oldMyCases, newMyCases);

fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
