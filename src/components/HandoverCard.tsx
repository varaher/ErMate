// ============================================================
// ErMate — Handover Card React Component
// File: src/components/HandoverCard.tsx
// ============================================================

import React from 'react';
import '../styles/handover.css';
import type { HandoverPatient } from '../types';

export type { HandoverPatient };

const STATUS_COLORS = {
  critical:  { bg: '#FEF2F2', border: '#DC2626', chip: '#DC2626' },
  unstable:  { bg: '#FFFBEB', border: '#D97706', chip: '#D97706' },
  stable:    { bg: '#F0FFF4', border: '#065F46', chip: '#065F46' },
  discharge: { bg: '#F5F3FF', border: '#6366F1', chip: '#6366F1' },
};

const ALERT_COLORS = {
  critical: '#DC2626',
  warning:  '#D97706',
  stable:   '#065F46',
};

function getAlertSeverity(alertRow: string): 'critical' | 'warning' | 'stable' {
  if (!alertRow || alertRow.startsWith('✓')) return 'stable';
  const critical = [
    'HR 1', 'HR 2', 'SpO₂', 'Temp 10', 'BP <',
    'Lactate', 'AKI', 'MICU', 'not reviewed', 'not done',
    'Trop', 'GRBS >3', 'pH 7.1', 'pH 7.2',
  ];
  if (critical.some(s => alertRow.includes(s))) return 'critical';
  return 'warning';
}

function splitColumns<T>(items: T[], maxCols = 3): T[][] {
  const n = items.length;
  if (!n) return [];
  if (n <= 4) return [items];
  if (n <= 8) {
    const mid = Math.ceil(n / 2);
    return [items.slice(0, mid), items.slice(mid)];
  }
  const size = Math.ceil(n / 3);
  return [
    items.slice(0, size),
    items.slice(size, size * 2),
    items.slice(size * 2),
  ];
}

export function HandoverCard({
  patient,
  onDiscuss,
  onDownloadPdf
}: {
  patient: HandoverPatient;
  onDiscuss?: (patient: HandoverPatient) => void;
  onDownloadPdf?: (patient: HandoverPatient) => void;
}) {
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const statusKey = (patient?.patientLabel?.status as keyof typeof STATUS_COLORS) || 'unstable';
  const colors = STATUS_COLORS[statusKey] || STATUS_COLORS.unstable;

  const handleSinglePdfDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownloadPdf) {
      onDownloadPdf(patient);
      return;
    }

    setDownloadingPdf(true);
    try {
      const pl: any = patient.patientLabel || {};
      const response = await fetch("/api/handover/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toLocaleDateString(),
          facility: pl.admittingDepartment || "Emergency Department",
          clinician: pl.admittingConsultant || pl.treatingERPhysician || "Duty ER Physician",
          patients: [{
            id: patient.id || "card",
            bed: pl.bed || "N/A",
            name: pl.name || "Patient",
            ageGender: pl.ageSex || "N/A",
            erNo: pl.erNumber || "N/A",
            doctor: pl.admittingConsultant || pl.treatingERPhysician || "Duty Medical Officer",
            vitals: patient.vitalsNow || "Stable",
            complaints: patient.presentingComplaint || "Emergency evaluation",
            assessment: patient.diagnosis || "Under evaluation",
            planToBeDone: (patient.done || []).concat(patient.toBeDone || []).join(" | "),
            alerts: patient.alertBanner?.summary || (patient.criticalAlerts || []).join(" · ") || "None"
          }]
        })
      });

      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Handover_${(pl.name || 'Patient').replace(/\s+/g, '_')}_A4_Portrait.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[HandoverCard Single PDF Download Error]", err);
    } finally {
      setDownloadingPdf(false);
    }
  };
  const severity = getAlertSeverity(patient?.alertRow || '');
  const alertColor = ALERT_COLORS[severity];

  const doneList = patient?.managementPlan?.done || patient?.done || [];
  const todoList = patient?.managementPlan?.pending || patient?.toBeDone || [];

  const doneCols = splitColumns(doneList);
  const todoCols = splitColumns(todoList);

  const ab = patient?.alertBanner;
  const isBoarder = Boolean(patient?.patientLabel?.erBoarder || (patient?.patientLabel?.daysInERSinceAdmission && patient.patientLabel.daysInERSinceAdmission > 0));

  return (
    <div
      className="hov-card"
      style={{ borderColor: colors.border }}
    >
      {/* ── 0. ALERT BANNER (Always First, Always Visible) ───────── */}
      <div className={ab?.summary && ab.summary !== "No critical alerts flagged" ? "hov-alert-banner" : "hov-alert-banner hov-alert-banner-safe"}>
        <div className="hov-alert-banner-title" style={{ color: ab?.summary && ab.summary !== "No critical alerts flagged" ? '#DC2626' : '#166534' }}>
          {ab?.summary && ab.summary !== "No critical alerts flagged" ? '⚠ CRITICAL ALERT BANNER' : '✓ ALERT BANNER'}
        </div>
        <div className="hov-alert-banner-content min-w-0 break-words flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: ab?.summary && ab.summary !== "No critical alerts flagged" ? '#991B1B' : '#14532D' }}>
          <span>
            {ab?.summary ? ab.summary : (
              (patient?.criticalAlerts && patient.criticalAlerts.length > 0)
                ? patient.criticalAlerts.join(' · ')
                : 'No critical alerts flagged'
            )}
          </span>
          {ab?.criticalAllergies && <span className="font-bold text-red-700">| Allergy: {ab.criticalAllergies}</span>}
          {ab?.codeStatus && <span className="font-bold text-slate-800">| Code: {ab.codeStatus}</span>}
          {ab?.isolationPrecautions && <span className="font-bold text-amber-800">| Isolation: {ab.isolationPrecautions}</span>}
          {ab?.fallRisk && <span className="font-bold text-amber-800">| Fall Risk</span>}
        </div>
      </div>

      {/* ── 1. HEADER ────────────────────────────────────────────── */}
      <div
        className="hov-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 relative"
        style={{ background: colors.bg }}
      >
        <div
          className="hov-status-bar"
          style={{ background: colors.border }}
        />
        <div className="hov-header-content min-w-0 flex-1">
          <div className="hov-bed-name flex flex-wrap items-center gap-2 min-w-0">
            {patient?.patientLabel?.bed && (
              <span className="hov-bed shrink-0">
                Bed {patient.patientLabel.bed}
              </span>
            )}
            <span className="hov-name truncate min-w-0 max-w-full">
              {patient?.patientLabel?.name || 'Bed Patient'}
            </span>
            {patient?.patientLabel?.ageSex && (
              <span className="hov-agesex shrink-0">
                {patient.patientLabel.ageSex}
              </span>
            )}
            {isBoarder && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-md border border-amber-300 shrink-0">
                ⚠ ER BOARDER {patient?.patientLabel?.daysInERSinceAdmission ? `(${patient.patientLabel.daysInERSinceAdmission}d in ER)` : ''}
              </span>
            )}
          </div>
          <div className="hov-meta flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-600 mt-0.5 min-w-0">
            {patient?.patientLabel?.currentLocation && (
              <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                📍 {patient.patientLabel.currentLocation}
              </span>
            )}
            {patient?.patientLabel?.admittingDepartment && (
              <span className="font-semibold text-slate-800">{patient.patientLabel.admittingDepartment}</span>
            )}
            {patient?.patientLabel?.admittingConsultant && (
              <span>· {patient.patientLabel.admittingConsultant}</span>
            )}
            {patient?.patientLabel?.treatingERPhysician && (
              <span>· ER Dr: {patient.patientLabel.treatingERPhysician}</span>
            )}
            {patient?.patientLabel?.inERSince && (
              <span>· Arrived: {patient.patientLabel.inERSince}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap self-end sm:self-center">
          <button
            type="button"
            onClick={handleSinglePdfDownload}
            disabled={downloadingPdf}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-800 font-extrabold text-[11px] shadow-2xs transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 shrink-0"
            title="Download Portrait A4 Handover PDF for this patient"
          >
            <span>{downloadingPdf ? '⌛ PDF...' : '📄 PDF'}</span>
          </button>
          {onDiscuss && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDiscuss(patient);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-800 font-extrabold text-[11px] shadow-2xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
              title="Discuss this handover record with ErMate AI"
            >
              <span>💬 Discuss</span>
            </button>
          )}
          <div
            className="hov-chip shrink-0"
            style={{ background: colors.chip }}
          >
            {(patient?.patientLabel?.status || 'UNSTABLE').toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── 2. PRESENTING COMPLAINT & INITIAL PRESENTATION (SECTION 3) ── */}
      {patient?.presentingComplaint && (
        <div className="hov-section">
          <div className="hov-label">Presenting Complaint</div>
          <div className="hov-value font-medium text-slate-900">
            {patient.presentingComplaint}
          </div>
        </div>
      )}

      {/* ── 3. INITIAL PRESENTATION AT ARRIVAL (LOCKED SECTION 3) ── */}
      {(patient?.initialPresentation || patient?.adjunctsAtArrival) && (
        <div 
          className="hov-section" 
          style={{ borderLeft: '3px solid #3B82F6', background: '#EFF6FF' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="hov-label text-blue-900 font-extrabold flex items-center gap-1">
              Section 3: Initial Presentation at Arrival
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded border border-blue-200">
              🔒 Locked (Write-Once)
            </span>
          </div>
          <div className="text-[12.5px] text-slate-900 space-y-1">
            {patient.initialPresentation?.chiefComplaint && (
              <div><strong>Chief Complaint:</strong> {patient.initialPresentation.chiefComplaint}</div>
            )}
            {patient.initialPresentation?.initialVitals && (
              <div><strong>Arriving Vitals:</strong> {patient.initialPresentation.initialVitals}</div>
            )}
            {patient.initialPresentation?.abcdeArrival && (
              <div className="text-[12px] bg-white p-1.5 rounded border border-blue-200 font-mono">
                <strong>ABCDE on Arrival:</strong> {patient.initialPresentation.abcdeArrival}
              </div>
            )}
            {patient.initialPresentation?.initialImpression && (
              <div className="italic text-slate-700">
                <strong>Initial Impression:</strong> {patient.initialPresentation.initialImpression}
              </div>
            )}
            {/* Initial Assessment Adjuncts */}
            {(() => {
              const adjAtArr = patient.adjunctsAtArrival || patient.initialPresentation?.adjunctsAtArrival;
              if (!adjAtArr) return null;
              if (typeof adjAtArr === 'string') {
                return (
                  <div className="text-[11.5px] text-slate-700 mt-1">
                    <strong>Devices/Tests on Arrival:</strong> {adjAtArr}
                  </div>
                );
              }
              const entries = Object.entries(adjAtArr).filter(([_, v]) => Boolean(v));
              if (entries.length === 0) return null;

              const labelMap: Record<string, string> = {
                ecg: 'ECG',
                vbg: 'VBG',
                abg: 'ABG',
                grbs: 'GRBS',
                lactate: 'Lactate',
                troponinPOC: 'Troponin POC',
                bedsideEcho: 'Bedside Echo',
                efast: 'EFAST',
                outsideReports: 'Outside Reports',
                physicalOnArrival: 'On Arrival Physical/Devices',
              };

              return (
                <div className="mt-2 space-y-1 bg-white/80 p-2 rounded border border-blue-200">
                  <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Initial Assessment Adjuncts & POC Tests:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[11.5px]">
                    {entries.map(([key, val]) => (
                      <div key={key} className="bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-800">
                        <strong className="text-slate-900">{labelMap[key] || key}:</strong> {String(val)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── 3. COURSE IN ER (DAY-WISE TIMELINE) ──────────────────── */}
      {patient?.courseInERDayWise && patient.courseInERDayWise.length > 0 && (
        <div className="hov-section">
          <div className="hov-label">Course in ER (Day-Wise Timeline)</div>
          <div className="space-y-1 mt-1">
            {patient.courseInERDayWise.map((entry, idx) => (
              <div key={idx} className="hov-timeline-row">
                <span className="hov-timeline-date">{entry.date}:</span>
                <span className="hov-timeline-summary">{entry.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. ACTIVE PROBLEM LIST ──────────────────────────────── */}
      {patient?.activeProblemList && patient.activeProblemList.length > 0 && (
        <div className="hov-section">
          <div className="hov-label">Active Problem List (Identified during ER Stay)</div>
          <div className="space-y-1 mt-1">
            {patient.activeProblemList.map((prob, idx) => {
              const statusClass = prob.status === 'Resolved' ? 'problem-resolved'
                : prob.status === 'Ongoing' ? 'problem-ongoing' : 'problem-pending-workup';
              const icon = prob.status === 'Resolved' ? '✓' : prob.status === 'Ongoing' ? '●' : '?';
              return (
                <div key={idx} className="problem-row">
                  <span className={`problem-status ${statusClass}`}>
                    {icon} {prob.status}
                  </span>
                  <span className="problem-text">{prob.problem}</span>
                  {prob.note && <span className="problem-note">({prob.note})</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. CLINICAL STORY / NARRATIVE ────────────────────────── */}
      {patient?.story && (
        <div className="hov-section hov-story">
          <div className="hov-label">Clinical Story</div>
          <div className="hov-story-text">
            {patient.story}
          </div>
        </div>
      )}

      {/* ── 6. PAST MEDICAL HISTORY ──────────────────────────────── */}
      {(patient?.pastMedicalHistory || patient?.pmh) && (
        <div className="hov-section">
          <div className="hov-label">Past Medical History</div>
          <div className="hov-value hov-pmh">
            {patient.pastMedicalHistory || patient.pmh}
          </div>
        </div>
      )}

      {/* ── 7. PROVISIONAL DIAGNOSIS ─────────────────────────────── */}
      {patient?.diagnosis && (
        <div
          className="hov-section hov-dx"
          style={{
            background: colors.bg,
            borderLeft: `3px solid ${colors.border}`,
          }}
        >
          <div className="hov-label" style={{ color: colors.border }}>
            Provisional Diagnosis (IMP)
          </div>
          <div className="hov-dx-text">
            {patient.diagnosis}
          </div>
        </div>
      )}

      {/* ── 8. CROSS-CONSULTATIONS ──────────────────────────────── */}
      {patient?.crossConsultations && patient.crossConsultations.length > 0 && (
        <div className="hov-section">
          <div className="hov-label">Cross-Consultations</div>
          
          {/* Mobile Card View (<640px) */}
          <div className="sm:hidden consult-list space-y-2 mt-1.5">
            {patient.crossConsultations.map((c, idx) => (
              <div 
                key={idx} 
                className={`consult-card p-2.5 rounded-lg border text-xs ${
                  c.flagged ? 'consult-flagged bg-amber-50/70 border-amber-200' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="consult-header flex items-center justify-between gap-2 mb-1">
                  <span className="consult-dept font-bold text-slate-900 truncate min-w-0">
                    {c.department}
                  </span>
                  <span className={`consult-status shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.status === 'Not actioned' ? 'status-not-actioned bg-rose-100 text-rose-800' :
                    c.status === 'Awaiting review' ? 'status-awaiting-review bg-amber-100 text-amber-800' : 
                    'status-completed bg-emerald-100 text-emerald-800'
                  }`}>
                    {c.flagged ? '⚠ ' : ''}{c.status}
                  </span>
                </div>
                
                <div className="consult-meta text-[11px] text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                  {c.consultant && <span>Dr. {c.consultant}</span>}
                  {c.dateSeen && <span>· {c.dateSeen}</span>}
                </div>

                {c.recommendation && (
                  <div className="consult-rec text-[12px] text-slate-700 mt-1.5 leading-relaxed break-words">
                    <span className="font-semibold text-slate-900">Plan: </span>
                    {c.recommendation}
                  </div>
                )}

                {c.flagged && (
                  <div className="consult-flag text-[10.5px] font-bold text-amber-800 mt-1 flex items-center gap-1">
                    <span>⚠ Recommendation not yet actioned</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View (>=640px) */}
          <div className="hidden sm:block overflow-x-auto mt-1">
            <table className="consult-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Consultant</th>
                  <th>Date Seen</th>
                  <th>Key Recommendation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patient.crossConsultations.map((c, idx) => (
                  <tr key={idx} className={c.flagged ? 'consult-flagged' : ''}>
                    <td className="font-bold">{c.department}</td>
                    <td>{c.consultant}</td>
                    <td>{c.dateSeen}</td>
                    <td>{c.recommendation}</td>
                    <td className={
                      c.status === 'Not actioned' ? 'status-red' :
                      c.status === 'Awaiting review' ? 'status-amber' : 'status-green'
                    }>
                      {c.flagged ? '⚠ ' : ''}{c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 9. INVESTIGATIONS & SERIAL TRENDS ────────────────────── */}
      {patient?.investigations && (
        <div className="hov-section">
          <div className="hov-label">Investigations & Trends</div>
          {patient.investigations.trends && patient.investigations.trends.length > 0 && (
            <div className="space-y-1 mb-2">
              {patient.investigations.trends.map((t, idx) => (
                <div key={idx} className="trend-item flex flex-wrap justify-between items-baseline gap-1 py-0.5 border-b border-slate-100 min-w-0">
                  <span className="trend-param font-bold text-slate-800 min-w-0 truncate">{t.parameter}</span>
                  <span className="trend-values font-mono font-semibold text-blue-600 min-w-0 break-words">{t.values}</span>
                </div>
              ))}
            </div>
          )}
          {patient.investigations.normalSummary && (
            <div className="text-[11.5px] text-slate-600 italic mb-1 break-words">
              {patient.investigations.normalSummary}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] text-slate-700 mt-1 min-w-0">
            {patient.investigations.imaging && <div className="break-words"><strong>Imaging:</strong> {patient.investigations.imaging}</div>}
            {patient.investigations.ecg && <div className="break-words"><strong>ECG:</strong> {patient.investigations.ecg}</div>}
            {patient.investigations.echo && <div className="break-words"><strong>Echo:</strong> {patient.investigations.echo}</div>}
            {patient.investigations.vbg && <div><strong>VBG:</strong> {patient.investigations.vbg}</div>}
            {patient.investigations.cultures && <div><strong>Cultures:</strong> {patient.investigations.cultures}</div>}
            {patient.investigations.other && <div><strong>Other:</strong> {patient.investigations.other}</div>}
          </div>
        </div>
      )}

      {/* ── 10. ACTIVE MEDICATIONS ──────────────────────────────── */}
      {patient?.currentMedications && patient.currentMedications.length > 0 && (
        <div className="hov-section">
          <div className="hov-label">Current Active Medications</div>
          <div className="space-y-1 mt-1">
            {patient.currentMedications.map((med, idx) => (
              <div key={idx} className="med-item font-mono text-[11.5px]">
                <span className="text-emerald-700 font-bold">•</span> {med}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 11. ADJUNCTS / LINES / DEVICES (CURRENT SHIFT) ──────── */}
      {((patient?.adjunctsNow && Object.values(patient.adjunctsNow).some(Boolean)) ||
        (patient?.adjuncts && Object.values(patient.adjuncts).some(Boolean))) && (
        <div className="hov-section">
          <div className="hov-label">Adjuncts / Lines / Devices (Current)</div>
          <div className="flex flex-wrap gap-2 text-[11.5px] text-slate-800 mt-1">
            {((patient.adjunctsNow || patient.adjuncts)?.ivAccess) && (
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                <strong>IV:</strong> {(patient.adjunctsNow || patient.adjuncts)?.ivAccess}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.centralLine) && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-900 rounded border border-amber-200">
                <strong>Central Line:</strong> {(patient.adjunctsNow || patient.adjuncts)?.centralLine}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.arterialLine) && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-900 rounded border border-amber-200">
                <strong>Art Line:</strong> {(patient.adjunctsNow || patient.adjuncts)?.arterialLine}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.catheter) && (
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                <strong>Catheter:</strong> {(patient.adjunctsNow || patient.adjuncts)?.catheter}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.oxygenDelivery) && (
              <span className="px-2 py-0.5 bg-sky-50 text-sky-900 rounded border border-sky-200">
                <strong>O₂ / Airway:</strong> {(patient.adjunctsNow || patient.adjuncts)?.oxygenDelivery}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.drains) && (
              <span className="px-2 py-0.5 bg-rose-50 text-rose-900 rounded border border-rose-200">
                <strong>Drains:</strong> {(patient.adjunctsNow || patient.adjuncts)?.drains}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.ngt) && (
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                <strong>NGT:</strong> {(patient.adjunctsNow || patient.adjuncts)?.ngt}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.monitoring) && (
              <span className="px-2 py-0.5 bg-purple-50 text-purple-900 rounded border border-purple-200">
                <strong>Monitor:</strong> {(patient.adjunctsNow || patient.adjuncts)?.monitoring}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.drains) && (
              <span className="px-2 py-0.5 bg-rose-50 text-rose-900 rounded border border-rose-200">
                <strong>Drains:</strong> {(patient.adjunctsNow || patient.adjuncts)?.drains}
              </span>
            )}
            {((patient.adjunctsNow || patient.adjuncts)?.other) && (
              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                {(patient.adjunctsNow || patient.adjuncts)?.other}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── 12. MANAGEMENT PLAN ────────────────────────────────── */}
      <div className="hov-mgmt-label">Management Plan</div>
      <div className="hov-mgmt">
        {/* Done columns */}
        <div className="hov-done">
          <div className="hov-mgmt-header hov-done-header">
            Done ✓
          </div>
          <div className={`hov-cols hov-cols-${Math.min(3, Math.max(1, doneCols.length))}`}>
            {doneCols.map((col, ci) => (
              <div key={ci} className="hov-col">
                {col.map((item, ii) => (
                  <div key={ii} className="hov-done-item">
                    <span className="hov-tick">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* To Do columns */}
        <div className="hov-todo">
          <div className="hov-mgmt-header hov-todo-header">
            To Be Done □
          </div>
          <div className={`hov-cols hov-cols-${Math.min(3, Math.max(1, todoCols.length))}`}>
            {todoCols.map((col, ci) => (
              <div key={ci} className="hov-col">
                {col.map((item, ii) => (
                  <div key={ii} className="hov-todo-item">
                    <span className="hov-box">□</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 13. ER BOARDING & ADMISSION STATUS ─────────────────── */}
      {(isBoarder || patient?.erBoardingStatus?.reasonForERRetention) && (
        <div className="hov-section hov-boarding">
          <div className="hov-label hov-label-amber">
            ⚠ ER Boarding & Admission Status
          </div>
          {patient?.erBoardingStatus?.reasonForERRetention && (
            <div className="boarding-reason">
              Reason for ER retention: {patient.erBoardingStatus.reasonForERRetention}
            </div>
          )}
          {patient?.erBoardingStatus?.whoTrackingBed && (
            <div className="boarding-row">
              <span>Bed Tracking:</span> <strong>{patient.erBoardingStatus.whoTrackingBed}</strong>
            </div>
          )}
          {patient?.erBoardingStatus?.riskOfProlongedStay && (
            <div className="boarding-risk">
              Risk: {patient.erBoardingStatus.riskOfProlongedStay}
            </div>
          )}
        </div>
      )}

      {/* ── 14. BYSTANDER & VITALS ─────────────────────────────── */}
      <div className="hov-two-col">
        {patient?.vitalsNow && (
          <div className="hov-section">
            <div className="hov-label">Latest Vitals</div>
            <div className="hov-vitals">
              {patient.vitalsNow}
              {patient?.latestVitals?.trend && <span className="ml-1 font-bold text-amber-700">({patient.latestVitals.trend})</span>}
            </div>
          </div>
        )}
        {(patient?.bystanderConsent || patient?.bystander) && (
          <div className="hov-section hov-bystander">
            <div className="hov-label">Bystander / Consent</div>
            <div className="hov-value">{patient.bystanderConsent || patient.bystander}</div>
          </div>
        )}
      </div>

      {/* ── 15. ALERT ROW — always last ────────────────────────── */}
      {patient?.alertRow && (
        <div
          className="hov-alert-row"
          style={{ background: alertColor }}
        >
          {patient.alertRow}
        </div>
      )}
    </div>
  );
}
