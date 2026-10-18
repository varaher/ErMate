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
