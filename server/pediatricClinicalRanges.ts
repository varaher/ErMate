export interface PediatricVitalParam {
  low: number;
  high: number;
}
export interface AgeBand {
  label: string;
  ranges: {
    hr: PediatricVitalParam;
    rr: PediatricVitalParam;
    sbp: PediatricVitalParam;
    spo2: PediatricVitalParam;
    temp: PediatricVitalParam;
    ph: PediatricVitalParam;
    pco2: PediatricVitalParam;
    hco3: PediatricVitalParam;
    lactate: PediatricVitalParam;
    na: PediatricVitalParam;
    k: PediatricVitalParam;
    cl: PediatricVitalParam;
  };
}

export function getAgeBand(ageMonths: number): AgeBand | null {
  if (ageMonths <= 1) return { label: "Neonate (0-1 month)", ranges: {
    hr: { low: 100, high: 205 }, rr: { low: 30, high: 60 }, sbp: { low: 60, high: 76 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 },
    ph: { low: 7.35, high: 7.45 }, pco2: { low: 30, high: 40 }, hco3: { low: 19, high: 24 }, lactate: { low: 0, high: 2.5 }, na: { low: 133, high: 146 }, k: { low: 3.7, high: 6.0 }, cl: { low: 96, high: 110 }
  } };
  if (ageMonths <= 12) return { label: "Infant (1-12 months)", ranges: {
    hr: { low: 100, high: 190 }, rr: { low: 30, high: 53 }, sbp: { low: 72, high: 104 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 },
    ph: { low: 7.35, high: 7.45 }, pco2: { low: 32, high: 42 }, hco3: { low: 20, high: 24 }, lactate: { low: 0, high: 2.0 }, na: { low: 134, high: 144 }, k: { low: 3.5, high: 5.5 }, cl: { low: 96, high: 110 }
  } };
  if (ageMonths <= 36) return { label: "Toddler (1-3 years)", ranges: {
    hr: { low: 98, high: 140 }, rr: { low: 22, high: 37 }, sbp: { low: 86, high: 106 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 },
    ph: { low: 7.35, high: 7.45 }, pco2: { low: 35, high: 45 }, hco3: { low: 21, high: 25 }, lactate: { low: 0, high: 2.0 }, na: { low: 135, high: 145 }, k: { low: 3.5, high: 5.0 }, cl: { low: 98, high: 110 }
  } };
  if (ageMonths <= 72) return { label: "Preschool (3-6 years)", ranges: {
    hr: { low: 80, high: 120 }, rr: { low: 20, high: 28 }, sbp: { low: 89, high: 112 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 },
    ph: { low: 7.35, high: 7.45 }, pco2: { low: 35, high: 45 }, hco3: { low: 22, high: 26 }, lactate: { low: 0, high: 2.0 }, na: { low: 135, high: 145 }, k: { low: 3.5, high: 5.0 }, cl: { low: 98, high: 110 }
  } };
  if (ageMonths <= 144) return { label: "School age (6-12 years)", ranges: {
    hr: { low: 75, high: 118 }, rr: { low: 18, high: 25 }, sbp: { low: 97, high: 120 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 },
    ph: { low: 7.35, high: 7.45 }, pco2: { low: 35, high: 45 }, hco3: { low: 22, high: 26 }, lactate: { low: 0, high: 2.0 }, na: { low: 135, high: 145 }, k: { low: 3.5, high: 5.0 }, cl: { low: 98, high: 110 }
  } };
  return { label: "Adolescent (12-18 years)", ranges: {
    hr: { low: 60, high: 100 }, rr: { low: 12, high: 20 }, sbp: { low: 110, high: 131 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 },
    ph: { low: 7.35, high: 7.45 }, pco2: { low: 35, high: 45 }, hco3: { low: 22, high: 26 }, lactate: { low: 0, high: 2.0 }, na: { low: 135, high: 145 }, k: { low: 3.5, high: 5.0 }, cl: { low: 98, high: 110 }
  } };
}

export function ageToMonths(ageYears: number | null, ageMonthsParam: number = 0): number {
  if (ageYears === null || ageYears === undefined) return 120 + ageMonthsParam; // Default 10 years
  return (ageYears * 12) + ageMonthsParam;
}

export function formatFlaggedForAge(param: keyof AgeBand['ranges'], value: any, ageMonths: number): string {
  if (value === null || value === undefined || value === "") return "N/A";
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return String(value);

  const band = getAgeBand(ageMonths);
  if (!band) return String(value);

  const range = band.ranges[param];
  if (!range) return String(value);

  if (num < range.low) return `${value} ⬇`;
  if (num > range.high) return `${value} ⬆`;
  return String(value);
}