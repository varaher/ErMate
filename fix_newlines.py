import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

text = text.replace('secondaryAssessment: (prev.secondaryAssessment || "") + "" + preset.text', 'secondaryAssessment: (prev.secondaryAssessment || "") + "\\n\\n" + preset.text')

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.write(text)

