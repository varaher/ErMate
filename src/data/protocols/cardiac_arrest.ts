import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Adult cardiac arrest. v0.1, 23 Nov 2026. 2025 AHA Guidelines for CPR and ECC (Part 9, Adult ALS).
export const CARDIAC_ARREST_ADULT: ProtocolTopic = {
  id: "cardiac-arrest-adult",
  title: "Cardiac arrest (adult)",
  summary:
    "Unresponsive, not breathing normally, no definite pulse. High-quality CPR and early defibrillation are what save lives; everything else supports them.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — resuscitation pathway v0.1 (2025 AHA guidelines)",
  keywords: ["cardiac arrest", "code blue", "cpr", "acls", "vf", "pulseless vt", "pea", "asystole", "defibrillation", "adrenaline", "epinephrine", "amiodarone", "collapse", "no pulse"],
  notice: "Draft for clinical sign-off. Follow your hospital's code team roles; this page does not replace ACLS training.",
  firstTen: [
    "Call the code team. Start CPR now: 100–120 per minute, 5–6 cm deep, full recoil, 30:2 until an advanced airway is in place.",
    "Pads on as soon as the defibrillator arrives; check the rhythm and shock VF / pulseless VT immediately, then resume CPR at once.",
    "IV access first; intraosseous if IV fails or is slow.",
    "Adrenaline 1 mg IV every 3–5 minutes: as soon as possible in PEA / asystole; after the initial shocks have failed in VF / pVT.",
    "Rhythm and pulse check every 2 minutes (under 10 seconds); swap compressors; look for the reversible causes.",
  ],
  references: [
    "Part 9: Adult Advanced Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "2025 AHA Guidelines for CPR and ECC — Highlights. American Heart Association. 2025",
    "Soar J et al. European Resuscitation Council Guidelines 2025: Adult Advanced Life Support. Resuscitation. 2025",
  ],
  reviewNotes: [
    "Drug doses (adrenaline 1 mg, amiodarone 300/150 mg, lidocaine) are unchanged from the 2020 algorithm; confirm against the 2025 AHA Part 9 algorithm figure before sign-off.",
  ],
  sections: [
    {
      heading: "Recognition",
      kind: "symptoms",
      items: [
        { text: "Unresponsive with absent or agonal (gasping) breathing — start CPR; do not spend more than 10 seconds feeling for a pulse." },
        { text: "Seizure-like jerks or gasping in the first minutes are common in arrest and are not signs of life." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "No cardiac output means no coronary or brain perfusion; only compressions create flow, and every pause lets coronary perfusion pressure fall to zero." },
        { text: "VF is most treatable in the first minutes — shock early. The longer VF lasts, the more the myocardium needs CPR before a shock can work." },
        { text: "PEA and asystole usually have a cause outside the heart's rhythm: find and reverse it." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Shockable (VF / pVT)", text: "Shock → 2 minutes CPR → rhythm check. Adrenaline after the initial shocks fail; amiodarone after the third shock.", critical: true },
        { label: "Non-shockable (PEA / asystole)", text: "CPR, adrenaline as soon as possible, and a structured search for reversible causes." },
        { label: "Reversible causes (Hs and Ts)", text: "Hypoxia, hypovolaemia, hydrogen ion (acidosis), hypo/hyperkalaemia, hypothermia; tension pneumothorax, tamponade, toxins, thrombosis (pulmonary or coronary)." },
        { label: "Point-of-care ultrasound", text: "Only during the pulse check and only if it does not lengthen the pause: tamponade, tension pneumothorax, massive PE, empty heart. Never the sole reason to stop." },
        { label: "Capnography", text: "Waveform ETCO2 to guide compression quality and spot ROSC (a sudden rise). Persistently low ETCO2 is a poor sign but not a reason to stop on its own." },
      ],
    },
    {
      heading: "Differential diagnosis (reversible causes)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Hyperkalaemia", text: "Renal failure, missed dialysis, peaked T waves", link: "hyperkalaemia-adult" },
        { label: "Massive pulmonary embolism", text: "Sudden collapse, risk factors, RV dilated", link: "pulmonary-embolism-adult" },
        { label: "Acute coronary occlusion", text: "Chest pain before collapse, VF", link: "cad-acs-adult" },
        { label: "Tension pneumothorax", text: "Trauma, ventilated, absent breath sounds", link: "tension-pneumothorax-adult" },
        { label: "Cardiac tamponade", text: "Trauma, malignancy, renal failure", link: "cardiac-tamponade-adult" },
        { label: "Haemorrhage / hypovolaemia", text: "Trauma, GI bleed, ruptured ectopic", link: "variceal-bleed-adult" },
        { label: "Poisoning", text: "OP compounds, TCA, calcium-channel blockers", link: "poisoning-approach-adult" },
        { label: "Hypoxia", text: "Asthma, airway obstruction, drowning", link: "dyspnea-adult" },
        { label: "Anaphylaxis", text: "Exposure, rash, bronchospasm", link: "anaphylaxis-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "During CPR", text: "VBG / ABG with potassium, glucose, haemoglobin and lactate; bedside glucose." },
        { label: "After ROSC", text: "12-lead ECG, chest X-ray, troponin, electrolytes, renal function; CT head and chest as the cause dictates.", link: "post-rosc-adult" },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Defibrillation", text: "Biphasic at the manufacturer's recommended energy (usually 120–200 J; maximum if unknown). Resume CPR immediately after each shock without a pulse check.", critical: true },
        { label: "Adrenaline", text: "1 mg IV/IO every 3–5 minutes.", critical: true },
        { label: "Amiodarone", text: "300 mg IV/IO after the third shock; a further 150 mg after the fifth. Lidocaine 1–1.5 mg/kg, then 0.5–0.75 mg/kg, is an alternative." },
        { label: "Refractory VF", text: "Persisting after 3 or more shocks: consider changing pad position (anterior–posterior) or double sequential defibrillation in experienced hands; treat the cause (coronary occlusion)." },
        { label: "Airway", text: "Bag-valve-mask with 30:2 is acceptable; place an advanced airway without stopping compressions. After intubation, 1 breath every 6 seconds with continuous compressions. Confirm with waveform capnography." },
        { label: "Hyperkalaemia", text: "IV calcium is uncertain in arrest; give it if hyperkalaemia is likely, without delaying CPR, shocks or adrenaline.", link: "hyperkalaemia-adult" },
        { label: "Suspected opioid overdose", text: "Naloxone may be given, as long as it does not delay CPR with breaths." },
        { label: "Pregnancy", text: "Manual left uterine displacement throughout; prepare for resuscitative delivery at recognition of arrest, aiming to deliver within 5 minutes.", critical: true },
        { label: "No endotracheal drugs", text: "Drugs are given IV or IO only." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Intraosseous access", text: "Proximal tibia or humeral head when IV access fails.", link: "io-access-procedure" },
        { label: "Needle / finger thoracostomy", text: "For suspected tension pneumothorax.", link: "tension-pneumothorax-adult" },
        { label: "Pericardiocentesis", text: "For tamponade with PEA.", link: "pericardiocentesis-procedure" },
        { label: "ECPR", text: "Only where a regional ECPR programme exists, for selected patients with a witnessed arrest and a reversible cause." },
      ],
    },
    {
      heading: "Disposition and stopping",
      kind: "disposition",
      items: [
        { label: "ROSC", text: "Move straight to post-cardiac arrest care.", link: "post-rosc-adult" },
        { label: "Stopping", text: "A team decision considering arrest duration, rhythm changes, response to treatment, reversible causes, ETCO2 and ultrasound findings, baseline health and the patient's wishes. Family presence is encouraged." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Long pauses for intubation, lines or ultrasound." },
        { text: "Hyperventilating once the tube is in — it lowers venous return." },
        { text: "Pulse checks longer than 10 seconds." },
        { text: "Treating the monitor, not the patient — check pads and leads before calling asystole." },
      ],
    },
  ],
};