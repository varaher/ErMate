import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Bacterial meningitis and encephalitis (adult). v0.1, 23 Nov 2026.
// ESCMID 2016; NICE NG240 (2024); IDSA 2004 / 2008 encephalitis.
export const MENINGITIS_ADULT: ProtocolTopic = {
  id: "meningitis-adult",
  title: "Meningitis and encephalitis (adult)",
  summary:
    "Fever with headache, neck stiffness or altered sensorium. Antibiotics (and dexamethasone) within the hour — never delay them for CT or lumbar puncture.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — neurology pathway v0.1 (ESCMID 2016, NICE NG240 2024)",
  keywords: ["meningitis", "encephalitis", "fever headache", "neck stiffness", "altered sensorium fever", "lumbar puncture", "csf", "ceftriaxone", "aciclovir", "acyclovir", "japanese encephalitis", "tb meningitis"],
  notice: "Draft for clinical sign-off. Antibiotic choice must follow local resistance patterns.",
  firstTen: [
    "ABC; glucose; blood cultures.",
    "Dexamethasone 10 mg IV with or just before the first antibiotic dose.",
    "Ceftriaxone 2 g IV (every 12 hours) within 1 hour of arrival; add ampicillin if over 50, pregnant or immunocompromised; vancomycin where pneumococcal resistance is a concern.",
    "Aciclovir 10 mg/kg IV every 8 hours if encephalitis is possible (confusion, behaviour change, seizures, focal signs).",
    "CT before LP only for focal deficit, new seizure, GCS below 10, papilloedema or severe immunocompromise — antibiotics first.",
  ],
  references: [
    "van de Beek D et al. ESCMID guideline: diagnosis and treatment of acute bacterial meningitis. Clin Microbiol Infect. 2016",
    "National Institute for Health and Care Excellence. Meningitis (bacterial) and meningococcal disease: recognition, diagnosis and management (NG240). 2024",
    "Tunkel AR et al. The management of encephalitis: IDSA clinical practice guidelines. Clin Infect Dis. 2008",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Fever, headache, neck stiffness, altered consciousness — all four present in under half." },
        { text: "Petechial or purpuric rash (meningococcal), seizures, focal deficits, photophobia, vomiting." },
        { text: "Encephalitis: confusion, behaviour change, seizures, focal signs, often with fever." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Bacteria (pneumococcus, meningococcus, Haemophilus; Listeria in the elderly and immunocompromised) invade the subarachnoid space; the inflammatory response causes oedema, vasculitis and raised ICP." },
        { text: "Dexamethasone reduces inflammation-driven damage (especially in pneumococcal meningitis) if given before or with the first antibiotic." },
        { text: "India: also TB meningitis (subacute), Japanese encephalitis, scrub typhus, cerebral malaria, dengue, neurocysticercosis." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Antibiotics first", text: "Within 1 hour; take blood cultures but do not wait for CT or LP.", critical: true },
        { label: "LP", text: "As soon as safe: opening pressure, cell count, protein, glucose (with paired blood glucose), Gram stain, culture, PCR panel; ADA and GeneXpert if TB is possible." },
        { label: "Subacute (over 5 days)", text: "Think TB, fungal (cryptococcal in HIV) or partially treated bacterial meningitis." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Subarachnoid haemorrhage", text: "Thunderclap onset", link: "sah-adult" },
        { label: "Sepsis with delirium", text: "Another source", link: "sepsis-adult" },
        { label: "Cerebral malaria", text: "Travel / endemic area, smear positive" },
        { label: "Scrub typhus", text: "Eschar, fever, encephalopathy" },
        { label: "Brain abscess", text: "Focal signs, ring lesion" },
        { label: "Non-convulsive status", text: "Persistent confusion after seizure", link: "seizure-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Blood cultures (before antibiotics), CBC, CRP, glucose, renal and liver function, coagulation, lactate; malaria test, dengue and scrub typhus serology as indicated; HIV." },
        { label: "CSF", text: "Opening pressure, cells, protein, glucose ratio, Gram stain, culture, multiplex PCR (including HSV), TB tests if indicated." },
        { label: "Imaging", text: "CT before LP only with the criteria in First 10 minutes; MRI for encephalitis." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Empirical antibiotics", text: "Ceftriaxone 2 g IV every 12 hours (or cefotaxime 2 g every 4–6 hours); add ampicillin 2 g every 4 hours if over 50, immunocompromised, pregnant or alcohol-dependent; add vancomycin where penicillin-resistant pneumococcus is a concern.", critical: true },
        { label: "Dexamethasone", text: "10 mg IV every 6 hours for 4 days, started with or before the first antibiotic; stop if not pneumococcal or bacterial." },
        { label: "Aciclovir", text: "10 mg/kg IV every 8 hours (adjust for renal function) until HSV is excluded.", critical: true },
        { label: "Doxycycline", text: "Add for suspected scrub typhus or rickettsial infection." },
        { label: "Supportive", text: "Treat seizures, raised ICP, hyponatraemia, shock." },
        { label: "Contacts", text: "Chemoprophylaxis (ciprofloxacin single dose) for close contacts of meningococcal disease." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Lumbar puncture", text: "Lateral position for opening pressure; correct coagulopathy first.", link: "lp-procedure" },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "GCS below 13, seizures, shock, purpuric rash, raised ICP." },
        { label: "Admit", text: "All suspected bacterial meningitis and encephalitis, with isolation (droplet) for the first 24 hours of antibiotics." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for CT before antibiotics." },
        { text: "Forgetting dexamethasone with the first dose." },
        { text: "Missing HSV encephalitis presenting as behaviour change." },
        { text: "Missing scrub typhus — look for an eschar." },
      ],
    },
  ],
};