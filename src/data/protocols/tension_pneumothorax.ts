import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Tension pneumothorax (adult). v0.1, 23 Nov 2026. ATLS 11th edition.
export const TENSION_PNEUMOTHORAX_ADULT: ProtocolTopic = {
  id: "tension-pneumothorax-adult",
  title: "Tension pneumothorax",
  summary:
    "Air trapped in the pleural space under pressure, causing obstructive shock. A clinical diagnosis — decompress first, image later.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "chest-trauma-adult",
  source: "ErMate Handbook — trauma pathway v0.1 (ATLS 11th edition)",
  keywords: ["tension pneumothorax", "pneumothorax", "needle decompression", "finger thoracostomy", "absent breath sounds", "tracheal deviation"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Suspect it in chest trauma, ventilated patients or after central lines with hypoxia, hypotension and absent breath sounds on one side.",
    "High-flow oxygen.",
    "Decompress now: finger thoracostomy (or needle) in the 4th–5th intercostal space just anterior to the mid-axillary line.",
    "Follow with a chest drain.",
  ],
  references: [
    "American College of Surgeons. Advanced Trauma Life Support (ATLS) Student Course Manual, 11th edition. 2025",
    "Laan DV et al. Chest wall thickness and decompression failure: needle site in tension pneumothorax. Injury. 2016",
    "MacDuff A et al. Management of spontaneous pneumothorax: BTS pleural disease guideline. Thorax. 2010",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Breathlessness, chest pain, agitation; in ventilated patients rising airway pressures and falling SpO2." },
        { text: "Hypoxia, tachycardia, hypotension, absent breath sounds, hyper-resonance; tracheal deviation and distended neck veins are late and unreliable." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "A one-way valve lets air in but not out; rising pleural pressure collapses the lung and shifts the mediastinum, reducing venous return — obstructive shock." },
        { text: "Positive-pressure ventilation makes it develop much faster." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Clinical diagnosis", text: "Do not wait for an X-ray in a shocked patient.", critical: true },
        { label: "Ultrasound", text: "Absent lung sliding with no lung point helps if it does not delay decompression." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Massive haemothorax", text: "Dull to percussion", link: "chest-trauma-adult" },
        { label: "Cardiac tamponade", text: "Breath sounds present, effusion on echo", link: "cardiac-tamponade-adult" },
        { label: "Right main bronchus intubation", text: "Check tube depth" },
        { label: "Massive PE", text: "Dilated RV", link: "pulmonary-embolism-adult" },
        { label: "Acute severe asthma", text: "Bilateral wheeze, gas trapping", link: "dyspnea-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "After decompression", text: "Chest X-ray to confirm lung re-expansion and drain position." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Finger thoracostomy", text: "Preferred in ventilated patients: incise and bluntly dissect into the pleura at the 4th–5th intercostal space, anterior to the mid-axillary line.", critical: true },
        { label: "Needle decompression", text: "8 cm (or longer) cannula at the same site; the 2nd intercostal space mid-clavicular line is an alternative but fails more often in adults.", critical: true },
        { label: "Chest drain", text: "Always after decompression.", link: "chest-drain-procedure" },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Admit", text: "All patients with a chest drain; ICU if ventilated or shocked." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "A short needle failing to reach the pleura." },
        { text: "Treating a right main bronchus intubation as a pneumothorax — check the tube first." },
        { text: "Leaving a needle in without following with a drain." },
      ],
    },
  ],
};