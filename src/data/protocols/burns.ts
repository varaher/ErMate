import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Major burns (adult). v0.1, 23 Nov 2026.
// ATLS 11th edition; ABA 2023 burn resuscitation guideline (start 2–4 mL/kg/%TBSA, titrate to urine output).
export const BURNS_ADULT: ProtocolTopic = {
  id: "burns-adult",
  title: "Burns (adult)",
  summary:
    "Thermal, electrical or chemical burns. Secure the airway early when there is inhalation injury, cool the burn, estimate the size accurately, and titrate fluids to urine output — not to a formula.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "trauma-primary-survey-adult",
  source: "ErMate Handbook — trauma pathway v0.1 (ATLS 11th edition)",
  keywords: ["burns", "burn", "scald", "fire", "flame burn", "inhalation injury", "parkland", "tbsa", "electrical burn", "chemical burn", "escharotomy", "carbon monoxide", "smoke"],
  notice: "Draft for clinical sign-off. Contact the burns unit early for referral criteria.",
  firstTen: [
    "Stop the burning: remove clothing and jewellery; cool the burn with cool running water for 20 minutes (within 3 hours of injury); keep the patient warm.",
    "Airway: look for inhalation injury (facial burns, singed nasal hair, soot, hoarse voice, stridor) — intubate early with an uncut tube.",
    "100% oxygen; check carboxyhaemoglobin.",
    "Two large-bore IV lines (through burnt skin if needed); estimate burn size with the rule of nines or the palm (1%).",
    "Over 20% TBSA: start Ringer's lactate and a urinary catheter; give IV opioid analgesia.",
  ],
  references: [
    "American College of Surgeons. Advanced Trauma Life Support (ATLS) Student Course Manual, 11th edition. 2025",
    "Cartotto R et al. American Burn Association Clinical Practice Guidelines on burn shock resuscitation. J Burn Care Res. 2023",
    "ISBI Practice Guidelines Committee. ISBI practice guidelines for burn care, part 2. Burns. 2018",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { label: "Superficial", text: "Red, painful, no blisters — not counted in TBSA." },
        { label: "Partial thickness", text: "Blisters, pink, moist, painful, blanches." },
        { label: "Full thickness", text: "White, leathery or charred, painless, does not blanch." },
        { label: "Inhalation injury", text: "Enclosed-space fire, facial burns, soot in mouth, hoarse voice, stridor, carbonaceous sputum.", critical: true },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Burns over about 20% TBSA cause a systemic capillary leak — burn shock — peaking in the first 24 hours." },
        { text: "Airway oedema worsens over hours; a patent airway now may close later." },
        { text: "Carbon monoxide and cyanide from smoke cause tissue hypoxia despite a normal SpO2." },
        { text: "Circumferential full-thickness burns act like a tourniquet on limbs or the chest." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Primary survey first", text: "Burn patients are trauma patients — look for other injuries (blast, fall, jump).", link: "trauma-primary-survey-adult" },
        { label: "Size", text: "Rule of nines (head 9, each arm 9, front 18, back 18, each leg 18, perineum 1) or palm-and-fingers = 1%. Do not count superficial burns." },
        { label: "Special burns", text: "Electrical (ECG, myoglobinuria, deep injury), chemical (irrigate with water for a long time), circumferential (escharotomy)." },
      ],
    },
    {
      heading: "Differential diagnosis (associated problems)",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Carbon monoxide poisoning", text: "Headache, confusion, raised COHb", link: "co-poisoning-adult" },
        { label: "Cyanide toxicity", text: "Enclosed fire, high lactate, shock" },
        { label: "Trauma", text: "Fall, blast, jump from fire", link: "trauma-primary-survey-adult" },
        { label: "Non-accidental injury", text: "Pattern or story does not fit" },
        { label: "Self-inflicted burn", text: "Assess risk and safeguarding" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "ABG / VBG with carboxyhaemoglobin and lactate, CBC, renal function, electrolytes, CK (electrical), crossmatch, glucose." },
        { label: "ECG", text: "All electrical burns and suspected CO poisoning." },
        { label: "Urine", text: "Myoglobin in electrical and deep burns." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Fluids", text: "Ringer's lactate: start 2–4 mL/kg/%TBSA over 24 hours (half in the first 8 hours from the time of burn), then titrate hourly to urine output 0.5 mL/kg/hour (1 mL/kg/hour in electrical injury with myoglobinuria).", critical: true },
        { label: "Avoid over-resuscitation", text: "Reduce fluids when urine output is above target — 'fluid creep' causes compartment syndromes and lung oedema." },
        { label: "Oxygen", text: "100% via non-rebreather or ventilator until CO is excluded." },
        { label: "Analgesia", text: "IV opioid titrated; ketamine for dressings." },
        { label: "Wound", text: "Cover with cling film (lengthwise, not wrapped) for transfer; no ice; tetanus prophylaxis." },
        { label: "No routine antibiotics", text: "Prophylactic systemic antibiotics are not recommended." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Early intubation", text: "Uncut tube, experienced operator; suxamethonium is safe in the first 24 hours.", link: "rsi-procedure" },
        { label: "Escharotomy", text: "Circumferential full-thickness burns of the chest (poor ventilation) or limbs (absent pulses) — burns or surgical team." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Burns unit referral", text: "Over 10–15% TBSA (adults), full thickness over 5%, face, hands, feet, genitals, perineum or major joints, circumferential, inhalation, electrical, chemical, extremes of age, significant comorbidity." },
        { label: "ICU", text: "Inhalation injury, intubated, large burns." },
        { label: "Discharge", text: "Small partial-thickness burns not in special areas, with dressing follow-up." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for stridor before intubating — the airway may become impossible." },
        { text: "Over-estimating size by counting erythema; over-resuscitating." },
        { text: "Trusting SpO2 in carbon monoxide poisoning." },
        { text: "Missing other injuries in a patient who jumped from a fire." },
      ],
    },
  ],
};