with open("src/components/CaseSheetView.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "secondaryAssessment: [gen, cns, cvs, rs, pa, ext].join(" in line:
        new_lines.append('                              secondaryAssessment: [gen, cns, cvs, rs, pa, ext].join("\\n\\n")\n')
        skip = True
        continue
    
    if skip:
        if "}));" in line:
            new_lines.append(line)
            skip = False
        continue
    new_lines.append(line)

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.writelines(new_lines)
