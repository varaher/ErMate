import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: rapid sequence intubation (adult). v0.2, 24 Nov 2026 — organised by the 7 Ps
// (Neeraj). DAS 2015 unanticipated difficult airway; DEVICE (NEJM 2023) video laryngoscopy; ATLS 11
// (VL preferred, resuscitate before induction).
export const RSI_PROCEDURE: ProtocolTopic = {
  id: "rsi-procedure",
  title: "Rapid sequence intubation (RSI) — the 7 Ps",
  summary: "Emergency intubation with induction and paralysis, run by the 7 Ps: Preparation, Preoxygenation, Pretreatment / optimisation, Paralysis with induction, Positioning, Placement with proof, Post-intubation management.",
  population: "adult",
  status: "draft",
  version: "0.2",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.2",
  keywords: ["rsi", "7 ps", "seven ps", "intubation", "rapid sequence", "airway", "ett", "laryngoscopy", "video laryngoscope", "ketamine", "rocuronium", "succinylcholine", "failed airway", "cricothyroidotomy", "preoxygenation"],
  notice: "Draft for clinical sign-off. Follow your department's airway checklist.",
  references: [
    "Frerk C et al. Difficult Airway Society 2015 guidelines for unanticipated difficult intubation in adults. Br J Anaesth. 2015",
    "Prekker ME et al. Video versus direct laryngoscopy for tracheal intubation of critically ill adults (DEVICE). N Engl J Med. 2023",
    "American College of Surgeons. ATLS Student Course Manual, 11th edition. 2025",
    "Walls RM, Murphy MF. Manual of Emergency Airway Management — the 7 Ps of RSI (verification)",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Failure to protect the airway (GCS 8 or less, burns, expanding haematoma), failure to oxygenate or ventilate, expected course (combative trauma for CT, transfer).", link: "trauma-primary-survey-adult" },
        { label: "Caution", text: "Predicted difficult airway (LEMON) — consider awake techniques or the most experienced operator. Shock or RV failure — resuscitate first." },
      ],
    },
    {
      heading: "The 7 Ps of RSI",
      kind: "approach",
      note: "Timings are a guide from the moment of induction (zero).",
      items: [
        { label: "1. Preparation (−10 min)", text: "Assess difficulty (LEMON, MOANS for bag-mask). Allocate team roles and verbalise the plan: A video laryngoscopy + bougie, B supraglottic airway, C face-mask ventilation, D front-of-neck access. Check suction, video and direct laryngoscopes, bougie, two tube sizes, SGA, waveform capnography, scalpel–bougie–tube kit; draw up and label drugs; two working IV lines.", critical: true },
        { label: "2. Preoxygenation (−5 min)", text: "Head up 20–30 degrees. Non-rebreather at flush rate or BVM with PEEP for 3 minutes (or 8 vital-capacity breaths); NIV if SpO2 stays below 93%. Nasal cannula at 15 L/min left on for apnoeic oxygenation." },
        { label: "3. Pretreatment / physiological optimisation (−3 min)", text: "Resuscitate before you intubate: shock index above 0.9 or SBP below 100 — fluid or blood and a vasopressor running or drawn up (push-dose adrenaline or noradrenaline). Correct severe acidosis plan (match ventilation afterwards). Fentanyl only in selected cases (raised ICP, aortic dissection) and never in shock.", critical: true },
        { label: "4. Paralysis with induction (0)", text: "Give the induction agent then the paralytic as rapid IV pushes (drugs below); wait 45–60 seconds for full relaxation. Do not bag unless SpO2 falls (then gentle BVM with PEEP)." },
        { label: "5. Positioning (+30 s)", text: "Ear-to-sternal-notch, face parallel to the ceiling; ramp in obesity. Cricoid pressure is optional and should be released if it hinders the view or ventilation." },
        { label: "6. Placement with proof (+45 s)", text: "Video laryngoscopy first-pass with a bougie; maximum 3 attempts (plus one by the most experienced). Confirm with sustained waveform ETCO2 — 'no trace = wrong place' — then bilateral air entry and chest X-ray.", critical: true },
        { label: "7. Post-intubation management (+2 min)", text: "Secure the tube; start sedation and analgesia at once (especially after rocuronium); lung-protective ventilation (6–8 mL/kg ideal body weight, PEEP 5); OG tube; ABG at 30 minutes; treat post-intubation hypotension." },
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
        { label: "Post-intubation", text: "For example fentanyl infusion with propofol or midazolam (reduced doses in shock); ketamine infusion as an alternative." },
      ],
    },
    {
      heading: "Failed airway",
      kind: "pitfalls",
      items: [
        { label: "Cannot intubate", text: "Oxygenate with SGA or BVM; wake up or call for help if possible.", critical: true },
        { label: "Cannot intubate, cannot oxygenate", text: "Declare it. Scalpel–bougie–tube cricothyroidotomy now.", critical: true },
        { text: "Peri-intubation arrest from hypotension and hypoxia — prevented by steps 2 and 3." },
        { text: "Oesophageal intubation missed without waveform capnography." },
        { text: "Paralysed patient with no sedation after rocuronium (awareness)." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Tube position on X-ray, cuff pressure, ventilator settings documented, ABG at 30 minutes; ICU." },
      ],
    },
  ],
};