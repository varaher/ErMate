import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Major trauma: primary survey (adult). v0.1, 23 Nov 2026.
// ATLS 11th edition (ACS, launched Sept 2025): xABCDE — exsanguinating haemorrhage control comes first;
// video laryngoscopy preferred; selective spinal motion restriction; early MTP with 1:1:1 or whole blood.
export const TRAUMA_PRIMARY_SURVEY_ADULT: ProtocolTopic = {
  id: "trauma-primary-survey-adult",
  title: "Major trauma — primary survey (xABCDE)",
  summary:
    "A structured first look at every seriously injured patient: stop catastrophic bleeding first, then airway, breathing, circulation, disability and exposure — treating each problem as you find it.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — trauma pathway v0.1 (ATLS 11th edition)",
  keywords: ["trauma", "polytrauma", "major trauma", "rta", "road traffic accident", "rta", "fall from height", "primary survey", "xabcde", "atls", "fast", "efast", "assault"],
  notice: "Draft for clinical sign-off. Follow your hospital's trauma team activation criteria.",
  firstTen: [
    "x — Stop catastrophic external bleeding now: direct pressure, wound packing, tourniquet for a limb.",
    "A — Airway with cervical spine protection where indicated; suction, adjuncts, early RSI with video laryngoscopy if the airway is at risk.",
    "B — Look, feel, listen; decompress a tension pneumothorax immediately; seal open chest wounds.",
    "C — Two large-bore lines, bloods with crossmatch, eFAST, pelvic binder; activate the massive transfusion protocol early; TXA within 3 hours.",
    "D, E — GCS, pupils, glucose; fully expose, log-roll, then prevent hypothermia.",
  ],
  references: [
    "American College of Surgeons. Advanced Trauma Life Support (ATLS) Student Course Manual, 11th edition. 2025",
    "Rossaint R et al. The European guideline on management of major bleeding and coagulopathy following trauma: sixth edition. Crit Care. 2023",
    "CRASH-2 collaborators. Effects of tranexamic acid on death in trauma patients with significant haemorrhage. Lancet. 2010",
  ],
  sections: [
    {
      heading: "What to look for",
      kind: "symptoms",
      items: [
        { text: "Mechanism: high-speed road traffic crash, ejection, pedestrian or two-wheeler hit, fall from more than 3 metres, penetrating injury to head, neck, chest or abdomen." },
        { text: "Physiology: GCS below 14, SBP below 90 (below 110 in the elderly), respiratory rate below 10 or above 29, shock index above 1." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Uncontrolled haemorrhage is the leading preventable cause of trauma death — hence x before A." },
        { text: "The lethal diamond: hypothermia, acidosis, coagulopathy and low ionised calcium drive each other. Crystalloid and cold fluids make all four worse.", link: "haemorrhagic-shock-adult" },
        { text: "Secondary brain injury from hypoxia and hypotension doubles TBI mortality.", link: "tbi-adult" },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "x — Exsanguination", text: "Tourniquet high and tight on a bleeding limb; pack junctional wounds; direct pressure.", critical: true },
        { label: "A — Airway", text: "Talking = patent for now. Jaw thrust, suction. Intubate for GCS 8 or less, airway burns, expanding neck haematoma, or failing oxygenation — resuscitate before induction.", link: "rsi-procedure" },
        { label: "B — Breathing", text: "Tension pneumothorax, open pneumothorax, massive haemothorax, flail chest.", link: "chest-trauma-adult" },
        { label: "C — Circulation", text: "Find the bleeding: chest, abdomen (eFAST), pelvis, long bones, floor (external).", link: "haemorrhagic-shock-adult" },
        { label: "D — Disability", text: "GCS, pupils, lateralising signs, glucose.", link: "tbi-adult" },
        { label: "E — Exposure", text: "Full exposure and log-roll; then warm blankets, warmed fluids, warm room." },
        { label: "Spine", text: "Spinal motion restriction is selective, based on clinical criteria; rigid collars are de-emphasised, and not used in isolated penetrating trauma.", link: "spinal-injury-adult" },
      ],
    },
    {
      heading: "Differential diagnosis (life threats to find)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Haemorrhagic shock", text: "Tachycardia, cold, positive FAST", link: "haemorrhagic-shock-adult" },
        { label: "Tension pneumothorax", text: "Hypoxia, hypotension, absent breath sounds", link: "tension-pneumothorax-adult" },
        { label: "Chest trauma", text: "Haemothorax, flail, tamponade", link: "chest-trauma-adult" },
        { label: "Traumatic brain injury", text: "Low GCS, unequal pupils", link: "tbi-adult" },
        { label: "Spinal cord injury", text: "Weakness, neurogenic shock", link: "spinal-injury-adult" },
        { label: "Burns", text: "Fire, inhalation injury", link: "burns-adult" },
        { label: "Pelvic fracture", text: "Unstable pelvis, shock", link: "pelvic-trauma-adult" },
        { label: "Medical cause of the crash", text: "Hypoglycaemia, seizure, arrhythmia, intoxication", link: "hypoglycaemia-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Crossmatch, CBC, VBG with lactate and base deficit, ionised calcium, coagulation (viscoelastic testing where available), renal function, glucose, beta-hCG, alcohol level when relevant." },
        { label: "Bedside", text: "eFAST (pericardium, abdomen, pleura); chest and pelvic X-ray in the resuscitation room." },
        { label: "CT", text: "Whole-body contrast CT for the stable or stabilised polytrauma patient; unstable patients go to theatre or angio, not CT." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Blood first", text: "Minimise crystalloid. Give blood products 1:1:1 (plasma : platelets : red cells) or low-titre O whole blood where available.", critical: true },
        { label: "Tranexamic acid", text: "1 g IV over 10 minutes then 1 g over 8 hours, only within 3 hours of injury.", critical: true },
        { label: "Permissive hypotension", text: "Until bleeding is controlled, accept a lower blood pressure (palpable radial pulse, SBP about 80–90) — but not in head injury.", link: "haemorrhagic-shock-adult" },
        { label: "Analgesia", text: "Titrated IV opioid or ketamine; do not withhold for assessment." },
        { label: "Anticoagulated patient", text: "Ask early; reverse with PCC / vitamin K (warfarin) or specific agents for direct oral anticoagulants when bleeding." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Tourniquet", text: "5–7 cm above the wound, tighten until bleeding stops, note the time." },
        { label: "Pelvic binder", text: "Centred over the greater trochanters, not the iliac crests." },
        { label: "Finger / needle thoracostomy", text: "4th–5th intercostal space, just anterior to the mid-axillary line.", link: "tension-pneumothorax-adult" },
        { label: "RSI", text: "Video laryngoscopy first; reduced induction dose; blood or pressor ready.", link: "rsi-procedure" },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Theatre / angio", text: "Unstable with a source: damage-control surgery or embolisation." },
        { label: "Transfer", text: "To a trauma centre once airway and bleeding are controlled — do not delay transfer for CT." },
        { label: "ICU", text: "Intubated, massive transfusion, severe TBI." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Intubating a shocked patient before restoring volume — peri-intubation arrest." },
        { text: "Litres of saline before blood." },
        { text: "Missing hypothermia — take the temperature and keep the patient warm." },
        { text: "Normal vital signs in the elderly or on beta-blockers hiding shock." },
      ],
    },
  ],
};