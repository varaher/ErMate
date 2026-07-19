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
}

export interface PatientDemographics {
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
}

export interface DischargeInfo {
  primaryDiagnosis: string;
  secondaryDiagnosis: string;
  conditionAtDischarge: string;
  dischargeMedications: string;
  followUpPlan: string;
  patientInstructions: string;
  aiDrafted?: boolean;
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
  consentTimeOut?: ConsentTimeOut;
  dispositionDetails?: DispositionDetails;
  vitalsHistory?: VitalsRecord[];
  
  // Advanced features from UI screenshots
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
}

export interface PediatricDetails {
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
  emResident?: string;
  emConsultant?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  hospital: string;
  aiCredits: number;
  streak: number;
  subscriptionTier: string;
  age?: number;
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

