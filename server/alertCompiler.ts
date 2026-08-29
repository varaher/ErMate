/**
 * alertCompiler.ts
 *
 * Deterministic, rule-based single-line alert summary compiler for
 * handover cards. NEVER routed through an AI model — every value here
 * is checked against clinicalRanges.ts thresholds or explicit
 * pending/flagged status, so the banner stays reliable even during
 * Claude/GPT/Gemini fallback cascades.
 *
 * OUTPUT CONTRACT: compileAlerts() always returns either:
 *   - null (nothing to flag), or
 *   - a SINGLE line, " | "-delimited, no newlines, covering both
 *     abnormal values AND pending-critical action items together.
 * Callers must never re-wrap this into a multi-line summary.
 */

import { isAbnormal, isCulturePositive } from "./clinicalRanges";

export interface HandoverOutput {
  patientHeader?: {
    name?: string | null;
    age?: number | null;
    sex?: "M" | "F" | "O" | null;
    bed?: string | null;
    dayOfStay?: number;
  };
  alerts?: string | null;
  presentingComplaint?: string;
  criticalAllergies?: string | null;
  initialPresentation?: {
    vitals?: {
      bp?: string | null;
      hr?: number | null;
      rr?: number | null;
      spo2?: number | null;
      temp?: number | null;
      grbs?: number | null;
    };
    vbgAbg?: {
      type?: "VBG" | "ABG" | null;
      ph?: number | null;
      pco2?: number | null;
      hco3?: number | null;
      lactate?: number | null;
      na?: number | null;
      k?: number | null;
    };
    troponinPOC?: string | null;
    ecg?: string;
    bedsideEcho?: string;
  };
  pastHistory?: string[];
  provisionalDiagnosis?: string;
  managementPlan?: {
    done?: string[];
    toDo?: string[];
    pending?: string[];
  };
  crossConsultations?: {
    time?: string;
    specialty?: string;
    department?: string;
    reason?: string | null;
    consultant?: string | null;
    recommendation?: string | null;
    status?: string | null;
    flagged?: boolean;
  }[] | null;
  pendingCritical?: string[] | null;
  labs?: {
    panel?: string;
    values?: {
      name?: string;
      value?: string | number;
      isAbnormal?: boolean;
    }[];
  }[];
  latestVitals?: {
    timestamp?: string;
    bp?: string | null;
    hr?: number | null;
    rr?: number | null;
    spo2?: number | null;
    temp?: number | null;
    grbs?: number | null;
    gcs?: number | string | null;
  };
}

// ── Helpers ──────────────────────────────────────────────────

function parseBP(bp: string | null | undefined): { sbp: number | null; dbp: number | null } {
  if (!bp) return { sbp: null, dbp: null };
  const match = bp.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return { sbp: null, dbp: null };
  return { sbp: parseInt(match[1], 10), dbp: parseInt(match[2], 10) };
}

function parseGCS(gcs: number | string | null | undefined): number | null {
  if (gcs === null || gcs === undefined) return null;
  if (typeof gcs === "number") return gcs;
  const match = String(gcs).match(/(\d{1,2})\s*\/\s*15/) || String(gcs).match(/\b(\d{1,2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parses a free-text VBG/ABG string as produced by the handover
 * extraction prompt (e.g. "pH 7.2 · pCO2 58.6 · Lac 6.7 · Na 136 · K 4.6")
 * into individual numeric values. This exists because the AI schema
 * for adjunctsAtArrival.vbg is a formatted STRING, not an object —
 * calling code must never assume .ph/.lactate/.k exist directly on it.
 */
export function parseVBGString(vbgStr: string | null | undefined): {
  ph?: number; pco2?: number; hco3?: number; lactate?: number; na?: number; k?: number;
} {
  if (!vbgStr || typeof vbgStr !== "string") return {};
  const extract = (regex: RegExp): number | undefined => {
    const m = vbgStr.match(regex);
    return m ? parseFloat(m[1]) : undefined;
  };
  return {
    ph: extract(/pH\s*[:=]?\s*([\d.]+)/i),
    pco2: extract(/p?CO2\s*[:=]?\s*([\d.]+)/i),
    hco3: extract(/HCO3?\s*[:=]?\s*([\d.]+)/i),
    lactate: extract(/(?:Lac(?:tate)?)\s*[:=]?\s*([\d.]+)/i),
    na: extract(/Na\+?\s*[:=]?\s*([\d.]+)/i),
    k: extract(/K\+?\s*[:=]?\s*([\d.]+)/i),
  };
}

const CRITICAL_PENDING_KEYWORDS = [
  "pac", "icu", "micu", "sicu", "biopsy", "transfusion", "blood product",
  "urology", "cardiology", "neurology", "surgery", "surgical",
  "not reviewed", "not actioned", "awaiting", "referred", "escalat",
  "critical", "stat", "urgent", "review pending", "pending since",
  "transfer", "consult pending", "or vacancy", "cath lab", "dialysis"
];

function isPendingItemCritical(item: string): boolean {
  if (!item) return false;
  const lower = item.toLowerCase();
  return CRITICAL_PENDING_KEYWORDS.some(k => lower.includes(k));
}

function truncate(str: string, maxLen: number): string {
  if (!str) return str;
  return str.length > maxLen ? str.slice(0, maxLen - 1).trim() + "…" : str;
}

// ── Main compiler ────────────────────────────────────────────

export function compileAlerts(data: HandoverOutput): string | null {
  const alerts: string[] = [];

  // 1. Allergies
  const allergy = data.criticalAllergies;
  if (allergy && allergy.trim() &&
      !/nkda|no known/i.test(allergy)) {
    alerts.push(`Allergy: ${allergy}`);
  }

  // 2. Abnormal lab panel values / positive cultures
  if (Array.isArray(data.labs)) {
    data.labs.forEach(panel => {
      if (Array.isArray(panel.values)) {
        panel.values.forEach(v => {
          if (v.name && v.value !== undefined && v.value !== null) {
            const strVal = String(v.value);
            if (v.isAbnormal || isCulturePositive(strVal)) {
              alerts.push(`${v.name}: ${v.value}`);
            }
          }
        });
      }
    });
  }

  // 3. VBG/ABG critical values (handles both object and raw-string schema)
  const vbgAbg = data.initialPresentation?.vbgAbg;
  const vbgParsed = vbgAbg && typeof vbgAbg === "object"
    ? vbgAbg
    : parseVBGString(vbgAbg as unknown as string);
  if (vbgParsed) {
    const { ph, pco2, hco3, lactate, na, k } = vbgParsed;
    if (ph !== undefined && ph !== null && isAbnormal("ph", ph)) alerts.push(`pH ${ph}`);
    if (lactate !== undefined && lactate !== null && isAbnormal("lactate", lactate)) alerts.push(`Lactate ${lactate}`);
    if (k !== undefined && k !== null && isAbnormal("k", k)) alerts.push(`K+ ${k}`);
    if (na !== undefined && na !== null && isAbnormal("na", na)) alerts.push(`Na+ ${na}`);
    if (pco2 !== undefined && pco2 !== null && isAbnormal("pco2", pco2)) alerts.push(`pCO2 ${pco2}`);
    if (hco3 !== undefined && hco3 !== null && isAbnormal("hco3", hco3)) alerts.push(`HCO3 ${hco3}`);
  }

  // 4. Point-of-care troponin
  const troponin = data.initialPresentation?.troponinPOC;
  if (troponin && /positive/i.test(troponin)) {
    alerts.push("Troponin POC: Positive");
  }

  // 5. Latest vitals — the current/active reading, not arrival vitals
  const lv = data.latestVitals;
  if (lv) {
    if (lv.spo2 !== undefined && lv.spo2 !== null && isAbnormal("spo2", lv.spo2)) {
      alerts.push(`SpO2 ${lv.spo2}%`);
    }
    if (lv.hr !== undefined && lv.hr !== null && isAbnormal("hr", lv.hr)) {
      alerts.push(`HR ${lv.hr}`);
    }
    if (lv.rr !== undefined && lv.rr !== null && isAbnormal("rr", lv.rr)) {
      alerts.push(`RR ${lv.rr}`);
    }
    if (lv.temp !== undefined && lv.temp !== null && isAbnormal("temp", lv.temp)) {
      alerts.push(`Temp ${lv.temp}°C`);
    }
    if (lv.grbs !== undefined && lv.grbs !== null && isAbnormal("grbs", lv.grbs)) {
      alerts.push(`GRBS ${lv.grbs}`);
    }
    if (lv.bp) {
      const { sbp, dbp } = parseBP(lv.bp);
      if (sbp !== null && isAbnormal("sbp", sbp)) alerts.push(`SBP ${sbp}`);
      if (dbp !== null && isAbnormal("dbp", dbp)) alerts.push(`DBP ${dbp}`);
    }
    const gcsNum = parseGCS(lv.gcs);
    if (gcsNum !== null && isAbnormal("gcs", gcsNum)) {
      alerts.push(`GCS ${gcsNum}/15`);
    }
  }

  // 6. Pending / not-yet-actioned critical items (management plan)
  const pendingItems: string[] = [
    ...(data.managementPlan?.toDo || []),
    ...(data.managementPlan?.pending || []),
    ...(data.pendingCritical || []),
  ];
  pendingItems.forEach(item => {
    if (item && isPendingItemCritical(item)) {
      alerts.push(truncate(item.trim(), 40));
    }
  });

  // 7. Cross-consultations awaiting action
  if (Array.isArray(data.crossConsultations)) {
    data.crossConsultations.forEach(c => {
      const status = (c.status || "").toLowerCase();
      const isPending = c.flagged === true ||
        status.includes("awaiting") ||
        status.includes("not actioned");
      if (isPending) {
        const label = c.department || c.specialty || c.consultant || "Consult";
        alerts.push(`${label} review pending`);
      }
    });
  }

  // Deduplicate, keep it a single line
  const uniqueAlerts = Array.from(new Set(alerts.filter(Boolean)));
  return uniqueAlerts.length > 0 ? uniqueAlerts.join(" | ") : null;
}