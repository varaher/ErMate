// Safety notices for the Pediatric Drug Calculator.
// These NEVER change a calculated dose. They only warn the clinician where a
// weight-based result can exceed an adult ceiling, or where a drug is
// restricted/contraindicated in children. Any dose change needs clinician sign-off.

export type SafetySeverity = "danger" | "warn";

export interface DrugSafetyNotice {
  severity: SafetySeverity;
  text: string;
}

/** At or above this weight, weight-based results can exceed the usual adult dose. */
export const ADULT_CEILING_WEIGHT_KG = 40;

interface Rule {
  match: RegExp;
  severity: SafetySeverity;
  text: string;
}

const RULES: Rule[] = [
  { match: /nimesulide/, severity: "danger", text: "Nimesulide is prohibited in children under 12 years in India (CDSCO). Prefer paracetamol or ibuprofen." },
  { match: /codeine/, severity: "danger", text: "Codeine is contraindicated under 12 years and not advised in adolescents with breathing problems or after tonsillectomy (ultra-rapid metabolisers)." },
  { match: /aspirin|acetylsalicylic/, severity: "danger", text: "Avoid aspirin under 16 years (Reye syndrome) except Kawasaki disease or rheumatic fever under specialist direction." },
  { match: /tetracycline|doxycycline/, severity: "warn", text: "Tetracyclines stain developing teeth: avoid under 8 years unless benefit clearly outweighs risk (e.g. rickettsial or scrub typhus, cholera)." },
  { match: /co-?trimoxazole|trimethoprim|septran|bactrim/, severity: "warn", text: "Co-trimoxazole is contraindicated under 6 weeks of age. Dose is by trimethoprim component." },
  { match: /ciprofloxacin|levofloxacin|ofloxacin|norfloxacin|moxifloxacin|sparfloxacin|gatifloxacin|pefloxacin|floxacin/, severity: "warn", text: "Fluoroquinolones: not first line in children (tendon and joint risk). Use only for specific indications. Sparfloxacin, gatifloxacin and pefloxacin may be withdrawn in India: verify availability." },
  { match: /promethazine/, severity: "danger", text: "Promethazine is contraindicated under 2 years (fatal respiratory depression)." },
  { match: /metoclopramide/, severity: "warn", text: "Metoclopramide: avoid under 1 year; risk of dystonic reactions. Maximum 0.5 mg/kg/day, short course only." },
  { match: /nifedipine/, severity: "warn", text: "Avoid sublingual or bitten-capsule nifedipine in children (abrupt hypotension). Use oral, with monitoring." },
  { match: /ranitidine/, severity: "warn", text: "Ranitidine has been withdrawn or restricted in many markets (NDMA contamination). Verify availability; consider famotidine or a PPI." },
  { match: /benzathine/, severity: "warn", text: "Benzathine penicillin is dosed by weight: under 27 kg 6 lakh units, 27 kg or more 12 lakh units. Use only the band that matches the child. Deep IM only, never IV." },
  { match: /heparin/, severity: "danger", text: "Heparin is prescribed in UNITS (not mcg or mg). Confirm unit labelling and vial strength with pharmacy before drawing up." },
  { match: /digoxin/, severity: "danger", text: "Digoxin: narrow therapeutic index. Daily doses above 0.5 mg are not usual. Check potassium, renal function and ECG; verify with a paediatric cardiologist." },
  { match: /diazepam/, severity: "warn", text: "Verify tetanus IV dose before use: the listed per-kg range is much higher than usual single-dose IV diazepam (about 0.1-0.3 mg/kg). Check whether the figure is per day." },
  { match: /terbutaline/, severity: "warn", text: "Verify nebulised terbutaline dose: the listed per-kg wording is unusual (nebulised doses are normally fixed mg per dose, e.g. 2.5-5 mg)." },
  { match: /acetazolamide/, severity: "warn", text: "Adult maximum is about 1 g/day. At higher weights the hydrocephalus range exceeds this." },
  { match: /adrenaline|epinephrine/, severity: "warn", text: "IM anaphylaxis dose is capped at 0.5 mg (0.5 mL of 1:1000) per dose. IV bolus in CPR max 1 mg (10 mL of 1:10,000)." },
  { match: /co-?amox|amoxicillin.*clav|augmentin|clavulan/, severity: "warn", text: "Co-amoxiclav: more than one regimen is listed. Dose by the amoxicillin component and confirm which suspension strength you are using (e.g. 228.5 vs 457 per 5 mL)." },
  { match: /ceftriaxone/, severity: "warn", text: "Ceftriaxone: avoid in neonates with hyperbilirubinaemia and never mix or co-infuse with calcium-containing fluids. Meningitis daily total should not exceed 4 g." },
  { match: /dicyclomine/, severity: "danger", text: "Dicyclomine is contraindicated under 6 months (apnoea, respiratory distress, seizures). Oral only in children: the injection is for adults, IM only." },
  { match: /hyoscine|buscopan/, severity: "warn", text: "Hyoscine butylbromide is anticholinergic: avoid in glaucoma, ileus/obstruction, myasthenia gravis and tachyarrhythmia. Do not use to mask a surgical abdomen. Use under 6 years is off-label." },
  { match: /drotaverine/, severity: "warn", text: "Drotaverine: labelled from 1 year of age, oral in children. Do not use to mask a surgical abdomen. Avoid in low cardiac output or severe hepatic/renal impairment." },
  { match: /succinylcholine|suxamethonium/, severity: "danger", text: "Succinylcholine: contraindicated in hyperkalaemia, burns or crush injury over 24-48 h, neuromuscular disease and malignant hyperthermia history. Bradycardia in infants: have atropine ready." },
  { match: /flumazenil/, severity: "danger", text: "Flumazenil can provoke seizures in benzodiazepine-dependent patients and in mixed overdose (tricyclics). Not for routine overdose reversal." },
  { match: /tramadol/, severity: "danger", text: "Tramadol is not recommended under 12 years (ultra-rapid metabolisers, respiratory depression). Lowers seizure threshold." },
  { match: /insulin/, severity: "danger", text: "High-alert drug. Prescribe in UNITS, no bolus in DKA, start 1-2 hours after fluids. Check potassium before and during. Watch for cerebral oedema." },
  { match: /noradrenaline|norepinephrine|adrenaline infusion/, severity: "danger", text: "High-alert infusion. A ten-fold concentration error is fatal. Prefer a central line, double-check the mixing with a second person, and monitor BP continuously. Extravasation causes tissue necrosis." },
  { match: /methylene blue|methylthioninium/, severity: "danger", text: "Methylene blue: contraindicated in G6PD deficiency (haemolysis). Serotonin syndrome with SSRIs. Distorts pulse oximetry." },
  { match: /midazolam|lorazepam/, severity: "warn", text: "Benzodiazepine: respiratory depression, especially combined with opioids. Continuous SpO2, oxygen and bag-valve mask at the bedside. Flumazenil is not a routine rescue." },
  { match: /fentanyl|morphine/, severity: "warn", text: "Opioid: respiratory depression and hypotension. Monitor SpO2 and sedation score, give the smallest effective dose, and keep naloxone available. Fentanyl: chest-wall rigidity with a fast push." },
  { match: /ketamine/, severity: "warn", text: "Ketamine: laryngospasm (infants and active airway infection), emergence reactions, raised BP and HR. Give by someone able to manage the airway." },
  { match: /etomidate/, severity: "warn", text: "Etomidate suppresses adrenal function: avoid or cover with hydrocortisone in septic shock. Myoclonus on injection." },
  { match: /propofol/, severity: "warn", text: "Propofol: hypotension and apnoea. Avoid in shock or hypovolaemia. Not for prolonged infusion in children (propofol infusion syndrome)." },
  { match: /rocuronium/, severity: "warn", text: "Neuromuscular blocker: give only after induction and with an airway plan. Long duration. Sugammadex reverses if available." },
  { match: /ketorolac/, severity: "warn", text: "Ketorolac: avoid with dehydration, renal impairment, bleeding risk or NSAID-sensitive asthma. Maximum 48-72 hours." },
  { match: /adenosine/, severity: "warn", text: "Adenosine must be a rapid push through a proximal vein, followed at once by a saline flush. Avoid in wheezing asthma. Unstable SVT needs cardioversion, not adenosine." },
  { match: /amiodarone/, severity: "warn", text: "Amiodarone: hypotension and bradycardia with a fast infusion in a perfusing child; prolongs QT. Dilute in dextrose, not saline." },
  { match: /lidocaine|lignocaine/, severity: "warn", text: "Never give the adrenaline-containing vial intravenously. Toxicity: perioral numbness, seizures, bradycardia." },
  { match: /atropine/, severity: "warn", text: "Atropine for bradycardia: ventilate and oxygenate first. Organophosphate poisoning needs titrated repeated doses until secretions dry." },
  { match: /magnesium sulphate|magnesium sulfate/, severity: "warn", text: "Magnesium: hypotension, loss of reflexes and respiratory depression with excess. Calcium gluconate reverses toxicity. Reduce the dose in renal failure." },
  { match: /calcium gluconate/, severity: "warn", text: "Calcium: extravasation causes severe necrosis. Slow IV with ECG monitoring. Do not mix with bicarbonate. Caution in digoxin toxicity." },
  { match: /sodium bicarbonate/, severity: "warn", text: "Bicarbonate: ensure ventilation first, dilute to 4.2% in infants, and flush the line (precipitates with calcium). Causes hypokalaemia and hypernatraemia." },
  { match: /mannitol|hypertonic saline/, severity: "warn", text: "Raised-ICP osmotherapy: monitor sodium, osmolality and blood pressure. Avoid mannitol in hypovolaemia. Correct sodium no faster than 10-12 mEq/L per 24 h in chronic hyponatraemia." },
  { match: /acetylcysteine/, severity: "warn", text: "N-acetylcysteine: anaphylactoid reaction in the first hour (pause, treat, restart slower). Use the reduced diluent volumes under 40 kg to avoid hyponatraemia." },
  { match: /pralidoxime/, severity: "warn", text: "Pralidoxime must be given WITH atropine (atropine first). Fast injection can cause laryngospasm and cardiac arrest. Infuse over 30 minutes." },
  { match: /activated charcoal/, severity: "warn", text: "Only within 1-2 hours, with a protected airway. Not for corrosives, hydrocarbons, alcohols, iron or lithium." },
  { match: /naloxone/, severity: "warn", text: "Naloxone has a shorter action than most opioids: observe for re-sedation for 4-6 hours. Can precipitate acute withdrawal." },
  { match: /snake venom/, severity: "warn", text: "ASV: anaphylactoid reactions are common. Draw up IM adrenaline before starting, and give only for systemic envenoming. Children get the same number of vials as adults." },
  { match: /gentamicin|amikacin/, severity: "warn", text: "Aminoglycoside: nephrotoxic and ototoxic. Once-daily dosing, check creatinine and levels, avoid with other nephrotoxins and in dehydration. Neonatal dosing differs." },
  { match: /meropenem/, severity: "warn", text: "Meropenem lowers valproate levels. Reduce dose in renal impairment; meningitis dose is 40 mg/kg." },
  { match: /piperacillin/, severity: "warn", text: "Dose by the piperacillin component (8:1 ratio with tazobactam). Contraindicated in penicillin allergy. Reduce in renal impairment." },
  { match: /linezolid/, severity: "warn", text: "Linezolid: myelosuppression after 10-14 days (weekly counts) and serotonin syndrome with SSRIs." },
  { match: /labetalol/, severity: "warn", text: "Labetalol: avoid in asthma, heart block, bradycardia and heart failure. Lower the pressure by no more than 25% in the first 8 hours." },
  { match: /hydralazine/, severity: "warn", text: "Hydralazine: reflex tachycardia, headache. Lower the pressure gradually, by no more than 25% in the first 8 hours." },
  { match: /tranexamic/, severity: "warn", text: "Tranexamic acid works best within 3 hours of injury. Avoid in active thromboembolism. Reduce in renal impairment; high doses can cause seizures." },
  { match: /acyclovir/, severity: "warn", text: "Acyclovir: oral doses above 800 mg are not usual. For IV use, keep the child well hydrated (crystal nephropathy risk) and check the dose for age (adult-type 10 mg/kg applies from about 12 years)." },
];

/**
 * Returns the notices that apply to a drug at the entered weight.
 * `weightKg` null means no valid weight has been entered.
 */
export function getDrugSafetyNotices(
  drug: { name: string; genericName?: string },
  weightKg: number | null,
): DrugSafetyNotice[] {
  const haystack = `${drug.name || ""} ${drug.genericName || ""}`.toLowerCase();
  const out: DrugSafetyNotice[] = [];
  for (const r of RULES) {
    if (r.match.test(haystack)) out.push({ severity: r.severity, text: r.text });
  }
  if (weightKg !== null && weightKg >= ADULT_CEILING_WEIGHT_KG) {
    out.push({
      severity: "warn",
      text: `Weight is ${weightKg} kg: a per-kg result may exceed the usual adult maximum. Check the adult ceiling before prescribing.`,
    });
  }
  return out;
}