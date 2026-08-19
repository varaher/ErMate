import re
with open("src/components/CaseSheetView.tsx", "r") as f:
    text = f.read()

imports = """import { 
  PediatricAirwaySection,
  PediatricBreathingSection,
  PediatricCirculationSection,
  PediatricDisabilitySection,
  PediatricExposureSection,
  PediatricEfastSection,
  PediatricFocusedPhysicalExam,
  PediatricGeneralExamSection,
  PediatricQuickNormalPresets,
  PEDIATRIC_NORMAL_PRESETS,
  PediatricDispositionSection
} from "./PediatricABCDESections";
"""

# Insert imports
text = text.replace('import { PrimarySurveySection } from "./PrimarySurveySection";', imports + 'import { PrimarySurveySection } from "./PrimarySurveySection";')

with open("src/components/CaseSheetView.tsx", "w") as f:
    f.write(text)
