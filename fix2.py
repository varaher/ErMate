import re
with open("server.ts", "r") as f:
    text = f.read()

# find everything from '  const baseSysInstruction =' to '  // ── STEP 2: Claude 3.5 Sonnet PRIMARY ──'
pattern = re.compile(r'  const baseSysInstruction = .*?// ── STEP 2: Claude 3.5 Sonnet PRIMARY ──', re.DOTALL)
replacement = """  const sysInstruction = "You generate JCI and NABH compliant professional clinical discharge summaries in structured JSON only. Strictly adhere to facts in the patient record without adding fictional details.";
  const dischargeSchema = {
    primaryDiagnosis: "", secondaryDiagnosis: "", conditionAtDischarge: "",
    dischargeMedications: "", followUpPlan: "", patientInstructions: "",
    courseInHospital: "", dischargeNarrative: "", patientAdvice: ""
  };
  const finalSysInstruction = sysInstruction + " Respond with ONLY valid JSON matching this exact shape: " + JSON.stringify(dischargeSchema);

  // ── STEP 2: Claude 3.5 Sonnet PRIMARY ──"""

text = pattern.sub(replacement, text)

with open("server.ts", "w") as f:
    f.write(text)

