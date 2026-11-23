import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Chest trauma (adult). v0.1, 23 Nov 2026. ATLS 11th edition.
export const CHEST_TRAUMA_ADULT: ProtocolTopic = {
  id: "chest-trauma-adult",
  title: "Chest trauma (adult)",
  summary:
    "Blunt or penetrating chest injury. Find and fix the immediate killers in the primary survey — tension pneumothorax, open pneumothorax, massive haemothorax, flail chest and tamponade.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "trauma-primary-survey-adult",
  source: "ErMate Handbook — trauma pathway v0.1 (ATLS 11th edition)",
  keywords: ["chest trauma", "chest injury", "rib fracture", "haemothorax", "hemothorax", "pneumothorax", "flail chest", "tamponade", "stab chest", "icd", "chest tube", "pulmonary contusion"],
  notice: "Draft for clinical sign-off.",
  firstTen: [
    "Oxygen; look, feel, listen; bedside ultrasound for pneumothorax, haemothorax and pericardial fluid.",
    "Tension pneumothorax: decompress immediately — finger or needle thoracostomy, then a chest drain.",
    "Open (sucking) chest wound: three-sided or vented occlusive dressing, then a chest drain away from the wound.",
    "Massive haemothorax: chest drain, blood products, call the surgeon.",
    "Penetrating wound with shock and pericardial fluid: tamponade — emergency surgery.",
  ],
  references: [
    "American College of Surgeons. Advanced Trauma Life Support (ATLS) Student Course Manual, 11th edition. 2025",
    "Bauman ZM et al. Chest tube size for traumatic haemothorax: 14 Fr pigtail vs large-bore tube. J Trauma Acute Care Surg. 2021",
    "Pieracci FM et al. Rib fracture management: Chest Wall Injury Society consensus. J Trauma Acute Care Surg. 2023",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Chest pain, breathlessness, haemoptysis; tachypnoea, hypoxia." },
        { text: "Reduced breath sounds, hyper-resonance or dullness, surgical emphysema, paradoxical movement, distended neck veins, muffled heart sounds." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { label: "Tension pneumothorax", text: "One-way valve air leak shifts the mediastinum and kinks the great veins — obstructive shock.", link: "tension-pneumothorax-adult" },
        { label: "Massive haemothorax", text: "Over 1500 mL of blood in the chest — shock and lung compression." },
        { label: "Flail chest", text: "Two or more ribs broken in two or more places; the real problem is the lung contusion underneath." },
        { label: "Tamponade", text: "Blood in the pericardium limits filling — hypotension, distended neck veins, muffled sounds." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Primary survey killers", text: "Treat on clinical grounds — do not wait for an X-ray in tension pneumothorax.", critical: true },
        { label: "Secondary survey injuries", text: "Pulmonary contusion, simple pneumothorax or haemothorax, rib and sternal fractures, blunt cardiac injury, aortic injury, diaphragm and oesophageal injury." },
        { label: "High-risk rib fractures", text: "Age 65 or over, 3 or more fractures, lung disease, anticoagulated — admit, multimodal analgesia." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Tension pneumothorax", text: "Absent breath sounds, shock", link: "tension-pneumothorax-adult" },
        { label: "Cardiac tamponade", text: "Penetrating precordial wound", link: "cardiac-tamponade-adult" },
        { label: "Blunt aortic injury", text: "Deceleration, wide mediastinum" },
        { label: "Blunt cardiac injury", text: "Arrhythmia, troponin rise" },
        { label: "Diaphragmatic rupture", text: "Bowel in the chest, left side" },
        { label: "Haemorrhagic shock elsewhere", text: "Abdomen, pelvis", link: "haemorrhagic-shock-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bedside", text: "eFAST (pleural sliding, haemothorax, pericardial fluid); chest X-ray." },
        { label: "ECG and troponin", text: "For suspected blunt cardiac injury." },
        { label: "CT chest with contrast", text: "Stable patients with a significant mechanism — aortic injury, contusion, occult pneumothorax." },
        { label: "Bloods", text: "Crossmatch, CBC, VBG with lactate." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Chest drain", text: "Pneumothorax: small-bore (about 14 Fr) is usually enough. Haemothorax: 14 Fr pigtail works for most; a larger tube if clotted or massive.", link: "chest-drain-procedure" },
        { label: "Thoracotomy criteria", text: "More than 1500 mL immediately from the drain, or more than 200 mL per hour for 2–4 hours, or ongoing transfusion need.", critical: true },
        { label: "Analgesia for rib fractures", text: "Regular paracetamol, opioid as needed, and regional block (serratus anterior or erector spinae) for multiple fractures." },
        { label: "Tamponade", text: "Emergency thoracotomy or sternotomy by the surgeon; pericardiocentesis only as a bridge where no surgeon is available.", critical: true },
        { label: "Antibiotic", text: "A single prophylactic dose (for example cefazolin) when a chest drain is placed for trauma." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Finger thoracostomy", text: "4th–5th intercostal space, just anterior to the mid-axillary line.", link: "tension-pneumothorax-adult" },
        { label: "Chest drain", text: "Safe triangle; blunt dissection over the rib.", link: "chest-drain-procedure" },
        { label: "Resuscitative thoracotomy", text: "Penetrating chest trauma with recent loss of signs of life, by a trained operator only." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Theatre", text: "Massive haemothorax, ongoing bleeding, tamponade, aortic injury." },
        { label: "ICU / HDU", text: "Flail chest, contusion with hypoxia, elderly with multiple fractures." },
        { label: "Discharge", text: "Isolated 1–2 rib fractures in a young patient with good analgesia and normal oxygenation." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for an X-ray to treat tension pneumothorax." },
        { text: "Under-treating pain in rib fractures — leads to pneumonia." },
        { text: "Missing a tamponade in a shocked patient with a precordial stab wound." },
      ],
    },
  ],
};