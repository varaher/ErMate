import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — AKI and hepatorenal syndrome (branch of decompensated cirrhosis). v0.3, 23 Nov 2026.
// 2024 ADQI–ICA consensus: no mandatory 48-hour albumin challenge before diagnosing HRS-AKI; individualised
// volume assessment. Baveno VIII (2026): terlipressin preferably as a continuous infusion; noradrenaline an
// accepted alternative.
export const HRS_AKI_ADULT: ProtocolTopic = {
  id: "hrs-aki-adult",
  title: "AKI and hepatorenal syndrome (HRS-AKI)",
  summary:
    "Kidney injury in cirrhosis. HRS-AKI is one cause among several — find and treat the others first, and do not delay treatment waiting for a fixed albumin challenge.",
  population: "adult",
  status: "draft",
  version: "0.3",
  reviewedOn: "",
  parent: "cirrhosis-liver-adult",
  source: "ErMate Handbook — liver emergencies pathway v0.3",
  keywords: ["hrs", "hepatorenal", "hepatorenal syndrome", "aki", "acute kidney injury", "renal failure", "oliguria", "creatinine rising", "terlipressin", "albumin"],
  notice: "Draft for clinical sign-off. Vasoconstrictor therapy is specialist-directed; confirm doses against the patient and your hospital formulary.",
  firstTen: [
    "AKI in cirrhosis: creatinine up 0.3 mg/dL or more within 48 hours, or 50% or more within 7 days.",
    "Stop diuretics, NSAIDs, nephrotoxins and, if hypotensive, beta-blockers.",
    "Look for infection (tap the ascites) and for bleeding.",
    "Assess volume at the bedside and treat what you find — fluid loss, bleeding, sepsis.",
  ],
  references: [
    "Nadim MK et al. Acute kidney injury in patients with cirrhosis: ADQI and ICA joint multidisciplinary consensus. J Hepatol. 2024",
    "Biggins SW et al. AASLD Practice Guidance: ascites, SBP and hepatorenal syndrome. Hepatology. 2021",
    "Baveno VIII Faculty. Baveno VIII – Advancing consensus in portal hypertension. J Hepatol. 2026",
    "Wong F et al. Terlipressin plus albumin for hepatorenal syndrome type 1 (CONFIRM). N Engl J Med. 2021",
  ],
  reviewNotes: [
    "Terlipressin infusion dosing (Baveno VIII) taken from published summaries of the 2026 consensus; confirm against the full J Hepatol text before sign-off.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Falling urine output; often found only on blood tests." },
        { text: "Signs of the trigger: infection, GI bleed, vomiting or diarrhoea, over-diuresis, large-volume tap without albumin." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Splanchnic vasodilation lowers effective arterial volume; renin–angiotensin, sympathetic and ADH activation then constricts the kidney's arteries." },
        { text: "HRS-AKI is a functional kidney failure — the kidney itself is structurally normal and recovers with liver transplant." },
        { text: "Infection and inflammation tip a compensated patient into HRS; SBP is a classic trigger.", link: "sbp-adult" },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "1. Remove insults", text: "Stop diuretics, NSAIDs, aminoglycosides, contrast and other nephrotoxins.", critical: true },
        { label: "2. Treat the trigger", text: "Antibiotics for infection; control bleeding.", link: "variceal-bleed-adult" },
        { label: "3. Volume", text: "If volume depleted, give 20% albumin 1 g/kg (maximum 100 g) and reassess the response. No fixed 48-hour challenge is needed before deciding." },
        { label: "4. Is it HRS-AKI?", text: "Cirrhosis with ascites, AKI that persists despite appropriate volume, no shock, no current nephrotoxins, and no sign of structural kidney injury (protein above 500 mg/day, blood in the urine, abnormal kidney ultrasound)." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Prerenal (volume loss)", text: "Diuretics, diarrhoea, bleeding; responds to volume" },
        { label: "Acute tubular injury", text: "Shock, sepsis, contrast; muddy casts, high urine sodium" },
        { label: "Sepsis-associated AKI", text: "SBP, pneumonia, UTI", link: "sepsis-adult" },
        { label: "Obstruction", text: "Ultrasound shows hydronephrosis" },
        { label: "Glomerular disease", text: "Hepatitis B / C, IgA; protein and blood in the urine" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Creatinine against baseline, urea, sodium, potassium, VBG, CBC, LFT, blood cultures." },
        { label: "Urine", text: "Microscopy, protein, urine sodium (low in prerenal and HRS-AKI), culture." },
        { label: "Imaging", text: "Kidney ultrasound to exclude obstruction and structural disease." },
        { label: "Infection", text: "Diagnostic ascitic tap." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Terlipressin (HRS-AKI)", text: "Specialist-directed. Preferably a continuous IV infusion starting at 2–3 mg per 24 hours, increased stepwise if creatinine has not fallen by 25% at 48 hours (maximum 12 mg per 24 hours); boluses of 1 mg every 4–6 hours if infusion is not possible.", critical: true },
        { label: "Albumin with terlipressin", text: "20–40 g per day, reduced or stopped if the patient becomes fluid overloaded." },
        { label: "Safety", text: "Do not start terlipressin with SpO2 below 90% or fluid overload; stop it if hypoxia, chest pain, arrhythmia, or gut or limb ischaemia develops. Ischaemic heart or vascular disease is a contraindication.", critical: true },
        { label: "Noradrenaline (alternative)", text: "In ICU when terlipressin is unavailable, contraindicated or not tolerated: start 0.5 mg per hour, titrate to raise MAP by 10 mmHg or increase urine output." },
        { label: "Dialysis", text: "For usual indications (potassium, acidosis, overload, uraemia), especially as a bridge to transplant." },
        { label: "Refer", text: "Hepatology early; transplant assessment for every patient with HRS-AKI." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "HDU / ICU", text: "HRS-AKI on vasoconstrictors, AKI stage 2–3, or with other organ failure." },
        { label: "Ward", text: "Stage 1 AKI responding to removal of the trigger." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting 48 hours on albumin before treating — current consensus decides on the individual response." },
        { text: "Giving full-dose albumin to a patient already fluid overloaded." },
        { text: "Missing hypoxia on terlipressin — check SpO2 and chest before each dose increase." },
        { text: "Trusting a normal creatinine in a wasted patient." },
      ],
    },
  ],
};