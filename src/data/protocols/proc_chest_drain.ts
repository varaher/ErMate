import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: chest drain / intercostal drain (adult). v0.1, 23 Nov 2026. BTS pleural guideline 2023; ATLS 11.
export const CHEST_DRAIN_PROCEDURE: ProtocolTopic = {
  id: "chest-drain-procedure",
  title: "Chest drain (intercostal drain)",
  summary: "Drain air, blood or fluid from the pleural space. Ultrasound for fluid, the safe triangle, blunt dissection over the rib, and never force a trocar.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1",
  keywords: ["chest drain", "icd", "intercostal drain", "chest tube", "thoracostomy", "seldinger", "safe triangle", "pneumothorax drain", "haemothorax"],
  notice: "Draft for clinical sign-off.",
  references: [
    "Roberts ME et al. British Thoracic Society Guideline for pleural disease. Thorax. 2023",
    "American College of Surgeons. ATLS Student Course Manual, 11th edition. 2025",
    "Bauman ZM et al. 14 Fr pigtail vs large-bore chest tube for traumatic haemothorax. J Trauma Acute Care Surg. 2021",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Tension pneumothorax after decompression, large or symptomatic pneumothorax, haemothorax, empyema, malignant effusion.", link: "tension-pneumothorax-adult" },
        { label: "Relative contraindications", text: "Coagulopathy (correct if time allows), adhesions, lung adherent to chest wall; never insert for a bulla mistaken for pneumothorax." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Ultrasound, sterile pack, lidocaine 1% (up to 3 mg/kg), scalpel, curved forceps, drain (small-bore Seldinger 12–14 Fr, or surgical tube), underwater seal, suture, dressing." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Position: arm behind head, patient at 45 degrees." },
        { text: "Site: safe triangle — anterior border of latissimus dorsi, lateral border of pectoralis major, line at the 5th intercostal space (nipple level), apex below the axilla." },
        { text: "Ultrasound mark for fluid; infiltrate local anaesthetic down to the pleura (aspirate air or fluid to confirm)." },
        { label: "Seldinger", text: "Needle over the top of the rib, guidewire, dilate only to the pleura depth, then drain." },
        { label: "Blunt dissection", text: "2–3 cm incision, blunt dissection over the top of the rib, finger sweep into the pleura, then insert the tube without a trocar.", critical: true },
        { text: "Connect to underwater seal; check swinging and bubbling; suture and dress." },
      ],
    },
    {
      heading: "Confirmation",
      kind: "investigations",
      items: [
        { text: "Swinging of the water column with breathing; chest X-ray for position and lung re-expansion." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Organ injury (lung, liver, spleen, heart) — never use a trocar; stay in the safe triangle." },
        { text: "Re-expansion pulmonary oedema — drain fluid no faster than 1.5 L at once, then pause." },
        { text: "Intercostal vessel bleeding — always go over the top of the rib." },
        { text: "Never clamp a bubbling drain." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Record output hourly for haemothorax (thoracotomy if over 1500 mL immediately or 200 mL/hour for 2–4 hours); analgesia; prophylactic antibiotic in trauma.", link: "chest-trauma-adult" },
      ],
    },
  ],
};