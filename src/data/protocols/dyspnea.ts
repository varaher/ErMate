import type { ProtocolTopic } from "./types";

// Source: ED clinical manual, dyspnea flowchart + etiology pathways (author: ErMate founder).
// Status stays "draft" until a clinical reviewer signs it off.
export const DYSPNEA_ADULT: ProtocolTopic = {
  id: "dyspnea-adult",
  title: "Dyspnea (Adult)",
  summary: "Stabilise first, work up in parallel, then treat by cause: cardiac, pulmonary, pulmonary embolism, airway/allergy, metabolic, pneumothorax.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ED clinical manual — Dyspnea flowchart algorithm and etiology-specific pathways",
  sections: [
    {
      heading: "1. Initial assessment and stabilisation",
      note: "Critically unstable: threatened airway, tachypnea, increased work of breathing, hypotension.",
      items: [
        { label: "Airway", text: "Protect immediately. Suction, position; RSI / BMV / NIV (CPAP/BiPAP).", critical: true },
        { label: "Oxygenate and access", text: "High-flow O2 / NRBM; large-bore IV lines.", critical: true },
        { label: "Tension pneumothorax", text: "Needle decompression, then plan ICD.", critical: true },
        { label: "Anaphylaxis", text: "Inj Adrenaline 0.5 mg IM (anterolateral thigh).", critical: true },
        { label: "Bronchospasm", text: "Continuous nebulisation + systemic steroids.", critical: true },
      ],
    },
    {
      heading: "Stable presentation",
      items: [
        { label: "ABCDE", text: "Primary survey and triage." },
        { label: "Monitoring", text: "Continuous cardiac monitoring, pulse oximetry, vitals." },
        { label: "Targeted history", text: "Onset, chest pain, fever, orthopnea, trauma, exposure." },
        { label: "Physical exam", text: "Auscultation, precordial exam, peripheral edema, DVT signs." },
      ],
    },
    {
      heading: "2. Workup and diagnostic panel",
      items: [
        { label: "Labs", text: "CBC, CRP, RFT, LFT, serum electrolytes, urea. HS-Troponin and D-Dimer (cardiac / PE). Blood culture and sensitivity (sepsis / infection)." },
        { label: "CXR", text: "Rule out cardiomegaly, pleural effusion, pneumonia, pneumothorax." },
        { label: "ECG", text: "Rule out STEMI / NSTEMI. Look for S1Q3T3 (PE). Low voltage (tamponade)." },
        { label: "ABG", text: "Rule out type-2 respiratory failure (hypercapnia). Check lactic acidosis." },
        { label: "Echo / POCUS", text: "LV/RV dysfunction. Rule out tamponade / effusion. Lung POCUS: rule out pneumothorax." },
      ],
    },
    {
      heading: "3A. Cardiac dyspnea",
      note: "Screen with 12-lead ECG, bedside echo / focused POCUS, HS-Troponin and NT-proBNP. Differentiate: acute pulmonary edema, ACS, tamponade / effusion.",
      items: [
        { label: "Acute pulmonary edema", text: "Confirm SBP before nitrate therapy." },
        { text: "Diuresis: IV Furosemide 20–60 mg STAT; follow with continuous infusion if overload persists." },
        { text: "Early NIV (CPAP / BiPAP) + DuoNeb nebulisation." },
        { text: "Foley catheter; start NTG infusion if needed (SOS) for preload / afterload reduction." },
        { text: "Cardiology / Nephrology consult." },
        { text: "In shock / hypotension: start Noradrenaline infusion.", critical: true },
        { label: "ACS — STEMI", text: "Loading doses (Aspirin + P2Y12 inhibitor). Pre-meds: Tab Avil 25 mg + Tab Ranitidine 300 mg. Immediate Cath Lab activation.", critical: true },
        { label: "ACS — NSTEMI", text: "Antiplatelet loading doses. Inj Heparin or Clexane if needed (SOS). Urgent cardiology consultation." },
        { label: "Tamponade / effusion", text: "Check Beck's triad, pulsus paradoxus, low-voltage ECG complexes." },
        { text: "In shock / hypotension: volume expansion; start Noradrenaline infusion.", critical: true },
        { text: "Pre-procedure labs: serology, blood grouping and crossmatch, coagulation profile (INR)." },
        { text: "Urgent cardiology consult for pericardiocentesis / pericardial window." },
      ],
    },
    {
      heading: "3B. Pulmonary dyspnea",
      items: [
        { label: "COPD / asthma exacerbation", text: "Neb Duolin / Budecort STAT; continue back-to-back Duolin nebulisations." },
        { text: "Systemic steroids: Inj Hydrocortisone 100–200 mg IV OR Inj Ivepred 20 mg IV." },
        { text: "Refractory bronchospasm: send baseline Mg level, then Inj Magnesium Sulfate 1–2 g IV if needed (SOS)." },
        { text: "Ventilatory failure (hypercapnia): early NIV (BiPAP). If type-2 respiratory failure worsens: RSI if needed (SOS).", critical: true },
        { label: "Pneumonia / infection", text: "Oxygen target SpO2 92–96% (88–92% in chronic hypercapnia)." },
        { text: "Blood cultures (x2) before antibiotics. First dose of empiric broad-spectrum antibiotics STAT." },
        { text: "Nebulisation if needed (SOS) for reactive airways." },
        { text: "Sepsis / septic shock: assess intake / output; adequate fluid resuscitation; then Noradrenaline infusion if needed (SOS).", critical: true },
      ],
    },
    {
      heading: "3C. Vascular dyspnea — pulmonary embolism",
      items: [
        { label: "Evaluate", text: "Signs of RV dysfunction; dilated RA/RV on echo; sinus tachycardia / S1Q3T3 on ECG." },
        { label: "Biomarkers", text: "D-Dimer, HS-Troponin, NT-proBNP." },
        { label: "Wells score ≤ 4", text: "D-Dimer to rule out PE." },
        { label: "Wells score > 4", text: "High probability: immediate CT pulmonary angiogram (CTPA). Send blood grouping, serology, coagulation profile (INR)." },
        { text: "Check hemodynamic stability: RV strain or obstructive shock.", critical: true },
        { text: "Emergency Cardiology / Hematology consult to decide between: IV thrombolysis (massive PE with hemodynamic instability) or systemic anticoagulation (submassive / low-risk PE)." },
        { text: "Interventional radiology consult if needed (SOS) for catheter-directed thrombolysis / embolectomy." },
      ],
    },
    {
      heading: "3D. Airway and allergy",
      items: [
        { label: "Anaphylaxis", text: "Inj Epinephrine 0.5 mL IM (1:1000) in anterolateral thigh STAT. Repeat every 5–15 min (up to 3 doses).", critical: true },
        { text: "Inj Hydrocortisone 100–200 mg IV. Inj Avil 25 mg slow IV." },
        { text: "Refractory shock: aggressive IV fluids; Noradrenaline infusion if needed (SOS)." },
        { text: "Airway compromise: Adrenaline nebulisation if needed (SOS); prepare for difficult airway.", critical: true },
        { label: "Upper airway obstruction / foreign body", text: "Position of comfort, non-invasive high-flow O2; avoid agitating the patient." },
        { text: "Urgent ENT consult. CT neck if stable (SOS)." },
        { text: "Surgical airway: based on airway stability, activate the respiratory support team (SOS) for awake fiberoptic or cricothyroidotomy / tracheostomy.", critical: true },
      ],
    },
    {
      heading: "3E. Metabolic and other causes",
      items: [
        { label: "Metabolic acidosis / uremia", text: "Identify the cause (DKA, uremia, lactic acidosis). Targeted correction. O2 support. NIV if needed (SOS) to assist respiratory compensation." },
        { label: "Severe anemia / high output", text: "Send blood grouping and crossmatch STAT. Transfuse PRBC. Work up the underlying bleeding / systemic source." },
        { label: "Psychogenic / hyperventilation", text: "Diagnosis of exclusion only. Monitor vitals and SpO2 continuously. Reassurance and breathing retraining." },
      ],
    },
    {
      heading: "3F. Pneumothorax",
      items: [
        { label: "Confirm", text: "Bedside lung POCUS (absent lung sliding) or portable CXR." },
        { label: "Tension pneumothorax", text: "Hypotension, tracheal deviation: immediate needle decompression (2nd intercostal space, mid-clavicular line, or 5th intercostal space, anterior axillary line).", critical: true },
        { label: "Definitive", text: "Intercostal drain (ICD) insertion." },
        { text: "Urgent pulmonary consult. General surgery consult if traumatic." },
      ],
    },
    {
      heading: "4. Disposition",
      items: [
        { label: "ICU", text: "Hemodynamic instability / shock; intubated or NIV-dependent; severe acidosis / hypercapnia; persistent hypotension needing pressors; post-pericardiocentesis or emergent Cath Lab intervention." },
        { label: "Ward", text: "Persistent O2 requirement; high-risk PE / ACS / heart failure; hemodynamically stable after treatment with a resolving O2 requirement; unable to manage at home." },
        { label: "Discharge", text: "Complete symptom resolution; normal vitals and SpO2 on room air; clear outpatient follow-up plan." },
      ],
    },
  ],
};