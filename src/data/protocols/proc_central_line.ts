import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: central venous catheter (adult). v0.1, 23 Nov 2026. ASA 2020 central venous access practice guideline.
export const CENTRAL_LINE_PROCEDURE: ProtocolTopic = {
  id: "central-line-procedure",
  title: "Central venous catheter",
  summary: "Ultrasound-guided central access for vasopressors, poor peripheral access or monitoring. Full sterile barrier, confirm the vein before dilating.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1",
  keywords: ["central line", "cvc", "central venous catheter", "internal jugular", "femoral line", "subclavian", "seldinger", "ultrasound guided"],
  notice: "Draft for clinical sign-off.",
  references: [
    "American Society of Anesthesiologists. Practice guidelines for central venous access 2020. Anesthesiology. 2020",
    "Frykholm P et al. Clinical guidelines on central venous catheterisation (Swedish Society of Anaesthesiology). Acta Anaesthesiol Scand. 2014",
    "Parienti JJ et al. Intravascular complications of central venous catheterization by insertion site (3SITES). N Engl J Med. 2015",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Vasopressors beyond the first hours, irritant drugs, no peripheral access, haemodialysis, transvenous pacing.", link: "sepsis-adult" },
        { label: "Site choice", text: "Internal jugular (ultrasound-friendly, compressible), subclavian (lowest infection, risk of pneumothorax), femoral (fast in arrest or coagulopathy; avoid if mobile)." },
        { label: "Contraindications", text: "Infection or thrombosis at the site; caution with coagulopathy (prefer compressible sites)." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Ultrasound with sterile cover, full barrier (cap, mask, gown, gloves, large drape), chlorhexidine–alcohol, CVC kit, lidocaine, saline flushes, suture, dressing." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Time-out; position (Trendelenburg for IJ / subclavian); full sterile barrier.", critical: true },
        { text: "Real-time ultrasound: identify vein vs artery (compressible, no pulsation); needle in-plane or out-of-plane." },
        { text: "Aspirate dark non-pulsatile blood; pass the guidewire; confirm the wire in the vein on ultrasound (long- and short-axis) before dilating.", critical: true },
        { text: "Small skin nick, dilate (not deeper than the vein), railroad the catheter, remove the wire — never let go of the wire." },
        { text: "Aspirate and flush all lumens; suture; sterile dressing." },
      ],
    },
    {
      heading: "Confirmation",
      kind: "investigations",
      items: [
        { text: "Chest X-ray for IJ / subclavian (tip at the cavo-atrial junction, no pneumothorax); ultrasound bubble test is an alternative." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Arterial puncture or cannulation — never dilate before confirming the vein; if an artery is dilated, leave the catheter in and call vascular." },
        { text: "Pneumothorax, lost guidewire, air embolism (Trendelenburg, closed hubs), arrhythmia from a deep wire." },
        { text: "Line infection and thrombosis — remove when no longer needed." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Document site, depth, ultrasound use and confirmation; daily review of need." },
      ],
    },
  ],
};