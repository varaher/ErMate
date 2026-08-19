const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const componentsToLazyLoad = [
  "DashboardView",
  "CasesListView",
  "CaseSheetView",
  "CaseSheetPrintView",
  "DischargeSummaryView",
  "TriageForm",
  "LearnView",
  "ProfileSettingsView",
  "MockLoginView",
  "VoiceScribeChatView",
  "SignUpView",
  "ForgotPasswordView",
  "PediatricDrugCalculatorView",
  "ErGuideView",
  "AnalyticsView",
  "HandoverView",
  "PocketMirrorView",
  "QuickDischargeIntake",
  "AdminPanelView",
  "DoctorsDirectoryView"
];

// Replace static imports with React.lazy
componentsToLazyLoad.forEach(component => {
  const importRegex = new RegExp(`import ${component} from "\\./components/${component}";`, "g");
  content = content.replace(importRegex, `const ${component} = React.lazy(() => import("./components/${component}"));`);
});

// Also make sure Suspense is in the react import
if (!content.includes('Suspense')) {
  content = content.replace(/import React, \{ useState, useEffect, useRef \} from "react";/, 'import React, { useState, useEffect, useRef, Suspense } from "react";');
}

fs.writeFileSync('src/App.tsx', content);
