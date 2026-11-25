import { restoreDayMarkersDeep } from "../mate/dayplaceholder";
import { generateUHID } from "../utils/caseHelper";
import React, { useState, useRef, useEffect } from "react";
import { Mic, Camera, FileText, Loader2, ArrowRight } from "lucide-react";
import { ClinicalCase, TriageCategory, ArrivalMode } from "../types";
import VoiceRecorder from "./shared/VoiceRecorder";
import { generateInternalCaseId } from "../utils/caseIdentity";
import { authenticatedFetch } from "../services/authenticatedFetch";
import { setCriticalFlag } from "../utils/criticalOps";
import { buildQuickCaseFieldsFromSheet } from "../mate/quicksheetcase";

/** Longest outside record accepted in one import (about 10,000 words). */
export const MAX_IMPORT_CHARS = 60000;

/**
 * QuickDischargeIntake.tsx
 *
 * Standalone entry point for doctors who ONLY want a fast discharge
 * summary — no case documentation, no 11-tab Case Sheet. Three input
 * methods (paste / voice / photo) all converge into a minimal
 * ClinicalCase, which is then handed to the EXISTING, already-hardened
 * DischargeSummaryView.tsx for the actual AI draft + rendering.
 *
 * DESIGN PRINCIPLE: this component does NOT duplicate any discharge
 * formatting, fallback text, or model-calling logic. It only handles
 * intake and produces a valid minimal ClinicalCase. Everything after
 * that point — AI drafting, zero-fabrication rendering, print/copy —
 * reuses DischargeSummaryView.tsx unchanged, so today's hardening
 * work (no fabricated vitals, no fabricated exam findings, disposition-
 * gated auto-sync, ErMate -> GPT-4o -> deterministic backup)
 * automatically applies here with zero duplicated risk.
 *
 * ALWAYS FREE: like the Handover feature, Quick Discharge must NOT be
 * gated behind AI credits. Every fetch call below passes
 * `bypassCreditCheck: true` in the request body.
 */

type InputMode = "paste" | "voice" | "photo";
type IntakeStatus = "idle" | "processing" | "error";

interface Props {
  currentUserEmail: string;
  currentUserName: string;
  hospitalName: string;
  onCaseReady: (minimalCase: ClinicalCase) => void;
  onCancel: () => void;
  /** A case sheet already pasted on the home screen: read it straight away. */
  initialText?: string;
}

const toClinicalString = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
};

export function createQuickDischargeCase(
  extractedFields: Partial<ClinicalCase>,
  createdByEmail: string,
  hospital: string
): ClinicalCase {
  const now = new Date().toISOString();
  const age = extractedFields.patient?.age ?? null;

  return {
    id: generateInternalCaseId(),
    displayId: extractedFields.displayId || undefined,
    quickDischargeAt: now,
    status: "Active",
    savedTime: now,
    timeSpentMin: 0,
    isPediatric: age !== null && age <= 16,
    patient: {
      name: "Unassigned Patient",
      age: null,
      gender: "Male",
      uhid: generateUHID(),
      presentingComplaint: "Quick discharge intake",
      triageCategory: TriageCategory.P2,
      arrivalMode: ArrivalMode.WalkIn,
      dateOpened: now,
      isMlc: false as any,
      caseType: "Medical",
      ...extractedFields.patient,
    },
    vitals: {
      // Rule 8: nothing recorded = empty. No placeholder numbers, no assumed normal GCS/AVPU/pain.
      bp: "Not recorded",
      hr: "",
      spo2: "",
      rr: "",
      temp: "",
      gcs: "",
      gcs_e: "",
      gcs_v: "",
      gcs_m: "",
      grbs: "",
      avpu: "",
      painScore: "",
      ...extractedFields.vitals,
    },
    sampleHistory: {
      symptoms: "",
      allergies: "Not documented",
      medications: "Not documented",
      pastHistory: "Not documented",
      lastMeal: "Not documented",
      events: "",
      socialHistory: "Not documented",
      familyHistory: "Not documented",
      psychiatricFlags: "None",
      ...extractedFields.sampleHistory,
    },
    primaryAssessment: {
      airway: "Not documented",
      airwayStatus: "",
      breathing: "Not documented",
      breathingStatus: "",
      circulation: "Not documented",
      circulationStatus: "",
      disability: "Not documented",
      disabilityStatus: "",
      exposure: "Not documented",
      exposureStatus: "",
      ...extractedFields.primaryAssessment,
    },
    secondaryAssessment: extractedFields.secondaryAssessment || "",
    investigations: extractedFields.investigations || [],
    treatments: extractedFields.treatments || [],
    differentials: extractedFields.differentials || [],
    progressNotes: extractedFields.progressNotes || "",
    dischargeInfo: null,

    // Audit / governance metadata — required for the unified NABH
    // registry per the earlier architecture decision
    createdByEmail: createdByEmail,
    hospital: hospital,
    createdAt: now,
    entrySource: "quick_discharge", // Tag distinguishing quick-entry cases in the registry
  } as ClinicalCase;
}

export default function QuickDischargeIntake({
  currentUserEmail,
  currentUserName,
  hospitalName,
  onCaseReady,
  onCancel,
  initialText,
}: Props) {
  const [mode, setMode] = useState<InputMode>("paste");
  const [pastedText, setPastedText] = useState("");
  const [status, setStatus] = useState<IntakeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hard Refresh safety: this screen has its own recorder + upload (read-only signal).
  useEffect(() => {
    setCriticalFlag(
      "quickDischargeIntake",
      isRecordingVoice ? "A discharge dictation is being recorded." : "Discharge details are still being read.",
      isRecordingVoice || status === "processing"
    );
    return () => setCriticalFlag("quickDischargeIntake", "", false);
  }, [isRecordingVoice, status]);

  // Take raw extracted text -> structured fields -> minimal case -> handoff
  const finalizeAndHandOff = async (rawText: string, keepSource: boolean = false) => {
    if (!rawText.trim()) {
      setError("No content to process. Please paste text, dictate, or capture a photo.");
      setStatus("error");
      return;
    }

       if (keepSource && rawText.length > MAX_IMPORT_CHARS) {
      setError(
        `This clinical record exceeds the current ${MAX_IMPORT_CHARS.toLocaleString("en-US")}-character ` +
        "import limit. No content has been discarded. " +
        "Please divide the document into sections before importing."
      );
      setStatus("error");
      return;
    }

    setStatus("processing");
    setError(null);

    try {
      const response = await authenticatedFetch("/api/scribe-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dictation: rawText,
          transcript: rawText,
          userEmail: currentUserEmail,
          bypassCreditCheck: true,
        }),
      });

          if (!response.ok) {
        throw new Error(
          `Clinical extraction failed (HTTP ${response.status}).`
        );
      }

      const resData = await response.json();

      if (!resData.success && !resData.data && !resData.extracted) {
        throw new Error(resData.error || "Extraction failed.");
      }

      // The privacy step swaps dates for "[Day N]" before the AI sees the text: put the real dates back.
      const ext = restoreDayMarkersDeep(resData.data || resData.extracted || {}, rawText);

      const sheet = keepSource
        ? buildQuickCaseFieldsFromSheet(rawText)
        : null;

      const sv = sheet?.found ? sheet : null;
  
      const extractedCaseData: Partial<ClinicalCase> = {
        patient: {
          name: ext.patientName || "Unassigned Patient",
          age: sv?.patient.age ?? ext.age ?? null,
          gender: sv?.patient.gender || ext.gender || "Unknown",
          uhid: generateUHID(),
          presentingComplaint:
            sv?.patient.presentingComplaint ||
            ext.presentingComplaint ||
            ext.chiefComplaint ||
            "Not documented",
          triageCategory: TriageCategory.P2,
          arrivalMode: ArrivalMode.WalkIn,
          dateOpened: new Date().toISOString(),
          isMlc: false as any,
          caseType: "Medical",
        },

        vitals: {
          bp: toClinicalString(sv?.vitals.bp ?? ext.vitals?.bp),
          hr: toClinicalString(sv?.vitals.hr ?? ext.vitals?.hr),
          spo2: toClinicalString(sv?.vitals.spo2 ?? ext.vitals?.spo2),
          rr: toClinicalString(sv?.vitals.rr ?? ext.vitals?.rr),
          temp: toClinicalString(sv?.vitals.temp ?? ext.vitals?.temp),
          gcs: toClinicalString(sv?.vitals.gcs ?? ext.vitals?.gcs),
          gcs_e: toClinicalString(
            sv?.vitals.gcs_e ?? ext.vitals?.gcs_e ?? ext.vitals?.gcsE
          ),
          gcs_v: toClinicalString(
            sv?.vitals.gcs_v ?? ext.vitals?.gcs_v ?? ext.vitals?.gcsV
          ),
          gcs_m: toClinicalString(
            sv?.vitals.gcs_m ?? ext.vitals?.gcs_m ?? ext.vitals?.gcsM
          ),
          grbs: toClinicalString(sv?.vitals.grbs ?? ext.vitals?.grbs),
          avpu: toClinicalString(ext.vitals?.avpu),
          painScore: toClinicalString(ext.vitals?.painScore),
        },

        sampleHistory: {
          symptoms:
            sv?.sampleHistory.symptoms ||
            ext.sampleHistory?.symptoms ||
            "",
          allergies:
            sv?.sampleHistory.allergies ||
            ext.sampleHistory?.allergies ||
            "Not documented",
          medications:
            ext.sampleHistory?.medications || "Not documented",
          pastHistory:
            sv?.sampleHistory.pastHistory ||
            ext.sampleHistory?.pastHistory ||
            "Not documented",
          lastMeal: ext.sampleHistory?.lastMeal || "Not documented",
          events: ext.sampleHistory?.events || "",
          socialHistory: "Not documented",
          familyHistory:
            sv?.sampleHistory.familyHistory || "Not documented",
          psychiatricFlags: "Not documented",
          ...(sv?.sampleHistory.hpi
            ? { hpi: sv.sampleHistory.hpi }
            : {}),
          ...(sv?.sampleHistory.surgicalHistory
            ? { surgicalHistory: sv.sampleHistory.surgicalHistory }
            : {}),
        } as any,

        primaryAssessment: {
          airway: "Not documented",
          breathing: "Not documented",
          circulation: "Not documented",
          disability: "Not documented",
          exposure: "Not documented",
          ...(ext.primaryAssessment || {}),
          ...(sv?.primaryAssessment || {}),
        } as any,

        secondaryAssessment:
          sv?.secondaryAssessment ||
          (typeof ext.secondaryAssessment === "string"
            ? ext.secondaryAssessment
            : ""),

        investigations:
          sv?.investigations.length
            ? sv.investigations
            : ext.investigations || [],

        differentials: sv?.differentialDiagnosis
          ? [{
              diagnosis: sv.differentialDiagnosis,
              status: "POSSIBLE",
              reasoning: "",
              citations: [],
              nextSteps: [],
            }]
          : ext.differentials || [],

        progressNotes: keepSource
          ? `External clinical record — source for review:\n${rawText}`
          : ext.progressNotes || "",
      };


      const minimalCase = createQuickDischargeCase(
        extractedCaseData,
        currentUserEmail,
        hospitalName
      );

      onCaseReady(minimalCase);
    } catch (err: any) {
      console.error("[QuickDischargeIntake] Extraction error:", err);
      setError(err.message || "Failed to process input. Please try again or enter details manually.");
      setStatus("error");
    }
  };

  // Mode: Paste
  const handlePasteSubmit = () => {
    finalizeAndHandOff(pastedText, true);
  };

  // Pasted on the home screen: start reading it as soon as this screen opens.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (initialText && initialText.trim() && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setPastedText(initialText);
      finalizeAndHandOff(initialText, true);
    }
  }, []);

  // Mode: Voice
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
        "audio/wav"
      ];
      let chosenMime = "";
      for (const type of supportedTypes) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
          chosenMime = type;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, chosenMime ? { mimeType: chosenMime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
      audioChunksRef.current = [];

      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (recorder.state !== "inactive") recorder.stop();
        };
      });

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const actualMime = recorder.mimeType || chosenMime || "audio/webm";
        const ext = actualMime.includes("mp4") ? "mp4" : actualMime.includes("aac") ? "aac" : actualMime.includes("ogg") ? "ogg" : actualMime.includes("wav") ? "wav" : "webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        stream.getTracks().forEach((track) => track.stop());

        if (document.visibilityState === "hidden") {
          const resumeTranscribing = () => {
             if (document.visibilityState === "visible") {
                document.removeEventListener("visibilitychange", resumeTranscribing);
                transcribeAndProcess(audioBlob, ext);
             }
          };
          document.addEventListener("visibilitychange", resumeTranscribing);
        } else {
          await transcribeAndProcess(audioBlob, ext);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingVoice(true);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.message === "Permission denied") {
        setError("Microphone access denied. Please click the site settings icon in your browser address bar to allow microphone access.");
      } else {
        setError(err.message || "Microphone access denied or unavailable.");
      }
      setStatus("error");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecordingVoice(false);
  };

  const transcribeAndProcess = async (audioBlob: Blob, ext: string = "webm") => {
    setStatus("processing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, `dictation.${ext}`);
      formData.append("bypassCreditCheck", "true");

      const transcribeRes = await authenticatedFetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      const transcribeData = await transcribeRes.json();

      if (!transcribeData.text && !transcribeData.transcript) {
        throw new Error("Transcription returned no text.");
      }

      const text = transcribeData.text || transcribeData.transcript;
      await finalizeAndHandOff(text);
    } catch (err: any) {
      console.error("[QuickDischargeIntake] Voice transcription error:", err);
      setError(err.message || "Voice transcription failed. Please try pasting text instead.");
      setStatus("error");
    }
  };

  // Mode: Photo
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("processing");
    setError(null);

    try {
      const base64 = await fileToBase64(file);

      const ocrRes = await authenticatedFetch("/api/scribe-ocr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          imageBase64: base64,
          mimeType: file.type,
          bypassCreditCheck: true,
        }),
      });
      const ocrData = await ocrRes.json();

      if (!ocrData.data && !ocrData.success) {
        throw new Error(ocrData.error || "Photo scan failed.");
      }

      if (ocrData.data) {
        const ocr = ocrData.data;
        const extractedCaseData: Partial<ClinicalCase> = {
          patient: {
            name: ocr.patientName || "Unassigned Patient",
            age: typeof ocr.age === "number" ? ocr.age : parseInt(ocr.age, 10) || null,
            gender: ocr.gender || "Male",
            uhid: generateUHID(),
            presentingComplaint: ocr.presentingComplaint || "Quick discharge intake",
            triageCategory: TriageCategory.P2,
            arrivalMode: ArrivalMode.WalkIn,
            dateOpened: new Date().toISOString(),
            isMlc: false as any,
            caseType: "Medical",
          },
          vitals: {
            bp: toClinicalString(ocr.bp),
            hr: toClinicalString(ocr.hr),
            spo2: toClinicalString(ocr.spo2),
            rr: toClinicalString(ocr.rr),
            temp: toClinicalString(ocr.temp),
            gcs: toClinicalString(ocr.gcs),
            gcs_e: toClinicalString(ocr.gcs_e ?? (ocr as any)?.gcsE),
            gcs_v: toClinicalString(ocr.gcs_v ?? (ocr as any)?.gcsV),
            gcs_m: toClinicalString(ocr.gcs_m ?? (ocr as any)?.gcsM),
            grbs: toClinicalString(ocr.grbs),
            avpu: toClinicalString(ocr.avpu),
            painScore: toClinicalString(ocr.painScore),
          },
          sampleHistory: {
            symptoms: ocr.symptoms || ocr.presentingComplaint || "",
            allergies: ocr.allergies || "Not documented",
            medications: ocr.medications || "Not documented",
            pastHistory: ocr.pastHistory || "Not documented",
            lastMeal: ocr.lastMeal || "Not documented",
            events: ocr.events || "",
            socialHistory: "Not documented",
            familyHistory: "Not documented",
            psychiatricFlags: "None",
          },
          primaryAssessment: {
            airway: ocr.airway || "Not documented",
            airwayStatus: "",
            breathing: ocr.breathing || "Not documented",
            breathingStatus: "",
            circulation: ocr.circulation || "Not documented",
            circulationStatus: "",
            disability: ocr.disability || "Not documented",
            disabilityStatus: "",
            exposure: ocr.exposure || "Not documented",
            exposureStatus: "",
          },
          secondaryAssessment: ocr.secondaryAssessment || "",
          progressNotes: ocr.progressNotes || ocr.clinicalNarrative || "",
        };
        const minimalCase = createQuickDischargeCase(
          extractedCaseData,
          currentUserEmail,
          hospitalName
        );
        onCaseReady(minimalCase);
        return;
      }

      const ocrTextSummary = JSON.stringify(ocrData.data || ocrData);
      await finalizeAndHandOff(ocrTextSummary);
    } catch (err: any) {
      console.error("[QuickDischargeIntake] Photo OCR error:", err);
      setError(err.message || "Photo processing failed. Please try pasting text instead.");
      setStatus("error");
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="sticky top-[var(--ermate-header-height,50px)] z-20 bg-slate-950/95 backdrop-blur-md px-4 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between shadow-2xs">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold truncate">Quick Discharge</h1>
          <p className="text-[11px] text-slate-400 truncate hidden xs:block">Paste, dictate, or photograph — no case documentation needed. Always free.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel quick discharge"
          className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 active:scale-95 text-xs font-bold cursor-pointer transition-all flex items-center justify-center select-none"
        >
          Cancel
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 px-4 py-3 border-b border-slate-800">
        {(
          [
            { key: "paste", label: "Paste EMR Text", icon: FileText },
            { key: "voice", label: "Voice Dictation", icon: Mic },
            { key: "photo", label: "Photo Capture", icon: Camera },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              mode === key ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-6">
        {status === "processing" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <p className="text-sm font-semibold">Generating discharge summary...</p>
            <p className="text-xs text-slate-500">This takes a few seconds. You can wait here, or check back — nothing is lost if you navigate away.</p>
          </div>
        ) : (
          <>
            {mode === "paste" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste the patient's EMR record, clinical notes, or case summary here..."
                    className="flex-1 w-full h-64 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                  <div className="flex flex-col gap-2">
                    <VoiceRecorder
                      renderMode="compact-button"
                      onTranscript={(txt) => setPastedText((prev) => (prev ? prev + " " : "") + txt)}
                    />
                  </div>
                </div>
                <button
                  onClick={handlePasteSubmit}
                  disabled={!pastedText.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Generate Discharge Summary <ArrowRight size={16} />
                </button>
              </div>
            )}

            {mode === "voice" && (
              <div className="flex flex-col items-center justify-center min-h-[250px] gap-4 max-w-md mx-auto">
                <VoiceRecorder
                  renderMode="inline-bubble"
                  buttonLabel="Tap to Dictate Discharge Notes"
                  onTranscript={(text) => finalizeAndHandOff(text)}
                  onError={(err) => {
                    setError(err);
                    setStatus("error");
                  }}
                />
              </div>
            )}

            {mode === "photo" && (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Camera size={28} />
                </button>
                <p className="text-sm text-slate-400">Tap to capture a referral letter or handwritten record</p>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-950/40 border border-red-800/50 rounded-xl p-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}