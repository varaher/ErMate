import { PediatricDrug } from "./pediatricDrugs_types";
import { bolus, fixed, fmt } from "./pediatricDrugs_emergency_builders";

// Fluids and metabolic emergencies, antidotes, respiratory, antimicrobials and misc.
// Sources: PALS 2020, APLS, ISPAD 2022, Harriet Lane Handbook, IAP, Indian national snakebite guideline, product labelling.

const FLUID = "Fluids & Metabolic";
const ANTI = "Antidotes & Toxicology";
const BRON = "Bronchodilators";
const ABX = "Antibiotics - Others";
const MISC = "Miscellaneous";

export const EMERGENCY_DRUGS_B: PediatricDrug[] = [
  // ---------- Fluids & metabolic ----------
  fixed({
    id: "iv-fluid-bolus", name: "Crystalloid Bolus (Normal Saline / Ringer Lactate)", genericName: "0.9% Sodium Chloride / Ringer Lactate", category: FLUID,
    standardDose: "10-20 mL/kg IV over 5-20 min, reassess after each bolus", route: "IV / IO", frequency: "Repeat as needed",
    maxDose: "Reassess after each 10-20 mL/kg; stop for hepatomegaly, crepitations or raised work of breathing", source: "PALS 2020 / WHO ETAT / Surviving Sepsis Children",
    indications: ["Hypovolaemic and septic shock", "Dehydration with shock"],
    formulations: ["0.9% saline 500 mL", "Ringer lactate 500 mL"],
  }, (w) => ({
    doseValue: `${fmt(20 * w)} mL (20 mL/kg) IV; use ${fmt(10 * w)} mL (10 mL/kg) in the cautious group`,
    unit: "mL",
    breakdown: `Standard: 20 mL/kg × ${fmt(w)} kg = ${fmt(20 * w)} mL over 5-20 minutes.\nCautious (10 mL/kg = ${fmt(10 * w)} mL): severe acute malnutrition, known heart disease, DKA, or severe anaemia.\nReassess perfusion, liver edge and chest after every bolus. Stop fluids if signs of overload appear and start inotropes.`,
    notes: "Use a balanced fluid where possible. In DKA, give 10 mL/kg over 30-60 minutes and then replace the deficit over 24-48 hours.",
  })),
  bolus({
    id: "dextrose-10", name: "Dextrose 10% (Hypoglycaemia)", genericName: "Glucose 10%", category: FLUID,
    standardDose: "2-5 mL/kg of 10% dextrose IV (0.2-0.5 g/kg)", route: "IV / IO", frequency: "Recheck glucose in 10 min, repeat if low",
    maxDose: "Do not use 25% or 50% dextrose undiluted in children", source: "APLS / IAP / PALS 2020",
    indications: ["Documented hypoglycaemia (glucose under 54 mg/dL, or under 70 with symptoms)", "Seizure with low glucose"],
    formulations: ["Dextrose 10%: 100 mg / mL"],
    perKg: [2, 5], unit: "mL", cap: 250, how: "of 10% dextrose IV",
    breakdownExtra: "After the bolus, start a maintenance infusion containing glucose (about 6-8 mg/kg/min) and recheck glucose hourly. Neonates: 2 mL/kg.",
    notes: "If no IV access: glucagon IM, or oral glucose gel if awake. Look for the cause (sepsis, adrenal crisis, inborn error).",
  }),
  bolus({
    id: "mannitol", name: "Mannitol 20%", genericName: "Mannitol", category: FLUID,
    standardDose: "0.25-1 g/kg IV over 20-30 min (max 50 g)", route: "IV", frequency: "Q4-6H PRN",
    maxDose: "Max: 50 g/dose", source: "Brain Trauma Foundation Paediatric / Harriet Lane",
    indications: ["Raised intracranial pressure with signs of herniation"],
    formulations: ["Infusion 20%: 0.2 g / mL (100 mL = 20 g)"],
    perKg: [0.25, 1], unit: "g", cap: 50, conc: { perMl: 0.2, label: "20% = 0.2 g/mL" }, how: "IV over 20-30 min",
    notes: "Needs a urinary catheter. Avoid in hypovolaemia or hypotension. Monitor serum osmolality (stop above 320) and sodium. Hypertonic saline is an alternative.",
  }),
  bolus({
    id: "hypertonic-saline-3", name: "Hypertonic Saline 3%", genericName: "3% Sodium Chloride", category: FLUID,
    standardDose: "2-5 mL/kg of 3% saline IV over 10-20 min", route: "IV", frequency: "May repeat on serum sodium",
    maxDose: "Max: 250 mL / dose", source: "Brain Trauma Foundation Paediatric / PALS",
    indications: ["Raised intracranial pressure", "Symptomatic hyponatraemia with seizures"],
    formulations: ["3% sodium chloride: 513 mEq / L"],
    perKg: [2, 5], unit: "mL", cap: 250, how: "of 3% saline IV over 10-20 min",
    breakdownExtra: "Hyponatraemic seizure: 2-3 mL/kg over 10 minutes, aim to raise sodium by 4-6 mEq/L.",
    notes: "Check sodium every 1-2 hours. Do not raise sodium faster than 10-12 mEq/L in 24 hours in chronic hyponatraemia (osmotic demyelination). Use a central line for infusions; a short peripheral bolus is acceptable.",
  }),
  fixed({
    id: "insulin-dka", name: "Insulin (DKA Infusion)", genericName: "Regular (Soluble) Insulin", category: FLUID,
    standardDose: "0.05-0.1 unit/kg/hour IV infusion, no bolus", route: "IV infusion", frequency: "Continuous",
    maxDose: "Start 1-2 hours AFTER fluids have been running", source: "ISPAD 2022",
    indications: ["Diabetic ketoacidosis"],
    formulations: ["Regular insulin 100 units / mL (vial): label in UNITS"],
  }, (w) => ({
    doseValue: `${fmt(0.05 * w)}-${fmt(0.1 * w)} units/hour IV infusion (0.05-0.1 unit/kg/h)`,
    unit: "units/h",
    breakdown: `0.05-0.1 unit/kg/h × ${fmt(w)} kg = ${fmt(0.05 * w)}-${fmt(0.1 * w)} units/hour.\nMixing: add 50 units regular insulin to 50 mL saline = 1 unit/mL. Then rate in mL/h equals units/h.\nStart ${fmt(0.05 * w)}-${fmt(0.1 * w)} mL/h. Do NOT give an insulin bolus.\nTarget glucose fall 2-5 mmol/L (36-90 mg/dL) per hour. Add dextrose when glucose is under 14 mmol/L (250 mg/dL); do not stop insulin.`,
    notes: "Start potassium replacement once potassium is under 5.5 mmol/L and urine is passing. Watch for cerebral oedema (headache, falling GCS): mannitol or hypertonic saline.",
  })),
  fixed({
    id: "glucagon", name: "Glucagon", genericName: "Glucagon", category: FLUID,
    standardDose: "Under 25 kg: 0.5 mg; 25 kg or more: 1 mg IM/SC", route: "IM / SC / IV", frequency: "Single dose",
    maxDose: "Max: 1 mg", source: "AAP / ISPAD",
    indications: ["Severe hypoglycaemia when IV access or oral glucose is not possible"],
    formulations: ["Injection: 1 mg vial with diluent"],
  }, (w) => {
    const d = w < 25 ? 0.5 : 1;
    return {
      doseValue: `${d} mg IM/SC`,
      unit: "mg",
      breakdown: `Weight ${fmt(w)} kg: ${w < 25 ? "under 25 kg → 0.5 mg" : "25 kg or more → 1 mg"} (equivalent to about 0.03 mg/kg).\nGlucose should rise within 10-15 minutes. Follow with oral carbohydrate or an IV glucose infusion.`,
      notes: "Little effect if glycogen stores are depleted (starvation, prolonged illness, adrenal insufficiency, neonates). Vomiting is common.",
    };
  }),

  // ---------- Antidotes & toxicology ----------
  fixed({
    id: "naloxone", name: "Naloxone", genericName: "Naloxone Hydrochloride", category: ANTI,
    standardDose: "0.01 mg/kg IV/IM/SC; full reversal 0.1 mg/kg (max 2 mg)", route: "IV / IM / SC / IN / ETT", frequency: "Repeat every 2-3 min as needed",
    maxDose: "Max: 2 mg/dose", source: "PALS 2020 / Harriet Lane",
    indications: ["Opioid-induced respiratory depression or coma"],
    formulations: ["Injection: 0.4 mg / mL"],
  }, (w) => {
    const start = Math.min(2, 0.01 * w), full = Math.min(2, 0.1 * w);
    return {
      doseValue: `${fmt(start)} mg start; up to ${fmt(full)} mg`,
      unit: "mg",
      breakdown: `Titrate: 0.01 mg/kg = ${fmt(0.01 * w)} mg (${fmt(start / 0.4)} mL of 0.4 mg/mL).\nFull reversal for poisoning (under 5 years or 20 kg): 0.1 mg/kg = ${fmt(0.1 * w)} mg, capped at 2 mg.\nSupport the airway and ventilate first.`,
      notes: "Half-life is shorter than most opioids: re-sedation is common, so observe at least 4-6 hours or start an infusion (about two-thirds of the effective dose per hour). Can precipitate acute withdrawal in dependent patients.",
    };
  }),
  bolus({
    id: "flumazenil", name: "Flumazenil", genericName: "Flumazenil", category: ANTI,
    standardDose: "0.01 mg/kg IV (max 0.2 mg), repeat every minute to max 0.05 mg/kg or 1 mg", route: "IV", frequency: "Repeat every 1 min",
    maxDose: "Max: 0.2 mg first dose; total 1 mg", source: "Harriet Lane / product labelling",
    indications: ["Reversal of benzodiazepine sedation in procedural sedation (not for routine overdose)"],
    formulations: ["Injection: 0.1 mg / mL"],
    perKg: 0.01, unit: "mg", cap: 0.2, conc: { perMl: 0.1, label: "0.1 mg/mL" }, how: "IV over 15 seconds",
    notes: "Can provoke seizures in benzodiazepine-dependent patients and in co-ingestion of tricyclics or proconvulsants. Short action: re-sedation likely.",
  }),
  fixed({
    id: "acetylcysteine", name: "N-Acetylcysteine (IV)", genericName: "Acetylcysteine", category: ANTI,
    standardDose: "150 mg/kg over 1 h, then 50 mg/kg over 4 h, then 100 mg/kg over 16 h", route: "IV infusion", frequency: "Three consecutive bags over 21 hours",
    maxDose: "Dose capped at 100 kg weight", source: "Product labelling / Rumack-Matthew nomogram",
    indications: ["Paracetamol overdose above the treatment line of the nomogram", "Unknown-time ingestion with a detectable level"],
    formulations: ["Injection: 200 mg / mL (6 g / 30 mL ampoule)"],
  }, (w) => {
    const wc = Math.min(w, 100);
    const small = w < 40;
    const v = small ? [3 * w, 7 * w, 14 * w] : [200, 500, 1000];
    return {
      doseValue: `${fmt(150 * wc)} mg over 1 h, then ${fmt(50 * wc)} mg over 4 h, then ${fmt(100 * wc)} mg over 16 h`,
      unit: "mg",
      breakdown: `Bag 1: 150 mg/kg = ${fmt(150 * wc)} mg (${fmt(150 * wc / 200)} mL of 200 mg/mL) in ${fmt(v[0])} mL 5% dextrose over 1 hour.\nBag 2: 50 mg/kg = ${fmt(50 * wc)} mg (${fmt(50 * wc / 200)} mL) in ${fmt(v[1])} mL 5% dextrose over 4 hours.\nBag 3: 100 mg/kg = ${fmt(100 * wc)} mg (${fmt(100 * wc / 200)} mL) in ${fmt(v[2])} mL 5% dextrose over 16 hours.\n${small ? "Under 40 kg: diluent volume 3, 7 and 14 mL/kg, to avoid fluid overload and hyponatraemia." : "40 kg or more: 200, 500 and 1000 mL."}`,
      notes: "Anaphylactoid reaction (flushing, wheeze) in the first hour: pause, treat and restart slower. Check ALT, INR and creatinine; continue beyond 21 hours if the INR or ALT is still rising. Oral regimen is an alternative.",
    };
  }),
  bolus({
    id: "pralidoxime", name: "Pralidoxime (2-PAM)", genericName: "Pralidoxime Chloride", category: ANTI,
    standardDose: "25-50 mg/kg IV over 30 min (max 2 g), then 10-20 mg/kg/h", route: "IV infusion", frequency: "Repeat every 6-12 h or as infusion",
    maxDose: "Max: 2 g/dose", source: "WHO / Harriet Lane",
    indications: ["Organophosphate poisoning with nicotinic features (weakness, fasciculations, respiratory failure)"],
    formulations: ["Injection: 1 g vial (powder)"],
    perKg: [25, 50], unit: "mg", cap: 2000, how: "IV over 30 min",
    breakdownExtra: "Dilute in 100 mL saline for the loading dose. Always give WITH atropine; atropine comes first.",
    notes: "Fast injection can cause laryngospasm, muscle rigidity and cardiac arrest. Little role in carbamate poisoning. Best within 24-48 hours of exposure.",
  }),
  bolus({
    id: "activated-charcoal", name: "Activated Charcoal", genericName: "Activated Charcoal", category: ANTI,
    standardDose: "1 g/kg PO/NG (max 50 g) within 1-2 hours of ingestion", route: "PO / NG", frequency: "Single dose",
    maxDose: "Max: 50 g", source: "AACT / EAPCCT position statement",
    indications: ["Recent ingestion of a charcoal-binding toxin with a protected airway"],
    formulations: ["Powder / suspension: 50 g in 250 mL"],
    perKg: 1, unit: "g", cap: 50, how: "PO/NG",
    notes: "Only if the airway is protected. Not for corrosives, hydrocarbons, alcohols, iron, lithium, or an ileus. Aspiration risk if consciousness is falling.",
  }),
  bolus({
    id: "methylene-blue", name: "Methylene Blue 1%", genericName: "Methylthioninium Chloride", category: ANTI,
    standardDose: "1-2 mg/kg IV over 5-10 min", route: "IV", frequency: "May repeat once after 30-60 min",
    maxDose: "Max: 7 mg/kg total", source: "Harriet Lane / product labelling",
    indications: ["Symptomatic methaemoglobinaemia (methaemoglobin above 20-30%, or symptomatic)"],
    formulations: ["Injection 1%: 10 mg / mL"],
    perKg: [1, 2], unit: "mg", conc: { perMl: 10, label: "1% = 10 mg/mL" }, how: "IV over 5-10 min",
    notes: "Contraindicated in G6PD deficiency (haemolysis). Serotonin syndrome with SSRIs. Interferes with pulse oximetry readings. Pulse oximetry sits near 85% in methaemoglobinaemia.",
  }),
  fixed({
    id: "anti-snake-venom", name: "Anti-Snake Venom (Polyvalent)", genericName: "Polyvalent Anti-Snake Venom (Indian)", category: ANTI,
    standardDose: "Initial 8-10 vials, SAME dose as adults (not reduced by weight)", route: "IV infusion", frequency: "Repeat per 20-minute whole blood clotting test",
    maxDose: "Dose is by venom effect, not by weight", source: "Indian national snakebite management guideline / WHO",
    indications: ["Systemic envenoming: coagulopathy (20WBCT positive), neurotoxicity, shock, severe local swelling"],
    formulations: ["Lyophilised polyvalent ASV: 10 mL vial (neutralises about 6 mg Russell's viper venom)"],
  }, (w) => ({
    doseValue: "10 vials initial (8-10), not weight-adjusted",
    unit: "vials",
    breakdown: `Children receive the SAME number of vials as adults because the venom load is not weight-dependent.\nDilute in isotonic fluid: 5-10 mL/kg here = ${fmt(5 * w)}-${fmt(10 * w)} mL. Infuse over 1 hour (slower for the first 15 minutes).\nRepeat the 20-minute whole blood clotting test 6 hours after the dose; repeat 5 vials if still unclotted. Neurotoxic bites: repeat after 1-2 hours if no improvement.\nHave adrenaline 0.01 mg/kg (0.01 mL/kg of 1:1000) IM drawn up before starting.`,
    notes: "Early anaphylactoid reactions are common: stop, give IM adrenaline, then restart slowly. Neurotoxic bites: neostigmine 0.04 mg/kg IV with atropine 0.02 mg/kg may help. Never give ASV for dry bites.",
  })),

  // ---------- Respiratory ----------
  fixed({
    id: "ipratropium", name: "Ipratropium Bromide (Nebulised)", genericName: "Ipratropium Bromide", category: BRON,
    standardDose: "Under 20 kg: 250 mcg; 20 kg or more: 500 mcg, every 20 min for 3 doses", route: "Nebulised", frequency: "Q20 min × 3, then Q4-6H",
    maxDose: "Max: 500 mcg/dose", source: "GINA / BTS",
    indications: ["Moderate to severe acute asthma, added to salbutamol", "Acute exacerbations of wheeze"],
    formulations: ["Nebuliser solution: 250 mcg / mL (0.025%)", "Duolin respule (salbutamol + ipratropium)"],
  }, (w) => {
    const d = w < 20 ? 250 : 500;
    return {
      doseValue: `${d} mcg nebulised Q20 min × 3`,
      unit: "mcg",
      breakdown: `Weight ${fmt(w)} kg: ${w < 20 ? "under 20 kg → 250 mcg (1 mL)" : "20 kg or more → 500 mcg (2 mL)"} mixed with the salbutamol nebule in saline to 3-4 mL.\nGive in the first hour only; stop after 3 doses if improving.`,
      notes: "Dry mouth; avoid eye contact (mydriasis, use a mask). No added benefit once the child is admitted and stable.",
    };
  }),
  fixed({
    id: "budesonide-neb", name: "Budesonide (Nebulised)", genericName: "Budesonide", category: BRON,
    standardDose: "Croup: 2 mg nebulised once; asthma: 0.5-1 mg", route: "Nebulised", frequency: "Single dose (croup)",
    maxDose: "Max: 2 mg", source: "Cochrane / Harriet Lane",
    indications: ["Croup (alternative or addition to dexamethasone)", "Mild to moderate asthma maintenance"],
    formulations: ["Respules: 0.5 mg / 2 mL, 1 mg / 2 mL"],
  }, (w) => ({
    doseValue: "2 mg nebulised once (croup)",
    unit: "mg",
    breakdown: `Weight ${fmt(w)} kg. Fixed dose, not weight-based.\nCroup: 2 mg (4 × 0.5 mg respules or 2 × 1 mg) via nebuliser. Dexamethasone 0.15-0.6 mg/kg oral is equally effective and preferred when the child can swallow.\nAsthma: 0.5-1 mg in 2 mL.`,
    notes: "Rinse the mouth afterwards. For stridor at rest give nebulised adrenaline (see Adrenaline card).",
  })),

  // ---------- Antimicrobials ----------
  bolus({
    id: "meropenem", name: "Meropenem", genericName: "Meropenem", category: ABX,
    standardDose: "20 mg/kg IV Q8H (meningitis 40 mg/kg Q8H), max 2 g/dose", route: "IV", frequency: "Q8H",
    maxDose: "Max: 2 g/dose", source: "Harriet Lane / IAP",
    indications: ["Severe sepsis with resistant Gram-negatives", "Meningitis (40 mg/kg)", "Intra-abdominal sepsis", "Febrile neutropenia"],
    formulations: ["Injection: 500 mg, 1 g vial"],
    perKg: 20, unit: "mg", cap: 2000, how: "IV Q8H over 15-30 min",
    breakdownExtra: "Meningitis or cystic fibrosis: 40 mg/kg per dose (max 2 g).",
    notes: "Reduce dose in renal impairment. Lowers valproate levels. Seizure risk is lower than imipenem.",
  }),
  bolus({
    id: "gentamicin", name: "Gentamicin", genericName: "Gentamicin Sulphate", category: ABX,
    standardDose: "5-7.5 mg/kg IV/IM once daily (over 1 month of age)", route: "IV / IM", frequency: "Once daily",
    maxDose: "Max: 480 mg/day", source: "Harriet Lane / IAP",
    indications: ["Sepsis (with a beta-lactam)", "Pyelonephritis", "Endocarditis synergy"],
    formulations: ["Injection: 40 mg / mL (80 mg / 2 mL)"],
    perKg: [5, 7.5], unit: "mg", cap: 480, conc: { perMl: 40, label: "40 mg/mL" }, how: "IV/IM once daily",
    breakdownExtra: "Neonates have different dosing and longer intervals: use the neonatal protocol.",
    notes: "Nephrotoxic and ototoxic. Check creatinine and, if more than 2-3 doses, a trough level (under 1 mg/L). Avoid with other nephrotoxins and in dehydration.",
  }),
  bolus({
    id: "amikacin", name: "Amikacin", genericName: "Amikacin Sulphate", category: ABX,
    standardDose: "15-22.5 mg/kg IV/IM once daily", route: "IV / IM", frequency: "Once daily",
    maxDose: "Max: 1.5 g/day", source: "Harriet Lane / IAP",
    indications: ["Gram-negative sepsis, including gentamicin-resistant organisms", "Febrile neutropenia (combination)"],
    formulations: ["Injection: 100 mg / 2 mL, 250 mg / 2 mL, 500 mg / 2 mL"],
    perKg: [15, 22.5], unit: "mg", cap: 1500, how: "IV/IM once daily",
    notes: "Nephrotoxic and ototoxic. Check renal function and trough level. Avoid with loop diuretics and other nephrotoxins. Neonatal dosing differs.",
  }),
  bolus({
    id: "piperacillin-tazobactam", name: "Piperacillin + Tazobactam", genericName: "Piperacillin-Tazobactam", category: ABX,
    standardDose: "100 mg/kg of piperacillin IV Q8H (max 4 g piperacillin / dose)", route: "IV", frequency: "Q6-8H",
    maxDose: "Max: 4 g piperacillin per dose", source: "Harriet Lane / IAP",
    indications: ["Hospital-acquired sepsis", "Intra-abdominal infection", "Febrile neutropenia", "Aspiration pneumonia"],
    formulations: ["Injection 4.5 g = piperacillin 4 g + tazobactam 0.5 g (8:1)", "Injection 1.125 g, 2.25 g"],
    perKg: 100, unit: "mg", cap: 4000, how: "of piperacillin IV Q8H over 30 min",
    breakdownExtra: "Dose is by the piperacillin component. 8:1 ratio, so the vial label total is 12.5% higher than the piperacillin amount.",
    notes: "Reduce dose in renal impairment. Penicillin allergy contraindicates it. Extended infusion over 3-4 hours is used in sepsis.",
  }),
  fixed({
    id: "linezolid", name: "Linezolid", genericName: "Linezolid", category: ABX,
    standardDose: "Under 12 years: 10 mg/kg Q8H; 12 years and older: 600 mg Q12H", route: "IV / PO", frequency: "Q8H (under 12 y) / Q12H",
    maxDose: "Max: 600 mg/dose", source: "Harriet Lane / product labelling",
    indications: ["MRSA and VRE infections", "Vancomycin-intolerant Gram-positive infection"],
    formulations: ["Injection: 2 mg / mL (300 mL bag)", "Tablet: 600 mg", "Suspension: 100 mg / 5 mL"],
  }, (w) => {
    if (w >= 40) return { doseValue: "600 mg IV/PO Q12H", unit: "mg", breakdown: `Weight ${fmt(w)} kg (adolescent / adult size): 600 mg Q12H.\n600 mg = 300 mL of the 2 mg/mL bag over 30-120 min.`, notes: "Myelosuppression after 10-14 days: check blood counts weekly. Serotonin syndrome with SSRIs." };
    const d = Math.min(600, 10 * w);
    return { doseValue: `${fmt(d)} mg IV/PO Q8H`, unit: "mg", breakdown: `10 mg/kg × ${fmt(w)} kg = ${fmt(10 * w)} mg per dose Q8H (max 600 mg).\nVolume of the 2 mg/mL infusion: ${fmt(d / 2)} mL over 30-120 min.`, notes: "Myelosuppression after 10-14 days: check blood counts weekly. Serotonin syndrome with SSRIs. Lactic acidosis with long courses." };
  }),
  bolus({
    id: "doxycycline", name: "Doxycycline", genericName: "Doxycycline", category: ABX,
    standardDose: "2.2 mg/kg PO/IV Q12H (max 100 mg/dose)", route: "PO / IV", frequency: "Q12H",
    maxDose: "Max: 100 mg/dose", source: "Harriet Lane / CDC (rickettsial infection)",
    indications: ["Scrub typhus and other rickettsial fevers", "Leptospirosis", "Cholera", "Doxycycline-sensitive atypical pneumonia"],
    formulations: ["Capsule / tablet: 100 mg", "Injection: 100 mg vial"],
    perKg: 2.2, unit: "mg", cap: 100, how: "PO/IV Q12H",
    notes: "Use it in suspected rickettsial infection at any age: the benefit outweighs the tooth-staining risk for a short course. Take with food and water, upright. Photosensitivity.",
  }),
  fixed({
    id: "oseltamivir", name: "Oseltamivir", genericName: "Oseltamivir Phosphate", category: "Anti-Viral",
    standardDose: "By weight: 15 kg or less 30 mg; 15-23 kg 45 mg; 23-40 kg 60 mg; over 40 kg 75 mg, Q12H × 5 days", route: "PO", frequency: "Q12H × 5 days",
    maxDose: "Max: 75 mg/dose", source: "CDC / WHO",
    indications: ["Influenza (H1N1, H3N2) in severe, high-risk or hospitalised children", "Post-exposure prophylaxis (once daily)"],
    formulations: ["Capsule: 30 mg, 45 mg, 75 mg", "Suspension: 6 mg / mL"],
  }, (w) => {
    if (w < 10) {
      return {
        doseValue: `${fmt(3 * w)} mg PO Q12H (3 mg/kg)`,
        unit: "mg",
        breakdown: `Infant under about 1 year: 3 mg/kg per dose Q12H × 5 days (3.5 mg/kg for 9-11 months).\n${fmt(3 * w)} mg = ${fmt((3 * w) / 6)} mL of the 6 mg/mL suspension.`,
        notes: "Start within 48 hours of onset, but treat severe illness even later. Reduce the dose in renal impairment.",
      };
    }
    const d = w <= 15 ? 30 : w <= 23 ? 45 : w <= 40 ? 60 : 75;
    return {
      doseValue: `${d} mg PO Q12H × 5 days`,
      unit: "mg",
      breakdown: `Weight ${fmt(w)} kg → ${d} mg per dose Q12H (${fmt(d / 6)} mL of the 6 mg/mL suspension).\nProphylaxis: same dose once daily for 7-10 days.`,
      notes: "Start within 48 hours of onset, but treat severe illness even later. Vomiting is common: give with food. Reduce the dose in renal impairment.",
    };
  }),
  bolus({
    id: "fluconazole", name: "Fluconazole", genericName: "Fluconazole", category: MISC,
    standardDose: "6-12 mg/kg PO/IV once daily (max 400 mg; load 12 mg/kg)", route: "PO / IV", frequency: "Once daily",
    maxDose: "Max: 400 mg/day (600 mg for severe infection)", source: "Harriet Lane / IDSA",
    indications: ["Candida infections", "Cryptococcal meningitis (after induction)", "Oropharyngeal candidiasis (3-6 mg/kg)"],
    formulations: ["Tablet: 50, 100, 150, 200 mg", "Injection: 2 mg / mL", "Suspension: 50 mg / 5 mL"],
    perKg: [6, 12], unit: "mg", cap: 400, how: "once daily",
    notes: "Interacts with many drugs (QT prolongation, warfarin, phenytoin). Reduce dose in renal impairment. Hepatotoxic.",
  }),
  fixed({
    id: "zinc", name: "Zinc Sulphate / Zinc Acetate", genericName: "Elemental Zinc", category: "Supplements/Vitamins",
    standardDose: "Under 6 months: 10 mg/day; 6 months and older: 20 mg/day, for 14 days", route: "PO", frequency: "Once daily × 14 days",
    maxDose: "20 mg elemental zinc/day", source: "WHO / IAP diarrhoea guidance",
    indications: ["Acute diarrhoea (with ORS)"],
    formulations: ["Dispersible tablet: 20 mg elemental zinc", "Syrup (brand dependent): check elemental zinc content"],
  }, (w) => ({
    doseValue: w < 6 ? "10 mg elemental zinc daily × 14 days" : "20 mg elemental zinc daily × 14 days",
    unit: "mg",
    breakdown: `Estimated age band from weight ${fmt(w)} kg: ${w < 6 ? "under about 6 months → 10 mg (half a 20 mg dispersible tablet)" : "6 months or older → 20 mg (one dispersible tablet)"}. Fixed dose, not per kg.\nGive the full 14 days even after the diarrhoea stops.`,
    notes: "Confirm the child's actual age. Mixing in a little water or breast milk. May cause mild vomiting.",
  })),
  bolus({
    id: "tranexamic-acid", name: "Tranexamic Acid", genericName: "Tranexamic Acid", category: MISC,
    standardDose: "15 mg/kg IV over 10 min (max 1 g), then 2 mg/kg/h for 8 h (max 1 g)", route: "IV", frequency: "Bolus then 8-hour infusion",
    maxDose: "Max: 1 g bolus", source: "PATCH-Trauma / CRASH-3 / Harriet Lane",
    indications: ["Major trauma with haemorrhage (within 3 hours of injury)", "Significant bleeding in other settings"],
    formulations: ["Injection: 100 mg / mL (500 mg / 5 mL)"],
    perKg: 15, unit: "mg", cap: 1000, conc: { perMl: 100, label: "100 mg/mL" }, how: "IV over 10 min",
    breakdownExtra: "Then 2 mg/kg/hour for 8 hours (maximum 1 g total). Dilute in saline.",
    notes: "Give within 3 hours of injury. Avoid in active thromboembolism and haematuria from the upper tract. Reduce dose in renal impairment. Seizures at high doses.",
  }),
  bolus({
    id: "hydralazine", name: "Hydralazine", genericName: "Hydralazine Hydrochloride", category: "Anti-Hypertensives",
    standardDose: "0.1-0.2 mg/kg IV/IM (max 20 mg) Q4-6H", route: "IV / IM", frequency: "Q4-6H PRN",
    maxDose: "Max: 20 mg/dose", source: "Harriet Lane / AAP hypertension guideline",
    indications: ["Hypertensive urgency or emergency", "Hypertension in acute glomerulonephritis"],
    formulations: ["Injection: 20 mg / mL"],
    perKg: [0.1, 0.2], unit: "mg", cap: 20, conc: { perMl: 20, label: "20 mg/mL, dilute" }, how: "IV slowly",
    notes: "Onset 10-20 min. Reflex tachycardia, headache, lupus-like syndrome. Lower the pressure gradually, by no more than 25% in the first 8 hours.",
  }),
  bolus({
    id: "labetalol", name: "Labetalol", genericName: "Labetalol Hydrochloride", category: "Anti-Hypertensives",
    standardDose: "0.2-1 mg/kg IV bolus (max 40 mg); infusion 0.25-3 mg/kg/h", route: "IV", frequency: "Q10 min PRN, or infusion",
    maxDose: "Max: 40 mg/bolus", source: "AAP hypertension guideline / Harriet Lane",
    indications: ["Hypertensive emergency", "Aortic dissection", "Hypertension in raised ICP (with care)"],
    formulations: ["Injection: 5 mg / mL (100 mg / 20 mL)"],
    perKg: [0.2, 1], unit: "mg", cap: 40, conc: { perMl: 5, label: "5 mg/mL" }, how: "IV slowly over 2 min",
    notes: "Avoid in asthma, heart block, bradycardia, heart failure and cocaine toxicity without alpha support. Monitor ECG and BP continuously. Lower pressure by no more than 25% in the first 8 hours.",
  }),
];