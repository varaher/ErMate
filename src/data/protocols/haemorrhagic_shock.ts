import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Haemorrhagic shock in trauma (adult). v0.1, 23 Nov 2026. ATLS 11th edition; European trauma bleeding guideline 2023.
export const HAEMORRHAGIC_SHOCK_ADULT: ProtocolTopic = {
  id: "haemorrhagic-shock-adult",
  title: "Haemorrhagic shock (trauma)",
  summary:
    "Shock from blood loss. Stop the bleeding, replace blood with blood, and prevent the lethal diamond of hypothermia, acidosis, coagulopathy and low calcium.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "trauma-primary-survey-adult",
  source: "ErMate Handbook — trauma pathway v0.1 (ATLS 11th edition)",
  keywords: ["haemorrhagic shock", "hemorrhagic shock", "bleeding", "massive transfusion", "mtp", "txa", "tranexamic acid", "whole blood", "permissive hypotension", "trauma bleeding"],
  notice: "Draft for clinical sign-off. Massive transfusion follows your blood bank's protocol.",
  firstTen: [
    "Control external bleeding (pressure, packing, tourniquet) and apply a pelvic binder if the pelvis may be injured.",
    "Two large-bore IV / IO lines; crossmatch; activate the massive transfusion protocol.",
    "Tranexamic acid 1 g IV over 10 minutes if within 3 hours of injury.",
    "Transfuse blood products 1:1:1 or whole blood; keep crystalloid to a minimum.",
    "Find the source (eFAST, chest and pelvic X-ray) and call the surgeon or interventional radiologist now.",
  ],
  references: [
    "American College of Surgeons. Advanced Trauma Life Support (ATLS) Student Course Manual, 11th edition. 2025",
    "Rossaint R et al. The European guideline on management of major bleeding and coagulopathy following trauma: sixth edition. Crit Care. 2023",
    "Holcomb JB et al. Transfusion of plasma, platelets and red blood cells in a 1:1:1 vs 1:1:2 ratio (PROPPR). JAMA. 2015",
    "CRASH-2 collaborators. Tranexamic acid in trauma patients with significant haemorrhage. Lancet. 2010",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Tachycardia, tachypnoea, cool pale skin, delayed capillary refill, anxiety then confusion, low urine output." },
        { text: "Blood pressure falls late — after about 30% blood loss in a young adult." },
        { text: "Shock index (HR ÷ SBP) above 1 or a base deficit worse than −6 predicts the need for massive transfusion." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Blood loss lowers preload and oxygen delivery; tissues switch to anaerobic metabolism (lactate, acidosis)." },
        { text: "Trauma-induced coagulopathy starts within minutes, worsened by hypothermia, acidosis, dilution with crystalloid and low ionised calcium." },
        { text: "Raising blood pressure before the bleeding is controlled can dislodge clot and increase bleeding." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Where is the blood?", text: "Chest (X-ray, eFAST), abdomen (eFAST), pelvis (X-ray), long bones (femur), external (scalp, wounds).", critical: true },
        { label: "Response to blood", text: "Responder, transient responder or non-responder — transient and non-responders need surgery or embolisation now." },
        { label: "Head injury too?", text: "No permissive hypotension: keep SBP at least 100–110.", link: "tbi-adult" },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Tension pneumothorax", text: "Obstructive, not bleeding", link: "tension-pneumothorax-adult" },
        { label: "Cardiac tamponade", text: "Penetrating chest, distended neck veins", link: "chest-trauma-adult" },
        { label: "Neurogenic shock", text: "Spinal injury, bradycardia, warm", link: "spinal-injury-adult" },
        { label: "Pelvic fracture bleeding", text: "Unstable pelvis", link: "pelvic-trauma-adult" },
        { label: "Medical bleed", text: "GI bleed, ruptured ectopic, AAA", link: "variceal-bleed-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Crossmatch, CBC, coagulation and fibrinogen (viscoelastic test where available), VBG with lactate, base deficit and ionised calcium; repeat every 30–60 minutes during transfusion." },
        { label: "Imaging", text: "eFAST, chest and pelvic X-ray; CT only once stabilised." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Massive transfusion", text: "Plasma, platelets and red cells 1:1:1, or low-titre O whole blood; switch to group-specific and viscoelastic-guided products as soon as possible.", critical: true },
        { label: "Tranexamic acid", text: "1 g IV over 10 minutes, then 1 g over 8 hours. Only within 3 hours of injury — later doses may harm.", critical: true },
        { label: "Calcium", text: "Give IV calcium (for example 10 mL 10% calcium chloride) early in massive transfusion; keep ionised calcium above 1.1 mmol/L." },
        { label: "Permissive hypotension", text: "Target SBP 80–90 mmHg (palpable radial pulse, mentating) until bleeding is controlled. Not in traumatic brain injury, and use caution in the elderly." },
        { label: "Fibrinogen", text: "Replace with cryoprecipitate or fibrinogen concentrate when below 1.5 g/L." },
        { label: "Warmth", text: "Warmed blood and fluids, warm blankets; aim for core temperature above 35 °C." },
        { label: "Anticoagulants", text: "Reverse warfarin with PCC and vitamin K; specific reversal for dabigatran or factor Xa inhibitors where available." },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Tourniquet and wound packing", text: "For limb and junctional bleeding." },
        { label: "Pelvic binder", text: "Over the greater trochanters.", link: "pelvic-trauma-adult" },
        { label: "Damage-control surgery / angioembolisation", text: "For ongoing bleeding — the definitive treatment." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Theatre / interventional radiology", text: "Transient or non-responders." },
        { label: "ICU", text: "After haemorrhage control, for ongoing resuscitation." },
        { label: "Transfer", text: "To a trauma centre if no surgeon or blood bank capacity — start blood and TXA before transfer." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for the haemoglobin to fall — it is normal in early bleeding." },
        { text: "Giving TXA after 3 hours." },
        { text: "Forgetting calcium during massive transfusion." },
        { text: "Sending an unstable patient to CT." },
      ],
    },
  ],
};