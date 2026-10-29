import { PediatricDrug } from "./pediatricDrugs_types";
import { bolus, infusion, fixed, fmt } from "./pediatricDrugs_emergency_builders";

// Resuscitation, arrhythmia, vasoactive infusions, intubation drugs, sedation/analgesia and seizure drugs.
// Sources: PALS 2020, APLS, Harriet Lane Handbook, IAP guidance, product labelling. Verify against your own department protocol.
// Adrenaline CPR / anaphylaxis / nebulised doses already live in the "Adrenaline" card (Bronchodilators).

const RESUS = "Resuscitation & Arrhythmia";
const VASO = "Vasoactive Infusions";
const RSI = "Intubation (RSI)";
const SEDA = "Sedation & Analgesia";
const CONV = "Anti-Convulsants";

export const EMERGENCY_DRUGS_A: PediatricDrug[] = [
  // ---------- Resuscitation & arrhythmia ----------
  bolus({
    id: "atropine", name: "Atropine", genericName: "Atropine Sulphate", category: RESUS,
    standardDose: "0.02 mg/kg IV/IO (max 0.5 mg child, 1 mg adolescent)", route: "IV / IO / IM", frequency: "May repeat once",
    maxDose: "Max: 0.5 mg/dose (1 mg if 40 kg or more)", source: "PALS 2020 / Harriet Lane",
    indications: ["Symptomatic bradycardia from vagal tone or AV block", "Pre-treatment before succinylcholine in infants", "Organophosphate / carbamate poisoning (see Pralidoxime)"],
    formulations: ["Injection: 0.6 mg / mL ampoule"],
    perKg: 0.02, unit: "mg", cap: (w) => (w >= 40 ? 1 : 0.5), conc: { perMl: 0.6, label: "0.6 mg/mL" }, how: "IV/IO",
    breakdownExtra: "Organophosphate poisoning: 0.02-0.05 mg/kg repeated every 5-10 min until secretions dry (atropinisation). Do not stop at a fixed total.",
    notes: "Bradycardia in children is usually from hypoxia: ventilate and give oxygen first, then adrenaline. No minimum dose in current PALS.",
  }),
  fixed({
    id: "adenosine", name: "Adenosine", genericName: "Adenosine", category: RESUS,
    standardDose: "1st dose 0.1 mg/kg (max 6 mg); 2nd dose 0.2 mg/kg (max 12 mg)", route: "IV / IO rapid push", frequency: "Single rapid push, repeat once",
    maxDose: "Max: 6 mg first dose, 12 mg second dose", source: "PALS 2020",
    indications: ["Supraventricular tachycardia (SVT) with a pulse"],
    formulations: ["Injection: 3 mg / mL (2 mL = 6 mg vial)"],
  }, (w) => {
    const d1 = Math.min(6, 0.1 * w), d2 = Math.min(12, 0.2 * w);
    return {
      doseValue: `1st: ${fmt(d1)} mg, 2nd: ${fmt(d2)} mg rapid IV`,
      unit: "mg",
      breakdown: `1st dose 0.1 mg/kg = ${fmt(0.1 * w)} mg (cap 6 mg) = ${fmt(d1 / 3)} mL of 3 mg/mL.\n2nd dose 0.2 mg/kg = ${fmt(0.2 * w)} mg (cap 12 mg) = ${fmt(d2 / 3)} mL.\nGive as a rapid push through a large proximal vein with a three-way tap, followed at once by a 5-10 mL saline flush. Record a rhythm strip during the push.`,
      notes: "Unstable SVT: synchronised cardioversion 0.5-1 J/kg, do not wait for adenosine. Warn the child of the brief chest discomfort. Avoid in wheezing asthma.",
    };
  }),
  bolus({
    id: "amiodarone", name: "Amiodarone", genericName: "Amiodarone Hydrochloride", category: RESUS,
    standardDose: "5 mg/kg IV/IO (max 300 mg)", route: "IV / IO", frequency: "May repeat up to 15 mg/kg/day",
    maxDose: "Max: 300 mg first dose", source: "PALS 2020",
    indications: ["Pulseless VF / VT unresponsive to shocks", "Stable ventricular tachycardia", "Refractory SVT (specialist advice)"],
    formulations: ["Injection: 50 mg / mL (150 mg / 3 mL ampoule)"],
    perKg: 5, unit: "mg", cap: 300, conc: { perMl: 50, label: "50 mg/mL" }, how: "IV/IO",
    breakdownExtra: "Cardiac arrest: rapid push. Perfusing rhythm: dilute in 5% dextrose and give over 20-60 minutes with ECG and BP monitoring.",
    notes: "Hypotension and bradycardia with fast infusion in a perfusing child. Prolongs QT. Use dextrose, not saline, for dilution.",
  }),
  bolus({
    id: "lidocaine", name: "Lidocaine (Lignocaine) 2%", genericName: "Lidocaine Hydrochloride", category: RESUS,
    standardDose: "1 mg/kg IV/IO (max 100 mg); infusion 20-50 mcg/kg/min", route: "IV / IO", frequency: "May repeat; then infusion",
    maxDose: "Max: 100 mg/dose", source: "PALS 2020",
    indications: ["VF / pulseless VT when amiodarone is unavailable", "Ventricular arrhythmias"],
    formulations: ["Injection 2%: 20 mg / mL (use the plain, preservative-free, non-adrenaline vial)"],
    perKg: 1, unit: "mg", cap: 100, conc: { perMl: 20, label: "2% = 20 mg/mL" }, how: "IV/IO",
    breakdownExtra: "Infusion 20-50 mcg/kg/min only after a bolus.",
    notes: "Never use the adrenaline-containing dental or local vial intravenously. Toxicity: perioral numbness, seizures, bradycardia.",
  }),
  bolus({
    id: "magnesium-sulfate", name: "Magnesium Sulphate 50%", genericName: "Magnesium Sulfate", category: RESUS,
    standardDose: "25-50 mg/kg IV (max 2 g) over 15-20 min", route: "IV / IO", frequency: "Single dose (repeat on advice)",
    maxDose: "Max: 2 g/dose", source: "PALS 2020 / GINA",
    indications: ["Torsades de pointes (rapid push if pulseless)", "Severe or life-threatening acute asthma not responding to nebulisers", "Hypomagnesaemia"],
    formulations: ["Injection 50%: 500 mg / mL (dilute to 10-20% before IV use)"],
    perKg: [25, 50], unit: "mg", cap: 2000, conc: { perMl: 500, label: "50% = 500 mg/mL, then dilute" }, how: "IV over 15-20 min",
    breakdownExtra: "Asthma: 40-50 mg/kg (max 2 g) over 20 minutes. Dilute with saline or dextrose to 10-20% (100-200 mg/mL).",
    notes: "Watch for hypotension, loss of knee jerks, respiratory depression. Calcium gluconate reverses toxicity. Reduce dose in renal failure.",
  }),
  bolus({
    id: "calcium-gluconate", name: "Calcium Gluconate 10%", genericName: "Calcium Gluconate", category: RESUS,
    standardDose: "60 mg/kg = 0.6 mL/kg of 10% (max 2 g = 20 mL) slow IV", route: "IV / IO", frequency: "Single dose, repeat on ionised calcium",
    maxDose: "Max: 2 g (20 mL) / dose", source: "PALS 2020 / Harriet Lane",
    indications: ["Hyperkalaemia with ECG changes", "Symptomatic hypocalcaemia", "Calcium-channel blocker / magnesium toxicity"],
    formulations: ["Injection 10%: 100 mg / mL (0.465 mEq / mL)"],
    perKg: 60, unit: "mg", cap: 2000, conc: { perMl: 100, label: "10% = 100 mg/mL" }, how: "slow IV over 5-10 min",
    breakdownExtra: "Give over 5-10 minutes with continuous ECG. In cardiac arrest it may be given faster through a secure line.",
    notes: "Extravasation causes severe tissue necrosis: confirm the cannula first. Do not mix with sodium bicarbonate or phosphate. Use with great caution in digoxin toxicity.",
  }),
  bolus({
    id: "sodium-bicarbonate", name: "Sodium Bicarbonate 8.4%", genericName: "Sodium Bicarbonate", category: RESUS,
    standardDose: "1 mEq/kg IV slow (1 mL/kg of 8.4%)", route: "IV / IO", frequency: "Single dose, repeat on blood gas",
    maxDose: "Max: 50 mEq / dose", source: "PALS 2020 / Harriet Lane",
    indications: ["Hyperkalaemia", "Sodium-channel blocker poisoning (TCA)", "Severe metabolic acidosis with a documented pH", "Prolonged cardiac arrest (not routine)"],
    formulations: ["Injection 8.4%: 1 mEq / mL", "Injection 4.2%: 0.5 mEq / mL (infants)"],
    perKg: 1, unit: "mEq", cap: 50, conc: { perMl: 1, label: "8.4% = 1 mEq/mL" }, how: "IV slowly",
    breakdownExtra: "Under 10 kg or infants: dilute 1:1 with sterile water to 4.2% (0.5 mEq/mL) and give over at least 10 minutes. Flush the line before and after.",
    notes: "Causes hypernatraemia, hypokalaemia, hypocalcaemia and tissue necrosis if extravasated. Precipitates with calcium. Ensure ventilation first: it generates CO2.",
  }),

  // ---------- Vasoactive infusions ----------
  infusion({
    id: "noradrenaline", name: "Noradrenaline (Norepinephrine)", genericName: "Norepinephrine Bitartrate", category: VASO,
    standardDose: "0.05-2 mcg/kg/min IV infusion", route: "IV infusion (central line preferred)", frequency: "Continuous",
    maxDose: "Titrate to MAP; usual max 2 mcg/kg/min", source: "Surviving Sepsis Children 2020 / Harriet Lane",
    indications: ["Fluid-refractory septic shock with low systemic vascular resistance (warm shock)", "Vasodilatory shock"],
    formulations: ["Injection: 4 mg / 2 mL ampoule (2 mg / mL)"],
    range: [0.05, 2], notes: "Can run peripherally for a short period through a good proximal vein with close site checks. Extravasation: phentolamine infiltration. Start low and titrate every few minutes.",
  }),
  infusion({
    id: "adrenaline-infusion", name: "Adrenaline Infusion", genericName: "Epinephrine", category: VASO,
    standardDose: "0.05-1 mcg/kg/min IV infusion", route: "IV infusion (central line preferred)", frequency: "Continuous",
    maxDose: "Titrate to perfusion; usual max 1 mcg/kg/min", source: "PALS 2020 / Surviving Sepsis Children 2020",
    indications: ["Fluid-refractory septic shock with poor perfusion (cold shock)", "Post-arrest myocardial dysfunction", "Cardiogenic shock", "Refractory anaphylaxis"],
    formulations: ["Injection: 1 mg / mL (1:1000) ampoule"],
    range: [0.05, 1], notes: "Dilute 1 mg/mL ampoule well: a ten-fold concentration error is fatal. Double-check with a second person. Lactate may rise from the drug itself.",
  }),
  infusion({
    id: "milrinone", name: "Milrinone", genericName: "Milrinone Lactate", category: VASO,
    standardDose: "0.25-0.75 mcg/kg/min IV infusion (loading usually omitted in shock)", route: "IV infusion", frequency: "Continuous",
    maxDose: "Max: 0.75 mcg/kg/min", source: "Harriet Lane / PALS",
    indications: ["Low cardiac output with high systemic resistance", "Cardiogenic shock after myocarditis or cardiac surgery"],
    formulations: ["Injection: 10 mg / 10 mL (1 mg / mL)"],
    range: [0.25, 0.75], notes: "Vasodilator: causes hypotension, so often given without the loading dose. Dose-reduce in renal impairment. Long half-life.",
  }),
  infusion({
    id: "nitroglycerin", name: "Nitroglycerin (Glyceryl Trinitrate)", genericName: "Nitroglycerin", category: VASO,
    standardDose: "0.5-5 mcg/kg/min IV infusion (max 10)", route: "IV infusion", frequency: "Continuous",
    maxDose: "Max: 10 mcg/kg/min", source: "Harriet Lane",
    indications: ["Acute heart failure with raised afterload", "Hypertensive emergency with pulmonary oedema", "Coronary vasospasm"],
    formulations: ["Injection: 5 mg / mL (use glass or non-PVC set)"],
    range: [0.5, 5], notes: "Hypotension and headache. Tolerance develops within 24-48 hours. Absorbed by standard PVC tubing.",
  }),

  // ---------- Intubation (RSI) ----------
  bolus({
    id: "etomidate", name: "Etomidate", genericName: "Etomidate", category: RSI,
    standardDose: "0.3 mg/kg IV (max 20 mg)", route: "IV", frequency: "Single induction dose",
    maxDose: "Max: 20 mg", source: "PALS / Harriet Lane",
    indications: ["Induction for rapid sequence intubation, especially if haemodynamically unstable"],
    formulations: ["Injection: 2 mg / mL (10 mL ampoule)"],
    perKg: 0.3, unit: "mg", cap: 20, conc: { perMl: 2, label: "2 mg/mL" }, how: "IV push",
    notes: "Suppresses adrenal function: avoid or give hydrocortisone in septic shock. Myoclonus and vomiting. Not licensed under 10 years but widely used.",
  }),
  bolus({
    id: "propofol", name: "Propofol", genericName: "Propofol", category: RSI,
    standardDose: "2-3 mg/kg IV induction", route: "IV", frequency: "Single induction dose",
    maxDose: "Titrate; do not exceed adult dose", source: "Product labelling / Harriet Lane",
    indications: ["Induction for intubation when blood pressure is stable", "Procedural sedation by trained staff"],
    formulations: ["Emulsion: 10 mg / mL (1%)"],
    perKg: [2, 3], unit: "mg", cap: 200, conc: { perMl: 10, label: "1% = 10 mg/mL" }, how: "IV slowly to effect",
    notes: "Hypotension and apnoea. Avoid in shock or hypovolaemia. Pain on injection. Not for prolonged infusion in children (propofol infusion syndrome). Egg and soy allergy caution.",
  }),
  bolus({
    id: "rocuronium", name: "Rocuronium", genericName: "Rocuronium Bromide", category: RSI,
    standardDose: "1-1.2 mg/kg IV for RSI", route: "IV", frequency: "Single dose; effect 30-60 min",
    maxDose: "Max: 100 mg", source: "Harriet Lane / product labelling",
    indications: ["Neuromuscular blockade for rapid sequence intubation when succinylcholine is contraindicated"],
    formulations: ["Injection: 10 mg / mL (50 mg / 5 mL)"],
    perKg: [1, 1.2], unit: "mg", cap: 100, conc: { perMl: 10, label: "10 mg/mL" }, how: "IV push",
    notes: "Give only after induction and with airway skills available. Duration is long: have a plan for ventilation. Reversal: sugammadex 16 mg/kg for immediate reversal if available.",
  }),
  bolus({
    id: "succinylcholine", name: "Succinylcholine (Suxamethonium)", genericName: "Suxamethonium Chloride", category: RSI,
    standardDose: "1-2 mg/kg IV (infants 2 mg/kg); IM 4 mg/kg", route: "IV / IM", frequency: "Single dose; effect 5-10 min",
    maxDose: "Max: 150 mg", source: "Harriet Lane / product labelling",
    indications: ["Neuromuscular blockade for rapid sequence intubation"],
    formulations: ["Injection: 50 mg / mL (10 mL vial)", "Injection: 100 mg / 2 mL"],
    perKg: [1, 2], unit: "mg", cap: 150, conc: { perMl: 50, label: "50 mg/mL" }, how: "IV push",
    breakdownExtra: "IM (no IV access): 4 mg/kg.",
    notes: "Contraindicated in hyperkalaemia, burns or crush over 24-48 h, neuromuscular disease, malignant hyperthermia history. Bradycardia in infants: have atropine ready. Keep vials refrigerated.",
  }),

  // ---------- Sedation & analgesia ----------
  bolus({
    id: "midazolam-sedation", name: "Midazolam (Sedation)", genericName: "Midazolam", category: SEDA,
    standardDose: "IV 0.05-0.1 mg/kg (max 5 mg); intranasal 0.2-0.3 mg/kg; oral 0.5 mg/kg", route: "IV / IN / PO", frequency: "Titrate; repeat after 3-5 min",
    maxDose: "Max: 5 mg/dose IV", source: "Harriet Lane / APLS",
    indications: ["Procedural sedation and anxiolysis", "Pre-medication"],
    formulations: ["Injection: 1 mg / mL, 5 mg / mL"],
    perKg: [0.05, 0.1], unit: "mg", cap: 5, conc: { perMl: 1, label: "1 mg/mL" }, how: "IV slowly, titrated",
    notes: "Respiratory depression: monitor SpO2 continuously and keep oxygen, suction and flumazenil available. Paradoxical agitation can occur. Reduce dose with opioids.",
  }),
  bolus({
    id: "ketamine", name: "Ketamine", genericName: "Ketamine Hydrochloride", category: SEDA,
    standardDose: "IV 1-2 mg/kg; IM 4-5 mg/kg; analgesia 0.1-0.3 mg/kg IV", route: "IV / IM", frequency: "Single dose; repeat half dose",
    maxDose: "Titrate; usual max 100-150 mg IV", source: "ACEP / Harriet Lane",
    indications: ["Procedural sedation / dissociation", "Induction for intubation (including asthma and shock)", "Low-dose analgesia"],
    formulations: ["Injection: 50 mg / mL (10 mL vial)", "Injection: 10 mg / mL"],
    perKg: [1, 2], unit: "mg", cap: 150, conc: { perMl: 50, label: "50 mg/mL" }, how: "IV over 1-2 min",
    breakdownExtra: "IM: 4-5 mg/kg. Sub-dissociative analgesia: 0.1-0.3 mg/kg IV over 10-15 minutes.",
    notes: "Laryngospasm risk, mainly in infants under 12 months and with active respiratory infection. Emergence reactions: a quiet room helps. Avoid in psychosis. Raised BP and HR.",
  }),
  bolus({
    id: "fentanyl", name: "Fentanyl", genericName: "Fentanyl Citrate", category: SEDA,
    standardDose: "1-2 mcg/kg IV (max 100 mcg); intranasal 1.5 mcg/kg", route: "IV / IN", frequency: "Q30-60 min PRN",
    maxDose: "Max: 100 mcg/dose", source: "Harriet Lane / APLS",
    indications: ["Severe acute pain", "Analgesia for procedures", "Part of RSI"],
    formulations: ["Injection: 50 mcg / mL"],
    perKg: [1, 2], unit: "mcg", cap: 100, conc: { perMl: 50, label: "50 mcg/mL" }, how: "IV slowly over 3-5 min",
    breakdownExtra: "Intranasal: 1.5 mcg/kg (max 100 mcg), half in each nostril, using the concentrated 50 mcg/mL solution.",
    notes: "Chest-wall rigidity with a fast push. Respiratory depression: keep naloxone available. Monitor SpO2 and sedation score.",
  }),
  bolus({
    id: "morphine", name: "Morphine", genericName: "Morphine Sulphate", category: SEDA,
    standardDose: "0.05-0.1 mg/kg IV (max 5 mg initial)", route: "IV / IM / SC", frequency: "Q2-4H PRN",
    maxDose: "Max: 5 mg per initial IV dose", source: "Harriet Lane / BNFc",
    indications: ["Severe pain (fractures, burns, sickle crisis)", "Pulmonary oedema"],
    formulations: ["Injection: 10 mg / mL (dilute to 1 mg/mL)"],
    perKg: [0.05, 0.1], unit: "mg", cap: 5, conc: { perMl: 1, label: "diluted to 1 mg/mL" }, how: "IV slowly over 5 min",
    notes: "Respiratory depression, hypotension, histamine release, vomiting. Use reduced doses and monitor under 1 year. Renal impairment: accumulates. Keep naloxone ready.",
  }),
  fixed({
    id: "tramadol", name: "Tramadol", genericName: "Tramadol Hydrochloride", category: SEDA,
    standardDose: "1-2 mg/kg PO/IV (max 100 mg/dose); 12 years and older only", route: "PO / IV", frequency: "Q6-8H PRN",
    maxDose: "Max: 100 mg/dose, 400 mg/day", source: "Product labelling",
    indications: ["Moderate pain in adolescents when simple analgesics fail"],
    formulations: ["Tablet: 50 mg", "Injection: 50 mg / mL"],
  }, (w) => {
    if (w < 35) {
      return {
        doseValue: "Not advised under 12 years",
        unit: "mg",
        breakdown: `Weight ${fmt(w)} kg. Tramadol is not recommended under 12 years (ultra-rapid metabolisers, respiratory depression).`,
        notes: "Use paracetamol, ibuprofen, or a titrated opioid with monitoring.",
      };
    }
    const d1 = Math.min(100, w), d2 = Math.min(100, 2 * w);
    return {
      doseValue: `${fmt(d1)}-${fmt(d2)} mg PO/IV Q6-8H`,
      unit: "mg",
      breakdown: `1-2 mg/kg × ${fmt(w)} kg = ${fmt(w)}-${fmt(2 * w)} mg, capped at 100 mg per dose and 400 mg per day.`,
      notes: "Lowers seizure threshold. Serotonin syndrome with SSRIs. Avoid after tonsillectomy and in breathing problems.",
    };
  }),
  bolus({
    id: "ketorolac", name: "Ketorolac", genericName: "Ketorolac Tromethamine", category: SEDA,
    standardDose: "0.5 mg/kg IV/IM (max 15 mg/dose) Q6H, up to 48 hours", route: "IV / IM", frequency: "Q6H, max 48 h",
    maxDose: "Max: 15 mg/dose, 60 mg/day", source: "Harriet Lane / product labelling",
    indications: ["Moderate to severe pain: renal colic, fractures, post-procedure"],
    formulations: ["Injection: 30 mg / mL (use a 15 mg portion)", "Injection: 15 mg / mL"],
    perKg: 0.5, unit: "mg", cap: 15, conc: { perMl: 15, label: "15 mg/mL" }, how: "IV/IM",
    notes: "Avoid with dehydration, renal impairment, bleeding risk, asthma triggered by NSAIDs, or other NSAIDs. Maximum 48-72 hours.",
  }),

  // ---------- Anticonvulsants ----------
  bolus({
    id: "midazolam-seizure", name: "Midazolam (Seizure)", genericName: "Midazolam", category: CONV,
    standardDose: "Buccal/IN/IM 0.2-0.3 mg/kg (max 10 mg); IV 0.1 mg/kg (max 5 mg)", route: "Buccal / IN / IM / IV", frequency: "May repeat once after 10 min",
    maxDose: "Max: 10 mg buccal / IM, 5 mg IV", source: "NICE / APLS / IAP status epilepticus guidance",
    indications: ["Active seizure first-line when there is no IV access", "Status epilepticus"],
    formulations: ["Injection: 5 mg / mL (used buccally or intranasally)", "Buccal solution: 10 mg / 2 mL pre-filled"],
    perKg: [0.2, 0.3], unit: "mg", cap: 10, conc: { perMl: 5, label: "5 mg/mL" }, how: "buccal / IN / IM",
    breakdownExtra: "If IV access is present: 0.1 mg/kg (max 5 mg) given slowly over 2 minutes.",
    notes: "Respiratory depression: monitor SpO2 and keep bag-valve mask ready. If seizure continues 5-10 minutes after two benzodiazepine doses, move to second-line (levetiracetam, phenytoin, valproate).",
  }),
  bolus({
    id: "lorazepam", name: "Lorazepam", genericName: "Lorazepam", category: CONV,
    standardDose: "0.1 mg/kg IV (max 4 mg)", route: "IV", frequency: "May repeat once after 5-10 min",
    maxDose: "Max: 4 mg/dose", source: "PALS / Neurocritical Care Society",
    indications: ["Active seizure and status epilepticus with IV access"],
    formulations: ["Injection: 2 mg / mL (store in refrigerator)", "Injection: 4 mg / mL"],
    perKg: 0.1, unit: "mg", cap: 4, conc: { perMl: 2, label: "2 mg/mL, dilute 1:1" }, how: "IV slowly over 2 min",
    notes: "Respiratory depression. Dilute with an equal volume of saline. Propylene glycol content matters with prolonged use.",
  }),
  bolus({
    id: "levetiracetam", name: "Levetiracetam IV", genericName: "Levetiracetam", category: CONV,
    standardDose: "Loading 40-60 mg/kg IV (max 4500 mg) over 15 min", route: "IV", frequency: "Single loading dose, then maintenance",
    maxDose: "Max: 4500 mg loading", source: "ESETT trial / ILAE",
    indications: ["Second-line for benzodiazepine-resistant seizures", "Status epilepticus"],
    formulations: ["Injection: 500 mg / 5 mL (100 mg / mL), dilute in 100 mL saline for adults, smaller volume in children"],
    perKg: [40, 60], unit: "mg", cap: 4500, conc: { perMl: 100, label: "100 mg/mL, dilute before use" }, how: "IV over 15 min",
    breakdownExtra: "Maintenance 20-30 mg/kg/day in 2 divided doses, per local protocol.",
    notes: "Few interactions and little haemodynamic effect. Behavioural side-effects. Reduce dose in renal impairment.",
  }),
];