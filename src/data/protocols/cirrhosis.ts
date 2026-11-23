import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Decompensated cirrhosis (overview page of the liver pathway).
// v0.3, 23 Nov 2026: rewritten as a WikEM-style page with linked branch topics
// (variceal bleed, SBP, hepatic encephalopathy, AKI / HRS-AKI). Updated to Baveno VIII (J Hepatol 2026),
// AASLD 2021/2024 guidance and the 2024 ADQI–ICA AKI consensus. Status stays "draft" until clinical sign-off.
export const CIRRHOSIS_ADULT: ProtocolTopic = {
  id: "cirrhosis-liver-adult",
  title: "Decompensated cirrhosis",
  summary:
    "A patient with cirrhosis who has become acutely unwell. Find which complication is driving it — bleeding, infection, encephalopathy or kidney injury — because more than one is often present at once.",
  population: "adult",
  status: "draft",
  version: "0.3",
  reviewedOn: "",
  source: "ErMate Handbook — liver emergencies pathway v0.3 (founder pathway, updated to current guidelines)",
  keywords: ["cirrhosis", "chronic liver disease", "cld", "liver failure", "decompensated", "aclf", "ascites", "abdominal distension", "jaundice", "alcohol", "hematemesis", "haematemesis", "melena", "melaena", "confusion"],
  notice: "Draft for clinical sign-off. Doses and drug choices must be confirmed against the patient and your hospital formulary.",
  firstTen: [
    "ABCDE. Secure the airway early for massive haematemesis or a patient who cannot protect it (falling GCS, vomiting).",
    "Bedside glucose now. Correct hypoglycaemia at once; give thiamine as well in alcohol use or malnutrition, but never delay glucose for it.",
    "Two large-bore IV lines. Send CBC, RFT, sodium, potassium, LFT, PT/INR, VBG with lactate and blood cultures; group and crossmatch if bleeding.",
    "Decide which branch is present — variceal bleed, SBP or other infection, hepatic encephalopathy, AKI — and open each pathway that applies.",
    "Ascites present? Plan a diagnostic tap in the ED. Do not wait for fever or abdominal pain.",
  ],
  references: [
    "Baveno VIII Faculty. Baveno VIII – Advancing consensus in portal hypertension. J Hepatol. 2026 (published online 19 Aug 2026)",
    "Kaplan DE et al. AASLD Practice Guidance on risk stratification and management of portal hypertension and varices in cirrhosis. Hepatology. 2024",
    "Biggins SW et al. AASLD Practice Guidance: ascites, SBP and hepatorenal syndrome. Hepatology. 2021",
    "Nadim MK et al. Acute kidney injury in cirrhosis: ADQI and ICA joint consensus. J Hepatol. 2024",
    "EASL Clinical Practice Guidelines for the management of patients with decompensated cirrhosis. J Hepatol. 2018",
    "Vilstrup H et al. Hepatic encephalopathy in chronic liver disease: AASLD/EASL practice guideline. Hepatology. 2014",
    "Rosen's Emergency Medicine and Tintinalli's Emergency Medicine: liver and GI bleeding chapters (verification)",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      note: "Ask about the four decompensating events and look for signs of chronic liver disease.",
      items: [
        { label: "Bleeding", text: "Haematemesis, coffee-ground vomit, melaena, dizziness or syncope." },
        { label: "Infection", text: "Fever, abdominal pain or tenderness — but SBP is often painless and afebrile; new confusion or AKI may be the only clue." },
        { label: "Brain", text: "Day–night reversal, drowsiness, confusion, flapping tremor (asterixis)." },
        { label: "Fluid and kidney", text: "Increasing abdominal girth, breathlessness from tense ascites or hydrothorax, reduced urine output." },
        { label: "Chronic liver disease", text: "Jaundice, spider naevi, palmar erythema, gynaecomastia, splenomegaly, caput medusae, muscle wasting." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      note: "Scarring raises portal pressure. Almost every emergency in cirrhosis follows from that, or from the failing liver itself.",
      items: [
        { label: "Portal hypertension", text: "Blood diverts through collaterals, so oesophageal and gastric varices form and can bleed torrentially.", link: "variceal-bleed-adult" },
        { label: "Splanchnic vasodilation", text: "Effective circulating volume falls, so the renin–angiotensin, sympathetic and ADH systems switch on: salt and water retention (ascites, low sodium) and kidney vasoconstriction.", link: "hrs-aki-adult" },
        { label: "Bacterial translocation", text: "Gut bacteria cross into ascitic fluid, which has little defence of its own.", link: "sbp-adult" },
        { label: "Failing clearance", text: "Ammonia and other gut-derived toxins bypass the liver and reach the brain.", link: "hepatic-encephalopathy-adult" },
        { label: "Rebalanced clotting", text: "Pro- and anticoagulant factors both fall. A raised INR does not predict bleeding and does not need correcting on its own." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      note: "Stabilise first, then work through each branch. Treat every branch that is present — they drive each other.",
      items: [
        { label: "Step 1 — Stabilise", text: "Airway, oxygen to target SpO2 94–98%, two large-bore lines, glucose, continuous monitoring.", critical: true },
        { label: "Step 2 — Bleeding?", text: "Haematemesis or melaena in known or suspected cirrhosis: treat as variceal until endoscopy shows otherwise.", link: "variceal-bleed-adult" },
        { label: "Step 3 — Infection?", text: "Tap the ascites, culture blood and urine, chest X-ray. Start antibiotics early.", link: "sbp-adult" },
        { label: "Step 4 — Confused?", text: "Exclude hypoglycaemia, head injury, sepsis and alcohol withdrawal before calling it encephalopathy.", link: "hepatic-encephalopathy-adult" },
        { label: "Step 5 — Creatinine up?", text: "Stop nephrotoxins and diuretics, look for the cause, assess volume.", link: "hrs-aki-adult" },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Variceal bleed", text: "Haematemesis, shock, known varices", link: "variceal-bleed-adult" },
        { label: "Spontaneous bacterial peritonitis", text: "Ascites with fever, pain, confusion or AKI", link: "sbp-adult" },
        { label: "Hepatic encephalopathy", text: "Confusion, asterixis, a precipitant", link: "hepatic-encephalopathy-adult" },
        { label: "AKI / HRS-AKI", text: "Rising creatinine, low urine output", link: "hrs-aki-adult" },
        { label: "Peptic ulcer bleed", text: "Non-variceal upper GI bleed", link: "upper-gi-bleed-adult" },
        { label: "Sepsis — other source", text: "Chest, urine, skin, cholangitis", link: "sepsis-adult" },
        { label: "Alcohol-related hepatitis", text: "Jaundice, fever, tender liver, recent heavy drinking", link: "alcoholic-hepatitis-adult" },
        { label: "Portal vein thrombosis", text: "Sudden ascites, abdominal pain, new bleed", link: "portal-vein-thrombosis-adult" },
        { label: "Hepatocellular carcinoma", text: "New decompensation, weight loss" },
        { label: "Intracranial haemorrhage", text: "Confusion with a fall or focal signs", link: "intracranial-haemorrhage-adult" },
        { label: "Wernicke / alcohol withdrawal", text: "Ataxia, eye signs, tremor, agitation", link: "alcohol-withdrawal-adult" },
        { label: "Hypoglycaemia", text: "Always check before labelling HE", link: "hypoglycaemia-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "CBC, RFT, sodium, potassium, magnesium, LFT, albumin, PT/INR, glucose, VBG with lactate, blood cultures; group and crossmatch if bleeding." },
        { label: "Ascitic fluid", text: "Cell count with neutrophil (PMN) count, albumin for SAAG, total protein; inoculate blood-culture bottles at the bedside." },
        { label: "Urine", text: "Routine, culture and urine sodium; protein and microscopy when AKI is present." },
        { label: "Imaging", text: "Chest X-ray; ultrasound abdomen with Doppler for portal vein thrombosis and liver masses." },
        { label: "New ascites", text: "Add hepatitis B surface antigen and hepatitis C antibody." },
        { label: "ECG", text: "Before terlipressin, and in any patient with low potassium or on QT-prolonging drugs." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      note: "Common to every branch. Branch-specific drugs and doses are on each linked pathway.",
      items: [
        { label: "Kidneys", text: "Avoid NSAIDs, aminoglycosides, ACE inhibitors / ARBs and IV contrast where possible.", critical: true },
        { label: "Diuretics and beta-blockers", text: "Hold when there is hypotension (MAP below 65), AKI, sepsis or active bleeding. Do not stop them automatically in every patient." },
        { label: "Thiamine", text: "IV thiamine in alcohol use or malnutrition — alongside glucose, never before it." },
        { label: "Sedatives", text: "Avoid benzodiazepines and opioids where possible; they precipitate encephalopathy. Treat alcohol withdrawal on its own pathway.", link: "alcohol-withdrawal-adult" },
        { label: "Fluids", text: "Use albumin or blood for the indications on each pathway; avoid large volumes of saline, which worsen ascites and oedema." },
        { label: "Early referral", text: "Gastroenterology / hepatology early; ICU for organ failure; transplant centre contact for ACLF." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Diagnostic paracentesis", text: "Safe despite a raised INR or low platelets; ultrasound-guided where available. Avoid only with DIC or clinically obvious fibrinolysis.", link: "paracentesis-procedure" },
        { label: "Large-volume paracentesis", text: "For tense ascites. Give albumin 6–8 g per litre removed when more than 5 litres is drained.", link: "paracentesis-procedure" },
        { label: "Bridge for uncontrolled variceal bleeding", text: "Oesophageal self-expanding metal stent where available, otherwise balloon tamponade after intubation.", link: "variceal-bleed-adult" },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Shock, active major bleeding, intubated, grade III–IV encephalopathy, multi-organ failure (ACLF)." },
        { label: "HDU / monitored bed", text: "Vasoactive infusion, AKI, grade II encephalopathy, SBP with renal dysfunction." },
        { label: "Ward", text: "Stable, complication identified and treatment started." },
        { label: "Discharge", text: "Uncomplicated ascites relieved by a tap, SBP excluded, reliable follow-up arranged." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for fever before tapping the ascites — SBP is often afebrile." },
        { text: "Giving FFP to correct the INR — it raises portal pressure and does not reduce bleeding." },
        { text: "Trusting a normal creatinine — low muscle mass hides real kidney injury." },
        { text: "Labelling confusion as encephalopathy without checking glucose and excluding a head bleed." },
        { text: "Over-transfusing a variceal bleed — it raises portal pressure and restarts bleeding." },
      ],
    },
  ],
};