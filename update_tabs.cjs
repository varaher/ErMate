const fs = require('fs');
let content = fs.readFileSync('src/components/CaseSheetView.tsx', 'utf-8');

const regexMap = [
  {
    find: /\{activeTab === "history" && \(\s*<div className="space-y-6">/,
    replace: `{activeTab === "history" && (\n            <div className="space-y-6">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  },
  {
    find: /\{activeTab === "primary-survey" && \(\s*<PrimarySurveySection/,
    replace: `{activeTab === "primary-survey" && (\n            <div className="space-y-4">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>\n              <PrimarySurveySection`
  },
  {
    find: /\{activeTab === "primary-survey" && \([\s\S]*?<\/PrimarySurveySection>\s*\n\s*\)/,
    replace: (match) => match.replace('</PrimarySurveySection>\n          )', '</PrimarySurveySection>\n            </div>\n          )')
  },
  {
    find: /\{activeTab === "secondary-survey" && \(\s*<div className="space-y-4">/,
    replace: `{activeTab === "secondary-survey" && (\n            <div className="space-y-4">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  },
  {
    find: /\{activeTab === "investigations" && \(\s*<div className="space-y-6">/,
    replace: `{activeTab === "investigations" && (\n            <div className="space-y-6">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  },
  {
    find: /\{activeTab === "treatment" && \(\s*<div className="space-y-6">/,
    replace: `{activeTab === "treatment" && (\n            <div className="space-y-6">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  },
  {
    find: /\{activeTab === "notes" && \(\s*<div className="space-y-6">/,
    replace: `{activeTab === "notes" && (\n            <div className="space-y-6">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  },
  {
    find: /\{activeTab === "disposition" && \(\s*<div className="space-y-6">/,
    replace: `{activeTab === "disposition" && (\n            <div className="space-y-6">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  },
  {
    find: /\{activeTab === "trends" && \(\s*<div className="space-y-4">/,
    replace: `{activeTab === "trends" && (\n            <div className="space-y-4">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  },
  {
    find: /\{activeTab === "debrief" && \(\s*<div className="space-y-6">/,
    replace: `{activeTab === "debrief" && (\n            <div className="space-y-6">\n              <div className="flex justify-end"><SaveSectionButton onSave={handleSave} /></div>`
  }
];

regexMap.forEach(item => {
  content = content.replace(item.find, item.replace);
});

fs.writeFileSync('src/components/CaseSheetView.tsx', content);
