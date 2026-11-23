import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: transcutaneous pacing (adult). v0.1, 23 Nov 2026. 2025 AHA Adult ALS.
export const PACING_PROCEDURE: ProtocolTopic = {
  id: "pacing-procedure",
  title: "Transcutaneous pacing",
  summary: "Temporary external pacing for unstable bradycardia that does not respond to drugs, as a bridge to transvenous pacing. Confirm mechanical capture with a pulse.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1 (2025 AHA)",
  keywords: ["pacing", "transcutaneous pacing", "external pacing", "tcp", "transvenous pacing", "heart block pacing", "capture"],
  notice: "Draft for clinical sign-off.",
  references: [
    "Part 9: Adult Advanced Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025",
    "Kusumoto FM et al. 2018 ACC/AHA/HRS Guideline on bradycardia and conduction delay. Circulation. 2019",
    "Doukky R et al. Temporary transcutaneous and transvenous cardiac pacing. Cardiol Rev. 2003 (verification)",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Symptomatic bradycardia with poor perfusion not responding to atropine; Mobitz II or complete heart block with instability.", link: "bradycardia-adult" },
        { label: "Not for", text: "Asystole (no benefit); severe hypothermia bradycardia (warm first)." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Defibrillator with pacing function, pacing pads, ECG leads connected to the device (needed for demand mode), sedation and analgesia." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Pads anterior–posterior (anterior left of sternum, posterior between the scapulae); attach ECG leads." },
        { text: "Select demand mode; rate 60–80 per minute." },
        { text: "Increase current from minimum until electrical capture (wide QRS after each spike) — usually 50–100 mA; set 5–10 mA above threshold." },
        { text: "Confirm mechanical capture: a femoral pulse at the paced rate and improved BP (the carotid is confused by muscle twitching).", critical: true },
        { text: "Give analgesia and sedation (for example fentanyl, small midazolam doses or ketamine)." },
      ],
    },
    {
      heading: "Confirmation",
      kind: "investigations",
      items: [
        { text: "Palpable femoral pulse at the set rate, improving perfusion; bedside echo can confirm ventricular contraction." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Pain and muscle contraction; skin burns with prolonged pacing." },
        { text: "Failure to capture (obesity, pad position, effusion) mistaken for capture on the monitor." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Bridge only: arrange transvenous pacing (right internal jugular preferred) and treat the cause (hyperkalaemia, drugs, ischaemia)." },
      ],
    },
  ],
};