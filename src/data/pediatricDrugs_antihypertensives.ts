import { PediatricDrug } from "./pediatricDrugs_types";

export const ANTIHYPERTENSIVES_DRUGS: PediatricDrug[] = [
  {
    id: "atenolol",
    name: "Atenolol",
    category: "Anti-Hypertensives",
    standardDose: "0.5-1 mg/kg/day, max 2 mg/kg/day",
    route: "PO",
    frequency: "Daily (OD) or 12hly",
    maxDose: "Max: 2 mg/kg/day",
    source: "Harriet Lane / Nelson's / BNF-C — AI-drafted, pending specialist verification",
    indications: ["Hypertension", "Arrhythmia (rate control)"],
    calculateDose: (w: number) => {
      const minDose = w * 0.5;
      const maxDose = w * 1;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard dose range (0.5-1 mg/kg/day): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO once daily (or divided BD)`,
        notes: "Avoid abrupt discontinuation (rebound hypertension/tachycardia). Caution in asthma/reactive airway disease — beta-1 selective but selectivity is dose-dependent."
      };
    }
  },
  {
    id: "nifedipine",
    name: "Nifedipine",
    category: "Anti-Hypertensives",
    standardDose: "0.25-0.5 mg/kg/dose",
    route: "PO / SL",
    frequency: "Q4-6H PRN for acute severe hypertension",
    source: "Harriet Lane / Nelson's / BNF-C — AI-drafted, pending specialist verification",
    indications: ["Acute severe hypertension", "Hypertensive urgency"],
    calculateDose: (w: number) => {
      const minDose = w * 0.25;
      const maxDose = w * 0.5;
      return {
        doseValue: `${minDose.toFixed(2)}-${maxDose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Standard dose range (0.25-0.5 mg/kg/dose): ${minDose.toFixed(2)} to ${maxDose.toFixed(2)} mg PO/SL, may repeat Q4-6H PRN`,
        notes: "CAUTION: Immediate-release nifedipine can cause unpredictable, precipitous BP drops — many pediatric protocols now avoid it in favor of controlled IV agents for true hypertensive emergency. Confirm against current hospital protocol before use."
      };
    }
  },
  {
    id: "propranolol",
    name: "Propranolol",
    category: "Anti-Hypertensives",
    standardDose: "1-4 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    maxDose: "Max: 60 mg/day (varies by indication)",
    source: "Harriet Lane / Nelson's / BNF-C — AI-drafted, pending specialist verification",
    indications: ["Hypertension", "Infantile hemangioma", "Tetralogy of Fallot spell prophylaxis", "Thyrotoxicosis"],
    calculateDose: (w: number) => {
      const minDaily = w * 1;
      const maxDaily = w * 4;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range (1-4 mg/kg/day divided 8hly): ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H`,
        notes: "Infantile hemangioma dosing follows a specific titration protocol (start low, monitor HR/glucose/BP, titrate over days) — this is materially different from the hypertension dosing shown here. Confirm indication before using this figure. Contraindicated in reactive airway disease/asthma and heart block."
      };
    }
  }
];
