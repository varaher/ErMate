import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: rapid sequence intubation (adult). v0.1, 23 Nov 2026.
// DAS 2015 unanticipated difficult airway; DEVICE (NEJM 2023) video laryngoscopy; ATLS 11 (VL preferred, resuscitate before induction).
export const RSI_PROCEDURE: ProtocolTopic = {
  id: "rsi-procedure",
  title: "Rapid sequence intubation (RSI)",
  summary: "Emergency intubation with induction and paralysis. Resuscitate before you intubate, plan for failure, use video laryngoscopy and confirm with waveform capnography.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1",
  keywords: ["rsi", "intubation", "rapid sequence", "airway", "ett", "laryngoscopy", "video laryngoscope", "ketamine", "rocuronium", "succinylcholine", "failed airway", "cricothyroidotomy"],
  notice: "Draft for clinical sign-off. Follow your department's airway checklist.",
  references: [
    "Frerk C et al. Difficult Airway Society 2015 guidelines for unanticipated difficult intubation in adults. Br J Anaesth. 2015",
    "Prekker ME et al. Video versus direct laryngoscopy for tracheal intubation of critically ill adults (DEVICE). N Engl J Med. 2023",
    "American College of Surgeons. ATLS Student Course Manual, 11th edition. 2025",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Failure to protect the airway (GCS 8 or less, burns, expanding haematoma), failure to oxygenate or ventilate, expected course (combative trauma for CT, transfer).", link: "trauma-primary-survey-adult" },
        { label: "Caution", text: "Predicted difficult airway — consider awake techniques or the most experienced operator. Shock or RV failure — resuscitate first." },
      ],
    },
    {
      heading: "Preparation",
      kind: "first10",
      items: [
        { label: "Team and plan", text: "Allocate roles; verbalise Plan A (video laryngoscopy + bougie), B (supraglottic airway), C (face-mask ventilation), D (front-of-neck access).", critical: true },
        { label: "Pre-oxygenate", text: "Non-rebreather or BVM with PEEP for 3 minutes, or 8 vital-capacity breaths; nasal cannula at 15 L/min left on for apnoeic oxygenation; head up 20–30 degrees." },
        { label: "Resuscitate", text: "Shock index above 0.9 or SBP below 100: fluid / blood and a pressor running or drawn up before induction.", critical: true },
        { label: "Equipment", text: "Suction, video and direct laryngoscope, bougie, two tube sizes, SGA, ETCO2, scalpel–bougie–tube kit, drugs drawn and labelled." },
      ],
    },
    {
      heading: "Drugs",
      kind: "treatment",
      items: [
        { label: "Ketamine", text: "1–2 mg/kg IV (0.5–1 mg/kg in shock) — preferred in haemodynamic instability and bronchospasm." },
        { label: "Etomidate", text: "0.2–0.3 mg/kg IV where available." },
        { label: "Propofol", text: "1–2 mg/kg — avoid or reduce markedly in shock." },
        { label: "Rocuronium", text: "1.2 mg/kg IV (lasts 45–60 minutes; sugammadex reverses)." },
        { label: "Suxamethonium", text: "1.5 mg/kg IV — avoid in hyperkalaemia, burns or crush over 24 hours old, neuromuscular disease, organophosphate poisoning." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Position: ear-to-sternal notch, face parallel to ceiling (ramp in obesity)." },
        { text: "Give induction then paralytic as rapid IV pushes; wait 45–60 seconds for full relaxation." },
        { text: "Video laryngoscopy first-pass; use a bougie; maximum 3 attempts (plus one by the most experienced)." },
        { text: "Confirm with sustained waveform ETCO2 — 'no trace = wrong place'; then bilateral air entry and chest X-ray." },
        { text: "Post-intubation sedation and analgesia immediately (especially after rocuronium); lung-protective ventilation." },
      ],
    },
    {
      heading: "Failed airway",
      kind: "pitfalls",
      items: [
        { label: "Cannot intubate", text: "Oxygenate with SGA or BVM; wake up or call for help if possible.", critical: true },
        { label: "Cannot intubate, cannot oxygenate", text: "Declare it. Scalpel–bougie–tube cricothyroidotomy now.", critical: true },
        { text: "Peri-intubation arrest from hypotension and hypoxia — prevent it with resuscitation and pre-oxygenation." },
        { text: "Oesophageal intubation missed without capnography." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Tube position on X-ray, cuff pressure, OG tube, ventilator settings, ABG at 30 minutes; ICU." },
      ],
    },
  ],
};