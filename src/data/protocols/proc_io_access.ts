import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: intraosseous access (adult). v0.1, 23 Nov 2026. 2025 AHA (IV first, IO second in arrest).
export const IO_ACCESS_PROCEDURE: ProtocolTopic = {
  id: "io-access-procedure",
  title: "Intraosseous (IO) access",
  summary: "Rapid vascular access into the marrow when IV access fails in an emergency. Any resuscitation drug or fluid can be given.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1",
  keywords: ["io", "intraosseous", "io access", "ez-io", "tibial io", "humeral io", "vascular access emergency"],
  notice: "Draft for clinical sign-off.",
  references: [
    "Part 9: Adult Advanced Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "Petitpas F et al. Use of intra-osseous access in adults: a systematic review. Crit Care. 2016",
    "Daya MR et al. Survival after IV vs IO amiodarone, lidocaine or placebo in out-of-hospital arrest. Circulation. 2020",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Cardiac arrest or shock when IV access fails or would delay treatment (in arrest, try IV first).", link: "cardiac-arrest-adult" },
        { label: "Contraindications", text: "Fracture of that bone, previous IO or orthopaedic hardware in that bone, infection or burn at the site." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Powered IO driver with needles (15 mm, 25 mm, 45 mm by tissue depth), extension set primed with saline, 10 mL flush, lidocaine 2% (preservative-free) for conscious patients, pressure bag." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { label: "Proximal tibia", text: "2 cm below the tibial tuberosity and 1–2 cm medial, on the flat surface." },
        { label: "Proximal humerus", text: "Greater tubercle with the arm adducted and hand on the abdomen — faster flow, closer to the heart; use the 45 mm needle." },
        { text: "Needle through skin to bone, check at least 5 mm of needle is visible, then drill until a loss of resistance." },
        { text: "Remove the stylet; confirm: needle stands unsupported, marrow aspirate, free flush." },
        { text: "Conscious patient: lidocaine 40 mg slowly through the IO before flushing." },
        { text: "Flush 10 mL saline briskly; run fluids under a pressure bag." },
      ],
    },
    {
      heading: "Confirmation",
      kind: "investigations",
      items: [
        { text: "Free flow without swelling of the limb; marrow aspirate can be sent for glucose, electrolytes and crossmatch (tell the lab)." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Extravasation and compartment syndrome — check the limb regularly." },
        { text: "Osteomyelitis with prolonged use; dislodgement." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Replace with IV or central access as soon as possible; remove within 24 hours; record site and time." },
      ],
    },
  ],
};