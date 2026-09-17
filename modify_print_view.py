import re

with open('src/components/CaseSheetPrintView.tsx', 'r') as f:
    content = f.read()

# 1. Add to CaseSheetData interface
new_fields = '''
  safetyAndAccreditation: {
    ipsg: string[];
    vulnerability: string[];
    fallRisk: string | null;
    consentTimeOut: string[];
  } | null;
'''
content = re.sub(r'(  notes: \{ progressNotes: string \| null; addendum: string \| null \};)', r'\1\n' + new_fields, content)

# 2. Extract Safety Data in convertClinicalCaseToCaseSheetData
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

content = re.sub(r'(  return \{\n    patient: \{)', extract_logic + r'\n\1', content)

content = re.sub(r'(    notes: \{ progressNotes: c\.progressNotes \|\| null, addendum: c\.addendumNotes \|\| null \},)', r'\1\n    safetyAndAccreditation,', content)

# 3. Add SafetyAndAccreditationSection component
safety_component = '''
function SafetyAndAccreditationSection({ data }: { data: CaseSheetData["safetyAndAccreditation"] }) {
  if (!data) return null;

  return (
    <Section>
      <SectionHeading>Safety & Accreditation</SectionHeading>
      <div className="space-y-3">
        {(data.ipsg.length > 0 || data.fallRisk) && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Patient Safety Goals</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {data.ipsg.map((item, i) => <li key={i}>{item}</li>)}
              {data.fallRisk && <li>Fall risk: <span className="font-semibold">{data.fallRisk}</span></li>}
            </ul>
          </div>
        )}
        
        {data.vulnerability.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Vulnerability Screening</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {data.vulnerability.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {data.consentTimeOut.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">Consent / Time-Out</p>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {data.consentTimeOut.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
'''
content = re.sub(r'(export default function CaseSheetPrintView)', safety_component + r'\n\1', content)

# 4. Render it before Disposition
content = re.sub(r'(            <Section>\s*<SectionHeading>Disposition & Outcome</SectionHeading>)', r'            <SafetyAndAccreditationSection data={data.safetyAndAccreditation} />\n\n\1', content)

with open('src/components/CaseSheetPrintView.tsx', 'w') as f:
    f.write(content)

