// ============================================================
// ErMate — Handover Card React Component
// File: src/components/HandoverCard.tsx
// ============================================================

import React from 'react';
import '../styles/handover.css';

export interface HandoverPatient {
  patientLabel: {
    name: string;
    ageSex: string;
    bed: string | null;
    erNumber: string | null;
    admittingConsultant: string | null;
    inERSince: string | null;
    status: 'critical' | 'unstable' | 'stable' | 'discharge';
  };
  presentingComplaint: string;
  story: string;
  pmh: string | null;
  diagnosis: string;
  done: string[];
  toBeDone: string[];
  vitalsNow: string | null;
  criticalAlerts: string[];
  bystander: string | null;
  alertRow: string;
}

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

export function HandoverCard({ patient }: { patient: HandoverPatient }) {
  const statusKey = (patient?.patientLabel?.status as keyof typeof STATUS_COLORS) || 'unstable';
  const colors = STATUS_COLORS[statusKey] || STATUS_COLORS.unstable;
  const severity = getAlertSeverity(patient?.alertRow || '');
  const alertColor = ALERT_COLORS[severity];

  const doneCols = splitColumns(patient?.done || []);
  const todoCols = splitColumns(patient?.toBeDone || []);

  return (
    <div
      className="hov-card"
      style={{ borderColor: colors.border }}
    >
      {/* ── Header ────────────────────────────────────── */}
      <div
        className="hov-header"
        style={{ background: colors.bg }}
      >
        <div
          className="hov-status-bar"
          style={{ background: colors.border }}
        />
        <div className="hov-header-content">
          <div className="hov-bed-name">
            {patient?.patientLabel?.bed && (
              <span className="hov-bed">
                Bed {patient.patientLabel.bed}
              </span>
            )}
            <span className="hov-name">
              {patient?.patientLabel?.name || 'Bed Patient'}
            </span>
            {patient?.patientLabel?.ageSex && (
              <span className="hov-agesex">
                {patient.patientLabel.ageSex}
              </span>
            )}
          </div>
          <div className="hov-meta">
            {patient?.patientLabel?.admittingConsultant}
            {patient?.patientLabel?.inERSince &&
              ` · In ER: ${patient.patientLabel.inERSince}`
            }
          </div>
        </div>
        <div
          className="hov-chip"
          style={{ background: colors.chip }}
        >
          {(patient?.patientLabel?.status || 'UNSTABLE').toUpperCase()}
        </div>
      </div>

      {/* ── Presenting Complaint ───────────────────────── */}
      {patient?.presentingComplaint && (
        <div className="hov-section">
          <div className="hov-label">Presenting Complaint</div>
          <div className="hov-value">
            {patient.presentingComplaint}
          </div>
        </div>
      )}

      {/* ── Story ──────────────────────────────────────── */}
      {patient?.story && (
        <div className="hov-section hov-story">
          <div className="hov-label">Clinical Story</div>
          <div className="hov-story-text">
            {patient.story}
          </div>
        </div>
      )}

      {/* ── Critical + Vitals row ──────────────────────── */}
      {((patient?.criticalAlerts && patient.criticalAlerts.length > 0) || patient?.vitalsNow) && (
        <div className="hov-two-col">
          {patient?.criticalAlerts && patient.criticalAlerts.length > 0 && (
            <div className="hov-section hov-critical">
              <div className="hov-label" style={{ color: '#DC2626' }}>
                ⚠ Critical
              </div>
              {patient.criticalAlerts.map((alert, i) => (
                <div key={i} className="hov-alert-item">
                  {alert}
                </div>
              ))}
            </div>
          )}
          {patient?.vitalsNow && (
            <div className="hov-section">
              <div className="hov-label">Vitals Now</div>
              <div className="hov-vitals">
                {patient.vitalsNow}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PMH ────────────────────────────────────────── */}
      {patient?.pmh && (
        <div className="hov-section">
          <div className="hov-label">Past Medical History</div>
          <div className="hov-value hov-pmh">
            {patient.pmh}
          </div>
        </div>
      )}

      {/* ── Diagnosis ──────────────────────────────────── */}
      {patient?.diagnosis && (
        <div
          className="hov-section hov-dx"
          style={{
            background: colors.bg,
            borderLeft: `3px solid ${colors.border}`,
          }}
        >
          <div className="hov-label" style={{ color: colors.border }}>
            Provisional Diagnosis
          </div>
          <div className="hov-dx-text">
            {patient.diagnosis}
          </div>
        </div>
      )}

      {/* ── Management Plan ────────────────────────────── */}
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

      {/* ── Bystander ──────────────────────────────────── */}
      {patient?.bystander && (
        <div className="hov-section hov-bystander">
          <div className="hov-label">Bystander / Family</div>
          <div className="hov-value">{patient.bystander}</div>
        </div>
      )}

      {/* ── ALERT ROW — always last ────────────────────── */}
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
