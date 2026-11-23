import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: lumbar puncture (adult). v0.1, 23 Nov 2026.
export const LP_PROCEDURE: ProtocolTopic = {
  id: "lp-procedure",
  title: "Lumbar puncture",
  summary: "CSF sampling for meningitis, encephalitis, SAH after 6 hours and other conditions. Never delay antibiotics for it; CT first only when criteria are met.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1",
  keywords: ["lumbar puncture", "lp", "spinal tap", "csf", "opening pressure", "xanthochromia", "atraumatic needle"],
  notice: "Draft for clinical sign-off.",
  references: [
    "van de Beek D et al. ESCMID guideline: diagnosis and treatment of acute bacterial meningitis. Clin Microbiol Infect. 2016",
    "Nath S et al. Atraumatic versus conventional lumbar puncture needles: systematic review and meta-analysis. Lancet. 2018",
    "Engelborghs S et al. Consensus guidelines for lumbar puncture in patients with neurological diseases. Alzheimers Dement. 2017",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Suspected meningitis or encephalitis, SAH with negative CT after 6 hours, idiopathic intracranial hypertension, Guillain–Barré.", link: "meningitis-adult" },
        { label: "CT first if", text: "Focal deficit, new seizure, GCS below 10, papilloedema, severe immunocompromise — give antibiotics before CT." },
        { label: "Hold if", text: "Platelets below 40–50 × 10⁹/L, INR above 1.5, therapeutic anticoagulation, skin infection at the site, signs of herniation." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Sterile pack, chlorhexidine, lidocaine, atraumatic (pencil-point) spinal needle 22 G with introducer, manometer, 4 numbered sterile tubes, paired blood glucose tube." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Lateral decubitus, knees to chest, back at the edge of the bed (needed for opening pressure); sitting if difficult." },
        { text: "L3–4 or L4–5 interspace (line between iliac crests crosses L4)." },
        { text: "Infiltrate local anaesthetic; introducer, then needle angled towards the umbilicus, bevel parallel to the long axis." },
        { text: "Feel the 'give' of the dura; remove the stylet; measure opening pressure with legs extended." },
        { text: "Collect 4 tubes (about 1–2 mL each, more for TB / cytology); replace the stylet before removing the needle." },
      ],
    },
    {
      heading: "Tests",
      kind: "investigations",
      items: [
        { text: "Tube 1: microbiology (Gram stain, culture, PCR). Tube 2: protein, glucose (with blood glucose). Tubes 1 and 4: cell counts. Extra: xanthochromia (protect from light), ADA / GeneXpert, cryptococcal antigen as indicated." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Post-LP headache — less with an atraumatic needle; bed rest does not prevent it." },
        { text: "Herniation in raised ICP with mass effect — follow the CT criteria." },
        { text: "Spinal haematoma with coagulopathy; traumatic tap confusing interpretation." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Simple analgesia; return if severe headache, fever, back pain or leg weakness." },
      ],
    },
  ],
};