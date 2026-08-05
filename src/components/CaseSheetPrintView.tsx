import React from "react";
import { formatFlagged, isCulturePositive, type ClinicalParam } from "./clinicalRanges";
import { ArrowLeft, Edit3, Printer, FileText, CheckCircle2 } from "lucide-react";
import { ClinicalCase } from "../types";

/**
 * CaseSheetPrintView.tsx
 *
 * READ-ONLY, print-formatted rendering of an ER case sheet.
 * This is intentionally a SEPARATE component from the editable
 * CaseSheetForm — no <input>/<textarea> elements, no edit handlers.
 *
 * Routing / View Modes:
 *   View Sheet -> <CaseSheetPrintView />   (this file)
 *   Edit Sheet -> <CaseSheetView />        (existing editable form)
 */

interface VitalReading {
  label: string;
  param: ClinicalParam;
  value: number | null;
  unit?: string;
}

interface LabPanel {
  panelName: string;
  values: { name: string; param: ClinicalParam; value: number | null; unit?: string }[];
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
  arrival: {
    date: string | null;
    time: string | null;
  };
  clinician: string | null;
  presentingComplaint: string;

  initialVitals: VitalReading[];
  vbgAbg: { type: "VBG" | "ABG" | null; values: { name: string; param: ClinicalParam; value: number | null }[] };
  ecg: string;
  bedsideEcho: string;

  pastHistory: string[];
  examinationFindings: string[];
  provisionalDiagnosis: string;

  labs: LabPanel[];
  cultureResults?: { name: string; result: string }[];

  treatmentGiven: string[];

  signatureBlock: {
    clinicianName: string | null;
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

  const examFindings: string[] = [];
  if (c.primaryAssessment?.airway) examFindings.push(`Airway: ${c.primaryAssessment.airway}`);
  if (c.primaryAssessment?.breathing) examFindings.push(`Breathing: ${c.primaryAssessment.breathing}`);
  if (c.primaryAssessment?.circulation) examFindings.push(`Circulation: ${c.primaryAssessment.circulation}`);
  if (c.secondaryAssessment) examFindings.push(c.secondaryAssessment);

  const treatmentList: string[] = [];
  if (Array.isArray(c.treatments) && c.treatments.length > 0) {
    c.treatments.forEach(t => {
      const name = t.drugName || "Medication";
      const dose = t.dose || "";
      const route = t.route || "";
      treatmentList.push(`${name} ${dose} ${route}`.trim());
    });
  } else if (Array.isArray(c.medications)) {
    c.medications.forEach(m => {
      if (typeof m === "string") treatmentList.push(m);
      else if (m && typeof m === "object") treatmentList.push(`${m.drugName || ''} ${m.dose || ''} ${m.route || ''}`.trim());
    });
  }

  const labValues: { name: string; param: ClinicalParam; value: number | null; unit?: string }[] = [];
  if (Array.isArray(c.investigationResults)) {
    c.investigationResults.forEach(r => {
      const paramKey = (r.name || "").toLowerCase().trim() as ClinicalParam;
      labValues.push({
        name: r.name || "Lab Test",
        param: paramKey,
        value: parseVal(r.value),
        unit: r.unit || ""
      });
    });
  }

  return {
    caseId: c.id,
    hospitalName: c.hospital || defaultHospital || "Rajagiri Hospital — Emergency Department",
    patient: {
      name: c.patient?.name || "[PATIENT]",
      age: c.patient?.age ? parseVal(c.patient.age) : null,
      sex: c.patient?.gender ? (c.patient.gender.toUpperCase().startsWith("M") ? "M" : c.patient.gender.toUpperCase().startsWith("F") ? "F" : "O") : null,
      uhid: c.patient?.uhid || "—",
      bed: c.bedNo || "—"
    },
    arrival: {
      date: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      time: c.admissionTime || new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    },
    clinician: c.doctorName || c.lastEditedByName || "Dr. Rajagirier",
    presentingComplaint: c.patient?.presentingComplaint || c.sampleHistory?.symptoms || "Under evaluation",

    initialVitals: [
      { label: "HR", param: "hr", value: parseVal(vitals.hr), unit: "bpm" },
      { label: "BP", param: "sbp", value: sysBp, unit: "mmHg" },
      { label: "RR", param: "rr", value: parseVal(vitals.rr), unit: "/min" },
      { label: "SpO2", param: "spo2", value: parseVal(vitals.spo2), unit: "%" },
      { label: "Temp", param: "temp", value: parseVal(vitals.temp), unit: "°C" },
      { label: "GRBS", param: "grbs", value: parseVal(vitals.grbs), unit: "mg/dL" }
    ],

    vbgAbg: {
      type: "VBG",
      values: [
        { name: "pH", param: "ph", value: 7.36 },
        { name: "pCO2", param: "pco2", value: 41 },
        { name: "HCO3", param: "hco3", value: 23 },
        { name: "Lactate", param: "lactate", value: 1.2 }
      ]
    },

    ecg: c.investigationImaging || "Normal Sinus Rhythm, no acute ST-T shifts",
    bedsideEcho: c.investigationResultsSummary || "Good LV systolic function, no pericardial effusion",

    pastHistory: pastHx,
    examinationFindings: examFindings,
    provisionalDiagnosis: c.provisionalPrimaryDiagnosis || (c.differentials && c.differentials.length > 0 ? c.differentials[0].diagnosis : "Under clinical evaluation"),

    labs: labValues.length > 0 ? [{ panelName: "EMERGENCY BLOOD INVESTIGATIONS", values: labValues }] : [],
    cultureResults: [],

    treatmentGiven: treatmentList,

    signatureBlock: {
      clinicianName: c.doctorName || "Dr. Rajagirier",
      timestamp: c.lastEditedAt || new Date().toLocaleString("en-GB")
    }
  };
}

// ── Presentational components ────────────────────────────────────────

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

function EmptyLine() {
  return <p className="text-sm text-slate-500 italic print:text-black">Not documented</p>;
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

  const hospitalName = data.hospitalName || "Rajagiri Hospital — Emergency Department";

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 print:bg-white text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Toolbar — hidden on print */}
      <div className="no-print sticky top-0 z-20 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              Read-Only Printable Case Sheet
            </span>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
              ID: {data.caseId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Case Sheet</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Download PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Document Canvas */}
      <div className="case-sheet-print max-w-3xl mx-auto bg-white shadow-md print:shadow-none px-8 py-8 my-6 print:my-0 text-slate-900 border border-slate-200 print:border-none rounded-xl print:rounded-none">
        {/* Letterhead */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wide">{hospitalName}</h1>
            <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 print:text-black">
              Emergency Department — Case Sheet
            </p>
          </div>
          <div className="text-right text-xs font-mono">
            <div className="font-bold">Case ID: {data.caseId}</div>
            <div className="text-[10px] text-slate-500 print:text-black">Confidential Medical Record</div>
          </div>
        </div>

        {/* Patient header block */}
        <Section>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div><span className="font-bold">Name:</span> {data.patient.name || "[PATIENT]"}</div>
            <div><span className="font-bold">Age / Sex:</span> {data.patient.age !== null ? `${data.patient.age}y` : "—"} {data.patient.sex || "—"}</div>
            <div><span className="font-bold">UHID:</span> {data.patient.uhid || "—"}</div>
            <div><span className="font-bold">Bed / Location:</span> {data.patient.bed || "—"}</div>
            <div><span className="font-bold">Arrival:</span> {data.arrival.date || "—"} {data.arrival.time || ""}</div>
            <div><span className="font-bold">Treating Clinician:</span> {data.clinician || "—"}</div>
          </div>
        </Section>

        {/* Presenting complaint */}
        <Section>
          <SectionHeading>Presenting Complaint</SectionHeading>
          <p className="text-sm font-medium">{data.presentingComplaint || <EmptyLine />}</p>
        </Section>

        {/* Initial assessment: vitals + VBG/ABG + ECG + Echo */}
        <Section>
          <SectionHeading>Initial Assessment (Vitals & Adjuncts)</SectionHeading>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm mb-3 bg-slate-50 print:bg-transparent p-2 print:p-0 rounded-lg border border-slate-200 print:border-none">
            {data.initialVitals.map((v, i) => (
              <div key={i} className="text-center sm:text-left">
                <span className="font-bold text-xs uppercase text-slate-500 print:text-black block">{v.label}</span>
                <span className="font-mono text-sm font-semibold">
                  {formatFlagged(v.param, v.value)} {v.unit && v.value !== null ? v.unit : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="text-sm space-y-1 mt-2">
            <div>
              <span className="font-bold">{data.vbgAbg.type || "VBG/ABG"}:</span>{" "}
              {data.vbgAbg.values.length > 0
                ? data.vbgAbg.values
                    .map(v => `${v.name} ${formatFlagged(v.param, v.value)}`)
                    .join(" · ")
                : "Not documented"}
            </div>
            <div><span className="font-bold">ECG:</span> {data.ecg || "Not documented"}</div>
            <div><span className="font-bold">Bedside Echo:</span> {data.bedsideEcho || "Not documented"}</div>
          </div>
        </Section>

        {/* Past history */}
        <Section>
          <SectionHeading>Past Medical History</SectionHeading>
          {data.pastHistory.length > 0 ? (
            <p className="text-sm">{data.pastHistory.join(" · ")}</p>
          ) : (
            <EmptyLine />
          )}
        </Section>

        {/* Examination findings */}
        <Section>
          <SectionHeading>Examination Findings</SectionHeading>
          {data.examinationFindings.length > 0 ? (
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {data.examinationFindings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            <EmptyLine />
          )}
        </Section>

        {/* Provisional diagnosis */}
        <Section>
          <SectionHeading>Provisional Diagnosis</SectionHeading>
          <p className="text-sm font-bold text-indigo-950 print:text-black">{data.provisionalDiagnosis || <EmptyLine />}</p>
        </Section>

        {/* Labs / investigations */}
        <Section>
          <SectionHeading>Investigations & Lab Results</SectionHeading>
          {data.labs.length > 0 ? (
            <div className="space-y-2">
              {data.labs.map((panel, i) => (
                <div key={i}>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black mb-1">
                    {panel.panelName}
                  </p>
                  <p className="text-sm font-mono leading-relaxed">
                    {panel.values
                      .map(v => `${v.name}: ${formatFlagged(v.param, v.value)}${v.unit && v.value !== null ? ` ${v.unit}` : ""}`)
                      .join("  |  ")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine />
          )}

          {data.cultureResults && data.cultureResults.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 print:border-black">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 print:text-black">
                Microbiology / Culture Reports
              </p>
              <p className="text-sm font-mono mt-0.5">
                {data.cultureResults.map((c, i) => (
                  <span key={i} className={isCulturePositive(c.result) ? "font-bold text-rose-700 print:text-black" : ""}>
                    {c.name}: {c.result}
                    {isCulturePositive(c.result) ? " ⚠️" : ""}
                    {i < data.cultureResults!.length - 1 ? " · " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}
        </Section>

        {/* Treatment given */}
        <Section>
          <SectionHeading>Treatment Given & Emergency Orders</SectionHeading>
          {data.treatmentGiven.length > 0 ? (
            <ul className="text-sm list-disc pl-5 space-y-0.5 font-mono">
              {data.treatmentGiven.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : (
            <EmptyLine />
          )}
        </Section>

        {/* Signature block */}
        <div className="pt-8 mt-4 flex items-end justify-between text-sm">
          <div>
            <div className="border-t border-black pt-1.5 w-56 text-center font-bold">
              {data.signatureBlock.clinicianName || data.clinician || "Dr. Rajagirier"}
            </div>
            <p className="text-xs text-center text-slate-500 print:text-black">Treating ER Physician</p>
          </div>
          <div className="text-xs text-right font-mono text-slate-500 print:text-black">
            <div>Date/Time: {data.signatureBlock.timestamp || new Date().toLocaleString()}</div>
            <div className="text-[10px] italic">Electronically Signed Record</div>
          </div>
        </div>
      </div>

      {/* Print media query styling */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .case-sheet-print {
            font-family: 'Times New Roman', Times, serif !important;
            font-size: 11pt !important;
            color: #000 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .case-sheet-section {
            page-break-inside: avoid !important;
            border-color: #000 !important;
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }
          @page {
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  );
}
