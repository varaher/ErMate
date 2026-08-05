import { isAbnormal, isCulturePositive, ClinicalParam } from "./clinicalRanges";

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
    ecg?: string;
    bedsideEcho?: string;
  };
  pastHistory?: string[];
  provisionalDiagnosis?: string;
  managementPlan?: {
    done?: string[];
    toDo?: string[];
  };
  crossConsultations?: {
    time?: string;
    specialty?: string;
    reason?: string | null;
    consultant?: string | null;
    recommendation?: string | null;
    status?: string | null;
  }[] | null;
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
  };
}

export function compileAlerts(data: HandoverOutput): string | null {
  const alerts: string[] = [];

  // Critical culture/microbiology flags & abnormal lab panel values
  if (data.labs && Array.isArray(data.labs)) {
    data.labs.forEach(panel => {
      if (panel.values && Array.isArray(panel.values)) {
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

  // VBG/ABG critical values from initialPresentation or labs
  if (data.initialPresentation?.vbgAbg) {
    const { ph, pco2, hco3, lactate, na, k } = data.initialPresentation.vbgAbg;
    if (ph !== undefined && ph !== null && isAbnormal("ph", ph)) alerts.push(`pH ${ph}`);
    if (lactate !== undefined && lactate !== null && isAbnormal("lactate", lactate)) alerts.push(`Lactate ${lactate}`);
    if (k !== undefined && k !== null && isAbnormal("k", k)) alerts.push(`K+ ${k}`);
    if (na !== undefined && na !== null && isAbnormal("na", na)) alerts.push(`Na+ ${na}`);
    if (pco2 !== undefined && pco2 !== null && isAbnormal("pco2", pco2)) alerts.push(`pCO2 ${pco2}`);
    if (hco3 !== undefined && hco3 !== null && isAbnormal("hco3", hco3)) alerts.push(`HCO3 ${hco3}`);
  }

  // Vitals-based flags (latest vitals)
  if (data.latestVitals) {
    const lv = data.latestVitals;
    if (lv.spo2 !== undefined && lv.spo2 !== null && isAbnormal("spo2", lv.spo2)) {
      alerts.push(`SpO2 ${lv.spo2}%`);
    }
    if (lv.hr !== undefined && lv.hr !== null && isAbnormal("hr", lv.hr)) {
      alerts.push(`HR ${lv.hr}`);
    }
    if (lv.rr !== undefined && lv.rr !== null && isAbnormal("rr", lv.rr)) {
      alerts.push(`RR ${lv.rr}`);
    }
  }

  // Deduplicate and filter empty
  const uniqueAlerts = Array.from(new Set(alerts.filter(Boolean)));
  return uniqueAlerts.length > 0 ? uniqueAlerts.join(" | ") : null;
}
