import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Approach to the poisoned patient (adult). v0.1, 23 Nov 2026.
export const POISONING_APPROACH_ADULT: ProtocolTopic = {
  id: "poisoning-approach-adult",
  title: "Poisoning — general approach (adult)",
  summary:
    "Any suspected overdose or poisoning. Resuscitate first, identify the toxidrome, check glucose, ECG and paracetamol, decontaminate only when it helps, and give the specific antidote.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — toxicology pathway v0.1",
  keywords: ["poisoning", "overdose", "self harm", "suicide attempt", "toxidrome", "consumed poison", "tablet overdose", "unknown poison", "antidote", "charcoal", "mlc"],
  notice: "Draft for clinical sign-off. Every intentional poisoning is a medico-legal case — inform police per hospital policy and assess suicide risk.",
  firstTen: [
    "ABCDE; protect the airway if GCS is low or the patient is vomiting; oxygen; IV access; continuous monitoring.",
    "Bedside glucose — treat hypoglycaemia immediately.",
    "12-lead ECG: QRS width, QTc, heart block, arrhythmia.",
    "Identify the toxidrome (pupils, skin, secretions, heart rate, temperature, bowel sounds) and ask: what, how much, when, why, which container.",
    "Paracetamol (and salicylate if available) level in every intentional overdose; call the poison centre (AIIMS National Poisons Information Centre 1800-116-117).",
  ],
  references: [
    "Goldfrank's Toxicologic Emergencies, 11th edition (verification)",
    "Benson BE et al. Position paper update: gastric lavage for gastrointestinal decontamination. Clin Toxicol. 2013",
    "Juurlink DN. Activated charcoal for acute overdose: a reappraisal. Br J Clin Pharmacol. 2016",
    "Ghosh S et al. Recent trends in poisoning in India: a review. J Emerg Trauma Shock. 2022",
  ],
  reviewNotes: [
    "Confirm the AIIMS NPIC toll-free number before sign-off and add your state poison centre.",
  ],
  sections: [
    {
      heading: "Toxidromes",
      kind: "symptoms",
      items: [
        { label: "Cholinergic", text: "Pinpoint pupils, salivation, sweating, wheeze with secretions, bradycardia, diarrhoea, fasciculations — organophosphate, carbamate.", link: "organophosphate-poisoning-adult" },
        { label: "Anticholinergic", text: "Dilated pupils, dry hot red skin, tachycardia, urinary retention, delirium — antihistamines, TCA, datura." },
        { label: "Sympathomimetic", text: "Dilated pupils, sweating, tachycardia, hypertension, agitation, hyperthermia — amphetamines, cocaine." },
        { label: "Opioid", text: "Pinpoint pupils, low respiratory rate, low GCS." },
        { label: "Sedative-hypnotic", text: "Low GCS with near-normal vital signs — benzodiazepines, alcohol." },
        { label: "Sodium-channel blockade", text: "Wide QRS, seizures, hypotension — TCA, some antiarrhythmics." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Most deaths come from airway loss, hypoventilation, aspiration, arrhythmia and seizures — supportive care treats the majority." },
        { text: "Antidotes work on a specific receptor or pathway; giving the wrong one can harm (flumazenil seizures, physostigmine in TCA)." },
        { text: "In India, pesticides (organophosphates, aluminium phosphide, paraquat), plant toxins (yellow oleander, datura) and snakebite cause most deaths." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Resuscitate", text: "Airway and breathing first; treat hypotension, seizures, hypoglycaemia and hyperthermia.", critical: true },
        { label: "Risk assessment", text: "Agent, dose per kg, time, clinical features and expected course decide observation length and disposition." },
        { label: "Decontamination", text: "Activated charcoal 50 g (1 g/kg) only within 1 hour of a toxic ingestion of an adsorbable agent, in a patient with a protected airway. Gastric lavage is not routine. Remove clothes and wash skin for pesticides." },
        { label: "Enhanced elimination", text: "Haemodialysis for toxic alcohols, lithium, salicylate, metformin acidosis; urinary alkalinisation for salicylate." },
      ],
    },
    {
      heading: "Common poisonings",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Organophosphate / carbamate", text: "Cholinergic toxidrome", link: "organophosphate-poisoning-adult" },
        { label: "Aluminium phosphide", text: "Celphos, shock, garlic odour", link: "aluminium-phosphide-poisoning-adult" },
        { label: "Paraquat", text: "Oral burns, later lung fibrosis", link: "paraquat-poisoning-adult" },
        { label: "Paracetamol", text: "Silent early, liver injury at 24–72 h", link: "paracetamol-poisoning-adult" },
        { label: "Methanol / toxic alcohol", text: "Acidosis, visual blurring", link: "methanol-poisoning-adult" },
        { label: "Snakebite", text: "Bite mark, bleeding, ptosis", link: "snakebite-adult" },
        { label: "Yellow oleander", text: "Vomiting, bradycardia, heart block (digoxin-like)", link: "bradycardia-adult" },
        { label: "Hypoglycaemia", text: "Insulin, sulfonylurea", link: "hypoglycaemia-adult" },
        { label: "Alcohol withdrawal", text: "Tremor, agitation, seizures", link: "alcohol-withdrawal-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Everyone", text: "Glucose, ECG, VBG with lactate, electrolytes, renal and liver function; paracetamol level in intentional overdose." },
        { label: "As indicated", text: "Serum osmolality (toxic alcohols), cholinesterase, salicylate, digoxin, lithium, INR, CK; urine dithionite test for paraquat; beta-hCG." },
      ],
    },
    {
      heading: "Treatment (key antidotes)",
      kind: "treatment",
      items: [
        { label: "Opioid", text: "Naloxone 0.04–0.4 mg IV, titrated to breathing (not to full awakening)." },
        { label: "Organophosphate", text: "Atropine, titrated.", link: "organophosphate-poisoning-adult" },
        { label: "Paracetamol", text: "Acetylcysteine.", link: "paracetamol-poisoning-adult" },
        { label: "Methanol / ethylene glycol", text: "Fomepizole or ethanol, plus dialysis.", link: "methanol-poisoning-adult" },
        { label: "TCA / sodium-channel blockers", text: "Sodium bicarbonate 1–2 mmol/kg IV for QRS over 100 ms or arrhythmia.", critical: true },
        { label: "Beta-blocker / CCB", text: "Calcium, high-dose insulin euglycaemia therapy, vasopressors; glucagon for beta-blockers." },
        { label: "Benzodiazepines", text: "Supportive care; flumazenil only for known pure benzodiazepine over-sedation in a non-dependent patient." },
        { label: "Seizures", text: "Benzodiazepines; avoid phenytoin in toxic seizures." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Ventilated, haemodynamically unstable, high-risk agents (phosphide, paraquat, large OP)." },
        { label: "Observe", text: "For the agent's expected peak (for example 6 hours after most immediate-release drugs; longer for modified-release)." },
        { label: "Before discharge", text: "Psychiatric assessment for intentional poisoning; medico-legal documentation; safe-storage advice for pesticides." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Missing a co-ingested paracetamol." },
        { text: "Gastric lavage without airway protection." },
        { text: "Discharging a modified-release overdose too early." },
        { text: "Forgetting medico-legal and psychiatric steps." },
      ],
    },
  ],
};