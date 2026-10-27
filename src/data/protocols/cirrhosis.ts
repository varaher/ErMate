import type { ProtocolTopic } from "./protocolTypes";

// Source: Clinical Pathway Emergency Liver Disease v3 (4 pages), ErMate Pathway adaptation (26 Oct 2026).
// Status stays "draft" until clinical governance review. Exact terlipressin, albumin, antibiotic and blood-product
// decisions need current guidance, contraindication screening and local formulary review.
export const CIRRHOSIS_ADULT: ProtocolTopic = {
  id: "cirrhosis-liver-adult",
  title: "Decompensated cirrhosis and liver emergencies (Adult)",
  summary: "Search actively for infection and GI bleeding; branch by presentation: variceal hemorrhage, hepatic encephalopathy, SBP, AKI / possible HRS-AKI.",
  population: "adult",
  status: "draft",
  version: "0.2",
  reviewedOn: "",
  source: "Clinical Pathway Emergency Liver Disease v3, ErMate Pathway adaptation 26 Oct 2026",
  keywords: ["cirrhosis", "liver failure", "hematemesis", "haematemesis", "vomiting blood", "melena", "variceal bleed", "ascites", "jaundice", "encephalopathy", "confusion", "sbp", "peritonitis", "hrs", "aclf", "alcohol"],
  notice: "Clinical review draft for clinical governance. Doses, contraindications and local formulary choices need clinician approval before deployment.",
  reviewNotes: [
    "Routine cessation of beta-blockers/diuretics for all decompensations is overbroad; decisions depend on shock, AKI, hypotension and volume status.",
    "A mandatory 48-hour albumin challenge before HRS diagnosis reflects older criteria; review against the newer ADQI/ICA consensus.",
    "Thiamine is appropriate for patients at risk of deficiency, but urgent correction of hypoglycemia must not be delayed.",
    "Exact terlipressin, albumin, antibiotic and blood-product decisions need current guidance, contraindication screening and local formulary review.",
  ],
  references: [
    "WikEM: Hepatic encephalopathy; Spontaneous bacterial peritonitis (topic-level clinical reference)",
    "Tintinalli's Emergency Medicine: Gastrointestinal and Hepatic Emergencies",
    "Rosen's Emergency Medicine: Cirrhosis and Complications",
    "EASL. Clinical Practice Guidelines for the management of patients with decompensated cirrhosis. J Hepatol. 2018",
    "de Franchis R et al. Baveno VII: Renewing consensus in portal hypertension. J Hepatol. 2022",
    "Biggins SW et al. Diagnosis, Evaluation, and Management of Ascites, SBP and Hepatorenal Syndrome. AASLD Practice Guidance. Hepatology. 2021",
    "Nadim MK et al. Acute kidney injury in patients with cirrhosis: ADQI and ICA joint multidisciplinary consensus. J Hepatol. 2024",
  ],
  sections: [
    {
      heading: "1. Recognition",
      items: [
        { text: "Acute decompensation may present with ascites, variceal hemorrhage, hepatic encephalopathy, spontaneous bacterial peritonitis (SBP), acute kidney injury or acute-on-chronic liver failure (ACLF)." },
        { text: "Search actively for infection and gastrointestinal bleeding." },
      ],
    },
    {
      heading: "2. Red flags",
      items: [
        { text: "Massive hematemesis or shock; grade III–IV encephalopathy with inability to protect the airway.", critical: true },
        { text: "Sepsis, peritonitis, hypoglycemia, severe AKI, respiratory compromise from ascites/hydrothorax, or multiorgan dysfunction.", critical: true },
      ],
    },
    {
      heading: "3. Differential diagnosis",
      items: [
        { text: "Sepsis/SBP, non-variceal GI bleeding, intracranial pathology, medication toxicity, electrolyte/glucose abnormalities, prerenal AKI, acute tubular injury, obstruction and HRS-AKI." },
      ],
    },
    {
      heading: "4. ABCDE / first 0–10 minutes",
      items: [
        { label: "Airway", text: "Assess aspiration risk and airway protection in severe encephalopathy or hematemesis.", critical: true },
        { label: "Circulation and disability", text: "Check oxygenation, circulation, bedside glucose, mental status and temperature; establish IV access and monitor perfusion." },
        { label: "Medicines", text: "Avoid nephrotoxins. Review diuretics and nonselective beta-blockers in the context of hypotension, AKI or severe infection rather than stopping them automatically in every patient." },
      ],
    },
    {
      heading: "5. Evaluation / 10–30 minutes",
      items: [
        { label: "Labs", text: "CBC, electrolytes, renal function, liver tests, albumin, PT/INR, glucose, blood gas/lactate as indicated; blood and urine cultures; chest imaging when appropriate." },
        { label: "Diagnostic paracentesis", text: "Prompt for hospitalised patients with cirrhosis and ascites: ascitic PMN count, culture and albumin/protein. SBP threshold: PMN at least 250 cells/mm3." },
        { label: "AKI work-up", text: "Assess baseline creatinine, urine studies and alternative causes of AKI; seek gastroenterology/hepatology and critical care input early." },
      ],
    },
    {
      heading: "Branch A: suspected variceal hemorrhage",
      items: [
        { label: "Resuscitate", text: "Restrictive red-cell transfusion threshold around Hb 7 g/dL, individualised for active exsanguination or ischemic heart disease.", critical: true },
        { label: "Vasoactive agent", text: "Start promptly: octreotide 50 micrograms IV bolus then 50 micrograms/hour infusion, or terlipressin per local protocol.", critical: true },
        { label: "Antibiotic prophylaxis", text: "e.g. ceftriaxone 1 g IV daily, according to local resistance and allergy guidance." },
        { label: "Endoscopy", text: "Urgent, after stabilisation, typically within 12 hours; consider rescue interventions and early TIPS in selected high-risk patients." },
        { text: "Avoid routine TXA or correction of INR with FFP solely because of cirrhosis." },
      ],
    },
    {
      heading: "Branch B: hepatic encephalopathy",
      items: [
        { text: "Treat precipitating infection, GI bleed, constipation, dehydration, electrolyte abnormalities and sedative exposure." },
        { label: "Lactulose", text: "PO/NG titrated to 2–3 soft stools/day; rifaximin 550 mg PO twice daily as add-on when indicated." },
        { text: "Monitor aspiration, stool losses and volume status; severe encephalopathy requires monitored/ICU care.", critical: true },
      ],
    },
    {
      heading: "Branch C: SBP",
      items: [
        { text: "If ascitic PMN is at least 250/mm3, start empiric IV antibiotics guided by acquisition setting, resistance risk and renal function. Do not wait for culture results.", critical: true },
        { label: "Albumin", text: "Consider IV albumin 1.5 g/kg on day 1 and 1 g/kg on day 3, particularly with renal dysfunction or high-risk laboratory features; assess fluid overload risk." },
        { text: "Reassess clinical response and cultures; broaden the evaluation if secondary peritonitis is suspected." },
      ],
    },
    {
      heading: "Branch D: AKI / possible HRS-AKI",
      items: [
        { text: "Identify AKI, review volume status and medications, treat infection, assess urine and ultrasound as appropriate." },
        { text: "A mandatory 48-hour albumin challenge is not a universally required modern diagnostic prerequisite; current consensus uses earlier assessment and individualised resuscitation." },
        { text: "When HRS-AKI is established, specialist-directed vasoconstrictor therapy plus albumin may be used with respiratory/cardiovascular monitoring; consider transplant evaluation." },
      ],
    },
    {
      heading: "6. Reassessment and disposition",
      items: [
        { text: "Trend mental status, bleeding, urine output, creatinine, electrolytes, lactate when indicated, respiratory status and volume balance." },
        { label: "ICU", text: "Shock, major bleeding, airway compromise or multiorgan failure." },
        { label: "Monitored unit", text: "Severe HE/HRS or active infusion." },
        { label: "Ward", text: "Stabilised cases with ongoing inpatient treatment." },
      ],
    },
  ],
};