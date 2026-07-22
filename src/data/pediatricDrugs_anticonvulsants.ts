import { PediatricDrug } from "./pediatricDrugs_types";

export const ANTICONVULSANTS_DRUGS: PediatricDrug[] = [
  // Anti-Convulsants
  {
    id: "acth",
    name: "ACTH (Corticotropin)",
    category: "Anti-Convulsants",
    standardDose: "20-40 IU daily",
    route: "IM / IV",
    frequency: "Daily",
    source: "User Sheet",
    indications: ["Infantile Spasms (West Syndrome)"],
    calculateDose: (w: number) => {
      return {
        doseValue: "20-40 IU",
        unit: "IU",
        breakdown: "Standard Dose: 20 to 40 IU IM/IV once daily (often tapered over several weeks)",
        notes: "Monitor blood pressure, blood glucose, electrolytes, and watch for cushingoid side effects."
      };
    }
  },
  {
    id: "carbamazepine",
    name: "Carbamazepine",
    category: "Anti-Convulsants",
    standardDose: "10-30 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Focal seizures", "Generalized tonic-clonic seizures", "Trigeminal neuralgia"],
    calculateDose: (w: number) => {
      const minDaily = w * 10;
      const maxDaily = w * 30;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H`,
        notes: "Initiate at low dose and taper up slowly. Avoid in absence seizures (can exacerbate them)."
      };
    }
  },
  {
    id: "clobazam",
    name: "Clobazam",
    genericName: "Frisium",
    category: "Anti-Convulsants",
    standardDose: "0.3-1 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Lennox-Gastaut syndrome", "Refractory focal/generalized seizures", "Febrile seizure prophylaxis"],
    calculateDose: (w: number) => {
      const minDaily = w * 0.3;
      const maxDaily = w * 1.0;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(2)}-${maxDose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(2)} to ${maxDose.toFixed(2)} mg PO BD\nSeizure Prophylaxis dose: 1 mg/kg/day divided BD`,
        notes: "Benzodiazepine. Risk of tolerance and sedation. Do not discontinue abruptly."
      };
    }
  },
  {
    id: "clonazepam",
    name: "Clonazepam",
    category: "Anti-Convulsants",
    standardDose: "0.01-0.03 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Myoclonic seizures", "Akinetic/atonic seizures", "Absence seizures"],
    calculateDose: (w: number) => {
      const minDaily = w * 0.01;
      const maxDaily = w * 0.03;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(3)}-${maxDose.toFixed(3)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${minDaily.toFixed(3)} to ${maxDaily.toFixed(3)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(3)} to ${maxDose.toFixed(3)} mg PO BD`,
        notes: "Can cause significant salivation, bronchial hypersecretion, and sedation."
      };
    }
  },
  {
    id: "diazepam",
    name: "Diazepam",
    genericName: "Valium",
    category: "Anti-Convulsants",
    standardDose: "PO: 0.1-0.3 mg/kg/day 8hly, Neonatal Tetanus: 0.5-5 mg/kg IV 2hrly",
    route: "PO / IV / PR",
    frequency: "8hly (Oral) or 2hrly (Tetanus)",
    source: "User Sheet / PALS",
    indications: ["Status epilepticus", "Neonatal tetanus muscle spasms", "Anxiety / Muscle spasm"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 0.1;
      const poDailyMax = w * 0.3;
      const poDoseMin = poDailyMin / 3;
      const poDoseMax = poDailyMax / 3;
      const tetMin = w * 0.5;
      const tetMax = w * 5.0;
      const prDose = Math.min(10, w * 0.5);
      return {
        doseValue: `PO: ${poDoseMin.toFixed(2)}-${poDoseMax.toFixed(2)} mg, Tet IV: ${tetMin.toFixed(1)}-${tetMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (0.1-0.3 mg/kg/day divided 8hly): ${poDoseMin.toFixed(2)} to ${poDoseMax.toFixed(2)} mg PO Q8H\nNeonatal Tetanus Dose (0.5-5.0 mg/kg IV 2hrly): ${tetMin.toFixed(1)} to ${tetMax.toFixed(1)} mg IV Q2H\nEmergency Status Rectal Gel (PR 0.5 mg/kg): ${prDose.toFixed(1)} mg PR Stat`,
        notes: "Monitor respiration and blood pressure. Administer slow IV push over 2-3 minutes. High risk of apnea with rapid IV."
      };
    }
  },
  {
    id: "nootropil-piracetam",
    name: "Nootropil (Piracetam)",
    category: "Anti-Convulsants",
    standardDose: "40-100 mg/kg/day divided 12hly",
    route: "PO / IV",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Myoclonus of cortical origin", "Cognitive enhancer", "Breath-holding spells adjuvant"],
    calculateDose: (w: number) => {
      const minDaily = w * 40;
      const maxDaily = w * 100;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO/IV BD`,
        notes: "Contraindicated in renal impairment. May cause hyperkinesia or weight gain."
      };
    }
  },
  {
    id: "ethosuximide",
    name: "Ethosuximide",
    category: "Anti-Convulsants",
    standardDose: "20-40 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly",
    source: "User Sheet",
    indications: ["Childhood absence epilepsy (first-line)"],
    calculateDose: (w: number) => {
      const minDaily = w * 20;
      const maxDaily = w * 40;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO BD`,
        notes: "Monitor CBC for rare risk of blood dyscrasias. Take with food to reduce gastric irritation."
      };
    }
  },
  {
    id: "oxcarbazepine",
    name: "Oxcarbazepine",
    category: "Anti-Convulsants",
    standardDose: "Initial: 8-10 mg/kg/day divided BD, Max: 40 mg/kg/day",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Focal seizures (monotherapy or adjunctive)"],
    calculateDose: (w: number) => {
      const initDaily = w * 8;
      const initDose = initDaily / 2;
      const maxDaily = w * 40;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `Init: ${initDose.toFixed(1)} mg BD, Max: ${maxDose.toFixed(1)} mg BD`,
        unit: "mg",
        breakdown: `Initial Dose (8-10 mg/kg/day divided BD): ${initDose.toFixed(1)} mg PO BD\nMaximum Dose (40 mg/kg/day divided BD): ${maxDose.toFixed(1)} mg PO BD`,
        notes: "Monitor serum sodium for hyponatremia. Taper up gradually from initial dose over 2-4 weeks."
      };
    }
  },
  {
    id: "phenobarbital",
    name: "Phenobarbital (Phenobarbitone)",
    category: "Anti-Convulsants",
    standardDose: "Loading: 15-20 mg/kg IV, Maintenance: 3-5 mg/kg/day divided 12hly",
    route: "IV / PO",
    frequency: "Stat (Loading), then Q12H (Maintenance)",
    source: "User Sheet / Harriet Lane",
    indications: ["Neonatal seizures", "Status epilepticus", "Maintenance seizure control"],
    calculateDose: (w: number) => {
      const load = w * 20;
      const maintDailyMin = w * 3;
      const maintDailyMax = w * 5;
      const maintDoseMin = maintDailyMin / 2;
      const maintDoseMax = maintDailyMax / 2;
      return {
        doseValue: `Load: ${load.toFixed(0)} mg IV, Maint: ${maintDoseMin.toFixed(1)}-${maintDoseMax.toFixed(1)} mg BD`,
        unit: "mg",
        breakdown: `Loading Dose (15-20 mg/kg): ${load.toFixed(1)} mg IV infused over 20 minutes\nMaintenance Dose (3-5 mg/kg/day divided 12hly): ${maintDoseMin.toFixed(1)} to ${maintDoseMax.toFixed(1)} mg PO/IV BD`,
        notes: "Can cause severe respiratory depression. Monitor EKG, breathing, blood pressure, and serum levels."
      };
    }
  },
  {
    id: "phenytoin",
    name: "Phenytoin Na",
    genericName: "Dilantin",
    category: "Anti-Convulsants",
    standardDose: "LD: 15-20 mg/kg IV, MD: 5-8 mg/kg/day divided 12hly",
    route: "IV / PO",
    frequency: "Stat (Loading), then Q12H (Maintenance)",
    source: "User Sheet",
    indications: ["Status epilepticus (refractory)", "Generalized tonic-clonic seizures"],
    calculateDose: (w: number) => {
      const load = w * 20;
      const maintDailyMin = w * 5;
      const maintDailyMax = w * 8;
      const maintDoseMin = maintDailyMin / 2;
      const maintDoseMax = maintDailyMax / 2;
      return {
        doseValue: `Load: ${load.toFixed(0)} mg IV, Maint: ${maintDoseMin.toFixed(1)}-${maintDoseMax.toFixed(1)} mg BD`,
        unit: "mg",
        breakdown: `Loading Dose (15-20 mg/kg): ${load.toFixed(1)} mg IV slow push (max rate 1 mg/kg/min)\nMaintenance Dose (5-8 mg/kg/day divided 12hly): ${maintDoseMin.toFixed(1)} to ${maintDoseMax.toFixed(1)} mg PO/IV BD`,
        notes: "CRITICAL: Inject IV very slowly (max 1mg/kg/min or 50mg/min) diluted ONLY in Normal Saline. Flush with NS before/after. Extravasation causes 'Purple Glove Syndrome'."
      };
    }
  },
  {
    id: "thiopental",
    name: "Thiopental",
    genericName: "Pentothal",
    category: "Anti-Convulsants",
    standardDose: "LD: 5-10 mg/kg IV, MD: 2-10 mg/kg/hr continuous infusion",
    route: "IV",
    frequency: "Stat bolus, then continuous drip",
    source: "User Sheet",
    indications: ["Refractory status epilepticus", "Intracranial pressure reduction", "Anesthetic induction"],
    calculateDose: (w: number) => {
      const loadMin = w * 5;
      const loadMax = w * 10;
      const maintMin = w * 2;
      const maintMax = w * 10;
      return {
        doseValue: `Load: ${loadMin.toFixed(0)}-${loadMax.toFixed(0)} mg IV, Infusion: ${maintMin.toFixed(1)}-${maintMax.toFixed(1)} mg/hr`,
        unit: "mg",
        breakdown: `Loading Dose (5-10 mg/kg IV): ${loadMin.toFixed(1)} to ${loadMax.toFixed(1)} mg IV bolus\nMaintenance Infusion (2-10 mg/kg/hr): ${maintMin.toFixed(1)} to ${maintMax.toFixed(1)} mg/hour continuous IV drip`,
        notes: "Barbiturate. Causes severe respiratory depression and systemic hypotension. Mechanical ventilation and cardiovascular support MUST be actively available."
      };
    }
  },
  {
    id: "topiramate",
    name: "Topiramate",
    category: "Anti-Convulsants",
    standardDose: "3-9 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Lennox-Gastaut syndrome", "Refractory focal/generalized seizures", "Migraine prophylaxis"],
    calculateDose: (w: number) => {
      const minDaily = w * 3;
      const maxDaily = w * 9;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO BD`,
        notes: "Can cause metabolic acidosis, renal stones, and cognitive slowing. Ensure good hydration."
      };
    }
  },
  {
    id: "valproate",
    name: "Valproate Na",
    genericName: "Sodium Valproate / Depakote",
    category: "Anti-Convulsants",
    standardDose: "LD: 20 mg/kg IV slowly, MD: 10-15 mg/kg/day divided 12hly, Max: 60 mg/kg/day",
    route: "PO / IV",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Status epilepticus", "Absence seizures", "Generalized/focal epilepsy"],
    calculateDose: (w: number) => {
      const load = w * 20;
      const maintDailyMin = w * 10;
      const maintDailyMax = w * 15;
      const maintDoseMin = maintDailyMin / 2;
      const maintDoseMax = maintDailyMax / 2;
      const maxDaily = w * 60;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `Load: ${load.toFixed(0)} mg, Maint: ${maintDoseMin.toFixed(1)}-${maintDoseMax.toFixed(1)} mg BD`,
        unit: "mg",
        breakdown: `Loading Dose (20 mg/kg IV slow push): ${load.toFixed(1)} mg IV once\nMaintenance Dose (10-15 mg/kg/day divided 12hly): ${maintDoseMin.toFixed(1)} to ${maintDoseMax.toFixed(1)} mg PO/IV BD\nMaximum allowable dose (60 mg/kg/day): ${maxDose.toFixed(1)} mg BD`,
        notes: "Monitor liver function and complete blood count. Contraindicated in suspected mitochondrial disorders."
      };
    }
  },

  // Sedation
  {
    id: "triclofos",
    name: "Triclofos Na",
    category: "Sedation",
    standardDose: "20 mg/kg/dose",
    route: "PO",
    frequency: "Stat (30 minutes before procedure)",
    source: "User Sheet",
    indications: ["Procedural sedation (EEG, imaging, minor procedures)"],
    calculateDose: (w: number) => {
      const dose = w * 20;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Sedation Dose (20 mg/kg): ${dose.toFixed(1)} mg PO once`,
        notes: "Give 30-45 minutes before procedure. Monitor respiratory rate and oxygen saturation."
      };
    }
  }
];
