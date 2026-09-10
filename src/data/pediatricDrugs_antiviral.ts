import { PediatricDrug } from "./pediatricDrugs_types";

export const ANTIVIRAL_DRUGS: PediatricDrug[] = [
  {
    id: "acyclovir",
    name: "Acyclovir",
    category: "Anti-Viral",
    standardDose: "Mucocutaneous HSV: 20 mg/kg/dose 8hly, HSV encephalitis: 20 mg/kg/dose 8hly IV",
    route: "PO / IV",
    frequency: "8hly",
    source: "Harriet Lane / Nelson's / BNF-C — AI-drafted, pending specialist verification",
    indications: ["Herpes simplex infection", "Varicella (immunocompromised/severe)", "HSV encephalitis"],
    calculateDose: (w: number) => {
      const dose = w * 20;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard dose (20 mg/kg/dose Q8H): ${dose.toFixed(1)} mg PO/IV Q8H\n(HSV encephalitis and neonatal HSV typically require the higher end of dosing and longer courses — confirm duration against specific protocol)`,
        notes: "Ensure adequate hydration during IV therapy — risk of crystalline nephropathy if infused too rapidly or in a dehydrated patient. Infuse IV over at least 1 hour."
      };
    }
  }
];
