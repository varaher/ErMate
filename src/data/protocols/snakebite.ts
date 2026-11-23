import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Snakebite envenoming (adult). v0.1, 23 Nov 2026.
// MoHFW Standard Treatment Guidelines: Management of Snake Bite (2017), the national STG under NAPSE (2024).
export const SNAKEBITE_ADULT: ProtocolTopic = {
  id: "snakebite-adult",
  title: "Snakebite envenoming",
  summary:
    "Most bites are from non-venomous snakes or are dry bites. Watch for envenoming — spreading swelling, bleeding or a positive 20WBCT, or neurotoxic signs — and give polyvalent ASV IV only when it is present.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "poisoning-approach-adult",
  source: "ErMate Handbook — toxicology pathway v0.1 (MoHFW Snakebite STG 2017 / NAPSE 2024)",
  keywords: ["snakebite", "snake bite", "asv", "anti snake venom", "20wbct", "krait", "cobra", "russell's viper", "saw scaled viper", "hump nosed", "neurotoxic", "haemotoxic", "ptosis", "envenomation"],
  notice: "Draft for clinical sign-off. Medico-legal case per hospital policy.",
  firstTen: [
    "Reassure; immobilise the limb; remove rings and tight items. Remove any tourniquet carefully (be ready for sudden worsening).",
    "Examine for envenoming: local swelling and its extent, bleeding (gums, bite site, urine), ptosis, diplopia, dysphagia, breathing.",
    "20-minute whole blood clotting test (20WBCT) now, then hourly for 3 hours, then 6-hourly for 24 hours.",
    "Envenoming present: polyvalent ASV 10 vials IV over 30 minutes — keep adrenaline drawn up.",
    "Neurotoxic: atropine–neostigmine trial; assess breathing (single breath count, neck lift) and intubate or bag early.",
  ],
  references: [
    "Ministry of Health and Family Welfare, Government of India. Standard Treatment Guidelines: Management of Snake Bite. 2017",
    "NCDC, MoHFW. National Action Plan for Prevention and Control of Snakebite Envenoming (NAPSE). 2024",
    "World Health Organization. Guidelines for the management of snakebites, 2nd edition. 2016",
  ],
  reviewNotes: [
    "STG 2017 gives two haemotoxic ASV regimens (low-dose infusion and high-dose bolus); choose which is ErMate's base standard and mark the other as local practice.",
    "Verify the chlorpheniramine premedication dose for high-risk patients against the printed STG (the online text appears to contain a typographical error).",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { label: "Haemotoxic (vipers)", text: "Progressive swelling, blistering, bleeding from bite site, gums, urine or old wounds; positive 20WBCT; shock; AKI (Russell's viper)." },
        { label: "Neurotoxic (cobra, krait)", text: "Ptosis, diplopia, dysphagia, slurred speech, neck flexor weakness ('broken neck'), respiratory failure. Krait bites are often painless, at night, with early abdominal pain." },
        { label: "Dry bite", text: "Fang marks with no progression over 24 hours." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Viper venoms activate clotting factors and consume fibrinogen (venom-induced consumption coagulopathy) and damage vessel walls → bleeding, shock, AKI." },
        { text: "Cobra venom blocks post-synaptic acetylcholine receptors (responds to neostigmine); krait venom acts pre-synaptically (does not reliably respond)." },
        { text: "ASV neutralises circulating venom only — it does not reverse damage already done, so give it early when envenoming is present." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "ASV indications", text: "Spreading swelling, spontaneous bleeding, positive 20WBCT, or neurotoxic signs. Do not wait for the 20WBCT when signs are clear.", critical: true },
        { label: "No ASV", text: "Purely local swelling, a dry bite, or a bite claimed without signs." },
        { label: "Observe", text: "At least 24 hours for every bite, even if well." },
        { label: "Do not", text: "Cut, suck, apply tourniquet, ice or herbs; give ASV locally or IM; give a test dose." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Dry / non-venomous bite", text: "No progression at 24 h" },
        { label: "Scorpion sting", text: "Autonomic storm, pulmonary oedema" },
        { label: "Organophosphate poisoning", text: "Secretions, fasciculations", link: "organophosphate-poisoning-adult" },
        { label: "Anaphylaxis (to ASV)", text: "Urticaria, wheeze, hypotension during infusion", link: "anaphylaxis-adult" },
        { label: "Stroke / intracranial bleed", text: "Haemotoxic envenoming can cause it", link: "intracranial-haemorrhage-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "20WBCT", text: "2 mL fresh venous blood in a clean, dry glass tube, left undisturbed 20 minutes; still liquid = positive. Repeat as in First 10 minutes and 6 hours after each ASV dose." },
        { label: "Bloods", text: "CBC with platelets, PT/INR, aPTT, fibrinogen, renal function, potassium, CK, urine for blood; group and crossmatch from the first sample." },
        { label: "ECG", text: "Arrhythmia, hyperkalaemia." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Neurotoxic ASV", text: "10 vials IV over 30 minutes; if no improvement at 1 hour, a further 10 vials. Maximum 20 vials.", critical: true },
        { label: "Haemotoxic ASV", text: "10 vials IV over 30 minutes (6 for saw-scaled viper in the low-dose regimen). Repeat 20WBCT at 6 hours; if still incoagulable, repeat ASV (2 vials 6-hourly in the low-dose regimen, or 6 vials 6-hourly in the high-dose regimen) until clotting normalises.", critical: true },
        { label: "Giving ASV", text: "Dissolve each vial in 10 mL; dilute in saline and run IV; watch every 5 minutes for the first 30 minutes. Children receive the same number of vials." },
        { label: "ASV reaction", text: "Stop ASV; adrenaline 0.5 mg IM; chlorpheniramine 10 mg IV; once settled, restart slowly." },
        { label: "Atropine–neostigmine", text: "Atropine 0.6 mg with neostigmine 1.5 mg IV, then neostigmine 0.5 mg with atropine every 30 minutes for 5 doses. Positive if ptosis improves by 50% in 1 hour. Stop if no response after 3 doses (suspect krait)." },
        { label: "Krait without response", text: "Calcium gluconate 10 mL IV every 6 hours until recovery is a national-guideline option; ventilate as needed — recovery may take 5–7 days." },
        { label: "Coagulopathy", text: "FFP 10–15 mL/kg only after ASV for active bleeding; no heparin or antifibrinolytics." },
        { label: "Kidneys", text: "Target urine output 1 mL/kg/hour; dialysis for usual indications." },
        { label: "Wound", text: "Tetanus booster once coagulopathy is corrected; antibiotics only for obvious infection; no prophylactic fasciotomy." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Airway / ventilation", text: "Intubate (or bag ventilate) for inability to lift the head, pooling saliva, falling single breath count or SpO2 below 90%.", link: "rsi-procedure" },
        { label: "Fasciotomy", text: "Only for proven compartment syndrome after coagulopathy is corrected." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Neurotoxic envenoming, bleeding, shock, AKI." },
        { label: "Admit", text: "All envenomed patients; all bites observed for 24 hours." },
        { label: "Discharge", text: "No signs and normal 20WBCT at 24 hours; warn about serum sickness (5–24 days after ASV)." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for the 20WBCT before giving ASV in an obviously envenomed patient." },
        { text: "Missing a painless krait bite in a patient with abdominal pain and ptosis at night." },
        { text: "Giving FFP instead of ASV." },
        { text: "Discharging before 24 hours." },
      ],
    },
  ],
};