import re
with open("src/components/DischargeSummaryView.tsx", "r") as f:
    text = f.read()

def object_to_string(match):
    return """const _safeCourseInHospital = (course: any) => {
    if (!course) return "";
    if (typeof course === 'string') return course;
    if (typeof course === 'object') return Object.values(course).filter(v => typeof v === 'string').join("\\n\\n");
    return String(course);
  };

  const [courseInHospital, setCourseInHospital] = useState(
    _safeCourseInHospital(currentCase.dischargeInfo?.courseInHospital) || currentCase.progressNotes || ""
  );"""

text = re.sub(r'const \[courseInHospital, setCourseInHospital\] = useState\([\s\n]*currentCase\.dischargeInfo\?\.courseInHospital \|\| currentCase\.progressNotes \|\| ""[\s\n]*\);', object_to_string, text)

# fix the AI response handling
def fix_ai_response(match):
    return """if (resData.data.courseInHospital) {
          setCourseInHospital(_safeCourseInHospital(resData.data.courseInHospital));
        }"""

text = re.sub(r'if \(resData\.data\.courseInHospital\) setCourseInHospital\(resData\.data\.courseInHospital\);', fix_ai_response, text)

with open("src/components/DischargeSummaryView.tsx", "w") as f:
    f.write(text)

