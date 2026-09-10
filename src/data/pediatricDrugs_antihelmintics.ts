import { PediatricDrug } from "./pediatricDrugs_types";

export const ANTIHELMINTICS_DRUGS: PediatricDrug[] = [
  {
    id: "albendazole",
    name: "Albendazole",
    category: "Anti-Helmintics",
    standardDose: "<2yrs: 200 mg single dose, >2yrs: 400 mg single dose",
    route: "PO",
    frequency: "Single dose (repeat per indication)",
    source: "Harriet Lane / Nelson's / BNF-C — AI-drafted, pending specialist verification",
    indications: ["Soil-transmitted helminths (roundworm, hookworm, whipworm)", "Giardiasis (adjunct)"],
    calculateDose: (w: number) => {
      return {
        doseValue: "200-400 mg",
        unit: "mg",
        breakdown: "Under 2 years: 200 mg PO once.\nOver 2 years: 400 mg PO once.\n(Neurocysticercosis/other indications use weight-based 15 mg/kg/day divided BD for longer courses — specialist-guided, not covered by this single-dose entry.)",
        notes: "Not weight-based for standard single-dose deworming — dosing is age-banded, not per-kg. Avoid in known/suspected pregnancy."
      };
    }
  },
  {
    id: "mebendazole",
    name: "Mebendazole",
    category: "Anti-Helmintics",
    standardDose: "100 mg BD x 3 days, or 500 mg single dose",
    route: "PO",
    frequency: "12hly x 3 days, or single dose",
    source: "Harriet Lane / Nelson's / BNF-C — AI-drafted, pending specialist verification",
    indications: ["Pinworm (enterobiasis)", "Roundworm", "Whipworm", "Hookworm"],
    calculateDose: (w: number) => {
      return {
        doseValue: "100 mg BD x 3 days (or 500 mg once)",
        unit: "mg",
        breakdown: "Standard course: 100 mg PO BD for 3 consecutive days.\nAlternative single-dose regimen (mass deworming programs): 500 mg PO once.\nPinworm: may repeat course after 2 weeks to cover re-infection.",
        notes: "Not weight-based — fixed dosing regardless of weight. Avoid in children under 2 years unless specifically indicated."
      };
    }
  },
  {
    id: "diethylcarbamazine",
    name: "Diethylcarbamazine (DEC)",
    category: "Anti-Helmintics",
    standardDose: "6 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly, course length per indication",
    source: "Harriet Lane / Nelson's / BNF-C — AI-drafted, pending specialist verification",
    indications: ["Lymphatic filariasis", "Tropical pulmonary eosinophilia", "Loiasis"],
    calculateDose: (w: number) => {
      const daily = w * 6;
      const dose = daily / 3;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Total daily dose (6 mg/kg/day): ${daily.toFixed(1)} mg/day\nSingle dose (8hly): ${dose.toFixed(1)} mg PO Q8H`,
        notes: "Course duration and dose escalation schedule vary significantly by indication and program protocol (e.g. national filariasis elimination programs use single annual co-administered doses) — confirm against the specific protocol being followed, not just this per-kg figure."
      };
    }
  }
];
