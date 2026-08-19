import React from "react";
import { formatFlagged, isCulturePositive, type ClinicalParam } from "./clinicalRanges";
import { ArrowLeft, Edit3, Printer, FileText } from "lucide-react";
import { ClinicalCase } from "../types";

interface VitalReading {
  label: string;
  param: ClinicalParam;
  value: number | null;
  displayValue?: string;
  unit?: string;
}

interface LabPanel {
  panelName: string;
  values: { name: string; param: ClinicalParam | null; value: number | null; unit?: string }[];
}

export interface PrimarySurveyData {
  airway: string | null;
  breathing: string | null;
  circulation: string | null;
  disability: string | null;
  exposure: string | null;
}

export interface SecondarySurveyData {
  general: string | null;
  cvs: string | null;
  respiratory: string | null;
  abdomen: string | null;
  cns: string | null;
  extremities: string | null;
}

export interface PsychologicalAssessmentData {
  suicidalIdeation: boolean;
  selfHarmHistory: boolean;
  intentToHarmOthers: boolean;
  substanceAbuse: boolean;
  psychiatricHistory: boolean;
  currentlyOnPsychiatricTreatment: boolean;
  hasSupportSystem: boolean;
  notes: string | null;
}

export interface CaseSheetData {
  caseId: string;
  hospitalName?: string;
  patient: {
    name: string | null;
    age: number | null;
    sex: "M" | "F" | "O" | null;
    uhid: string | null;
    bed: string | null;
  };
  arrival: { date: string | null; time: string | null };
  clinician: string | null;
  presentingComplaint: string;

  initialVitals: VitalReading[];
  vbgAbg: { type: "VBG" | "ABG" | null; performed: boolean; values: { name: string; param: ClinicalParam; value: number | null }[] };
  ecg: { performed: boolean; findings: string };
  bedsideEcho: { performed: boolean; findings: string };
  efast: { performed: boolean; findings: string };

  pastHistory: string[];
  primarySurvey: PrimarySurveyData;
  secondarySurvey: SecondarySurveyData;
  psychologicalAssessment: PsychologicalAssessmentData | null;
  provisionalDiagnosis: string;
  differentials: { diagnosis: string; status: string }[];

  labs: LabPanel[];
  cultureResults?: { name: string; result: string }[];

  treatmentGiven: string[];

  // NEW — previously missing entirely
  disposition: {
    status: string | null;
    destinationUnit: string | null;
    durationInEr: string | null;
    consultsRequested: string[];
    followUpAdvice: string | null;
  };
  isPediatric: boolean;
  pediatricDetails: {
    weight: string | null;
    patAppearanceTone: string | null;
    patAppearanceInteractivity: string | null;
    patAppearanceConsolability: string | null;
    patAppearanceLookGaze: string | null;
    patAppearanceSpeechCry: string | null;
    patWorkOfBreathing: string | null;
    patCirculation: string | null;
    immunizationHistory: string | null;
    birthHistory: string | null;
    feedingHistory: string | null;
    developmentalHistory: string | null;
    broughtBy: string | null;
    informant: string | null;
  } | null;
  notes: { progressNotes: string | null; addendum: string | null };
  isMlc: boolean;

  signatureBlock: {
    clinicianName: string | null; // null means "not recorded" — never a fallback name
    timestamp: string | null;
  };
}

interface Props {
  data?: CaseSheetData;
  clinicalCase?: ClinicalCase;
  onBack?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
}

// ── Known lab-name → ClinicalParam mapping for abnormal flagging ─────
// Only these get range-based ⚠️ flags. Anything else displays plainly
// — this avoids both false "everything is normal" silence AND false
// matches from casting arbitrary strings as ClinicalParam.
const LAB_NAME_TO_PARAM: Record<string, ClinicalParam> = {
  "hb": "hb", "hemoglobin": "hb", "haemoglobin": "hb",
  "wbc": "wbc", "tlc": "wbc",
  "platelets": "platelets", "plt": "platelets",
  "creatinine": "creatinine", "cr": "creatinine",
  "urea": "urea",
  "crp": "crp",
  "inr": "inr",
  "na": "na", "sodium": "na",
  "k": "k", "potassium": "k",
};

function matchLabParam(labName: string): ClinicalParam | null {
  const key = (labName || "").toLowerCase().trim();
  return LAB_NAME_TO_PARAM[key] || null;
}

// ── Helper to convert ClinicalCase model to CaseSheetData ────────────
export function convertClinicalCaseToCaseSheetData(c: ClinicalCase, defaultHospital?: string): CaseSheetData {
  const parseVal = (val: any): number | null => {
    if (val === null || val === undefined || val === "") return null;
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
    return isNaN(num) ? null : num;
  };

  const vitals = c.vitals || ({} as any);
  const sysBp = vitals.bp ? parseVal(vitals.bp.split("/")[0]) : null;

  const pastHx: string[] = [];
  if (c.sampleHistory?.pastHistory) pastHx.push(c.sampleHistory.pastHistory);
  if (c.sampleHistory?.allergies) pastHx.push(`Allergies: ${c.sampleHistory.allergies}`);
  if (c.sampleHistory?.medications) pastHx.push(`Regular Meds: ${c.sampleHistory.medications}`);

  const surveyObj = c.primaryAssessment?.survey;
  const primarySurvey: PrimarySurveyData = {
    airway: c.primaryAssessment?.airway || (surveyObj?.airway ? `Status: ${surveyObj.airway.status}${surveyObj.airway.intervention ? `, Intervention: ${surveyObj.airway.intervention}` : ""}` : null),
    breathing: c.primaryAssessment?.breathing || (surveyObj?.breathing ? `Work: ${surveyObj.breathing.workOfBreathing || "Normal"}, Air Entry: ${surveyObj.breathing.airEntry || "Equal"}, Sounds: ${surveyObj.breathing.addedSounds || "Clear"}` : null),
    circulation: c.primaryAssessment?.circulation || (surveyObj?.circulation ? `Rhythm: ${surveyObj.circulation.rhythm || "Regular"}, CRT: ${surveyObj.circulation.crt || "<2s"}, Skin: ${surveyObj.circulation.skinPerfusion || "Warm"}` : null),
    disability: c.primaryAssessment?.disability || (surveyObj?.disability ? `GCS: ${surveyObj.disability.gcsTotal || "15"}, Pupils: ${surveyObj.disability.pupilReaction || "Reactive"}` : null),
    exposure: c.primaryAssessment?.exposure || (surveyObj?.exposure ? `Skin: ${surveyObj.exposure.skin || "Clear"}` : null),
  };

  const secInfo = c.dischargeInfo;
  const sec = (c as any).secondarySurvey || {};
  
  let parsedGeneral = secInfo?.secondaryPicle || sec.general || null;
  let parsedCvs = secInfo?.secondaryCvs || sec.cvs || null;
  let parsedRs = secInfo?.secondaryChest || sec.respiratory || null;
  let parsedPa = secInfo?.secondaryPa || sec.abdomen || null;
  let parsedCns = secInfo?.secondaryCns || sec.cns || null;
  let parsedExtremities = sec.extremities || null;

  if (!parsedGeneral && c.secondaryAssessment && typeof c.secondaryAssessment === "string") {
    const text = c.secondaryAssessment;
    const regex = /(General|CVS|RS|Respiratory|Chest \/ RS|Respiratory System|Abdomen|PA|Per Abdomen \(PA\)|PA \/ Abdomen|Per Abdomen|CNS|Psych|Extremities|Local Examination|Head-to-Toe Trauma Exam)\s*:\s*(.*?)(?=(General|CVS|RS|Respiratory|Chest \/ RS|Respiratory System|Abdomen|PA|Per Abdomen \(PA\)|PA \/ Abdomen|Per Abdomen|CNS|Psych|Extremities|Local Examination|Head-to-Toe Trauma Exam)\s*:|$)/igs;
    let match;
    let foundAny = false;
    while ((match = regex.exec(text)) !== null) {
      foundAny = true;
      const key = match[1].toLowerCase();
      const val = match[2].trim();
      if (key.includes('general')) parsedGeneral = val;
      else if (key.includes('cvs')) parsedCvs = val;
      else if (key.includes('rs') || key.includes('respiratory')) parsedRs = val;
      else if (key.includes('abdomen') || key.includes('pa')) parsedPa = val;
      else if (key.includes('cns')) parsedCns = val;
      else if (key.includes('extremities') || key.includes('local') || key.includes('trauma')) parsedExtremities = val;
    }
    if (!foundAny) {
      parsedGeneral = text;
    }
  }

  const secondarySurvey: SecondarySurveyData = {
    general: parsedGeneral,
    cvs: parsedCvs,
    respiratory: parsedRs,
    abdomen: parsedPa,
    cns: parsedCns,
    extremities: parsedExtremities,
  };

  let psychologicalAssessment: PsychologicalAssessmentData | null = null;
  if (c.psychologicalAssessment) {
    psychologicalAssessment = c.psychologicalAssessment;
  } else if (c.vulnerableAssessment || c.sampleHistory?.psychiatricFlags) {
    psychologicalAssessment = {
      suicidalIdeation: !!c.vulnerableAssessment?.suicidalIdeationRisk,
      selfHarmHistory: !!c.vulnerableAssessment?.suicidalIdeationRisk,
      intentToHarmOthers: false,
      substanceAbuse: false,
      psychiatricHistory: false,
      currentlyOnPsychiatricTreatment: false,
      hasSupportSystem: true,
      notes: c.sampleHistory?.psychiatricFlags || null,
    };
  }

  const treatmentList: string[] = [];
  if (Array.isArray(c.treatments) && c.treatments.length > 0) {
    c.treatments.forEach(t => {
      treatmentList.push(`${t.drugName || "Medication"} ${t.dose || ""} ${t.route || ""}`.trim());
    });
  } else if (Array.isArray(c.medications)) {
    c.medications.forEach(m => {
      if (typeof m === "string") treatmentList.push(m);
      else if (m && typeof m === "object") treatmentList.push(`${m.drugName || ""} ${m.dose || ""} ${m.route || ""}`.trim());
    });
  }
  if (Array.isArray(c.infusions)) {
    c.infusions.forEach(f => treatmentList.push(`${f.fluidName} ${f.dose}, diluted ${f.dilution}, rate ${f.rate}`));
  }

  const labValues: LabPanel["values"] = [];
  if (Array.isArray(c.investigationResults)) {
    c.investigationResults.forEach(r => {
      labValues.push({
        name: r.name || "Lab Test",
        param: matchLabParam(r.name || ""),
        value: parseVal(r.value),
        unit: r.unit || ""
      });
    });
  }
  if (Array.isArray(c.investigations)) {
    c.investigations.forEach(i => {
      // Legacy array — only add if not already covered by investigationResults
      if (!labValues.some(lv => lv.name === i.testName)) {
        labValues.push({ name: i.testName, param: matchLabParam(i.testName), value: null, unit: "" });
      }
    });
  }

  // ── VBG/ABG — real data only, NEVER hardcoded fallback values ──
  const adj = (c as any).adjuncts || {};
  const vbgPerformed = adj.abgStatus === "done";
  const vbgValues = vbgPerformed
    ? [
        { name: "pH", param: "ph" as ClinicalParam, value: parseVal(adj.abgPh) },
        { name: "pCO2", param: "pco2" as ClinicalParam, value: parseVal(adj.abgPco2) },
        { name: "HCO3", param: "hco3" as ClinicalParam, value: parseVal(adj.abgHco3) },
        { name: "Lactate", param: "lactate" as ClinicalParam, value: parseVal(adj.abgLactate) },
        { name: "Na", param: "na" as ClinicalParam, value: parseVal(adj.abgNa) },
        { name: "K", param: "k" as ClinicalParam, value: parseVal(adj.abgK) },
      ].filter(v => v.value !== null)
    : [];

  const pediatricRaw = c.pediatricDetails as any;

  return {
    caseId: c.id,
    hospitalName: c.hospital || defaultHospital || undefined, // no hardcoded hospital name fallback either
    patient: {
      name: c.patient?.name || null,
      age: c.patient?.age ? parseVal(c.patient.age) : null,
      sex: c.patient?.gender ? (c.patient.gender.toUpperCase().startsWith("M") ? "M" : c.patient.gender.toUpperCase().startsWith("F") ? "F" : "O") : null,
      uhid: c.patient?.uhid || null,
      bed: c.bedNo || null
    },
    arrival: {
      date: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null,
      time: c.admissionTime || null
    },
    // NEVER default to a specific named physician — a missing name
    // must display as "Not recorded", not a real doctor's name.
    clinician: c.doctorName || c.lastEditedByName || null,
    presentingComplaint: c.patient?.presentingComplaint || c.sampleHistory?.symptoms || "",

    initialVitals: [
      { label: "HR", param: "hr", value: parseVal(vitals.hr), unit: "bpm" },
      { label: "BP", param: "sbp", value: sysBp, unit: "mmHg" },
      { label: "RR", param: "rr", value: parseVal(vitals.rr), unit: "/min" },
      { label: "SpO2", param: "spo2", value: parseVal(vitals.spo2), unit: "%" },
      { label: "Temp", param: "temp", value: parseVal(vitals.temp), unit: "°C" },
      { label: "GRBS", param: "grbs", value: parseVal(vitals.grbs), unit: "mg/dL" },
      { label: "GCS", param: "gcs" as ClinicalParam, value: parseVal(vitals.gcs), displayValue: vitals.gcs || (vitals.gcs_e || vitals.gcs_v || vitals.gcs_m ? `${vitals.gcs_e || "?"}/${vitals.gcs_v || "?"}/${vitals.gcs_m || "?"}` : "15/15") }
    ],

    vbgAbg: { type: vbgPerformed ? "VBG" : null, performed: vbgPerformed, values: vbgValues },

    // NEVER default to a fabricated "normal" finding — only real data
    // or an explicit "Not documented" state.
    ecg: { performed: !!adj.ecgDone, findings: adj.ecgFindings || adj.ecgRhythm || "" },
    bedsideEcho: { performed: !!adj.echoDone, findings: adj.echoFindings || "" },
    efast: { performed: !!adj.efastDone || !!(adj.efastInterpretation && adj.efastInterpretation !== "Not done"), findings: adj.efastInterpretation || adj.efastFindings || adj.efastNotes || "" },

    pastHistory: pastHx,
    primarySurvey,
    secondarySurvey,
    psychologicalAssessment,
    provisionalDiagnosis: c.provisionalPrimaryDiagnosis || (c.differentials?.[0]?.diagnosis) || "",
    differentials: (c.differentials || []).map(d => ({ diagnosis: d.diagnosis, status: d.status })),

    labs: labValues.length > 0 ? [{ panelName: "INVESTIGATIONS & LAB RESULTS", values: labValues }] : [],
    cultureResults: [],

    treatmentGiven: treatmentList,

    // NEW — Disposition, previously completely absent from the print view
    disposition: {
      status: c.dispositionDetails?.dispositionType || c.dispositionAndPlan?.dispositionStatus || null,
      destinationUnit: c.dispositionAndPlan?.destinationUnit || null,
      durationInEr: c.dispositionDetails?.durationInEr || null,
      consultsRequested: c.dispositionAndPlan?.consultsRequested || [],
      followUpAdvice: c.dispositionAndPlan?.followUpAdvice || null,
    },

    isPediatric: !!c.isPediatric || (c.patient.age !== null && c.patient.age < 16),
    pediatricDetails: (!!c.isPediatric || (c.patient.age !== null && c.patient.age < 16)) && pediatricRaw ? {
      weight: pediatricRaw.patientWeight || pediatricRaw.weight || null,
      patAppearanceTone: pediatricRaw.patAppearanceTone || null,
      patAppearanceInteractivity: pediatricRaw.patAppearanceInteractivity || null,
      patAppearanceConsolability: pediatricRaw.patAppearanceConsolability || null,
      patAppearanceLookGaze: pediatricRaw.patAppearanceLookGaze || null,
      patAppearanceSpeechCry: pediatricRaw.patAppearanceSpeechCry || null,
      patWorkOfBreathing: pediatricRaw.patWorkOfBreathing || pediatricRaw.workOfBreathing || null,
      patCirculation: pediatricRaw.patCirculation || pediatricRaw.circulation || null,
      immunizationHistory: pediatricRaw.immunizationHistory || null,
      birthHistory: pediatricRaw.birthHistory || null,
      feedingHistory: pediatricRaw.feedingHistory || null,
      developmentalHistory: pediatricRaw.developmentalHistory || null,
      broughtBy: pediatricRaw.broughtBy || null,
      informant: pediatricRaw.informant || null,
    } : null,

    notes: {
      progressNotes: c.progressNotes || null,
      addendum: c.addendumNotes || null,
    },
    isMlc: !!(c.patient as any)?.isMlc,

    signatureBlock: {
      clinicianName: c.doctorName || null, // no fallback name — ever
      timestamp: c.lastEditedAt || null
    }
  };
}

// ── Presentational helpers ────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-black tracking-widest uppercase border-b border-black pb-1 mb-2 print:text-black">
      {children}
    </h3>
  );
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`case-sheet-section py-3 border-b border-slate-300 print:border-black ${className}`}>
      {children}
    </div>
  );
}

function EmptyLine({ text = "Not documented" }: { text?: string }) {
  return <p className="text-sm text-slate-500 italic print:text-black">{text}</p>;
}

function PrimarySurveySection({ data }: { data: PrimarySurveyData }) {
  const items = [
    { label: "Airway", value: data.airway },
    { label: "Breathing", value: data.breathing },
    { label: "Circulation", value: data.circulation },
    { label: "Disability", value: data.disability },
    { label: "Exposure", value: data.exposure },
  ].filter(item => item.value);

  return (
    <Section>
      <SectionHeading>Primary Survey (ABCDE)</SectionHeading>
      {items.length > 0 ? (
        <ul className="text-sm list-disc pl-5 space-y-0.5">
          {items.map((item, i) => (
            <li key={i}><span className="font-semibold">{item.label}:</span> {item.value}</li>
          ))}
        </ul>
      ) : <EmptyLine />}
    </Section>
  );
}

function SecondarySurveySection({ data }: { data: SecondarySurveyData }) {
  const items = [
    { label: "General", value: data.general },
    { label: "CVS", value: data.cvs },
    { label: "Respiratory", value: data.respiratory },
    { label: "Abdomen", value: data.abdomen },
    { label: "CNS", value: data.cns },
    { label: "Extremities", value: data.extremities },
  ].filter(item => item.value);

  return (
    <Section>
      <SectionHeading>Secondary Survey / Systemic Examination</SectionHeading>
      {items.length > 0 ? (
        <ul className="text-sm list-disc pl-5 space-y-0.5">
          {items.map((item, i) => (
            <li key={i}><span className="font-semibold">{item.label}:</span> {item.value}</li>
          ))}
        </ul>
      ) : <EmptyLine />}
    </Section>
  );
}

function PsychologicalAssessmentSection({ data }: { data: PsychologicalAssessmentData | null }) {
  if (!data) {
    return (
      <Section>
        <SectionHeading>Psychological Assessment</SectionHeading>
        <EmptyLine />
      </Section>
    );
  }

  const fields: { label: string; value: boolean; isRiskFlag: boolean }[] = [
    { label: "Suicidal Ideation", value: data.suicidalIdeation, isRiskFlag: true },
    { label: "Self-Harm History", value: data.selfHarmHistory, isRiskFlag: true },
    { label: "Intent to Harm Others", value: data.intentToHarmOthers, isRiskFlag: true },
    { label: "Substance Abuse", value: data.substanceAbuse, isRiskFlag: false },
    { label: "Psychiatric History", value: data.psychiatricHistory, isRiskFlag: false },
    { label: "Currently on Psychiatric Treatment", value: data.currentlyOnPsychiatricTreatment, isRiskFlag: false },
    { label: "Has Support System", value: data.hasSupportSystem, isRiskFlag: false },
  ];

  const hasActiveRiskFlag = fields.some(f => f.isRiskFlag && f.value === true);

  return (
    <Section className={hasActiveRiskFlag ? "bg-red-50 print:bg-transparent" : ""}>
      <SectionHeading>Psychological Assessment</SectionHeading>
      {hasActiveRiskFlag && (
        <p className="text-xs font-black text-red-700 uppercase mb-2 print:text-black">
          ⚠ Active Risk Flag(s) — Review Immediately
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {fields.map((f, i) => (
          <div key={i} className={f.isRiskFlag && f.value ? "font-bold text-red-700 print:text-black" : ""}>
            <span className="font-semibold">{f.label}:</span> {f.value ? "Yes" : "No"}
          </div>
        ))}
      </div>
      {data.notes && (
        <p className="text-sm mt-2"><span className="font-semibold">Notes:</span> {data.notes}</p>
      )}
    </Section>
  );
}

export default function CaseSheetPrintView({ data: propData, clinicalCase, onBack, onEdit, onPrint }: Props) {
  const data = propData || (clinicalCase ? convertClinicalCaseToCaseSheetData(clinicalCase) : null);

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <p className="font-bold text-lg">No Case Sheet Data Available</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-semibold">
            Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  const hospitalName = data.hospitalName || "[Hospital name not set]";

  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white text-slate-900 dark:text-slate-100 font-sans">
      {/* Toolbar — unchanged from original */}
      <div className="no-print sticky top-0 z-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all">
                <ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">Back</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 hidden sm:block" />
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">Printable Case Sheet</span>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">ID: {data.caseId}</span>
              {data.isMlc && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">MLC</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onEdit && (
            <button onClick={onEdit} className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all">
              <Edit3 className="w-3.5 h-3.5 text-slate-500" /><span>Edit<span className="hidden sm:inline"> Case Sheet</span></span>
            </button>
          )}
          <button onClick={handlePrint} className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 sm:px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all">
            <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">Print / Download PDF</span><span className="sm:hidden">Print / PDF</span>
          </button>
        </div>
      </div>

      <div className="case-sheet-print max-w-3xl mx-auto bg-white shadow-md print:shadow-none px-8 py-8 my-6 print:my-0 text-slate-900 border border-slate-200 print:border-none rounded-xl print:rounded-none">
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wide">{hospitalName}</h1>
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 print:text-black">Emergency Department — Case Sheet{data.isMlc ? " · MLC CASE" : ""}</p>
          </div>
          <div className="text-right text-xs font-mono">
            <div className="font-bold">Case ID: {data.caseId}</div>
            <div className="text-[10px] text-slate-500 print:text-black">Confidential Medical Record</div>
          </div>
        </div>

        <Section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div><span className="font-bold">Name:</span> {data.patient.name || "Not recorded"}</div>
            <div><span className="font-bold">Age / Sex:</span> {data.patient.age !== null ? `${data.patient.age}y` : "—"} {data.patient.sex || "—"}</div>
            <div><span className="font-bold">UHID:</span> {data.patient.uhid || "—"}</div>
            <div><span className="font-bold">Bed / Location:</span> {data.patient.bed || "—"}</div>
            <div><span className="font-bold">Arrival:</span> {data.arrival.date || "—"} {data.arrival.time || ""}</div>
            <div><span className="font-bold">Treating Clinician:</span> {data.clinician || "Not recorded"}</div>
          </div>
        </Section>

        <Section>
          <SectionHeading>Presenting Complaint</SectionHeading>
          <div className="text-sm font-medium">{data.presentingComplaint || <EmptyLine />}</div>
        </Section>

        <Section>
          <SectionHeading>Initial Assessment (Vitals & Adjuncts)</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-sm mb-3 bg-slate-50 print:bg-transparent p-2 print:p-0 rounded-lg border border-slate-200 print:border-none">
            {data.initialVitals.map((v, i) => (
              <div key={i} className="text-center sm:text-left">
                <span className="font-bold text-xs uppercase text-slate-500 print:text-black block">{v.label}</span>
                <span className="font-mono text-sm font-semibold">{v.displayValue ? v.displayValue : formatFlagged(v.param, v.value)} {v.unit && v.value !== null && !v.displayValue ? v.unit : ""}</span>
              </div>
            ))}
          </div>
          <div className="text-sm space-y-1 mt-2">
            <div>
              <span className="font-bold">VBG/ABG:</span>{" "}
              {data.vbgAbg.performed && data.vbgAbg.values.length > 0
                ? data.vbgAbg.values.map(v => `${v.name} ${formatFlagged(v.param, v.value)}`).join(" · ")
                : "Not documented"}
            </div>
            <div><span className="font-bold">ECG:</span> {data.ecg.performed && data.ecg.findings ? data.ecg.findings : "Not documented"}</div>
            <div><span className="font-bold">Bedside Echo:</span> {data.bedsideEcho.performed && data.bedsideEcho.findings ? data.bedsideEcho.findings : "Not documented"}</div>
            <div><span className="font-bold">EFAST:</span> {data.efast?.performed && data.efast.findings ? data.efast.findings : "Not documented"}</div>
          </div>
        </Section>

        <Section>
          <SectionHeading>Past Medical History</SectionHeading>
          {data.pastHistory.length > 0 ? <p className="text-sm">{data.pastHistory.join(" · ")}</p> : <EmptyLine />}
        </Section>

        <PrimarySurveySection data={data.primarySurvey} />
        <SecondarySurveySection data={data.secondarySurvey} />
        <PsychologicalAssessmentSection data={data.psychologicalAssessment} />

        {/* NEW — Pediatrics, conditional */}
        {data.isPediatric && data.pediatricDetails && (
          <Section>
            <SectionHeading>Pediatric Assessment</SectionHeading>
            <div className="text-sm space-y-1">
              <div><span className="font-bold">Weight:</span> {data.pediatricDetails.weight ? `${data.pediatricDetails.weight} kg` : "Not recorded"}</div>
              <div>
                <span className="font-bold">PAT — Appearance (TICLS):</span> 
                Tone: {data.pediatricDetails.patAppearanceTone || "—"}, 
                Interactivity: {data.pediatricDetails.patAppearanceInteractivity || "—"}, 
                Consolability: {data.pediatricDetails.patAppearanceConsolability || "—"}, 
                Look/Gaze: {data.pediatricDetails.patAppearanceLookGaze || "—"}, 
                Speech/Cry: {data.pediatricDetails.patAppearanceSpeechCry || "—"}
              </div>
              <div><span className="font-bold">Work of Breathing:</span> {data.pediatricDetails.patWorkOfBreathing || "—"} | <span className="font-bold">Circulation:</span> {data.pediatricDetails.patCirculation || "—"}</div>
              {data.pediatricDetails.birthHistory && <div><span className="font-bold">Birth History:</span> {data.pediatricDetails.birthHistory}</div>}
              {data.pediatricDetails.feedingHistory && <div><span className="font-bold">Feeding History:</span> {data.pediatricDetails.feedingHistory}</div>}
              {data.pediatricDetails.developmentalHistory && <div><span className="font-bold">Developmental History:</span> {data.pediatricDetails.developmentalHistory}</div>}
              <div><span className="font-bold">Immunization History:</span> {data.pediatricDetails.immunizationHistory || "Not recorded"}</div>
              {data.pediatricDetails.broughtBy && <div><span className="font-bold">Brought By:</span> {data.pediatricDetails.broughtBy}</div>}
              {data.pediatricDetails.informant && <div><span className="font-bold">Informant:</span> {data.pediatricDetails.informant}</div>}
            </div>
          </Section>
        )}

        <Section>
          <SectionHeading>Provisional & Differential Diagnosis</SectionHeading>
          <div className="text-sm font-bold text-indigo-950 print:text-black">{data.provisionalDiagnosis || <EmptyLine />}</div>
          {data.differentials.length > 0 && (
            <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5">
              {data.differentials.map((d, i) => <li key={i}>{d.diagnosis} ({d.status})</li>)}
            </ul>
          )}
        </Section>

        <Section>
          <SectionHeading>Investigations & Lab Results</SectionHeading>
          {data.labs.length > 0 ? (
            <div className="space-y-2">
              {data.labs.map((panel, i) => (
                <div key={i}>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">{panel.panelName}</p>
                  <p className="text-sm font-mono leading-relaxed">
                    {panel.values.map(v => `${v.name}: ${v.param ? formatFlagged(v.param, v.value) : (v.value ?? "Pending")}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`).join("  |  ")}
                  </p>
                </div>
              ))}
            </div>
          ) : <EmptyLine />}
        </Section>

        <Section>
          <SectionHeading>Treatment Given & Emergency Orders</SectionHeading>
          {data.treatmentGiven.length > 0 ? (
            <ul className="text-sm list-disc pl-5 space-y-0.5 font-mono">{data.treatmentGiven.map((t, i) => <li key={i}>{t}</li>)}</ul>
          ) : <EmptyLine />}
        </Section>

        {/* NEW — Disposition, previously completely absent */}
        <Section>
          <SectionHeading>Disposition & Outcome</SectionHeading>
          <div className="text-sm space-y-1">
            <div><span className="font-bold">Status:</span> {data.disposition.status || "Not yet determined"}</div>
            {data.disposition.destinationUnit && <div><span className="font-bold">Destination:</span> {data.disposition.destinationUnit}</div>}
            {data.disposition.durationInEr && <div><span className="font-bold">Duration in ER:</span> {data.disposition.durationInEr}</div>}
            {data.disposition.consultsRequested.length > 0 && <div><span className="font-bold">Consults Requested:</span> {data.disposition.consultsRequested.join(", ")}</div>}
            {data.disposition.followUpAdvice && <div><span className="font-bold">Follow-Up Advice:</span> {data.disposition.followUpAdvice}</div>}
          </div>
        </Section>

        {/* NEW — Notes/Addendum */}
        {(data.notes.progressNotes || data.notes.addendum) && (
          <Section>
            <SectionHeading>Clinical Notes & Addendum</SectionHeading>
            {data.notes.progressNotes && <p className="text-sm whitespace-pre-line">{data.notes.progressNotes}</p>}
            {data.notes.addendum && <p className="text-sm whitespace-pre-line mt-1"><span className="font-bold">Addendum:</span> {data.notes.addendum}</p>}
          </Section>
        )}

        <div className="pt-8 mt-4 flex items-end justify-between text-sm">
          <div>
            <div className="border-t border-black pt-1.5 w-56 text-center font-bold">
              {data.signatureBlock.clinicianName || "Not recorded"}
            </div>
            <p className="text-xs text-center text-slate-500 print:text-black">Treating ER Physician</p>
          </div>
          <div className="text-xs text-right font-mono text-slate-500 print:text-black">
            <div>Date/Time: {data.signatureBlock.timestamp || "Not recorded"}</div>
            <div className="text-[10px] italic">Electronically Signed Record</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .case-sheet-print { font-family: 'Times New Roman', Times, serif !important; font-size: 11pt !important; color: #000 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
          .case-sheet-section { page-break-inside: avoid !important; border-color: #000 !important; padding-top: 6px !important; padding-bottom: 6px !important; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
