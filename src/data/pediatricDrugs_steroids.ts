import { PediatricDrug } from "./pediatricDrugs_types";

export const STEROIDS_DRUGS: PediatricDrug[] = [
  // Steroids/Hormones
  {
    id: "dexamethasone",
    name: "Dexamethasone",
    category: "Steroids/Hormones",
    standardDose: "0.15-0.6 mg/kg/dose PO/IV, 0.05-0.5 mg/kg/day daily",
    route: "PO / IV / IM",
    frequency: "Daily / Stat / Q6-12H",
    maxDose: "Max: 16 mg/dose",
    source: "User Sheet / Harriet Lane",
    indications: ["Croup", "Acute asthma", "Bacterial meningitis adjunct", "Cerebral edema"],
    calculateDose: (w: number) => {
      const croupDose = Math.min(16, w * 0.6);
      const lowRange = w * 0.05;
      const highRange = w * 0.5;
      return {
        doseValue: `Croup: ${croupDose.toFixed(1)} mg, Daily range: ${lowRange.toFixed(2)}-${highRange.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Croup Standard Dose (0.6 mg/kg single dose): ${croupDose.toFixed(1)} mg PO/IV\nGeneral Anti-inflammatory (0.05-0.5 mg/kg/day): ${lowRange.toFixed(2)} to ${highRange.toFixed(2)} mg daily`,
        notes: "Long half-life. Croup single dose is highly effective and usually covers 72 hours."
      };
    }
  },
  {
    id: "hydrocortisone",
    name: "Hydrocortisone Na",
    category: "Steroids/Hormones",
    standardDose: "Standard: 2-4 mg/kg Q6H IV, Stress: 10 mg/kg/dose IV",
    route: "IV / IM",
    frequency: "Q6H or Stat",
    source: "User Sheet / Harriet Lane",
    indications: ["Severe acute asthma (status asthmaticus)", "Adrenal crisis", "Septic shock"],
    calculateDose: (w: number) => {
      const stdMin = w * 2;
      const stdMax = w * 4;
      const stressDose = w * 10;
      return {
        doseValue: `Std: ${stdMin.toFixed(0)}-${stdMax.toFixed(0)} mg, Stress: ${stressDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Standard Maintenance (2-4 mg/kg Q6H): ${stdMin.toFixed(1)} to ${stdMax.toFixed(1)} mg IV/IM Q6H\nStress / Shock Bolus (10 mg/kg): ${stressDose.toFixed(1)} mg IV once`,
        notes: "Provides rapid mineralocorticoid and glucocorticoid effects. Avoid rapid IV bolus."
      };
    }
  },
  {
    id: "methylprednisolone",
    name: "Methylprednisolone",
    genericName: "Solu-Medrol",
    category: "Steroids/Hormones",
    standardDose: "0.4-1.7 mg/kg/day IM/IV, Pulse: 30 mg/kg IV bolus",
    route: "IV / IM",
    frequency: "Daily or Stat",
    source: "User Sheet",
    indications: ["Status asthmaticus", "Nephrotic syndrome relapse", "Pulse therapy for autoimmune flares"],
    calculateDose: (w: number) => {
      const minDaily = w * 0.4;
      const maxDaily = w * 1.7;
      const pulseDose = w * 30;
      return {
        doseValue: `Daily: ${minDaily.toFixed(1)}-${maxDaily.toFixed(1)} mg, Pulse: ${pulseDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Standard Daily range (0.4-1.7 mg/kg/day IM/IV): ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg daily\nPulse Therapy (30 mg/kg IV bolus over 10-20 min): ${pulseDose.toFixed(1)} mg IV once daily`,
        notes: "Pulse therapy should be infused over 20-30 minutes. Monitor heart rate and blood pressure closely during pulse infusion."
      };
    }
  },
  {
    id: "prednisolone",
    name: "Prednisolone",
    genericName: "Omnipred",
    category: "Steroids/Hormones",
    standardDose: "1-2 mg/kg/day divided 8hly PO",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Asthma exacerbation", "Nephrotic syndrome", "Severe allergic reactions"],
    calculateDose: (w: number) => {
      const minDaily = w * 1;
      const maxDaily = w * 2;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H`,
        notes: "Give with food to reduce GI upset. Usually limited to 3-5 days in acute asthma."
      };
    }
  },
  {
    id: "desmopressin",
    name: "Desmopressin (DDAVP)",
    category: "Steroids/Hormones",
    standardDose: "DI: 5-30 mcg OD/BD, Enuresis: 20-40 mcg IM/IV",
    route: "Intranasal / PO / IM / IV",
    frequency: "Daily / 12hly",
    source: "User Sheet",
    indications: ["Central diabetes insipidus (DI)", "Nocturnal enuresis", "Hemophilia A / Von Willebrand's"],
    calculateDose: (w: number) => {
      return {
        doseValue: "Indication-specific: 5-40 mcg",
        unit: "mcg",
        breakdown: "Diabetes Insipidus Intranasal: 5 to 30 mcg once or twice daily\nNocturnal Enuresis Intranasal: 20 to 40 mcg at bedtime",
        notes: "Monitor fluid intake and serum sodium to prevent water intoxication and hyponatremia."
      };
    }
  },
  {
    id: "thyroxine",
    name: "Thyroxine Na",
    category: "Steroids/Hormones",
    standardDose: "Newborn: 10-15 mcg/kg, Child: 5 mcg/kg, >5yrs: 100 mcg daily",
    route: "PO",
    frequency: "Daily",
    source: "User Sheet",
    indications: ["Congenital hypothyroidism", "Juvenile hypothyroidism"],
    calculateDose: (w: number) => {
      const newbornMin = w * 10;
      const newbornMax = w * 15;
      const childDose = w * 5;
      return {
        doseValue: `Newborn: ${newbornMin.toFixed(0)}-${newbornMax.toFixed(0)} mcg, Child: ${childDose.toFixed(0)} mcg`,
        unit: "mcg",
        breakdown: `Newborn Dose (10-15 mcg/kg/day): ${newbornMin.toFixed(1)} to ${newbornMax.toFixed(1)} mcg PO once daily\nChild Dose (5 mcg/kg/day): ${childDose.toFixed(1)} mcg PO once daily\nOlder Child >5yrs: 100 mcg PO once daily`,
        notes: "Give on empty stomach in the morning, 30 minutes before feeding. Adjust dose based on TSH/free T4 levels."
      };
    }
  },
  {
    id: "imipramine",
    name: "Imipramine Hcl",
    genericName: "Depsonil",
    category: "Steroids/Hormones",
    standardDose: "Child: 1.5 mg/kg/day 8hly, Adolescents: 25-50 mg/day 8hly PO",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Nocturnal enuresis (temporary)", "Depressive disorders"],
    calculateDose: (w: number) => {
      const daily = w * 1.5;
      const dose = daily / 3;
      return {
        doseValue: `Child: ${dose.toFixed(1)} mg 8hly, Adol: 8-16 mg 8hly`,
        unit: "mg",
        breakdown: `Child Dose (1.5 mg/kg/day divided 8hly): ${dose.toFixed(1)} mg PO Q8H\nAdolescent Dose range (25-50 mg/day divided 8hly): 8.3 to 16.6 mg PO Q8H`,
        notes: "Tricyclic antidepressant. High toxicity risk in overdose (cardiotoxic). Monitor EKG. Keep out of reach of children."
      };
    }
  },

  // Bronchodilators
  {
    id: "adrenaline",
    name: "Adrenaline (Epinephrine)",
    category: "Bronchodilators",
    standardDose: "Anaphylaxis: 0.01 mg/kg IM, CPR/ET: 0.1 mL/kg of 1:10,000",
    route: "IM / IV / ET / Nebulization",
    frequency: "Stat (Repeat Q3-5M in CPR/Anaphylaxis)",
    source: "User Sheet / PALS Guidelines",
    indications: ["Anaphylaxis (IM 1:1000)", "Cardiac arrest (IV 1:10,000)", "Croup (Nebulized)"],
    calculateDose: (w: number) => {
      const imVol = w * 0.01; // 1:1000 is 1mg/mL, so 0.01mg is 0.01mL
      const ivVol10k = w * 0.1; // 1:10,000 is 0.1mg/mL, so 0.01mg/kg is 0.1mL/kg
      const croupNeb = Math.min(5, w * 0.5); // L-Adrenaline neb 0.5mL/kg (max 5mL)
      return {
        doseValue: `Anaph IM: ${imVol.toFixed(2)} mL, CPR IV: ${ivVol10k.toFixed(1)} mL, Croup Neb: ${croupNeb.toFixed(1)} mL`,
        unit: "mL",
        breakdown: `Anaphylaxis (IM 1:1000, 0.01 mg/kg): ${imVol.toFixed(2)} mL IM (lateral thigh)\nCardiac Arrest (IV/IO 1:10,000, 0.1 mL/kg): ${ivVol10k.toFixed(1)} mL IV push Q3-5M\nCroup Nebulization (1:1000 L-Adrenaline, 0.5 mL/kg): ${croupNeb.toFixed(1)} mL diluted with NS`,
        notes: "IM Adrenaline is given as 1:1000 concentration. IV/IO/Endotracheal is given as 1:10,000. Double-check concentration always."
      };
    }
  },
  {
    id: "aminophylline",
    name: "Aminophylline",
    category: "Bronchodilators",
    standardDose: "Oral: 15-20 mg/kg/day 8hly. IV LD: 5-7 mg/kg. MD: 0.5-0.9 mg/kg/hr",
    route: "PO / IV",
    frequency: "8hly or continuous",
    source: "User Sheet",
    indications: ["Severe acute asthma exacerbation", "Apnea of prematurity"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 15;
      const poDailyMax = w * 20;
      const poDoseMin = poDailyMin / 3;
      const poDoseMax = poDailyMax / 3;
      const ivLoad = w * 6; // mid of 5-7
      const ivMaint = w * 0.7; // mid of 0.5-0.9
      const apneaLoad = w * 5;
      const apneaMaint = w * 2;
      return {
        doseValue: `PO: ${poDoseMin.toFixed(1)}-${poDoseMax.toFixed(1)} mg, IV LD: ${ivLoad.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (15-20 mg/kg/day divided 8hly): ${poDoseMin.toFixed(1)} to ${poDoseMax.toFixed(1)} mg PO Q8H\nIV Loading Dose (5-7 mg/kg over 20 mins): ${ivLoad.toFixed(1)} mg IV push\nIV Maintenance Infusion (0.5-0.9 mg/kg/hr): ${ivMaint.toFixed(1)} mg/hour continuous infusion\nApnea of Prematurity Loading: ${apneaLoad.toFixed(1)} mg IV/PO, Maintenance: ${apneaMaint.toFixed(1)} mg Q8H`,
        notes: "Narrow therapeutic index. Monitor heart rate (withhold if tachycardic) and serum theophylline levels."
      };
    }
  },
  {
    id: "salbutamol",
    name: "Salbutamol (Albuterol)",
    category: "Bronchodilators",
    standardDose: "Oral: 0.1-0.4 mg/kg/dose 8hly, Neb: 0.15 mg/kg/dose",
    route: "PO / Nebulization / MDI",
    frequency: "8hly (Oral) or PRN (Nebulization)",
    source: "User Sheet / PALS",
    indications: ["Bronchospasm", "Acute asthma exacerbation", "Hyperkalemia"],
    calculateDose: (w: number) => {
      const poMin = w * 0.1;
      const poMax = w * 0.4;
      const nebDose = Math.min(5, Math.max(1.25, w * 0.15));
      return {
        doseValue: `Oral: ${poMin.toFixed(2)}-${poMax.toFixed(2)} mg, Neb: ${nebDose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (0.1-0.4 mg/kg/dose 8hly): ${poMin.toFixed(2)} to ${poMax.toFixed(2)} mg PO Q8H\nNebulized Liquid Dose (0.15 mg/kg/dose): ${nebDose.toFixed(2)} mg mixed in 2-3 mL NS Q1-4H`,
        notes: "Watch for tachycardia, tremors, hypokalemia, and hyperactivity."
      };
    }
  },
  {
    id: "terbutaline",
    name: "Terbutaline Sulphate",
    category: "Bronchodilators",
    standardDose: "Oral: 0.1-0.15 mg/kg/day 8hly, SC: 0.01-0.02 mL/kg, Neb: 2.5-5 mg/kg",
    route: "PO / SC / Nebulization",
    frequency: "8hly or as needed",
    source: "User Sheet",
    indications: ["Bronchospasm", "Status asthmaticus refractory"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 0.1;
      const poDailyMax = w * 0.15;
      const poDoseMin = poDailyMin / 3;
      const poDoseMax = poDailyMax / 3;
      const scVolMin = w * 0.01;
      const scVolMax = w * 0.02;
      return {
        doseValue: `PO: ${poDoseMin.toFixed(3)}-${poDoseMax.toFixed(3)} mg, SC: ${scVolMin.toFixed(2)}-${scVolMax.toFixed(2)} mL`,
        unit: "mg / mL",
        breakdown: `Oral Dose (0.1-0.15 mg/kg/day divided 8hly): ${poDoseMin.toFixed(3)} to ${poDoseMax.toFixed(3)} mg PO Q8H\nSC Injection Dose (0.01-0.02 mL/kg of 1mg/mL solution): ${scVolMin.toFixed(2)} to ${scVolMax.toFixed(2)} mL SC Q4-6H\nNebulizer Dose: 2.5 to 5 mg nebulized`,
        notes: "Monitor potassium, heart rate, and blood pressure. Avoid rapid dosage escalations."
      };
    }
  },

  // Anti-Tubercular
  {
    id: "isoniazid",
    name: "Isoniazid (INH)",
    category: "Anti-Tubercular",
    standardDose: "10-15 mg/kg/day single dose",
    route: "PO",
    frequency: "Daily",
    source: "WHO / User Sheet",
    indications: ["Active tuberculosis", "Tuberculosis prophylaxis"],
    calculateDose: (w: number) => {
      const doseVal = w * 10;
      return {
        doseValue: `${doseVal.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily Dose (10-15 mg/kg/day): ${doseVal.toFixed(1)} mg PO once daily`,
        notes: "Administer Pyridoxine (Vitamin B6) at 10 mg/day concurrently to prevent peripheral neuropathy."
      };
    }
  }
];
