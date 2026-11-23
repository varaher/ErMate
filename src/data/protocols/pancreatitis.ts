import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Acute pancreatitis (adult). v0.1, 23 Nov 2026.
// ACG 2024 guideline; WATERFALL (NEJM 2022): moderate (not aggressive) fluids; early oral feeding; no prophylactic antibiotics.
export const PANCREATITIS_ADULT: ProtocolTopic = {
  id: "pancreatitis-adult",
  title: "Acute pancreatitis",
  summary:
    "Epigastric pain radiating to the back with raised lipase. Moderate fluids (not aggressive), early feeding, good analgesia, find the cause — and spot severe disease early.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — GI pathway v0.1 (ACG 2024, WATERFALL)",
  keywords: ["pancreatitis", "acute pancreatitis", "epigastric pain back", "lipase", "amylase", "gallstone pancreatitis", "alcohol pancreatitis", "hypertriglyceridaemia"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Diagnosis: 2 of 3 — typical pain, lipase (or amylase) 3 times the upper limit, or imaging findings.",
    "Analgesia: opioids are acceptable.",
    "Fluids: Ringer's lactate; 10 mL/kg bolus only if hypovolaemic, then 1.5 mL/kg/hour; reassess at 12, 24, 48 and 72 hours.",
    "Look for the cause: ultrasound for gallstones; triglycerides, calcium, alcohol history.",
    "Organ failure (hypotension, hypoxia, AKI) or cholangitis: HDU / ICU and urgent ERCP for cholangitis.",
  ],
  references: [
    "Tenner S et al. American College of Gastroenterology Guidelines: Management of Acute Pancreatitis. Am J Gastroenterol. 2024",
    "de-Madaria E et al. Aggressive or moderate fluid resuscitation in acute pancreatitis (WATERFALL). N Engl J Med. 2022",
    "Banks PA et al. Classification of acute pancreatitis — 2012: revision of the Atlanta classification. Gut. 2013",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Severe epigastric pain radiating to the back, vomiting, epigastric tenderness, fever." },
        { text: "Severe: tachycardia, hypotension, hypoxia, oliguria; Grey Turner's or Cullen's sign (late)." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Premature activation of pancreatic enzymes causes autodigestion and a systemic inflammatory response; capillary leak causes hypovolaemia and organ failure." },
        { text: "Causes: gallstones, alcohol, hypertriglyceridaemia (above 1000 mg/dL), drugs, ERCP, hypercalcaemia, trauma, scorpion sting (India)." },
        { text: "Over-aggressive fluids worsen outcomes (WATERFALL) — more fluid overload without benefit." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Severity", text: "Revised Atlanta: mild (no organ failure), moderately severe (transient under 48 h or local complications), severe (persistent organ failure over 48 h). BISAP or SIRS help early.", critical: true },
        { label: "Imaging", text: "Ultrasound for gallstones on admission; CT only if the diagnosis is uncertain or no improvement after 48–72 hours." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Perforated peptic ulcer", text: "Free air, rigid abdomen" },
        { label: "Acute cholecystitis / cholangitis", text: "RUQ, jaundice, fever" },
        { label: "Mesenteric ischaemia", text: "Pain out of proportion, AF" },
        { label: "Inferior MI", text: "Epigastric pain, ST elevation II, III, aVF", link: "cad-acs-adult" },
        { label: "Ruptured AAA", text: "Elderly, back pain, shock" },
        { label: "DKA", text: "Raised glucose, ketones" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Lipase (preferred) or amylase, CBC, renal function, LFT, calcium, triglycerides, glucose, VBG with lactate, CRP (at 48 hours for severity)." },
        { label: "Imaging", text: "Ultrasound abdomen; CT after 72 hours for complications." },
        { label: "ECG", text: "Exclude inferior MI." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Fluids", text: "Moderate goal-directed: Ringer's lactate 1.5 mL/kg/hour, with a 10 mL/kg bolus only if hypovolaemic; reassess often and reduce once hypovolaemia resolves.", critical: true },
        { label: "Analgesia", text: "Paracetamol, opioids as needed." },
        { label: "Feeding", text: "Oral diet within 24 hours as tolerated (low-fat solid); enteral (NG / NJ) if not tolerated — not prolonged nil by mouth." },
        { label: "Antibiotics", text: "Not prophylactic; only for proven infection (cholangitis, infected necrosis)." },
        { label: "Gallstones", text: "ERCP within 24 hours for cholangitis; cholecystectomy in the same admission for mild gallstone pancreatitis." },
        { label: "Hypertriglyceridaemia", text: "Insulin infusion (with dextrose) to lower triglycerides; plasmapheresis in selected severe cases." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU / HDU", text: "Organ failure, SIRS persisting, high BISAP." },
        { label: "Ward", text: "Mild pancreatitis." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Litres of fluid 'to prevent necrosis'." },
        { text: "Prophylactic antibiotics." },
        { text: "Early CT that changes nothing." },
        { text: "Prolonged nil by mouth." },
      ],
    },
  ],
};