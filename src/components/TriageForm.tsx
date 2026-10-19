import React, { useState, useEffect } from "react";
import { ArrowLeft, User, Heart, ShieldAlert, ChevronRight, Scale, Clock, Phone, Hash, FileText, Check, BrainCircuit, AlertTriangle } from "lucide-react";
import { TriageLevel, TriageScreening, ArrivalMode, PatientDemographics, PatientVitals, MlcDetails, ClinicalCase } from "../types";
import VoiceRecorder from "./shared/VoiceRecorder";
import { classifyEmergencyTriage } from "../utils/triageClassifier";
import { TRIAGE_LEVELS, TRIAGE_LEVEL_LIST, levelToLegacyCategory, triageBadgeClass } from "../utils/triageScale";
import { allocateOrValidateBed } from "../utils/bedAllocation";
import BedPicker from "./shared/BedPicker";
import PediatricNormalVitalsCard from "./PediatricNormalVitalsCard";
import TriageScreeningFields from "./TriageScreeningFields";
import { normalizeScreening } from "../utils/triageScreening";
import { parseTriageDictation, type TriageDictationResult } from "../utils/triageDictation";
import { formatAge, getAgeStage } from "../utils/ageLabel";

interface TriageFormProps {
  onBack: () => void;
  onSubmit: (demographics: PatientDemographics, vitals: PatientVitals, bedNo?: string, options?: { queueForDoctor?: boolean }) => void;
  /** Hospital team members only: lets a triage desk hand the patient to the waiting queue instead of treating. */
  canQueueForDoctor?: boolean;
  initialMode: "full" | "quick";
  activeCases?: ClinicalCase[];
  physicalBedCapacity?: number;
}

export default function TriageForm({ onBack, onSubmit, initialMode, activeCases = [], physicalBedCapacity = 30, canQueueForDoctor = false }: TriageFormProps) {
  // Demographic State
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState("Male");
  const [presentingComplaint, setPresentingComplaint] = useState("");
  const [triageLevel, setTriageLevel] = useState<TriageLevel>(3);
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode>(ArrivalMode.WalkIn);
  const [bedNo, setBedNo] = useState("");
  const [bedError, setBedError] = useState<string | null>(null);
  
  // NABH / JCI Specific Demographics
  const [uhid, setUhid] = useState("");
  const [phone, setPhone] = useState("");
  const [caseType, setCaseType] = useState<"Medical" | "Trauma">("Medical");
  const [isMlc, setIsMlc] = useState(false);

  // MLC Details
  const [natureOfIncident, setNatureOfIncident] = useState("");
  const [dateTimeOfIncident, setDateTimeOfIncident] = useState("");
  const [placeOfIncident, setPlaceOfIncident] = useState("");
  const [identificationMark, setIdentificationMark] = useState("");
  const [informantBroughtBy, setInformantBroughtBy] = useState("Self");
  const [policeStation, setPoliceStation] = useState("");
  const [policeIntimationTime, setPoliceIntimationTime] = useState("");
  const [ddEntryNo, setDdEntryNo] = useState("");

  // Vitals State
  const [bp, setBp] = useState("");
  const [hr, setHr] = useState("");
  const [spo2, setSpo2] = useState("");
  const [rr, setRr] = useState("");
  const [temp, setTemp] = useState("");
  const [grbs, setGrbs] = useState("");
  const [painScore, setPainScore] = useState("");
  const [weight, setWeight] = useState("");

  // GCS Subscales
  const [gcsE, setGcsE] = useState("");
  const [gcsV, setGcsV] = useState("");
  const [gcsM, setGcsM] = useState("");

  const [autoTriageEnabled, setAutoTriageEnabled] = useState(true);

  // Age units and subdivisions (years | months | days)
  const [ageUnit, setAgeUnit] = useState<"years" | "months" | "days">("years");
  const [ageMonthsStr, setAgeMonthsStr] = useState("");
  const [ageDaysStr, setAgeDaysStr] = useState("");
  const [screening, setScreening] = useState<TriageScreening>({});
  const [queueForDoctor, setQueueForDoctor] = useState(false);
  const [dictationFilled, setDictationFilled] = useState<string[] | null>(null);

  // Fill from ONE spoken triage dictation. Existing entries win; nothing unspoken is invented.
  const applyDictation = (transcript: string) => {
    const r: TriageDictationResult = parseTriageDictation(transcript);
    if (r.filled.length === 0) { setDictationFilled([]); return; }
    if (r.name && !name.trim()) setName(r.name);
    if (r.ageUnit) setAgeUnit(r.ageUnit);
    if (r.ageDays !== undefined && ageDaysStr === "") setAgeDaysStr(String(r.ageDays));
    if (r.ageMonths !== undefined && ageMonthsStr === "") setAgeMonthsStr(String(r.ageMonths));
    if (r.age !== undefined && age === "") {
      if (r.ageUnit === "days" && r.ageDays !== undefined) {
        setAge(String(r.ageDays));
      } else if (r.ageUnit === "months" && r.ageMonths !== undefined) {
        setAge(String(r.ageMonths));
      } else {
        setAge(String(r.age));
      }
    }
    if (r.gender && gender === "Male" && r.gender === "Female") setGender("Female");
    if (r.complaint) setPresentingComplaint((prev) => (prev.trim() ? `${prev.trim()}; ${r.complaint}` : r.complaint!));
    if (r.vitals.bp && !bp) setBp(r.vitals.bp);
    if (r.vitals.hr && !hr) setHr(r.vitals.hr);
    if (r.vitals.spo2 && !spo2) setSpo2(r.vitals.spo2);
    if (r.vitals.rr && !rr) setRr(r.vitals.rr);
    if (r.vitals.temp && !temp) setTemp(r.vitals.temp);
    if (r.vitals.grbs && !grbs) setGrbs(r.vitals.grbs);
    if (r.vitals.painScore && !painScore) setPainScore(r.vitals.painScore);
    if (r.weight && !weight) setWeight(r.weight);
    if (r.arrivalMode) setArrivalMode(r.arrivalMode as ArrivalMode);
    if (r.isMlc) setIsMlc(true);
    setScreening((prev) => ({ ...r.screening, ...prev }));
    setDictationFilled(r.filled);
  };

  // Logic: compute normalized age in years, extra months, and neonatal days
  let ageNum: number | null = null;
  let ageMonthsNum: number | null = null;
  let ageDaysNum: number | null = null;

  if (ageUnit === "years") {
    ageNum = age !== "" && !isNaN(Number(age)) ? parseInt(age, 10) : null;
    const needsMonths = ageNum !== null && ageNum >= 0 && ageNum <= 1;
    ageMonthsNum = needsMonths && ageMonthsStr !== "" ? parseFloat(ageMonthsStr) : null;
    ageDaysNum = ageDaysStr !== "" ? parseInt(ageDaysStr, 10) : null;
  } else if (ageUnit === "months") {
    const mVal = age !== "" && !isNaN(Number(age)) ? parseFloat(age) : null;
    if (mVal !== null) {
      if (mVal >= 12) {
        ageNum = Math.floor(mVal / 12);
        ageMonthsNum = mVal % 12 || null;
      } else {
        ageNum = 0;
        ageMonthsNum = mVal;
      }
    }
    ageDaysNum = null;
  } else if (ageUnit === "days") {
    const dVal = age !== "" && !isNaN(Number(age)) ? parseInt(age, 10) : null;
    if (dVal !== null) {
      ageNum = 0;
      ageMonthsNum = 0.5;
      ageDaysNum = dVal;
    }
  }

  const isPediatric = ageNum !== null && ageNum <= 16;
  const needsMonths = ageUnit === "years" && ageNum !== null && ageNum >= 0 && ageNum <= 1;

  // Calculate composite GCS
  const hasCompleteGcs = gcsE !== "" && gcsV !== "" && gcsM !== "";
  const calculatedGcs = hasCompleteGcs
    ? String(Number(gcsE) + Number(gcsV) + Number(gcsM))
    : "";

  // Live auto triage evaluation
  const currentVitalsObj: PatientVitals = {
    bp: bp || "",
    hr: hr || "",
    spo2: spo2 || "",
    rr: rr || "",
    temp: temp || "",
    gcs: calculatedGcs,
    gcs_e: gcsE,
    gcs_v: gcsV,
    gcs_m: gcsM,
    grbs: grbs || "",
    avpu: "",
    painScore: painScore
  };

  const autoTriageResult = classifyEmergencyTriage(ageNum, presentingComplaint, currentVitalsObj, ageMonthsNum);

  // Sync triage selection if auto-triage is enabled
  useEffect(() => {
    if (autoTriageEnabled && autoTriageResult) {
      setTriageLevel(autoTriageResult.level);
    }
  }, [autoTriageEnabled, autoTriageResult.level]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = name.trim() || "Emergency Patient";
    const finalComplaint = presentingComplaint.trim() || "Unspecified Presentation";

    const mlcData: MlcDetails = {
      natureOfIncident: isMlc ? natureOfIncident : "",
      dateTimeOfIncident: isMlc ? dateTimeOfIncident : "",
      placeOfIncident: isMlc ? placeOfIncident : "",
      identificationMark: isMlc ? identificationMark : "",
      informantBroughtBy: isMlc ? informantBroughtBy : "",
      policeStation: isMlc ? policeStation : "",
      policeIntimationTime: isMlc ? policeIntimationTime : "",
      ddEntryNo: isMlc ? ddEntryNo : ""
    };

    const demographics: PatientDemographics = {
      name: finalName,
      age: ageNum,
      gender,
      presentingComplaint: finalComplaint,
      triageCategory: levelToLegacyCategory(triageLevel),
      triageLevel,
      ...(ageMonthsNum !== null && !isNaN(ageMonthsNum) ? { ageMonths: ageMonthsNum } : {}),
      ...(ageDaysNum !== null && !isNaN(ageDaysNum) ? { ageDays: ageDaysNum } : {}),
      ageUnit,
      ...(() => {
        const ts = normalizeScreening({
          ...screening,
          completedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " | " + new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
        });
        // a record holding only the auto timestamp carries no assessment
        const meaningful = ts && Object.keys(ts).some((k) => k !== "completedAt");
        return meaningful ? { triageScreening: ts } : {};
      })(),
      arrivalMode,
      dateOpened: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
      uhid: uhid || "",
      phone: phone || "",
      ...(weight.trim() ? { weight: weight.trim() } : {}),
      isMlc,
      caseType,
      ...(isMlc ? { mlcDetails: mlcData } : {})
    };

    const vitals: PatientVitals = {
      bp: bp || "",
      hr: hr || "",
      spo2: spo2 || "",
      rr: rr || "",
      temp: temp || "",
      gcs: calculatedGcs,
      gcs_e: gcsE,
      gcs_v: gcsV,
      gcs_m: gcsM,
      grbs: grbs || "",
      avpu: "",
      painScore: painScore,
      ...(weight.trim() ? { weight: weight.trim() } : {})
    };

    let finalBedNo: string | undefined = undefined;
    if (bedNo.trim()) {
      const allocation = allocateOrValidateBed(
        bedNo.trim(),
        activeCases || [],
        physicalBedCapacity || 30
      );
      if (!allocation.success || !allocation.canonicalBed) {
        setBedError(allocation.error || "Invalid bed number or bed already occupied.");
        return;
      }
      finalBedNo = allocation.canonicalBed;
    }

    onSubmit(demographics, vitals, finalBedNo, canQueueForDoctor && queueForDoctor ? { queueForDoctor: true } : undefined);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="triage-form-container">
      {/* Header */}
      <div className="sticky top-[var(--ermate-header-height,50px)] z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md -mx-4 px-4 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-4 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] -ml-1 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold font-display text-slate-900 dark:text-white truncate">
              {initialMode === "quick" ? "Quick Case Registration" : "Standard Triage Registration"}
            </h1>
            <p className="text-[11px] text-slate-400 truncate hidden xs:block">
              {initialMode === "quick" 
                ? "Bypass complete triage inputs for critical patients" 
                : "Register full patient demographics, identifiers, and baseline vitals"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">CASE TYPE:</span>
          <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCaseType("Medical")}
              className={`text-xs px-3 py-1 rounded-md font-bold transition-all ${
                caseType === "Medical"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              Medical
            </button>
            <button
              type="button"
              onClick={() => setCaseType("Trauma")}
              className={`text-xs px-3 py-1 rounded-md font-bold transition-all ${
                caseType === "Trauma"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              Trauma
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Dictate the whole triage once; fields fill for the nurse to confirm */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 flex items-center justify-between gap-3" data-testid="triage-dictation">
          <div className="text-xs text-indigo-900 dark:text-indigo-200">
            <div className="font-bold">Dictate triage</div>
            <div className="text-[11px] opacity-80">e.g. “Name is Ramesh, 45 male, chest pain, BP 150 over 90, pulse 110, came by ambulance, no travel history”</div>
          </div>
          <VoiceRecorder renderMode="compact-button" onTranscript={applyDictation} />
        </div>
        {dictationFilled !== null && (
          <div role="status" data-testid="dictation-result" className={`rounded-lg px-3 py-2 text-xs ${dictationFilled.length ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-amber-50 text-amber-900 border border-amber-200"}`}>
            {dictationFilled.length
              ? <>Filled from dictation: <b>{dictationFilled.join(", ")}</b>. Please confirm before saving; anything not said is left blank.</>
              : <>Nothing recognised in that dictation — please say it again or type.</>}
          </div>
        )}
        {/* Core Demographics Card */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2">
            <User className="w-4 h-4 text-blue-500" />
            1. Patient Demographics & Hospital Identifiers
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>Patient Name <span className="text-rose-500">*</span></span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Full name (e.g. Robert Miller)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
                <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setName(prev => prev ? `${prev} ${txt}` : txt)} />
              </div>
            </div>

            {/* Age */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Age
                </label>
                <div className="inline-flex rounded-md shadow-xs bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 text-[10px]">
                  {(["years", "months", "days"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      data-testid={`triage-age-unit-${u}`}
                      onClick={() => setAgeUnit(u)}
                      className={`px-1.5 py-0.5 rounded capitalize font-medium transition-colors ${
                        ageUnit === u
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min="0"
                placeholder={ageUnit === "years" ? "Age in years" : ageUnit === "months" ? "Age in months (1-36)" : "Age in days (0-90)"}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              />
              {needsMonths && (
                <select
                  aria-label="Age in months"
                  data-testid="age-months"
                  value={ageMonthsStr}
                  onChange={(e) => setAgeMonthsStr(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">{ageNum === 0 ? "Months old? (needed for infants)" : "Extra months (optional)"}</option>
                  <option value="0.5">Under 1 month</option>
                  {Array.from({ length: 11 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>
                  ))}
                </select>
              )}
              {ageNum !== null && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Stage: <strong className="text-slate-700 dark:text-slate-200">{getAgeStage(ageNum, ageMonthsNum, ageDaysNum).label}</strong></span>
                  <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{formatAge(ageNum, ageMonthsNum, ageDaysNum)}</span>
                </div>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Gender
              </label>
              <div className="grid grid-cols-3 gap-1">
                {["Male", "Female", "Other"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`text-xs py-2 rounded-lg border transition-all font-semibold ${
                      gender === g
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {g.substring(0, 1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            {/* UHID (JCI Identifier standard) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                UHID / Reg No
              </label>
              <input
                type="text"
                placeholder="e.g. UHID-1094158"
                value={uhid}
                onChange={(e) => setUhid(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Phone */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Contact Phone
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 94471 23456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Patient Weight (kg) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                Weight (kg)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={ageNum !== null && ageNum <= 16 ? "e.g. 15" : "e.g. 70"}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* ER Bed / Location (Optional) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  ER Bed (Optional)
                </span>
                <span className="text-[10px] text-slate-400 font-normal">tap to choose</span>
              </label>
              <BedPicker
                value={bedNo}
                onChange={(v) => {
                  setBedNo(v);
                  setBedError(null);
                }}
                activeCases={activeCases}
                capacity={physicalBedCapacity || 30}
                hasError={Boolean(bedError)}
              />
              {bedError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {bedError}
                </p>
              )}
            </div>
          </div>

          {/* Pediatric Mode Trigger Alert */}
          {isPediatric && (
            <div className="bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-850 p-4 rounded-lg text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-sky-500 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <span className="font-bold">Pediatric PALS Mode Activated:</span> Patients 16 or under automatically utilize pediatric-adjusted vital alerts and weight-based drug calculation screens.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Triage Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>Triage Category</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                  <BrainCircuit className="w-3 h-3 animate-pulse" /> Auto-Triage Active
                </span>
              </label>
              <select
                value={triageLevel}
                onChange={(e) => {
                  setTriageLevel(Number(e.target.value) as TriageLevel);
                  setAutoTriageEnabled(false); // User override disables auto sync
                }}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                  autoTriageEnabled 
                    ? "bg-purple-50/40 dark:bg-purple-950/20 border-purple-300 dark:border-purple-900" 
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                }`}
              >
                {TRIAGE_LEVEL_LIST.map((t) => (
                  <option key={t.level} value={t.level}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Arrival Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Arrival Mode
              </label>
              <select
                value={arrivalMode}
                onChange={(e) => setArrivalMode(e.target.value as ArrivalMode)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              >
                <option value={ArrivalMode.WalkIn}>Walk-in</option>
                <option value={ArrivalMode.Ambulance}>Ambulance</option>
                <option value={ArrivalMode.Referred}>Referred</option>
              </select>
            </div>
          </div>

          {/* AI Auto-Triage Protocol Overlay */}
          <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-slate-900/10 border border-purple-500/20 dark:border-purple-500/10 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-purple-500" />
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-purple-300 uppercase tracking-wide">
                  Clinical Protocol Auto-Triage
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoTriageEnabled(!autoTriageEnabled)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                  autoTriageEnabled
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800"
                }`}
              >
                {autoTriageEnabled ? (
                  <>
                    <Check className="w-3 h-3" /> Auto-Sync Locked
                  </>
                ) : (
                  "Enable Auto-Sync"
                )}
              </button>
            </div>

            {presentingComplaint.trim() ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider ${
                    triageBadgeClass(TRIAGE_LEVELS[autoTriageResult.level].tone, "solid-soft")
                  }`}>
                    Detected: {TRIAGE_LEVELS[autoTriageResult.level].label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    (Mode: {isPediatric ? "Pediatric PALS" : "Adult Triage Protocol"})
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed font-mono bg-white/40 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 rounded p-2">
                  ℹ️ {autoTriageResult.reason}
                </p>
                {autoTriageResult.reasons.length > 1 && (
                  <ul className="text-[10px] text-slate-500 dark:text-slate-400 font-mono space-y-0.5 pl-1">
                    {autoTriageResult.reasons.slice(1, 5).map((r) => (<li key={r}>• {r}</li>))}
                  </ul>
                )}
                {autoTriageResult.needsClinician && (
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Nothing on the triage chart matched — please choose the priority yourself.</p>
                )}
              </div>
            ) : (
              <p className="text-[10.5px] text-slate-400 italic">
                Waiting for Presenting Chief Complaint or vitals to run real-time clinical protocol matching...
              </p>
            )}
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
              <span>Presenting Chief Complaint <span className="text-rose-500">*</span></span>
            </label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                placeholder="State key symptoms, onset details, or injury mechanism (e.g. Chest pain for 2 hours, radiating to left arm)"
                value={presentingComplaint}
                onChange={(e) => setPresentingComplaint(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
              />
              <VoiceRecorder renderMode="compact-button" onTranscript={(txt) => setPresentingComplaint(prev => prev ? `${prev} ${txt}` : txt)} />
            </div>
          </div>

          {/* Medico-Legal Case (MLC) Toggle */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase">Medico-Legal Case (MLC)?</h4>
              <p className="text-[10px] text-slate-400">Check this if presentation is due to road accident, assault, self-harm, etc.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMlc(!isMlc)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isMlc ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isMlc ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Collapsible MLC Registration Card */}
          {isMlc && (
            <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900 rounded-xl p-4 md:p-5 space-y-3.5 text-xs animate-fade-in">
              <div className="flex items-center gap-1.5 border-b border-amber-200/50 dark:border-amber-900 pb-2">
                <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                <h4 className="font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                  Medico-Legal Incident Documentation Panel
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Nature of Incident
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RTA (Road Traffic Accident), Physical Assault"
                    value={natureOfIncident}
                    onChange={(e) => setNatureOfIncident(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-100 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Date & Time of Incident
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 11/07/2026, 09:30 PM"
                    value={dateTimeOfIncident}
                    onChange={(e) => setDateTimeOfIncident(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Place / Location of Incident
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. National Highway 47, near the hospital"
                    value={placeOfIncident}
                    onChange={(e) => setPlaceOfIncident(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Brought By / Informant
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Self, Ambulance Driver, Bystander"
                    value={informantBroughtBy}
                    onChange={(e) => setInformantBroughtBy(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1.5 border-t border-amber-200/40">
                <div>
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Jurisdiction Police Station
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ernakulam Town South PS"
                    value={policeStation}
                    onChange={(e) => setPoliceStation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Police Intimation Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 11:15 PM"
                    value={policeIntimationTime}
                    onChange={(e) => setPoliceIntimationTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Station DD Entry / General Diary No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GD-58B"
                    value={ddEntryNo}
                    onChange={(e) => setDdEntryNo(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                  Visible Identification Mark
                </label>
                <input
                  type="text"
                  placeholder="e.g. A linear black mole on the lateral aspect of left arm 5cm above elbow"
                  value={identificationMark}
                  onChange={(e) => setIdentificationMark(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 rounded-lg focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Paediatric normal vitals (reference) — appears as soon as an age <= 16 is entered */}
        {isPediatric && (
          <PediatricNormalVitalsCard
            ageYears={ageNum}
            ageMonths={ageMonthsNum}
            ageDays={ageDaysNum}
            hr={hr}
            rr={rr}
            sbp={bp.split("/")[0]}
            spo2={spo2}
            tempF={temp}
          />
        )}

        {/* Triage assessment & communicable-disease screening (quick and full) */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Triage Assessment & Infection Screening
          </h3>
          <TriageScreeningFields value={screening} onChange={setScreening} idPrefix="tf" />
        </div>

        {/* Triage Vitals Card */}
        {initialMode === "full" && (
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2">
              <Heart className="w-4 h-4 text-rose-500" />
              2. Baseline Triage Vitals & Scorecards
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {/* BP */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  BP (mmHg)
                </label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* HR */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  HR (bpm)
                </label>
                <input
                  type="number"
                  placeholder="80"
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* SpO2 */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  placeholder="98"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* RR */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  RR (/min)
                </label>
                <input
                  type="number"
                  placeholder="16"
                  value={rr}
                  onChange={(e) => setRr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Temp */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Temp (°F)
                </label>
                <input
                  type="text"
                  placeholder="98.6"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-900">
              {/* GCS Subscale Selectors (JCI/NABH Neurological assessment) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Glasgow Coma Scale (Current Composite: <strong className="text-blue-600 dark:text-blue-400 font-mono">{calculatedGcs ? `${calculatedGcs}/15` : "Not entered"}</strong>)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Eye Opening (E)</span>
                    <select
                      value={gcsE}
                      onChange={(e) => setGcsE(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    >
                      <option value="">Select</option>
                      <option value="4">4 - Spontaneous</option>
                      <option value="3">3 - To Speech</option>
                      <option value="2">2 - To Pain</option>
                      <option value="1">1 - None</option>
                    </select>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Verbal (V)</span>
                    <select
                      value={gcsV}
                      onChange={(e) => setGcsV(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    >
                      <option value="">Select</option>
                      <option value="5">5 - Oriented</option>
                      <option value="4">4 - Confused</option>
                      <option value="3">3 - Inappropriate</option>
                      <option value="2">2 - Incomprehensible</option>
                      <option value="1">1 - None</option>
                    </select>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Motor (M)</span>
                    <select
                      value={gcsM}
                      onChange={(e) => setGcsM(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    >
                      <option value="">Select</option>
                      <option value="6">6 - Obeys commands</option>
                      <option value="5">5 - Localizes pain</option>
                      <option value="4">4 - Withdraws (flexion)</option>
                      <option value="3">3 - Abnormal flexion</option>
                      <option value="2">2 - Extension</option>
                      <option value="1">1 - None</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Extra Vitals: GRBS & Pain Score */}
              <div className="grid grid-cols-2 gap-3">
                {/* GRBS */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    GRBS (Blood Sugar)
                  </label>
                  <input
                    type="number"
                    placeholder="mg/dL"
                    value={grbs}
                    onChange={(e) => setGrbs(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:ring-1"
                  />
                </div>

                {/* Pain Score slider (NABH Mandated 5th Vital sign) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Pain Scale: <strong className="text-rose-500 font-mono">{painScore !== "" ? `${painScore}/10` : "Not entered"}</strong>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPainScore("0")}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                          painScore === "0"
                            ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        No pain (0)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPainScore("")}
                        disabled={painScore === ""}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                          painScore === ""
                            ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400"
                            : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="pt-2">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={painScore === "" ? "0" : painScore}
                      onChange={(e) => setPainScore(e.target.value)}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                      <span>0 - No Pain</span>
                      <span>5 - Moderate</span>
                      <span>10 - Severe</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {canQueueForDoctor && (
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-700 dark:text-slate-200 cursor-pointer" data-testid="queue-toggle">
            <input type="checkbox" checked={queueForDoctor} onChange={(e) => setQueueForDoctor(e.target.checked)} className="mt-0.5" />
            <span><b>Send to waiting queue</b> — I am not the treating doctor. A doctor will take this patient from the queue.</span>
          </label>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
          >
            Create Clinical Case Sheet
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
