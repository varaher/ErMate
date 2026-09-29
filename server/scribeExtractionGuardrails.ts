export const SCRIBE_EXTRACTION_GUARDRAILS = `

ERMATE CLINICAL EXTRACTION GUARDRAILS — THESE RULES OVERRIDE ANY CONFLICTING EXTRACTION BEHAVIOUR:

ZERO INVENTION
- Extract ONLY information explicitly present in the doctor's current transcript.
- Do not infer normal findings, negative findings, diagnoses, GCS totals, medications,
  procedures, history, psychology fields, or examination findings.
- If uncertain or contradictory, preserve the stated information rather than resolving it.

PRESENTING COMPLAINT
- chiefComplaint/presentingComplaint must contain the actual reason for presentation.
- Do not leave it empty when the doctor explicitly describes symptoms such as weakness,
  chest pain, fever, breathlessness, trauma, abdominal pain, etc.

GCS
- A component alone is NOT a total GCS.
- "GCS E4" means eye response E4 only.
- If only E4, V5, or M6 individually is stated, vitals.gcs MUST be null.
- Populate total GCS only when the doctor explicitly states a total such as "GCS 15"
  OR all three E/V/M components are explicitly available.
- Never convert E4 alone into GCS 15.

EVENTS PRECEDING
- events means the explicit pre-arrival event/circumstance immediately preceding presentation.
- Examples:
  "found lying on the floor at home",
  "two-wheeler hit by car",
  "snake bite while working in field",
  "chest pain started while climbing stairs",
  "found unconscious in bathroom".
- May use explicitly stated place/date/time together with that event.
- Do NOT use a symptom such as "amnesia", "pain", "nausea" or "weakness" by itself as events.
- Do NOT include ER treatment, investigations, consultations, observation or disposition.
- If there is no explicit preceding event, return null.

SECONDARY SURVEY — STRICT FIELD BOUNDARIES

generalExamination:
- ONLY general examination findings.
- Stop when CVS/systemic examination/respiratory/chest/abdomen/CNS/extremities starts.

cvsExamination:
- ONLY cardiovascular examination findings.
- Example: "S1 S2 normal".
- NEVER include chest expansion, respiratory findings, abdominal findings or CNS findings.

respiratoryExamination:
- ONLY respiratory/chest examination findings.
- Example: "normal chest expansion".
- NEVER include abdomen or CNS findings.

abdomenExamination:
- ONLY abdominal EXAMINATION findings.
- Example: "soft and non-distended", "suprapubic tenderness".
- The word "abdomen" appearing in an identification mark, scar, injury description,
  FAST finding, imaging report, procedure, history or any unrelated narrative MUST NOT
  start abdomenExamination.
- NEVER copy earlier transcript text into abdomenExamination.

cnsExamination:
- ONLY neurological/CNS examination findings.
- Preserve explicit weakness, power findings and contradictions exactly.
- If "no focal neurological deficit" is dictated AND focal weakness is also dictated,
  preserve both; do not silently resolve the contradiction.

extremitiesExamination:
- ONLY extremity examination findings.

PSYCHOLOGICAL ASSESSMENT
- Capture ONLY explicitly dictated psychological positives or negatives.
- Never replace a partial assessment with the word "Normal".
- Never invent:
  self-harm history,
  intent to harm others,
  psychiatric history,
  psychiatric treatment,
  support system,
  or "Notes: Normal"
  unless specifically stated.

INVESTIGATIONS VS TREATMENT
- Imaging tests belong only under investigations/imaging.
- Monitoring, medications, observation and symptomatic management are treatment/plan,
  not imaging.
- Do not place treatment text inside CT/X-ray/MRI/USG fields.

ECG
- If the doctor only says "ECG" or "ECG done", record that ECG was obtained/done.
- Do not invent rhythm or interpretation.

NORMAL STATEMENTS
- A finding may be treated as normal only within the exact scope the doctor called normal.
- "Breathing normal" applies to breathing only.
- "Secondary survey normal" may represent the approved secondary-survey normal template.
- Do not extend a normal statement into unrelated sections.
`;
