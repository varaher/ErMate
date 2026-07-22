import { PediatricDrug } from "./pediatricDrugs_types";

export const ANTIHISTAMINICS_DRUGS: PediatricDrug[] = [
  // Anti-Histaminics
  {
    id: "cetirizine",
    name: "Cetirizine",
    category: "Anti-Histaminics",
    standardDose: "2-6yrs: 2.5 mg BD, >6yrs: 5 mg BD",
    route: "PO",
    frequency: "12hly (BD) or Daily",
    source: "User Sheet",
    indications: ["Allergic rhinitis", "Urticaria", "Atopic dermatitis"],
    calculateDose: (w: number) => {
      return {
        doseValue: "Age-dependent: 2.5-5 mg BD",
        unit: "mg",
        breakdown: "Under 2 years: Not recommended\nAge 2-6 years: 2.5 mg PO BD (or 5 mg OD)\nAge >6 years: 5 mg PO BD (or 10 mg OD)",
        notes: "Second-generation antihistamine with minimal sedation. Adjust dose in renal impairment."
      };
    }
  },
  {
    id: "chlorpheniramine",
    name: "Chlorpheniramine Maleate",
    genericName: "Anvil / Piriton",
    category: "Anti-Histaminics",
    standardDose: "0.35 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Allergic reactions", "Pruritus", "Cold symptoms"],
    calculateDose: (w: number) => {
      const daily = w * 0.35;
      const dose = daily / 3;
      return {
        doseValue: `${dose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${daily.toFixed(1)} mg/day\nSingle Dose (8hly): ${dose.toFixed(2)} mg PO Q8H`,
        notes: "First-generation sedating antihistamine. Watch for drowsiness, dry mouth, and urinary retention."
      };
    }
  },
  {
    id: "cyproheptadine",
    name: "Cyproheptadine Hcl",
    category: "Anti-Histaminics",
    standardDose: "0.25-0.5 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Allergic conditions", "Appetite stimulant", "Serotonin syndrome"],
    calculateDose: (w: number) => {
      const minDaily = w * 0.25;
      const maxDaily = w * 0.5;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H`,
        notes: "Can cause significant drowsiness and increased appetite. Useful in treating mild serotonin syndrome."
      };
    }
  },
  {
    id: "fexofenadine",
    name: "Fexofenadine",
    category: "Anti-Histaminics",
    standardDose: "<12yrs: 30 mg BD, >12yrs: 60 mg BD",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Allergic rhinitis", "Chronic idiopathic urticaria"],
    calculateDose: (w: number) => {
      return {
        doseValue: "<12yrs: 30 mg BD, >12yrs: 60 mg BD",
        unit: "mg",
        breakdown: "Under 6 months: Not recommended\nAge 6 months to 11 years (<12 yrs): 30 mg PO BD\nAge >= 12 years: 60 mg PO BD (or 120 mg OD)",
        notes: "Non-sedating antihistamine. Avoid administration with fruit juices (reduces absorption)."
      };
    }
  },
  {
    id: "hydroxyzine",
    name: "Hydroxyzine Hcl",
    genericName: "Atarax",
    category: "Anti-Histaminics",
    standardDose: "PO: 2 mg/kg/day 8hly, IM: 0.5-1 mg/kg/dose 8hly",
    route: "PO / IM",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Pruritus / Urticaria", "Anxiety / Pre-op sedation"],
    calculateDose: (w: number) => {
      const poDaily = w * 2;
      const poDose = poDaily / 3;
      const imMin = w * 0.5;
      const imMax = w * 1;
      return {
        doseValue: `PO: ${poDose.toFixed(1)} mg, IM: ${imMin.toFixed(1)}-${imMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (2 mg/kg/day divided 8hly): ${poDose.toFixed(1)} mg PO Q8H\nIntramuscular Dose (0.5-1 mg/kg/dose): ${imMin.toFixed(1)} to ${imMax.toFixed(1)} mg IM Q8H`,
        notes: "Highly effective for severe pruritus. Intramuscular injection must be deep; do not inject subcutaneously."
      };
    }
  },
  {
    id: "ketotifen",
    name: "Ketotifen",
    category: "Anti-Histaminics",
    standardDose: "1 mg BD daily",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Asthma prophylaxis", "Allergic conjunctivitis/rhinitis"],
    calculateDose: (w: number) => {
      return {
        doseValue: "1 mg BD",
        unit: "mg",
        breakdown: "Standard pediatric dose: 1 mg PO twice daily\n(Children <3 years: 0.5 mg PO twice daily is commonly used)",
        notes: "A mast cell stabilizer. Not useful for acute asthma attacks; takes several weeks to achieve full effect."
      };
    }
  },
  {
    id: "levocetirizine",
    name: "Levocetirizine",
    category: "Anti-Histaminics",
    standardDose: "0.12 mg/kg single dose",
    route: "PO",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Allergic rhinitis", "Chronic urticaria"],
    calculateDose: (w: number) => {
      const dose = w * 0.12;
      return {
        doseValue: `${dose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (0.12 mg/kg): ${dose.toFixed(2)} mg PO once daily`,
        notes: "Active enantiomer of cetirizine. Administer in the evening with or without food."
      };
    }
  },
  {
    id: "methdilazine",
    name: "Methdilazine Hcl",
    category: "Anti-Histaminics",
    standardDose: ">3yrs: 4 mg 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Pruritus", "Allergic conditions"],
    calculateDose: (w: number) => {
      return {
        doseValue: ">3yrs: 4 mg BD",
        unit: "mg",
        breakdown: "Children under 3 years: Not recommended\nChildren over 3 years: 4 mg PO twice daily",
        notes: "Phenothiazine derivative antihistamine. Monitor for sedative effects."
      };
    }
  },
  {
    id: "promethazine-hcl",
    name: "Promethazine Hcl",
    genericName: "Phenergan",
    category: "Anti-Histaminics",
    standardDose: "Sedation: 0.25-1 mg/kg PO/IM/IV, Motion: 0.5 mg/kg 12hly",
    route: "PO / IV / IM",
    frequency: "12hly or as needed",
    source: "User Sheet",
    indications: ["Allergic reaction", "Sedation", "Motion sickness", "Nausea/vomiting"],
    calculateDose: (w: number) => {
      const sedMin = w * 0.25;
      const sedMax = w * 1.0;
      const motionDose = w * 0.5;
      return {
        doseValue: `Sedation: ${sedMin.toFixed(1)}-${sedMax.toFixed(1)} mg, Motion: ${motionDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Sedation/Allergy Dose (0.25-1 mg/kg): ${sedMin.toFixed(1)} to ${sedMax.toFixed(1)} mg PO/IM/IV once\nMotion Sickness Dose (0.5 mg/kg 12hly): ${motionDose.toFixed(1)} mg PO Q12H`,
        notes: "WARNING: Avoid in children under 2 years due to risk of fatal respiratory depression. IV use can cause severe tissue injury."
      };
    }
  },

  // Anti-Emetics
  {
    id: "domperidone",
    name: "Domperidone",
    category: "Anti-Emetics",
    standardDose: "0.2-0.4 mg/kg/dose 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Nausea and vomiting", "Gastric motility disorders", "Reflux esophagitis"],
    calculateDose: (w: number) => {
      const minDose = w * 0.2;
      const maxDose = w * 0.4;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose range (0.2-0.4 mg/kg/dose): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO 8hly`,
        notes: "Take 15-30 minutes before meals. Monitor for QT prolongation if co-administered with QT-prolonging drugs."
      };
    }
  },
  {
    id: "granisetron",
    name: "Granisetron",
    category: "Anti-Emetics",
    standardDose: "10-20 mcg/kg/dose PO/IV OD",
    route: "PO / IV",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Chemotherapy-induced nausea and vomiting (CINV)", "Radiation-induced vomiting"],
    calculateDose: (w: number) => {
      const minDose = w * 10;
      const maxDose = w * 20;
      return {
        doseValue: `${minDose.toFixed(0)}-${maxDose.toFixed(0)} mcg`,
        unit: "mcg",
        breakdown: `Standard Dose range (10-20 mcg/kg/dose): ${minDose.toFixed(0)} to ${maxDose.toFixed(0)} mcg PO/IV once daily`,
        notes: "Serotonin 5-HT3 antagonist. Administer IV dose diluted over 5 minutes, 30 minutes before chemo."
      };
    }
  },
  {
    id: "metoclopramide",
    name: "Metoclopramide Hcl",
    genericName: "Reglan",
    category: "Anti-Emetics",
    standardDose: "0.1 mg/kg/dose 8hly, Max: 0.8 mg/kg/day",
    route: "PO / IV / IM",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Gastroesophageal reflux", "Diabetic gastroparesis", "Chemotherapy-induced vomiting"],
    calculateDose: (w: number) => {
      const dose = w * 0.1;
      const maxDaily = w * 0.8;
      return {
        doseValue: `${dose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (0.1 mg/kg/dose): ${dose.toFixed(2)} mg PO/IV/IM Q8H\nDaily Maximum Limit (0.8 mg/kg/day): ${maxDaily.toFixed(1)} mg/day`,
        notes: "Watch for extrapyramidal side effects (dystonic reactions). Avoid prolonged use in pediatric patients."
      };
    }
  },
  {
    id: "ondansetron-hcl",
    name: "Ondansetron Hcl",
    genericName: "Zofran",
    category: "Anti-Emetics",
    standardDose: "0.15-0.45 mg/kg/dose",
    route: "PO / IV",
    frequency: "Before meals or Q8H",
    source: "User Sheet",
    indications: ["Gastroenteritis vomiting", "CINV", "Post-operative vomiting"],
    calculateDose: (w: number) => {
      const minDose = Math.min(8, w * 0.15);
      const maxDose = Math.min(16, w * 0.45);
      return {
        doseValue: `${minDose.toFixed(2)}-${maxDose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (0.15 mg/kg/dose): ${minDose.toFixed(2)} mg PO/IV Q8H\nHigh Dose Range (0.45 mg/kg/dose): ${maxDose.toFixed(2)} mg PO/IV (30 minutes before chemo)`,
        notes: "May prolong QT. Use with caution in patients with hepatic insufficiency."
      };
    }
  },
  {
    id: "promethazine-theoclate",
    name: "Promethazine Theoclate",
    genericName: "Avomine",
    category: "Anti-Emetics",
    standardDose: "0.5 mg/kg/dose 8hly PO",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Motion sickness prophylaxis", "Labyrinthine disorders", "Vomiting"],
    calculateDose: (w: number) => {
      const dose = w * 0.5;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (0.5 mg/kg/dose): ${dose.toFixed(1)} mg PO Q8H (or once 2 hours before travel for motion sickness)`,
        notes: "Contains promethazine. Do not use in children under 2 years. Significant sedating effect."
      };
    }
  },

  // Anti-Malarial
  {
    id: "artemether",
    name: "Artemether",
    category: "Anti-Malarial",
    standardDose: "3.2 mg/kg IM Loading, then 1.6 mg/kg daily",
    route: "IM / PO",
    frequency: "Daily for 5 days",
    source: "User Sheet",
    indications: ["Severe falciparum malaria", "Cholorquine-resistant malaria"],
    calculateDose: (w: number) => {
      const load = w * 3.2;
      const maint = w * 1.6;
      return {
        doseValue: `Load: ${load.toFixed(1)} mg IM, Maint: ${maint.toFixed(1)} mg IM/PO`,
        unit: "mg",
        breakdown: `Loading Dose (Day 1, 3.2 mg/kg IM): ${load.toFixed(1)} mg IM Stat\nMaintenance Dose (Day 2 to 5, 1.6 mg/kg IM/PO daily): ${maint.toFixed(1)} mg daily`,
        notes: "Must be followed by a full course of oral ACT if tolerated to prevent recrudescence."
      };
    }
  },
  {
    id: "artesunate-malarial",
    name: "Artesunate",
    category: "Anti-Malarial",
    standardDose: "IV: 4 mg/kg/day for 3 days, PO: 5 mg/kg stat then 2.5 mg/kg on d2 & d3",
    route: "IV / IM / PO",
    frequency: "Daily for 3 days",
    source: "User Sheet / WHO Guidelines",
    indications: ["Severe malaria (IV/IM first line)", "Uncomplicated malaria (Oral)"],
    calculateDose: (w: number) => {
      const ivDose = w * 4;
      const poLoad = w * 5;
      const poMaint = w * 2.5;
      return {
        doseValue: `IV/IM: ${ivDose.toFixed(1)} mg, Oral Load: ${poLoad.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `IV/IM Regimen (4 mg/kg/day): ${ivDose.toFixed(1)} mg IV/IM once daily for 3 days\nOral Regimen Loading (5 mg/kg): ${poLoad.toFixed(1)} mg PO once on Day 1\nOral Regimen Maintenance (2.5 mg/kg): ${poMaint.toFixed(1)} mg PO daily on Days 2 & 3`,
        notes: "IV formulation must be reconstituted with sodium bicarbonate first, then diluted with NS or D5W."
      };
    }
  },
  {
    id: "chloroquine",
    name: "Chloroquine Phosphate",
    category: "Anti-Malarial",
    standardDose: "Oral: 10 mg/kg base then 5 mg/kg at 6h, 24h, 48h. IV: 5 mg/kg 12hly",
    route: "PO / IV",
    frequency: "Schedule-dependent",
    source: "User Sheet",
    indications: ["Plasmodium vivax malaria", "Prophylaxis of malaria"],
    calculateDose: (w: number) => {
      const load = w * 10;
      const maint = w * 5;
      const weekly = w * 5;
      const ivDose = w * 5;
      return {
        doseValue: `Oral Load: ${load.toFixed(1)} mg, Oral Maint: ${maint.toFixed(1)} mg, IV: ${ivDose.toFixed(1)} mg`,
        unit: "mg chloroquine base",
        breakdown: `Oral Acute Course:\n- Loading Dose: ${load.toFixed(1)} mg PO\n- Followed by: ${maint.toFixed(1)} mg PO at 6 hours, 24 hours, and 48 hours\nProphylaxis Dose (5 mg/kg once weekly): ${weekly.toFixed(1)} mg PO weekly\nIV Infusion (5 mg/kg 12hly): ${ivDose.toFixed(1)} mg IV Q12H diluted in 10ml NS/D5 and run slowly over 2-4 hours (Max cumulative 25 mg/kg)`,
        notes: "WARNING: Rapid IV injection causes severe cardiotoxicity, hypotension, and respiratory arrest. Give oral if tolerated."
      };
    }
  },
  {
    id: "mefloquine",
    name: "Mefloquine Hcl",
    category: "Anti-Malarial",
    standardDose: "15 mg/kg single dose, then 10 mg/kg 24hrs later",
    route: "PO",
    frequency: "Two-step course",
    source: "User Sheet",
    indications: ["MDR Falciparum malaria treatment and prophylaxis"],
    calculateDose: (w: number) => {
      const dose1 = w * 15;
      const dose2 = w * 10;
      return {
        doseValue: `Dose 1: ${dose1.toFixed(0)} mg PO, Dose 2: ${dose2.toFixed(0)} mg PO`,
        unit: "mg",
        breakdown: `First Dose (15 mg/kg): ${dose1.toFixed(1)} mg PO once\nSecond Dose (10 mg/kg, given 24 hours after dose 1): ${dose2.toFixed(1)} mg PO once`,
        notes: "Contraindicated in patients with active depression, anxiety disorders, schizophrenia, or history of seizures."
      };
    }
  },
  {
    id: "primaquine",
    name: "Primaquine",
    category: "Anti-Malarial",
    standardDose: "0.3 mg/kg/day for 5-14 days",
    route: "PO",
    frequency: "Daily",
    source: "User Sheet",
    indications: ["Radical cure of P. vivax/ovale (prevents relapse)"],
    calculateDose: (w: number) => {
      const daily = w * 0.3;
      return {
        doseValue: `${daily.toFixed(1)} mg`,
        unit: "mg primaquine base",
        breakdown: `Standard Daily Dose (0.3 mg/kg/day): ${daily.toFixed(1)} mg PO once daily for 5-14 days`,
        notes: "CRITICAL: Check G6PD level before initiating therapy due to high risk of severe hemolytic anemia."
      };
    }
  },
  {
    id: "pyrimethamine-sulfadoxine",
    name: "Pyrimethamine + Sulfadoxine",
    genericName: "Fansidar",
    category: "Anti-Malarial",
    standardDose: "Pyrimethamine: 1 mg/kg, Sulfadoxine: 20 mg/kg Orally",
    route: "PO",
    frequency: "Single dose",
    source: "User Sheet",
    indications: ["Falciparum malaria treatment (combination therapy)"],
    calculateDose: (w: number) => {
      const py = w * 1;
      const sd = w * 20;
      return {
        doseValue: `Py: ${py.toFixed(1)} mg, Sd: ${sd.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Standard Single Oral Dose (Pyrimethamine 1 mg/kg + Sulfadoxine 20 mg/kg): pyrimethamine ${py.toFixed(1)} mg and sulfadoxine ${sd.toFixed(1)} mg PO once`,
        notes: "Contraindicated in patients with sulfa allergy or severe renal/hepatic impairment."
      };
    }
  },
  {
    id: "quinine-hcl",
    name: "Quinine Hcl",
    category: "Anti-Malarial",
    standardDose: "LD: 20 mg/kg over 4h, then MD: 10 mg/kg 8hly over 4h",
    route: "IV Infusion",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Severe falciparum malaria"],
    calculateDose: (w: number) => {
      const load = w * 20;
      const maint = w * 10;
      return {
        doseValue: `Load: ${load.toFixed(0)} mg IV, Maint: ${maint.toFixed(0)} mg IV Q8H`,
        unit: "mg salt",
        breakdown: `Loading Dose (20 mg/kg): ${load.toFixed(1)} mg IV infused over 4 hours (diluted to a concentration of 1 mg/mL in NS or D5)\nMaintenance Dose (10 mg/kg): ${maint.toFixed(1)} mg IV infused over 4 hours Q8H`,
        notes: "Monitor EKG (QT interval), blood glucose (severe hypoglycemia risk), and blood pressure. Avoid rapid bolus."
      };
    }
  },
  {
    id: "quinine-sulfate",
    name: "Quinine Sulfate",
    category: "Anti-Malarial",
    standardDose: "25-30 mg/kg/day divided 8hly for 7 days",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Uncomplicated falciparum malaria (oral phase)"],
    calculateDose: (w: number) => {
      const minDaily = w * 25;
      const maxDaily = w * 30;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(0)} to ${maxDaily.toFixed(0)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H for 7 days`,
        notes: "Can cause cinchonism (tinnitus, headache, nausea, visual changes). Administer with food."
      };
    }
  },

  // Anti-Protozoal
  {
    id: "metronidazole",
    name: "Metronidazole",
    genericName: "Flagyl",
    category: "Anti-Protozoal",
    standardDose: "15-30 mg/kg/day divided 8hly",
    route: "PO / IV",
    frequency: "8hly",
    source: "Harriet Lane",
    indications: ["Amebiasis", "Giardiasis", "Anaerobic infections", "Clostridium difficile"],
    calculateDose: (w: number) => {
      const minDaily = w * 15;
      const maxDaily = w * 30;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO/IV Q8H`,
        notes: "Can cause metallic taste and nausea. Do not take with alcohol (disulfiram-like reaction)."
      };
    }
  },

  // Anti-Helmintics
  {
    id: "albendazole",
    name: "Albendazole",
    category: "Anti-Helmintics",
    standardDose: "1-2yrs: 200mg, >2yrs: 400mg, Neurocysticercosis: 15 mg/kg/day BD",
    route: "PO",
    frequency: "Single dose or 12hly",
    source: "User Sheet",
    indications: ["Intestinal worms", "Hydatid disease", "Neurocysticercosis"],
    calculateDose: (w: number) => {
      const ncDaily = w * 15;
      const ncDose = ncDaily / 2;
      return {
        doseValue: `Worms: 200-400 mg, NCC: ${ncDose.toFixed(1)} mg BD`,
        unit: "mg",
        breakdown: `Intestinal Worm Deworming:\n- Age 1-2 years: 200 mg PO single dose\n- Age >2 years: 400 mg PO single dose\nHydatid Disease: 400 mg PO BD for 28 days\nNeurocysticercosis (15 mg/kg/day divided 12hly): ${ncDose.toFixed(1)} mg PO BD for 7-28 days`,
        notes: "Take with high-fat meals to improve systemic absorption in tissue infections (hydatid, cysticercosis)."
      };
    }
  },
  {
    id: "diethylcarbamazine",
    name: "Diethylcarbamazine Citrate",
    genericName: "Banocide",
    category: "Anti-Helmintics",
    standardDose: "10 mg/kg/day divided 8hly PO",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Lymphatic filariasis", "Tropical pulmonary eosinophilia"],
    calculateDose: (w: number) => {
      const daily = w * 10;
      const dose = daily / 3;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${daily.toFixed(1)} mg/day\nSingle Dose (8hly): ${dose.toFixed(1)} mg PO Q8H`,
        notes: "Can cause mild fever, headache, and allergic reactions due to microfilarial death."
      };
    }
  },
  {
    id: "mebendazole",
    name: "Mebendazole",
    genericName: "Wormin",
    category: "Anti-Helmintics",
    standardDose: "100 mg BD for 3 days, Hydatid: 30 mg/kg/day 8hly",
    route: "PO",
    frequency: "12hly or 8hly",
    source: "User Sheet",
    indications: ["Intestinal worm infections", "Hydatid cyst disease"],
    calculateDose: (w: number) => {
      const hyDaily = w * 30;
      const hyDose = hyDaily / 3;
      return {
        doseValue: `Std: 100 mg BD, Hydatid: ${hyDose.toFixed(0)} mg 8hly`,
        unit: "mg",
        breakdown: `Standard Deworming Dose: 100 mg PO twice daily for 3 days (or 500 mg single dose)\nHydatid Cyst Dose (30 mg/kg/day divided 8hly): ${hyDose.toFixed(1)} mg PO Q8H`,
        notes: "Contraindicated in children under 1 year. Chewable tablets can be crushed and mixed with food."
      };
    }
  },

  // Anti-Viral
  {
    id: "acyclovir",
    name: "Acyclovir",
    category: "Anti-Viral",
    standardDose: "Varicella: 80 mg/kg/day divided 6hly for 5 days",
    route: "PO / IV",
    frequency: "6hly",
    source: "User Sheet",
    indications: ["Varicella (Chickenpox)", "Herpes simplex encephalitis (IV)", "Mucocutaneous HSV"],
    calculateDose: (w: number) => {
      const varicellaDaily = w * 80;
      const varicellaDose = varicellaDaily / 4;
      return {
        doseValue: `Varicella: ${varicellaDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Varicella Oral Dose (80 mg/kg/day divided Q6H): ${varicellaDose.toFixed(1)} mg PO Q6H for 5 days\n(Neonatal/HSV encephalitis IV dose is typically 20 mg/kg/dose IV Q8H)`,
        notes: "Ensure adequate hydration to prevent crystalluria and renal toxicity. Administer IV dose over 1 hour."
      };
    }
  }
];
