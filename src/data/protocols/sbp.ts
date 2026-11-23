import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Spontaneous bacterial peritonitis (branch of decompensated cirrhosis). v0.3, 23 Nov 2026.
export const SBP_ADULT: ProtocolTopic = {
  id: "sbp-adult",
  title: "Spontaneous bacterial peritonitis (SBP)",
  summary:
    "Infection of ascitic fluid without a surgical source. Often silent — any patient with ascites who deteriorates needs a diagnostic tap.",
  population: "adult",
  status: "draft",
  version: "0.3",
  reviewedOn: "",
  parent: "cirrhosis-liver-adult",
  source: "ErMate Handbook — liver emergencies pathway v0.3",
  keywords: ["sbp", "spontaneous bacterial peritonitis", "peritonitis", "ascites", "ascitic tap", "paracentesis", "fever ascites", "infected ascites"],
  notice: "Draft for clinical sign-off. Antibiotic choice must follow your hospital antibiogram.",
  firstTen: [
    "Diagnostic tap now — an ascitic neutrophil (PMN) count of 250 per mm³ or more is SBP.",
    "Inoculate blood-culture bottles with ascitic fluid at the bedside; send blood cultures too.",
    "Start IV antibiotics once fluid is taken — do not wait for the cell count if the patient is septic.",
    "Plan IV albumin, especially when creatinine or bilirubin is raised.",
  ],
  references: [
    "Biggins SW et al. AASLD Practice Guidance: ascites, SBP and hepatorenal syndrome. Hepatology. 2021",
    "EASL Clinical Practice Guidelines for the management of patients with decompensated cirrhosis. J Hepatol. 2018",
    "Sort P et al. Effect of IV albumin on renal impairment and mortality in SBP. N Engl J Med. 1999",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Fever, abdominal pain or tenderness, diarrhoea or ileus — or none of these." },
        { text: "New or worsening encephalopathy, AKI, hypotension or unexplained deterioration in a patient with ascites." },
        { text: "Every patient with cirrhosis and ascites admitted to hospital should have a diagnostic tap." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Gut bacteria (mostly gram-negative bacilli) translocate to mesenteric nodes and ascitic fluid." },
        { text: "Low ascitic protein (below 1.5 g/dL) means low complement and opsonins, so infection takes hold easily." },
        { text: "The inflammatory response worsens circulatory dysfunction and precipitates AKI — the main cause of death in SBP.", link: "hrs-aki-adult" },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Tap everyone", text: "Ascites plus any deterioration means a diagnostic tap in the ED, regardless of INR or platelets.", critical: true },
        { label: "Spontaneous or surgical?", text: "Think secondary peritonitis when the fluid has several organisms on Gram stain, total protein above 1 g/dL, glucose below 50 mg/dL or LDH above the serum upper limit — image the abdomen and call surgery." },
        { label: "Bacterascites", text: "Positive culture with PMN below 250: treat if symptomatic, otherwise repeat the tap." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Secondary bacterial peritonitis", text: "Perforation or abscess; polymicrobial", link: "peritonitis-surgical-adult" },
        { label: "Tuberculous peritonitis", text: "Lymphocyte-rich fluid, high protein, ADA raised" },
        { label: "Peritoneal carcinomatosis", text: "Malignant cells, low SAAG" },
        { label: "Pancreatitis", text: "High ascitic amylase", link: "pancreatitis-adult" },
        { label: "Sepsis — other source", text: "Chest, urine, cellulitis, cholangitis", link: "sepsis-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Ascitic fluid", text: "Cell count with PMN count, Gram stain, culture in blood-culture bottles, total protein, albumin (SAAG), glucose, LDH." },
        { label: "Bloods", text: "CBC, RFT, LFT, PT/INR, CRP, lactate, blood cultures." },
        { label: "If secondary peritonitis is suspected", text: "CT abdomen with contrast (weigh the kidney risk) and surgical review." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Community-acquired", text: "Third-generation cephalosporin: cefotaxime 2 g IV every 8 hours or ceftriaxone 2 g IV every 24 hours, for 5–7 days.", critical: true },
        { label: "Hospital-acquired, recent antibiotics or septic shock", text: "Piperacillin–tazobactam 4.5 g IV every 6–8 hours, or meropenem 1 g IV every 8 hours where multidrug-resistant organisms are likely — per your antibiogram." },
        { label: "Albumin", text: "20% albumin 1.5 g/kg within 6 hours of diagnosis and 1 g/kg on day 3. It matters most when creatinine is above 1 mg/dL, urea is high or bilirubin is above 4 mg/dL. Watch for fluid overload.", critical: true },
        { label: "Medicines", text: "Hold diuretics and NSAIDs; review beta-blockers if hypotensive." },
        { label: "Response", text: "Repeat the tap at 48 hours if not improving: a PMN fall of less than 25% means treatment failure — broaden antibiotics and look for a surgical cause." },
        { label: "After recovery", text: "Long-term prophylaxis (for example norfloxacin or ciprofloxacin) — start on the ward, not in the ED." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Diagnostic paracentesis", text: "Left lower quadrant, lateral to the rectus sheath, ultrasound-guided where available. 30–60 mL is enough.", link: "paracentesis-procedure" },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Admit", text: "All patients with SBP." },
        { label: "HDU / ICU", text: "AKI, shock, grade III–IV encephalopathy or ACLF." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Not tapping because there is no fever or pain." },
        { text: "Sending ascitic fluid in a plain container only — bedside blood-culture bottles double the culture yield." },
        { text: "Leaving out albumin in a patient with a raised creatinine." },
      ],
    },
  ],
};