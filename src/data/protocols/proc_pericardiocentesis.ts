import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: pericardiocentesis (adult). v0.1, 23 Nov 2026. ESC 2015 pericardial disease guideline.
export const PERICARDIOCENTESIS_PROCEDURE: ProtocolTopic = {
  id: "pericardiocentesis-procedure",
  title: "Pericardiocentesis",
  summary: "Needle drainage of pericardial fluid causing tamponade. Ultrasound-guided whenever possible; in trauma, surgery is definitive.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1",
  keywords: ["pericardiocentesis", "pericardial tap", "tamponade", "pericardial effusion", "echo guided"],
  notice: "Draft for clinical sign-off.",
  references: [
    "Adler Y et al. 2015 ESC Guidelines for the diagnosis and management of pericardial diseases. Eur Heart J. 2015",
    "Tsang TS et al. Echocardiographically guided pericardiocentesis: Mayo Clinic experience. Mayo Clin Proc. 2002",
    "American College of Surgeons. ATLS Student Course Manual, 11th edition. 2025",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Indications", text: "Cardiac tamponade with haemodynamic compromise; PEA arrest with a large effusion.", link: "cardiac-arrest-adult" },
        { label: "Trauma", text: "Traumatic tamponade needs surgery (thoracotomy / sternotomy); needle drainage only as a bridge where no surgeon is available.", link: "chest-trauma-adult" },
        { label: "Caution", text: "Aortic dissection with haemopericardium (surgery instead); coagulopathy." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Ultrasound, sterile pack, 16–18 G needle or pericardiocentesis kit with guidewire and pigtail catheter, 60 mL syringe, ECG monitoring, resuscitation drugs." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Patient at 30–45 degrees if possible; continuous ECG." },
        { text: "Ultrasound: choose the approach with the largest fluid pocket closest to the skin and no structures in the way — parasternal, apical or subxiphoid." },
        { text: "Subxiphoid (blind / arrest): left of the xiphoid, needle at 30–45 degrees aiming at the left shoulder." },
        { text: "Real-time ultrasound in-plane; aspirate as you advance; confirm position with agitated saline if unsure." },
        { text: "Pass a guidewire and pigtail catheter for continued drainage; removing even 50–100 mL can restore output." },
      ],
    },
    {
      heading: "Confirmation",
      kind: "investigations",
      items: [
        { text: "Haemodynamic improvement; ultrasound shows the effusion shrinking; send fluid for cell count, culture, cytology as relevant." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Ventricular puncture, coronary laceration, arrhythmia, pneumothorax, liver injury." },
        { text: "Blood that clots is likely intracardiac; pericardial blood usually does not clot." },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { text: "Leave the pigtail to drainage; repeat echo; cardiology or cardiothoracic surgery." },
      ],
    },
  ],
};