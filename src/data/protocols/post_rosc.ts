import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Post-cardiac arrest care (ROSC). v0.1, 23 Nov 2026. 2025 AHA Guidelines (Part 11 post-arrest care).
export const POST_ROSC_ADULT: ProtocolTopic = {
  id: "post-rosc-adult",
  title: "Post-cardiac arrest care (ROSC)",
  summary:
    "The first hours after return of circulation decide brain outcome. Prevent a second arrest, protect the brain, and find the cause.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "cardiac-arrest-adult",
  source: "ErMate Handbook — resuscitation pathway v0.1 (2025 AHA guidelines)",
  keywords: ["rosc", "post arrest", "post cardiac arrest", "return of spontaneous circulation", "temperature control", "ttm", "hypothermia after arrest"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Secure the airway; confirm tube position with waveform capnography.",
    "100% oxygen until SpO2 can be measured reliably, then titrate to SpO2 90–98%. Ventilate to PaCO2 35–45 mmHg.",
    "Keep MAP at least 65 mmHg: fluids and a vasopressor (noradrenaline) as needed.",
    "12-lead ECG now: ST elevation, cardiogenic shock or recurrent VF → call cardiology for emergency angiography.",
    "Check glucose and potassium; start temperature control if the patient does not obey commands.",
  ],
  references: [
    "Part 11: Post–Cardiac Arrest Care. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "2025 AHA Guidelines for CPR and ECC — Highlights. American Heart Association. 2025",
    "Nolan JP et al. ERC–ESICM Guidelines 2025: Post-resuscitation care. Resuscitation. 2025",
  ],
  sections: [
    {
      heading: "What to look for",
      kind: "symptoms",
      items: [
        { text: "Level of consciousness (does the patient obey commands?), pupils, seizures or myoclonus." },
        { text: "Hypotension, arrhythmia, signs of the cause: ST elevation, chest trauma, bleeding, poisoning." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Post-cardiac arrest syndrome: brain injury, myocardial stunning, a sepsis-like whole-body reperfusion response, and the persisting cause of the arrest." },
        { text: "Hypotension, hypoxia, hyperoxia, fever and seizures all add to brain injury in the first 72 hours." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "A–B", text: "Tube, capnography, SpO2 90–98%, PaCO2 35–45 mmHg (unless severe acidaemia)." },
        { label: "C", text: "MAP at least 65 mmHg; arterial line when feasible. No vasopressor is preferred by the guideline; noradrenaline is a common first choice.", critical: true },
        { label: "Cause", text: "ECG, echo, CT head / chest as indicated. Shockable initial rhythm, ST elevation or shock points to a coronary cause.", link: "cad-acs-adult" },
        { label: "D", text: "GCS, pupils, glucose; EEG or treat clinical seizures." },
      ],
    },
    {
      heading: "Differential diagnosis (cause of arrest)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Acute coronary syndrome", text: "ST elevation, VF arrest", link: "cad-acs-adult" },
        { label: "Pulmonary embolism", text: "RV dilated, hypoxia", link: "pulmonary-embolism-adult" },
        { label: "Intracranial haemorrhage / SAH", text: "Headache before arrest, fixed pupils", link: "intracranial-haemorrhage-adult" },
        { label: "Hyperkalaemia", text: "Renal failure", link: "hyperkalaemia-adult" },
        { label: "Poisoning", text: "OP, cardiotoxic drugs", link: "poisoning-approach-adult" },
        { label: "Sepsis", text: "Fever, source of infection", link: "sepsis-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "ABG, electrolytes including potassium, magnesium and calcium, glucose, CBC, renal and liver function, troponin, lactate, coagulation." },
        { label: "ECG and echo", text: "12-lead ECG at once and repeated; bedside echo for function, RV size, tamponade." },
        { label: "Imaging", text: "Chest X-ray for tube position; CT head (and chest / CT pulmonary angiogram) when the cause is unclear." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Temperature control", text: "For patients not obeying commands: keep between 32 and 37.5 °C for at least 36 hours, and actively prevent fever.", critical: true },
        { label: "Coronary angiography", text: "Emergency for persistent ST elevation, cardiogenic shock, recurrent or refractory ventricular arrhythmia, or severe ischaemia; before discharge for other suspected cardiac causes." },
        { label: "Seizures", text: "Treat clinical seizures; do not give routine prophylaxis." },
        { label: "Glucose", text: "Avoid hypoglycaemia and severe hyperglycaemia." },
        { label: "Prognosis", text: "Do not decide on outcome in the ED. Multimodal prognostication waits at least 72 hours." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "All comatose or haemodynamically unstable patients." },
        { label: "Cath lab", text: "Directly from the ED when the criteria above are met." },
        { label: "Transfer", text: "To a centre with cath lab and ICU when not available locally, once stabilised." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Leaving the patient on 100% oxygen for hours (hyperoxia)." },
        { text: "Hyperventilating to a low PaCO2, which reduces brain blood flow." },
        { text: "Missing fever in the first 72 hours." },
        { text: "Withdrawing care early on an ED examination." },
      ],
    },
  ],
};