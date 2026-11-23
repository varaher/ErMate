import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Tachycardia with a pulse (adult). v0.1, 23 Nov 2026. 2025 AHA Adult ALS
// (AF cardioversion at 200 J or more; sotalol removed for stable wide-complex tachycardia).
export const TACHYCARDIA_ADULT: ProtocolTopic = {
  id: "tachycardia-adult",
  title: "Tachycardia with a pulse (adult)",
  summary:
    "Heart rate usually above 150 causing symptoms. First decide: unstable → synchronised cardioversion. Stable → narrow or wide, regular or irregular.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — resuscitation pathway v0.1 (2025 AHA guidelines)",
  keywords: ["tachycardia", "svt", "psvt", "atrial fibrillation", "af", "af rvr", "flutter", "vt", "ventricular tachycardia", "palpitations", "adenosine", "cardioversion", "torsades"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Monitor, oxygen if hypoxic, IV access, 12-lead ECG.",
    "Unstable (hypotension, altered mental state, shock, ischaemic chest pain, acute heart failure) → synchronised cardioversion with sedation.",
    "Stable narrow regular: modified Valsalva, then adenosine 6 mg rapid IV push, then 12 mg.",
    "Stable wide regular: amiodarone or procainamide; get expert help.",
    "Irregular: AF — rate control and anticoagulation decision; polymorphic VT — defibrillate, magnesium for torsades.",
  ],
  references: [
    "Part 9: Adult Advanced Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "Joglar JA et al. 2023 ACC/AHA/ACCP/HRS Guideline for the diagnosis and management of atrial fibrillation. Circulation. 2024",
    "Appelboam A et al. Postural modification to the standard Valsalva manoeuvre (REVERT). Lancet. 2015",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Palpitations, breathlessness, chest pain, dizziness, syncope." },
        { text: "Signs of instability: hypotension, confusion, shock, ischaemic chest pain, pulmonary oedema." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "At high rates diastole shortens, filling falls and coronary perfusion (which happens in diastole) drops while demand rises." },
        { text: "Re-entry circuits (AVNRT, AVRT, flutter) can be broken by AV-node blockade or electricity; automatic rhythms (sinus, multifocal) cannot — treat their cause." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Sinus tachycardia?", text: "If so, it is a sign, not the problem — look for sepsis, bleeding, hypoxia, pain, PE, thyrotoxicosis.", link: "shock-undifferentiated-adult" },
        { label: "Unstable", text: "Synchronised cardioversion now.", critical: true },
        { label: "Narrow (QRS under 120 ms), regular", text: "SVT, flutter with fixed block, sinus." },
        { label: "Narrow, irregular", text: "AF, flutter with variable block, multifocal atrial tachycardia." },
        { label: "Wide, regular", text: "Treat as VT unless proven otherwise (especially with heart disease)." },
        { label: "Wide, irregular", text: "AF with bundle branch block, pre-excited AF (WPW — avoid AV-node blockers), polymorphic VT." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Sepsis", text: "Fever, source, lactate", link: "sepsis-adult" },
        { label: "Hypovolaemia / bleeding", text: "GI bleed, trauma", link: "shock-undifferentiated-adult" },
        { label: "Pulmonary embolism", text: "Hypoxia, risk factors", link: "pulmonary-embolism-adult" },
        { label: "Acute coronary syndrome", text: "Ischaemic changes", link: "cad-acs-adult" },
        { label: "Thyrotoxicosis", text: "Weight loss, tremor, goitre" },
        { label: "Drug toxicity", text: "Sympathomimetics, anticholinergics, TCA", link: "poisoning-approach-adult" },
        { label: "Alcohol withdrawal", text: "Tremor, sweating, agitation", link: "alcohol-withdrawal-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "ECG", text: "12-lead ECG during the tachycardia and after conversion (look for pre-excitation, ischaemia, long QT)." },
        { label: "Bloods", text: "Potassium, magnesium, calcium, renal function, CBC, troponin if chest pain, TSH; glucose." },
        { label: "Echo", text: "Bedside echo for function in wide-complex tachycardia and new AF." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Synchronised cardioversion", text: "Narrow regular 50–100 J; AF 200 J or more; flutter 200 J (increase if it fails); monomorphic VT 100 J. Polymorphic VT: unsynchronised defibrillation.", critical: true },
        { label: "Adenosine", text: "6 mg rapid IV push with a saline flush, then 12 mg. Warn the patient; avoid in asthma and pre-excited AF." },
        { label: "AF / flutter rate control", text: "Diltiazem 0.25 mg/kg IV over 2 minutes or metoprolol 2.5–5 mg IV; amiodarone if heart failure or low blood pressure. Avoid AV-node blockers in pre-excited AF." },
        { label: "Stable wide regular", text: "Procainamide 20–50 mg/minute (stop at 17 mg/kg, hypotension or QRS widening by 50%) or amiodarone 150 mg IV over 10 minutes, repeated as needed. Sotalol is no longer recommended here." },
        { label: "Torsades de pointes", text: "Magnesium sulphate 2 g IV; correct potassium; stop QT-prolonging drugs." },
        { label: "Anticoagulation", text: "AF or flutter: decide on anticoagulation before or with cardioversion (duration, CHA2DS2-VASc)." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Synchronised cardioversion", text: "Sedation, sync mode on (re-select after each shock), anterior–posterior pads for AF.", link: "cardioversion-procedure" },
        { label: "Modified Valsalva", text: "Blow into a 10 mL syringe for 15 seconds sitting up, then lie flat with legs raised to 45 degrees for 15 seconds." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "CCU / ICU", text: "VT, unstable rhythm, cardioverted with ongoing instability." },
        { label: "Admit", text: "New AF with a precipitant, heart failure or uncontrolled rate." },
        { label: "Discharge", text: "SVT converted with a normal ECG; AF rate-controlled with an anticoagulation plan and follow-up." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Treating sinus tachycardia as an arrhythmia." },
        { text: "Giving verapamil or diltiazem to wide-complex tachycardia or pre-excited AF." },
        { text: "Forgetting to re-select sync mode after each cardioversion attempt." },
        { text: "Cardioverting AF of uncertain duration without an anticoagulation plan." },
      ],
    },
  ],
};