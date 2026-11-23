import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Symptomatic bradycardia (adult). v0.1, 23 Nov 2026. 2025 AHA Adult ALS.
export const BRADYCARDIA_ADULT: ProtocolTopic = {
  id: "bradycardia-adult",
  title: "Bradycardia with a pulse (adult)",
  summary:
    "Heart rate usually below 50 with signs of poor perfusion. Treat the patient, not the number — and look hard for a cause such as hyperkalaemia, drugs, poisoning or an inferior MI.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — resuscitation pathway v0.1 (2025 AHA guidelines)",
  keywords: ["bradycardia", "slow heart rate", "heart block", "complete heart block", "chb", "atropine", "pacing", "syncope", "low pulse"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Monitor, oxygen if hypoxic, IV access, 12-lead ECG.",
    "Unstable (hypotension, altered mental state, shock, ischaemic chest pain, acute heart failure)? Treat now.",
    "Atropine 1 mg IV, repeat every 3–5 minutes to a maximum of 3 mg.",
    "Atropine fails: transcutaneous pacing, or adrenaline 2–10 micrograms/minute (or dopamine 5–20 micrograms/kg/minute).",
    "Check potassium and ask about beta-blockers, calcium-channel blockers, digoxin and poisoning.",
  ],
  references: [
    "Part 9: Adult Advanced Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "Kusumoto FM et al. 2018 ACC/AHA/HRS Guideline on bradycardia and cardiac conduction delay. Circulation. 2019",
    "Soar J et al. European Resuscitation Council Guidelines 2025: Adult Advanced Life Support. Resuscitation. 2025",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Dizziness, syncope, fatigue, breathlessness, chest pain, confusion." },
        { text: "Hypotension, cold peripheries, cannon a-waves in complete heart block." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Cardiac output = heart rate × stroke volume; when rate falls and stroke volume cannot compensate, perfusion fails." },
        { text: "Block at the AV node (often inferior MI, drugs, high vagal tone) usually responds to atropine; block below the node (wide QRS, Mobitz II, complete block) often does not — pace early." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Stable?", text: "Monitor, find the cause, prepare pads. Treat only if perfusion is poor.", critical: true },
        { label: "ECG rhythm", text: "Sinus bradycardia, first-degree, Mobitz I, Mobitz II, complete heart block, junctional or ventricular escape." },
        { label: "Cause", text: "Hyperkalaemia, drugs, poisoning (organophosphate, beta-blocker, calcium-channel blocker, digoxin), inferior MI, hypothermia, hypothyroidism, raised intracranial pressure." },
      ],
    },
    {
      heading: "Differential diagnosis (causes)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Inferior STEMI", text: "ST elevation II, III, aVF", link: "cad-acs-adult" },
        { label: "Hyperkalaemia", text: "Peaked T, wide QRS, renal failure", link: "hyperkalaemia-adult" },
        { label: "Organophosphate poisoning", text: "Miosis, secretions, fasciculations", link: "organophosphate-poisoning-adult" },
        { label: "Beta-blocker / CCB overdose", text: "Hypotension, hypo/hyperglycaemia", link: "poisoning-approach-adult" },
        { label: "Digoxin toxicity", text: "Vomiting, visual change, any arrhythmia" },
        { label: "Raised intracranial pressure", text: "Cushing's triad", link: "intracranial-haemorrhage-adult" },
        { label: "Hypothermia", text: "Low core temperature, J waves" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "ECG", text: "12-lead ECG and rhythm strip; repeat for ischaemia." },
        { label: "Bloods", text: "Potassium, calcium, magnesium, renal function, glucose, troponin, VBG; TSH; digoxin level if on digoxin; cholinesterase if organophosphate is possible." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Atropine", text: "1 mg IV every 3–5 minutes, maximum 3 mg. May not work in heart transplant patients or block below the AV node.", critical: true },
        { label: "Adrenaline infusion", text: "2–10 micrograms per minute, titrated to response." },
        { label: "Dopamine infusion", text: "5–20 micrograms/kg/minute, as an alternative." },
        { label: "Transcutaneous pacing", text: "Set rate 60–70, increase current until electrical and mechanical capture (feel a femoral pulse). Give analgesia and sedation.", critical: true },
        { label: "Cause-specific", text: "Calcium and insulin–dextrose for hyperkalaemia; large-dose atropine for organophosphates; glucagon / high-dose insulin for beta-blocker and CCB poisoning; digoxin antibody where available." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Transcutaneous pacing", text: "Anterior–posterior pads; confirm capture with a pulse, not the monitor.", link: "pacing-procedure" },
        { label: "Transvenous pacing", text: "For persistent unstable bradycardia that does not respond to drugs — cardiology." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "CCU / ICU", text: "Unstable, paced, Mobitz II or complete heart block." },
        { label: "Admit with monitoring", text: "Symptomatic bradycardia with a reversible cause." },
        { label: "Discharge", text: "Asymptomatic sinus bradycardia or first-degree block with no cause found, with follow-up." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Repeating atropine in complete heart block with a wide QRS instead of pacing." },
        { text: "Missing hyperkalaemia as the cause." },
        { text: "Trusting electrical capture on the monitor without a palpable pulse." },
      ],
    },
  ],
};