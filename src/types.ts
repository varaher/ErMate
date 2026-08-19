/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TriageCategory {
  P1 = "P1 (Immediate)",
  P2 = "P2 (Urgent)",
  P3 = "P3 (Non-Urgent)",
}

export enum ArrivalMode {
  WalkIn = "Walk-in",
  Ambulance = "Ambulance",
  Referred = "Referred",
}

export interface MlcDetails {
  natureOfIncident: string;
  dateTimeOfIncident: string;
  placeOfIncident: string;
  identificationMark: string;
  informantBroughtBy: string;
  policeStation: string;
  policeIntimationTime: string;
  ddEntryNo: string;
  historyStatedBy?: string;
  allegedCauseOfInjury?: string;
  opinion?: string;
  certificateRequestedBy?: string;
  issuingDoctorRegistration?: string;
}

export interface PatientDemographics {
  id?: string;
  name: string;
  age: number | null;
  gender: string;
  presentingComplaint: string;
  triageCategory: TriageCategory;
  arrivalMode: ArrivalMode;
  dateOpened: string;
  uhid?: string;
  phone?: string;
  isMlc: boolean;
  mlcDetails?: MlcDetails;
  caseType: "Medical" | "Trauma";
}

export interface PatientVitals {
  bp: string;      // BP
  hr: string;      // Heart rate
  spo2: string;    // SpO2
  rr: string;      // Respiratory rate
  temp: string;    // Temperature (°F)
  gcs: string;     // Glasgow Coma Scale
  gcs_e: string;   // GCS Eye (1-4)
  gcs_v: string;   // GCS Verbal (1-5)
  gcs_m: string;   // GCS Motor (1-6)
  grbs: string;    // Blood glucose
  avpu: string;    // AVPU scale
  painScore: string; // Pain Score (0-10)
}

export interface SampleHistory {
  medicationsInEnvironment?: string;
  symptoms: string;
  allergies: string;
  medications: string;
  pastHistory: string;
  lastMeal: string;
  events: string;
  socialHistory: string;
  familyHistory: string;
  psychiatricFlags: string;
}

export interface PrimarySurvey {
  airway: {
    status: 'patent' | 'maintained' | 'compromised' | 'protected' | string;
    intervention: string | null;
    cSpine: 'immobilised' | 'not_applicable' | string | null;
  };
  breathing: {
    rr: string | null;
    spo2: string | null;
    o2Delivery: string | null;
    workOfBreathing: 'normal' | 'increased' | string | null;
    airEntry: string | null;
    addedSounds: string | null;
    chestWall: string | null;
  };
  circulation: {
    hr: string | null;
    rhythm: 'regular' | 'irregular' | string | null;
    sbp: string | null;
    dbp: string | null;
    crt: '<2sec' | '>2sec' | string | null;
    peripheralPulses: 'normal' | 'weak' | 'absent' | 'bounding' | string | null;
    skinPerfusion: string | null;
    bleeding: string | null;
    ivAccess: string | null;
    efast: {
      pericardial: 'negative' | 'positive' | 'not_done' | string;
      ruq: 'negative' | 'positive' | 'not_done' | string;
      luq: 'negative' | 'positive' | 'not_done' | string;
      suprapubic: 'negative' | 'positive' | 'not_done' | string;
      lungs: 'no_blines' | 'blines' | 'not_done' | string;
    };
    ecg: string | null;
  };
  disability: {
    gcsE: string | null;
    gcsV: string | null;
    gcsM: string | null;
    gcsTotal: string | null;
    pupilsEqual: boolean | null;
    pupilSizeR: string | null;
    pupilSizeL: string | null;
    pupilReaction: 'reactive' | 'sluggish' | 'fixed' | string | null;
    grbs: string | null;
    focalDeficit: string | null;
    seizure: 'none' | 'active' | 'postictal' | string | null;
  };
  exposure: {
    temp: string | null;
    logRoll: string | null;
    skin: string | null;
    pelvis: 'stable' | 'unstable' | 'not_assessed' | string | null;
    longBones: string | null;
    hypothermiaPrevention: boolean | null;
  };

  adjuncts?: {
    abg?: {
      sampleType?: string;
      interpretation?: string;
      ph?: string;
      pco2?: string;
      po2?: string;
      hco3?: string;
      be?: string;
      lactate?: string;
      sao2?: string;
      fio2?: string;
      na?: string;
      k?: string;
      cl?: string;
      ag?: string;
      glucose?: string;
      hb?: string;
      aa?: string;
      notes?: string;
      finalDiagnosis?: string;
      clinicalInterpretation?: string;
    };
    ecgStatus?: string;
    efastStatus?: string;
    echoStatus?: string;
  };
}

export interface PrimaryAssessment {

  airway: string;
  airwayStatus: "Normal" | "Abnormal";
  breathing: string;
  breathingStatus: "Normal" | "Abnormal";
  circulation: string;
  circulationStatus: "Normal" | "Abnormal";
  disability: string;
  disabilityStatus: "Normal" | "Abnormal";
  exposure: string;
  exposureStatus: "Normal" | "Abnormal";
  survey?: PrimarySurvey;
}

export function getInitialPrimarySurvey(caseType: string = "Medical"): PrimarySurvey {
  const isTrauma = caseType?.toLowerCase() === "trauma";
  return {
    airway: {
      status: "patent",
      intervention: null,
      cSpine: isTrauma ? "immobilised" : "not_applicable",
    },
    breathing: {
      rr: null,
      spo2: null,
      o2Delivery: "Room air",
      workOfBreathing: "normal",
      airEntry: "Bilaterally equal",
      addedSounds: "Clear",
      chestWall: isTrauma ? "Normal" : null,
    },
    circulation: {
      hr: null,
      rhythm: "regular",
      sbp: null,
      dbp: null,
      crt: "<2sec",
      peripheralPulses: "normal",
      skinPerfusion: "Warm + dry",
      bleeding: isTrauma ? "Nil" : null,
      ivAccess: null,
      efast: {
        pericardial: "not_done",
        ruq: "not_done",
        luq: "not_done",
        suprapubic: "not_done",
        lungs: "not_done",
      },
      ecg: null,
    },
    disability: {
      gcsE: "4",
      gcsV: "5",
      gcsM: "6",
      gcsTotal: "15",
      pupilsEqual: true,
      pupilSizeR: "3",
      pupilSizeL: "3",
      pupilReaction: "reactive",
      grbs: null,
      focalDeficit: "Nil",
      seizure: "none",
    },
    exposure: {
      temp: null,
      skin: "No pallor, rashes, or oedema",
      logRoll: isTrauma ? "Spine clear" : null,
      pelvis: isTrauma ? "stable" : null,
      longBones: isTrauma ? "Intact" : null,
      hypothermiaPrevention: false,
    },
  };
}

export interface TreatmentItem {
  id: string;
  drugName: string;
  dose: string;
  route: string;
  timeGiven: string;
  ipsgVerified?: boolean; // IPSG medication check
}

export interface InvestigationItem {
  id: string;
  testName: string;
  result: string;
  orderTime: string;
  resultTime: string;
  isAbnormal?: boolean;
}

export interface DifferentialDiagnosis {
  diagnosis: string;
  status: "CONSISTENT" | "POSSIBLE" | "LESS LIKELY";
  reasoning: string;
  citations: string[];
  nextSteps: string[];
}

export interface IpsgChecklist {
  ipsg1IdentifiersVerified: boolean;
  ipsg2ReadBackPerformed: boolean;
  ipsg3HighAlertDoubleChecked: boolean;
  ipsg4TimeOutPerformed: boolean;
  ipsg5HandHygieneComplied: boolean;
  ipsg6FallRiskAssessed: "Low" | "Medium" | "High";
}

export interface PsychologicalAssessment {
  suicidalIdeation: boolean;
  selfHarmHistory: boolean;
  intentToHarmOthers: boolean;
  substanceAbuse: boolean;
  psychiatricHistory: boolean;
  currentlyOnPsychiatricTreatment: boolean;
  hasSupportSystem: boolean;
  notes: string | null;
}

export interface VulnerableAssessment {
  isVulnerable: boolean;
  vulnerableType: string; // Pediatric, Geriatric, Pregnant, Physically Challenged, etc.
  nutritionalScreenPassed: boolean;
  functionalAssessmentScore: string; // Independent, Assisted, Dependent
  abuseScreenNegative: boolean;
  victimOfAbuse?: boolean;
  severePainDistress?: boolean;
  isAlertOriented?: boolean;
  suicidalIdeationRisk?: boolean;
  confusionAgitation?: boolean;
  needsMobilityAssistance?: boolean;
  recentFall?: boolean;
}

export interface ConsentTimeOut {
  procedureConsentObtained: boolean;
  procedureTimeOutPerformed: boolean;
}

export interface DispositionDetails {
  dispositionType: "Discharge" | "Admit" | "Refer" | "LAMA" | "Absconded" | "Death";
  durationInEr: string;
  residentName: string;
  consultantName: string;
  observationNotes: string;
  dischargeVitals?: {
    hr?: string;
    bp?: string;
    rr?: string;
    spo2?: string;
    gcs?: string;
    temp?: string;
    grbs?: string;
    painScore?: string;
  };
}

export interface DischargeInfo {
  primaryDiagnosis: string;
  secondaryDiagnosis: string;
  conditionAtDischarge: string;
  dischargeMedications: string;
  followUpPlan: string;
  patientInstructions: string;
  aiDrafted?: boolean;
  aiGenerated?: boolean;
  dischargeDateTime?: string;
  dispositionType?: string;
  emResidentName?: string;
  emConsultantName?: string;
  uhid?: string;
  broughtBy?: string;
  
  // MLC & Allergy
  isMlc?: string;
  mlcNo?: string;
  allergies?: string;
  
  // Arrival Vitals
  arrivalHr?: string;
  arrivalBp?: string;
  arrivalRr?: string;
  arrivalSpo2?: string;
  arrivalGcs?: string;
  arrivalPainScore?: string;
  arrivalGrbs?: string;
  arrivalTemp?: string;
  
  // Clinical
  presentingComplaints?: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  familyGynaeHistory?: string;
  lmp?: string;
  generalExamination?: string;
  
  // Primary Assessment
  primaryAirway?: string;
  primaryAirwayIntervention?: string;
  primaryBreathing?: string;
  primaryBreathingWork?: string;
  primaryBreathingAirEntry?: string;
  primaryBreathingCct?: string;
  primaryBreathingSubcut?: string;
  primaryBreathingEfast?: string;
  primaryBreathingIntervention?: string;
  primaryCirculationCrt?: string;
  primaryCirculationDnv?: string;
  primaryCirculationPct?: string;
  primaryCirculationDeformity?: string;
  primaryCirculationFast?: string;
  primaryCirculationInterventions?: string;
  primaryDisabilityAvpuGcs?: string;
  primaryDisabilityPupils?: string;
  primaryDisabilityGrbs?: string;
  primaryExposureTemp?: string;
  primaryExposureTrauma?: string;
  
  // Secondary Assessment
  secondaryPicle?: string;
  secondaryChest?: string;
  secondaryCvs?: string;
  secondaryPa?: string;
  secondaryCns?: string;
  secondaryExtremities?: string;
  
  // Course and results
  courseInHospital?: string;
  investigationsResults?: string;
  
  // Discharge Vitals
  dischargeHr?: string;
  dischargeBp?: string;
  dischargeRr?: string;
  dischargeSpo2?: string;
  dischargeGcs?: string;
  dischargePainScore?: string;
  dischargeGrbs?: string;
  dischargeTemp?: string;
  dischargeCondition?: string;
  dispositionStatus?: string;
}

export interface VitalsRecord {
  timestamp: string;
  bp: string;
  systolic: number;
  diastolic: number;
  hr: number;
  spo2: number;
  rr: number;
  temp: number;
}

export interface ClinicalCase {
  id: string;
  bedNo?: string;
  patient: PatientDemographics;
  vitals: PatientVitals;
  sampleHistory: SampleHistory;
  primaryAssessment: PrimaryAssessment;
  secondaryAssessment: string;
  investigations: InvestigationItem[];
  treatments: TreatmentItem[];
  progressNotes: string;
  dischargeInfo: DischargeInfo | null;
  differentials: DifferentialDiagnosis[];
  isPediatric: boolean;
  status: "Triage" | "Active" | "Discharged";
  savedTime: string;
  timeSpentMin: number; // calculated time spent
  doctorEmail?: string; // assigned doctor's email for custom dashboard cases
  hospital?: string; // hospital name for data isolation and security
  ipsgChecklist?: IpsgChecklist;
  vulnerableAssessment?: VulnerableAssessment;
  psychologicalAssessment?: PsychologicalAssessment;
  consentTimeOut?: ConsentTimeOut;
  dispositionDetails?: DispositionDetails;
  vitalsHistory?: VitalsRecord[];
  
  // Advanced features from UI screenshots
  medications?: Array<string | { drugName: string; dose?: string; route?: string; frequency?: string }>;
  investigationsOrdered?: Array<{ name: string; category?: string; orderedAt?: string; status?: string }>;
  investigationResults?: Array<{ name: string; value: string; unit?: string; referenceRange?: string; isAbnormal?: boolean; flag?: "HIGH" | "LOW" | "ABNORMAL" | "NORMAL" }>;
  investigationLabsOrdered?: string;
  investigationImaging?: string;
  investigationResultsSummary?: string;
  provisionalPrimaryDiagnosis?: string;
  provisionalDifferentialDiagnoses?: string;
  otherMedications?: string;
  otherProcedures?: string;
  addendumNotes?: string;
  conditionAtShift?: "Stable" | "Unstable";
  infusions?: Array<{ id: string; fluidName: string; dose: string; dilution: string; rate: string }>;
  proceduresChecked?: string[]; // list of procedurse checked e.g. ["foleys", "ng_tube"]
  doctorName?: string;
  escalated?: boolean;
  consultantReview?: { reviewedBy: string; reviewText: string; timestamp: string };
  pediatricDetails?: PediatricDetails;
  dispositionAndPlan?: {
    dispositionStatus?: string;
    destinationUnit?: string;
    consultsRequested?: string[];
    pendingInvestigations?: string[];
    followUpAdvice?: string;
  };
  treatment?: {
    medications?: string[];
    infusions?: string[];
    otherNotes?: string;
  };
  
  // Handover timeline & status fields
  notes?: Array<{ id?: string; timestamp?: string; authorName?: string; authorRole?: string; content: string }>;
  admissionTime?: string;
  vitalFlags?: string[];
  primaryDoctor?: string;
  stayHours?: string;
  
  // Creation, shift, and audit fields for access model
  createdBy?: string;
  createdByEmail?: string;
  createdByName?: string;
  createdByRole?: string;
  entrySource?: "quick_discharge" | "full_case";
  shiftId?: string;
  shiftDate?: string;
  shiftName?: string;
  consultantId?: string;
  consultantName?: string;
  departmentId?: string;
  createdAt?: string;
  lastEditedBy?: string;
  lastEditedByName?: string;
  lastEditedByRole?: string;
  lastEditedAt?: string;
  discussionMessages?: any[];
  clinicalSummary?: any;
}

export interface PediatricDetails {
  patientWeight?: string;
  otherSymptoms?: string;
  adjuvantEfastExtremities?: string;
  focusedHeent?: string;
  focusedRespiratory?: string;
  focusedCardiovascular?: string;
  focusedAbdomen?: string;
  focusedBack?: string;
  focusedExtremities?: string;
  dispositionProvisionalDiagnosis?: string;
  dispositionConditionAtShift?: string;
  dispositionEmResident?: string;
  dispositionEmConsultant?: string;
  // Demographic and Registration Details
  address?: string;
  dateTimeOfIncident?: string;
  placeOfIncident?: string;
  natureOfIncident?: string;
  mechanismOfInjury?: string;
  broughtBy?: string;
  informant?: string;
  identificationMark?: string;

  // Presenting Complaints
  presentingComplaints?: string;

  // Primary Assessment - Pediatric Assessment Triangle (PAT)
  patAppearanceTone?: string;          // moves spontaneously, resists examination, sits or stands
  patAppearanceInteractivity?: string; // alert/engaged, interacts well, reaches for objects
  patAppearanceConsolability?: string; // stops crying with holding/comforting
  patAppearanceLookGaze?: string;      // makes eye contact, tracks visually, normal/abnormal
  patAppearanceSpeechCry?: string;     // age appropriate speech

  // Primary Assessment - Airway
  airwayCry?: "Good" | "Weak" | "No Cry" | "";
  airwayStatus?: "Patent" | "Threatened" | "Compromised" | "";
  airwayIntervention?: string;

  // Primary Assessment - Breathing
  breathingRr?: string;
  breathingSpo2?: string;
  breathingWob?: string;            // Increased WOB, flaring, retractions, grunting, wheezing, stridor, etc.
  breathingAbnormalPositioning?: "YES" | "NO" | ""; // Tripod, sniffing, prefers seated posture
  breathingAirEntry?: "Normal" | "Abnormal" | "";
  breathingSubcutaneousEmphysema?: "YES" | "NO" | "";
  breathingIntervention?: string;

  // Primary Assessment - Circulation
  circulationCrt?: "Normal" | "Delayed" | ""; // Normal (<2s), Delayed (>2s)
  circulationHr?: string;
  circulationBp?: string;
  circulationSkinColorTemp?: string;     // Pink/Pale/Cyanosed/Mottled
  circulationDistendedNeckVeins?: "YES" | "NO" | "";
  circulationIntervention?: string;

  // Primary Assessment - Disability
  disabilityAvpuGcs?: string;
  disabilityPupils?: string;
  disabilityAbnormalResponses?: string; // Pinpoint, dilated, unilaterally dilated
  disabilityGrbs?: string;

  // Primary Assessment - Exposure
  exposureTemp?: string;
  exposureTraumaLogroll?: string;
  exposureSignsOfTrauma?: string;       // Rashes, Petechiae, Ecchymosis, Bruises, Burns
  exposureEvidenceInfectionBleeding?: string; // Petechiae or Purpura
  exposureLongBoneDeformities?: "YES" | "NO" | "";
  exposureExtremitiesCheck?: string;     // Check for deformities, bruising, tenderness
  exposureImmobilizeInjuredLimbs?: "YES" | "NO" | "";

  // Primary Assessment - Adjuvant
  adjuvantEfastHeart?: string;
  adjuvantEfastAbdomen?: string;
  adjuvantEfastLungs?: string;
  adjuvantEfastPelvis?: string;

  // Secondary Assessment - Focused History
  historySignsSymptoms?: string;
  historyAllergies?: string;
  historyMedications?: string;
  historyPastMedical?: string;
  historyLastMeal?: string;
  historyEvents?: string;

  // Secondary Assessment - Focused Physical Examination
  examHeent?: string;
  examRespiratory?: string;
  examCardiovascular?: string;
  examAbdomen?: string;
  examBack?: string;
  examExtremities?: string;

  // Course & Results
  courseInHospital?: string;
  treatmentGiven?: string;
  provisionalDiagnosisDischarge?: string;
  conditionAtShift?: "Stable" | "Unstable" | "";
  disposition?: "ICU" | "Room" | "Ward" | "Referral" | "DAMA" | "";
  differentialDiagnosis?: string;
  // Additional Pediatric History & PAT fields
  immunizationHistory?: string;
  birthHistory?: string;
  feedingHistory?: string;
  developmentalHistory?: string;
  patAppearance?: string;
  patWorkOfBreathing?: string;
  patCirculation?: string;
  emResident?: string;
  emConsultant?: string;
}

export interface DirectDischargeSummaryItem {
  id: string;
  patientName: string;
  uhid?: string;
  ageGender?: string;
  triage?: string;
  rawText: string;
  createdAt: string;
  summary: Record<string, any>;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  hospital: string;
  place?: string;
  state?: string;
  pincode?: string;
  hospitalAddress?: string;
  aiCredits: number;
  streak: number;
  subscriptionTier: string;
  age?: number;
  seededCases?: boolean;
  seededTeam?: boolean;
  seededHandovers?: boolean;
  teamName?: string;
  department?: string;
  teamColor?: "emerald" | "blue" | "indigo" | "violet";
  hasConsentedToLearning?: boolean;
}

export interface HodClaimRequest {
  id: string;
  hospital: string;
  place: string;
  state: string;
  pincode: string;
  claimedByUid: string;
  claimedByName: string;
  claimedByEmail: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionNote: string | null;
}

export interface ApiLogItem {
  id: string;
  timestamp: string;
  service: "ErMate 2.0 Flash" | "ErMate 3.6 Pro" | "Google Vision OCR" | "Speech-to-Text Voice" | "ErMate Search Grounding" | "Firestore Operations";
  feature: string;
  userEmail: string;
  hospital: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUSD: number;
  status: "Success" | "Rate Limited" | "Failed";
}

export interface HandoverRecord {
  id: string;
  senderName: string;
  senderEmail: string;
  timestamp: string;
  caseCount: number;
  patientsText: string;
  acknowledgedBy?: string;
  acknowledgedTime?: string;
  hospital?: string; // hospital name for data isolation and security
}

export interface TeamMember {
  id: string;
  name?: string;
  email: string;
  role: string;
  status: "Pending Invite" | "Active (Joined)" | "Pending Approval";
  shift?: string;
  hospital?: string;
  assignedBy?: string;
  updatedAt?: string;
}

export interface HandoverAlertBanner {
  criticalAllergies?: string | null;
  codeStatus?: string | null;
  criticalValues?: string[];
  pendingCritical?: string[];
  isolationPrecautions?: string | null;
  fallRisk?: boolean;
  summary?: string;
}

export interface DayWiseCourse {
  date: string;
  summary: string;
}

export interface ActiveProblem {
  problem: string;
  status: 'Resolved' | 'Ongoing' | 'Pending workup';
  note?: string | null;
}

export interface CrossConsultation {
  department: string;
  consultant: string;
  dateSeen: string;
  recommendation: string;
  status: 'Completed' | 'Awaiting review' | 'Awaiting re-consult' | 'Not actioned';
  flagged?: boolean;
}

export interface InvestigationTrend {
  parameter: string;
  values: string;
}

export interface InvestigationsGroup {
  trends?: InvestigationTrend[];
  normalSummary?: string | null;
  imaging?: string | null;
  ecg?: string | null;
  echo?: string | null;
  vbg?: string | null;
  cultures?: string | null;
  other?: string | null;
}

export interface AdjunctsAtArrival {
  ecg?: string | null;
  vbg?: string | null;
  abg?: string | null;
  grbs?: string | null;
  lactate?: string | null;
  troponinPOC?: string | null;
  bedsideEcho?: string | null;
  efast?: string | null;
  outsideReports?: string | null;
  physicalOnArrival?: string | null;
  [key: string]: string | null | undefined;
}

export interface AdjunctsDevices {
  ivAccess?: string | null;
  centralLine?: string | null;
  arterialLine?: string | null;
  catheter?: string | null;
  oxygenDelivery?: string | null;
  drains?: string | null;
  monitoring?: string | null;
  ngt?: string | null;
  other?: string | null;
  [key: string]: string | null | undefined;
}

export interface ERBoardingStatus {
  reasonForERRetention?: string | null;
  whoTrackingBed?: string | null;
  durationInERPostAdmission?: string | null;
  riskOfProlongedStay?: string | null;
}

export interface LatestVitalsInfo {
  timestamp?: string | null;
  hr?: string | null;
  bp?: string | null;
  spo2?: string | null;
  rr?: string | null;
  temp?: string | null;
  gcs?: string | null;
  grbs?: string | null;
  trend?: string | null;
}

export interface HandoverPatient {
  id?: string;
  patientLabel: {
    name: string;
    ageSex: string;
    bed: string | null;
    currentLocation?: string | null;
    erNumber: string | null;
    admittingConsultant: string | null;
    admittingDepartment?: string | null;
    admissionDecisionDate?: string | null;
    daysInERSinceAdmission?: number | null;
    erBoarder?: boolean;
    inERSince: string | null;
    status: 'critical' | 'unstable' | 'stable' | 'discharge';
    treatingERPhysician?: string | null;
  };
  alertBanner?: HandoverAlertBanner;
  initialPresentation_lockedAt?: string | null;
  initialPresentation?: {
    chiefComplaint?: string;
    initialVitals?: string;
    abcdeArrival?: string;
    initialImpression?: string;
    adjunctsAtArrival?: AdjunctsAtArrival | string | null;
    lockedAt?: string | null;
  };
  adjunctsAtArrival?: AdjunctsAtArrival | string | null;
  presentingComplaint: string;
  courseInERDayWise?: DayWiseCourse[];
  activeProblemList?: ActiveProblem[];
  story?: string;
  pmh: string | null;
  pastMedicalHistory?: string | null;
  diagnosis: string;
  crossConsultations?: CrossConsultation[];
  investigations?: InvestigationsGroup;
  currentMedications?: string[];
  adjuncts?: AdjunctsDevices;
  adjunctsNow?: AdjunctsDevices | null;
  managementPlan?: {
    done: string[];
    pending: string[];
  };
  done: string[];
  toBeDone: string[];
  erBoardingStatus?: ERBoardingStatus;
  bystanderConsent?: string | null;
  latestVitals?: LatestVitalsInfo;
  vitalsNow: string | null;
  criticalAlerts: string[];
  bystander: string | null;
  alertRow: string;
}

export interface QuickPastePatient {
  id: string;
  bed?: string;
  name: string;
  ageGender: string;
  triage: string;
  vitals: string;
  presentingComplaint?: string;
  rawNotes: string;
  structuredSBAR?: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  };
  handoverCardData?: HandoverPatient;
  hospital?: string;
  createdByEmail?: string;
  updatedAt?: string;
}


