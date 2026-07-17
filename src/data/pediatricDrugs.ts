export interface PediatricDrug {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  standardDose: string;
  route: string;
  frequency: string;
  maxDose?: string;
  source: string;
  indications?: string[];
  calculateDose?: (weight: number) => {
    doseValue: string;
    unit: string;
    breakdown?: string;
    notes?: string;
  };
}

export interface DrugCategory {
  id: string;
  name: string;
  iconName: string; // lucide icon name
  colorClass: string; // tailwind color configuration
  bgClass: string;
}

export const DRUG_CATEGORIES: DrugCategory[] = [
  {
    id: "analgesics",
    name: "Analgesics & Antipyretics",
    iconName: "Thermometer",
    colorClass: "text-rose-500",
    bgClass: "bg-rose-500/10 dark:bg-rose-950/20"
  },
  {
    id: "antibiotics-aminoglycosides",
    name: "Antibiotics - Aminoglycosides",
    iconName: "Shield",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10 dark:bg-blue-950/20"
  },
  {
    id: "antibiotics-cephalosporins",
    name: "Antibiotics - Cephalosporins",
    iconName: "Shield",
    colorClass: "text-blue-400",
    bgClass: "bg-blue-400/10 dark:bg-blue-950/20"
  },
  {
    id: "antibiotics-fluoroquinolones",
    name: "Antibiotics - Fluoroquinolones",
    iconName: "Shield",
    colorClass: "text-indigo-500",
    bgClass: "bg-indigo-500/10 dark:bg-indigo-950/20"
  },
  {
    id: "antibiotics-macrolides",
    name: "Antibiotics - Macrolides",
    iconName: "Shield",
    colorClass: "text-cyan-500",
    bgClass: "bg-cyan-500/10 dark:bg-cyan-950/20"
  },
  {
    id: "antibiotics-penicillins",
    name: "Antibiotics - Penicillins",
    iconName: "Shield",
    colorClass: "text-sky-500",
    bgClass: "bg-sky-500/10 dark:bg-sky-950/20"
  },
  {
    id: "antibiotics-others",
    name: "Antibiotics - Others",
    iconName: "Shield",
    colorClass: "text-slate-500",
    bgClass: "bg-slate-500/10 dark:bg-slate-950/20"
  },
  {
    id: "anti-leprosy",
    name: "Anti-Leprosy",
    iconName: "Circle",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-400/10 dark:bg-slate-950/20"
  },
  {
    id: "anti-malarial",
    name: "Anti-Malarial",
    iconName: "Droplet",
    colorClass: "text-purple-500",
    bgClass: "bg-purple-500/10 dark:bg-purple-950/20"
  },
  {
    id: "anti-protozoal",
    name: "Anti-Protozoal",
    iconName: "Target",
    colorClass: "text-purple-600",
    bgClass: "bg-purple-600/10 dark:bg-purple-950/20"
  },
  {
    id: "anti-tubercular",
    name: "Anti-Tubercular",
    iconName: "Wind",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10 dark:bg-emerald-950/20"
  },
  {
    id: "anti-helmintics",
    name: "Anti-Helmintics",
    iconName: "Crosshair",
    colorClass: "text-amber-600",
    bgClass: "bg-amber-600/10 dark:bg-amber-950/20"
  },
  {
    id: "anti-convulsants",
    name: "Anti-Convulsants",
    iconName: "Zap",
    colorClass: "text-pink-500",
    bgClass: "bg-pink-500/10 dark:bg-pink-950/20"
  },
  {
    id: "anti-emetics",
    name: "Anti-Emetics",
    iconName: "RotateCcw",
    colorClass: "text-teal-500",
    bgClass: "bg-teal-500/10 dark:bg-teal-950/20"
  },
  {
    id: "anti-histaminics",
    name: "Anti-Histaminics",
    iconName: "Leaf",
    colorClass: "text-fuchsia-500",
    bgClass: "bg-fuchsia-500/10 dark:bg-fuchsia-950/20"
  },
  {
    id: "anti-hypertensives",
    name: "Anti-Hypertensives",
    iconName: "Heart",
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10 dark:bg-red-950/20"
  },
  {
    id: "diuretics",
    name: "Diuretics",
    iconName: "Droplet",
    colorClass: "text-sky-600",
    bgClass: "bg-sky-600/10 dark:bg-sky-950/20"
  },
  {
    id: "steroids-hormones",
    name: "Steroids/Hormones",
    iconName: "Sun",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10 dark:bg-amber-950/20"
  },
  {
    id: "anti-viral",
    name: "Anti-Viral",
    iconName: "ShieldAlert",
    colorClass: "text-cyan-600",
    bgClass: "bg-cyan-600/10 dark:bg-cyan-950/20"
  },
  {
    id: "sedation",
    name: "Sedation",
    iconName: "Moon",
    colorClass: "text-violet-500",
    bgClass: "bg-violet-500/10 dark:bg-violet-950/20"
  },
  {
    id: "bronchodilators",
    name: "Bronchodilators",
    iconName: "Wind",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-400/10 dark:bg-sky-950/20"
  },
  {
    id: "cardiotonics",
    name: "Cardiotonics",
    iconName: "Heart",
    colorClass: "text-rose-600",
    bgClass: "bg-rose-600/10 dark:bg-rose-950/20"
  },
  {
    id: "supplements-vitamins",
    name: "Supplements/Vitamins",
    iconName: "PlusCircle",
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-600/10 dark:bg-emerald-950/20"
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    iconName: "Box",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-400/10 dark:bg-slate-950/20"
  }
];

export const PEDIATRIC_DRUGS: PediatricDrug[] = [
  // Analgesics & Antipyretics
  {
    id: "paracetamol",
    name: "Paracetamol",
    genericName: "Acetaminophen",
    category: "Analgesics & Antipyretics",
    standardDose: "15 mg/kg/dose",
    route: "PO / IV / PR",
    frequency: "Q6H PRN",
    maxDose: "Max: 60 mg/kg/day",
    source: "Harriet Lane Handbook",
    indications: ["Fever", "Mild to moderate pain", "Post-vaccination pyrexia"],
    calculateDose: (w: number) => {
      const singleDose = w * 15;
      const dailyMax = w * 60;
      // standard pediatric drops/syrup: 120mg/5mL or 250mg/5mL
      const syrupVolume120 = (singleDose / 120) * 5;
      return {
        doseValue: `${singleDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Single Dose: ${singleDose.toFixed(1)} mg (${syrupVolume120.toFixed(1)} mL of 120mg/5mL syrup)\nDaily limit: ${dailyMax.toFixed(1)} mg (Max 4 doses in 24 hours)`,
        notes: "Keep minimum 4-6 hours interval. Avoid duplicate paracetamol products."
      };
    }
  },
  {
    id: "ibuprofen",
    name: "Ibuprofen",
    category: "Analgesics & Antipyretics",
    standardDose: "10-15 mg/kg/dose",
    route: "PO",
    frequency: "Q6-8H",
    maxDose: "Max: 40 mg/kg/day",
    source: "Nelson's Textbook of Pediatrics",
    indications: ["Inflammation", "Fever", "Moderate pain", "Juvenile arthritis"],
    calculateDose: (w: number) => {
      const minDose = w * 10;
      const maxDose = w * 15;
      const dailyMax = w * 40;
      const syrupVolume100 = (minDose / 100) * 5; // standard syrup: 100mg/5mL
      return {
        doseValue: `${minDose.toFixed(0)}-${maxDose.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Single Dose: ${minDose.toFixed(1)}-${maxDose.toFixed(1)} mg\nSyrup Volume (100mg/5mL): ${syrupVolume100.toFixed(1)} mL\nDaily Max: ${dailyMax.toFixed(0)} mg`,
        notes: "Administer with food to decrease GI upset. Not recommended under 6 months of age."
      };
    }
  },
  {
    id: "nimesulide",
    name: "Nimesulide",
    category: "Analgesics & Antipyretics",
    standardDose: "5 mg/kg/day",
    route: "PO",
    frequency: "BD",
    source: "Nelson's Textbook of Pediatrics",
    indications: ["Acute pain", "Primary dysmenorrhea", "Osteoarthritis"],
    calculateDose: (w: number) => {
      const dailyTotal = w * 5;
      const singleDose = dailyTotal / 2;
      return {
        doseValue: `${singleDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Single Dose (BD): ${singleDose.toFixed(1)} mg\nTotal Daily: ${dailyTotal.toFixed(1)} mg`,
        notes: "Use with caution due to risk of hepatotoxicity. Use for shortest possible duration."
      };
    }
  },
  {
    id: "indomethacin",
    name: "Indomethacin",
    category: "Analgesics & Antipyretics",
    standardDose: "3 mg/kg/day",
    route: "PO",
    frequency: "Daily",
    source: "Harriet Lane Handbook",
    indications: ["Patent ductus arteriosus (PDA) closure", "Severe inflammation"],
    calculateDose: (w: number) => {
      const daily = w * 3;
      return {
        doseValue: `${daily.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily Dose: ${daily.toFixed(1)} mg`,
        notes: "Monitor renal function and platelets closely."
      };
    }
  },
  {
    id: "morphine",
    name: "Morphine",
    category: "Analgesics & Antipyretics",
    standardDose: "0.1-0.2 mg/kg/dose",
    route: "IV / IM",
    frequency: "Q4H",
    maxDose: "Max single dose: 15 mg",
    source: "Harriet Lane Handbook",
    indications: ["Severe acute pain", "Post-operative analgesia", "Cyanotic spells (Tetralogy of Fallot)"],
    calculateDose: (w: number) => {
      const minVal = w * 0.1;
      const maxVal = Math.min(15, w * 0.2);
      return {
        doseValue: `${minVal.toFixed(2)}-${maxVal.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Single Dose: ${minVal.toFixed(2)} to ${maxVal.toFixed(2)} mg IV/IM\nHave Naloxone available at bedside.`,
        notes: "Monitor closely for respiratory depression, sedation, and hypotension."
      };
    }
  },

  // Antibiotics - Penicillins
  {
    id: "amoxicillin",
    name: "Amoxicillin",
    category: "Antibiotics - Penicillins",
    standardDose: "25-50 mg/kg/day",
    route: "PO",
    frequency: "Q8H",
    source: "Harriet Lane Handbook",
    indications: ["Otitis media", "Pneumonia", "Sinusitis", "Streptococcal pharyngitis"],
    calculateDose: (w: number) => {
      const dailyMin = w * 25;
      const dailyMax = w * 50;
      const singleMin = dailyMin / 3;
      const singleMax = dailyMax / 3;
      // High dose amoxicillin (e.g. otitis media)
      const highDoseDaily = w * 90;
      const highDoseSingle = highDoseDaily / 2;
      return {
        doseValue: `${singleMin.toFixed(0)}-${singleMax.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Standard Dose: ${singleMin.toFixed(1)}-${singleMax.toFixed(1)} mg Q8H\nHigh Dose Protocol (Otitis Media/Pneumonia, 90mg/kg/day): ${highDoseSingle.toFixed(1)} mg Q12H`,
        notes: "Standard liquid susp: 125mg/5mL or 250mg/5mL. Can cause benign amoxicillin rash."
      };
    }
  },
  {
    id: "amoxicillin-clavulanate",
    name: "Amoxicillin + Clavulanate",
    genericName: "Co-amoxiclav",
    category: "Antibiotics - Penicillins",
    standardDose: "20-40 mg/kg/day",
    route: "PO",
    frequency: "Q12H",
    source: "Harriet Lane Handbook",
    indications: ["Animal/human bites", "Refractory Otitis Media", "Urinary tract infections", "Skin/soft tissue infections"],
    calculateDose: (w: number) => {
      const dailyMin = w * 20;
      const dailyMax = w * 40;
      const singleMin = dailyMin / 2;
      const singleMax = dailyMax / 2;
      return {
        doseValue: `${singleMin.toFixed(0)}-${singleMax.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Co-amoxiclav single dose (Q12H): ${singleMin.toFixed(1)}-${singleMax.toFixed(1)} mg based on Amoxicillin component.`,
        notes: "Give with meals to improve absorption and minimize gastrointestinal side effects."
      };
    }
  },
  {
    id: "ampicillin",
    name: "Ampicillin",
    category: "Antibiotics - Penicillins",
    standardDose: "100-200 mg/kg/day",
    route: "PO / IV",
    frequency: "Q8H",
    source: "Harriet Lane Handbook",
    indications: ["Neonatal sepsis (combined with Gentamicin)", "Meningitis", "Listeria infections"],
    calculateDose: (w: number) => {
      const dailyMin = w * 100;
      const dailyMax = w * 200;
      const singleMin = dailyMin / 3;
      const singleMax = dailyMax / 3;
      return {
        doseValue: `${singleMin.toFixed(0)}-${singleMax.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `IV Single Dose (Q8H): ${singleMin.toFixed(1)}-${singleMax.toFixed(1)} mg\nMeningitis protocol (up to 300-400 mg/kg/day divided Q6H): ${(w * 300 / 4).toFixed(0)} mg Q6H`,
        notes: "Inject slowly over 3-5 minutes IV. Adjust for renal impairment."
      };
    }
  },
  {
    id: "cloxacillin",
    name: "Cloxacillin",
    category: "Antibiotics - Penicillins",
    standardDose: "50-100 mg/kg/day",
    route: "PO / IV",
    frequency: "Q8H",
    source: "Nelson's Textbook of Pediatrics",
    indications: ["Staphylococcal skin infections", "Impetigo", "Cellulitis"],
    calculateDose: (w: number) => {
      const dailyMin = w * 50;
      const dailyMax = w * 100;
      const singleMin = dailyMin / 3;
      const singleMax = dailyMax / 3;
      return {
        doseValue: `${singleMin.toFixed(0)}-${singleMax.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Single Dose (Q8H): ${singleMin.toFixed(1)}-${singleMax.toFixed(1)} mg\nDaily Total: ${dailyMin.toFixed(0)}-${dailyMax.toFixed(0)} mg`,
        notes: "Take oral suspension on an empty stomach (1 hour before or 2 hours after meals)."
      };
    }
  },

  // Antibiotics - Cephalosporins
  {
    id: "ceftriaxone",
    name: "Ceftriaxone",
    category: "Antibiotics - Cephalosporins",
    standardDose: "50-80 mg/kg/day",
    route: "IV / IM",
    frequency: "Q12-24H",
    maxDose: "Max: 2g / day",
    source: "Harriet Lane Handbook",
    indications: ["Meningitis", "Severe community acquired pneumonia", "Gonorrhea", "Sepsis"],
    calculateDose: (w: number) => {
      const dailyDoseMin = Math.min(2000, w * 50);
      const dailyDoseMax = Math.min(2000, w * 80);
      const meningitisDose = Math.min(4000, w * 100); // 100 mg/kg/day for meningitis
      return {
        doseValue: `${dailyDoseMin.toFixed(0)}-${dailyDoseMax.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Daily dose (Once Daily): ${dailyDoseMin.toFixed(1)} to ${dailyDoseMax.toFixed(1)} mg IV\nMeningitis Dose (100mg/kg/day divided Q12H): ${(meningitisDose/2).toFixed(1)} mg Q12H`,
        notes: "Contraindicated in neonates (<28 days) taking calcium-containing IV fluids (risk of ceftriaxone-calcium precipitation)."
      };
    }
  },
  {
    id: "cefprozil",
    name: "Cefprozil",
    category: "Antibiotics - Cephalosporins",
    standardDose: "15-30 mg/kg/day",
    route: "PO",
    frequency: "Q12H",
    source: "Harriet Lane Handbook",
    indications: ["Pharyngitis", "Tonsillitis", "Skin infections"],
    calculateDose: (w: number) => {
      const single = (w * 15) / 2;
      return {
        doseValue: `${single.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Single Dose (Q12H): ${single.toFixed(1)} mg`,
        notes: "Second-generation cephalosporin. Shake liquid well."
      };
    }
  },

  // Antibiotics - Aminoglycosides
  {
    id: "gentamicin",
    name: "Gentamicin",
    category: "Antibiotics - Aminoglycosides",
    standardDose: "7.5 mg/kg/day",
    route: "IV / IM",
    frequency: "Q24H",
    source: "Harriet Lane Handbook",
    indications: ["Neonatal sepsis (with Ampicillin)", "Gram-negative urinary tract infections", "Pseudomonas infections"],
    calculateDose: (w: number) => {
      const singleDose = w * 7.5;
      return {
        doseValue: `${singleDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Once Daily IV Dose: ${singleDose.toFixed(1)} mg\nAlternative dividing schedule (2.5 mg/kg Q8H): ${(w * 2.5).toFixed(1)} mg Q8H`,
        notes: "Monitor serum peak/trough levels and renal function closely. High risk of ototoxicity and nephrotoxicity."
      };
    }
  },
  {
    id: "amikacin",
    name: "Amikacin",
    category: "Antibiotics - Aminoglycosides",
    standardDose: "15 mg/kg/day",
    route: "IV / IM",
    frequency: "Q24H",
    source: "Harriet Lane Handbook",
    indications: ["Severe gram-negative infections resistant to Gentamicin"],
    calculateDose: (w: number) => {
      const dose = w * 15;
      return {
        doseValue: `${dose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Once Daily IV Dose: ${dose.toFixed(1)} mg`,
        notes: "Ensure adequate hydration. Monitor peak/trough and renal parameters."
      };
    }
  },

  // Antibiotics - Macrolides
  {
    id: "azithromycin",
    name: "Azithromycin",
    category: "Antibiotics - Macrolides",
    standardDose: "10 mg/kg on Day 1, then 5 mg/kg/day",
    route: "PO",
    frequency: "Q24H",
    source: "Harriet Lane Handbook",
    indications: ["Atypical pneumonia (Mycoplasma)", "Pertussis", "Chlamydia", "Streptococcal pharyngitis (penicillin allergic)"],
    calculateDose: (w: number) => {
      const day1 = w * 10;
      const day2to5 = w * 5;
      return {
        doseValue: `Day 1: ${day1.toFixed(0)} mg, Day 2-5: ${day2to5.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `Day 1 Loading Dose: ${day1.toFixed(1)} mg PO once\nDay 2 to 5 Maintenance: ${day2to5.toFixed(1)} mg PO daily`,
        notes: "May take with or without food. Monitor for QT prolongation."
      };
    }
  },

  // Anti-Malarial
  {
    id: "artesunate",
    name: "Artesunate",
    category: "Anti-Malarial",
    standardDose: "2.4 mg/kg/dose",
    route: "IV / IM",
    frequency: "0h, 12h, 24h, then daily",
    source: "WHO Malaria Guidelines",
    indications: ["Severe falciparum malaria", "Complicated malaria"],
    calculateDose: (w: number) => {
      const doseVal = w * 2.4;
      return {
        doseValue: `${doseVal.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `IV Dose (Stat, 12h, 24h, then daily): ${doseVal.toFixed(1)} mg`,
        notes: "Administer slow bolus. Always follow with a full oral course of ACT once tolerated."
      };
    }
  },

  // Anti-Convulsants
  {
    id: "diazepam",
    name: "Diazepam",
    category: "Anti-Convulsants",
    standardDose: "0.2-0.5 mg/kg/dose",
    route: "IV / PR",
    frequency: "Stat (Repeat once if needed)",
    source: "PALS Pediatric Resuscitation",
    indications: ["Status epilepticus", "Febrile seizures (prolonged)", "Acute muscle spasms"],
    calculateDose: (w: number) => {
      const ivMin = w * 0.2;
      const ivMax = Math.min(10, w * 0.3);
      const prDose = Math.min(10, w * 0.5); // rectal gel
      return {
        doseValue: `IV: ${ivMin.toFixed(1)}-${ivMax.toFixed(1)} mg, PR: ${prDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `IV/IO bolus: ${ivMin.toFixed(2)}-${ivMax.toFixed(2)} mg (slow push over 2 mins)\nRectal Diazepam Gel (diastat): ${prDose.toFixed(1)} mg`,
        notes: "Be prepared for respiratory support. Monitor respiratory rate, oxygen saturation, and blood pressure."
      };
    }
  },
  {
    id: "midazolam",
    name: "Midazolam",
    category: "Anti-Convulsants",
    standardDose: "0.1-0.2 mg/kg/dose",
    route: "IV / IM / Nasal / Buccal",
    frequency: "Stat",
    source: "PALS Pediatric Resuscitation",
    indications: ["Active seizures / Status Epilepticus", "Procedural sedation", "Pre-operative anxiolysis"],
    calculateDose: (w: number) => {
      const ivDose = w * 0.1;
      const nasalDose = w * 0.2;
      return {
        doseValue: `IV: ${ivDose.toFixed(2)} mg, Intranasal/Buccal: ${nasalDose.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `IV/IO Dose: ${ivDose.toFixed(2)} mg (Max single 5mg)\nIntranasal/Buccal/IM Dose: ${nasalDose.toFixed(2)} mg (Max single 10mg)`,
        notes: "Preferred first-line medication for status epilepticus when IV access is not available (nasal/buccal)."
      };
    }
  },
  {
    id: "phenobarbital",
    name: "Phenobarbital",
    category: "Anti-Convulsants",
    standardDose: "15-20 mg/kg loading",
    route: "IV / PO",
    frequency: "Stat (Loading), then Q12-24H",
    source: "Harriet Lane Handbook",
    indications: ["Neonatal seizures (first-line)", "Refractory status epilepticus"],
    calculateDose: (w: number) => {
      const load = w * 20;
      const maintenance = w * 5; // daily
      return {
        doseValue: `Load: ${load.toFixed(0)} mg, Maintenance: ${maintenance.toFixed(1)} mg/day`,
        unit: "mg",
        breakdown: `Loading Dose: ${load.toFixed(1)} mg IV slow push (over 20 mins)\nMaintenance Dose: ${maintenance.toFixed(1)} mg daily (divided Q12H)`,
        notes: "Strong respiratory depressant, especially when given post benzodiazepines. Monitor blood levels."
      };
    }
  },

  // Anti-Emetics
  {
    id: "ondansetron",
    name: "Ondansetron",
    category: "Anti-Emetics",
    standardDose: "0.15 mg/kg/dose",
    route: "PO / IV",
    frequency: "Q8H PRN",
    maxDose: "Max: 8 mg/dose",
    source: "Harriet Lane Handbook",
    indications: ["Gastroenteritis-related vomiting", "Chemotherapy induced nausea/vomiting", "Post-operative vomiting"],
    calculateDose: (w: number) => {
      const doseVal = Math.min(8, w * 0.15);
      return {
        doseValue: `${doseVal.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Standard Dose: ${doseVal.toFixed(2)} mg (PO or IV over 2-5 minutes)\nRecommended oral dosing guides by weight:\n8-15 kg: 2 mg\n15-30 kg: 4 mg\n>30 kg: 8 mg`,
        notes: "May prolong QT interval. Do not use in patients with congenital long QT syndrome."
      };
    }
  },

  // Bronchodilators
  {
    id: "salbutamol",
    name: "Salbutamol",
    genericName: "Albuterol",
    category: "Bronchodilators",
    standardDose: "0.15 mg/kg/dose",
    route: "Nebulization / MDI",
    frequency: "Q1-4H PRN",
    source: "PALS Asthma Guidelines",
    indications: ["Acute asthma exacerbation", "Bronchospasm", "Anaphylaxis wheezing", "Hyperkalemia emergency"],
    calculateDose: (w: number) => {
      const doseMg = Math.min(5, Math.max(1.25, w * 0.15));
      const nebVol = (doseMg / 5) * 1; // standard solution is 5mg/mL
      return {
        doseValue: `${doseMg.toFixed(2)} mg`,
        unit: "mg",
        breakdown: `Nebulizer Liquid Dose: ${doseMg.toFixed(2)} mg (${nebVol.toFixed(2)} mL of 0.5% [5mg/mL] solution mixed in 2-3 mL Normal Saline)\nMDI with Spacer: 2-6 puffs every 20 mins for 1 hour, then Q1-4H.`,
        notes: "Watch for severe tachycardia, tremor, hypokalemia, and lactic acidosis with frequent doses."
      };
    }
  },
  {
    id: "adrenaline-neb",
    name: "Adrenaline Nebulization",
    genericName: "Racemic Epinephrine",
    category: "Bronchodilators",
    standardDose: "0.5 mL/kg",
    route: "Nebulization",
    frequency: "Stat / Q2H PRN",
    maxDose: "Max: 5 mL",
    source: "Harriet Lane Handbook",
    indications: ["Croup (Laryngotracheobronchitis) with stridor at rest", "Severe bronchiolitis"],
    calculateDose: (w: number) => {
      const vol = Math.min(5, w * 0.5); // standard L-adrenaline 1:1000
      return {
        doseValue: `${vol.toFixed(1)} mL (1:1000)`,
        unit: "mL",
        breakdown: `Nebulizer Dose: ${vol.toFixed(1)} mL of L-adrenaline 1:1000 diluted with 2-3 mL NS.\nAlternative: Racemic Epinephrine (2.25%) 0.05 mL/kg (max 0.5 mL).`,
        notes: "Observe patient for at least 3-4 hours after administration for rebound stridor/symptoms."
      };
    }
  },

  // Steroids/Hormones
  {
    id: "dexamethasone",
    name: "Dexamethasone",
    category: "Steroids/Hormones",
    standardDose: "0.15-0.6 mg/kg/dose",
    route: "PO / IV / IM",
    frequency: "Daily / Stat",
    maxDose: "Max: 16 mg/dose",
    source: "Harriet Lane Handbook",
    indications: ["Croup (standard 0.6 mg/kg single dose)", "Asthma adjunct", "Bacterial meningitis (adjunct to antibiotics)"],
    calculateDose: (w: number) => {
      const singleDose = Math.min(16, w * 0.6);
      const lowDose = Math.min(10, w * 0.15);
      return {
        doseValue: `Croup Dose: ${singleDose.toFixed(1)} mg, Low-range: ${lowDose.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Croup Standard Dose (0.6 mg/kg): ${singleDose.toFixed(1)} mg PO/IV (Single dose covers 72h)\nGeneral Anti-inflammatory (0.15 mg/kg): ${lowDose.toFixed(1)} mg PO/IV daily`,
        notes: "Very long half-life. Croup dose is usually given once as a single dose."
      };
    }
  },
  {
    id: "hydrocortisone",
    name: "Hydrocortisone",
    category: "Steroids/Hormones",
    standardDose: "2-4 mg/kg/dose",
    route: "IV",
    frequency: "Q6H",
    source: "Harriet Lane Handbook",
    indications: ["Acute severe asthma / Status asthmaticus", "Septic shock (adrenal insufficiency)", "Anaphylaxis adjunct"],
    calculateDose: (w: number) => {
      const minVal = w * 2;
      const maxVal = w * 4;
      return {
        doseValue: `${minVal.toFixed(0)}-${maxVal.toFixed(0)} mg`,
        unit: "mg",
        breakdown: `IV Single Dose: ${minVal.toFixed(1)} to ${maxVal.toFixed(1)} mg IV push Q6H`,
        notes: "Provides rapid glucocorticoid/mineralocorticoid activity. Switch to oral prednisolone once stabilized."
      };
    }
  },

  // Diuretics
  {
    id: "furosemide",
    name: "Furosemide",
    genericName: "Lasix",
    category: "Diuretics",
    standardDose: "1 mg/kg/dose",
    route: "IV / PO",
    frequency: "Q12-24H",
    maxDose: "Max: 6 mg/kg/day",
    source: "Harriet Lane Handbook",
    indications: ["Congestive heart failure", "Acute fluid overload", "Pulmonary edema", "Post-resuscitation fluid balance"],
    calculateDose: (w: number) => {
      const doseVal = w * 1;
      return {
        doseValue: `${doseVal.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Single Dose: ${doseVal.toFixed(1)} mg IV (diluted and pushed slowly over 2-5 mins) or PO.`,
        notes: "Monitor potassium, sodium, and renal indicators. Risk of ototoxicity at high doses."
      };
    }
  },

  // Supplements/Vitamins
  {
    id: "calcium-gluconate",
    name: "Calcium Gluconate 10%",
    category: "Supplements/Vitamins",
    standardDose: "1-2 mL/kg/dose",
    route: "IV",
    frequency: "Stat (Repeat once if needed)",
    maxDose: "Max: 10-20 mL",
    source: "PALS Emergency Dosing",
    indications: ["Hypocalcemia symptom control", "Hyperkalemia with EKG changes (myocardial stabilizer)", "Hypermagnesemia toxicity"],
    calculateDose: (w: number) => {
      const minVol = w * 1;
      const maxVol = Math.min(20, w * 2);
      return {
        doseValue: `${minVol.toFixed(1)}-${maxVol.toFixed(1)} mL`,
        unit: "mL",
        breakdown: `Slow IV infusion dose: ${minVol.toFixed(1)} to ${maxVol.toFixed(1)} mL of 10% solution.\nDilute 1:1 or 1:2 in D5W/NS. Run over 10-20 minutes.`,
        notes: "CRITICAL: Stop infusion immediately if bradycardia occurs. Extravasation causes severe tissue necrosis."
      };
    }
  },

  // Anti-Tubercular
  {
    id: "isoniazid",
    name: "Isoniazid",
    category: "Anti-Tubercular",
    standardDose: "10-15 mg/kg/day",
    route: "PO",
    frequency: "Daily",
    source: "WHO TB Guidelines",
    indications: ["Tuberculosis treatment", "TB prophylaxis"],
    calculateDose: (w: number) => {
      const doseVal = w * 10;
      return {
        doseValue: `${doseVal.toFixed(1)} mg`,
        unit: "mg",
        breakdown: `Daily Dose: ${doseVal.toFixed(1)} mg PO once daily`,
        notes: "Give pyridoxine (Vitamin B6) alongside to prevent peripheral neuropathy."
      };
    }
  }
];
