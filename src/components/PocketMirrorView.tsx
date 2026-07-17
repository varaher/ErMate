import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, ChevronLeft, Eye, Sun, Zap, RotateCw, Pause, Play, ShieldAlert, Check, RefreshCw, Sparkles, Sliders
} from "lucide-react";

interface PocketMirrorViewProps {
  onBack: () => void;
}

export default function PocketMirrorView({ onBack }: PocketMirrorViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState<boolean>(true); // Mirrored like iPhone by default!
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [lightBoost, setLightBoost] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<"none" | "cobalt" | "high-contrast" | "warm">("none");
  const [activeOverlay, setActiveOverlay] = useState<"pupil" | "mallampati" | "none">("pupil");
  
  // Interactive pupillary sizing states
  const [selectedPupilSize, setSelectedPupilSize] = useState<number>(3); // default 3mm
  
  // Mock fallback preview image if camera permission is denied
  const [useMockDemo, setUseMockDemo] = useState<boolean>(false);

  // Pupil size scale reference data (clinical significance)
  const pupilScales = [
    { size: 1, label: "1.0 mm", desc: "Pinpoint (Narcotics, Pontine Hemorrhage)" },
    { size: 2, label: "2.0 mm", desc: "Constricted (Organophosphates, Miosis)" },
    { size: 3, label: "3.0 mm", desc: "Normal Light / Rest" },
    { size: 4, label: "4.0 mm", desc: "Normal / Ambient" },
    { size: 5, label: "5.0 mm", desc: "Slightly Dilated" },
    { size: 6, label: "6.0 mm", desc: "Dilated (Sympathomimetic drugs, Early herniation)" },
    { size: 7, label: "7.0 mm", desc: "Severely Dilated" },
    { size: 8, label: "8.0 mm", desc: "Blown / Mydriasis (Brain Injury, CN III compression)" },
  ];

  // Mallampati Classification data for throat airway grading
  const mallampatiClasses = [
    { class: "Class I", view: "Full visibility", structure: "Tonsils, uvula, and soft palate fully visible.", risk: "Easy Airway" },
    { class: "Class II", view: "Partial visibility", structure: "Hard and soft palate, upper portion of tonsils and uvula visible.", risk: "Low Risk" },
    { class: "Class III", view: "Soft palate only", structure: "Soft palate and base of uvula visible. Tonsils obscured.", risk: "Difficult Airway" },
    { class: "Class IV", view: "Hard palate only", structure: "Only hard palate visible. Soft palate completely obscured.", risk: "Extreme Difficulty / Call for backup" },
  ];

  // Initialize camera stream
  const startCamera = async () => {
    setCameraError(null);
    setUseMockDemo(false);
    
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
      setCameraActive(true);
      setIsFrozen(false);
    } catch (err: any) {
      console.warn("Camera stream failed or permission denied:", err);
      setCameraError(err.message || "Could not access front camera. Please verify permissions.");
      setCameraActive(false);
      // Fallback to beautiful mock clinical demo so user can still see the visual overlays in action!
      setUseMockDemo(true);
    }
  };

  // Stop camera on component unmount
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // Handle freeze frame toggle
  const toggleFreeze = () => {
    if (!videoRef.current || useMockDemo) {
      if (useMockDemo) {
        setIsFrozen(!isFrozen);
      }
      return;
    }
    
    if (isFrozen) {
      videoRef.current.play().catch(console.error);
      setIsFrozen(false);
    } else {
      videoRef.current.pause();
      setIsFrozen(true);
    }
  };

  // Toggle facing mode (front camera / rear camera)
  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === "user" ? "environment" : "user"));
  };

  // Build filter class string based on active filter
  const getFilterClass = () => {
    switch (activeFilter) {
      case "cobalt":
        // Simulated Cobalt Blue / Wood's Lamp filter using high contrast blue-cyan hue shift
        return "brightness-[1.1] contrast-[2.2] saturate-[2.5] hue-rotate-[195deg] grayscale-[20%]";
      case "high-contrast":
        // Enhances capillary pattern visibility
        return "contrast-[2.0] brightness-[1.1] saturate-[1.6] filter invert-[5%] grayscale-[30%]";
      case "warm":
        // Soft tissue warm illumination
        return "sepia-[30%] saturate-[1.3] contrast-[1.15]";
      default:
        return "none";
    }
  };

  return (
    <div className={`space-y-6 pb-24 text-left ${lightBoost ? "bg-white p-4 rounded-3xl text-slate-900 shadow-2xl transition-all duration-300" : "transition-all duration-300"}`}>
      
      {/* Dynamic light header when boost is on */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 no-print">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onBack} 
            className={`p-1.5 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer ${
              lightBoost 
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700" 
                : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white"
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Exit Mirror
          </button>
          <div>
            <h1 className={`text-base font-black tracking-tight flex items-center gap-1.5 font-display ${lightBoost ? "text-slate-950" : "text-white"}`}>
              <Camera className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
              iPhone Mirror Cam & Pupil Scale
            </h1>
            <p className={`text-[10px] ${lightBoost ? "text-slate-500" : "text-slate-400"} font-mono`}>
              Clinical Front-Facing Diagnostic Mirror • Horizontal Reflected Stream
            </p>
          </div>
        </div>

        {/* Dynamic Warning if Light Boost is active */}
        {lightBoost && (
          <span className="hidden md:inline-flex items-center gap-1 text-[9px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
            <Sun className="w-3 h-3" /> Soft Ring Light Active
          </span>
        )}
      </div>

      {/* Main Grid: Mirror Panel Left, Clinical Scales/Control Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Hand: The Mirrored Viewport with controls (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 border-4 border-slate-800 dark:border-slate-900 shadow-2xl aspect-video md:aspect-[4/3] flex items-center justify-center">
            
            {/* Soft Ring Light illumination borders inside the viewport */}
            {lightBoost && (
              <div className="absolute inset-0 pointer-events-none border-[12px] md:border-[20px] border-white z-20 animate-pulse" />
            )}

            {/* Video Feed */}
            {cameraActive && !useMockDemo ? (
              <video
                ref={videoRef}
                className={`w-full h-full object-cover z-0 transition-all ${
                  isMirrored ? "scale-x-[-1]" : ""
                }`}
                style={{
                  filter: activeFilter !== "none" ? "none" : undefined,
                  WebkitFilter: activeFilter !== "none" ? "none" : undefined
                }}
                playsInline
                muted
              />
            ) : useMockDemo ? (
              /* Beautiful clinical simulated eye preview when testing or webcam not permitted */
              <div className="w-full h-full relative z-0 flex items-center justify-center bg-slate-900 overflow-hidden">
                {/* Backplate grid */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {/* Simulated pupil graphics */}
                <div className="relative flex flex-col items-center justify-center space-y-3 z-10 p-6 text-center">
                  <div className="relative">
                    {/* Simulated Eye Sclera */}
                    <div className="w-36 h-24 bg-slate-100 rounded-[80%_20%] border-4 border-slate-700 flex items-center justify-center overflow-hidden relative shadow-inner">
                      {/* Iris */}
                      <div className="w-20 h-20 rounded-full bg-cyan-700/80 border-2 border-cyan-500 flex items-center justify-center relative animate-pulse">
                        {/* Striations */}
                        <div className="absolute inset-0 border-4 border-dashed border-cyan-900 rounded-full opacity-40" />
                        {/* Pupil */}
                        <div 
                          className="bg-black rounded-full transition-all duration-300 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)]"
                          style={{
                            width: `${selectedPupilSize * 8}px`,
                            height: `${selectedPupilSize * 8}px`
                          }}
                        />
                        {/* Light reflection */}
                        <div className="absolute top-4 left-4 w-3.5 h-3.5 rounded-full bg-white opacity-70" />
                        <div className="absolute bottom-5 right-5 w-2 h-2 rounded-full bg-white opacity-50" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-xl">
                    <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest block font-mono">
                      Simulated Eye Diagnostic Cam
                    </span>
                    <span className="text-[9px] text-slate-450 block">
                      Active Pupil Size: <strong className="text-white">{selectedPupilSize.toFixed(1)} mm</strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4 text-slate-400 z-10">
                <RefreshCw className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
                <p className="text-xs font-mono">Requesting Camera Permissions...</p>
              </div>
            )}

            {/* Filter CSS Applied via absolute container overlay if using HTML5 filters */}
            {activeFilter !== "none" && cameraActive && !useMockDemo && (
              <div 
                className={`absolute inset-0 pointer-events-none mix-blend-color z-10 ${getFilterClass()}`}
                style={{ backdropFilter: "contrast(1.5)" }}
              />
            )}

            {/* Viewport Floating Overlays */}
            <div className="absolute inset-x-4 bottom-4 flex justify-between items-center z-30 pointer-events-auto">
              {/* Mirror Indicator Badge */}
              <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[9px] font-bold text-white font-mono flex items-center gap-1.5 uppercase shadow-md select-none">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isMirrored ? "iOS Mirrored Cam" : "Standard Raw Feed"}
              </div>

              {/* Freeze State Indicator */}
              {isFrozen && (
                <div className="bg-rose-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider font-mono animate-pulse shadow-md">
                  PAUSED / FREEZE FRAME
                </div>
              )}
            </div>

            {/* Direct Mirror On-Screen Diagnostic scale overlay (Mallampati or Pupil Scale directly on the video) */}
            {activeOverlay === "pupil" && (
              <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 z-30 space-y-1 shadow-xl">
                <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider block font-mono">
                  Quick Scale
                </span>
                <div className="flex flex-col gap-1.5">
                  {[2, 3, 4, 5, 6, 8].map(size => (
                    <div 
                      key={size} 
                      onClick={() => setSelectedPupilSize(size)}
                      className={`flex items-center gap-2 px-1.5 py-0.5 rounded cursor-pointer transition-all ${selectedPupilSize === size ? "bg-indigo-500/25 border border-indigo-500/30 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      <span 
                        className="rounded-full bg-black border border-white/50"
                        style={{ width: `${size * 2.5}px`, height: `${size * 2.5}px` }}
                      />
                      <span className="text-[9px] font-mono font-bold">{size}mm</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Core Mirror Control Pad */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3 no-print">
            
            {/* Main Interactive Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleFreeze}
                className={`py-2 px-3.5 rounded-xl font-bold font-mono text-[10px] uppercase tracking-wide flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                  isFrozen 
                    ? "bg-emerald-600 text-white hover:bg-emerald-500" 
                    : "bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200"
                }`}
              >
                {isFrozen ? (
                  <>
                    <Play className="w-3.5 h-3.5" /> Resume Cam
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Freeze Frame
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMirrored(!isMirrored)}
                className={`py-2 px-3 border rounded-xl font-bold font-mono text-[10px] uppercase tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                  isMirrored 
                    ? "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30" 
                    : "bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" /> Mirror Effect: {isMirrored ? "ON" : "OFF"}
              </button>

              <button
                type="button"
                onClick={() => setLightBoost(!lightBoost)}
                className={`py-2 px-3 border rounded-xl font-bold font-mono text-[10px] uppercase tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                  lightBoost 
                    ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30" 
                    : "bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Soft Light Ring: {lightBoost ? "ON" : "OFF"}
              </button>
            </div>

            {/* Quick Action Reset */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 transition-all flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold cursor-pointer"
                title="Switch between front/back camera"
              >
                <Camera className="w-3.5 h-3.5" /> Rotate Cam
              </button>

              <button
                type="button"
                onClick={startCamera}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
                title="Re-initialize system camera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive filter and view options */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-3">
            <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider font-mono">
              Advanced Clinical Filters
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { id: "none", name: "Standard Color", desc: "True physical feed" },
                { id: "cobalt", name: "Cobalt blue lamp", desc: "Fluorescent corneal exam" },
                { id: "high-contrast", name: "Contrast Sclera", desc: "Capillary & vein enhance" },
                { id: "warm", name: "Halogen Warm", desc: "Soft-tissue inspection" }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as any)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    activeFilter === f.id 
                      ? "bg-indigo-500/15 border-indigo-500 text-white" 
                      : "bg-slate-950 hover:bg-slate-850 border-slate-850 text-slate-400"
                  }`}
                >
                  <span className="block text-[10px] font-black uppercase font-mono">{f.name}</span>
                  <span className="block text-[8px] text-slate-500 mt-0.5 leading-tight">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Hand: Clinical reference tools & pupil sizing slider (5 columns) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Diagnostic Overlay Selector Tab */}
          <div className="bg-[#182333] border border-slate-800/80 rounded-2xl p-1 flex">
            <button
              onClick={() => setActiveOverlay("pupil")}
              className={`flex-1 py-2 rounded-xl text-[10px] font-extrabold uppercase font-mono tracking-wider transition-all ${
                activeOverlay === "pupil" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pupil Size Comparator
            </button>
            <button
              onClick={() => setActiveOverlay("mallampati")}
              className={`flex-1 py-2 rounded-xl text-[10px] font-extrabold uppercase font-mono tracking-wider transition-all ${
                activeOverlay === "mallampati" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Airway Mallampati
            </button>
          </div>

          {/* Tab 1: Pupil Size Comparator Panel */}
          {activeOverlay === "pupil" && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5">
              
              <div className="space-y-1">
                <span className="text-[9px] text-emerald-400 bg-emerald-950 border border-emerald-900 px-2 py-0.5 rounded font-black uppercase font-mono tracking-wider">
                  NEUROLOGICAL ASSESSMENT TOOL
                </span>
                <h4 className="text-xs font-black text-white uppercase font-mono tracking-wide mt-1">
                  Active Pupil Diameter (mm)
                </h4>
                <p className="text-[10px] text-slate-450">
                  Hold your device at eye-level. Adjust the interactive scale below to compare and match the patient's pupil size.
                </p>
              </div>

              {/* Slider for sizing */}
              <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-3.5">
                <div className="flex justify-between items-center text-xs font-mono font-bold">
                  <span className="text-slate-400 uppercase">Interactive Gauge</span>
                  <span className="text-indigo-400 text-sm font-black">{selectedPupilSize.toFixed(1)} mm</span>
                </div>
                
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={selectedPupilSize}
                  onChange={(e) => {
                    setSelectedPupilSize(parseFloat(e.target.value));
                    setUseMockDemo(true); // Auto engage interactive mock demo to display the change
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />

                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>1.0 mm (Pinpoint)</span>
                  <span>4.0 mm</span>
                  <span>8.0 mm (Dilated)</span>
                </div>
              </div>

              {/* Sizing list scale cards with highlights */}
              <div className="space-y-2">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                  Clinical Scale Reference Sheet
                </span>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {pupilScales.map(p => (
                    <div 
                      key={p.size}
                      onClick={() => {
                        setSelectedPupilSize(p.size);
                        setUseMockDemo(true);
                      }}
                      className={`p-2.5 rounded-xl border text-[10px] transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        Math.abs(selectedPupilSize - p.size) < 0.25
                          ? "bg-indigo-950/40 border-indigo-500 text-white shadow-md"
                          : "bg-slate-950/50 border-slate-850 hover:border-slate-800 text-slate-350"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Circle visual matching actual millimeter scale */}
                        <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shrink-0">
                          <span 
                            className="rounded-full bg-slate-100 border border-slate-700 inline-block transition-all shadow-inner"
                            style={{ width: `${p.size * 3}px`, height: `${p.size * 3}px` }}
                          />
                        </div>
                        <div>
                          <strong className="block font-mono text-[11px] text-slate-100">{p.label}</strong>
                          <span className="block text-[9px] text-slate-400 leading-tight mt-0.5">{p.desc}</span>
                        </div>
                      </div>
                      
                      {Math.abs(selectedPupilSize - p.size) < 0.25 && (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Guidelines PEARL */}
              <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-500" />
                  <span className="text-[9.5px] font-black uppercase text-slate-200 font-mono tracking-wider">
                    PEARL Triage Standard
                  </span>
                </div>
                <ul className="text-[9px] text-slate-400 space-y-1.5 list-disc pl-3.5 leading-relaxed">
                  <li><strong>Pupils Equal And Reactive to Light:</strong> Test direct reflex (shining light in one eye &rarr; same eye constricts) and consensual reflex (shining in one &rarr; opposite constricts).</li>
                  <li><strong>Anisocoria (Unequal Pupils):</strong> Pathological difference &gt; 1mm. Suspect neurological emergency if acute onset (subdural, stroke).</li>
                  <li><strong>Pinpoint pupils:</strong> Frequently indicates opiate ingestion, organophosphate toxicity, or pontine injury.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 2: Mallampati Classification Airway Overlays */}
          {activeOverlay === "mallampati" && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5">
              <div className="space-y-1">
                <span className="text-[9px] text-amber-400 bg-amber-950 border border-amber-900 px-2 py-0.5 rounded font-black uppercase font-mono tracking-wider">
                  AIRWAY MALLAMPATI SCALE
                </span>
                <h4 className="text-xs font-black text-white uppercase font-mono tracking-wide mt-1">
                  Airway Visual Grade Checklist
                </h4>
                <p className="text-[10px] text-slate-450">
                  Hold device to inspect patient throat/uvula. Match the throat visualization structure class to determine intubation and ventilation risk level.
                </p>
              </div>

              <div className="space-y-2.5">
                {mallampatiClasses.map(m => (
                  <div 
                    key={m.class}
                    className="p-3 bg-slate-950/70 border border-slate-850 rounded-2xl space-y-1.5 text-[10px]"
                  >
                    <div className="flex justify-between items-center">
                      <strong className="font-mono text-[11px] text-white font-black">{m.class} : {m.view}</strong>
                      <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase font-mono border ${
                        m.risk.includes("Difficult") || m.class.includes("IV")
                          ? "bg-rose-950/40 border-rose-900 text-rose-400 animate-pulse"
                          : "bg-emerald-950/30 border-emerald-900 text-emerald-400"
                      }`}>
                        {m.risk}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed font-mono">
                      {m.structure}
                    </p>
                  </div>
                ))}
              </div>

              {/* Intubation Tips */}
              <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl space-y-1.5 font-mono text-[9px] text-slate-450">
                <p className="font-extrabold text-slate-300">💡 AIRWAY EXAMINATION PROTOCOL:</p>
                <p className="leading-relaxed">
                  Instruct patient to sit straight, extend head, open mouth wide and stick out tongue as far as possible <strong>WITHOUT phonating</strong> (saying 'ah' can falsely elevate the uvula and mask difficult airway structures).
                </p>
              </div>
            </div>
          )}

          {/* Direct Camera Troubleshooting Tips */}
          {cameraError && (
            <div className="bg-rose-950/30 border border-rose-900/40 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-400" />
                <h5 className="text-[10px] font-bold text-white uppercase font-mono">Camera Blocked or Unsupported</h5>
              </div>
              <p className="text-[9.5px] text-slate-400 leading-relaxed">
                The browser refused hardware media streams, or permissions are disabled. To demonstrate clinical capabilities, ErMate has auto-engaged the <strong>Interactive Eye/Pupil Simulator</strong>. Adjust the slider above to test how pupil scales and diagnosis guidelines function!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
