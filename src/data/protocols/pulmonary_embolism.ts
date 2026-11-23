import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Acute pulmonary embolism (adult). v0.1, 23 Nov 2026.
// 2026 AHA/ACC Guideline for the Evaluation and Management of Acute PE in Adults: clinical categories A–E
// (replacing massive / submassive), DOAC over VKA, LMWH over UFH, thrombolysis harmful in A–C2, reasonable in E,
// avoid deep sedation / intubation in C–E unless necessary, PERT for C–E, no routine IVC filter.
export const PULMONARY_EMBOLISM_ADULT: ProtocolTopic = {
  id: "pulmonary-embolism-adult",
  title: "Pulmonary embolism",
  summary:
    "Clot in the pulmonary arteries. Use pre-test probability before testing, anticoagulate early, and match escalation to the AHA/ACC category — thrombolysis only for cardiopulmonary failure.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — respiratory / vascular pathway v0.1 (2026 AHA/ACC PE guideline)",
  keywords: ["pulmonary embolism", "pe", "pulmonary thromboembolism", "dvt", "breathless", "pleuritic chest pain", "d-dimer", "ctpa", "thrombolysis", "wells", "perc", "rv strain"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Oxygen to SpO2 94–98%; IV access; ECG; bedside echo if unwell (RV dilatation).",
    "Hypotension or shock: treat as high-risk PE — heparin now, call senior / PE response team, prepare thrombolysis.",
    "Haemodynamically stable: assess pre-test probability (Wells / PERC); D-dimer if low or intermediate; CT pulmonary angiogram if high or D-dimer positive.",
    "Start anticoagulation while waiting for imaging when probability is high and bleeding risk is acceptable.",
    "Avoid intubation and large fluid boluses in RV failure — use noradrenaline and small fluid challenges only.",
  ],
  references: [
    "AHA/ACC. 2026 Guideline for the Evaluation and Management of Acute Pulmonary Embolism in Adults. Circulation. 2026",
    "Konstantinides SV et al. 2019 ESC Guidelines for the diagnosis and management of acute pulmonary embolism. Eur Heart J. 2020",
    "Righini M et al. Age-adjusted D-dimer cutoff levels to rule out PE (ADJUST-PE). JAMA. 2014",
    "Roy PM et al. Hestia vs sPESI for outpatient PE management (HOME-PE). Eur Heart J. 2021",
  ],
  reviewNotes: [
    "2026 AHA/ACC category names and recommendations taken from published summaries; confirm thrombolytic doses and C3 / D recommendations against the full guideline before sign-off.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Breathlessness (often sudden), pleuritic chest pain, haemoptysis, syncope, tachycardia, hypoxia." },
        { text: "Signs of DVT: unilateral leg swelling and tenderness." },
        { text: "Risk factors: recent surgery or immobilisation, cancer, pregnancy / postpartum, oestrogen, previous VTE, long travel." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Clot raises pulmonary vascular resistance; the thin-walled RV dilates and fails, squeezing the LV — obstructive shock." },
        { text: "RV failure spirals: low output → RV ischaemia → worse failure. Fluids and positive-pressure ventilation can tip it into arrest." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Category A–B", text: "Incidental or low risk (sPESI 0 / Hestia 0): anticoagulate; outpatient treatment is reasonable." },
        { label: "Category C", text: "Elevated score with or without RV dysfunction or raised troponin / BNP: admit, anticoagulate, monitor; PE response team." },
        { label: "Category D", text: "Incipient failure (normotensive shock, rising lactate): systemic thrombolysis or catheter therapy may be considered." },
        { label: "Category E", text: "Cardiopulmonary failure (persistent hypotension, cardiogenic shock, arrest): systemic thrombolysis, catheter or surgical therapy, VA-ECMO.", critical: true },
        { label: "Rule-out", text: "Low clinical probability: PERC negative = no test. D-dimer with an age-adjusted cut-off (age × 10 µg/L over 50) for low / intermediate probability." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Acute coronary syndrome", text: "ST changes, troponin", link: "cad-acs-adult" },
        { label: "Pneumonia", text: "Fever, consolidation", link: "pneumonia-adult" },
        { label: "Pneumothorax", text: "Absent lung sliding", link: "tension-pneumothorax-adult" },
        { label: "Heart failure", text: "B-lines, raised BNP", link: "dyspnea-adult" },
        { label: "Aortic dissection", text: "Tearing pain, pulse deficit" },
        { label: "Cardiac tamponade", text: "Effusion, distended IVC", link: "cardiac-tamponade-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Imaging", text: "CT pulmonary angiogram; V/Q scan or leg ultrasound if contrast is contraindicated or pregnant; bedside echo in unstable patients." },
        { label: "Bloods", text: "D-dimer (only when probability is not high), troponin and / or BNP, lactate in categories C–E, CBC, renal function, coagulation." },
        { label: "ECG", text: "Sinus tachycardia, S1Q3T3, right heart strain, new RBBB." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Anticoagulation", text: "DOAC (apixaban or rivaroxaban) over warfarin unless contraindicated; LMWH over unfractionated heparin. UFH (80 units/kg bolus, 18 units/kg/hour) when thrombolysis or a procedure may follow, or in severe renal failure.", critical: true },
        { label: "Systemic thrombolysis", text: "Category E (and selected D): alteplase 100 mg over 2 hours (50 mg bolus in cardiac arrest), or tenecteplase weight-based. Harmful in categories A–C2.", critical: true },
        { label: "RV failure support", text: "Noradrenaline for hypotension; small fluid challenges only; oxygen or HFNC; avoid intubation and deep sedation unless essential, with pressors and ECMO ready." },
        { label: "Special groups", text: "Pregnancy: LMWH only. Antiphospholipid syndrome: warfarin. Child–Pugh C cirrhosis: avoid DOACs." },
        { label: "IVC filter", text: "Only when anticoagulation is impossible — not routinely." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Categories D–E, thrombolysed." },
        { label: "Admit", text: "Category C." },
        { label: "Outpatient", text: "Categories A–B with Hestia 0 or sPESI 0, reliable follow-up within 1 week." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "D-dimer in high-probability patients." },
        { text: "Intubating a patient in RV failure without pressors ready." },
        { text: "Thrombolysing a stable patient with only RV strain." },
      ],
    },
  ],
};