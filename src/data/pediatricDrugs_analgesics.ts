import { PediatricDrug } from "./pediatricDrugs_types";

export const ANALGESICS_DRUGS: PediatricDrug[] = [
  // Analgesics & Antipyretics
  {
    id: "paracetamol",
    name: "Paracetamol",
    genericName: "Acetaminophen",
    category: "Analgesics & Antipyretics",
    standardDose: "15 mg/kg/dose PO/PR, 5 mg/kg IM",
    route: "PO / IV / PR / IM",
    frequency: "Q6H (6hrly) PRN",
    maxDose: "Max: 60 mg/kg/day or 4g/day",
    source: "Pediatric Formulary / User Sheet",
    indications: ["Mild to moderate pain", "Fever control"],
    calculateDose: (w: number) => {
      const poVal = Math.min(1000, w * 15);
      const imVal = Math.min(250, w * 5);
      return {
        doseValue: `PO/IV/PR: ${poVal.toFixed(1)} mg, IM: ${imVal.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Oral/IV/PR Dose (15 mg/kg): ${poVal.toFixed(1)} mg Q6H PRN\nStandard IM Dose (5 mg/kg): ${imVal.toFixed(1)} mg IM Q6H PRN`,
        notes: "Do not exceed 4 doses in 24 hours. Hepatotoxic in overdose."
      };
    }
  },
  {
    id: "nimesulide",
    name: "Nimesulide",
    category: "Analgesics & Antipyretics",
    standardDose: "5 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "Pediatric Dosing Reference / User Sheet",
    indications: ["Acute pain", "Inflammation"],
    calculateDose: (w: number) => {
      const daily = w * 5;
      const single = daily / 2;
      return {
        doseValue: `${single.toFixed(1)} mg per dose`,
        unit: "mg",
        breakdown: `Total Daily Dose: ${daily.toFixed(1)} mg/day\nSingle Dose (12hly): ${single.toFixed(1)} mg PO BD`,
        notes: "Use with caution. Monitor liver function for prolonged use."
      };
    }
  },
  {
    id: "brufen",
    name: "Brufen (Ibuprofen)",
    category: "Analgesics & Antipyretics",
    standardDose: "10-15 mg/kg/dose",
    route: "PO",
    frequency: "Q6-8H PRN",
    maxDose: "Max: 40 mg/kg/day",
    source: "Pediatric Formulary / User Sheet",
    indications: ["Fever control", "Mild to moderate pain", "Anti-inflammatory"],
    calculateDose: (w: number) => {
      const minDose = Math.min(400, w * 10);
      const maxDose = Math.min(800, w * 15);
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose range (10-15 mg/kg): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q6-8H PRN`,
        notes: "Take with food to minimize gastric irritation. Avoid in severe dehydration."
      };
    }
  },
  {
    id: "indomethacin",
    name: "Indomethacin",
    category: "Analgesics & Antipyretics",
    standardDose: "Oral: 3 mg/kg/day, PDA: 0.2 mg/kg/dose IV",
    route: "PO / IV",
    frequency: "8-12hly",
    source: "Harriet Lane / User Sheet",
    indications: ["Anti-inflammatory", "Patent Ductus Arteriosus (PDA) closure"],
    calculateDose: (w: number) => {
      const oralDaily = w * 3;
      const oralDose = oralDaily / 3;
      const pdaDose = w * 0.2;
      return {
        doseValue: `Oral: ${oralDose.toFixed(1)} mg 8hly, IV PDA: ${pdaDose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (3 mg/kg/day divided 8hly): ${oralDose.toFixed(1)} mg PO Q8H\nIV PDA Closure Dose (0.2 mg/kg): ${pdaDose.toFixed(2)} mg IV Stat`,
        notes: "Monitor renal function and urine output closely when using IV for PDA closure."
      };
    }
  },
  {
    id: "mefenamic-acid",
    name: "Mefenamic Acid",
    category: "Analgesics & Antipyretics",
    standardDose: "3 mg/kg/dose",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Pain relief", "Dysmenorrhea", "Fever control"],
    calculateDose: (w: number) => {
      const single = w * 3;
      return {
        doseValue: `${single.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (3 mg/kg/dose): ${single.toFixed(1)} mg PO 8hly`,
        notes: "Avoid in patients with active gastrointestinal ulceration or renal impairment."
      };
    }
  },
  {
    id: "naproxen",
    name: "Naproxen",
    category: "Analgesics & Antipyretics",
    standardDose: "5-7 mg/kg/dose 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Juvenile idiopathic arthritis", "Moderate pain", "Anti-inflammatory"],
    calculateDose: (w: number) => {
      const minDose = w * 5;
      const maxDose = w * 7;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose range (5-7 mg/kg/dose): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO 8hly`,
        notes: "Administer with food. Monitor for GI side effects."
      };
    }
  },
  {
    id: "diclofenac-na",
    name: "Diclofenac Na",
    category: "Analgesics & Antipyretics",
    standardDose: "1-3 mg/kg/day divided 8hly",
    route: "PO / PR",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Rheumatoid arthritis", "Post-operative pain", "Severe inflammation"],
    calculateDose: (w: number) => {
      const minDaily = w * 1;
      const maxDaily = w * 3;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Total Daily range (1-3 mg/kg/day): ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO/PR Q8H`,
        notes: "Do not exceed 150 mg/day. Monitor renal and hepatic function during long term use."
      };
    }
  },
  {
    id: "codeine-ph",
    name: "Codeine Phosphate",
    category: "Analgesics & Antipyretics",
    standardDose: "Pain: 3 mg/kg/day, Cough: 0.2 mg/kg/dose",
    route: "PO",
    frequency: "4-6hly",
    source: "User Sheet",
    indications: ["Moderate pain relief", "Antitussive (cough relief)"],
    calculateDose: (w: number) => {
      const painDaily = w * 3;
      const painDose = painDaily / 4; // divided 6hly (4 doses)
      const coughDose = w * 0.2;
      return {
        doseValue: `Pain: ${painDose.toFixed(1)} mg 6hly, Cough: ${coughDose.toFixed(1)} mg Q6H`,
        unit: "mg",
        breakdown: `Pain relief (3 mg/kg/day divided 6hly): ${painDose.toFixed(1)} mg PO\nAntitussive Cough Dose (0.2 mg/kg/dose): ${coughDose.toFixed(1)} mg PO Q6H`,
        notes: "Avoid in children under 12 years or post-tonsillectomy due to rapid metabolizer risks."
      };
    }
  },
  {
    id: "acetylsalicylic-acid",
    name: "Acetylsalicylic Acid (Aspirin)",
    category: "Analgesics & Antipyretics",
    standardDose: "30-65 mg/kg/day divided 6hly",
    route: "PO",
    frequency: "6hly",
    source: "User Sheet",
    indications: ["Kawasaki disease (acute phase)", "Anti-inflammatory", "Anti-pyretic"],
    calculateDose: (w: number) => {
      const minDaily = w * 30;
      const maxDaily = w * 65;
      const minDose = minDaily / 4;
      const maxDose = maxDaily / 4;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Total Daily range (30-65 mg/kg/day): ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (6hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q6H`,
        notes: "WARNING: Association with Reye's Syndrome in viral illness. Use with extreme caution."
      };
    }
  },
  {
    id: "pentazocine-hcl",
    name: "Pentazocine Hcl",
    category: "Analgesics & Antipyretics",
    standardDose: "0.5-1.0 mg/kg/day divided 4hly",
    route: "PO / IV / IM",
    frequency: "4hly",
    source: "User Sheet",
    indications: ["Moderate to severe pain relief"],
    calculateDose: (w: number) => {
      const minDaily = w * 0.5;
      const maxDaily = w * 1.0;
      const minDose = minDaily / 6; // 4hly is 6 times daily
      const maxDose = maxDaily / 6;
      return {
        doseValue: `${minDose.toFixed(2)}-${maxDose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Total Daily range (0.5-1.0 mg/kg/day): ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (4hly): ${minDose.toFixed(2)} to ${maxDose.toFixed(2)} mg PO/IV/IM Q4H`,
        notes: "Opioid analgesic. Monitor respiratory rate and sedation level."
      };
    }
  },

  // Diuretics
  {
    id: "acetazolamide",
    name: "Acetazolamide",
    category: "Diuretics",
    standardDose: "Diuretic: 5 mg/kg/day, Hydrocephalus: 50-70 mg/kg/day 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Diuretic", "Glaucoma", "Hydrocephalus"],
    calculateDose: (w: number) => {
      const diDaily = w * 5;
      const diDose = diDaily / 3;
      const hcDailyMin = w * 50;
      const hcDailyMax = w * 70;
      const hcDoseMin = hcDailyMin / 3;
      const hcDoseMax = hcDailyMax / 3;
      return {
        doseValue: `Diuretic: ${diDose.toFixed(1)} mg, Hydrocephalus: ${hcDoseMin.toFixed(0)}-${hcDoseMax.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Diuretic Dose (5 mg/kg/day divided 8hly): ${diDose.toFixed(1)} mg PO Q8H\nHydrocephalus Dose (50-70 mg/kg/day divided 8hly): ${hcDoseMin.toFixed(1)} to ${hcDoseMax.toFixed(1)} mg PO Q8H`,
        notes: "Can cause metabolic acidosis, hypokalemia, and paresthesias. Monitor electrolytes."
      };
    }
  },
  {
    id: "furosemide-frusemide",
    name: "Frusemide (Furosemide)",
    category: "Diuretics",
    standardDose: "PO: 2-8 mg/kg/day 12hly, IV: 1-4 mg/kg/day 12hly",
    route: "PO / IV",
    frequency: "12hly",
    source: "User Sheet",
    indications: ["Edema", "Congestive heart failure", "Fluid overload"],
    calculateDose: (w: number) => {
      const poMin = (w * 2) / 2;
      const poMax = (w * 8) / 2;
      const ivMin = (w * 1) / 2;
      const ivMax = (w * 4) / 2;
      return {
        doseValue: `PO: ${poMin.toFixed(1)}-${poMax.toFixed(1)} mg, IV: ${ivMin.toFixed(1)}-${ivMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (2-8 mg/kg/day divided 12hly): ${poMin.toFixed(1)} to ${poMax.toFixed(1)} mg PO BD\nIV Dose (1-4 mg/kg/day divided 12hly): ${ivMin.toFixed(1)} to ${ivMax.toFixed(1)} mg IV BD`,
        notes: "Potent loop diuretic. Watch for hypokalemia, hyponatremia, and dehydration."
      };
    }
  },

  // Cardiotonics
  {
    id: "digoxin",
    name: "Digoxin",
    category: "Cardiotonics",
    standardDose: "Oral: 0.04-0.06 mg/kg/day, IV: 2/3 of Oral",
    route: "PO / IV",
    frequency: "Daily or divided",
    source: "User Sheet",
    indications: ["Heart failure", "Supraventricular tachyarrhythmias", "Atrial fibrillation control"],
    calculateDose: (w: number) => {
      const poMin = w * 0.04;
      const poMax = w * 0.06;
      const ivMin = poMin * (2/3);
      const ivMax = poMax * (2/3);
      return {
        doseValue: `Oral: ${poMin.toFixed(3)}-${poMax.toFixed(3)} mg/day, IV: ${ivMin.toFixed(3)}-${ivMax.toFixed(3)} mg/day`,
        unit: "mg",
        breakdown: `Oral TDD (0.04-0.06 mg/kg/day): ${poMin.toFixed(3)} to ${poMax.toFixed(3)} mg PO daily\nIV TDD (2/3 of Oral): ${ivMin.toFixed(3)} to ${ivMax.toFixed(3)} mg IV daily\n(Usually given: 1/2 loading, then 1/4 at 6-8h, then 1/4 at 6-8h)`,
        notes: "Narrow therapeutic index. Monitor heart rate, EKG (PR prolongation), and potassium. Digoxin toxicity risk high."
      };
    }
  },
  {
    id: "dobutamine",
    name: "Dobutamine",
    category: "Cardiotonics",
    standardDose: "5-20 mcg/kg/min",
    route: "IV Infusion",
    frequency: "Continuous drip",
    source: "User Sheet",
    indications: ["Cardiogenic shock", "Low cardiac output state"],
    calculateDose: (w: number) => {
      const minRate = w * 5;  // mcg/min
      const maxRate = w * 20; // mcg/min
      return {
        doseValue: `${minRate.toFixed(0)}-${maxRate.toFixed(0)} mcg/min`,
        unit: "mcg/min",
        breakdown: `Dose Rate range (5-20 mcg/kg/min): ${minRate.toFixed(1)} to ${maxRate.toFixed(1)} mcg/minute continuous IV infusion`,
        notes: "Dilute in D5W or NS. Incompatible with alkaline solutions (e.g., sodium bicarbonate). Titrate to effect."
      };
    }
  },
  {
    id: "dopamine",
    name: "Dopamine",
    category: "Cardiotonics",
    standardDose: "Start: 5 mcg/kg/min, Max: 30 mcg/kg/min",
    route: "IV Infusion",
    frequency: "Continuous drip",
    source: "User Sheet",
    indications: ["Shock", "Hypotension unresponsive to fluid resuscitation", "Renal perfusion support"],
    calculateDose: (w: number) => {
      const minRate = w * 5;  // mcg/min
      const maxRate = w * 30; // mcg/min
      return {
        doseValue: `${minRate.toFixed(0)}-${maxRate.toFixed(0)} mcg/min`,
        unit: "mcg/min",
        breakdown: `Dose Rate range (5-30 mcg/kg/min): ${minRate.toFixed(1)} to ${maxRate.toFixed(1)} mcg/minute continuous IV infusion`,
        notes: "Ensure adequate intravascular volume first. Administer through central venous catheter if possible."
      };
    }
  },

  // Supplements/Vitamins
  {
    id: "iron",
    name: "Iron",
    category: "Supplements/Vitamins",
    standardDose: "Prophylaxis: 1 mg/kg/day BD, Treatment: 3-5 mg/kg/day 12hly",
    route: "PO / IM",
    frequency: "12hly (BD) or daily",
    source: "User Sheet",
    indications: ["Iron deficiency anemia", "Anemia prophylaxis in preterms"],
    calculateDose: (w: number) => {
      const propDaily = w * 1;
      const propDose = propDaily / 2;
      const txDailyMin = w * 3;
      const txDailyMax = w * 5;
      const txDoseMin = txDailyMin / 2;
      const txDoseMax = txDailyMax / 2;
      return {
        doseValue: `Prop: ${propDose.toFixed(1)} mg BD, Treatment: ${txDoseMin.toFixed(1)}-${txDoseMax.toFixed(1)} mg BD`,
        unit: "mg elemental",
        breakdown: `Prophylaxis (1 mg/kg/day divided BD): ${propDose.toFixed(1)} mg PO BD\nTreatment (3-5 mg/kg/day divided BD): ${txDoseMin.toFixed(1)} to ${txDoseMax.toFixed(1)} mg PO BD\nFormula for IM Iron dextran: 4.0 x Weight (kg) x Hb deficit`,
        notes: "Administer on an empty stomach with water or juice (vitamin C increases absorption). Black stools are normal."
      };
    }
  },
  {
    id: "vitamin-a",
    name: "Vitamin A",
    category: "Supplements/Vitamins",
    standardDose: "<12m: 100k IU, >12m: 200k IU single dose",
    route: "PO",
    frequency: "Single dose (Repeat as indicated)",
    source: "User Sheet",
    indications: ["Vitamin A deficiency", "Measles adjunct", "Prophylaxis"],
    calculateDose: (w: number) => {
      return {
        doseValue: `<12m: 100,000 IU, >12m: 200,000 IU`,
        unit: "IU",
        breakdown: `Under 12 months: 100,000 IU Orally (single dose)\nOver 12 months: 200,000 IU Orally (single dose)\nDeficiency treatment: Administer on Day 0, Day 1, and Day 14`,
        notes: "High doses can cause transient bulging fontanelle, vomiting, and headache."
      };
    }
  },
  {
    id: "vitamin-b",
    name: "Vitamin B Complex",
    category: "Supplements/Vitamins",
    standardDose: "0.3-3 mg/kg/day Oral/IM/IV, INH Neuropathy: 10 mg/day",
    route: "PO / IM / IV",
    frequency: "Daily",
    source: "User Sheet",
    indications: ["Vitamin B deficiency", "Co-prescription with Isoniazid (Pyridoxine)"],
    calculateDose: (w: number) => {
      const minDose = w * 0.3;
      const maxDose = w * 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg/day`,
        unit: "mg",
        breakdown: `Standard Daily range (0.3-3 mg/kg/day): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg daily\nINH-associated Neuropathy Prevention (Pyridoxine/B6): 10 mg PO once daily`,
        notes: "Excreted in urine (causing bright yellow coloration). Essential co-therapy for active TB patients on Isoniazid."
      };
    }
  },
  {
    id: "vitamin-c",
    name: "Vitamin C (Ascorbic Acid)",
    category: "Supplements/Vitamins",
    standardDose: "Preterm: 50 mg/day, Term: 30 mg/kg PO, Child: 40 mg/kg PO",
    route: "PO",
    frequency: "Daily",
    source: "User Sheet",
    indications: ["Scurvy", "Metabolic support", "Preterm nutrition"],
    calculateDose: (w: number) => {
      const termDose = w * 30;
      const childDose = w * 40;
      return {
        doseValue: `Preterm: 50 mg/day, Term: ${termDose.toFixed(0)} mg/day, Child: ${childDose.toFixed(0)} mg/day`,
        unit: "mg",
        breakdown: `Preterm infant: 50 mg PO daily\nTerm newborn (30 mg/kg): ${termDose.toFixed(1)} mg PO daily\nOlder Child (40 mg/kg): ${childDose.toFixed(1)} mg PO daily`,
        notes: "High doses can cause diarrhea and hyperoxaluria."
      };
    }
  },
  {
    id: "vitamin-d3",
    name: "Vitamin D3 (Cholecalciferol)",
    category: "Supplements/Vitamins",
    standardDose: "Maint: 400 IU/day, Deficiency: 60,000 IU/day x10 days",
    route: "PO",
    frequency: "Daily / Weekly",
    source: "User Sheet",
    indications: ["Nutritional rickets", "Vitamin D deficiency", "Osteomalacia"],
    calculateDose: (w: number) => {
      return {
        doseValue: `Maint: 400 IU/day, Deficiency: 60,000 IU/day`,
        unit: "IU",
        breakdown: `Maintenance/Prophylaxis: 400 IU PO once daily\nDeficiency Treatment: 60,000 IU PO once daily for 10 days, followed by maintenance.`,
        notes: "Monitor serum calcium and phosphorus. High doses can cause hypercalcemia."
      };
    }
  },
  {
    id: "vitamin-k",
    name: "Vitamin K (Phytomenadione)",
    category: "Supplements/Vitamins",
    standardDose: "Term: 1 mg IM, Preterm: 0.5 mg/kg IM, Therapeutic: 5-10 mg IM/IV",
    route: "IM / IV",
    frequency: "Stat (Repeat as indicated)",
    source: "User Sheet",
    indications: ["Prophylaxis of hemorrhagic disease of newborn", "Active bleeding / High INR correction"],
    calculateDose: (w: number) => {
      const pretermDose = Math.min(1, w * 0.5);
      return {
        doseValue: `Term: 1 mg, Preterm: ${pretermDose.toFixed(2)} mg, Bleeding: 5-10 mg`,
        unit: "mg",
        breakdown: `Newborn Term Prophylaxis: 1 mg IM once at birth\nNewborn Preterm Prophylaxis (0.5 mg/kg): ${pretermDose.toFixed(2)} mg IM once at birth\nTherapeutic Dose (active bleeding/warfarin reversal): 5 to 10 mg IV/IM once`,
        notes: "Administer IV doses very slowly over 15-30 minutes to minimize anaphylactoid reaction risks."
      };
    }
  },

  // Miscellaneous
  {
    id: "heparin",
    name: "Heparin",
    category: "Miscellaneous",
    standardDose: "IV: 50-100 mcg/kg 4hrly, SC: 25-50 mcg/kg 12hly, DVT: 5000 mcg 8hly",
    route: "IV / SC",
    frequency: "4hly or 12hly",
    source: "User Sheet",
    indications: ["Thromboembolism prophylaxis", "DVT treatment", "Line patency maintenance"],
    calculateDose: (w: number) => {
      const ivMin = w * 50;
      const ivMax = w * 100;
      const scMin = w * 25;
      const scMax = w * 50;
      return {
        doseValue: `IV: ${ivMin.toFixed(0)}-${ivMax.toFixed(0)} mcg, SC: ${scMin.toFixed(0)}-${scMax.toFixed(0)} mcg`,
        unit: "mcg (units equivalent)",
        breakdown: `IV Bolus Dose (50-100 mcg/kg): ${ivMin.toFixed(0)} to ${ivMax.toFixed(0)} mcg IV Q4H\nSC Prophylaxis Dose (25-50 mcg/kg): ${scMin.toFixed(0)} to ${scMax.toFixed(0)} mcg SC Q12H\nDVT standard fixed dose: 5,000 mcg (units) SC Q8H`,
        notes: "Monitor APTT carefully. Have protamine sulfate ready as an antidote for severe bleeding."
      };
    }
  },
  {
    id: "anti-rh-d-immune-globulin",
    name: "Anti-Rh D Immune Globulin",
    category: "Miscellaneous",
    standardDose: "500 mcg IM Single Dose <72h",
    route: "IM",
    frequency: "Single dose",
    source: "User Sheet",
    indications: ["Rh-incompatibility prophylaxis", "Idiopathic thrombocytopenic purpura (ITP)"],
    calculateDose: (w: number) => {
      return {
        doseValue: `500 mcg`,
        unit: "mcg",
        breakdown: `Standard Dose: 500 mcg IM as a single dose within 72 hours of exposure.`,
        notes: "For intramuscular administration only. Monitor for infusion reactions."
      };
    }
  },
  {
    id: "human-high-dose-ig",
    name: "Human High Dose Ig (IVIG)",
    category: "Miscellaneous",
    standardDose: "400 mg/kg/day continuous IV over 2h for 5 days",
    route: "IV Infusion",
    frequency: "Daily for 5 days (or single 2g/kg dose)",
    source: "User Sheet",
    indications: ["Kawasaki disease", "Guillain-Barré syndrome (GBS)", "ITP refractory"],
    calculateDose: (w: number) => {
      const dailyDose = w * 400; // mg
      const totalDose = dailyDose * 5; // mg over 5 days
      const singleAlt = w * 2000; // alternative 2g/kg single dose
      return {
        doseValue: `Daily: ${dailyDose.toFixed(0)} mg, Alt Single: ${(singleAlt/1000).toFixed(1)} g`,
        unit: "mg",
        breakdown: `Standard Regimen (400 mg/kg/day): ${dailyDose.toFixed(0)} mg IV daily infused over 2+ hours for 5 days\n(Total 5-day course: ${(totalDose/1000).toFixed(1)} g)\nAlternative Kawasaki Regimen (2 g/kg single dose): ${(singleAlt/1000).toFixed(1)} g IV infused over 10-12 hours`,
        notes: "Infuse slowly. Monitor vitals closely for anaphylaxis, hypotension, and aseptic meningitis."
      };
    }
  }
];
