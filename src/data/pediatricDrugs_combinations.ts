import { PediatricDrug } from "./pediatricDrugs_types";

export const COMBINATION_DRUGS: PediatricDrug[] = [
  {
    id: "co-amoxiclav",
    name: "Co-Amoxiclav (Amoxicillin + Clavulanate)",
    genericName: "Amoxicillin / Clavulanic Acid",
    category: "Antibiotics - Penicillins",
    standardDose: "30-45 mg/kg/day Amoxicillin component divided Q12H PO (90 mg/kg/day for severe Otitis Media)",
    route: "PO / IV",
    frequency: "12hly (BD) or 8hly (TDS)",
    maxDose: "Max: 2000 mg/day Amoxicillin component",
    source: "PALS / Harriet Lane Handbook",
    indications: ["Acute Otitis Media", "Community Acquired Pneumonia", "Urinary Tract Infections", "Skin & Soft Tissue Infections"],
    formulations: [
      "Oral Suspension: 228 mg / 5 mL (200mg Amoxicillin + 28.5mg Clavulanate)",
      "Oral Suspension: 457 mg / 5 mL (400mg Amoxicillin + 57mg Clavulanate)",
      "Tablets: 375 mg, 625 mg, 1000 mg",
      "Injection (IV vial): 600 mg, 1.2 g"
    ],
    calculateDose: (w: number) => {
      // Standard dose (45 mg/kg/day Amoxicillin component, divided twice daily)
      const dailyAmox = w * 45;
      const singleAmox = dailyAmox / 2;
      
      // Augmentin 228mg/5mL contains 200mg Amox + 28.5mg Clav
      const ml228 = (singleAmox / 200) * 5;
      
      // Augmentin 457mg/5mL contains 400mg Amox + 57mg Clav
      const ml457 = (singleAmox / 400) * 5;

      return {
        doseValue: `${singleAmox.toFixed(1)} mg PO BD (of Amoxicillin component)`,
        unit: "mg (Amox)",
        breakdown: `Total Daily Amoxicillin: ${dailyAmox.toFixed(1)} mg/day\nSingle Dose (Q12H): ${singleAmox.toFixed(1)} mg Amox BD.\n\nSuspension Volumes:\n* Augmentin 228 mg/5 mL (200/28.5): ${ml228.toFixed(1)} mL BD\n* Augmentin 457 mg/5 mL (400/57): ${ml457.toFixed(1)} mL BD`,
        notes: "Dosing is always calculated using the Amoxicillin component. Administer at the start of a meal to minimize gastrointestinal side effects."
      };
    }
  },
  {
    id: "co-trimoxazole",
    name: "Co-Trimoxazole (Septra / Bactrim)",
    genericName: "Trimethoprim / Sulfamethoxazole (TMP/SMX)",
    category: "Antibiotics - Others",
    standardDose: "8-10 mg/kg/day Trimethoprim component divided Q12H PO or IV",
    route: "PO / IV",
    frequency: "12hly (BD)",
    source: "Harriet Lane Handbook",
    indications: ["Urinary Tract Infections", "Otitis Media", "Pneumocystis Pneumonia (PJP) prophylaxis & treatment"],
    formulations: [
      "Pediatric Oral Suspension: 40 mg TMP + 200 mg SMX per 5 mL",
      "Adult Tablets: Single Strength (80 mg TMP + 400 mg SMX)",
      "Adult Tablets: Double Strength (160 mg TMP + 800 mg SMX)",
      "Injection (IV vial): 80 mg TMP + 400 mg SMX per 5 mL ampoule"
    ],
    calculateDose: (w: number) => {
      const dailyTmp = w * 8;
      const singleTmp = dailyTmp / 2;
      
      // Pediatric suspension contains 40mg TMP + 200mg SMX per 5mL
      const suspensionVolumeMl = (singleTmp / 40) * 5;

      return {
        doseValue: `${singleTmp.toFixed(1)} mg TMP / ${(singleTmp * 5).toFixed(1)} mg SMX`,
        unit: "mg TMP",
        breakdown: `Total Daily Trimethoprim: ${dailyTmp.toFixed(1)} mg/day\nSingle Dose (Q12H): ${singleTmp.toFixed(1)} mg TMP PO BD.\n\nSuspension Volume (40mg TMP + 200mg SMX per 5mL):\n* ${suspensionVolumeMl.toFixed(1)} mL PO BD`,
        notes: "Avoid in infants under 2 months of age due to risk of kernicterus. Encourage high fluid intake to prevent crystalluria."
      };
    }
  },
  {
    id: "duolin-nebulization",
    name: "Duolin Respules (Salbutamol + Ipratropium)",
    genericName: "Levosalbutamol / Ipratropium Bromide",
    category: "Bronchodilators",
    standardDose: "Weight-based: < 15 kg: 0.5 respule, >= 15 kg: 1 respule Q4-6H PRN",
    route: "Nebulization",
    frequency: "Q20m for acute exacerbation, then Q4-6H PRN",
    source: "Ginasthma / Pediatric Emergency Standards",
    indications: ["Acute severe asthma", "Bronchospasm", "Viral induced wheeze"],
    formulations: [
      "Nebulizer Respules: 1.25 mL (half strength), 2.5 mL (full strength)",
      "Metered Dose Inhaler (MDI): 50 mcg Levosalbutamol + 20 mcg Ipratropium per puff"
    ],
    calculateDose: (w: number) => {
      const isInfant = w < 15;
      const fraction = isInfant ? "0.5 respule (1.25 mL)" : "1.0 respule (2.5 mL)";
      return {
        doseValue: fraction,
        unit: "respule",
        breakdown: `For weight ${w} kg:\n* Recommended: ${fraction} nebulized Q4-6H as needed.\n\nDilute 0.5 respule with 1.2 mL sterile normal saline if needed to ensure adequate nebulizer run time.`,
        notes: "Monitor heart rate, ECG, and look out for muscle tremors or hypokalemia under repeated dosing."
      };
    }
  },
  {
    id: "coartem",
    name: "Coartem (Artemether + Lumefantrine)",
    genericName: "Artemether / Lumefantrine",
    category: "Anti-Malarial",
    standardDose: "Weight-based 6-dose regimen over 3 days",
    route: "PO",
    frequency: "Dose 1 (Stat), Dose 2 (at 8 hrs), then Q12H for 2 more days",
    source: "WHO Malaria Treatment Guidelines",
    indications: ["Uncomplicated Plasmodium falciparum malaria"],
    formulations: [
      "Tablets: 20 mg Artemether + 120 mg Lumefantrine (including dispersible pediatric tablets)"
    ],
    calculateDose: (w: number) => {
      let tablets = 0;
      let rangeText = "";

      if (w < 5) {
        rangeText = "Under 5kg: Safety not established. Consult senior pediatrician.";
      } else if (w >= 5 && w < 15) {
        tablets = 1;
        rangeText = "5 to <15 kg: 1 tablet per dose (6 doses total)";
      } else if (w >= 15 && w < 25) {
        tablets = 2;
        rangeText = "15 to <25 kg: 2 tablets per dose (6 doses total)";
      } else if (w >= 25 && w < 35) {
        tablets = 3;
        rangeText = "25 to <35 kg: 3 tablets per dose (6 doses total)";
      } else {
        tablets = 4;
        rangeText = ">= 35 kg: 4 tablets per dose (6 doses total)";
      }

      return {
        doseValue: tablets > 0 ? `${tablets} tablet(s) per dose` : "Consult Specialist",
        unit: "tablet(s)",
        breakdown: tablets > 0 
          ? `Regimen details:\n* Weight range: ${rangeText}\n* Dose strength per tablet: 20 mg Artemether / 120 mg Lumefantrine\n* Administer ${tablets} tablet(s) stat, then at 8 hours, then twice daily (morning & night) for the following 2 days.`
          : `Patient weight is ${w} kg. ${rangeText}`,
        notes: "Administer tablets with fatty food, infant formula, or milk to significantly enhance the absorption of Lumefantrine."
      };
    }
  },
  {
    id: "combiflam-suspension",
    name: "Combiflam Suspension (Ibuprofen + Paracetamol)",
    genericName: "Ibuprofen / Acetaminophen",
    category: "Analgesics & Antipyretics",
    standardDose: "Ibuprofen 10 mg/kg + Paracetamol 15 mg/kg per dose PO",
    route: "PO",
    frequency: "Q6-8H PRN",
    maxDose: "Max: 4 doses in 24 hours",
    source: "Standard Pediatric Practice / User Request",
    indications: ["High-grade fever refractory to single agents", "Acute inflammatory musculoskeletal pain"],
    formulations: [
      "Oral Suspension: Ibuprofen 100 mg + Paracetamol 125 mg per 5 mL",
      "Tablets: Ibuprofen 400 mg + Paracetamol 325 mg"
    ],
    calculateDose: (w: number) => {
      const ibxDose = w * 10;
      const paraDose = w * 15;
      
      // Combiflam suspension standard: Ibuprofen 100mg + Paracetamol 125mg per 5mL
      // Standard target is Ibuprofen 10mg/kg -> ml based on Ibuprofen is:
      const mlTarget = (ibxDose / 100) * 5;
      const calculatedParaAtThisMl = (mlTarget / 5) * 125;

      return {
        doseValue: `${mlTarget.toFixed(1)} mL PO Q6H PRN`,
        unit: "mL",
        breakdown: `At ${w} kg:\n* Calculated Ibuprofen (10 mg/kg): ${ibxDose.toFixed(1)} mg\n* Calculated Paracetamol (15 mg/kg): ${paraDose.toFixed(1)} mg\n\nUsing Combiflam Suspension (100mg Ibuprofen + 125mg Paracetamol per 5mL):\n* Give ${mlTarget.toFixed(1)} mL PO per dose Q6H PRN.\n* This mL delivers exactly ${ibxDose.toFixed(1)} mg Ibuprofen and ${calculatedParaAtThisMl.toFixed(1)} mg Paracetamol (perfectly safe & balanced).`,
        notes: "Do not use in children with dehydration, active diarrhea, or renal impairment. Always give after meals."
      };
    }
  }
];
