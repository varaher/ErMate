/**
 * src/utils/caseDebrief.ts
 *
 * ErMate Case Discuss Concise Debrief Generator & Session Migration Engine.
 *
 * Generates concise, factual, 40-100 word 2-4 sentence debriefs from documented
 * clinical facts without tables, markdown headers, gap analysis, or menu lists.
 * Strictly adheres to zero-fabrication clinical rules: never invents normal vitals,
 * normal ABCDE, GCS 15, or unstated treatments.
 */

import type { ClinicalCase } from '../types';
import type { ChatMessage, ChatContext } from '../hooks/useBoundChat';

/**
 * Checks if a case contains meaningful clinical documentation.
 */
export function isMeaningfulCase(c: any): boolean {
  if (!c) return false;

  const complaint = (c.patient?.presentingComplaint || c.chiefComplaint || '').trim();
  const isDefaultComplaint =
    !complaint ||
    complaint.toLowerCase() === 'emergency presentation' ||
    complaint.toLowerCase() === 'acute presentation' ||
    complaint.toLowerCase() === 'under evaluation';

  const hasAge = c.patient?.age !== null && c.patient?.age !== undefined && c.patient?.age !== '';
  const hasGender = !!c.patient?.gender && c.patient?.gender !== 'Unknown';

  const vitals = c.vitals || {};
  const hasVitals = Object.values(vitals).some(
    v => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A'
  );

  const sample = c.sampleHistory || {};
  const hasSample = Object.values(sample).some(
    v => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A' && String(v).trim() !== 'NKDA'
  );

  const pri = c.primaryAssessment || {};
  const hasPrimaryExam = !!(
    (pri.airway && pri.airwayStatus === 'Abnormal') ||
    (pri.breathing && pri.breathingStatus === 'Abnormal') ||
    (pri.circulation && pri.circulationStatus === 'Abnormal') ||
    (pri.disability && pri.disabilityStatus === 'Abnormal') ||
    (pri.exposure && pri.exposureStatus === 'Abnormal') ||
    (pri.airway && !pri.airway.toLowerCase().includes('patent') && pri.airway.length > 5) ||
    (pri.breathing && !pri.breathing.toLowerCase().includes('normal') && pri.breathing.length > 5) ||
    (pri.disability && !pri.disability.toLowerCase().includes('normal') && pri.disability.length > 5)
  );

  const sec = c.secondarySurvey || {};
  const hasSecondaryExam = Object.values(sec).some(
    v => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A'
  );
  const hasSecAssessment = !!c.secondaryAssessment && c.secondaryAssessment.trim() !== '';

  const hasInvestigations =
    (Array.isArray(c.investigations) && c.investigations.length > 0) ||
    (Array.isArray(c.investigationResults) && c.investigationResults.length > 0) ||
    !!(c.investigationResultsSummary && c.investigationResultsSummary.trim());

  const hasTreatments =
    (Array.isArray(c.treatments) && c.treatments.length > 0) ||
    (Array.isArray(c.procedureNotes) && c.procedureNotes.length > 0) ||
    !!(c.treatmentNotes && c.treatmentNotes.trim());

  const hasDiagnosis =
    !!(c.provisionalPrimaryDiagnosis && c.provisionalPrimaryDiagnosis.trim()) ||
    !!(c.dischargeInfo?.primaryDiagnosis && c.dischargeInfo.primaryDiagnosis.trim() && c.dischargeInfo.primaryDiagnosis !== 'Under Evaluation') ||
    (Array.isArray(c.differentials) && c.differentials.length > 0);

  const hasProgress = !!(c.progressNotes && c.progressNotes.trim() && !c.progressNotes.includes('No progress notes'));
  const hasTriage = !!(c.patient?.triageCategory && c.patient?.triageCategory.trim());
  const hasCaseType = !!(c.patient?.caseType && c.patient?.caseType.trim());

  return (
    !isDefaultComplaint ||
    hasAge ||
    hasGender ||
    hasVitals ||
    hasSample ||
    hasPrimaryExam ||
    hasSecondaryExam ||
    hasSecAssessment ||
    hasInvestigations ||
    hasTreatments ||
    hasDiagnosis ||
    hasProgress ||
    hasTriage ||
    hasCaseType
  );
}

/**
 * Checks if a case is only minimally documented (e.g. only triage or case type, without history/vitals/exam).
 */
export function isMinimallyDocumentedCase(c: any): boolean {
  if (!c || !isMeaningfulCase(c)) return false;

  const complaint = (c.patient?.presentingComplaint || c.chiefComplaint || '').trim();
  const isDefaultComplaint =
    !complaint ||
    complaint.toLowerCase() === 'emergency presentation' ||
    complaint.toLowerCase() === 'acute presentation' ||
    complaint.toLowerCase() === 'under evaluation';

  const vitals = c.vitals || {};
  const hasVitals = Object.values(vitals).some(
    v => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A'
  );

  const hasInvestigations = Array.isArray(c.investigations) && c.investigations.length > 0;
  const hasTreatments = (Array.isArray(c.treatments) && c.treatments.length > 0) || (Array.isArray(c.procedureNotes) && c.procedureNotes.length > 0);
  const hasDiagnosis = !!(c.provisionalPrimaryDiagnosis && c.provisionalPrimaryDiagnosis.trim());

  const sec = c.secondarySurvey || {};
  const hasSecExam = Object.values(sec).some(v => v !== null && v !== undefined && String(v).trim() !== '');

  // If complaint is missing/default and no vitals, no exam, no investigations, no treatments, no diagnosis
  return isDefaultComplaint && !hasVitals && !hasInvestigations && !hasTreatments && !hasDiagnosis && !hasSecExam;
}

/**
 * Generates the concise factual Case Discuss opening debrief.
 */
export function generateDiscussCaseDebrief(c: any, pending?: any): string {
  if (!c || !isMeaningfulCase(c)) {
    return 'Ask me anything about this case.';
  }

  const p = c.patient || {};
  const v = c.vitals || {};
  const sam = c.sampleHistory || {};
  const pri = c.primaryAssessment || {};
  const sec = c.secondarySurvey || {};

  // Case with minimal fields only (e.g., triage / caseType)
  if (isMinimallyDocumentedCase(c)) {
    const triage = p.triageCategory ? p.triageCategory.split(' ')[0] : 'P2';
    const caseType = p.caseType ? p.caseType.toLowerCase() : 'medical';
    return `Here’s what you’ve documented so far:
This is a ${triage} ${caseType} patient currently under evaluation.

How can I help with this case?`;
  }

  const sentences: string[] = [];

  // Sentence 1: Demographics & Presenting Complaint / Events
  let demoStr = '';
  const isPeds = !!c.isPediatric || (typeof p.age === 'number' && p.age <= 16);
  const age = p.age ?? pending?.patient?.age;
  const rawGender = p.gender ?? pending?.patient?.gender;
  const genderLower = rawGender ? String(rawGender).toLowerCase() : '';

  if (age !== null && age !== undefined && age !== '') {
    if (isPeds) {
      const childNoun = genderLower.startsWith('f') ? 'girl' : genderLower.startsWith('m') ? 'boy' : 'child';
      demoStr = `${age}-year-old ${childNoun}`;
    } else {
      const adultNoun = genderLower.startsWith('f') ? 'female' : genderLower.startsWith('m') ? 'male' : 'patient';
      demoStr = `${age}-year-old ${adultNoun}`;
    }
  } else if (genderLower) {
    demoStr = genderLower.startsWith('f') ? 'female patient' : genderLower.startsWith('m') ? 'male patient' : 'patient';
  } else {
    demoStr = 'patient';
  }

  const complaint = (p.presentingComplaint || c.chiefComplaint || pending?.presentingComplaint || '').trim();
  const hasRealComplaint = complaint && !complaint.toLowerCase().includes('emergency presentation') && !complaint.toLowerCase().includes('acute presentation');

  const events = (sam.events || '').trim();

  let sentence1 = '';
  if (hasRealComplaint) {
    sentence1 = `This is a ${demoStr} who presented with ${complaint.replace(/\.$/, '')}`;
    if (events && !events.toLowerCase().includes(complaint.toLowerCase()) && events.length < 90) {
      sentence1 += ` (${events.replace(/\.$/, '')})`;
    }
    sentence1 += '.';
  } else if (events) {
    sentence1 = `This is a ${demoStr} who presented following ${events.replace(/\.$/, '')}.`;
  } else {
    const triage = p.triageCategory ? p.triageCategory.split(' ')[0] : 'ER';
    sentence1 = `This is a ${demoStr} admitted under ${triage} triage.`;
  }
  sentences.push(sentence1);

  // Sentence 2: Vitals & Physical Examination Findings
  const vitalItems: string[] = [];
  if (v.bp && v.bp !== 'N/A') vitalItems.push(`BP ${v.bp} mmHg`);
  if (v.hr && v.hr !== 'N/A') vitalItems.push(`HR ${v.hr} bpm`);
  if (v.spo2 && v.spo2 !== 'N/A') vitalItems.push(`SpO2 ${v.spo2}%`);
  if (v.rr && v.rr !== 'N/A') vitalItems.push(`RR ${v.rr}/min`);
  if (v.temp && v.temp !== 'N/A') vitalItems.push(`temp ${v.temp}°F`);
  if (v.gcs && v.gcs !== 'N/A') vitalItems.push(`GCS ${v.gcs}`);

  const examItems: string[] = [];
  if (pri.airway && pri.airwayStatus === 'Abnormal') examItems.push(pri.airway);
  else if (pri.airway && !pri.airway.toLowerCase().includes('patent') && pri.airway.length > 3) examItems.push(pri.airway);

  if (pri.breathing && pri.breathingStatus === 'Abnormal') examItems.push(pri.breathing);
  else if (pri.breathing && !pri.breathing.toLowerCase().includes('normal') && pri.breathing.length > 3) examItems.push(pri.breathing);

  if (pri.disability && pri.disabilityStatus === 'Abnormal') examItems.push(pri.disability);
  if (sec.headNeck && !sec.headNeck.toLowerCase().includes('normal') && sec.headNeck.length > 3) examItems.push(sec.headNeck);
  if (sec.chest && !sec.chest.toLowerCase().includes('normal') && sec.chest.length > 3) examItems.push(sec.chest);
  if (sec.abdomen && !sec.abdomen.toLowerCase().includes('normal') && sec.abdomen.length > 3) examItems.push(sec.abdomen);
  if (sec.neurological && !sec.neurological.toLowerCase().includes('normal') && sec.neurological.length > 3) examItems.push(sec.neurological);
  if (sec.generalExam && !sec.generalExam.toLowerCase().includes('normal') && sec.generalExam.length > 3) examItems.push(sec.generalExam);
  if (sec.extremities && !sec.extremities.toLowerCase().includes('normal') && sec.extremities.length > 3) examItems.push(sec.extremities);

  // If pediatric weight exists, note it
  const pedsWeight = c.pediatricDetails?.patientWeight || c.pediatricDetails?.weight;

  if (vitalItems.length > 0 || examItems.length > 0 || pedsWeight) {
    let sentence2 = '';
    if (vitalItems.length > 0 && examItems.length > 0) {
      sentence2 = `Presentation vitals show ${vitalItems.slice(0, 4).join(', ')} with ${examItems.slice(0, 2).join(' and ')} on exam.`;
    } else if (vitalItems.length > 0) {
      sentence2 = `Documented presentation vitals include ${vitalItems.slice(0, 4).join(', ')}${pedsWeight ? ` with recorded weight of ${pedsWeight} kg` : ''}.`;
    } else {
      sentence2 = `Clinical examination noted ${examItems.slice(0, 3).join(', ')}${pedsWeight ? ` with recorded weight of ${pedsWeight} kg` : ''}.`;
    }
    sentences.push(sentence2);
  }

  // Sentence 3: Investigations & Treatments Administered
  const invList: string[] = [];
  if (Array.isArray(c.investigations)) {
    c.investigations.forEach((inv: any) => {
      const name = inv.testName || inv.name;
      const res = inv.result || inv.value;
      if (name) {
        invList.push(res && res !== 'Pending' && res !== 'Impending' ? `${name} (${res})` : name);
      }
    });
  }

  const trtList: string[] = [];
  if (Array.isArray(c.treatments)) {
    c.treatments.forEach((t: any) => {
      const drug = t.drugName || t.name;
      const dose = t.dose ? ` ${t.dose}` : '';
      if (drug) trtList.push(`${drug}${dose}`);
    });
  }
  if (Array.isArray(c.procedureNotes)) {
    c.procedureNotes.forEach((pn: any) => {
      const pName = pn.procedureName || pn.name;
      if (pName) trtList.push(pName);
    });
  }

  if (invList.length > 0 || trtList.length > 0) {
    let sentence3 = '';
    if (invList.length > 0 && trtList.length > 0) {
      sentence3 = `Investigations include ${invList.slice(0, 2).join(' and ')}, and treatments administered so far include ${trtList.slice(0, 3).join(', ')}.`;
    } else if (invList.length > 0) {
      sentence3 = `Documented investigations include ${invList.slice(0, 3).join(', ')}.`;
    } else {
      sentence3 = `Initial treatments administered include ${trtList.slice(0, 3).join(', ')}.`;
    }
    sentences.push(sentence3);
  }

  // Sentence 4: Provisional Diagnosis & Disposition / Progress
  const diagnosis = (
    c.provisionalPrimaryDiagnosis ||
    c.dischargeInfo?.primaryDiagnosis ||
    (Array.isArray(c.differentials) && c.differentials[0] ? (typeof c.differentials[0] === 'string' ? c.differentials[0] : c.differentials[0].diagnosis || c.differentials[0].name) : '')
  );

  const disp = c.dispositionDetails?.dispositionType;
  const dispNotes = c.dispositionDetails?.observationNotes || c.progressNotes;

  if (diagnosis && diagnosis !== 'Under evaluation' && diagnosis !== 'Under Evaluation') {
    let sentence4 = `Working diagnosis is ${diagnosis}`;
    if (disp && disp !== 'In ER') {
      sentence4 += ` with planned disposition to ${disp}.`;
    } else if (dispNotes && dispNotes.length > 5 && !dispNotes.includes('No progress notes')) {
      const shortNote = dispNotes.split('.')[0];
      if (shortNote.length < 75) {
        sentence4 += ` (${shortNote.trim()}).`;
      } else {
        sentence4 += '.';
      }
    } else {
      sentence4 += '.';
    }
    sentences.push(sentence4);
  } else if (disp && disp !== 'In ER') {
    sentences.push(`Disposition plan is ${disp}.`);
  }

  // Ensure 2–4 sentences
  const boundedSentences = sentences.slice(0, 4);

  return `Here’s what you’ve documented so far:
${boundedSentences.join(' ')}

How can I help with this case?`;
}

/**
 * Migrates a restored chat session, removing legacy bootstrap summaries
 * while preserving all genuine user messages and subsequent assistant responses.
 */
export function migrateLegacySessionMessages(
  messages: ChatMessage[],
  context: ChatContext,
  mode: 'discuss' | 'rounds'
): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [buildWelcomeMessage(context, mode)];
  }

  // Find index of first user message
  const firstUserIdx = messages.findIndex(m => m.role === 'user');

  if (firstUserIdx === -1) {
    // No user message yet. All messages are assistant bootstrap/welcome messages.
    // Replace with fresh concise opening!
    return [buildWelcomeMessage(context, mode)];
  }

  // There are genuine user messages starting at firstUserIdx
  const prefixMessages = messages.slice(0, firstUserIdx);
  const userAndSubsequentMessages = messages.slice(firstUserIdx);

  // Check if prefix messages contain legacy bootstrap strings
  const legacyMarkers = [
    'Discussing Active Case',
    'Clinical Case Summary',
    'Patient Overview',
    'Clinical Snapshot',
    'Critical Gaps',
    'How Would You Like to Proceed',
    'How would you like to proceed',
    'Ready to discuss this patient. What would you like to focus on?'
  ];

  const hasLegacyBootstrap = prefixMessages.some(m =>
    legacyMarkers.some(marker => m.content && m.content.includes(marker))
  );

  if (hasLegacyBootstrap) {
    // Replace legacy prefix with new concise debrief, preserving all messages from firstUserIdx onwards
    const freshWelcome = buildWelcomeMessage(context, mode);
    return [freshWelcome, ...userAndSubsequentMessages];
  }

  return messages;
}

/**
 * Builds the appropriate welcome message for the given context and mode.
 */
export function buildWelcomeMessage(context: ChatContext, mode: 'discuss' | 'rounds' = 'discuss'): ChatMessage {
  const d = context.data || {};

  let welcomeText = '';

  if (mode === 'rounds' || context.type === 'rounds') {
    welcomeText = 'Want to prepare before rounds? Ask.';
  } else if (context.type === 'case' || mode === 'discuss') {
    welcomeText = generateDiscussCaseDebrief(d, context.pendingClinicalContext);
  } else {
    switch (context.type) {
      case 'handover':
        welcomeText = `Discussing Handover for: **${d.patientLabel?.name || d.name || 'Patient'}** (Bed ${d.patientLabel?.bed || 'N/A'})

Diagnosis: ${d.diagnosis || d.presentingComplaint || 'Under evaluation'}
Status: **${(d.patientLabel?.status || 'unstable').toUpperCase()}**

Ask about management, pending actions, or ask me to update this patient's handover card (e.g. "Add MRI Brain to pending actions").`;
        break;

      case 'discharge':
        welcomeText = `Discussing Discharge Summary: **${d.patientInfo?.name || d.patientName || 'Patient'}**

Admitted: ${d.patientInfo?.dateAdmission || 'N/A'} | Discharged: ${d.patientInfo?.dateDischarge || 'N/A'}
Primary Diagnosis: ${d.diagnosisAtDischarge?.[0] || d.diagnosis || 'N/A'}

Ask about clinical course, medication reconciliation, discharge instructions, or request summary adjustments.`;
        break;

      case 'mortality_audit':
        welcomeText = `M&M Confidential Review: **${d.patientInfo?.name || d.patientName || 'Deceased Patient'}**

Date of Death: ${d.patientInfo?.dateDeath || d.dateDeath || 'N/A'}
Primary Cause: ${d.causeOfDeath?.underlying || d.causeOfDeath || 'Under audit'}

Ask questions regarding physiological timeline, ACLS/resuscitation audit, antecedent causes, or clinical pearls for rounds.`;
        break;

      case 'reference':
        welcomeText = `📚 **ErMate EM Reference** — Evidence-Based Emergency Medicine Handbook

Ask any clinical, pharmacological, or procedural emergency question (e.g., *"How do I use Ketofol in AF?"*, *"RSI drug doses paediatric"*). 

Responses are generated directly using ErMate, cited with Tintinalli's, Rosen's, UpToDate, and WikEM guidelines.`;
        break;

      default:
        welcomeText = generateDiscussCaseDebrief(d, context.pendingClinicalContext);
    }
  }

  return {
    role: 'assistant',
    content: welcomeText,
    timestamp: new Date().toISOString(),
  };
}
