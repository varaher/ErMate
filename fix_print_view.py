import re

with open('src/components/CaseSheetPrintView.tsx', 'r') as f:
    content = f.read()

extract_logic = '''
  // Safety & Accreditation extraction
  const ipsgList: string[] = [];
  if (c.ipsgChecklist?.ipsg1IdentifiersVerified) ipsgList.push("Patient identifiers verified");
  if (c.ipsgChecklist?.ipsg2ReadBackPerformed) ipsgList.push("Verbal order read-back performed");
  if (c.ipsgChecklist?.ipsg3HighAlertDoubleChecked) ipsgList.push("High-alert meds double-checked");
  if (c.ipsgChecklist?.ipsg4TimeOutPerformed) ipsgList.push("Time-Out performed");
  if (c.ipsgChecklist?.ipsg5HandHygieneComplied) ipsgList.push("Hand hygiene complied");

  const fallRisk = c.ipsgChecklist?.ipsg6FallRiskAssessed || null;

  const vulnList: string[] = [];
  if (c.vulnerableAssessment?.severePainDistress) vulnList.push("Severe pain/distress identified");
  if (c.vulnerableAssessment?.isAlertOriented === false) vulnList.push("Impaired mental alertness");
  if (c.vulnerableAssessment?.suicidalIdeationRisk) vulnList.push("Psychiatric/suicidal risk");
  if (c.vulnerableAssessment?.confusionAgitation) vulnList.push("Active confusion or agitation");
  if (c.vulnerableAssessment?.needsMobilityAssistance) vulnList.push("Mobility assistance required");
  if (c.vulnerableAssessment?.recentFall) vulnList.push("Recent fall incidents");

  const consentList: string[] = [];
  if (c.consentTimeOut?.procedureConsentObtained) consentList.push("Written informed consent verified");
  if (c.consentTimeOut?.procedureTimeOutPerformed) consentList.push("Procedure time-out completed");

  let safetyAndAccreditation = null;
  if (ipsgList.length > 0 || vulnList.length > 0 || consentList.length > 0 || fallRisk) {
    safetyAndAccreditation = {
      ipsg: ipsgList,
      vulnerability: vulnList,
      fallRisk: fallRisk,
      consentTimeOut: consentList
    };
  }
'''

content = re.sub(r'(  return \{\n    caseId:)', extract_logic + r'\n\1', content)

with open('src/components/CaseSheetPrintView.tsx', 'w') as f:
    f.write(content)

