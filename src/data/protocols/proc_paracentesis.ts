import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Procedure: paracentesis (diagnostic and large-volume). v0.1, 23 Nov 2026. AASLD 2021.
export const PARACENTESIS_PROCEDURE: ProtocolTopic = {
  id: "paracentesis-procedure",
  title: "Paracentesis (ascitic tap)",
  summary: "Diagnostic tap for every admitted patient with ascites; large-volume tap for tense ascites. Safe even with a raised INR or low platelets.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — procedures v0.1 (AASLD 2021)",
  keywords: ["paracentesis", "ascitic tap", "ascites tap", "lvp", "large volume paracentesis", "diagnostic tap", "albumin after tap"],
  notice: "Draft for clinical sign-off.",
  references: [
    "Biggins SW et al. AASLD Practice Guidance: ascites, SBP and hepatorenal syndrome. Hepatology. 2021",
    "EASL Clinical Practice Guidelines for the management of patients with decompensated cirrhosis. J Hepatol. 2018",
    "Thomsen TW et al. Paracentesis (videos in clinical medicine). N Engl J Med. 2006",
  ],
  sections: [
    {
      heading: "Indications and contraindications",
      kind: "assessment",
      items: [
        { label: "Diagnostic", text: "New ascites; any patient with ascites admitted or deteriorating (exclude SBP).", link: "sbp-adult" },
        { label: "Therapeutic", text: "Tense ascites causing breathlessness or discomfort." },
        { label: "Contraindications", text: "DIC or clinically obvious fibrinolysis; acute abdomen needing surgery. INR and platelets alone are not contraindications — no routine FFP or platelets." },
      ],
    },
    {
      heading: "Equipment",
      items: [
        { text: "Ultrasound, sterile pack, lidocaine 1%, 18–22 G needle or paracentesis catheter, syringes, blood-culture bottles, EDTA and plain tubes, drainage bag for large volume." },
      ],
    },
    {
      heading: "Steps",
      kind: "approach",
      items: [
        { text: "Empty the bladder; supine with slight tilt to the side." },
        { text: "Site: left lower quadrant, 2 fingerbreadths medial and cephalad to the anterior superior iliac spine (lateral to rectus — avoid the inferior epigastric artery); confirm a fluid pocket on ultrasound." },
        { text: "Infiltrate local anaesthetic; insert with a Z-track technique, aspirating as you advance." },
        { text: "Diagnostic: 30–60 mL — cell count with PMN, albumin, protein, Gram stain, and 10 mL into each blood-culture bottle at the bedside." },
        { text: "Large volume: connect to drainage, remove up to the planned volume." },
      ],
    },
    {
      heading: "Interpretation",
      kind: "investigations",
      items: [
        { text: "PMN 250 per mm³ or more = SBP. SAAG 1.1 g/dL or more = portal hypertension." },
      ],
    },
    {
      heading: "Complications",
      kind: "pitfalls",
      items: [
        { text: "Persistent leak (use Z-track), abdominal wall haematoma, bowel perforation (rare)." },
        { text: "Post-paracentesis circulatory dysfunction and AKI after large volumes without albumin.", critical: true },
      ],
    },
    {
      heading: "Aftercare",
      kind: "disposition",
      items: [
        { label: "Albumin", text: "6–8 g of albumin per litre removed when more than 5 litres is drained.", critical: true },
        { text: "Observe the site and BP; check renal function after large-volume paracentesis." },
      ],
    },
  ],
};