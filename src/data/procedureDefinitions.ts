import { ProcedureType, ProcedureCategory } from "../types/procedureNotes";

export interface ProcedureDefinition {
  type: ProcedureType;
  name: string;
  category: ProcedureCategory;
  isFavorite: boolean;
  implemented: boolean;
  description: string;
  defaultIndication?: string;
}

export const PROCEDURE_DEFINITIONS: ProcedureDefinition[] = [
  // 1. Foley
  {
    type: "foley_catheter",
    name: "Foley Catheter Insertion",
    category: "TUBES & DRAINS",
    isFavorite: true,
    implemented: true,
    description: "Urinary bladder catheterization with balloon retention",
    defaultIndication: "Acute urinary retention / strict monitoring of hourly urine output"
  },
  // 2. NG / Ryles
  {
    type: "ryles_tube",
    name: "NG / Ryles Tube Insertion",
    category: "TUBES & DRAINS",
    isFavorite: true,
    implemented: true,
    description: "Nasogastric tube placement for decompression, enteral feeding, or lavage",
    defaultIndication: "Gastric decompression / bowel obstruction / enteral nutrition"
  },
  // 3. RSI Intubation
  {
    type: "rsi_intubation",
    name: "RSI / Endotracheal Intubation",
    category: "AIRWAY & BREATHING",
    isFavorite: true,
    implemented: true,
    description: "Rapid sequence induction and oral endotracheal intubation",
    defaultIndication: "Impending airway compromise / severe hypoxia / GCS < 8"
  },
  // 4. Central Line
  {
    type: "central_line",
    name: "Central Venous Line Insertion",
    category: "VASCULAR & MONITORING",
    isFavorite: true,
    implemented: true,
    description: "Cannulation of internal jugular, subclavian, or femoral vein",
    defaultIndication: "Central venous access for vasopressors / hypertonic infusions / CVP monitoring"
  },
  // 5. Arterial Line
  {
    type: "arterial_line",
    name: "Arterial Line Insertion",
    category: "VASCULAR & MONITORING",
    isFavorite: true,
    implemented: true,
    description: "Continuous invasive blood pressure monitoring and frequent blood sampling",
    defaultIndication: "Hemodynamic instability requiring continuous arterial BP monitoring"
  },
  // 6. Closed Reduction
  {
    type: "closed_reduction",
    name: "Closed Manipulative Reduction",
    category: "TRAUMA & ORTHOPEDICS",
    isFavorite: true,
    implemented: true,
    description: "Manual realignment of displaced fracture or dislocated joint",
    defaultIndication: "Displaced fracture with neurovascular or soft-tissue compromise"
  },
  // 7. Short Arm Slab
  {
    type: "short_arm_slab",
    name: "Short Arm Slab (Plaster)",
    category: "TRAUMA & ORTHOPEDICS",
    isFavorite: true,
    implemented: true,
    description: "Below-elbow immobilization for forearm, wrist, or carpal injuries",
    defaultIndication: "Distal radius fracture / wrist sprain / carpal bone injury immobilization"
  },

  // Prepared Future Templates (Favorites or Category members for Phase 2 expansion)
  {
    type: "chest_tube",
    name: "Chest Tube Insertion (Intercostal Drain)",
    category: "AIRWAY & BREATHING",
    isFavorite: true,
    implemented: false,
    description: "Tube thoracostomy for pneumothorax or hemothorax (Phase 2 template)"
  },
  {
    type: "needle_thoracostomy",
    name: "Needle Thoracostomy / Decompression",
    category: "AIRWAY & BREATHING",
    isFavorite: false,
    implemented: false,
    description: "Immediate emergency decompression of tension pneumothorax"
  },
  {
    type: "intraosseous_access",
    name: "Intraosseous (IO) Access",
    category: "VASCULAR & MONITORING",
    isFavorite: false,
    implemented: false,
    description: "Emergency vascular access via proximal tibia or humeral head"
  },
  {
    type: "wound_suturing",
    name: "Wound Suturing / Closure",
    category: "WOUND / MINOR PROCEDURES",
    isFavorite: true,
    implemented: false,
    description: "Primary surgical closure of traumatic lacerations"
  },
  {
    type: "abscess_incision_drainage",
    name: "Abscess Incision & Drainage (I&D)",
    category: "WOUND / MINOR PROCEDURES",
    isFavorite: true,
    implemented: false,
    description: "Incision, evacuation, and packing of localized subcutaneous abscess"
  },
  {
    type: "wound_irrigation",
    name: "Wound Debridement & Irrigation",
    category: "WOUND / MINOR PROCEDURES",
    isFavorite: false,
    implemented: false,
    description: "Copious saline washout and cleansing of contaminated wounds"
  },
  {
    type: "foreign_body_removal",
    name: "Foreign Body Removal",
    category: "WOUND / MINOR PROCEDURES",
    isFavorite: false,
    implemented: false,
    description: "Removal of foreign body from soft tissue, ear, or nose"
  },
  {
    type: "epistaxis_packing",
    name: "Epistaxis Anterior/Posterior Packing",
    category: "AIRWAY & BREATHING",
    isFavorite: false,
    implemented: false,
    description: "Nasal packing for refractory anterior or posterior nasal hemorrhage"
  },
  {
    type: "long_arm_slab",
    name: "Long Arm Slab",
    category: "TRAUMA & ORTHOPEDICS",
    isFavorite: false,
    implemented: false,
    description: "Above-elbow immobilization for elbow and proximal forearm injuries"
  },
  {
    type: "short_leg_slab",
    name: "Short Leg Slab / Splint",
    category: "TRAUMA & ORTHOPEDICS",
    isFavorite: false,
    implemented: false,
    description: "Below-knee posterior slab for ankle fractures or severe sprains"
  },
  {
    type: "long_leg_slab",
    name: "Long Leg Slab / Splint",
    category: "TRAUMA & ORTHOPEDICS",
    isFavorite: false,
    implemented: false,
    description: "Above-knee splint for knee injuries or distal femur fractures"
  },
  {
    type: "joint_reduction",
    name: "Joint Reduction (Shoulder / Patella / Finger)",
    category: "TRAUMA & ORTHOPEDICS",
    isFavorite: false,
    implemented: false,
    description: "Specific closed reduction techniques for dislocated joints"
  },
  {
    type: "procedural_sedation",
    name: "Procedural Sedation & Analgesia (PSA)",
    category: "RESUSCITATION / OTHER",
    isFavorite: false,
    implemented: false,
    description: "Administration of sedatives and analgesics with continuous monitoring"
  },
  {
    type: "synchronized_cardioversion",
    name: "Synchronized Cardioversion",
    category: "RESUSCITATION / OTHER",
    isFavorite: false,
    implemented: false,
    description: "Synchronized electrical shock for unstable tachyarrhythmias"
  },
  {
    type: "defibrillation",
    name: "Defibrillation",
    category: "RESUSCITATION / OTHER",
    isFavorite: false,
    implemented: false,
    description: "Unsynchronized high-energy shock for VF or pulseless VT"
  },
  {
    type: "transcutaneous_pacing",
    name: "Transcutaneous Cardiac Pacing",
    category: "RESUSCITATION / OTHER",
    isFavorite: false,
    implemented: false,
    description: "External electrical pacing for symptomatic unstable bradycardia"
  },
  {
    type: "lumbar_puncture",
    name: "Lumbar Puncture (Spinal Tap)",
    category: "RESUSCITATION / OTHER",
    isFavorite: false,
    implemented: false,
    description: "CSF sampling via L3-L4 / L4-L5 intervertebral space"
  },
  {
    type: "thoracentesis",
    name: "Thoracentesis (Pleural Tap)",
    category: "TUBES & DRAINS",
    isFavorite: false,
    implemented: false,
    description: "Diagnostic or therapeutic evacuation of pleural effusion"
  },
  {
    type: "paracentesis",
    name: "Abdominal Paracentesis (Ascitic Tap)",
    category: "TUBES & DRAINS",
    isFavorite: false,
    implemented: false,
    description: "Diagnostic or therapeutic evacuation of peritoneal ascitic fluid"
  }
];

export const PROCEDURE_CATEGORIES: ProcedureCategory[] = [
  "AIRWAY & BREATHING",
  "VASCULAR & MONITORING",
  "TUBES & DRAINS",
  "TRAUMA & ORTHOPEDICS",
  "WOUND / MINOR PROCEDURES",
  "RESUSCITATION / OTHER"
];
