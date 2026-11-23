import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Spinal injury (adult). v0.1, 23 Nov 2026.
// ATLS 11th edition: selective, criteria-based spinal motion restriction; rigid collars de-emphasised.
// AO Spine / Praxis 2024 acute SCI guideline: MAP lower limit 75–80, upper 90–95 mmHg for 3–7 days.
export const SPINAL_INJURY_ADULT: ProtocolTopic = {
  id: "spinal-injury-adult",
  title: "Spinal injury (adult)",
  summary:
    "Injury to the spine or spinal cord. Protect the spine only when criteria suggest injury, clear it with a validated rule, and protect a damaged cord from hypotension and hypoxia.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "trauma-primary-survey-adult",
  source: "ErMate Handbook — trauma pathway v0.1 (ATLS 11th edition)",
  keywords: ["spinal injury", "spine injury", "neck injury", "c-spine", "cervical spine", "spinal cord injury", "sci", "neurogenic shock", "collar", "nexus", "canadian c-spine", "paraplegia", "quadriplegia"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Manual in-line stabilisation during airway management if spinal injury is suspected.",
    "Spinal motion restriction only when criteria suggest injury — not routinely, and not for isolated penetrating trauma.",
    "Check limb power, sensation level and anal tone; record the neurological level.",
    "Hypotension with bradycardia and warm peripheries: neurogenic shock — exclude bleeding first.",
    "Keep MAP at least 75–80 mmHg (up to 90–95) in acute cord injury.",
  ],
  references: [
    "American College of Surgeons. Advanced Trauma Life Support (ATLS) Student Course Manual, 11th edition. 2025",
    "Stiell IG et al. The Canadian C-Spine Rule for radiography in alert and stable trauma patients. JAMA. 2001",
    "Hoffman JR et al. Validity of a set of clinical criteria to rule out injury to the cervical spine (NEXUS). N Engl J Med. 2000",
    "Kwon BK et al. AO Spine / Praxis clinical practice guideline on haemodynamic management in acute spinal cord injury. Global Spine J. 2024",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Neck or back pain, midline tenderness, step deformity." },
        { text: "Weakness, numbness, paraesthesia, priapism, loss of anal tone, urinary retention." },
        { text: "Neurogenic shock: hypotension, bradycardia, warm dry skin below the level (injury above T6)." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Primary injury from the impact; secondary cord injury from hypotension, hypoxia, oedema and ongoing movement of an unstable spine." },
        { text: "Loss of sympathetic tone (above T6) causes vasodilation and unopposed vagal bradycardia — neurogenic shock." },
        { text: "Spinal shock is a temporary loss of all reflexes below the injury; the final deficit cannot be judged in the ED." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Clearance (alert, stable)", text: "Use NEXUS or the Canadian C-Spine Rule; if low risk, clear clinically without imaging." },
        { label: "Imaging needed", text: "CT is the first test for the spine; MRI for neurological deficit or suspected ligament injury." },
        { label: "Obtunded patient", text: "A normal high-quality CT cervical spine is enough to remove the collar in most units — follow local policy." },
        { label: "Shock", text: "Assume haemorrhage until proven otherwise.", link: "haemorrhagic-shock-adult", critical: true },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Haemorrhagic shock", text: "Cold, tachycardic", link: "haemorrhagic-shock-adult" },
        { label: "Traumatic brain injury", text: "Low GCS, unequal pupils", link: "tbi-adult" },
        { label: "Central cord syndrome", text: "Elderly, hyperextension, arms weaker than legs" },
        { label: "Cauda equina", text: "Saddle anaesthesia, retention" },
        { label: "SCIWORA", text: "Deficit with a normal CT — MRI" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "CT", text: "CT cervical spine (and thoracolumbar spine from the trauma CT) when clinical rules do not clear it." },
        { label: "MRI", text: "Neurological deficit, suspected ligament injury, or deficit with normal CT." },
        { label: "Bloods", text: "VBG with lactate, CBC, crossmatch if shocked." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Blood pressure in cord injury", text: "MAP lower limit 75–80 mmHg, upper limit 90–95 mmHg, for 3–7 days: fluids, then noradrenaline (or a pressor with chronotropic effect for bradycardia).", critical: true },
        { label: "Bradycardia", text: "Atropine for symptomatic bradycardia; pacing if refractory.", link: "bradycardia-adult" },
        { label: "Respiratory", text: "Injuries at C5 and above risk respiratory failure — monitor vital capacity, intubate early." },
        { label: "Avoid", text: "High-dose methylprednisolone is not recommended routinely." },
        { label: "Care", text: "Log-roll, pressure-area care, urinary catheter, temperature control." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Spinal surgery / ICU", text: "Cord injury or unstable fracture — early transfer to a spinal unit." },
        { label: "Discharge", text: "Cleared by a clinical rule or a normal CT with no deficit, good analgesia." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Attributing hypotension to neurogenic shock and missing bleeding." },
        { text: "Leaving a hard collar on for hours — pressure sores and raised ICP." },
        { text: "Missing a second, non-contiguous spinal fracture." },
      ],
    },
  ],
};