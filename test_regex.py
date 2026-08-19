import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

pattern = r'\{\/\* Patient Demographics & Disposition Tab \(Accreditation Level\)  \*\/\}\s*\{activeTab === "disposition" && \(\s*<div className="space-y-6">\s*<div className="flex justify-end mb-2"><SaveSectionButton onSave=\{handleSave\} /></div>\s*<div>\s*<h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2 flex items-center gap-1\.5">\s*<User className="w-4 h-4 text-blue-500" />\s*Demographics & Registration Details\s*</h3>'

match = re.search(pattern, text)
print("Matched!" if match else "No match")
