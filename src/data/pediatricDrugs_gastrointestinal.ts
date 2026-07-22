import { PediatricDrug } from "./pediatricDrugs_types";

export const GASTROINTESTINAL_DRUGS: PediatricDrug[] = [
  {
    id: "rabeprazole",
    name: "Rabeprazole (AcipHex)",
    genericName: "Rabeprazole Sodium",
    category: "Miscellaneous",
    standardDose: "1-11 yrs: <15kg: 5mg PO daily, >=15kg: 10mg PO daily. >=12 yrs: 20mg PO daily.",
    route: "PO",
    frequency: "Daily (OD)",
    maxDose: "Max: 20 mg/day",
    source: "FDA / Harriet Lane Handbook",
    indications: [
      "Gastroesophageal Reflux Disease (GERD)",
      "Healing of erosive or ulcerative esophagitis",
      "Pathological hypersecretory conditions"
    ],
    formulations: [
      "Delayed-release sprinkle capsules: 5 mg, 10 mg",
      "Enteric-coated tablets: 10 mg, 20 mg",
      "Injection (IV vial): 20 mg lyophilized powder"
    ],
    calculateDose: (w: number) => {
      let dose = 0;
      let rangeText = "";
      let instruction = "";

      if (w < 1) {
        rangeText = "Safety not established under 1 year of age.";
        return {
          doseValue: "Consult Gastroenterologist",
          unit: "mg",
          breakdown: rangeText,
          notes: "Safety and efficacy have not been established in patients under 1 year of age."
        };
      } else if (w >= 1 && w < 15) {
        dose = 5;
        rangeText = "1 to 11 years (< 15 kg): 5 mg PO once daily.";
        instruction = "Use delayed-release sprinkle capsule (5 mg). Open capsule and sprinkle entire contents on a small amount of soft food (e.g., applesauce) or mix with infant formula/liquid. Administer within 15 minutes. Do not chew or crush the granules.";
      } else if (w >= 15 && w < 30) {
        dose = 10;
        rangeText = "1 to 11 years (>= 15 kg): 10 mg PO once daily.";
        instruction = "Use 10 mg enteric-coated tablet (must be swallowed whole, do not chew or crush) OR open a 10 mg delayed-release sprinkle capsule and sprinkle on soft food.";
      } else {
        dose = 20;
        rangeText = "Adolescents >= 12 years or heavier children: 20 mg PO once daily.";
        instruction = "Swallow 20 mg enteric-coated tablet whole. Take 30 minutes before breakfast.";
      }

      return {
        doseValue: `${dose} mg PO Daily`,
        unit: "mg",
        breakdown: `Patient weight is ${w} kg.\nRecommended dose: ${dose} mg once daily.\n\nFormulation Instruction:\n* ${instruction}`,
        notes: "Best administered 30 minutes before the first meal of the day. Do not crush or chew enteric-coated tablets or delayed-release granules. Liquid formulations are not commercially pre-prepared but can be extemporaneously compounded."
      };
    }
  },
  {
    id: "ondansetron",
    name: "Ondansetron (Zofran)",
    genericName: "Ondansetron Hydrochloride",
    category: "Anti-Emetics",
    standardDose: "0.15 mg/kg/dose PO/IV Q8H as needed",
    route: "PO / IV / IM",
    frequency: "Q8H PRN",
    maxDose: "Max: 8 mg/dose (4 mg for <12 yrs)",
    source: "PALS / Harriet Lane Handbook",
    indications: [
      "Prevention of chemotherapy-induced nausea & vomiting",
      "Gastroenteritis-associated vomiting",
      "Post-operative nausea & vomiting"
    ],
    formulations: [
      "Syrup (Oral Solution): 4 mg / 5 mL",
      "Orally Disintegrating Tablets (ODT): 4 mg, 8 mg",
      "Enteric-coated tablets: 4 mg, 8 mg",
      "Injection (vials / ampoules): 2 mg / mL"
    ],
    calculateDose: (w: number) => {
      const computed = w * 0.15;
      const roundedDose = Math.min(w >= 30 ? 8 : 4, computed);
      
      // Syrup volume (4mg/5ml)
      const mlVolume = (roundedDose / 4) * 5;
      // Injection volume (2mg/ml)
      const ivVolume = roundedDose / 2;

      return {
        doseValue: `${roundedDose.toFixed(1)} mg PO/IV Q8H`,
        unit: "mg",
        breakdown: `Calculated Dose (0.15 mg/kg): ${computed.toFixed(2)} mg.\nRounded standard safe dose: ${roundedDose.toFixed(1)} mg.\n\nFormulation Delivery Volumes:\n* Syrup (4 mg/5 mL): ${mlVolume.toFixed(1)} mL PO\n* ODT / Tablet: ${roundedDose >= 4 ? `${Math.round(roundedDose / 4)} x 4mg tablet` : "Use Syrup"}\n* IV Injection (2 mg/mL): ${ivVolume.toFixed(2)} mL IV/IM`,
        notes: "Orally Disintegrating Tablets (ODT) melt on the tongue and do not require water. Use caution in patients with congenital long QT syndrome as Ondansetron can prolong the QT interval."
      };
    }
  },
  {
    id: "omeprazole",
    name: "Omeprazole (Prilosec)",
    genericName: "Omeprazole",
    category: "Miscellaneous",
    standardDose: "0.7 - 1 mg/kg/dose PO daily",
    route: "PO",
    frequency: "Daily",
    maxDose: "Max: 40 mg/day",
    source: "Harriet Lane Handbook",
    indications: [
      "Gastroesophageal Reflux Disease (GERD)",
      "Duodenal and gastric ulcers",
      "Erosive esophagitis healing"
    ],
    formulations: [
      "Delayed-release capsules: 10 mg, 20 mg, 40 mg",
      "For oral suspension packets: 2.5 mg, 10 mg",
      "Injection (vial): 40 mg lyophilized powder"
    ],
    calculateDose: (w: number) => {
      let dose = 0;
      if (w < 5) {
        dose = 2.5;
      } else if (w >= 5 && w < 10) {
        dose = 5;
      } else if (w >= 10 && w < 20) {
        dose = 10;
      } else {
        dose = 20;
      }

      return {
        doseValue: `${dose} mg PO Daily`,
        unit: "mg",
        breakdown: `At ${w} kg, recommended weight-banded dose is ${dose} mg once daily.\n\nFormulations:\n* Capsule: 10mg / 20mg (do not crush or chew)\n* Suspension packets (2.5mg or 10mg): Mix with water as per guidelines`,
        notes: "Give 30-60 minutes before breakfast. Antacids or food do not prevent its action, but absorption is optimal on empty stomach."
      };
    }
  },
  {
    id: "pantoprazole",
    name: "Pantoprazole (Protonix)",
    genericName: "Pantoprazole Sodium",
    category: "Miscellaneous",
    standardDose: "1 mg/kg/dose PO/IV daily",
    route: "PO / IV",
    frequency: "Daily",
    maxDose: "Max: 40 mg/day",
    source: "Pediatric Lexi-Comp",
    indications: [
      "Erosive esophagitis associated with GERD",
      "Stress ulcer prophylaxis in ICU"
    ],
    formulations: [
      "Delayed-release tablets: 20 mg, 40 mg",
      "Granules for delayed-release oral suspension: 40 mg",
      "Injection (vial): 40 mg powder for reconstitution"
    ],
    calculateDose: (w: number) => {
      const computed = w * 1.0;
      const roundedDose = Math.min(40, Math.max(10, Math.round(computed / 10) * 10));

      return {
        doseValue: `${roundedDose} mg PO/IV Daily`,
        unit: "mg",
        breakdown: `Calculated (1.0 mg/kg): ${computed.toFixed(1)} mg.\nRounded to standard strength: ${roundedDose} mg PO/IV once daily.\n\nReconstitution of 40mg IV vial:\n* Reconstitute with 10 mL Normal Saline to get 4 mg/mL.\n* Deliver ${(roundedDose / 4).toFixed(1)} mL IV over 15 minutes.`,
        notes: "Do not split, chew or crush delayed-release tablets. Intravenous administration requires inline filter."
      };
    }
  },
  {
    id: "ranitidine",
    name: "Ranitidine (Zantac)",
    genericName: "Ranitidine Hydrochloride",
    category: "Miscellaneous",
    standardDose: "PO: 4-5 mg/kg/day divided Q8-12H; IV: 1-2 mg/kg/day divided Q6-8H",
    route: "PO / IV",
    frequency: "Q12H (PO) or Q8H (IV)",
    maxDose: "Max: 300 mg/day (PO), 150 mg/day (IV)",
    source: "Harriet Lane Handbook",
    indications: [
      "GERD, gastric or duodenal ulcer",
      "Prophylaxis of stress ulcers"
    ],
    formulations: [
      "Syrup (Oral Solution): 15 mg / mL",
      "Tablets: 75 mg, 150 mg",
      "Injection: 25 mg / mL"
    ],
    calculateDose: (w: number) => {
      const poDaily = w * 4.5; // mid of 4-5
      const poSingle = Math.min(150, poDaily / 2);
      const ivDaily = w * 1.5; // mid of 1-2
      const ivSingle = Math.min(50, ivDaily / 3);

      const mlSyrup = poSingle / 15;
      const mlInjection = ivSingle / 25;

      return {
        doseValue: `PO: ${poSingle.toFixed(1)} mg BD, IV: ${ivSingle.toFixed(1)} mg TDS`,
        unit: "mg",
        breakdown: `At ${w} kg:\n* Oral Dose (2.25 mg/kg per dose BD): ${poSingle.toFixed(1)} mg PO. Syrup (15mg/mL) Volume: ${mlSyrup.toFixed(1)} mL PO BD.\n* IV Dose (0.5 mg/kg per dose TDS): ${ivSingle.toFixed(1)} mg IV. Injection (25mg/mL) Volume: ${mlInjection.toFixed(2)} mL IV TDS.`,
        notes: "Note: Ranitidine has been withdrawn or restricted in many markets due to NDMA impurities; check local formulary availability. Famotidine is the preferred H2 blocker alternative."
      };
    }
  }
];
