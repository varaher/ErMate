import { PediatricDrug } from "./pediatricDrugs_types";

export const ANTIBIOTICS_DRUGS: PediatricDrug[] = [
  // Antibiotics - Penicillins
  {
    id: "amoxicillin",
    name: "Amoxicillin",
    category: "Antibiotics - Penicillins",
    standardDose: "25-50 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Otitis media", "Pneumonia", "Sinusitis", "Tonsillitis"],
    calculateDose: (w: number) => {
      const minDaily = w * 25;
      const maxDaily = w * 50;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H`,
        notes: "Give with or without food. Double dose (80-90 mg/kg/day) for resistant S. pneumoniae in acute otitis media."
      };
    }
  },
  {
    id: "amoxicillin-clavulanic",
    name: "Amoxicillin + Clavulanic Acid",
    genericName: "Augmentin / Co-Amoxiclav",
    category: "Antibiotics - Penicillins",
    standardDose: "Oral: 20-40 mg/kg/day 12hly, IV: 50-100 mg/kg/day 8hly",
    route: "PO / IV",
    frequency: "12hly (Oral) or 8hly (IV)",
    source: "User Sheet",
    indications: ["Bacterial sinusitis", "Otitis media", "Lower respiratory tract infections", "Bite wounds"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 20;
      const poDailyMax = w * 40;
      const poDoseMin = poDailyMin / 2;
      const poDoseMax = poDailyMax / 2;
      const ivDailyMin = w * 50;
      const ivDailyMax = w * 100;
      const ivDoseMin = ivDailyMin / 3;
      const ivDoseMax = ivDailyMax / 3;
      return {
        doseValue: `PO: ${poDoseMin.toFixed(1)}-${poDoseMax.toFixed(1)} mg, IV: ${ivDoseMin.toFixed(1)}-${ivDoseMax.toFixed(1)} mg`,
        unit: "mg amoxicillin component",
        breakdown: `Oral Dose (20-40 mg/kg/day divided 12hly): ${poDoseMin.toFixed(1)} to ${poDoseMax.toFixed(1)} mg PO BD\nIV Dose (50-100 mg/kg/day divided 8hly): ${ivDoseMin.toFixed(1)} to ${ivDoseMax.toFixed(1)} mg IV Q8H`,
        notes: "Doses based on amoxicillin component. Give at start of a meal to reduce GI discomfort."
      };
    }
  },
  {
    id: "ampicillin",
    name: "Ampicillin Na",
    category: "Antibiotics - Penicillins",
    standardDose: "100-200 mg/kg/day divided 8hly",
    route: "PO / IV / IM",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Neonatal sepsis", "Meningitis", "Community acquired pneumonia"],
    calculateDose: (w: number) => {
      const minDaily = w * 100;
      const maxDaily = w * 200;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg IV/IM/PO Q8H`,
        notes: "For meningitis, can use high range (200-300 mg/kg/day divided Q6H IV). Administer over 15-30 minutes IV."
      };
    }
  },
  {
    id: "cloxacillin",
    name: "Cloxacillin",
    category: "Antibiotics - Penicillins",
    standardDose: "50-100 mg/kg/day 8hly, Meningitis: 200 mg/kg/day 8hly",
    route: "PO / IV",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Staphylococcal skin/soft tissue infections", "Osteomyelitis", "Meningitis"],
    calculateDose: (w: number) => {
      const stdDailyMin = w * 50;
      const stdDailyMax = w * 100;
      const stdDoseMin = stdDailyMin / 3;
      const stdDoseMax = stdDailyMax / 3;
      const menDaily = w * 200;
      const menDose = menDaily / 3;
      return {
        doseValue: `Std: ${stdDoseMin.toFixed(0)}-${stdDoseMax.toFixed(0)} mg, Men: ${menDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Std Dose (50-100 mg/kg/day divided 8hly): ${stdDoseMin.toFixed(1)} to ${stdDoseMax.toFixed(1)} mg PO/IV Q8H\nMeningitis Dose (200 mg/kg/day divided 8hly): ${menDose.toFixed(1)} mg IV Q8H`,
        notes: "Administer oral doses on empty stomach (1 hour before or 2 hours after food)."
      };
    }
  },
  {
    id: "penicillin-g-benzathine",
    name: "Penicillin G Benzathine",
    category: "Antibiotics - Penicillins",
    standardDose: "<6yrs: 0.6 mega units, >6yrs: 1.2 mega units IM",
    route: "IM",
    frequency: "Weekly or every 3-4 weeks",
    source: "User Sheet",
    indications: ["Rheumatic fever prophylaxis", "Streptococcal pharyngitis", "Congenital syphilis"],
    calculateDose: (w: number) => {
      return {
        doseValue: `<6 yrs: 0.6 MU, >6 yrs: 1.2 MU`,
        unit: "Mega Units (MU)",
        breakdown: `Children < 6 years: 0.6 Mega Units IM once\nChildren >= 6 years: 1.2 Mega Units IM once\n(Often given every 3 to 4 weeks for Rheumatic fever secondary prevention)`,
        notes: "CRITICAL: Intramuscular use ONLY. Never inject intravenously (risk of cardiac arrest and tissue necrosis)."
      };
    }
  },

  // Antibiotics - Cephalosporins
  {
    id: "cefprozil",
    name: "Cefprozil",
    category: "Antibiotics - Cephalosporins",
    standardDose: "15-30 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Pharyngitis", "Tonsillitis", "Skin structure infections", "Otitis media"],
    calculateDose: (w: number) => {
      const minDaily = w * 15;
      const maxDaily = w * 30;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO BD`,
        notes: "Second-generation cephalosporin. Well-tolerated oral suspension."
      };
    }
  },
  {
    id: "cefixime",
    name: "Cefixime",
    category: "Antibiotics - Cephalosporins",
    standardDose: "8 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Uncomplicated UTI", "Otitis media", "Typhoid fever", "Tonsillitis"],
    calculateDose: (w: number) => {
      const daily = w * 8;
      const dose = daily / 2;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${daily.toFixed(1)} mg/day\nSingle Dose (12hly): ${dose.toFixed(1)} mg PO BD`,
        notes: "Third-generation cephalosporin. Safe and effective oral agent."
      };
    }
  },
  {
    id: "cefoperazone",
    name: "Cefoperazone",
    category: "Antibiotics - Cephalosporins",
    standardDose: "50-200 mg/kg/day divided 12hly",
    route: "IV / IM",
    frequency: "12hly",
    source: "User Sheet",
    indications: ["Severe systemic infections", "Pseudomonal infections", "Peritonitis"],
    calculateDose: (w: number) => {
      const minDaily = w * 50;
      const maxDaily = w * 200;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(0)}-${maxDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(0)} to ${maxDaily.toFixed(0)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg IV/IM BD`,
        notes: "Excreted mainly in bile. Reduce dose in hepatic impairment."
      };
    }
  },
  {
    id: "cefotaxime",
    name: "Cefotaxime Na",
    category: "Antibiotics - Cephalosporins",
    standardDose: "100-150 mg/kg/day divided 8hly",
    route: "IV / IM",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Bacterial meningitis", "Neonatal sepsis", "Pneumonia", "Joint infections"],
    calculateDose: (w: number) => {
      const minDaily = w * 100;
      const maxDaily = w * 150;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(0)}-${maxDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(0)} to ${maxDaily.toFixed(0)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg IV/IM Q8H`,
        notes: "For meningitis, can use high range (200 mg/kg/day divided Q6-8H IV)."
      };
    }
  },
  {
    id: "cefpirome",
    name: "Cefpirome",
    category: "Antibiotics - Cephalosporins",
    standardDose: "30-60 mg/kg/day divided 12hly",
    route: "IV",
    frequency: "12hly",
    source: "User Sheet",
    indications: ["Complicated UTIs", "Septicemia", "Lower respiratory infections"],
    calculateDose: (w: number) => {
      const minDaily = w * 30;
      const maxDaily = w * 60;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg IV BD`,
        notes: "Fourth-generation cephalosporin. Reserve for resistant infections."
      };
    }
  },
  {
    id: "cefpodoxime",
    name: "Cefpodoxime",
    category: "Antibiotics - Cephalosporins",
    standardDose: "8-10 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Tonsillitis/Pharyngitis", "Community-acquired pneumonia", "Otitis media"],
    calculateDose: (w: number) => {
      const minDaily = w * 8;
      const maxDaily = w * 10;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO BD`,
        notes: "Administer with food to enhance absorption of oral suspension/tablet."
      };
    }
  },
  {
    id: "ceftazidime",
    name: "Ceftazidime",
    category: "Antibiotics - Cephalosporins",
    standardDose: "100-150 mg/kg/day divided 8hly",
    route: "IV / IM",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Pseudomonas aeruginosa infections", "Febrile neutropenia", "Cystic fibrosis pulmonary exacerbation"],
    calculateDose: (w: number) => {
      const minDaily = w * 100;
      const maxDaily = w * 150;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(0)}-${maxDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(0)} to ${maxDaily.toFixed(0)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg IV/IM Q8H`,
        notes: "Active against Pseudomonas. Monitor renal function in neonates."
      };
    }
  },
  {
    id: "ceftibuten",
    name: "Ceftibuten",
    category: "Antibiotics - Cephalosporins",
    standardDose: "9 mg/kg/day single dose",
    route: "PO",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Acute otitis media", "Pharyngitis", "Tonsillitis"],
    calculateDose: (w: number) => {
      const daily = w * 9;
      return {
        doseValue: `${daily.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (9 mg/kg/day): ${daily.toFixed(1)} mg PO once daily`,
        notes: "Excellent compliance due to once daily dosing. Well tolerated."
      };
    }
  },
  {
    id: "ceftizoxime",
    name: "Ceftizoxime",
    category: "Antibiotics - Cephalosporins",
    standardDose: "100-150 mg/kg/day divided 8hly",
    route: "IV / IM",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Pelvic inflammatory disease", "Meningitis", "Lower respiratory infections"],
    calculateDose: (w: number) => {
      const minDaily = w * 100;
      const maxDaily = w * 150;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(0)}-${maxDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(0)} to ${maxDaily.toFixed(0)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg IV/IM Q8H`,
        notes: "Third-generation cephalosporin. High CSF penetration."
      };
    }
  },
  {
    id: "ceftriaxone",
    name: "Ceftriaxone",
    category: "Antibiotics - Cephalosporins",
    standardDose: "50-75 mg/kg/day divided 12hly, Meningitis: 100 mg/kg/day IV",
    route: "IV / IM",
    frequency: "12-24hly",
    source: "User Sheet",
    indications: ["Severe sepsis", "Meningitis", "Typhoid fever", "Gonococcal ophthalmia"],
    calculateDose: (w: number) => {
      const stdDailyMin = w * 50;
      const stdDailyMax = w * 75;
      const stdDoseMin = stdDailyMin / 2;
      const stdDoseMax = stdDailyMax / 2;
      const menDaily = w * 100;
      const menDose = menDaily / 2; // can be divided Q12H or given OD
      return {
        doseValue: `Std: ${stdDoseMin.toFixed(1)}-${stdDoseMax.toFixed(1)} mg BD, Men: ${menDose.toFixed(1)} mg BD`,
        unit: "mg",
        breakdown: `Std Dose (50-75 mg/kg/day divided 12hly): ${stdDoseMin.toFixed(1)} to ${stdDoseMax.toFixed(1)} mg IV/IM BD\nMeningitis Dose (100 mg/kg/day divided 12hly): ${menDose.toFixed(1)} mg IV/IM BD (or given as single daily dose of ${menDaily.toFixed(1)} mg)`,
        notes: "Avoid in neonates with hyperbilirubinemia or co-administration with IV calcium due to risk of precipitation."
      };
    }
  },
  {
    id: "cefuroxime",
    name: "Cefuroxime Axetil",
    category: "Antibiotics - Cephalosporins",
    standardDose: "Oral: 20-30 mg/kg/day 12hly, IV: 50-100 mg/kg/day 12hly",
    route: "PO / IV / IM",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Lyme disease", "Otitis media", "Pneumonia", "Surgical prophylaxis"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 20;
      const poDailyMax = w * 30;
      const poDoseMin = poDailyMin / 2;
      const poDoseMax = poDailyMax / 2;
      const ivDailyMin = w * 50;
      const ivDailyMax = w * 100;
      const ivDoseMin = ivDailyMin / 2;
      const ivDoseMax = ivDailyMax / 2;
      return {
        doseValue: `PO: ${poDoseMin.toFixed(1)}-${poDoseMax.toFixed(1)} mg, IV: ${ivDoseMin.toFixed(1)}-${ivDoseMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (20-30 mg/kg/day divided 12hly): ${poDoseMin.toFixed(1)} to ${poDoseMax.toFixed(1)} mg PO BD\nIV/IM Dose (50-100 mg/kg/day divided 12hly): ${ivDoseMin.toFixed(1)} to ${ivDoseMax.toFixed(1)} mg IV/IM BD`,
        notes: "Oral suspension should be administered with food to maximize systemic absorption."
      };
    }
  },
  {
    id: "cephalexin",
    name: "Cephalexin",
    category: "Antibiotics - Cephalosporins",
    standardDose: "25-50 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Streptococcal pharyngitis", "UTI prophylaxis", "Uncomplicated skin infections"],
    calculateDose: (w: number) => {
      const minDaily = w * 25;
      const maxDaily = w * 50;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H`,
        notes: "First-generation cephalosporin. Safe and well-tolerated. May cause mild diarrhea."
      };
    }
  },

  // Antibiotics - Fluoroquinolones
  {
    id: "ciprofloxacin",
    name: "Ciprofloxacin",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "Oral: 20-30 mg/kg/day 12hly, IV: 10-20 mg/kg/day 12hly",
    route: "PO / IV",
    frequency: "12hly",
    source: "User Sheet",
    indications: ["Complicated UTIs", "Typhoid fever", "Pseudomonas infections", "Shigellosis"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 20;
      const poDailyMax = w * 30;
      const poDoseMin = poDailyMin / 2;
      const poDoseMax = poDailyMax / 2;
      const ivDailyMin = w * 10;
      const ivDailyMax = w * 20;
      const ivDoseMin = ivDailyMin / 2;
      const ivDoseMax = ivDailyMax / 2;
      return {
        doseValue: `PO: ${poDoseMin.toFixed(1)}-${poDoseMax.toFixed(1)} mg, IV: ${ivDoseMin.toFixed(1)}-${ivDoseMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (20-30 mg/kg/day divided 12hly): ${poDoseMin.toFixed(1)} to ${poDoseMax.toFixed(1)} mg PO BD\nIV Dose (10-20 mg/kg/day divided 12hly): ${ivDoseMin.toFixed(1)} to ${ivDoseMax.toFixed(1)} mg IV BD`,
        notes: "Fluoroquinolones should be used as second-line therapy in children due to potential cartilage damage risks."
      };
    }
  },
  {
    id: "gatifloxacin",
    name: "Gatifloxacin",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "10 mg/kg/day single dose",
    route: "PO",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Community-acquired pneumonia", "Acute sinusitis", "UTIs"],
    calculateDose: (w: number) => {
      const daily = w * 10;
      return {
        doseValue: `${daily.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (10 mg/kg/day): ${daily.toFixed(1)} mg PO once daily`,
        notes: "Avoid in patients with diabetes as it can cause significant hypo/hyperglycemia."
      };
    }
  },
  {
    id: "levofloxacin",
    name: "Levofloxacin",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "10-15 mg/kg/day single dose",
    route: "PO / IV",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Atypical pneumonia", "Multi-drug resistant tuberculosis", "Inhalational anthrax"],
    calculateDose: (w: number) => {
      const minDaily = w * 10;
      const maxDaily = w * 15;
      return {
        doseValue: `${minDaily.toFixed(1)}-${maxDaily.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose range (10-15 mg/kg/day): ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg PO/IV once daily`,
        notes: "If age < 5 years, may require divided BD dosing due to faster clearance."
      };
    }
  },
  {
    id: "nalidixic-acid",
    name: "Nalidixic Acid",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "50 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Uncomplicated urinary tract infections", "Shigellosis dysentery"],
    calculateDose: (w: number) => {
      const daily = w * 50;
      const dose = daily / 3;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${daily.toFixed(1)} mg/day\nSingle Dose (8hly): ${dose.toFixed(1)} mg PO Q8H`,
        notes: "First-generation quinolone. Do not use in infants under 3 months. Can cause photosensitivity."
      };
    }
  },
  {
    id: "norfloxacin",
    name: "Norfloxacin",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "10-15 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Gastroenteritis", "UTI", "Shigella enteritis"],
    calculateDose: (w: number) => {
      const minDaily = w * 10;
      const maxDaily = w * 15;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO BD`,
        notes: "Drink plenty of water to prevent crystalluria. Administer 1 hour before or 2 hours after milk/meals."
      };
    }
  },
  {
    id: "ofloxacin",
    name: "Ofloxacin",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "Oral: 15 mg/kg/day 12hly, IV: 5-10 mg/kg/day 12hly",
    route: "PO / IV",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Typhoid fever", "Lower respiratory infections", "Dysentery"],
    calculateDose: (w: number) => {
      const poDaily = w * 15;
      const poDose = poDaily / 2;
      const ivDailyMin = w * 5;
      const ivDailyMax = w * 10;
      const ivDoseMin = ivDailyMin / 2;
      const ivDoseMax = ivDailyMax / 2;
      return {
        doseValue: `PO: ${poDose.toFixed(1)} mg, IV: ${ivDoseMin.toFixed(1)}-${ivDoseMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (15 mg/kg/day divided 12hly): ${poDose.toFixed(1)} mg PO BD\nIV Dose (5-10 mg/kg/day divided 12hly): ${ivDoseMin.toFixed(1)} to ${ivDoseMax.toFixed(1)} mg IV BD`,
        notes: "Ensure patient is well hydrated. Monitor joint health."
      };
    }
  },
  {
    id: "pefloxacin",
    name: "Pefloxacin",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "12 mg/kg/day divided 12hly",
    route: "PO / IV",
    frequency: "12hly",
    source: "User Sheet",
    indications: ["Severe systemic Gram-negative infections", "Typhoid fever"],
    calculateDose: (w: number) => {
      const daily = w * 12;
      const dose = daily / 2;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${daily.toFixed(1)} mg/day\nSingle Dose (12hly): ${dose.toFixed(1)} mg PO/IV BD`,
        notes: "Can cause severe tendinitis. Contraindicated in children if alternative antibiotics are available."
      };
    }
  },
  {
    id: "sparfloxacin",
    name: "Suprafloxacin (Sparfloxacin)",
    category: "Antibiotics - Fluoroquinolones",
    standardDose: "4 mg/kg/day single dose",
    route: "PO",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Respiratory tract infections", "Sinusitis"],
    calculateDose: (w: number) => {
      const daily = w * 4;
      return {
        doseValue: `${daily.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (4 mg/kg/day): ${daily.toFixed(1)} mg PO once daily`,
        notes: "Has a long half-life. High risk of phototoxicity; advise patients to avoid sun exposure."
      };
    }
  },

  // Antibiotics - Others
  {
    id: "clindamycin",
    name: "Clindamycin",
    category: "Antibiotics - Others",
    standardDose: "Oral: 20-30 mg/kg/day BD, IV: 20-40 mg/kg/day BD",
    route: "PO / IV / IM",
    frequency: "12hly (BD) or 8hly",
    source: "User Sheet",
    indications: ["MRSA infections", "Anaerobic infections", "Osteomyelitis", "Streptococcal toxic shock"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 20;
      const poDailyMax = w * 30;
      const poDoseMin = poDailyMin / 2;
      const poDoseMax = poDailyMax / 2;
      const ivDailyMin = w * 20;
      const ivDailyMax = w * 40;
      const ivDoseMin = ivDailyMin / 2;
      const ivDoseMax = ivDailyMax / 2;
      return {
        doseValue: `PO: ${poDoseMin.toFixed(1)}-${poDoseMax.toFixed(1)} mg, IV: ${ivDoseMin.toFixed(1)}-${ivDoseMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (20-30 mg/kg/day divided 12hly): ${poDoseMin.toFixed(1)} to ${poDoseMax.toFixed(1)} mg PO BD\nIV Dose (20-40 mg/kg/day divided 12hly): ${ivDoseMin.toFixed(1)} to ${ivDoseMax.toFixed(1)} mg IV BD`,
        notes: "Risk of Pseudomembranous Colitis (C. difficile). Stop therapy if severe diarrhea occurs."
      };
    }
  },
  {
    id: "azithromycin",
    name: "Azithromycin",
    category: "Antibiotics - Macrolides",
    standardDose: "10 mg/kg/day single dose",
    route: "PO",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Atypical pneumonia", "Chlamydia", "Pertussis", "Tonsillitis"],
    calculateDose: (w: number) => {
      const daily = w * 10;
      return {
        doseValue: `${daily.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Dose (10 mg/kg/day): ${daily.toFixed(1)} mg PO once daily (usually for 3-5 days)`,
        notes: "Long tissue half-life. Give 1 hour before or 2 hours after meals."
      };
    }
  },
  {
    id: "clarithromycin",
    name: "Clarithromycin",
    category: "Antibiotics - Macrolides",
    standardDose: "15 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Atypical pneumonia", "Pertussis", "H. pylori eradication", "Pharyngitis"],
    calculateDose: (w: number) => {
      const daily = w * 15;
      const dose = daily / 2;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily total: ${daily.toFixed(1)} mg/day\nSingle Dose (12hly): ${dose.toFixed(1)} mg PO BD`,
        notes: "Can cause taste perversion and mild GI upset. Swallow tablets whole or use suspension."
      };
    }
  },
  {
    id: "erythromycin",
    name: "Erythromycin",
    category: "Antibiotics - Macrolides",
    standardDose: "Oral: 30-50 mg/kg/day 8hly, IV: 5 mg/kg/dose 8hly",
    route: "PO / IV",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Pertussis", "Campylobacter gastroenteritis", "Chlamydial conjunctivitis of newborn"],
    calculateDose: (w: number) => {
      const poDailyMin = w * 30;
      const poDailyMax = w * 50;
      const poDoseMin = poDailyMin / 3;
      const poDoseMax = poDailyMax / 3;
      const ivDose = w * 5;
      return {
        doseValue: `PO: ${poDoseMin.toFixed(1)}-${poDoseMax.toFixed(1)} mg, IV: ${ivDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Oral Dose (30-50 mg/kg/day divided 8hly): ${poDoseMin.toFixed(1)} to ${poDoseMax.toFixed(1)} mg PO Q8H\nIV Dose (5 mg/kg/dose): ${ivDose.toFixed(1)} mg IV Q8H`,
        notes: "Powerful GI prokinetic effects. IV administration must be slow over 60 minutes to prevent thrombophlebitis."
      };
    }
  },
  {
    id: "roxithromycin",
    name: "Roxithromycin",
    category: "Antibiotics - Macrolides",
    standardDose: "5-8 mg/kg/day divided 12hly",
    route: "PO",
    frequency: "12hly (BD)",
    source: "User Sheet",
    indications: ["Pharyngitis", "Bronchitis", "Skin and soft tissue infections"],
    calculateDose: (w: number) => {
      const minDaily = w * 5;
      const maxDaily = w * 8;
      const minDose = minDaily / 2;
      const maxDose = maxDaily / 2;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (12hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO BD`,
        notes: "Give at least 15 minutes before food. Less drug interaction potential than erythromycin."
      };
    }
  },
  {
    id: "tetracycline",
    name: "Tetracycline Hcl",
    category: "Antibiotics - Others",
    standardDose: "25-50 mg/kg/day divided 8hly",
    route: "PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["Rickettsial infections (Rocky Mountain spotted fever)", "Mycoplasma", "Acne vulgaris"],
    calculateDose: (w: number) => {
      const minDaily = w * 25;
      const maxDaily = w * 50;
      const minDose = minDaily / 3;
      const maxDose = maxDaily / 3;
      return {
        doseValue: `${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily range: ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg/day\nSingle Dose (8hly): ${minDose.toFixed(1)} to ${maxDose.toFixed(1)} mg PO Q8H`,
        notes: "WARNING: Avoid in children < 8 years due to permanent tooth staining and bone growth deceleration."
      };
    }
  },
  {
    id: "vancomycin",
    name: "Vancomycin Hcl",
    category: "Antibiotics - Others",
    standardDose: "40 mg/kg/day 8hly, CNS: 60 mg/kg/day 8hly, Colitis PO: 40-50 mg/kg/day 8hly",
    route: "IV / PO",
    frequency: "8hly",
    source: "User Sheet",
    indications: ["MRSA sepsis", "Pneumococcal meningitis (resistant)", "C. difficile colitis (Oral)"],
    calculateDose: (w: number) => {
      const stdDaily = w * 40;
      const stdDose = stdDaily / 3;
      const cnsDaily = w * 60;
      const cnsDose = cnsDaily / 3;
      const poDailyMin = w * 40;
      const poDailyMax = w * 50;
      const poDoseMin = poDailyMin / 3;
      const poDoseMax = poDailyMax / 3;
      return {
        doseValue: `IV: ${stdDose.toFixed(1)} mg, CNS: ${cnsDose.toFixed(1)} mg, Oral: ${poDoseMin.toFixed(1)}-${poDoseMax.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Std IV Dose (40 mg/kg/day Q8H): ${stdDose.toFixed(1)} mg IV Q8H\nCNS/Meningitis IV (60 mg/kg/day Q8H): ${cnsDose.toFixed(1)} mg IV Q8H\nPseudomembranous Colitis Oral (40-50 mg/kg/day Q8H): ${poDoseMin.toFixed(1)} to ${poDoseMax.toFixed(1)} mg PO Q8H`,
        notes: "IV: Infuse slowly over 60 minutes or more to prevent 'Red Man Syndrome'. Monitor serum trough levels."
      };
    }
  },

  // Anti-Leprosy
  {
    id: "dapsone",
    name: "Dapsone (Diamino diphenyl Sulphone)",
    category: "Anti-Leprosy",
    standardDose: "1-2 mg/kg/day single dose",
    route: "PO",
    frequency: "Daily (OD)",
    source: "User Sheet",
    indications: ["Leprosy (paucibacillary and multibacillary)", "Pneumocystis pneumonia prophylaxis", "Dermatitis herpetiformis"],
    calculateDose: (w: number) => {
      const minDaily = w * 1;
      const maxDaily = w * 2;
      return {
        doseValue: `${minDaily.toFixed(1)}-${maxDaily.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Standard Daily Dose range (1-2 mg/kg/day): ${minDaily.toFixed(1)} to ${maxDaily.toFixed(1)} mg PO once daily`,
        notes: "Check G6PD status before starting therapy due to significant risk of severe hemolytic anemia."
      };
    }
  }
];
