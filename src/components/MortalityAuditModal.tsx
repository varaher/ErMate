import React, { useState } from "react";
import {
  FileText, ShieldAlert, Download, AlertTriangle, CheckCircle2,
  X, Sparkles, Clock, RefreshCw, BookOpen, AlertCircle, ShieldCheck,
  MessageSquare
} from "lucide-react";
import { UserProfile, ClinicalCase } from "../types";
import { BoundChatModal } from "./BoundChatModal";
import VoiceRecorder from "./shared/VoiceRecorder";

interface MortalityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  cases?: ClinicalCase[];
}

export default function MortalityAuditModal({
  isOpen,
  onClose,
  profile,
  cases = [],
}: MortalityAuditModalProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [patientInitials, setPatientInitials] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [isDiscussModalOpen, setIsDiscussModalOpen] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    if (!caseId) return;

    const foundCase = cases.find((c) => c.id === caseId);
    if (foundCase) {
      setPatientInitials(
        foundCase.patient?.name
          ? foundCase.patient.name.split(" ").map((n) => n[0]).join("")
          : "PT"
      );

      const constructedEmr = `
PATIENT DETAILS:
Name: ${foundCase.patient?.name || "Unidentified"}
Age/Sex: ${foundCase.patient?.age ?? ""}/${foundCase.patient?.gender || ""}
Hospital No / ID: ${foundCase.id}

PRESENTING COMPLAINT & INITIAL TRIAGE:
Chief Complaints: ${foundCase.patient?.presentingComplaint || "Emergency presentation"}
Triage Category: ${foundCase.patient?.triageCategory || "P1 (Immediate)"}
Vitals on Arrival: BP ${foundCase.vitals?.bp || "N/A"}, HR ${foundCase.vitals?.hr || "N/A"}, SpO2 ${foundCase.vitals?.spo2 || "N/A"}%, RR ${foundCase.vitals?.rr || "N/A"}, Temp ${foundCase.vitals?.temp || "N/A"}

SAMPLE HISTORY & EXAMINATION:
Symptoms: ${foundCase.sampleHistory?.symptoms || "N/A"}
Allergies: ${foundCase.sampleHistory?.allergies || "None documented"}
Medications: ${foundCase.sampleHistory?.medications || "None"}
Past History: ${foundCase.sampleHistory?.pastHistory || "None"}
Last Meal: ${foundCase.sampleHistory?.lastMeal || "N/A"}
Events: ${foundCase.sampleHistory?.events || "N/A"}

PRIMARY ASSESSMENT:
Airway: ${foundCase.primaryAssessment?.airway || "Patent"}
Breathing: ${foundCase.primaryAssessment?.breathing || "Spontaneous"}
Circulation: ${foundCase.primaryAssessment?.circulation || "Stable"}
Disability (GCS): ${foundCase.primaryAssessment?.disability || "15/15"}
Exposure: ${foundCase.primaryAssessment?.exposure || "Normal"}

INVESTIGATIONS & TREATMENTS PERFORMED:
Investigations: ${foundCase.investigations?.map((i) => `${i.testName}: ${i.result || "Done"}`).join("\n") || "ECG, ABG, Routine Labs"}
Treatments Given: ${foundCase.treatments?.map((t) => `${t.drugName} ${t.dose} (${t.route})`).join("\n") || "Resuscitation protocol executed"}

DISPOSITION / CLINICAL OUTCOME:
Status: ${foundCase.status || "Mortality note recorded"}
Clinical Progress Notes: ${foundCase.progressNotes || "Deteriorated despite CPR and resuscitation."}
      `.trim();

      setRawText(constructedEmr);
    }
  };

  const handleGenerateAudit = async () => {
    if (!rawText.trim()) {
      setErrorMsg("Please paste or auto-fill clinical EMR text before generating.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const resp = await fetch("/api/mortality-audit/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawText,
          caseId: selectedCaseId || undefined,
          patientInitials: patientInitials || undefined,
          hospitalName: profile.hospital || "Emergency Department",
          user: {
            uid: profile.email,
            email: profile.email,
            isHOD: true,
            role: profile.role || "hod",
          },
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Audit generation failed. Please try again later.");
      }

      setAuditResult(data.audit);
    } catch (err: any) {
      console.error("[MortalityAuditModal Error]:", err);
      setErrorMsg(err.message || "Audit generation unavailable. Please try again later.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!auditResult) return;
    setIsDownloading(true);

    try {
      const resp = await fetch("/api/mortality-audit/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audit: auditResult,
          user: {
            uid: profile.email,
            email: profile.email,
            isHOD: true,
            role: profile.role || "hod",
          },
        }),
      });

      if (!resp.ok) {
        throw new Error("Failed to download document");
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ErMate_MortalityAudit_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Could not download Word document: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const info = auditResult?.patientInfo || {};
  const cause = auditResult?.causeOfDeath || {};
  const preventability = auditResult?.preventabilityAssessment || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Mortality & Morbidity (M&M) Audit Engine
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
                  HOD & Consultant Restricted
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confidential Medico-Legal Review · ErMate AI Quality Guaranteed
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Top Confidential Notice Banner */}
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">CONFIDENTIAL MEDICO-LEGAL DOCUMENT:</strong> This audit report is generated strictly for internal quality improvement and NABH compliance. Information is restricted to HODs and M&M Committee members.
            </div>
          </div>

          {/* Form Input Section */}
          {!auditResult && (
            <div className="space-y-4">
              
              {/* Select from existing cases if available */}
              {cases.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Auto-fill from Active Emergency Case (Optional)</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {cases.length} active case(s) loaded
                    </span>
                  </label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => handleSelectCase(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="">-- Select a patient case from ER log --</option>
                    {cases.map((c, idx) => (
                      <option key={`${c.id}-${idx}`} value={c.id}>
                        {c.patient?.name || "Unidentified"} ({c.patient?.age ?? "?"}y/{c.patient?.gender || "?"}) — Presenting: {c.patient?.presentingComplaint || "N/A"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Paste EMR Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Complete EMR Clinical Notes / Nursing Notes / Death Summary</span>
                  <span className="text-[11px] text-slate-400">
                    Paste raw text (Chronological or Reverse order)
                  </span>
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={9}
                    placeholder="Paste raw EMR notes, triage history, resuscitation progress notes, ABG/ECG reports, and death notes here..."
                    className="flex-1 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-y"
                  />
                  <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setRawText(prev => prev ? `${prev} ${txt}` : txt)} />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGenerateAudit}
                  disabled={isGenerating || !rawText.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Conducting M&M Audit...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>Generate Formal Mortality Audit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Rendered Audit Result */}
          {auditResult && (
            <div className="space-y-6">
              
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Audit Analysis Completed
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDiscussModalOpen(true)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Discuss this mortality audit with ErMate AI"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discuss Audit</span>
                  </button>
                  <button
                    onClick={() => setAuditResult(null)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Auditor Input
                  </button>
                  <button
                    onClick={handleDownloadDocx}
                    disabled={isDownloading}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span>{isDownloading ? "Generating Word Doc..." : "Download Word Doc (.docx)"}</span>
                  </button>
                </div>
              </div>

              {/* Document Header Box */}
              <div className="p-5 border-2 border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-4">
                
                <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4 space-y-1">
                  <h1 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    {profile.hospital || "Emergency Care Hospital"}
                  </h1>
                  <h2 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                    Confidential Mortality & Morbidity (M&M) Audit Report
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Strictly for Departmental Quality Committee & NABH Compliance
                  </p>
                </div>

                {/* 1. Patient Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl text-xs border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Patient Name / ID</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{info.name || "Unidentified"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Age / Sex</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{info.ageSex || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Date of Admission</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{info.dateAdmission || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Date & Time of Death</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{info.dateDeath || "N/A"} ({info.timeOfDeath || ""})</span>
                  </div>
                </div>

                {/* 2. Presenting Complaint & History */}
                <div className="space-y-2 text-xs">
                  <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    Clinical Presentation & Past History
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <strong className="block text-[11px] font-semibold text-slate-500 mb-1">Presenting Complaint at Admission:</strong>
                      <p>{auditResult.presentingComplaintAtAdmission || "N/A"}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <strong className="block text-[11px] font-semibold text-slate-500 mb-1">Past Medical / Surgical History:</strong>
                      <p>{auditResult.pastHistory || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* 3. Diagnoses at Death */}
                <div className="space-y-2 text-xs">
                  <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
                    Diagnoses at Time of Death
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(auditResult.diagnosisAtDeath) ? (
                      auditResult.diagnosisAtDeath.map((dx: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md font-medium border border-slate-200 dark:border-slate-700">
                          {dx}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400">{auditResult.diagnosisAtDeath || "N/A"}</span>
                    )}
                  </div>
                </div>

                {/* 4. Chronological Hospital Course */}
                <div className="space-y-2 text-xs">
                  <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Structured Hospital Course Narrative
                  </h3>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                    {auditResult.hospitalCourse || "N/A"}
                  </div>
                </div>

                {/* 5. Cause of Death Deconstruction */}
                <div className="space-y-2 text-xs">
                  <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
                    Cause of Death Deconstruction
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/30 rounded-lg border border-rose-200/60 dark:border-rose-900/40">
                      <strong className="text-rose-700 dark:text-rose-400 text-[11px]">Immediate Cause (Part I):</strong>
                      <p className="font-medium text-slate-900 dark:text-white">{cause.immediate || "N/A"}</p>
                    </div>
                    <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                      <strong className="text-amber-700 dark:text-amber-400 text-[11px]">Precipitating Cause:</strong>
                      <p className="font-medium text-slate-900 dark:text-white">{cause.precipitating || "N/A"}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                      <strong className="text-slate-500 text-[11px]">Underlying Pathology:</strong>
                      <p className="font-medium text-slate-900 dark:text-white">{cause.underlying || "N/A"}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                      <strong className="text-slate-500 text-[11px]">Contributing Factors (Part II):</strong>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {Array.isArray(cause.contributing) ? cause.contributing.join("; ") : cause.contributing || "None"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 6. Clinical Decision Review Table */}
                {Array.isArray(auditResult.clinicalDecisionReview) && auditResult.clinicalDecisionReview.length > 0 && (
                  <div className="space-y-2 text-xs">
                    <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
                      Clinical Decision & Management Assessment
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 dark:bg-slate-950 font-bold text-slate-700 dark:text-slate-300">
                          <tr>
                            <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Clinical Decision</th>
                            <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Assessment</th>
                            <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Rationale</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {auditResult.clinicalDecisionReview.map((dec: any, idx: number) => {
                            let badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
                            if (dec.assessment === "APPROPRIATE_WITH_DELAY") {
                              badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
                            } else if (dec.assessment === "REQUIRES_DISCUSSION") {
                              badgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
                            } else if (dec.assessment === "NOT_DOCUMENTED") {
                              badgeStyle = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                            }

                            return (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-950/50">
                                <td className="p-2.5 font-medium text-slate-900 dark:text-white">{dec.decision}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeStyle}`}>
                                    {dec.assessment}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                  {dec.rationale}
                                  {dec.question && (
                                    <span className="block text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                      Q: {dec.question}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 7. Preventability & System Issues */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  
                  {/* Preventability */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Preventability Category</span>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold ${
                        preventability.category === "NON_PREVENTABLE"
                          ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          : preventability.category === "POTENTIALLY_PREVENTABLE"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      }`}>
                        {preventability.category || "NON_PREVENTABLE"}
                      </span>
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {preventability.rationale || "N/A"}
                    </p>
                  </div>

                  {/* System Issues */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white">
                      System & Process Issues Identified
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                      {Array.isArray(auditResult.systemIssuesIdentified) && auditResult.systemIssuesIdentified.length > 0 ? (
                        auditResult.systemIssuesIdentified.map((sys: string, i: number) => (
                          <li key={i}>{sys}</li>
                        ))
                      ) : (
                        <li>No structural process gaps identified</li>
                      )}
                    </ul>
                  </div>

                </div>

                {/* 8. Learning Points & References */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl space-y-2">
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-200">
                      Key Actionable Learning Points
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-indigo-800 dark:text-indigo-300 text-[11px]">
                      {Array.isArray(auditResult.learningPoints) ? (
                        auditResult.learningPoints.map((lp: string, i: number) => (
                          <li key={i}>{lp}</li>
                        ))
                      ) : (
                        <li>N/A</li>
                      )}
                    </ul>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                      Verifiable Clinical References
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                      {Array.isArray(auditResult.references) ? (
                        auditResult.references.map((ref: string, i: number) => (
                          <li key={i}>{ref}</li>
                        ))
                      ) : (
                        <li>N/A</li>
                      )}
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <span>ErMate Quality & Medico-Legal Suite</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Audit
          </button>
        </div>

      </div>

      {/* Bound Chat Modal */}
      {auditResult && (
        <BoundChatModal
          context={{
            type: 'mortality_audit',
            id: selectedCaseId || `mortality_audit_${patientInitials}`,
            data: auditResult,
            canEdit: true
          }}
          isOpen={isDiscussModalOpen}
          onClose={() => setIsDiscussModalOpen(false)}
        />
      )}
    </div>
  );
}
