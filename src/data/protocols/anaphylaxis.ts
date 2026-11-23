import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Anaphylaxis (adult). v0.1, 23 Nov 2026.
// IM adrenaline first; antihistamines and steroids are not first-line; refractory → adrenaline infusion.
export const ANAPHYLAXIS_ADULT: ProtocolTopic = {
  id: "anaphylaxis-adult",
  title: "Anaphylaxis (adult)",
  summary:
    "A severe, life-threatening systemic allergic reaction with airway, breathing or circulation problems. Intramuscular adrenaline is the treatment — give it early and repeat it.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — resuscitation pathway v0.1",
  keywords: ["anaphylaxis", "allergy", "allergic reaction", "angioedema", "urticaria", "adrenaline", "epinephrine", "bee sting", "drug reaction", "contrast reaction", "stridor", "wheeze"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Remove the trigger if possible. Lie flat with legs raised (sit up if breathing is the problem; left side if pregnant).",
    "Adrenaline 0.5 mg IM (0.5 mL of 1 mg/mL) into the anterolateral thigh. Repeat every 5 minutes if not improving.",
    "High-flow oxygen; IV access; 500–1000 mL crystalloid bolus if hypotensive.",
    "No improvement after 2 IM doses: start an IV adrenaline infusion and call for senior / anaesthetic help.",
    "Prepare for a difficult airway early if there is stridor, voice change or tongue swelling.",
  ],
  references: [
    "Resuscitation Council UK. Emergency treatment of anaphylaxis: guidelines for healthcare providers. 2021",
    "Cardona V et al. World Allergy Organization Anaphylaxis Guidance 2020. World Allergy Organ J. 2020",
    "Golden DBK et al. Anaphylaxis: a 2023 practice parameter update. Ann Allergy Asthma Immunol. 2024",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { label: "Airway", text: "Throat tightness, hoarse voice, stridor, tongue or lip swelling." },
        { label: "Breathing", text: "Wheeze, breathlessness, hypoxia." },
        { label: "Circulation", text: "Hypotension, faintness, collapse, tachycardia (or bradycardia late)." },
        { label: "Skin / gut", text: "Urticaria, flushing, angio-oedema, vomiting, abdominal cramps — skin signs are absent in up to 1 in 5." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Mast cell and basophil degranulation releases histamine, tryptase and leukotrienes → vasodilation, capillary leak, bronchospasm, mucosal oedema." },
        { text: "Adrenaline reverses all of these (alpha: vasoconstriction; beta: bronchodilation and stops mediator release); antihistamines only treat skin symptoms." },
        { text: "Common triggers in the ED: antibiotics, NSAIDs, IV contrast, insect stings, foods." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Diagnose clinically", text: "Sudden onset after a likely trigger with an airway, breathing or circulation problem — give adrenaline; do not wait for skin signs.", critical: true },
        { label: "Beta-blocked patient", text: "May not respond to adrenaline: give glucagon." },
        { label: "Isolated angio-oedema without urticaria", text: "Think ACE-inhibitor or hereditary angio-oedema — adrenaline helps less." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Acute severe asthma", text: "No skin or circulation signs", link: "dyspnea-adult" },
        { label: "Septic shock", text: "Fever, source", link: "sepsis-adult" },
        { label: "Vasovagal syncope", text: "Bradycardia, pallor, quick recovery" },
        { label: "ACE-inhibitor angio-oedema", text: "No urticaria, on an ACE inhibitor" },
        { label: "Panic attack", text: "No hypotension, wheeze or rash" },
        { label: "Scombroid poisoning", text: "Fish, flushing, headache" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Mast cell tryptase", text: "Once treatment has started: ideally at about 1 hour, a second sample within 4 hours of onset, and a baseline after 24 hours." },
        { label: "Monitoring", text: "ECG, SpO2, blood pressure; glucose." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "IM adrenaline", text: "0.5 mg (0.5 mL of 1 mg/mL, 1:1000) into the anterolateral thigh; repeat every 5 minutes as needed.", critical: true },
        { label: "Refractory anaphylaxis", text: "No improvement after 2 IM doses: low-dose IV adrenaline infusion (for example 1 mg in 100 mL saline started at 0.5–1 mL/kg/hour, titrated) with continuous monitoring, senior help, and IM doses continued until the infusion runs.", critical: true },
        { label: "IV adrenaline boluses", text: "Only by experienced clinicians (50 micrograms IV, titrated) — risk of arrhythmia and hypertension." },
        { label: "Fluids", text: "Crystalloid 500–1000 mL bolus for hypotension, repeated as needed." },
        { label: "Bronchospasm", text: "Nebulised salbutamol after adrenaline for persisting wheeze." },
        { label: "Glucagon", text: "1–2 mg IV over 5 minutes for patients on beta-blockers not responding to adrenaline." },
        { label: "Antihistamine / steroid", text: "Not first-line and never instead of adrenaline. A non-sedating oral antihistamine can help skin symptoms after stabilisation; routine steroids are not recommended." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Difficult airway", text: "Early intubation by the most experienced operator; prepare for a surgical airway.", link: "rsi-procedure" },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Refractory anaphylaxis, adrenaline infusion, airway compromise." },
        { label: "Observe", text: "At least 6–12 hours after symptoms resolve (longer if 2 or more doses were needed, severe reaction, or late presentation)." },
        { label: "Discharge", text: "Two adrenaline auto-injectors with training (where available), written plan, trigger avoidance, allergy referral." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Giving antihistamine and steroid and withholding adrenaline." },
        { text: "Giving the 1 mg/mL strength intravenously." },
        { text: "Standing the patient up — sudden collapse (empty ventricle)." },
        { text: "Discharging too early after a severe reaction." },
      ],
    },
  ],
};