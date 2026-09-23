export type ProcedureConsentStatus = "obtained" | "emergency_implied" | "not_applicable" | "not_documented";
export type ProcedureComplicationStatus = "none_observed" | "present" | "not_documented";

export type ProcedureCategory = 
  | "AIRWAY & BREATHING"
  | "VASCULAR & MONITORING"
  | "TUBES & DRAINS"
  | "TRAUMA & ORTHOPEDICS"
  | "WOUND / MINOR PROCEDURES"
  | "RESUSCITATION / OTHER";

export type ProcedureType = 
  | "foley_catheter"
  | "central_line"
  | "arterial_line"
  | "rsi_intubation"
  | "closed_reduction"
  | "short_arm_slab"
  | "ryles_tube"
  // Prepared future templates (architecture ready)
  | "chest_tube"
  | "needle_thoracostomy"
  | "intraosseous_access"
  | "wound_suturing"
  | "wound_irrigation"
  | "abscess_incision_drainage"
  | "foreign_body_removal"
  | "epistaxis_packing"
  | "long_arm_slab"
  | "short_leg_slab"
  | "long_leg_slab"
  | "joint_reduction"
  | "procedural_sedation"
  | "synchronized_cardioversion"
  | "defibrillation"
  | "transcutaneous_pacing"
  | "lumbar_puncture"
  | "thoracentesis"
  | "paracentesis";

export interface ProcedureMetadata {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  performedBy: string;
  assistant?: string;
  indication: string;
  consent: ProcedureConsentStatus;
  attempts?: number | string;
  complications: ProcedureComplicationStatus;
  complicationDetails?: string;
  additionalNotes?: string;
}

export interface FoleyCatheterData {
  catheterSize?: string; // e.g. "12 Fr", "14 Fr", "16 Fr", "18 Fr"
  balloonVolumeMl?: string; // e.g. "10 mL sterile water"
  urineReturn?: string; // e.g. "Clear yellow urine, 250 mL immediately drained"
  secured?: boolean | string; // e.g. "Secured to inner thigh without tension"
  drainageBag?: boolean | string; // e.g. "Connected to dependent urobag"
  plan?: string; // e.g. "Monitor hourly urine output; remove when clinically indicated"
}

export interface CentralLineData {
  side?: "Right" | "Left" | "Bilateral" | "";
  site?: "Internal Jugular" | "Subclavian" | "Femoral" | "";
  catheterType?: string; // e.g. "Triple-lumen 7 Fr, 20 cm"
  ultrasoundGuidance?: "US Guided" | "Landmark Technique" | "US Assisted (Pre-scan)" | "Not documented" | "";
  localAnaesthesia?: string; // e.g. "2% Lignocaine 5 mL infiltrated"
  bloodAspiration?: boolean | string; // e.g. "Free non-pulsatile venous blood aspirated"
  lumensFlushed?: boolean | string; // e.g. "All lumens aspirated and flushed with sterile saline"
  secured?: string; // e.g. "Sutured with 2-0 silk, sterile transparent dressing applied"
  positionConfirmed?: string; // e.g. "Guide-wire visualized on US, portable post-procedure CXR ordered"
  depthCm?: string; // e.g. "13 cm at skin"
}

export interface ArterialLineData {
  side?: "Right" | "Left" | "";
  site?: "Radial" | "Femoral" | "Brachial" | "Dorsalis Pedis" | "";
  ultrasoundGuidance?: "US Guided" | "Palpation / Landmark" | "Not documented" | "";
  localAnaesthesia?: string; // e.g. "1% Lignocaine 1 mL local wheal"
  arterialWaveform?: string; // e.g. "Good pulsatile blood return; crisp arterial waveform on transducer"
  openingBp?: string; // e.g. "118/74 mmHg"
  secured?: string; // e.g. "Sutured with 3-0 silk, sterile occlusive dressing applied"
}

export interface RsiIntubationData {
  preoxygenation?: string; // e.g. "100% FiO2 via NRBM for 3 mins, apnoeic oxygenation via NC 15 L/min"
  inductionDrug?: string; // e.g. "Etomidate 20 mg IV" or "Propofol 100 mg IV"
  paralyticDrug?: string; // e.g. "Rocuronium 70 mg IV (1.2 mg/kg)" or "Succinylcholine 100 mg IV"
  device?: string; // e.g. "Video laryngoscope (Mac 3)" or "Direct laryngoscopy (Mac 3)"
  cormackLehaneGrade?: "Grade 1" | "Grade 2a" | "Grade 2b" | "Grade 3" | "Grade 4" | "POGO 100%" | "Not documented" | "";
  etTubeSize?: string; // e.g. "7.5 mm cuffed"
  depthCm?: string; // e.g. "22 cm at incisors"
  etco2Confirmed?: boolean | string; // e.g. "Continuous 5-wave colorimetric/waveform ETCO2 confirmation"
  chestRise?: boolean | string; // e.g. "Bilateral equal chest rise observed"
  auscultation?: string; // e.g. "Bilateral equal breath sounds, epigastrium silent"
  postIntubationVentilation?: string; // e.g. "Connected to mechanical ventilator: AC/VC, TV 420 mL, RR 16, PEEP 5"
  postIntubationSedation?: string; // e.g. "Propofol infusion started at 20 mcg/kg/min; Fentanyl boluses"
}

export interface ClosedReductionData {
  diagnosis?: string; // e.g. "Colles fracture right wrist", "Anterior shoulder dislocation"
  site?: string; // e.g. "Right distal radius", "Left glenohumeral joint"
  anesthesiaSedation?: string; // e.g. "Hematoma block (10 mL 1% Lignocaine)" or "Procedural sedation (Fentanyl 50 mcg + Midazolam 2 mg IV)"
  procedureDetails?: string; // e.g. "Longitudinal traction applied, volar displacement and ulnar deviation reduced"
  preNeurovascularStatus?: string; // e.g. "Radial pulse 2+, sensation in median/radial/ulnar nerve distribution intact"
  postNeurovascularStatus?: string; // e.g. "Warm, capillary refill < 2s, radial pulse palpable, motor/sensory intact"
  imagingConfirmation?: string; // e.g. "Post-reduction check X-ray confirmed satisfactory alignment and cortical apposition"
  immobilization?: string; // e.g. "Below-elbow sugar-tong / short arm plaster slab applied"
  plan?: string; // e.g. "Post-reduction check X-ray, Orthopedic review, elevate limb"
}

export interface ShortArmSlabData {
  side?: "Right" | "Left" | "Bilateral" | "";
  site?: string; // e.g. "Distal forearm / wrist"
  padding?: string; // e.g. "Webril soft roll cotton padding 2 layers applied without wrinkles"
  extent?: string; // e.g. "Below elbow to proximal palmar crease, MCP joints fully free"
  position?: string; // e.g. "Wrist in slight extension (15-20°), neutral deviation, thumb free"
  postNeurovascularCheck?: string; // e.g. "Warm periphery, capillary refill < 2s, distal pulses palpable, fingers mobile"
  plan?: string; // e.g. "Keep elevated in arm sling, check for tight cast warning signs, Ortho clinic in 5 days"
}

export interface RylesTubeData {
  tubeSize?: string; // e.g. "14 Fr", "16 Fr", "18 Fr"
  nostril?: "Right" | "Left" | "";
  insertionLengthCm?: string; // e.g. "55 cm (NEX measurement: nose-earlobe-xiphisternum)"
  confirmationMethod?: string; // e.g. "Epigastric whoosh heard on air insufflation & gastric juice aspirated with pH < 5.5"
  secured?: string; // e.g. "Taped securely to nose bridge and cheek without ala pressure"
  plan?: string; // e.g. "Free drainage into bag / keep spigotted / aspirate 4th hourly"
}

export interface ProcedureNote {
  id: string; // UUID
  caseId: string;
  procedureType: ProcedureType;
  procedureName: string;
  category: ProcedureCategory;
  metadata: ProcedureMetadata;
  // Specific structured payload
  data: 
    | { type: "foley_catheter"; fields: FoleyCatheterData }
    | { type: "central_line"; fields: CentralLineData }
    | { type: "arterial_line"; fields: ArterialLineData }
    | { type: "rsi_intubation"; fields: RsiIntubationData }
    | { type: "closed_reduction"; fields: ClosedReductionData }
    | { type: "short_arm_slab"; fields: ShortArmSlabData }
    | { type: "ryles_tube"; fields: RylesTubeData }
    | { type: "generic"; fields: Record<string, any> };
  generatedNarrative: string;
  createdAt: string;
  updatedAt: string;
  status: "completed";
}

export interface DetectedProcedureReview {
  detectedText: string;
  procedureType: ProcedureType;
  procedureName: string;
  prefilledMetadata?: Partial<ProcedureMetadata>;
  prefilledFields?: Record<string, any>;
}
