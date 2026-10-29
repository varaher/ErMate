import { PediatricDrug } from "./pediatricDrugs_types";

// Anti-spasmodics. Doses follow standard product labelling / BNFc ranges used in Indian practice.
// Antispasmodics are SYMPTOMATIC only: do not use to mask an acute abdomen (surgical causes, intussusception, obstruction).
export const ANTISPASMODIC_DRUGS: PediatricDrug[] = [
  {
    id: "hyoscine-butylbromide",
    name: "Hyoscine Butylbromide (Buscopan)",
    genericName: "Hyoscine Butylbromide",
    category: "Anti-Spasmodics",
    standardDose: "IV/IM: 0.3-0.6 mg/kg/dose (max 20 mg/dose). Oral 6-12 yrs: 10 mg TDS",
    route: "PO / IV / IM",
    frequency: "Q6-8H PRN",
    maxDose: "Max: 20 mg/dose, 100 mg/day (IV/IM); 30 mg/day oral in 6-12 yrs",
    source: "Product labelling (India) / BNFc",
    indications: [
      "Abdominal colic / smooth-muscle spasm",
      "Biliary or renal colic (adolescents)",
      "Spasm during GI procedures"
    ],
    formulations: [
      "Tablet: 10 mg",
      "Injection: 20 mg / mL ampoule"
    ],
    calculateDose: (w: number) => {
      const low = w * 0.3;
      const high = w * 0.6;
      const cap = 20;
      const dose = Math.min(cap, low);
      const hiCapped = Math.min(cap, high);
      const ml = dose / 20;
      let oral = "";
      if (w >= 20 && w < 40) oral = "\nOral (6-12 yrs, approx. 20-40 kg): 10 mg PO three times daily (max 30 mg/day).";
      else if (w >= 40) oral = "\nOral (adolescent / adult size): 10-20 mg PO three to four times daily.";
      else oral = "\nOral tablets are not licensed under 6 years: use the injection only on senior advice.";
      return {
        doseValue: `${dose.toFixed(1)} mg IV/IM (range ${dose.toFixed(1)}-${hiCapped.toFixed(1)} mg)`,
        unit: "mg",
        breakdown: `Calculated (0.3-0.6 mg/kg): ${low.toFixed(1)}-${high.toFixed(1)} mg, capped at ${cap} mg/dose.\nStarting dose: ${dose.toFixed(1)} mg = ${ml.toFixed(2)} mL of the 20 mg/mL ampoule (dilute for slow IV, over at least 1-2 minutes).${oral}`,
        notes: "Anticholinergic: expect dry mouth and tachycardia. Avoid in glaucoma, ileus/obstruction, myasthenia gravis and tachyarrhythmia. Not for suspected surgical abdomen. Under-6 use is off-label."
      };
    }
  },
  {
    id: "drotaverine",
    name: "Drotaverine (No-Spa)",
    genericName: "Drotaverine Hydrochloride",
    category: "Anti-Spasmodics",
    standardDose: "1-6 yrs: 40-120 mg/day in 2-3 doses. 6-12 yrs: 80-200 mg/day in 2-5 doses",
    route: "PO",
    frequency: "2-3 times daily",
    maxDose: "Max: 80 mg/dose; 200 mg/day (6-12 yrs)",
    source: "Product labelling (India)",
    indications: [
      "Intestinal / abdominal colic",
      "Spasm of the biliary or urinary tract"
    ],
    formulations: [
      "Tablet: 40 mg, 80 mg",
      "Syrup / drops (brand dependent): check strength on the bottle"
    ],
    calculateDose: (w: number) => {
      if (w < 10) {
        return {
          doseValue: "Not advised under about 1 year",
          unit: "mg",
          breakdown: `Weight ${w} kg. Labelled use starts from 1 year of age.`,
          notes: "Refer to a paediatrician. Consider dicyclomine only from 6 months, or non-drug measures."
        };
      }
      if (w < 20) {
        return {
          doseValue: "20-40 mg PO two to three times daily",
          unit: "mg",
          breakdown: `Approx. 1-6 years: 40-120 mg/day divided in 2-3 doses (about 20-40 mg per dose).\nStart at 20 mg per dose.`,
          notes: "Banded by weight as a proxy for age: confirm the child's age. Oral only in children."
        };
      }
      if (w < 40) {
        return {
          doseValue: "40 mg PO two to five times daily (max 200 mg/day)",
          unit: "mg",
          breakdown: `Approx. 6-12 years: 80-200 mg/day in 2-5 doses. Single dose 40 mg, never above 80 mg.`,
          notes: "Banded by weight as a proxy for age: confirm the child's age. Oral only in children."
        };
      }
      return {
        doseValue: "40-80 mg PO three times daily",
        unit: "mg",
        breakdown: `Adult-size patient: 40-80 mg PO three times daily (adult max 240 mg/day).`,
        notes: "Adult dosing applies. Injectable drotaverine is not established for children."
      };
    }
  },
  {
    id: "dicyclomine",
    name: "Dicyclomine (Cyclopam)",
    genericName: "Dicyclomine Hydrochloride",
    category: "Anti-Spasmodics",
    standardDose: "6 mo-2 yrs: 5 mg TDS. 2-12 yrs: 10 mg TDS. Oral only",
    route: "PO",
    frequency: "TDS (3 times daily)",
    maxDose: "Max: 10 mg/dose below 12 yrs",
    source: "Product labelling (India) / BNFc",
    indications: [
      "Infantile colic (from 6 months, short course)",
      "Functional abdominal pain / intestinal spasm"
    ],
    formulations: [
      "Drops (brand dependent): check strength on the bottle",
      "Tablet: 10 mg, 20 mg",
      "Usually combined with simethicone or paracetamol in Indian brands: dose by the dicyclomine content"
    ],
    calculateDose: (w: number) => {
      if (w < 6) {
        return {
          doseValue: "Do not use under 6 months",
          unit: "mg",
          breakdown: `Weight ${w} kg. Dicyclomine is contraindicated under 6 months (apnoea, respiratory distress, seizures reported).`,
          notes: "Use non-drug measures and refer to a paediatrician."
        };
      }
      if (w < 12) {
        return {
          doseValue: "5 mg PO three times daily",
          unit: "mg",
          breakdown: `Approx. 6 months-2 years: 5 mg per dose, three times daily, before feeds. Short course only.`,
          notes: "Banded by weight as a proxy for age: confirm the child is at least 6 months old."
        };
      }
      if (w < 40) {
        return {
          doseValue: "10 mg PO three times daily",
          unit: "mg",
          breakdown: `Approx. 2-12 years: 10 mg per dose, three times daily (max 10 mg/dose).`,
          notes: "Banded by weight as a proxy for age: confirm the child's age."
        };
      }
      return {
        doseValue: "10-20 mg PO three to four times daily",
        unit: "mg",
        breakdown: `Adult-size patient: 10-20 mg PO three to four times daily.`,
        notes: "Adult dosing applies. Anticholinergic: avoid in glaucoma, ileus, obstructive uropathy and myasthenia gravis."
      };
    }
  }
];