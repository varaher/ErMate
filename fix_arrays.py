import re
with open("src/components/DischargeSummaryView.tsx", "r") as f:
    text = f.read()

def fix_medications(match):
    return """const _safeStringFromMixed = (val: any) => {
    if (!val) return "";
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join("\\n");
    if (typeof val === 'object') return Object.values(val).filter(v => typeof v === 'string').join("\\n");
    return String(val);
  };

  const [dischargeMedications, setDischargeMedications] = useState(
    _safeStringFromMixed(currentCase.dischargeInfo?.dischargeMedications) || (currentCase.treatments && currentCase.treatments.length > 0 ? currentCase.treatments.map((t, idx) => `${idx + 1}. ${t.drugName} ${t.dose || ""} (${t.route || ""}) - ${t.timeGiven || "Given in ER"}`).join("\\n") : "")
  );"""

text = re.sub(r'const \[dischargeMedications, setDischargeMedications\] = useState\([\s\n]*currentCase\.dischargeInfo\?\.dischargeMedications \|\|.*?\) : ""\)[\s\n]*\);', fix_medications, text, flags=re.DOTALL)

def fix_ai_responses(match):
    return """if (resData.data.dischargeMedications) setDischargeMedications(_safeStringFromMixed(resData.data.dischargeMedications));"""

text = re.sub(r'if \(resData\.data\.dischargeMedications\) setDischargeMedications\(resData\.data\.dischargeMedications\);', fix_ai_responses, text)


with open("src/components/DischargeSummaryView.tsx", "w") as f:
    f.write(text)

