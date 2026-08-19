import re
with open("server.ts", "r") as f:
    text = f.read()

fixed = text.replace(
'''  const baseSysInstruction = "You generate JCI and NABH compliant professional clinical discharge summaries in structured JSON only. Strictly adhere to facts in the patient record without adding fictional details.";
  const dischargeSchema = {
    primaryDiagnosis: "", secondaryDiagnosis: "", conditionAtDischarge: "",
    dischargeMedications: "", followUpPlan: "", patientInstructions: "",
    courseInHospital: "", dischargeNarrative: "", patientAdvice: ""
  };
  const sysInstruction = baseSysInstruction + " Respond with ONLY valid JSON matching this exact shape: " + JSON.stringify(dischargeSchema);
    primaryDiagnosis: "", secondaryDiagnosis: "", conditionAtDischarge: "",
    dischargeMedications: "", followUpPlan: "", patientInstructions: "",
    courseInHospital: "", dischargeNarrative: "", patientAdvice: ""
  };

  // ── STEP 2: Claude 3.5 Sonnet PRIMARY ──''',
'''  const sysInstruction = "You generate JCI and NABH compliant professional clinical discharge summaries in structured JSON only. Strictly adhere to facts in the patient record without adding fictional details.";
  const dischargeSchema = {
    primaryDiagnosis: "", secondaryDiagnosis: "", conditionAtDischarge: "",
    dischargeMedications: "", followUpPlan: "", patientInstructions: "",
    courseInHospital: "", dischargeNarrative: "", patientAdvice: ""
  };
  const finalSysInstruction = sysInstruction + " Respond with ONLY valid JSON matching this exact shape: " + JSON.stringify(dischargeSchema);

  // ── STEP 2: Claude 3.5 Sonnet PRIMARY ──'''
)

fixed = fixed.replace('system: sysInstruction + " Respond with ONLY valid JSON matching this exact shape: " + JSON.stringify(dischargeSchema),', 'system: finalSysInstruction,')
fixed = fixed.replace('{ role: "system", content: sysInstruction },', '{ role: "system", content: finalSysInstruction },')

with open("server.ts", "w") as f:
    f.write(fixed)

