import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Alcohol withdrawal and Wernicke encephalopathy (adult). v0.1, 23 Nov 2026.
// ASAM Clinical Practice Guideline on Alcohol Withdrawal Management (2020).
export const ALCOHOL_WITHDRAWAL_ADULT: ProtocolTopic = {
  id: "alcohol-withdrawal-adult",
  title: "Alcohol withdrawal and Wernicke encephalopathy",
  summary:
    "Starts 6–24 hours after the last drink: tremor, sweating, agitation; seizures at 12–48 hours; delirium tremens at 48–96 hours. Benzodiazepines by symptom score, high-dose thiamine, and look for what else is wrong.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — neurology pathway v0.1 (ASAM 2020)",
  keywords: ["alcohol withdrawal", "delirium tremens", "dts", "withdrawal seizure", "wernicke", "thiamine", "ciwa", "alcoholic", "chlordiazepoxide", "lorazepam", "phenobarbital"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "ABC; glucose; temperature; look for injury, infection, GI bleed and liver failure.",
    "Score severity with CIWA-Ar (or a simpler tool).",
    "Thiamine IV now — 200–500 mg (high dose if Wernicke is suspected).",
    "Benzodiazepine for CIWA 10 or more, or any withdrawal seizure: diazepam 10–20 mg IV / oral, repeat every 5–10 minutes (IV) until calm but rousable; lorazepam if liver failure or elderly.",
    "Correct potassium, magnesium and phosphate; IV fluids for dehydration.",
  ],
  references: [
    "American Society of Addiction Medicine. The ASAM Clinical Practice Guideline on Alcohol Withdrawal Management. J Addict Med. 2020",
    "Galvin R et al. EFNS guidelines for diagnosis, therapy and prevention of Wernicke encephalopathy. Eur J Neurol. 2010",
    "Sullivan JT et al. Assessment of alcohol withdrawal: the revised CIWA-Ar. Br J Addict. 1989",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { label: "Mild–moderate (6–24 h)", text: "Tremor, sweating, anxiety, nausea, tachycardia, insomnia." },
        { label: "Seizures (12–48 h)", text: "Generalised, usually brief." },
        { label: "Delirium tremens (48–96 h)", text: "Confusion, hallucinations, fever, severe autonomic hyperactivity — mortality without treatment.", critical: true },
        { label: "Wernicke encephalopathy", text: "Confusion, ataxia, eye movement abnormalities (nystagmus, ophthalmoplegia) — often only one feature present." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Chronic alcohol enhances GABA and suppresses glutamate; sudden stopping leaves the brain over-excited." },
        { text: "Benzodiazepines (and phenobarbital) act on the same GABA receptor — they are the treatment." },
        { text: "Thiamine deficiency injures the thalamus and mammillary bodies; glucose without thiamine may worsen it." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Symptom-triggered dosing", text: "Treat by score, reassessing every 1–2 hours.", critical: true },
        { label: "Refractory withdrawal", text: "High benzodiazepine requirement: phenobarbital (specialist-guided) or ICU; propofol or dexmedetomidine as adjuncts." },
        { label: "What else is wrong?", text: "Head injury, sepsis, pneumonia, GI bleed, pancreatitis, hypoglycaemia, liver failure." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Hepatic encephalopathy", text: "Asterixis, cirrhosis", link: "hepatic-encephalopathy-adult" },
        { label: "Head injury / subdural", text: "Falls, anticoagulants", link: "tbi-adult" },
        { label: "Sepsis / meningitis", text: "Fever, source", link: "meningitis-adult" },
        { label: "Hypoglycaemia", text: "Check glucose", link: "hypoglycaemia-adult" },
        { label: "Sympathomimetic toxicity", text: "Drug use", link: "poisoning-approach-adult" },
        { label: "Thyrotoxicosis", text: "Weight loss, goitre" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Glucose, electrolytes with magnesium and phosphate, renal and liver function, CBC, INR, lipase, VBG; blood alcohol if the history is unclear." },
        { label: "Imaging", text: "CT head for head injury, focal signs, first seizure or atypical delirium." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Benzodiazepine", text: "Diazepam 10–20 mg (or chlordiazepoxide 25–100 mg orally) by symptom score; lorazepam 1–4 mg in liver failure, elderly or respiratory disease.", critical: true },
        { label: "Thiamine", text: "Prophylaxis 100–250 mg IV daily; suspected Wernicke 500 mg IV three times a day for 3 days, then 250 mg daily.", critical: true },
        { label: "Seizures", text: "Benzodiazepine; phenytoin is not effective for withdrawal seizures." },
        { label: "Electrolytes", text: "Replace magnesium, potassium, phosphate (watch for refeeding)." },
        { label: "Avoid", text: "Antipsychotics alone (lower seizure threshold) — only as adjuncts for hallucinations once benzodiazepines are given." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Delirium tremens, refractory withdrawal, high doses needed." },
        { label: "Admit", text: "CIWA 15 or more, seizure, Wernicke, serious medical illness, previous DTs." },
        { label: "Discharge", text: "Mild withdrawal, no complications, reliable support; thiamine and de-addiction referral." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Under-dosing benzodiazepines in severe withdrawal." },
        { text: "Low-dose oral thiamine for suspected Wernicke." },
        { text: "Missing a head injury or sepsis in an 'alcoholic'." },
      ],
    },
  ],
};