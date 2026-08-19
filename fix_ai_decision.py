import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

replacement = """      if (resData.success || resData.data) {
        setCurrentCase(prev => ({
          ...prev,
          differentials: resData.data
        }));
      } else {
        alert(resData.error || "Clinical assistant busy — try again in a moment");
      }"""

text = re.sub(r'      if \(resData\.success \|\| resData\.data\) \{\n        setCurrentCase\(prev => \(\{\n          \.\.\.prev,\n          differentials: resData\.data\n        \}\)\);\n      \}', replacement, text)

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.write(text)

