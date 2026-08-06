import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, ChevronLeft, Eye, Sun, Zap, RotateCw, Pause, Play, ShieldAlert, Check, RefreshCw, Sparkles, Sliders, AlertCircle, FileText
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

  // Diagnostics report states
  const [selectedMallampatiClass, setSelectedMallampatiClass] = useState<string>("Class I");
  const [reportText, setReportText] = useState<string>("");
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [clinicalObservations, setClinicalObservations] = useState<string>("");
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Generate Clinical Report via server API
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportText("");
    setCopiedReport(false);
    
    const generateLocalFallbackReport = () => {
      if (activeOverlay === "pupil") {
        return `### Bedside Pupillary Diagnostic Report
        
**1. EXECUTIVE SUMMARY**
- **Matched Pupil Size**: ${selectedPupilSize} mm
- **Observation Mode**: Interactive Pupillary Comparator (Active Filter: ${activeFilter})

**2. CLINICAL CORRELATIONS & SIGNIFICANCE**
- A pupil diameter of **${selectedPupilSize} mm** falls within the ${selectedPupilSize < 2.5 ? "constricted (miosis)" : selectedPupilSize > 5.5 ? "dilated (mydriasis)" : "normal/ambient"} range.
- ${selectedPupilSize < 2.5 ? "Common etiologies of constricted pupils (miosis) include opioid toxicity, organophosphate poisoning, pontine lesions, or deep sedatives." : selectedPupilSize > 5.5 ? "Common etiologies of dilated pupils (mydriasis) include sympathomimetic drugs, anticholinergics, CN III nerve compression (early uncal herniation), or severe hypoxic encephalopathy." : "This is a physiologically expected resting size under standard emergency department lighting conditions. Compare bilateral responses."}

**3. DIAGNOSTIC RECOMMENDATIONS**
- **Symmetry check**: Test the contralateral pupil to assess for anisocoria (pathological if >1mm difference).
- **Direct & Consensual Light Reflex**: Confirm reactivity. Fixed, dilated pupils are a neurosurgical emergency.
- **Tox-Screen / Neuroimaging**: Order as clinically indicated by systemic signs.

**4. CONTINGENCY / RED FLAG WARNINGS**
- Rapid unilateral dilation or a newly unresponsive pupil must prompt immediate head CT to rule out intracranial mass effect or uncal herniation.`;
      } else {
        return `### Bedside Airway Assessment Report (Mallampati Class ${selectedMallampatiClass})

**1. EXECUTIVE SUMMARY**
- **Assessed Grade**: Mallampati Class ${selectedMallampatiClass}
- **Objective**: Airway visibility evaluation prior to sedation or endotracheal intubation.

**2. CLINICAL CORRELATIONS & SIGNIFICANCE**
- **Class ${selectedMallampatiClass}** represents ${selectedMallampatiClass === "Class I" || selectedMallampatiClass === "Class II" ? "good visibility of the tonsillar pillars and soft palate, indicating a lower likelihood of difficult direct laryngoscopy." : "restricted airway visualization (soft or hard palate only). This strongly correlates with a high Cormack-Lehane grade and difficult endotracheal intubation (high airway risk)."}

**3. DIAGNOSTIC RECOMMENDATIONS**
- Ensure the patient was assessed while sitting upright, mouth open wide, tongue protruded, and **without phonating** to prevent false grading.
- ${selectedMallampatiClass === "Class III" || selectedMallampatiClass === "Class IV" ? "Prepare difficult airway cart. Ensure a video laryngoscope (e.g. McGrath, Glidescope) and a bougie are at the bedside." : "Standard intubation/airway setup is appropriate, but always maintain secondary backup plan."}

**4. CONTINGENCY / RED FLAG WARNINGS**
- In Class III/IV, do not attempt rapid sequence intubation (RSI) without senior clinical backup or a clear rescue strategy (e.g. surgical airway kit, bag-valve mask capability).`;
      }
    };

    try {
      const response = await fetch("/api/lens-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pupilSize: selectedPupilSize,
          activeFilter: activeFilter,
          activeOverlay: activeOverlay,
          mallampatiClass: selectedMallampatiClass,
          clinicalObservations: clinicalObservations,
        }),
      });
      const data = await response.json();
      if (data && data.success && data.report) {
        setReportText(data.report);
      } else {
        setReportText(generateLocalFallbackReport());
      }
    } catch (err: any) {
      console.warn("Report generation server call notice, activating local fallback:", err);
      setReportText(generateLocalFallbackReport());
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Markdown parsing logic matching clinical guidelines
  const formatMarkdown = (text: string) => {
    return text.split("\n").map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="h-2" />;

      // Header h3
      if (trimmed.startsWith("###")) {
        return (
          <h3 key={index} className="text-sm font-black text-indigo-400 mt-4 mb-1.5 font-mono uppercase tracking-wide">
            {trimmed.replace("###", "").trim()}
          </h3>
        );
      }
      
      // Header h2
      if (trimmed.startsWith("##")) {
        return (
          <h2 key={index} className="text-sm font-black text-white mt-5 mb-2 font-mono uppercase tracking-wider border-b border-slate-800 pb-1">
            {trimmed.replace("##", "").trim()}
          </h2>
        );
      }

      // Header h1
      if (trimmed.startsWith("#")) {
        return (
          <h1 key={index} className="text-base font-black text-white mt-6 mb-3 font-mono uppercase border-b border-slate-855 pb-1">
            {trimmed.replace("#", "").trim()}
          </h1>
        );
      }

      // Bold tips/notes
      if (trimmed.startsWith(">")) {
        return (
          <blockquote key={index} className="border-l-3 border-amber-500 bg-amber-955/10 text-amber-200 p-3 rounded-r-lg my-3 text-[10px] flex gap-2 items-start leading-relaxed font-mono">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>{trimmed.replace(">", "").trim()}</div>
          </blockquote>
        );
      }

      // List item
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        const itemContent = trimmed.substring(2);
        return (
          <li key={index} className="ml-4 list-disc text-slate-300 mb-1 leading-relaxed text-[10.5px]">
            {renderBoldText(itemContent)}
          </li>
        );
      }

      // Numbered lists
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        return (
          <li key={index} className="ml-4 list-decimal text-slate-300 mb-1 leading-relaxed text-[10.5px]">
            {renderBoldText(numberedMatch[2])}
          </li>
        );
      }

      // Normal paragraph
      return (
        <p key={index} className="text-slate-300 mb-2 leading-relaxed text-[11px] font-medium">
          {renderBoldText(trimmed)}
        </p>
      );
    });
  };

  const renderBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="px-1 py-0.5 bg-slate-950 text-indigo-400 font-mono text-[10px] rounded border border-slate-800">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

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

          {/* Guide notification when frozen */}
          {isFrozen && (
            <div className="bg-indigo-950/50 border border-indigo-900 p-4 rounded-2xl space-y-2 animate-pulse mt-4">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Frame Paired & Frozen!
              </span>
              <p className="text-[9.5px] text-slate-300 leading-normal">
                You have locked the live snapshot. Align the interactive gauges on the right (Pupil Diameter or Airway Mallampati class) to match the clinical finding, then scroll to the bottom to generate your structured Bedside Clinical Report!
              </p>
            </div>
          )}
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
                    onClick={() => setSelectedMallampatiClass(m.class)}
                    className={`p-3 rounded-2xl space-y-1.5 text-[10px] cursor-pointer transition-all border ${
                      selectedMallampatiClass === m.class 
                        ? "bg-indigo-950/50 border-indigo-500 text-white shadow-md"
                        : "bg-slate-950/70 border-slate-850 hover:border-slate-800 text-slate-300"
                    }`}
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

      {/* Persistent Bedside AI Diagnostics Assistant section */}
      <div id="ai-report-assistant" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-850 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <FileText className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider flex items-center gap-2">
                Bedside ErMate Diagnostics Assistant
                <span className="px-2 py-0.5 rounded-full text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 animate-pulse">
                  Snapshot Analysis Active
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Generate structured, EMR-ready diagnostic summaries from live gauges and observation notes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[9px] bg-slate-950/80 px-3 py-1 rounded-xl border border-slate-800 font-mono">
            <span className="text-slate-500 font-bold">STATUS:</span>
            <span className="text-emerald-400 font-black flex items-center gap-1.5 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ready
            </span>
          </div>
        </div>

        {/* Current State Summary Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-2xl space-y-1">
            <span className="text-[8.5px] text-slate-500 uppercase font-mono tracking-wider block">Assessment Mode</span>
            <span className="text-xs font-black text-white font-mono uppercase block">
              {activeOverlay === "pupil" ? "Pupil Diameter Scale" : "Mallampati Airway Scale"}
            </span>
          </div>
          <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-2xl space-y-1">
            <span className="text-[8.5px] text-slate-500 uppercase font-mono tracking-wider block">Assessed Selection</span>
            <span className="text-xs font-black text-indigo-400 font-mono block">
              {activeOverlay === "pupil" ? `${selectedPupilSize.toFixed(1)} mm` : selectedMallampatiClass}
            </span>
          </div>
          <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-2xl space-y-1">
            <span className="text-[8.5px] text-slate-500 uppercase font-mono tracking-wider block">Frame Capture State</span>
            <span className={`text-xs font-black font-mono uppercase block ${isFrozen ? "text-rose-400" : "text-amber-400"}`}>
              {isFrozen ? "🔒 Paused / Frozen Frame" : "🎥 Live Camera Mode"}
            </span>
          </div>
        </div>

        {/* Bedside observations notes */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
            <span>Clinical Observations / Bedside Notes (Optional)</span>
          </label>
          <textarea
            value={clinicalObservations}
            onChange={(e) => setClinicalObservations(e.target.value)}
            placeholder="e.g. Sluggish direct reflex, corneal reflex intact. Intubation difficult cart prepared due to poor uvula visualization..."
            className="w-full h-18 bg-slate-950 border border-slate-850 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 leading-relaxed resize-none transition-all font-medium"
          />
        </div>

        {/* Generate Clinical Report Button */}
        <button
          onClick={handleGenerateReport}
          disabled={isGeneratingReport}
          className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${
            isGeneratingReport 
              ? "bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800" 
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10 hover:-translate-y-0.5 cursor-pointer"
          }`}
        >
          {isGeneratingReport ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              Synthesizing Clinical Report with ErMate...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              Generate structured Diagnostics Report
            </>
          )}
        </button>

        {/* Display Generated Report with Markdown parsing */}
        {reportText && (
          <div className="bg-slate-950/75 border border-slate-850 rounded-2xl p-5 space-y-4 animate-fade-in relative shadow-inner">
            
            {/* Report Header */}
            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Bedside Assessment Report Ready
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reportText);
                  setCopiedReport(true);
                  setTimeout(() => setCopiedReport(false), 2000);
                }}
                className="text-[9.5px] font-bold text-slate-350 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    Copy Report to Clipboard
                  </>
                )}
              </button>
            </div>

            {/* Markdown Text Area */}
            <div className="text-left space-y-3.5 max-h-[350px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-800 text-[11px] leading-relaxed">
              {formatMarkdown(reportText)}
            </div>

            {/* Clinician disclaimer instructions */}
            <div className="bg-indigo-950/15 border border-indigo-900/30 p-4 rounded-xl text-[10px] text-slate-400 font-mono leading-relaxed">
              <strong className="text-indigo-400 block mb-1">💡 EMR INTEGRATION PROTOCOL:</strong>
              This assessment outline has been generated using the <strong>ErMate Clinical Engine</strong>. Clinicians are advised to confirm matched physical measurements and adapt output as needed before incorporating into official medical logs or EMR progress sheets.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
