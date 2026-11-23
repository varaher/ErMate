import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: synchronised cardioversion (adult). v0.1, 23 Nov 2026. 2025 AHA Adult ALS.
export const CARDIOVERSION_PROCEDURE: ProtocolTopic = {
  id: "cardioversion-procedure",
  title: "Synchronised cardioversion",
  summary: "A shock timed to the QRS to restore rhythm in unstable tachyarrhythmia with a pulse, or electively in stable AF / flutter.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1 (2025 AHA)",
  keywords: ["cardioversion", "dc cardioversion", "synchronised shock", "synchronized cardioversion", "af cardioversion", "svt cardioversion", "vt with pulse"],
  notice: "Draft for clinical sign-off.",
  references: [
    "Part 9: Adult Advanced Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "Joglar JA et al. 2023 ACC/AHA/ACCP/HRS Guideline for atrial fibrillation. Circulation. 2024",
    "Schmidt AS et al. Anterior–lateral vs anterior–posterior electrode position for cardioversion of AF (EPIC). Lancet. 2022",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Tachycardia with a pulse and instability (hypotension, shock, altered mental state, ischaemic chest pain, acute heart failure); selected stable AF / flutter / VT.", link: "tachycardia-adult" },
        { label: "Not for", text: "Sinus tachycardia, multifocal atrial tachycardia, digoxin toxicity; pulseless VT / VF need unsynchronised defibrillation." },
        { label: "Anticoagulation", text: "AF or flutter for 48 hours or more (or unknown) in a stable patient: anticoagulate 3 weeks or exclude atrial thrombus first." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Defibrillator with sync function, pads, monitoring, oxygen, suction, airway kit, sedation drugs, IV access." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Pads anterior–posterior (or anterior–lateral); continuous ECG through the pads." },
        { text: "Procedural sedation (for example ketamine 0.5–1 mg/kg or propofol in small titrated doses; midazolam with fentanyl), unless peri-arrest." },
        { text: "Press SYNC — check markers on each QRS.", critical: true },
        { text: "Energy (biphasic): narrow regular 50–100 J; AF 200 J or more; flutter 200 J; monomorphic VT 100 J; escalate if unsuccessful." },
        { text: "'Stand clear', check oxygen away, hold the shock button until it discharges." },
        { text: "Re-select SYNC before each repeat shock (most devices default back to unsynchronised)." },
      ],
    },
    {
      heading: "Confirmation",
      kind: "investigations",
      items: [
        { text: "12-lead ECG after conversion; monitor for at least 1–2 hours after sedation." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Unsynchronised shock on the T wave causing VF — defibrillate immediately." },
        { text: "Thromboembolism after AF cardioversion without anticoagulation." },
        { text: "Over-sedation and airway problems; skin burns." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Anticoagulation for at least 4 weeks after AF / flutter cardioversion, and long term by stroke risk; treat the trigger." },
      ],
    },
  ],
};