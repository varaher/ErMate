import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Upper GI bleed, non-variceal (adult). v0.1, 23 Nov 2026. ACG 2021, ESGE 2021; HALT-IT (2020); Lau NEJM 2020.
export const UPPER_GI_BLEED_ADULT: ProtocolTopic = {
  id: "upper-gi-bleed-adult",
  title: "Upper GI bleed (non-variceal)",
  summary:
    "Haematemesis or melaena, most often from peptic ulcer. Resuscitate, risk-stratify with the Glasgow–Blatchford score, restrictive transfusion, PPI, and endoscopy within 24 hours.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — GI pathway v0.1 (ACG 2021, ESGE 2021)",
  keywords: ["upper gi bleed", "ugib", "haematemesis", "hematemesis", "melaena", "melena", "peptic ulcer bleed", "glasgow blatchford", "pantoprazole", "endoscopy"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Two large-bore IV lines; crossmatch; CBC, urea, creatinine, INR.",
    "Cirrhosis or suspected varices? Use the variceal bleed pathway.",
    "Restrictive transfusion: Hb below 7 g/dL (below 8 with cardiovascular disease).",
    "IV pantoprazole 80 mg while awaiting endoscopy.",
    "Glasgow–Blatchford score: 0–1 can be managed as outpatient; others need endoscopy within 24 hours.",
  ],
  references: [
    "Laine L et al. ACG Clinical Guideline: upper GI and ulcer bleeding. Am J Gastroenterol. 2021",
    "Gralnek IM et al. Endoscopic diagnosis and management of non-variceal upper GI haemorrhage: ESGE guideline update. Endoscopy. 2021",
    "HALT-IT Trial Collaborators. Tranexamic acid in GI bleeding. Lancet. 2020",
    "Lau JYW et al. Timing of endoscopy for acute upper GI bleeding. N Engl J Med. 2020",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Haematemesis (fresh or coffee-ground), melaena; dizziness, syncope." },
        { text: "Tachycardia, postural drop, pallor; high urea relative to creatinine." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Causes: peptic ulcer (NSAIDs, aspirin, H. pylori), oesophagitis, Mallory–Weiss tear, malignancy, varices, Dieulafoy lesion." },
        { text: "Acid impairs clot stability; PPIs reduce rebleeding after endoscopic therapy." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Variceal?", text: "Known or suspected liver disease — treat as variceal.", link: "variceal-bleed-adult", critical: true },
        { label: "Glasgow–Blatchford score", text: "Uses urea, Hb, SBP, pulse, melaena, syncope, liver disease, heart failure; 0–1 = very low risk." },
        { label: "Endoscopy timing", text: "Within 24 hours after resuscitation; very early (under 6–12 hours) does not improve outcomes except in persistent instability." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Variceal bleed", text: "Cirrhosis signs", link: "variceal-bleed-adult" },
        { label: "Lower GI bleed with fast transit", text: "Fresh blood per rectum, shock" },
        { label: "Swallowed blood", text: "Epistaxis, haemoptysis" },
        { label: "Aorto-enteric fistula", text: "Previous aortic graft" },
        { label: "Iron / bismuth stools", text: "Black but guaiac negative" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "CBC, crossmatch, urea, creatinine, LFT, PT/INR, VBG with lactate; repeat Hb." },
        { label: "ECG / troponin", text: "In older patients or with chest pain (demand ischaemia)." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Transfusion", text: "Restrictive: Hb below 7 g/dL (target 7–9); below 8 with cardiovascular disease; more for massive bleeding.", critical: true },
        { label: "PPI", text: "Pantoprazole 80 mg IV pre-endoscopy; after endoscopic therapy for high-risk ulcers, high-dose PPI (bolus plus infusion or intermittent 40 mg twice daily) for 72 hours." },
        { label: "Erythromycin", text: "250 mg IV 30–120 minutes before endoscopy to improve views." },
        { label: "Tranexamic acid", text: "Not recommended — no benefit and more thrombosis (HALT-IT)." },
        { label: "Anticoagulants", text: "Hold; reverse warfarin with PCC and vitamin K for major bleeding; specific reversal for DOACs if life-threatening." },
        { label: "Antiplatelets", text: "Stop aspirin for primary prevention; for secondary prevention restart soon after haemostasis." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU / HDU", text: "Haemodynamic instability, massive transfusion." },
        { label: "Admit", text: "Glasgow–Blatchford 2 or more." },
        { label: "Outpatient", text: "Glasgow–Blatchford 0–1, with outpatient endoscopy arranged." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Over-transfusion." },
        { text: "Tranexamic acid out of habit." },
        { text: "Missing varices in a patient with undiagnosed cirrhosis." },
      ],
    },
  ],
};