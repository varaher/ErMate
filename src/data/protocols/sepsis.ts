import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Sepsis and septic shock (adult). v0.1, 23 Nov 2026.
// Surviving Sepsis Campaign 2026 (Crit Care Med, 23 Mar 2026): screen with NEWS2/MEWS/SIRS not qSOFA alone;
// antibiotics within 1 hour in shock; balanced crystalloids; MAP ~65 managed as a range (60–65 if aged 65+);
// beta-lactam loading dose + extended infusion; avoid routine anaerobic / antifungal cover; de-escalate.
export const SEPSIS_ADULT: ProtocolTopic = {
  id: "sepsis-adult",
  title: "Sepsis and septic shock (adult)",
  summary:
    "Life-threatening organ dysfunction caused by the body's response to infection. In shock, antibiotics within the hour; otherwise act fast but confirm the diagnosis.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — resuscitation pathway v0.1 (Surviving Sepsis Campaign 2026)",
  keywords: ["sepsis", "septic shock", "infection", "fever", "hypotension", "lactate", "antibiotics", "news2", "qsofa", "sirs", "noradrenaline"],
  notice: "Draft for clinical sign-off. Antibiotic choice must follow your hospital antibiogram.",
  firstTen: [
    "Screen with NEWS2 (or MEWS / SIRS), not qSOFA alone. Check lactate.",
    "Two blood cultures (and other relevant cultures) before antibiotics — but never delay antibiotics in shock.",
    "Septic shock: broad-spectrum antibiotics immediately, within 1 hour.",
    "Hypoperfusion: balanced crystalloid (Ringer's lactate) boluses, reassessing after each.",
    "MAP still below 65 mmHg: start noradrenaline (peripheral line acceptable initially).",
  ],
  references: [
    "Prescott HC et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026. Crit Care Med. 2026",
    "Evans L et al. Surviving Sepsis Campaign: International Guidelines 2021. Crit Care Med. 2021",
    "Singer M et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016",
  ],
  reviewNotes: [
    "SSC 2026 items taken from published summaries (46 new or revised recommendations). Confirm fluid volume, vasopressin and hydrocortisone thresholds against the full 2026 text before sign-off; the values shown follow SSC 2021 where the 2026 summary was silent.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Fever or hypothermia, rigors, breathlessness, confusion, reduced urine output, mottled skin." },
        { text: "Source clues: cough and crackles, dysuria, abdominal pain, cellulitis, line site, meningism." },
        { text: "Elderly, immunosuppressed and cirrhotic patients may have no fever.", link: "sbp-adult" },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "A dysregulated host response causes vasodilation, capillary leak and microcirculatory failure." },
        { text: "Septic shock: vasopressors needed to keep MAP 65 mmHg or more and lactate above 2 mmol/L despite adequate fluids." },
        { text: "Septic cardiomyopathy can add a cardiogenic component — reassess with ultrasound." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Shock present", text: "Treat as an emergency: antibiotics within 1 hour, fluids, vasopressors.", critical: true },
        { label: "Possible sepsis without shock", text: "Assess rapidly; give antibiotics early once infection is likely, balancing against diagnostic uncertainty." },
        { label: "Source control", text: "Find and drain or remove the source (abscess, obstructed urinary tract, cholangitis, infected line, necrotising infection) as soon as practical." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Spontaneous bacterial peritonitis", text: "Cirrhosis with ascites", link: "sbp-adult" },
        { label: "Pneumonia", text: "Cough, crackles, infiltrate", link: "pneumonia-adult" },
        { label: "Urosepsis / obstructed kidney", text: "Dysuria, loin pain, hydronephrosis", link: "urosepsis-adult" },
        { label: "Cholangitis", text: "Fever, jaundice, RUQ pain" },
        { label: "Meningitis", text: "Headache, neck stiffness, rash", link: "meningitis-adult" },
        { label: "Tropical fevers", text: "Dengue, malaria, scrub typhus, leptospirosis", link: "tropical-fever-adult" },
        { label: "Necrotising soft-tissue infection", text: "Pain out of proportion" },
        { label: "Anaphylaxis", text: "Exposure, urticaria, wheeze", link: "anaphylaxis-adult" },
        { label: "Adrenal crisis", text: "Steroid use, refractory hypotension", link: "adrenal-crisis-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Cultures", text: "Two sets of blood cultures before antibiotics; urine, sputum, ascitic fluid, CSF as indicated." },
        { label: "Bloods", text: "Lactate (repeat within 2–4 hours if raised), CBC, CRP, renal and liver function, electrolytes, glucose, coagulation." },
        { label: "Tropical screen (India)", text: "Malaria antigen and smear, dengue NS1 / IgM, scrub typhus IgM, leptospira IgM where the picture fits." },
        { label: "Imaging", text: "Chest X-ray; ultrasound for urinary obstruction, biliary sepsis, abscess; CT for an unclear source." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Antibiotics", text: "Broad-spectrum per source and local antibiogram. Give a loading dose and use extended infusions for beta-lactams. Add MRSA cover only with risk factors.", critical: true },
        { label: "Avoid routine extras", text: "No empiric anaerobic cover for low-risk infections (most pneumonia and UTI); no routine empiric antifungals without specific risk factors." },
        { label: "Fluids", text: "Balanced crystalloid (Ringer's lactate) rather than normal saline. Initial resuscitation about 30 mL/kg within 3 hours for hypoperfusion, given as boluses with reassessment; stop if lungs fill." },
        { label: "Noradrenaline", text: "First-line. Target MAP about 65 mmHg, managed as a range; 60–65 mmHg in patients aged 65 and over.", critical: true },
        { label: "Second agent", text: "Add vasopressin when noradrenaline reaches about 0.25–0.5 microgram/kg/minute; consider adrenaline or dobutamine for cardiac dysfunction." },
        { label: "Hydrocortisone", text: "200 mg per day (50 mg IV every 6 hours) when noradrenaline of 0.25 microgram/kg/minute or more is needed for at least 4 hours." },
        { label: "De-escalate", text: "Narrow or stop antibiotics once cultures and sensitivities are known; plan active fluid removal once shock resolves." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Arterial line", text: "For vasopressor titration." },
        { label: "Central venous access", text: "When vasopressors are needed beyond the first hours.", link: "central-line-procedure" },
        { label: "Source control", text: "Drainage, debridement, line removal, relief of urinary or biliary obstruction." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Septic shock, vasopressors, lactate 4 mmol/L or more, respiratory failure." },
        { label: "HDU / ward", text: "Sepsis without shock, responding to treatment, with close observation." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Relying on qSOFA alone to rule sepsis out." },
        { text: "Delaying antibiotics in shock to wait for cultures or imaging." },
        { text: "Giving fixed fluid volumes without reassessing — fluid overload worsens outcomes." },
        { text: "Missing a drainable source." },
      ],
    },
  ],
};