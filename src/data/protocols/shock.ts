import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Undifferentiated shock (adult). v0.1, 23 Nov 2026.
export const SHOCK_UNDIFFERENTIATED_ADULT: ProtocolTopic = {
  id: "shock-undifferentiated-adult",
  title: "Shock — undifferentiated (adult)",
  summary:
    "Inadequate tissue perfusion. Recognise it before the blood pressure falls, decide which of the four types it is at the bedside, and treat the type.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — resuscitation pathway v0.1",
  keywords: ["shock", "hypotension", "low bp", "hypoperfusion", "lactate", "rush", "vasopressor", "noradrenaline", "norepinephrine", "cold peripheries"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "ABC, oxygen to SpO2 94–98%, two large-bore IV lines, monitoring.",
    "Look for hypoperfusion: altered mental state, cold mottled skin, capillary refill over 3 seconds, low urine output, lactate above 2 mmol/L.",
    "Bedside ultrasound (heart, IVC, lungs, abdomen, aorta) to sort the type.",
    "Treat the type: bleed → blood; sepsis → antibiotics and fluids; obstruction → relieve it; cardiogenic → careful fluids, inotrope, cardiology.",
    "Noradrenaline early (peripheral line acceptable short-term) if MAP stays below 65 mmHg.",
  ],
  references: [
    "Vincent JL, De Backer D. Circulatory shock. N Engl J Med. 2013",
    "Prescott HC et al. Surviving Sepsis Campaign: International Guidelines 2026. Crit Care Med. 2026",
    "van Diepen S et al. Contemporary management of cardiogenic shock: AHA scientific statement. Circulation. 2017",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Confusion or agitation, breathlessness, thirst, reduced urine output." },
        { text: "Tachycardia, tachypnoea, low or narrow pulse pressure, cold mottled or warm flushed skin, raised or flat neck veins." },
        { text: "Blood pressure can be normal early — a raised lactate or shock index above 1 matters." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { label: "Hypovolaemic", text: "Loss of blood or fluid → low preload. Flat IVC, hyperdynamic small heart.", link: "variceal-bleed-adult" },
        { label: "Distributive", text: "Vasodilation (sepsis, anaphylaxis, spinal, adrenal) → warm peripheries early.", link: "sepsis-adult" },
        { label: "Cardiogenic", text: "Pump failure (MI, myocarditis, arrhythmia) → cold, wet, poor contractility.", link: "cad-acs-adult" },
        { label: "Obstructive", text: "Tamponade, tension pneumothorax, massive PE → dilated RV or effusion, distended IVC.", link: "pulmonary-embolism-adult" },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Recognise", text: "Hypoperfusion signs and lactate, not blood pressure alone.", critical: true },
        { label: "Ultrasound (RUSH)", text: "Pump (effusion, contractility, RV size), tank (IVC, free fluid, lung B-lines, pneumothorax), pipes (aorta, DVT)." },
        { label: "Fluids", text: "Give 500 mL balanced crystalloid boluses and reassess after each (pulse, perfusion, lung ultrasound) unless cardiogenic or bleeding." },
        { label: "Mixed shock is common", text: "Septic cardiomyopathy, bleeding plus sepsis in cirrhosis — reassess often.", link: "cirrhosis-liver-adult" },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Septic shock", text: "Fever, source, warm or cold", link: "sepsis-adult" },
        { label: "Anaphylaxis", text: "Exposure, rash, wheeze, angio-oedema", link: "anaphylaxis-adult" },
        { label: "Haemorrhagic shock", text: "Trauma, GI bleed, ectopic, AAA", link: "haemorrhagic-shock-adult" },
        { label: "Variceal bleed", text: "Cirrhosis with haematemesis", link: "variceal-bleed-adult" },
        { label: "Cardiogenic (ACS)", text: "Chest pain, ECG changes, B-lines", link: "cad-acs-adult" },
        { label: "Massive PE", text: "Hypoxia, dilated RV", link: "pulmonary-embolism-adult" },
        { label: "Tension pneumothorax", text: "Absent sliding, deviated trachea", link: "tension-pneumothorax-adult" },
        { label: "Cardiac tamponade", text: "Effusion, distended IVC", link: "cardiac-tamponade-adult" },
        { label: "Adrenal crisis", text: "Steroid use, low sodium, high potassium", link: "adrenal-crisis-adult" },
        { label: "Poisoning", text: "CCB, beta-blocker, aluminium phosphide", link: "poisoning-approach-adult" },
        { label: "Arrhythmia", text: "Very fast or very slow rate", link: "tachycardia-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "VBG with lactate, CBC, group and crossmatch, renal and liver function, electrolytes, glucose, coagulation, troponin, blood cultures; beta-hCG in women of childbearing age." },
        { label: "ECG", text: "Ischaemia, arrhythmia, right heart strain, electrolyte changes." },
        { label: "Imaging", text: "Bedside ultrasound first; chest X-ray; CT as the suspected cause dictates once stable enough." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Target", text: "MAP about 65 mmHg (60–65 in patients aged 65 and over with septic shock), improving mental state, urine output above 0.5 mL/kg/hour, falling lactate." },
        { label: "Noradrenaline", text: "First-line vasopressor: start 0.05–0.1 microgram/kg/minute and titrate. A peripheral line in a large vein is acceptable for the first hours while central access is arranged.", critical: true },
        { label: "Haemorrhage", text: "Blood products early, not crystalloid; stop the bleeding.", link: "haemorrhagic-shock-adult" },
        { label: "Cardiogenic", text: "Small fluid challenge only if no B-lines; dobutamine for low output; noradrenaline for hypotension; urgent cardiology and revascularisation for MI.", link: "cad-acs-adult" },
        { label: "Obstructive", text: "Decompress tension pneumothorax, drain tamponade, thrombolyse massive PE.", critical: true },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU / HDU", text: "All patients needing vasopressors or with persistent hyperlactataemia." },
        { label: "Theatre / cath lab / IR", text: "When the cause needs source control." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for hypotension before calling it shock." },
        { text: "Large crystalloid volumes in haemorrhagic or cardiogenic shock." },
        { text: "Delaying vasopressors until a central line is in." },
        { text: "Forgetting adrenal crisis in a patient on long-term steroids." },
      ],
    },
  ],
};