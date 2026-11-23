import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Community-acquired pneumonia (adult). v0.1, 23 Nov 2026.
// ATS/IDSA 2019; ATS 2025 update (steroids for severe CAP only; 3–5 days for non-severe; ≥5 days severe; lung ultrasound acceptable).
export const PNEUMONIA_ADULT: ProtocolTopic = {
  id: "pneumonia-adult",
  title: "Community-acquired pneumonia",
  summary:
    "Lung infection acquired outside hospital. Assess severity, start the right antibiotics promptly, give steroids only in severe CAP, and remember India's mimics — TB, melioidosis, scrub typhus, leptospirosis.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — respiratory pathway v0.1 (ATS/IDSA 2019, ATS 2025)",
  keywords: ["pneumonia", "cap", "lrti", "chest infection", "cough fever", "consolidation", "curb-65", "influenza", "h1n1", "melioidosis"],
  notice: "Draft for clinical sign-off. Antibiotic choice must follow local resistance patterns.",
  firstTen: [
    "Oxygen to SpO2 94–98% (88–92% in COPD with CO2 retention).",
    "Severity: CURB-65 plus SpO2, and ATS severe CAP criteria (vasopressors or mechanical ventilation, or 3 or more minor criteria).",
    "Blood cultures and sputum before antibiotics in admitted patients; do not delay antibiotics (aim within 4 hours, within 1 hour if septic).",
    "Admitted, non-severe: beta-lactam (ceftriaxone 1–2 g) plus a macrolide (azithromycin 500 mg), or a respiratory fluoroquinolone if beta-lactam allergic.",
    "Septic shock: treat as sepsis.",
  ],
  references: [
    "Metlay JP et al. Diagnosis and treatment of adults with community-acquired pneumonia: ATS/IDSA guideline. Am J Respir Crit Care Med. 2019",
    "American Thoracic Society. 2025 Clinical practice guideline update: corticosteroids and antibiotic duration in CAP. Am J Respir Crit Care Med. 2025",
    "Dequin PF et al. Hydrocortisone in severe community-acquired pneumonia (CAPE COD). N Engl J Med. 2023",
  ],
  reviewNotes: [
    "2025 ATS update gives no steroid dose in the summaries; the hydrocortisone regimen shown is from the CAPE COD trial — confirm against the full guideline.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Cough, fever, breathlessness, pleuritic chest pain, purulent sputum; confusion in the elderly." },
        { text: "Tachypnoea, hypoxia, crackles, bronchial breathing, dullness." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Pneumococcus is most common; atypicals (Mycoplasma, Legionella), Haemophilus and viruses (influenza) also cause CAP." },
        { text: "Diabetics in India: consider melioidosis (Burkholderia) — needs meropenem or ceftazidime." },
        { text: "Severe CAP is a sepsis syndrome: inflammation drives hypoxia and shock.", link: "sepsis-adult" },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "CURB-65", text: "Confusion, urea over 7 mmol/L (BUN over 19 mg/dL), RR 30 or more, BP below 90 systolic or 60 diastolic, age 65 or over. 0–1 home, 2 admit, 3 or more consider HDU / ICU." },
        { label: "Imaging", text: "Chest X-ray; lung ultrasound is an acceptable alternative when X-ray is not available and staff are trained." },
        { label: "Severe CAP", text: "ICU review; hydrocortisone within 24 hours.", critical: true },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Pulmonary TB", text: "Subacute, weight loss, upper lobe" },
        { label: "Pulmonary embolism", text: "Pleuritic pain, risk factors", link: "pulmonary-embolism-adult" },
        { label: "Heart failure", text: "B-lines, raised BNP", link: "dyspnea-adult" },
        { label: "Scrub typhus / leptospirosis", text: "Eschar, myalgia, AKI, jaundice" },
        { label: "Melioidosis", text: "Diabetic, abscesses" },
        { label: "Influenza / H1N1", text: "Season, myalgia" },
        { label: "Aspiration", text: "Reduced GCS, vomiting" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "CBC, CRP, urea and creatinine, electrolytes, LFT, glucose, VBG / ABG with lactate; blood cultures in moderate or severe CAP." },
        { label: "Microbiology", text: "Sputum Gram stain and culture; sputum GeneXpert if TB is possible; influenza PCR in season; urinary pneumococcal / Legionella antigen in severe CAP." },
        { label: "India tropical screen", text: "Scrub typhus IgM, leptospira IgM, dengue, malaria where the picture fits." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Outpatient", text: "Amoxicillin 1 g three times a day (or doxycycline); add a macrolide or use amoxicillin–clavulanate with comorbidities." },
        { label: "Inpatient non-severe", text: "Ceftriaxone 1–2 g daily plus azithromycin 500 mg daily, or levofloxacin 750 mg daily alone.", critical: true },
        { label: "Severe", text: "Beta-lactam plus macrolide; add MRSA or Pseudomonas cover only with risk factors; meropenem for suspected melioidosis." },
        { label: "Corticosteroids", text: "Severe CAP only, started within 24 hours: hydrocortisone 200 mg/day (CAPE COD regimen). Not for non-severe CAP or confirmed influenza." },
        { label: "Influenza", text: "Oseltamivir 75 mg twice daily for admitted patients, regardless of symptom duration." },
        { label: "Duration", text: "3–5 days for non-severe CAP once clinically stable; at least 5 days for severe CAP." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Vasopressors, mechanical ventilation, or 3 or more minor severe criteria." },
        { label: "Admit", text: "CURB-65 of 2 or more, hypoxia, unable to take oral treatment." },
        { label: "Discharge", text: "CURB-65 0–1, SpO2 92% or more, oral intake, follow-up." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Missing TB in a slow-to-resolve 'pneumonia'." },
        { text: "Steroids for non-severe CAP or influenza." },
        { text: "Missing melioidosis in a diabetic." },
      ],
    },
  ],
};