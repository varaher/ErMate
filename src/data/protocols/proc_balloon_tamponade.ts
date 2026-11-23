import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: balloon tamponade for variceal bleeding. v0.1, 23 Nov 2026.
// Baveno VIII (2026): a covered oesophageal stent is preferred where available; balloon tamponade remains the bridge otherwise.
export const BALLOON_TAMPONADE_PROCEDURE: ProtocolTopic = {
  id: "balloon-tamponade-procedure",
  title: "Balloon tamponade (Sengstaken–Blakemore / Minnesota)",
  summary: "Temporary control of massive variceal bleeding when drugs and endoscopy fail, as a bridge (maximum 24 hours) to definitive therapy. Intubate first.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1 (Baveno VIII)",
  keywords: ["sengstaken", "minnesota tube", "balloon tamponade", "sb tube", "variceal bleeding uncontrolled"],
  notice: "Draft for clinical sign-off.",
  references: [
    "Baveno VIII Faculty. Baveno VIII – Advancing consensus in portal hypertension. J Hepatol. 2026",
    "Escorsell À et al. Oesophageal balloon tamponade vs oesophageal stent in refractory variceal bleeding. Hepatology. 2016",
    "Powell M, Journey JD. Sengstaken–Blakemore tube. StatPearls. 2023 (verification)",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indication", text: "Massive variceal bleeding not controlled by vasoactive drugs and endoscopy, as a bridge to TIPS or repeat endoscopy.", link: "variceal-bleed-adult" },
        { label: "Preferred alternative", text: "Covered self-expanding oesophageal metal stent where available (Baveno VIII)." },
        { label: "Contraindications", text: "Recent oesophageal surgery or stricture; known oesophageal rupture." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Sengstaken–Blakemore or Minnesota tube (checked for leaks), lubricant, 50 mL syringes, manometer, clamps, traction weight (0.5–1 kg, for example a 500 mL fluid bag), scissors at the bedside." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Intubate first to protect the airway.", critical: true, link: "rsi-procedure" },
        { text: "Insert the lubricated tube orally to at least 50 cm; confirm gastric position (aspirate, air insufflation, or X-ray before full inflation)." },
        { text: "Inflate the gastric balloon with 250–300 mL air (per the device), clamp, then pull back gently until resistance at the gastro-oesophageal junction." },
        { text: "Apply traction (0.5–1 kg) over a pulley or secure at the mouth with padding." },
        { text: "Inflate the oesophageal balloon (to 25–45 mmHg) only if bleeding continues." },
        { text: "Aspirate the gastric and oesophageal ports regularly." },
      ],
    },
    {
      heading: "Confirmation",
      kind: "investigations",
      items: [
        { text: "Chest / abdominal X-ray: gastric balloon below the diaphragm; bleeding stops on aspiration." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Oesophageal rupture (gastric balloon inflated in the oesophagus), airway obstruction from balloon migration — cut all lumens with the scissors at once.", critical: true },
        { text: "Aspiration, pressure necrosis; rebleeding when deflated in up to half." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "ICU; maximum 24 hours; deflate the oesophageal balloon periodically per local policy; arrange TIPS or repeat endoscopy." },
      ],
    },
  ],
};