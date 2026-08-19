import React, { useState, useRef } from "react";
import { Mic, Camera, FileText, Loader2, ArrowRight } from "lucide-react";
import { ClinicalCase, TriageCategory, ArrivalMode } from "../types";
import VoiceRecorder from "./shared/VoiceRecorder";

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
}

function createQuickDischargeCase(
  extractedFields: Partial<ClinicalCase>,
  createdByEmail: string,
  hospital: string
): ClinicalCase {
  const now = new Date().toISOString();
  const age = extractedFields.patient?.age ?? 0;

  return {
    id: `CASE-${Date.now()}`,
    status: "Active",
    savedTime: now,
    timeSpentMin: 0,
    isPediatric: age > 0 && age < 16,
    patient: {
      name: "Unassigned Patient",
      age: 0,
      gender: "Male",
      uhid: `UH-${Math.floor(100000 + Math.random() * 900000)}`,
      presentingComplaint: "Quick discharge intake",
      triageCategory: TriageCategory.P2,
      arrivalMode: ArrivalMode.WalkIn,
      dateOpened: now,
      isMlc: false as any,
      caseType: "Medical",
      ...extractedFields.patient,
    },
    vitals: {
      bp: "Not recorded",
      hr: "0",
      spo2: "0",
      rr: "0",
      temp: "0",
      gcs: "15",
      gcs_e: "4",
      gcs_v: "5",
      gcs_m: "6",
      grbs: "0",
      avpu: "Alert",
      painScore: "0",
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
      airwayStatus: "Normal",
      breathing: "Not documented",
      breathingStatus: "Normal",
      circulation: "Not documented",
      circulationStatus: "Normal",
      disability: "Not documented",
      disabilityStatus: "Normal",
      exposure: "Not documented",
      exposureStatus: "Normal",
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
}: Props) {
  const [mode, setMode] = useState<InputMode>("paste");
  const [pastedText, setPastedText] = useState("");
  const [status, setStatus] = useState<IntakeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Take raw extracted text -> structured fields -> minimal case -> handoff
  const finalizeAndHandOff = async (rawText: string) => {
    if (!rawText.trim()) {
      setError("No content to process. Please paste text, dictate, or capture a photo.");
      setStatus("error");
      return;
    }

    setStatus("processing");
    setError(null);

    try {
      const response = await fetch("/api/scribe-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dictation: rawText,
          transcript: rawText,
          userEmail: currentUserEmail,
          bypassCreditCheck: true,
        }),
      });

      const resData = await response.json();
      if (!resData.success && !resData.data) {
        throw new Error(resData.error || "Extraction failed.");
      }

      const ext = resData.data || resData.extracted || {};
      const extractedCaseData: Partial<ClinicalCase> = {
        patient: {
          name: ext.patientName || "Unassigned Patient",
          age: typeof ext.age === "number" ? ext.age : parseInt(ext.age, 10) || 0,
          gender: ext.gender || "Male",
          uhid: `UH-${Math.floor(100000 + Math.random() * 900000)}`,
          presentingComplaint: ext.presentingComplaint || ext.chiefComplaint || "Quick discharge intake",
          triageCategory: TriageCategory.P2,
          arrivalMode: ArrivalMode.WalkIn,
          dateOpened: new Date().toISOString(),
          isMlc: false as any,
          caseType: "Medical",
        },
        vitals: {
          bp: ext.vitals?.bp || "Not recorded",
          hr: String(ext.vitals?.hr || "0"),
          spo2: String(ext.vitals?.spo2 || "0"),
          rr: String(ext.vitals?.rr || "0"),
          temp: String(ext.vitals?.temp || "0"),
          gcs: String(ext.vitals?.gcs || "15"),
          gcs_e: "4",
          gcs_v: "5",
          gcs_m: "6",
          grbs: String(ext.vitals?.grbs || "0"),
          avpu: "Alert",
          painScore: String(ext.vitals?.painScore || "0"),
        },
        sampleHistory: {
          symptoms: ext.sampleHistory?.symptoms || ext.presentingComplaint || "",
          allergies: ext.sampleHistory?.allergies || ext.allergies || "Not documented",
          medications: ext.sampleHistory?.medications || ext.medications || "Not documented",
          pastHistory: ext.sampleHistory?.pastHistory || ext.pastHistory || "Not documented",
          lastMeal: ext.sampleHistory?.lastMeal || "Not documented",
          events: ext.sampleHistory?.events || "",
          socialHistory: "Not documented",
          familyHistory: "Not documented",
          psychiatricFlags: "None",
        },
        primaryAssessment: ext.primaryAssessment || {
          airway: "Not documented",
          airwayStatus: "Normal",
          breathing: "Not documented",
          breathingStatus: "Normal",
          circulation: "Not documented",
          circulationStatus: "Normal",
          disability: "Not documented",
          disabilityStatus: "Normal",
          exposure: "Not documented",
          exposureStatus: "Normal",
        },
        secondaryAssessment: typeof ext.secondaryAssessment === "string" ? ext.secondaryAssessment : "",
        progressNotes: ext.progressNotes || "",
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
    finalizeAndHandOff(pastedText);
  };

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
    } catch (err) {
      setError("Microphone access denied or unavailable.");
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

      const transcribeRes = await fetch("/api/voice/transcribe", {
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

      const ocrRes = await fetch("/api/scribe-ocr-scan", {
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
            age: typeof ocr.age === "number" ? ocr.age : parseInt(ocr.age, 10) || 0,
            gender: ocr.gender || "Male",
            uhid: `UH-${Math.floor(100000 + Math.random() * 900000)}`,
            presentingComplaint: ocr.presentingComplaint || "Quick discharge intake",
            triageCategory: TriageCategory.P2,
            arrivalMode: ArrivalMode.WalkIn,
            dateOpened: new Date().toISOString(),
            isMlc: false as any,
            caseType: "Medical",
          },
          vitals: {
            bp: ocr.bp || "Not recorded",
            hr: String(ocr.hr || "0"),
            spo2: String(ocr.spo2 || "0"),
            rr: String(ocr.rr || "0"),
            temp: String(ocr.temp || "0"),
            gcs: String(ocr.gcs || "15"),
            gcs_e: "4",
            gcs_v: "5",
            gcs_m: "6",
            grbs: String(ocr.grbs || "0"),
            avpu: "Alert",
            painScore: String(ocr.painScore || "0"),
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
            airwayStatus: "Normal",
            breathing: ocr.breathing || "Not documented",
            breathingStatus: "Normal",
            circulation: ocr.circulation || "Not documented",
            circulationStatus: "Normal",
            disability: ocr.disability || "Not documented",
            disabilityStatus: "Normal",
            exposure: ocr.exposure || "Not documented",
            exposureStatus: "Normal",
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
      <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold">Quick Discharge</h1>
          <p className="text-xs text-slate-400">Paste, dictate, or photograph — no case documentation needed. Always free.</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer">
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
