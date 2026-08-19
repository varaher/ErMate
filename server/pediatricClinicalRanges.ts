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
  };
}
export function getAgeBand(ageMonths: number): AgeBand | null {
  if (ageMonths <= 1) return { label: "Neonate (0-1 month)", ranges: { hr: { low: 100, high: 205 }, rr: { low: 30, high: 60 }, sbp: { low: 60, high: 76 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 } } };
  if (ageMonths <= 12) return { label: "Infant (1-12 months)", ranges: { hr: { low: 100, high: 190 }, rr: { low: 30, high: 53 }, sbp: { low: 72, high: 104 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 } } };
  if (ageMonths <= 36) return { label: "Toddler (1-3 years)", ranges: { hr: { low: 98, high: 140 }, rr: { low: 22, high: 37 }, sbp: { low: 86, high: 106 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 } } };
  if (ageMonths <= 72) return { label: "Preschool (3-6 years)", ranges: { hr: { low: 80, high: 120 }, rr: { low: 20, high: 28 }, sbp: { low: 89, high: 112 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 } } };
  if (ageMonths <= 144) return { label: "School age (6-12 years)", ranges: { hr: { low: 75, high: 118 }, rr: { low: 18, high: 25 }, sbp: { low: 97, high: 120 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 } } };
  return { label: "Adolescent (12-18 years)", ranges: { hr: { low: 60, high: 100 }, rr: { low: 12, high: 20 }, sbp: { low: 110, high: 131 }, spo2: { low: 95, high: 100 }, temp: { low: 36.5, high: 37.5 } } };
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
