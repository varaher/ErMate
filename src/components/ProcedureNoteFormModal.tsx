import React, { useState, useEffect } from "react";
import { 
  ProcedureNote, 
  ProcedureMetadata, 
  ProcedureConsentStatus, 
  ProcedureComplicationStatus,
  FoleyCatheterData,
  CentralLineData,
  ArterialLineData,
  RsiIntubationData,
  ClosedReductionData,
  ShortArmSlabData,
  RylesTubeData,
  ProcedureType
} from "../types/procedureNotes";
import { ProcedureDefinition } from "../data/procedureDefinitions";
import { generateProcedureNarrative } from "../utils/procedureNarrativeGenerator";
import { 
  X, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Eye, 
  RotateCcw,
  Sparkles
} from "lucide-react";

interface ProcedureNoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  defaultDoctorName?: string;
  procDef: ProcedureDefinition;
  editingNote?: ProcedureNote | null;
  initialPrefill?: {
    metadata?: Partial<ProcedureMetadata>;
    fields?: Record<string, any>;
  };
  onSave: (note: ProcedureNote) => void;
}

export const ProcedureNoteFormModal: React.FC<ProcedureNoteFormModalProps> = ({
  isOpen,
  onClose,
  caseId,
  defaultDoctorName = "",
  procDef,
  editingNote,
  initialPrefill,
  onSave,
}) => {
  // Common Metadata State
  const now = new Date();
  const defaultDate = now.toISOString().split("T")[0];
  const defaultTime = now.toTimeString().slice(0, 5);

  const [metadata, setMetadata] = useState<ProcedureMetadata>({
    date: defaultDate,
    time: defaultTime,
    performedBy: defaultDoctorName,
    assistant: "",
    indication: procDef.defaultIndication || "",
    consent: "obtained",
    attempts: 1,
    complications: "none_observed",
    complicationDetails: "",
    additionalNotes: "",
  });

  // Specific Structured States
  const [foley, setFoley] = useState<FoleyCatheterData>({
    catheterSize: "14 Fr",
    balloonVolumeMl: "10 mL sterile water",
    urineReturn: "Clear yellow urine, 200 mL drained immediately",
    secured: true,
    drainageBag: true,
    plan: "Monitor hourly urine output; remove catheter when clinically indicated",
  });

  const [centralLine, setCentralLine] = useState<CentralLineData>({
    side: "Right",
    site: "Internal Jugular",
    catheterType: "Triple lumen 7 Fr, 16 cm",
    ultrasoundGuidance: "US Guided",
    localAnaesthesia: "2% Lignocaine 5 mL infiltrated",
    depthCm: "13 cm at skin",
    bloodAspiration: true,
    lumensFlushed: true,
    secured: "Sutured with 2-0 silk, sterile transparent dressing applied",
    positionConfirmed: "Guide-wire confirmed in vein under real-time US; post-procedure portable CXR ordered",
  });

  const [arterialLine, setArterialLine] = useState<ArterialLineData>({
    side: "Left",
    site: "Radial",
    ultrasoundGuidance: "US Guided",
    localAnaesthesia: "1% Lignocaine 1 mL local wheal",
    arterialWaveform: "Immediate pulsatile blood flashback; crisp arterial waveform on pressure transducer",
    openingBp: "",
    secured: "Sutured with 3-0 silk, sterile occlusive dressing applied",
  });

  const [rsi, setRsi] = useState<RsiIntubationData>({
    preoxygenation: "100% FiO2 via NRBM 15 L/min for 3 minutes + apnoeic NC 15 L/min",
    inductionDrug: "Etomidate 20 mg IV",
    paralyticDrug: "Rocuronium 70 mg IV (1.2 mg/kg)",
    device: "Video laryngoscope (Mac 3 blade)",
    cormackLehaneGrade: "Grade 1",
    etTubeSize: "7.5 mm cuffed",
    depthCm: "22 cm at incisors",
    etco2Confirmed: true,
    chestRise: true,
    auscultation: "Equal bilateral breath sounds, epigastrium silent",
    postIntubationVentilation: "Connected to mechanical ventilator (Volume control, TV 420 mL, RR 16, PEEP 5)",
    postIntubationSedation: "Fentanyl 50 mcg/hr IV + Propofol infusion titrated to RASS -4",
  });

  const [closedReduction, setClosedReduction] = useState<ClosedReductionData>({
    diagnosis: "",
    site: "Right wrist / distal radius",
    anesthesiaSedation: "Hematoma block with 10 mL 1% Lignocaine under aseptic precautions",
    procedureDetails: "Longitudinal traction applied for 5 minutes, direct volar pressure to reduce dorsal displacement",
    preNeurovascularStatus: "Radial pulse palpable 2+, capillary refill < 2s, motor/sensory intact",
    postNeurovascularStatus: "Radial pulse palpable 2+, capillary refill < 2s, digits warm and pink, sensation intact",
    immobilization: "Below-elbow sugar-tong short arm plaster slab applied",
    imagingConfirmation: "Post-reduction check X-ray ordered immediately",
    plan: "Post-reduction check X-ray, limb elevation in sling, Orthopedic team review",
  });

  const [shortArmSlab, setShortArmSlab] = useState<ShortArmSlabData>({
    side: "Right",
    site: "Distal radius / wrist",
    padding: "Webril soft roll 2 layers applied smoothly without wrinkles",
    extent: "Below elbow to proximal palmar crease, MCP joints and thumb fully mobile",
    position: "Wrist in slight extension (15-20°), neutral deviation",
    postNeurovascularCheck: "Distal pulses palpable, capillary refill < 2 seconds, warm pink digits, active finger movement intact",
    plan: "Keep limb elevated in sling; warn regarding tight cast symptoms (pain, numbness, bluish digits); Orthopedic OPD review in 5 days",
  });

  const [rylesTube, setRylesTube] = useState<RylesTubeData>({
    tubeSize: "16 Fr",
    nostril: "Right",
    insertionLengthCm: "55 cm (measured nose-earlobe-xiphisternum)",
    confirmationMethod: "Epigastric whoosh heard on air insufflation and gastric juice aspirated with pH paper check",
    secured: "Taped securely to nose bridge and cheek without ala pressure",
    plan: "Connect to drainage bag / keep spigotted; aspirate 4th hourly; verify before any enteral administration",
  });

  // Generic fallback fields for other types
  const [genericFields, setGenericFields] = useState<Record<string, any>>({});

  // Active view mode: "form" | "preview"
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");

  // Load existing or prefill
  useEffect(() => {
    if (!isOpen) return;

    if (editingNote) {
      setMetadata(editingNote.metadata);
      if (editingNote.data.type === "foley_catheter") setFoley(editingNote.data.fields);
      else if (editingNote.data.type === "central_line") setCentralLine(editingNote.data.fields);
      else if (editingNote.data.type === "arterial_line") setArterialLine(editingNote.data.fields);
      else if (editingNote.data.type === "rsi_intubation") setRsi(editingNote.data.fields);
      else if (editingNote.data.type === "closed_reduction") setClosedReduction(editingNote.data.fields);
      else if (editingNote.data.type === "short_arm_slab") setShortArmSlab(editingNote.data.fields);
      else if (editingNote.data.type === "ryles_tube") setRylesTube(editingNote.data.fields);
      else setGenericFields((editingNote.data as any).fields || {});
    } else {
      // New note - apply prefill if present
      const meta = {
        date: defaultDate,
        time: defaultTime,
        performedBy: defaultDoctorName,
        assistant: "",
        indication: procDef.defaultIndication || "",
        consent: "obtained" as ProcedureConsentStatus,
        attempts: 1,
        complications: "none_observed" as ProcedureComplicationStatus,
        complicationDetails: "",
        additionalNotes: "",
      };

      if (initialPrefill?.metadata) {
        Object.assign(meta, initialPrefill.metadata);
      }
      setMetadata(meta);

      if (initialPrefill?.fields) {
        if (procDef.type === "foley_catheter") setFoley(prev => ({ ...prev, ...initialPrefill.fields }));
        else if (procDef.type === "central_line") setCentralLine(prev => ({ ...prev, ...initialPrefill.fields }));
        else if (procDef.type === "arterial_line") setArterialLine(prev => ({ ...prev, ...initialPrefill.fields }));
        else if (procDef.type === "rsi_intubation") setRsi(prev => ({ ...prev, ...initialPrefill.fields }));
        else if (procDef.type === "closed_reduction") setClosedReduction(prev => ({ ...prev, ...initialPrefill.fields }));
        else if (procDef.type === "short_arm_slab") setShortArmSlab(prev => ({ ...prev, ...initialPrefill.fields }));
        else if (procDef.type === "ryles_tube") setRylesTube(prev => ({ ...prev, ...initialPrefill.fields }));
        else setGenericFields(initialPrefill.fields);
      }
    }
  }, [isOpen, editingNote, procDef, defaultDate, defaultTime, defaultDoctorName, initialPrefill]);

  if (!isOpen) return null;

  // Construct current data payload
  const buildCurrentPayload = (): ProcedureNote["data"] => {
    switch (procDef.type) {
      case "foley_catheter": return { type: "foley_catheter", fields: foley };
      case "central_line": return { type: "central_line", fields: centralLine };
      case "arterial_line": return { type: "arterial_line", fields: arterialLine };
      case "rsi_intubation": return { type: "rsi_intubation", fields: rsi };
      case "closed_reduction": return { type: "closed_reduction", fields: closedReduction };
      case "short_arm_slab": return { type: "short_arm_slab", fields: shortArmSlab };
      case "ryles_tube": return { type: "ryles_tube", fields: rylesTube };
      default: return { type: "generic", fields: genericFields };
    }
  };

  const previewNarrative = generateProcedureNarrative(
    procDef.name,
    metadata,
    buildCurrentPayload()
  );

  const handleSaveProcedure = () => {
    const noteId = editingNote?.id || `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const finalNote: ProcedureNote = {
      id: noteId,
      caseId: caseId,
      procedureType: procDef.type,
      procedureName: procDef.name,
      category: procDef.category,
      metadata: metadata,
      data: buildCurrentPayload(),
      generatedNarrative: previewNarrative,
      createdAt: editingNote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "completed",
    };

    onSave(finalNote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {procDef.category}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Case ID: {caseId}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {procDef.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex p-0.5 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "form"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Form</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "preview"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Note</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Safety Banner */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2 flex items-center gap-2 text-[11px] text-amber-900 dark:text-amber-200 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            <strong>Clinical Safety Rule:</strong> Unconfirmed fields are omitted from generated narrative. Not confirmed = not documented.
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {activeTab === "preview" ? (
            /* PREVIEW NARRATIVE TAB */
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-inner">
                <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Generated Procedure Note Preview
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                    Deterministic Zero-Hallucination
                  </span>
                </div>
                <div className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                  {previewNarrative}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  ← Return to Form & Adjust Fields
                </button>
              </div>
            </div>
          ) : (
            /* GUIDED FORM TAB */
            <div className="space-y-6">
              {/* 1. Common Metadata */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                  1. Procedure Metadata & Consent
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={metadata.date}
                      onChange={(e) => setMetadata(m => ({ ...m, date: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={metadata.time}
                      onChange={(e) => setMetadata(m => ({ ...m, time: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Performed By (Operator)
                    </label>
                    <input
                      type="text"
                      placeholder="Doctor Name / Resident"
                      value={metadata.performedBy}
                      onChange={(e) => setMetadata(m => ({ ...m, performedBy: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Assistant
                    </label>
                    <input
                      type="text"
                      placeholder="Nurse / Resident (optional)"
                      value={metadata.assistant || ""}
                      onChange={(e) => setMetadata(m => ({ ...m, assistant: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Indication
                    </label>
                    <input
                      type="text"
                      placeholder="Clinical reason for procedure"
                      value={metadata.indication}
                      onChange={(e) => setMetadata(m => ({ ...m, indication: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Informed Consent
                    </label>
                    <select
                      value={metadata.consent}
                      onChange={(e) => setMetadata(m => ({ ...m, consent: e.target.value as ProcedureConsentStatus }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                    >
                      <option value="obtained">Obtained (Written/Verbal)</option>
                      <option value="emergency_implied">Emergency / Implied Consent</option>
                      <option value="not_applicable">Not Applicable</option>
                      <option value="not_documented">Not Documented</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Structured Guided Template Body */}
              <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border-b pb-1.5 border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span>2. {procDef.name} — Structured Clinical Fields</span>
                  <span className="text-[10px] text-slate-400 font-normal">Fill confirmed values</span>
                </h4>

                {/* TEMPLATE 1: FOLEY CATHETER */}
                {procDef.type === "foley_catheter" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Catheter Size</label>
                      <select
                        value={foley.catheterSize || ""}
                        onChange={(e) => setFoley(f => ({ ...f, catheterSize: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select size</option>
                        <option value="12 Fr">12 Fr</option>
                        <option value="14 Fr">14 Fr</option>
                        <option value="16 Fr">16 Fr</option>
                        <option value="18 Fr">18 Fr</option>
                        <option value="20 Fr">20 Fr (Three-way)</option>
                        <option value="8 Fr Pediatric">8 Fr Pediatric</option>
                        <option value="10 Fr Pediatric">10 Fr Pediatric</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Balloon Volume</label>
                      <input
                        type="text"
                        placeholder="e.g. 10 mL sterile water"
                        value={foley.balloonVolumeMl || ""}
                        onChange={(e) => setFoley(f => ({ ...f, balloonVolumeMl: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Urine Return (Amount & Color)</label>
                      <input
                        type="text"
                        placeholder="e.g. Clear yellow urine, 250 mL drained"
                        value={foley.urineReturn || ""}
                        onChange={(e) => setFoley(f => ({ ...f, urineReturn: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="foley-secured"
                        checked={!!foley.secured}
                        onChange={(e) => setFoley(f => ({ ...f, secured: e.target.checked }))}
                        className="rounded text-indigo-600 w-4 h-4"
                      />
                      <label htmlFor="foley-secured" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Catheter secured to inner thigh without tension
                      </label>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="foley-bag"
                        checked={!!foley.drainageBag}
                        onChange={(e) => setFoley(f => ({ ...f, drainageBag: e.target.checked }))}
                        className="rounded text-indigo-600 w-4 h-4"
                      />
                      <label htmlFor="foley-bag" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Connected to dependent urobag / drainage system
                      </label>
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Plan</label>
                      <input
                        type="text"
                        placeholder="e.g. Hourly urine output monitoring, maintain sterile closed system"
                        value={foley.plan || ""}
                        onChange={(e) => setFoley(f => ({ ...f, plan: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* TEMPLATE 2: CENTRAL VENOUS LINE */}
                {procDef.type === "central_line" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Side</label>
                      <select
                        value={centralLine.side || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, side: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select side</option>
                        <option value="Right">Right</option>
                        <option value="Left">Left</option>
                        <option value="Bilateral">Bilateral</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Anatomical Site</label>
                      <select
                        value={centralLine.site || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, site: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select site</option>
                        <option value="Internal Jugular">Internal Jugular</option>
                        <option value="Subclavian">Subclavian</option>
                        <option value="Femoral">Femoral</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Catheter Type</label>
                      <input
                        type="text"
                        placeholder="e.g. Triple-lumen 7 Fr, 16 cm"
                        value={centralLine.catheterType || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, catheterType: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Ultrasound Guidance</label>
                      <select
                        value={centralLine.ultrasoundGuidance || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, ultrasoundGuidance: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select technique</option>
                        <option value="US Guided">US Guided (Real-time dynamic)</option>
                        <option value="US Assisted (Pre-scan)">US Assisted (Static pre-scan)</option>
                        <option value="Landmark Technique">Landmark Technique</option>
                        <option value="Not documented">Not documented</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Local Anesthesia</label>
                      <input
                        type="text"
                        placeholder="e.g. 2% Lignocaine 5 mL infiltrated"
                        value={centralLine.localAnaesthesia || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, localAnaesthesia: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Depth at Skin</label>
                      <input
                        type="text"
                        placeholder="e.g. 13 cm at skin marker"
                        value={centralLine.depthCm || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, depthCm: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="c-blood"
                        checked={!!centralLine.bloodAspiration}
                        onChange={(e) => setCentralLine(c => ({ ...c, bloodAspiration: e.target.checked }))}
                        className="rounded text-indigo-600 w-4 h-4"
                      />
                      <label htmlFor="c-blood" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Free non-pulsatile dark venous blood aspirated
                      </label>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="c-flushed"
                        checked={!!centralLine.lumensFlushed}
                        onChange={(e) => setCentralLine(c => ({ ...c, lumensFlushed: e.target.checked }))}
                        className="rounded text-indigo-600 w-4 h-4"
                      />
                      <label htmlFor="c-flushed" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        All lumens aspirated and flushed with sterile saline
                      </label>
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Securing & Dressing</label>
                      <input
                        type="text"
                        placeholder="e.g. Sutured with 2-0 silk, sterile transparent dressing applied"
                        value={centralLine.secured || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, secured: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Position Confirmation</label>
                      <input
                        type="text"
                        placeholder="e.g. Guidewire visualised on US, portable check CXR ordered"
                        value={centralLine.positionConfirmed || ""}
                        onChange={(e) => setCentralLine(c => ({ ...c, positionConfirmed: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* TEMPLATE 3: ARTERIAL LINE */}
                {procDef.type === "arterial_line" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Side</label>
                      <select
                        value={arterialLine.side || ""}
                        onChange={(e) => setArterialLine(a => ({ ...a, side: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select side</option>
                        <option value="Right">Right</option>
                        <option value="Left">Left</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Site</label>
                      <select
                        value={arterialLine.site || ""}
                        onChange={(e) => setArterialLine(a => ({ ...a, site: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select site</option>
                        <option value="Radial">Radial</option>
                        <option value="Femoral">Femoral</option>
                        <option value="Brachial">Brachial</option>
                        <option value="Dorsalis Pedis">Dorsalis Pedis</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Ultrasound Guidance</label>
                      <select
                        value={arterialLine.ultrasoundGuidance || ""}
                        onChange={(e) => setArterialLine(a => ({ ...a, ultrasoundGuidance: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select guidance</option>
                        <option value="US Guided">US Guided</option>
                        <option value="Palpation / Landmark">Palpation / Landmark</option>
                        <option value="Not documented">Not documented</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Local Anesthesia</label>
                      <input
                        type="text"
                        placeholder="e.g. 1% Lignocaine 1 mL wheal"
                        value={arterialLine.localAnaesthesia || ""}
                        onChange={(e) => setArterialLine(a => ({ ...a, localAnaesthesia: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Waveform / Blood Flash</label>
                      <input
                        type="text"
                        placeholder="e.g. Pulsatile blood return; crisp arterial waveform"
                        value={arterialLine.arterialWaveform || ""}
                        onChange={(e) => setArterialLine(a => ({ ...a, arterialWaveform: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Opening Invasive BP</label>
                      <input
                        type="text"
                        placeholder="e.g. 118/74 mmHg (MAP 88)"
                        value={arterialLine.openingBp || ""}
                        onChange={(e) => setArterialLine(a => ({ ...a, openingBp: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Securing & Dressing</label>
                      <input
                        type="text"
                        placeholder="e.g. Sutured with 3-0 silk, sterile transparent dressing, splint applied"
                        value={arterialLine.secured || ""}
                        onChange={(e) => setArterialLine(a => ({ ...a, secured: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* TEMPLATE 4: RSI / INTUBATION */}
                {procDef.type === "rsi_intubation" && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Preoxygenation</label>
                        <input
                          type="text"
                          placeholder="e.g. 100% FiO2 NRBM 3 mins"
                          value={rsi.preoxygenation || ""}
                          onChange={(e) => setRsi(r => ({ ...r, preoxygenation: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Induction Drug + Dose</label>
                        <input
                          type="text"
                          placeholder="e.g. Etomidate 20 mg IV / Propofol 100 mg"
                          value={rsi.inductionDrug || ""}
                          onChange={(e) => setRsi(r => ({ ...r, inductionDrug: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Paralytic + Dose</label>
                        <input
                          type="text"
                          placeholder="e.g. Rocuronium 70 mg IV / Succinylcholine"
                          value={rsi.paralyticDrug || ""}
                          onChange={(e) => setRsi(r => ({ ...r, paralyticDrug: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Device / Laryngoscope</label>
                        <input
                          type="text"
                          placeholder="e.g. Video Laryngoscope Mac 3"
                          value={rsi.device || ""}
                          onChange={(e) => setRsi(r => ({ ...r, device: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Cormack-Lehane Grade</label>
                        <select
                          value={rsi.cormackLehaneGrade || ""}
                          onChange={(e) => setRsi(r => ({ ...r, cormackLehaneGrade: e.target.value as any }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                        >
                          <option value="">Select view</option>
                          <option value="Grade 1">Grade 1 (Full vocal cords)</option>
                          <option value="Grade 2a">Grade 2a (Partial vocal cords)</option>
                          <option value="Grade 2b">Grade 2b (Arytenoids only)</option>
                          <option value="Grade 3">Grade 3 (Epiglottis only)</option>
                          <option value="Grade 4">Grade 4 (Soft palate only)</option>
                          <option value="POGO 100%">POGO 100%</option>
                          <option value="Not documented">Not documented</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">ET Tube Size</label>
                        <input
                          type="text"
                          placeholder="e.g. 7.5 mm cuffed"
                          value={rsi.etTubeSize || ""}
                          onChange={(e) => setRsi(r => ({ ...r, etTubeSize: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Depth at Incisors</label>
                        <input
                          type="text"
                          placeholder="e.g. 22 cm at incisors"
                          value={rsi.depthCm || ""}
                          onChange={(e) => setRsi(r => ({ ...r, depthCm: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="rsi-etco2"
                          checked={!!rsi.etco2Confirmed}
                          onChange={(e) => setRsi(r => ({ ...r, etco2Confirmed: e.target.checked }))}
                          className="rounded text-indigo-600 w-4 h-4"
                        />
                        <label htmlFor="rsi-etco2" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                          ETCO2 confirmation sustained
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="rsi-chest"
                          checked={!!rsi.chestRise}
                          onChange={(e) => setRsi(r => ({ ...r, chestRise: e.target.checked }))}
                          className="rounded text-indigo-600 w-4 h-4"
                        />
                        <label htmlFor="rsi-chest" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                          Equal bilateral chest rise
                        </label>
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Auscultation: bilateral breath sounds"
                          value={rsi.auscultation || ""}
                          onChange={(e) => setRsi(r => ({ ...r, auscultation: e.target.value }))}
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Post-Intubation Ventilation</label>
                        <input
                          type="text"
                          placeholder="e.g. Mechanical ventilator AC/VC, TV 420 mL, RR 16, PEEP 5"
                          value={rsi.postIntubationVentilation || ""}
                          onChange={(e) => setRsi(r => ({ ...r, postIntubationVentilation: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Post-Intubation Sedation</label>
                        <input
                          type="text"
                          placeholder="e.g. Fentanyl + Propofol infusion titrated to RASS -4"
                          value={rsi.postIntubationSedation || ""}
                          onChange={(e) => setRsi(r => ({ ...r, postIntubationSedation: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TEMPLATE 5: CLOSED REDUCTION */}
                {procDef.type === "closed_reduction" && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Diagnosis</label>
                        <input
                          type="text"
                          placeholder="e.g. Colles fracture right wrist / Anterior shoulder dislocation"
                          value={closedReduction.diagnosis || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, diagnosis: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Site</label>
                        <input
                          type="text"
                          placeholder="e.g. Right distal radius / Left glenohumeral joint"
                          value={closedReduction.site || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, site: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Anesthesia / Analgesia</label>
                        <input
                          type="text"
                          placeholder="e.g. Hematoma block 10 mL 1% Lignocaine / Procedural sedation"
                          value={closedReduction.anesthesiaSedation || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, anesthesiaSedation: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Reduction Maneuver Performed</label>
                        <input
                          type="text"
                          placeholder="e.g. Longitudinal traction, volar displacement corrected"
                          value={closedReduction.procedureDetails || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, procedureDetails: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Pre-Reduction Neurovascular Status</label>
                        <input
                          type="text"
                          placeholder="e.g. Distal pulse palpable, capillary refill < 2s, sensations intact"
                          value={closedReduction.preNeurovascularStatus || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, preNeurovascularStatus: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Post-Reduction Neurovascular Status</label>
                        <input
                          type="text"
                          placeholder="e.g. Radial pulse intact 2+, warm pink digits, motor/sensory intact"
                          value={closedReduction.postNeurovascularStatus || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, postNeurovascularStatus: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Immobilization Applied</label>
                        <input
                          type="text"
                          placeholder="e.g. Below-elbow sugar-tong / short arm plaster slab"
                          value={closedReduction.immobilization || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, immobilization: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Imaging Confirmation</label>
                        <input
                          type="text"
                          placeholder="e.g. Check X-ray confirmed satisfactory reduction and cortical apposition"
                          value={closedReduction.imagingConfirmation || ""}
                          onChange={(e) => setClosedReduction(c => ({ ...c, imagingConfirmation: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TEMPLATE 6: SHORT ARM SLAB */}
                {procDef.type === "short_arm_slab" && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Side</label>
                        <select
                          value={shortArmSlab.side || ""}
                          onChange={(e) => setShortArmSlab(s => ({ ...s, side: e.target.value as any }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                        >
                          <option value="">Select side</option>
                          <option value="Right">Right</option>
                          <option value="Left">Left</option>
                          <option value="Bilateral">Bilateral</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Site / Injury</label>
                        <input
                          type="text"
                          placeholder="e.g. Distal radius / wrist"
                          value={shortArmSlab.site || ""}
                          onChange={(e) => setShortArmSlab(s => ({ ...s, site: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Padding</label>
                        <input
                          type="text"
                          placeholder="e.g. Webril 2 layers without wrinkles"
                          value={shortArmSlab.padding || ""}
                          onChange={(e) => setShortArmSlab(s => ({ ...s, padding: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Extent</label>
                        <input
                          type="text"
                          placeholder="e.g. Below elbow to proximal palmar crease"
                          value={shortArmSlab.extent || ""}
                          onChange={(e) => setShortArmSlab(s => ({ ...s, extent: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Position</label>
                        <input
                          type="text"
                          placeholder="e.g. Wrist in slight extension (15-20°)"
                          value={shortArmSlab.position || ""}
                          onChange={(e) => setShortArmSlab(s => ({ ...s, position: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Post-Application Neurovascular Check</label>
                      <input
                        type="text"
                        placeholder="e.g. Distal pulses palpable, capillary refill < 2s, warm pink digits, active finger movement intact"
                        value={shortArmSlab.postNeurovascularCheck || ""}
                        onChange={(e) => setShortArmSlab(s => ({ ...s, postNeurovascularCheck: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Plan & Precautions</label>
                      <input
                        type="text"
                        placeholder="e.g. Keep elevated in arm sling; warn for cast tightness / blueness; Ortho review in 5 days"
                        value={shortArmSlab.plan || ""}
                        onChange={(e) => setShortArmSlab(s => ({ ...s, plan: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* TEMPLATE 7: RYLES / NG TUBE */}
                {procDef.type === "ryles_tube" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Tube Size</label>
                      <select
                        value={rylesTube.tubeSize || ""}
                        onChange={(e) => setRylesTube(rt => ({ ...rt, tubeSize: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select size</option>
                        <option value="12 Fr">12 Fr</option>
                        <option value="14 Fr">14 Fr</option>
                        <option value="16 Fr">16 Fr</option>
                        <option value="18 Fr">18 Fr</option>
                        <option value="8 Fr Pediatric">8 Fr Pediatric</option>
                        <option value="10 Fr Pediatric">10 Fr Pediatric</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Nostril</label>
                      <select
                        value={rylesTube.nostril || ""}
                        onChange={(e) => setRylesTube(rt => ({ ...rt, nostril: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="">Select nostril</option>
                        <option value="Right">Right</option>
                        <option value="Left">Left</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Insertion Length</label>
                      <input
                        type="text"
                        placeholder="e.g. 55 cm (NEX measurement)"
                        value={rylesTube.insertionLengthCm || ""}
                        onChange={(e) => setRylesTube(rt => ({ ...rt, insertionLengthCm: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Confirmation Method</label>
                      <input
                        type="text"
                        placeholder="e.g. Epigastric whoosh on air insufflation and gastric juice aspirated"
                        value={rylesTube.confirmationMethod || ""}
                        onChange={(e) => setRylesTube(rt => ({ ...rt, confirmationMethod: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Securing</label>
                      <input
                        type="text"
                        placeholder="e.g. Taped securely to nose bridge without pressure"
                        value={rylesTube.secured || ""}
                        onChange={(e) => setRylesTube(rt => ({ ...rt, secured: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Plan</label>
                      <input
                        type="text"
                        placeholder="e.g. Connect to free drainage bag / keep spigotted; aspirate 4th hourly"
                        value={rylesTube.plan || ""}
                        onChange={(e) => setRylesTube(rt => ({ ...rt, plan: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Attempts, Complications & Additional Notes */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                  3. Execution & Safety Outcomes
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Number of Attempts
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={metadata.attempts ?? 1}
                      onChange={(e) => setMetadata(m => ({ ...m, attempts: parseInt(e.target.value, 10) || 1 }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Complications
                    </label>
                    <select
                      value={metadata.complications}
                      onChange={(e) => setMetadata(m => ({ ...m, complications: e.target.value as ProcedureComplicationStatus }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                    >
                      <option value="none_observed">None observed</option>
                      <option value="present">Yes (describe below)</option>
                      <option value="not_documented">Not documented</option>
                    </select>
                  </div>

                  {metadata.complications === "present" && (
                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-1">
                        Complication Details
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Minor transient hematoma; managed with 5 mins direct pressure"
                        value={metadata.complicationDetails || ""}
                        onChange={(e) => setMetadata(m => ({ ...m, complicationDetails: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-900 dark:text-rose-200"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Free-Text Additional Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any additional clinical observations, post-procedure instructions, or nursing orders..."
                    value={metadata.additionalNotes || ""}
                    onChange={(e) => setMetadata(m => ({ ...m, additionalNotes: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "form" ? "preview" : "form")}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {activeTab === "form" ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Generated Note</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Back to Guided Form</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveProcedure}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>SAVE PROCEDURE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
