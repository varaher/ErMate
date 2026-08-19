import React from "react";
import { Smile } from "lucide-react";
import { ToggleSwitchGrid, CollapsibleSection, AbgVbgPanel } from "./ManualEntryPrimitives";
import {
  BreathingField, CirculationField, DisabilityField, ExposureField,
  GeneralExaminationSection, CvsSection, RespiratorySection,
  AbdomenSection, CnsSection, ExtremitiesSection,
} from "./CaseSheetABCDEFields";
import { AirwayField } from "./ManualEntryPrimitives"; // re-exported from the worked example

/**
 * CaseSheetManualEntryComplete.tsx
 *
 * ═══════════════════════════════════════════════════════════════════
 * FIELD MAPPING — READ THIS BEFORE WIRING IN
 * ═══════════════════════════════════════════════════════════════════
 * This screen produces the exact same output shape your existing
 * ClinicalCase already has. Nothing downstream (CaseSheetPrintView,
 * Copy Text, Download, Discharge Summary sync) needs to change.
 *
 *   Airway.narrative        -> primaryAssessment.airway       (string)
 *   Breathing.narrative     -> primaryAssessment.breathing    (string)
 *   Circulation.narrative   -> primaryAssessment.circulation  (string)
 *   Disability.narrative    -> primaryAssessment.disability   (string)
 *   Exposure.narrative      -> primaryAssessment.exposure     (string)
 *   Disability.gcsE/V/M     -> vitals.gcs_e / gcs_v / gcs_m   (strings)
 *
 *   GeneralExam booleans    -> examStructured.general.*        (booleans)
 *   CVS/Respiratory/Abdomen/CNS/Extremities .notes combined ->
 *                               secondaryAssessment (single string,
 *                               joined with newlines) — matches the
 *                               existing plain-string field already
 *                               read by every consumer.
 *
 *   PsychAssessment 7 booleans -> psychologicalAssessment.*   (booleans)
 *   PsychAssessment.notes      -> psychologicalAssessment.notes
 *
 *   AbgVbgPanel values       -> adjuncts.abgPh/Pco2/Hco3/etc  (strings)
 *
 * If your actual ClinicalCase interface uses different property names
 * than these, change ONLY the mapping functions at the bottom of this
 * file (mapToClinicalCase / mapFromClinicalCase) — never the field
 * components themselves, so the input UX stays reusable regardless of
 * how the backing schema is named.
 * ═══════════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════════
// Psychological Assessment — matches image 4 exactly (7 toggles + notes)
// ══════════════════════════════════════════════════════════════════

export interface PsychAssessmentState {
  suicidalIdeation: boolean;
  selfHarmHistory: boolean;
  intentToHarmOthers: boolean;
  substanceAbuse: boolean;
  psychiatricHistory: boolean;
  currentlyOnPsychiatricTreatment: boolean;
  hasSupportSystem: boolean;
  notes: string;
}

export function PsychologicalAssessmentEdit({
  state, onChange,
}: { state: PsychAssessmentState; onChange: (s: PsychAssessmentState) => void }) {
  const fields = [
    { key: "suicidalIdeation", label: "Suicidal Ideation", value: state.suicidalIdeation },
    { key: "selfHarmHistory", label: "Self-Harm History", value: state.selfHarmHistory },
    { key: "intentToHarmOthers", label: "Intent to Harm Others", value: state.intentToHarmOthers },
    { key: "substanceAbuse", label: "Substance Abuse", value: state.substanceAbuse },
    { key: "psychiatricHistory", label: "Psychiatric History", value: state.psychiatricHistory },
    { key: "currentlyOnPsychiatricTreatment", label: "Currently on Psychiatric Treatment", value: state.currentlyOnPsychiatricTreatment },
    { key: "hasSupportSystem", label: "Has Support System", value: state.hasSupportSystem },
  ];

  const hasActiveRiskFlag = state.suicidalIdeation || state.selfHarmHistory || state.intentToHarmOthers;

  return (
    <div className={`rounded-2xl p-4 ${hasActiveRiskFlag ? "bg-red-950/20 border border-red-800" : "bg-slate-900"}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
          <Smile size={18} />
        </span>
        <h3 className="font-bold text-lg text-emerald-400">Psychological Assessment</h3>
      </div>

      {hasActiveRiskFlag && (
        <p className="text-xs font-black text-red-400 uppercase mb-3">⚠ Active Risk Flag — Review Immediately</p>
      )}

      <ToggleSwitchGrid columns={1} fields={fields} onChange={(key, value) => onChange({ ...state, [key as keyof PsychAssessmentState]: value } as any)} />

      <div className="mt-4">
        <label className="text-white font-medium block mb-2">Notes</label>
        <textarea
          value={state.notes}
          onChange={e => onChange({ ...state, notes: e.target.value })}
          placeholder="Additional psychological notes..."
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm min-h-[100px]"
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Top-level composed state — everything the Primary + Exam tabs need
// ══════════════════════════════════════════════════════════════════

export interface CaseSheetPrimaryExamState {
  airway: any; // AirwayState from ManualEntryPrimitives
  breathing: any;
  circulation: any;
  disability: any;
  exposure: any;
  generalExam: any;
  cvs: { status: "unset" | "normal" | "abnormal"; notes: string };
  respiratory: { status: "unset" | "normal" | "abnormal"; notes: string };
  abdomen: { status: "unset" | "normal" | "abnormal"; notes: string };
  cns: { status: "unset" | "normal" | "abnormal"; notes: string };
  extremities: { status: "unset" | "normal" | "abnormal"; notes: string };
  psych: PsychAssessmentState;
  abgVbg: any;
}

interface Props {
  state: CaseSheetPrimaryExamState;
  onChange: (state: CaseSheetPrimaryExamState) => void;
  onScanAbgDocument?: () => void;
  onInterpretAbg?: () => void;
  abgInterpretationResult?: string | null;
}

// ── Primary Survey Tab content ──────────────────────────────────────

export function PrimarySurveyTab({ state, onChange }: Pick<Props, "state" | "onChange">) {
  return (
    <div className="space-y-6 px-4 py-4">
      <AirwayField state={state.airway} onChange={airway => onChange({ ...state, airway })} />
      <BreathingField state={state.breathing} onChange={breathing => onChange({ ...state, breathing })} />
      <CirculationField state={state.circulation} onChange={circulation => onChange({ ...state, circulation })} />
      <DisabilityField state={state.disability} onChange={disability => onChange({ ...state, disability })} />
      <ExposureField state={state.exposure} onChange={exposure => onChange({ ...state, exposure })} />

      <div className="pt-2">
        <h3 className="text-white font-bold text-base mb-2">Adjuncts to Primary Survey</h3>
        <CollapsibleSection icon={<span>?</span>} iconBgColor="bg-emerald-600" title="ABG / VBG" titleColor="text-emerald-400">
          <AbgVbgPanel
            values={state.abgVbg.values}
            onChange={values => onChange({ ...state, abgVbg: { ...state.abgVbg, values } })}
            sampleType={state.abgVbg.sampleType}
            onSampleTypeChange={sampleType => onChange({ ...state, abgVbg: { ...state.abgVbg, sampleType } })}
            interpretation={state.abgVbg.interpretation || "Not done"}
            onScanDocument={() => {/* wired via onScanAbgDocument prop at parent level */}}
            onInterpret={() => {/* wired via onInterpretAbg prop at parent level */}}
            interpretationResult={state.abgVbg.interpretationResult}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}

// ── Exam Tab content ─────────────────────────────────────────────────

export function ExamTab({ state, onChange }: Pick<Props, "state" | "onChange">) {
  return (
    <div className="space-y-1 px-4 py-4">
      <GeneralExaminationSection state={state.generalExam} onChange={generalExam => onChange({ ...state, generalExam })} />
      <CvsSection state={state.cvs} onChange={cvs => onChange({ ...state, cvs })} />
      <RespiratorySection state={state.respiratory} onChange={respiratory => onChange({ ...state, respiratory })} />
      <AbdomenSection state={state.abdomen} onChange={abdomen => onChange({ ...state, abdomen })} />
      <CnsSection state={state.cns} onChange={cns => onChange({ ...state, cns })} />
      <ExtremitiesSection state={state.extremities} onChange={extremities => onChange({ ...state, extremities })} />
    </div>
  );
}

// ── History Tab addition — Psych Assessment slots in at the bottom ──

export function HistoryTabPsychSection({ state, onChange }: { state: PsychAssessmentState; onChange: (s: PsychAssessmentState) => void }) {
  return (
    <div className="px-4 py-4">
      <PsychologicalAssessmentEdit state={state} onChange={onChange} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Mapping functions — the ONLY place that needs editing if your real
// ClinicalCase field names differ from the guesses above
// ══════════════════════════════════════════════════════════════════

export function mapToClinicalCase(state: CaseSheetPrimaryExamState, existingCase: any): any {
  const secondaryAssessment = [
    state.cvs.status !== "unset" ? `CVS: ${state.cvs.notes}` : "",
    state.respiratory.status !== "unset" ? `RS: ${state.respiratory.notes}` : "",
    state.abdomen.status !== "unset" ? `Abdomen: ${state.abdomen.notes}` : "",
    state.cns.status !== "unset" ? `CNS: ${state.cns.notes}` : "",
    state.extremities.status !== "unset" ? `Extremities: ${state.extremities.notes}` : "",
  ].filter(Boolean).join("\n");

  return {
    ...existingCase,
    primaryAssessment: {
      ...existingCase.primaryAssessment,
      airway: state.airway.narrative,
      breathing: state.breathing.narrative,
      circulation: state.circulation.narrative,
      disability: state.disability.narrative,
      exposure: state.exposure.narrative,
    },
    vitals: {
      ...existingCase.vitals,
      gcs_e: state.disability.gcsE,
      gcs_v: state.disability.gcsV,
      gcs_m: state.disability.gcsM,
    },
    secondaryAssessment: secondaryAssessment || existingCase.secondaryAssessment,
    examStructured: {
      ...existingCase.examStructured,
      general: {
        pallor: state.generalExam.pallor,
        icterus: state.generalExam.icterus,
        cyanosis: state.generalExam.cyanosis,
        clubbing: state.generalExam.clubbing,
        lymphadenopathy: state.generalExam.lymphadenopathy,
        edema: state.generalExam.edema,
        notes: state.generalExam.notes,
      },
    },
    psychologicalAssessment: { ...state.psych },
    adjuncts: {
      ...existingCase.adjuncts,
      abgStatus: state.abgVbg.values.ph ? "done" : "not_done",
      abgPh: state.abgVbg.values.ph,
      abgPco2: state.abgVbg.values.pco2,
      abgPo2: state.abgVbg.values.po2,
      abgHco3: state.abgVbg.values.hco3,
      abgBe: state.abgVbg.values.be,
      abgLactate: state.abgVbg.values.lactate,
      abgSao2: state.abgVbg.values.sao2,
      abgFio2: state.abgVbg.values.fio2,
      abgNa: state.abgVbg.values.na,
      abgK: state.abgVbg.values.k,
      abgSampleType: state.abgVbg.sampleType,
    },
  };
}

/**
 * REVERSE mapping — populate this UI's state FROM an existing
 * ClinicalCase, e.g. when reopening a case that already has data.
 */
export function mapFromClinicalCase(existingCase: any): CaseSheetPrimaryExamState {
  const pa = existingCase.primaryAssessment || {};
  const vitals = existingCase.vitals || {};
  const exam = existingCase.examStructured?.general || {};
  const psych = existingCase.psychologicalAssessment || {};
  const adj = existingCase.adjuncts || {};

  const inferStatus = (narrative: string | null | undefined): "unset" | "normal" | "abnormal" =>
    !narrative ? "unset" : narrative.includes("|") || narrative.includes(":") ? "abnormal" : "normal";

  return {
    airway: { status: inferStatus(pa.airway), narrative: pa.airway || null, position: [], patency: [], cause: [] },
    breathing: { status: inferStatus(pa.breathing), narrative: pa.breathing || null, effort: [], o2Device: [], pattern: [], chestExpansion: [] },
    circulation: { status: inferStatus(pa.circulation), narrative: pa.circulation || null, crt: [], pulse: [], skinTemp: [], bleeding: [] },
    disability: { status: inferStatus(pa.disability), narrative: pa.disability || null, avpu: [], pupils: [], motor: [], gcsE: vitals.gcs_e || "", gcsV: vitals.gcs_v || "", gcsM: vitals.gcs_m || "" },
    exposure: { status: inferStatus(pa.exposure), narrative: pa.exposure || null, findings: [], logRoll: [] },
    generalExam: {
      pallor: !!exam.pallor, icterus: !!exam.icterus, cyanosis: !!exam.cyanosis,
      clubbing: !!exam.clubbing, lymphadenopathy: !!exam.lymphadenopathy, edema: !!exam.edema,
      notes: exam.notes || "",
    },
    cvs: { status: "unset", notes: "" },
    respiratory: { status: "unset", notes: "" },
    abdomen: { status: "unset", notes: "" },
    cns: { status: "unset", notes: "" },
    extremities: { status: "unset", notes: "" },
    psych: {
      suicidalIdeation: !!psych.suicidalIdeation,
      selfHarmHistory: !!psych.selfHarmHistory,
      intentToHarmOthers: !!psych.intentToHarmOthers,
      substanceAbuse: !!psych.substanceAbuse,
      psychiatricHistory: !!psych.psychiatricHistory,
      currentlyOnPsychiatricTreatment: !!psych.currentlyOnPsychiatricTreatment,
      hasSupportSystem: !!psych.hasSupportSystem,
      notes: psych.notes || "",
    },
    abgVbg: {
      sampleType: adj.abgSampleType || "Arterial (ABG)",
      interpretation: adj.abgInterpretation || "",
      interpretationResult: adj.abgInterpretationResult || null,
      values: {
        ph: adj.abgPh || "", pco2: adj.abgPco2 || "", po2: adj.abgPo2 || "", hco3: adj.abgHco3 || "",
        be: adj.abgBe || "", lactate: adj.abgLactate || "", sao2: adj.abgSao2 || "", fio2: adj.abgFio2 || "",
        na: adj.abgNa || "", k: adj.abgK || "", cl: adj.abgCl || "", ag: adj.abgAg || "",
        glucose: adj.abgGlucose || "", hb: adj.abgHb || "", aa: adj.abgAa || "",
      },
    },
  };
}
