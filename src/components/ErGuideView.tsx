import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowLeft, Info, Activity, ShieldAlert, Clock, Scale, 
  Ruler, Stethoscope, Layers, AlertCircle, Check, HelpCircle, 
  ChevronRight, ChevronDown, ChevronUp, RefreshCw, Zap, Wind,
  BookOpen, Plus, ThumbsUp, Trash2, ShieldCheck, Mail, User,
  Camera, Upload
} from "lucide-react";
import { 
  RSI_7_PS, INDUCTION_AGENTS, PARALYTIC_AGENTS, 
  SEDATION_AGENTS, VENT_STRATEGIES, CENTRAL_LINE_PROTOCOLS, 
  ARTERIAL_LINE_PROTOCOLS, BIPAP_CPAP_GUIDELINES, NEUROPROTECTIVE_GUIDELINES 
} from "../data/em_procedures";
import { db, auth } from "../firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";

interface EMDrugsViewProps {
  onBack: () => void;
  isDarkMode?: boolean;
}

type EMSectionTab = "rsi" | "sedation" | "vent" | "bipap" | "neuro" | "lines" | "dialysis" | "mnemonics";

export default function ErGuideView({ onBack, isDarkMode }: EMDrugsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<EMSectionTab>("rsi");

  // RSI Calculator State
  const [rsiWeight, setRsiWeight] = useState<string>("70");
  const parsedRsiWeight = parseFloat(rsiWeight);
  const isRsiWeightValid = !isNaN(parsedRsiWeight) && parsedRsiWeight > 0;

  // Sedation Calculator State
  const [sedationWeight, setSedationWeight] = useState<string>("70");
  const parsedSedationWeight = parseFloat(sedationWeight);
  const isSedationWeightValid = !isNaN(parsedSedationWeight) && parsedSedationWeight > 0;
  const [selectedSedationAgentId, setSelectedSedationAgentId] = useState<number>(0);

  // Ventilator Ideal Body Weight (IBW) Calculator State
  const [ventGender, setVentGender] = useState<"male" | "female">("male");
  const [ventHeightUnit, setVentHeightUnit] = useState<"cm" | "in">("cm");
  const [ventHeightCm, setVentHeightCm] = useState<string>("175");
  const [ventHeightIn, setVentHeightIn] = useState<string>("69");

  // Expanded card trackers
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Compute Ideal Body Weight (IBW) based on Devine Formula
  const ibwDetails = useMemo(() => {
    let heightInInches = 60;
    if (ventHeightUnit === "cm") {
      const cm = parseFloat(ventHeightCm);
      if (!isNaN(cm) && cm > 0) {
        heightInInches = cm / 2.54;
      }
    } else {
      const inches = parseFloat(ventHeightIn);
      if (!isNaN(inches) && inches > 0) {
        heightInInches = inches;
      }
    }

    const inchesOver60 = heightInInches - 60;
    let ibw = 0;
    if (ventGender === "male") {
      ibw = 50 + 2.3 * inchesOver60;
    } else {
      ibw = 45.5 + 2.3 * inchesOver60;
    }

    // Safety bounds
    if (ibw < 10) ibw = 0;

    return {
      ibw: Math.round(ibw * 10) / 10,
      vt4: Math.round(ibw * 4),
      vt6: Math.round(ibw * 6),
      vt7: Math.round(ibw * 7),
      vt8: Math.round(ibw * 8)
    };
  }, [ventGender, ventHeightUnit, ventHeightCm, ventHeightIn]);

  // Static reference data for dialysis & mnemonics
  const AEIOU_DIALYSIS = [
    {
      letter: "A",
      word: "Acidosis",
      description: "Severe, refractory metabolic acidosis (typically pH < 7.1 - 7.2) unresponsive to medical therapy (e.g. bicarbonate loading). Especially associated with acute kidney injury or toxic ingestions.",
      symptoms: ["Severe tachypnea / Kussmaul breathing", "Cardiovascular instability", "Refractory hyperkalemia"]
    },
    {
      letter: "E",
      word: "Electrolytes",
      description: "Severe, refractory hyperkalemia (Potassium > 6.5 mEq/L) or rapidly rising potassium despite medical management (calcium gluconate, insulin + dextrose, nebulized beta-agonists, loop diuretics).",
      symptoms: ["EKG changes (peaked T waves, PR prolongation, QRS widening)", "Bradyarrhythmias or heart block", "Muscle weakness"]
    },
    {
      letter: "I",
      word: "Intoxication",
      description: "Acute poisoning with dialyzable toxins (SLIME mnemonic: Salicylates, Lithium, Isopropanol, Methanol/Ethylene glycol, Elixir/Theophylline/Phenobarbital). Urgent dialysis clears the bloodstream of poison.",
      symptoms: ["Altered mental status", "Severe metabolic acidosis", "Visual disturbances (methanol)", "Seizures"]
    },
    {
      letter: "O",
      word: "Overload",
      description: "Refractory volume overload (typically acute pulmonary edema) unresponsive to high-dose diuretics, particularly in the setting of oliguric or anuric acute kidney injury.",
      symptoms: ["Severe respiratory distress / hypoxia", "Bilateral rales", "Diffuse pulmonary infiltrates on chest X-ray"]
    },
    {
      letter: "U",
      word: "Uremia",
      description: "Severe, symptomatic uremia from advanced renal failure (typically BUN > 80-100 mg/dL). Indications are clinical symptoms, not just lab numbers.",
      symptoms: ["Uremic pericarditis (rub, chest pain)", "Uremic encephalopathy (asterixis, seizures, coma)", "Uremic bleeding / platelet dysfunction", "Nausea, vomiting, severe anorexia"]
    }
  ];

  const DIALYSIS_TYPES = [
    {
      name: "Hemodialysis (HD) - Intermittent",
      duration: "3-4 hours per session",
      indications: "First-line for acute toxic ingestions, hyperkalemia, or fluid overload in hemodynamically stable patients.",
      positives: "Rapid solute and toxin clearance. Highly efficient.",
      negatives: "Causes rapid fluid shifts, risks hypotension. Requires stable blood pressure."
    },
    {
      name: "Continuous Renal Replacement Therapy (CRRT)",
      duration: "Continuous (24 hrs/day)",
      indications: "Ideal for hemodynamically unstable patients in the ICU with sepsis, fluid overload, or multi-organ failure.",
      positives: "Extremely gentle, continuous fluid removal. Prevents cardiovascular collapse.",
      negatives: "Highly resource-intensive, expensive, requires continuous anticoagulation. Very slow toxin clearance."
    },
    {
      name: "Sustained Low-Efficiency Dialysis (SLED)",
      duration: "8-12 hours per session",
      indications: "Hybrid therapy. Gentle clearance for border-line unstable patients in intensive care.",
      positives: "Better cardiovascular tolerance than intermittent HD, less expensive and complex than CRRT.",
      negatives: "Requires specialized nursing care, restricts patient mobility for longer periods."
    },
    {
      name: "Peritoneal Dialysis (PD)",
      duration: "Continuous or cycled overnight",
      indications: "Mainly chronic maintenance. Rarely used in adult emergencies, but may be used in pediatric ERs or where vascular access is impossible.",
      positives: "No vascular access required, can be performed at home, gentle fluid shifts.",
      negatives: "Risk of peritonitis, slow solute clearance, ineffective for hyperacute clearance of severe hyperkalemia."
    }
  ];

  const BUILTIN_MNEMONICS = [
    {
      id: "high-sugar",
      title: "5 I's: Causes of High Sugar (DKA/HHS)",
      mnemonic: "5 I's",
      category: "Metabolic / Endocrinology",
      breakdown: `* **Infection**: UTI, pneumonia, sepsis (most common trigger of DKA/HHS)
* **Infarction**: Myocardial infarction, stroke, mesenteric ischemia (silent stress response)
* **Infant / Pregnancy**: Gestational stress or undiagnosed pregnancy
* **Indiscretion / Diet**: High glucose intake, missed meals
* **Insulin Omission**: Non-compliance, pump failure, or lack of insulin supply`,
      explanation: "When evaluating a patient presenting with high blood sugar, diabetic ketoacidosis (DKA), or hyperosmolar hyperglycemic state (HHS), you must actively search for these 5 critical underlying triggers."
    },
    {
      id: "dialysis-aeiou",
      title: "AEIOU: Emergency Dialysis Indications",
      mnemonic: "AEIOU",
      category: "Nephrology",
      breakdown: `* **A** - **Acidosis**: Severe metabolic acidosis (pH < 7.1) refractory to therapy.
* **E** - **Electrolytes**: Hyperkalemia (K > 6.5) with ECG changes or refractory to medical therapy.
* **I** - **Intoxicants**: Dialyzable poisonings (Salicylates, Lithium, Isopropanol, Methanol, Ethylene glycol).
* **O** - **Overload**: Fluid overload (pulmonary edema) refractory to diuretics.
* **U** - **Uremia**: Symptomatic uremia (encephalopathy, pericarditis, bleeding).`,
      explanation: "Classic nephrology mnemonic used to determine immediate clinical eligibility for acute renal replacement therapy."
    },
    {
      id: "syncope-chess",
      title: "CHESS: San Francisco Syncope Rule",
      mnemonic: "CHESS",
      category: "Cardiology",
      breakdown: `* **C** - **Congestive Heart Failure**: History of CHF or active signs.
* **H** - **Hematocrit**: Hct < 30% (indicates occult bleeding or severe anemia).
* **E** - **ECG Abnormalities**: New EKG changes, arrhythmias, or QTc prolongation.
* **S** - **Shortness of Breath**: Symptom of pulmonary embolism, heart failure, or ischemia.
* **S** - **Systolic BP < 90**: Hypotension recorded at triage or in transit.`,
      explanation: "Risk-stratification mnemonic to identify patients with syncope who are at high risk for serious outcomes within 30 days."
    },
    {
      id: "arrest-causes",
      title: "5 H's & 5 T's: Reversible Causes of Cardiac Arrest",
      mnemonic: "5 H's & 5 T's",
      category: "Resuscitation",
      breakdown: `* **Hypovolemia**: Severe dehydration or hemorrhagic shock (give fluids/blood).
* **Hypoxia**: Severe respiratory failure (ensure airway and oxygenation).
* **Hydrogen ion (Acidosis)**: Severe acidosis (provide ventilation, consider sodium bicarbonate).
* **Hypo- / Hyperkalemia**: Electrolyte disturbances (treat with calcium, insulin, dextrose).
* **Hypothermia**: Core temperature < 35°C (active rewarming).
* **Tension Pneumothorax**: Air trapped in pleural space (urgent needle decompression).
* **Tamponade (Cardiac)**: Fluid in pericardial sac (needle pericardiocentesis).
* **Toxins**: Accidental or intentional poisoning (administer specific antidotes).
* **Thrombosis (Pulmonary)**: Massive PE (consider thrombolytics).
* **Thrombosis (Coronary)**: Acute MI (reperfusion/coronary intervention).`,
      explanation: "Crucial checklist to run through during any active advanced cardiac life support (ACLS) resuscitation attempt to identify and reverse the cause of arrest."
    },
    {
      id: "intubation-soapme",
      title: "SOAP ME: Rapid Sequence Intubation Preparation",
      mnemonic: "SOAP ME",
      category: "Airway",
      breakdown: `* **S** - **Suction**: Turn on suction, place yankauer under right shoulder.
* **O** - **Oxygen**: Set up NRB and nasal cannula for preoxygenation & apneic oxygenation.
* **A** - **Airway**: Select blades (MAC 3/4, Miller 3), ETT tubes (7.0, 7.5, 8.0), stylets, LMA.
* **P** - **Pharmacy**: Draw up induction agent, paralytic, post-intubation sedation, vasoactive drugs.
* **M** - **Monitoring**: Confirm pulse ox, BP cuff, cardiac monitor, and quantitative EtCO2 are active.
* **E** - **Equipment / End-Tidal**: Ensure colorimetric or waveform capnograph is ready to attach.`,
      explanation: "Standardized equipment checklist to be performed before push-dose induction medications are given, to prevent catastrophic airway preparation failure."
    },
    {
      id: "heart-score",
      title: "HEART Score: Chest Pain Risk Stratification",
      mnemonic: "HEART",
      category: "Cardiology",
      breakdown: `* **H** - **History**: Highly suspicious (2), Moderately suspicious (1), Slightly suspicious (0)
* **E** - **ECG**: Significant ST depression (2), LBBB/LVH/Repol changes (1), Normal (0)
* **A** - **Age**: >= 65 years (2), 45-64 years (1), < 45 years (0)
* **R** - **Risk Factors**: >= 3 risk factors or history of CAD (2), 1-2 risk factors (1), No risk factors (0)
* **T** - **Troponin**: >= 3x normal limit (2), 1-3x normal limit (1), Normal limit (0)`,
      explanation: "Calculated score (0-10) determining the 6-week risk of a major adverse cardiac event (MACE) to safely guide discharge from the ER."
    },
    {
      id: "navel-ett",
      title: "NAVEL: Endotracheal Tube Medications",
      mnemonic: "NAVEL",
      category: "Pharmacology / Resuscitation",
      breakdown: `* **N** - **Naloxone**: For opioid overdose resuscitation
* **A** - **Atropine**: For bradyarrhythmias or organophosphate poisoning
* **V** - **Vasopressin**: Can be used as alternative vasopressor in arrest
* **E** - **Epinephrine (Adrenaline)**: Core resuscitation drug for arrest
* **L** - **Lidocaine**: For ventricular dysrhythmias`,
      explanation: "Mnemonic listing medications that can be safely administered directly through an endotracheal tube if intravenous or intraosseous access is not yet established."
    }
  ];

  // Contribution states
  const [contributions, setContributions] = useState<any[]>([]);
  const [mnemonicSearch, setMnemonicSearch] = useState<string>("");
  const [showContributeForm, setShowContributeForm] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>("");
  const [formMnemonic, setFormMnemonic] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("Cardiology");
  const [formBreakdown, setFormBreakdown] = useState<string>("");
  const [formExplanation, setFormExplanation] = useState<string>("");
  const [formSubmitterName, setFormSubmitterName] = useState<string>("");
  const [formSubmitterEmail, setFormSubmitterEmail] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mnemonic OCR/Scanning states
  const [isScanningMnemonic, setIsScanningMnemonic] = useState<boolean>(false);
  const [mnemonicScanError, setMnemonicScanError] = useState<string | null>(null);
  const [mnemonicScanSuccess, setMnemonicScanSuccess] = useState<string | null>(null);

  const handleScanMnemonicImage = async (file: File) => {
    setIsScanningMnemonic(true);
    setMnemonicScanError(null);
    setMnemonicScanSuccess(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result?.toString().split(",")[1];
      if (!base64String) {
        setMnemonicScanError("Could not process the uploaded image file.");
        setIsScanningMnemonic(false);
        return;
      }

      try {
        const response = await fetch("/api/scan-mnemonic", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: base64String,
            mimeType: file.type || "image/jpeg"
          })
        });

        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          setFormTitle(data.title || "");
          setFormMnemonic(data.mnemonic || "");
          if (data.category) {
            setFormCategory(data.category);
          }
          setFormBreakdown(data.breakdown || "");
          setFormExplanation(data.explanation || "");

          if (result.simulated) {
            setMnemonicScanSuccess("Scan finished using backup clinical parser! Please review fields below.");
          } else {
            setMnemonicScanSuccess("Mnemonic scan complete! Fields populated via ErMate.");
          }
        } else {
          setMnemonicScanError(result.error || "Failed to analyze the mnemonic screenshot.");
        }
      } catch (err: any) {
        console.error("Mnemonic scan error:", err);
        setMnemonicScanError("Network error: Failed to connect to scanning service.");
      } finally {
        setIsScanningMnemonic(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // Sync contributions from Firestore
  useEffect(() => {
    // Populate defaults from auth if user is signed in
    if (auth.currentUser) {
      setFormSubmitterName(auth.currentUser.displayName || "");
      setFormSubmitterEmail(auth.currentUser.email || "");
    }

    const q = query(collection(db, "contributions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContributions(docs);
    }, (err) => {
      console.error("Error loading contributions from Firestore: ", err);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formMnemonic || !formCategory || !formBreakdown) {
      setSubmitMessage({ type: "error", text: "Please fill in all required fields." });
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const emailToUse = (auth.currentUser?.email || formSubmitterEmail || "anonymous@ermate.in").trim().toLowerCase();
      const nameToUse = auth.currentUser?.displayName || formSubmitterName || "Anonymous Clinician";

      const contributionId = `contrib_${Date.now()}`;
      await setDoc(doc(db, "contributions", contributionId), {
        id: contributionId,
        title: formTitle,
        mnemonic: formMnemonic,
        category: formCategory,
        breakdown: formBreakdown,
        explanation: formExplanation,
        status: "pending", // Always pending initially, requiring peer review
        submittedBy: nameToUse,
        submitterEmail: emailToUse,
        createdAt: new Date().toISOString()
      });

      setSubmitMessage({ type: "success", text: "Mnemonic submitted successfully! It is now pending peer review." });
      // Reset form
      setFormTitle("");
      setFormMnemonic("");
      setFormCategory("Cardiology");
      setFormBreakdown("");
      setFormExplanation("");
      
      // Auto close form after 3 seconds
      setTimeout(() => {
        setShowContributeForm(false);
        setSubmitMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error submitting contribution:", err);
      setSubmitMessage({ type: "error", text: err.message || "Failed to submit contribution. Please check your login status." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveContribution = async (id: string, firestoreDocId: string) => {
    try {
      const docRef = doc(db, "contributions", firestoreDocId);
      await updateDoc(docRef, { status: "approved" });
    } catch (err) {
      console.error("Error approving contribution:", err);
    }
  };

  const handleDeleteContribution = async (firestoreDocId: string) => {
    try {
      const docRef = doc(db, "contributions", firestoreDocId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting contribution:", err);
    }
  };

  // Helper to safely format decimal values
  const formatVal = (val: number) => (isNaN(val) || val <= 0 ? "—" : val.toString());

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 p-4 md:p-6 pb-20 font-sans" id="em-drugs-and-procedures-view">
      
      {/* 1. Header Area */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs transition-all flex items-center justify-center"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black font-display tracking-tight text-slate-900 dark:text-white">
                Er Guide
              </h1>
              <span className="text-[10px] bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 font-extrabold px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-wide">
                Critical Care
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Standardized reference protocols based on Rosens Emergency Medicine & Life in the Fast Lane
            </p>
          </div>
        </div>
 
        {/* Global Warning Badge */}
        <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs max-w-md">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-amber-700 dark:text-amber-400/90 leading-tight font-medium">
            <strong>Clinical Support Tool:</strong> Dosing formulas and recommendations require independent expert validation before administration.
          </span>
        </div>
      </div>
 
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 2. Side Tab Navigation Menu (Left, Span 3) */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pr-0 lg:pr-4">
          {[
            { id: "rsi" as const, label: "RSI Protocol", icon: ShieldAlert, color: "text-red-500 bg-red-500/10" },
            { id: "sedation" as const, label: "Procedural Sedation", icon: Zap, color: "text-amber-500 bg-amber-500/10" },
            { id: "vent" as const, label: "Ventilator Settings", icon: Wind, color: "text-indigo-500 bg-indigo-500/10" },
            { id: "bipap" as const, label: "BiPAP & CPAP", icon: Layers, color: "text-teal-500 bg-teal-500/10" },
            { id: "neuro" as const, label: "Neuroprotective Care", icon: Activity, color: "text-purple-500 bg-purple-500/10" },
            { id: "lines" as const, label: "Central & Art Lines", icon: Stethoscope, color: "text-blue-500 bg-blue-500/10" },
            { id: "dialysis" as const, label: "Dialysis Guide", icon: RefreshCw, color: "text-indigo-600 bg-indigo-600/10" },
            { id: "mnemonics" as const, label: "Clinical Mnemonics", icon: BookOpen, color: "text-emerald-500 bg-emerald-500/10" }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id);
                  setExpandedSection(null);
                }}
                className={`flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap text-left w-full ${
                  active 
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold border-l-3 border-emerald-500" 
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850"
                }`}
              >
                <div className={`p-1.5 rounded-lg ${tab.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 3. Main Display Screen (Right, Span 9) */}
        <div className="lg:col-span-9 space-y-6">

          {/* TAB 1: RAPID SEQUENCE INTUBATION */}
          {activeSubTab === "rsi" && (
            <div className="space-y-6 animate-fade-in" id="rsi-view-panel">
              
              {/* Weight-Based RSI Calculator */}
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-display">
                        RSI Drug Dose Calculator
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        Weight-based adult dose estimator for rapid emergency induction & paralysis
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 font-mono">Weight:</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        value={rsiWeight}
                        onChange={(e) => setRsiWeight(e.target.value)}
                        placeholder="kg"
                        className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-center font-mono focus:outline-none focus:border-red-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 font-mono">KG</span>
                    </div>
                  </div>
                </div>

                {isRsiWeightValid ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Induction Agents Block */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                        Induction Agents
                      </h4>
                      <div className="space-y-2.5">
                        {[
                          { name: "Ketamine", formula: "2.0 mg/kg", dose: parsedRsiWeight * 2, prep: "Typically 10 mg/mL or 50 mg/mL" },
                          { name: "Etomidate", formula: "0.3 mg/kg", dose: parsedRsiWeight * 0.3, prep: "Typically 2 mg/mL" },
                          { name: "Propofol", formula: "1.5 mg/kg", dose: parsedRsiWeight * 1.5, prep: "Typically 10 mg/mL (1%)" },
                          { name: "Midazolam", formula: "0.2 mg/kg", dose: parsedRsiWeight * 0.2, prep: "Typically 5 mg/mL" }
                        ].map((item, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="block text-xs font-extrabold text-slate-850 dark:text-slate-100">{item.name}</span>
                              <span className="block text-[9px] text-slate-400 font-mono">{item.formula} • {item.prep}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-red-600 dark:text-red-400 font-mono">
                                {Math.round(item.dose * 10) / 10} mg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Paralytic Agents Block */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                        Paralytic Agents
                      </h4>
                      <div className="space-y-2.5">
                        {[
                          { name: "Succinylcholine", formula: "2.0 mg/kg", dose: parsedRsiWeight * 2, prep: "Typically 20 mg/mL" },
                          { name: "Rocuronium", formula: "1.2 mg/kg", dose: parsedRsiWeight * 1.2, prep: "Typically 10 mg/mL" },
                          { name: "Vecuronium", formula: "0.15 mg/kg", dose: parsedRsiWeight * 0.15, prep: "Typically 10 mg vial (reconstituted)" }
                        ].map((item, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="block text-xs font-extrabold text-slate-850 dark:text-slate-100">{item.name}</span>
                              <span className="block text-[9px] text-slate-400 font-mono">{item.formula} • {item.prep}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                {Math.round(item.dose * 10) / 10} mg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 font-mono">
                    Please enter a valid weight to calculate standard dosages.
                  </div>
                )}
              </div>

              {/* The 7 Ps of RSI Accordion */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  The 7 Ps Sequence of RSI
                </h3>
                <div className="space-y-2.5">
                  {RSI_7_PS.map((step) => {
                    const isExpanded = expandedSection === step.step;
                    return (
                      <div 
                        key={step.step}
                        className="bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden shadow-xs"
                      >
                        <button
                          onClick={() => setExpandedSection(isExpanded ? null : step.step)}
                          className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 dark:hover:dark:bg-slate-900/40 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs flex items-center justify-center">
                              {step.step}
                            </span>
                            <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                              {step.title}
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-850 space-y-3 animate-fade-in text-xs leading-relaxed text-slate-650 dark:text-slate-350">
                            <p>{step.description}</p>
                            {step.pearls && step.pearls.length > 0 && (
                              <div className="p-3 bg-teal-500/5 border border-teal-500/10 rounded-lg">
                                <span className="block text-[10px] font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-wider font-mono mb-1">
                                  Clinical Pearls
                                </span>
                                <ul className="list-disc pl-4 space-y-1 text-[11px] text-teal-800 dark:text-teal-400/90 font-medium">
                                  {step.pearls.map((p, pIdx) => <li key={pIdx}>{p}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Induction & Paralytic Drug Reference List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Induction Agents Reference */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                    Induction Drug Guide
                  </h3>
                  <div className="space-y-3">
                    {INDUCTION_AGENTS.map((agent, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl p-4 space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-black text-slate-800 dark:text-white">{agent.name}</span>
                            <span className="block text-[9px] text-slate-400 font-mono">{agent.class}</span>
                          </div>
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 font-mono bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10">
                            {agent.ivDose}
                          </span>
                        </div>
                        <div className="text-[11px] space-y-1.5 font-sans leading-relaxed text-slate-600 dark:text-slate-400">
                          <p><strong>Onset:</strong> {agent.onset} | <strong>Duration:</strong> {agent.duration}</p>
                          <p><strong>Contraindications:</strong> {agent.contraindications.join(", ")}</p>
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-850">
                            <span className="block text-[9px] font-bold text-slate-400 font-mono uppercase">Key Pearls</span>
                            <ul className="list-disc pl-4 text-[10px] space-y-0.5 mt-1 font-mono">
                              {agent.pearls.map((p, pidx) => <li key={pidx}>{p}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Paralytic Agents Reference */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                    Paralytic Drug Guide
                  </h3>
                  <div className="space-y-3">
                    {PARALYTIC_AGENTS.map((agent, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl p-4 space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-black text-slate-800 dark:text-white">{agent.name}</span>
                            <span className="block text-[9px] text-slate-400 font-mono">{agent.class}</span>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                            {agent.dose}
                          </span>
                        </div>
                        <div className="text-[11px] space-y-1.5 font-sans leading-relaxed text-slate-600 dark:text-slate-400">
                          <p><strong>Onset:</strong> {agent.onset} | <strong>Duration:</strong> {agent.duration}</p>
                          <p><strong>Contraindications:</strong> {agent.contraindications.join(", ")}</p>
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-850">
                            <span className="block text-[9px] font-bold text-slate-400 font-mono uppercase">Key Pearls</span>
                            <ul className="list-disc pl-4 text-[10px] space-y-0.5 mt-1 font-mono">
                              {agent.pearls.map((p, pidx) => <li key={pidx}>{p}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: PROCEDURAL SEDATION */}
          {activeSubTab === "sedation" && (
            <div className="space-y-6 animate-fade-in" id="sedation-view-panel">
              
              {/* Interactive Sedation Calculator */}
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-display">
                        Procedural Sedation Dosing Tool
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        Estimates sedation agent bolus amounts based on patient weight and clinical drug selection
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 font-mono">Weight:</span>
                      <div className="relative w-24">
                        <input
                          type="number"
                          value={sedationWeight}
                          onChange={(e) => setSedationWeight(e.target.value)}
                          placeholder="kg"
                          className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-center font-mono focus:outline-none focus:border-amber-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 font-mono">KG</span>
                      </div>
                    </div>
                  </div>
                </div>

                {isSedationWeightValid ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {SEDATION_AGENTS.map((agent, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedSedationAgentId(index)}
                          className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                            selectedSedationAgentId === index
                              ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 font-extrabold"
                              : "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {agent.name}
                        </button>
                      ))}
                    </div>

                    {/* Calculated Output Card */}
                    {(() => {
                      const agent = SEDATION_AGENTS[selectedSedationAgentId];
                      let calculatedMg = "";
                      let secondaryMg = "";

                      if (agent.name === "Ketamine") {
                        calculatedMg = `${parsedSedationWeight * 1} - ${parsedSedationWeight * 2} mg IV`;
                        secondaryMg = `${parsedSedationWeight * 4} - ${parsedSedationWeight * 5} mg IM`;
                      } else if (agent.name === "Propofol") {
                        calculatedMg = `${parsedSedationWeight * 0.5} - ${parsedSedationWeight * 1.0} mg IV loading`;
                      } else if (agent.name === "Etomidate") {
                        calculatedMg = `${Math.round(parsedSedationWeight * 0.1 * 10) / 10} - ${Math.round(parsedSedationWeight * 0.2 * 10) / 10} mg IV`;
                      } else if (agent.name === "Dexmedetomidine") {
                        calculatedMg = `${parsedSedationWeight * 1} mcg IV load (over 10 mins)`;
                      } else if (agent.name.includes("Ketofol")) {
                        // Ketofol (0.5mg/kg of mixed 1:1 solution)
                        calculatedMg = `${parsedSedationWeight * 0.5} mg IV of combined formula`;
                      }

                      return (
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-500/10 uppercase tracking-wide">
                              {agent.name} Calculated Dose
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              Weight-based calculation: {agent.ivDose}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                              {calculatedMg}
                            </div>
                            {secondaryMg && (
                              <div className="text-xs font-bold text-indigo-500 font-mono">
                                IM Dose: {secondaryMg}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 font-mono">
                    Please enter a weight to calculate dose estimation.
                  </div>
                )}
              </div>

              {/* Sedation Agent Reference Grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Procedural Sedation Drug Reference
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SEDATION_AGENTS.map((agent, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-black text-slate-850 dark:text-white">{agent.name}</span>
                          <span className="block text-[9px] text-slate-400 font-mono">{agent.class}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-slate-400 font-mono uppercase block">Standard Dose</span>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                            {agent.ivDose}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                        <div>
                          <span className="text-slate-400">Onset:</span> <strong className="text-slate-700 dark:text-slate-300">{agent.onset}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Duration:</span> <strong className="text-slate-700 dark:text-slate-300">{agent.duration}</strong>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-2 leading-relaxed">
                        <p className="text-slate-655"><strong>Indications:</strong> {agent.indications.join(" ")}</p>
                        {agent.contraindications.length > 0 && (
                          <p className="text-red-600/90 dark:text-red-400/90 font-medium"><strong>Avoid in:</strong> {agent.contraindications.join(", ")}</p>
                        )}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-850">
                          <span className="block text-[9px] font-black text-slate-400 font-mono uppercase tracking-wider mb-1">Clinical Practice Pearls</span>
                          <ul className="list-disc pl-4 text-[10px] text-slate-550 dark:text-slate-400 space-y-1 font-mono">
                            {agent.pearls.map((p, pIdx) => <li key={pIdx}>{p}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Standard Monitoring Requirements */}
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-2.5">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Procedural Sedation Monitoring Standards
                </span>
                <ul className="list-disc pl-5 text-[11px] text-slate-600 dark:text-slate-450 space-y-1 leading-relaxed">
                  <li><strong>Personnel:</strong> Requires at least one trained physician to administer drugs and monitor the patient, and a second practitioner to perform the procedure itself.</li>
                  <li><strong>Airway Kit:</strong> Full emergency kit (BVM with PEEP valve, suction, oral/nasal airways, LMA, and intubation gear) MUST be fully functioning and at the bedside.</li>
                  <li><strong>Monitoring:</strong> Continuous pulse oximetry, cardiac rhythm monitoring (ECG), blood pressure (every 2-3 minutes), and quantitative end-tidal capnography (EtCO2 - which detects hypoventilation/apnea minutes before pulse oximetry drops).</li>
                  <li><strong>Recovery:</strong> Monitor continuously until the patient reaches baseline mental status, can sit or speak clearly, and airway reflexes are fully intact.</li>
                </ul>
              </div>

            </div>
          )}

          {/* TAB 3: VENTILATOR SETTINGS */}
          {activeSubTab === "vent" && (
            <div className="space-y-6 animate-fade-in" id="vent-view-panel">
              
              {/* Predicted Tidal Volume & IBW Calculator */}
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                      <Wind className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-display">
                        Ideal Body Weight & Tidal Volume Tool
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        Calculates predicted tidal volume (mL) based on gender and height to support lung-protective ventilation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVentGender("male")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                        ventGender === "male"
                          ? "bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-450 font-extrabold"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      Male
                    </button>
                    <button
                      onClick={() => setVentGender("female")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                        ventGender === "female"
                          ? "bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-450 font-extrabold"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      Female
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  
                  {/* Inputs */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 font-mono uppercase">Unit Choice:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setVentHeightUnit("cm")}
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded font-mono ${
                            ventHeightUnit === "cm"
                              ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          Centimeters
                        </button>
                        <button
                          onClick={() => setVentHeightUnit("in")}
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded font-mono ${
                            ventHeightUnit === "in"
                              ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          Inches
                        </button>
                      </div>
                    </div>

                    {ventHeightUnit === "cm" ? (
                      <div className="relative">
                        <input
                          type="number"
                          value={ventHeightCm}
                          onChange={(e) => setVentHeightCm(e.target.value)}
                          placeholder="Height in cm"
                          className="w-full pl-4 pr-12 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs font-bold font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 font-mono">CM</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          value={ventHeightIn}
                          onChange={(e) => setVentHeightIn(e.target.value)}
                          placeholder="Height in inches"
                          className="w-full pl-4 pr-12 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs font-bold font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 font-mono">IN</span>
                      </div>
                    )}
                  </div>

                  {/* Outputs */}
                  <div className="md:col-span-7 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-white dark:bg-slate-950/60 rounded-xl border border-slate-150 dark:border-slate-850">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Calculated IBW</span>
                      <strong className="text-sm font-black text-slate-850 dark:text-white font-mono">{formatVal(ibwDetails.ibw)} kg</strong>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-slate-950/60 rounded-xl border border-slate-150 dark:border-slate-850">
                      <span className="block text-[9px] font-bold text-emerald-500 uppercase font-mono">ARDS (6 mL/kg)</span>
                      <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatVal(ibwDetails.vt6)} mL</strong>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-slate-950/60 rounded-xl border border-slate-150 dark:border-slate-850">
                      <span className="block text-[9px] font-bold text-indigo-500 uppercase font-mono">Severe (7 mL/kg)</span>
                      <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">{formatVal(ibwDetails.vt7)} mL</strong>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-slate-950/60 rounded-xl border border-slate-150 dark:border-slate-850">
                      <span className="block text-[9px] font-bold text-teal-500 uppercase font-mono">Standard (8 mL/kg)</span>
                      <strong className="text-sm font-black text-teal-600 dark:text-teal-400 font-mono">{formatVal(ibwDetails.vt8)} mL</strong>
                    </div>
                  </div>

                </div>
              </div>

              {/* Vent Strategy Detail Cards */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Ventilator Clinical Strategies
                </h3>
                <div className="space-y-4">
                  {VENT_STRATEGIES.map((strategy, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 space-y-4 shadow-xs">
                      
                      {/* Header */}
                      <div className="border-b border-slate-100 dark:border-slate-850 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-black text-slate-850 dark:text-white font-display">
                            {strategy.name}
                          </h4>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                            Indication: {strategy.indication}
                          </span>
                        </div>
                      </div>

                      {/* settings parameters list */}
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 bg-slate-50/60 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 text-xs font-sans">
                        <div className="sm:col-span-1.5">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Mode</span>
                          <strong className="text-slate-800 dark:text-white font-mono">{strategy.settings.mode}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Tidal Volume</span>
                          <strong className="text-slate-800 dark:text-white font-mono">{strategy.settings.tidalVolume}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Rate (bpm)</span>
                          <strong className="text-slate-800 dark:text-white font-mono">{strategy.settings.rate}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">PEEP</span>
                          <strong className="text-slate-800 dark:text-white font-mono">{strategy.settings.peep}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">FiO2</span>
                          <strong className="text-slate-800 dark:text-white font-mono">{strategy.settings.fio2}</strong>
                        </div>
                      </div>

                      {/* Targets & Pearls */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-sans">
                        <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl">
                          <span className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider">Clinical Practice Targets</span>
                          <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-450 font-mono">
                            {strategy.targets.map((t, tIdx) => <li key={tIdx}>{t}</li>)}
                          </ul>
                        </div>
                        <div className="space-y-1.5 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                          <span className="block text-[9px] font-bold text-indigo-600 dark:text-indigo-400 font-mono uppercase tracking-wider">Ventilation Pearls</span>
                          <ul className="list-disc pl-4 space-y-1 text-indigo-950 dark:text-indigo-400/90 font-mono">
                            {strategy.clinicalPearls.map((p, pIdx) => <li key={pIdx}>{p}</li>)}
                          </ul>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: BIPAP & CPAP */}
          {activeSubTab === "bipap" && (
            <div className="space-y-6 animate-fade-in" id="bipap-view-panel">
              
              {/* CPAP and BiPAP Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* CPAP Block */}
                <div className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2.5">
                      <span className="text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 font-black px-2 py-0.5 rounded font-mono uppercase tracking-wider">CPAP</span>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white font-display">
                        {BIPAP_CPAP_GUIDELINES.cpap.title}
                      </h4>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-550 dark:text-slate-400 font-medium">
                      {BIPAP_CPAP_GUIDELINES.cpap.definition}
                    </p>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Starting Settings</span>
                      <strong className="text-xs text-slate-800 dark:text-white font-mono">{BIPAP_CPAP_GUIDELINES.cpap.startingSettings}</strong>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      <strong>How it works:</strong> {BIPAP_CPAP_GUIDELINES.cpap.mechanism}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-850 space-y-1.5 text-[11px]">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Primary Indications</span>
                    <ul className="list-disc pl-4 text-slate-655 font-mono space-y-0.5">
                      {BIPAP_CPAP_GUIDELINES.cpap.indications.map((ind, i) => <li key={i}>{ind}</li>)}
                    </ul>
                  </div>
                </div>

                {/* BiPAP Block */}
                <div className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black px-2 py-0.5 rounded font-mono uppercase tracking-wider">BiPAP</span>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white font-display">
                      {BIPAP_CPAP_GUIDELINES.bipap.title}
                    </h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-550 dark:text-slate-400 font-medium">
                    {BIPAP_CPAP_GUIDELINES.bipap.definition}
                  </p>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Starting Settings</span>
                    <strong className="text-xs text-slate-800 dark:text-white font-mono">{BIPAP_CPAP_GUIDELINES.bipap.startingSettings}</strong>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Titration Protocols</span>
                    <ul className="list-disc pl-4 text-slate-655 font-mono space-y-1">
                      {BIPAP_CPAP_GUIDELINES.bipap.titration.map((tit, t) => <li key={t}>{tit}</li>)}
                    </ul>
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-850 space-y-1.5 text-[11px]">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono">Primary Indications</span>
                    <ul className="list-disc pl-4 text-slate-655 font-mono space-y-0.5">
                      {BIPAP_CPAP_GUIDELINES.bipap.indications.map((ind, i) => <li key={i}>{ind}</li>)}
                    </ul>
                  </div>
                </div>

              </div>

              {/* Contraindications Grid */}
              <div className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 space-y-4 shadow-xs">
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-display border-b border-slate-100 dark:border-slate-850 pb-2.5">
                  NIPPV Contraindications List
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-sans">
                  <div className="space-y-2 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <span className="block text-[10px] font-bold text-red-600 dark:text-red-400 font-mono uppercase tracking-wider">Absolute Contraindications</span>
                    <ul className="list-disc pl-4 space-y-1 text-red-950 dark:text-red-450 font-mono">
                      {BIPAP_CPAP_GUIDELINES.contraindications.absolute.map((abs, a) => <li key={a}>{abs}</li>)}
                    </ul>
                  </div>
                  <div className="space-y-2 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                    <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono uppercase tracking-wider">Relative Contraindications</span>
                    <ul className="list-disc pl-4 space-y-1 text-amber-950 dark:text-amber-450 font-mono">
                      {BIPAP_CPAP_GUIDELINES.contraindications.relative.map((rel, r) => <li key={r}>{rel}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Clinical Coaching Pearls */}
              <div className="bg-teal-500/5 border border-teal-500/10 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider font-mono">
                  Clinical Coaching & NIPPV Pearls
                </span>
                <ul className="list-disc pl-5 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed font-mono">
                  {BIPAP_CPAP_GUIDELINES.pearls.map((p, pIdx) => <li key={pIdx}>{p}</li>)}
                </ul>
              </div>

            </div>
          )}

          {/* TAB 5: NEUROPROTECTIVE CARE */}
          {activeSubTab === "neuro" && (
            <div className="space-y-6 animate-fade-in" id="neuro-view-panel">
              
              <div className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="border-b border-slate-100 dark:border-slate-850 pb-3">
                  <h3 className="text-sm font-black text-slate-850 dark:text-white font-display">
                    {NEUROPROTECTIVE_GUIDELINES.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                    {NEUROPROTECTIVE_GUIDELINES.subtitle}
                  </p>
                </div>

                <div className="space-y-3">
                  {NEUROPROTECTIVE_GUIDELINES.interventions.map((int, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                          {idx + 1}. {int.target}
                        </span>
                        <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-350 font-bold px-2 py-0.5 rounded font-mono">
                          Goal: {int.goal}
                        </span>
                      </div>
                      <p className="text-xs text-slate-655 dark:text-slate-350 leading-relaxed font-mono">
                        <strong>Action Target:</strong> {int.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raised ICP pearls */}
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Intracranial Emergency Pearls
                </span>
                <ul className="list-disc pl-5 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed font-mono">
                  {NEUROPROTECTIVE_GUIDELINES.clinicalPearls.map((p, pidx) => <li key={pidx}>{p}</li>)}
                </ul>
              </div>

            </div>
          )}

          {/* TAB 6: CENTRAL & ARTERIAL LINES */}
          {activeSubTab === "lines" && (
            <div className="space-y-6 animate-fade-in" id="lines-view-panel">
              
              {/* Central Lines Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Central Venous Catheter (CVC) Protocols
                </h3>
                <div className="space-y-4">
                  {CENTRAL_LINE_PROTOCOLS.map((line, idx) => {
                    const isExpanded = expandedSection === `cvc-${idx}`;
                    return (
                      <div key={idx} className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl overflow-hidden shadow-xs">
                        <button
                          onClick={() => setExpandedSection(isExpanded ? null : `cvc-${idx}`)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:dark:bg-slate-900/40 transition-all border-b border-transparent dark:border-transparent"
                        >
                          <div>
                            <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black px-2.5 py-0.5 rounded font-mono uppercase tracking-wider">
                              CVC Site
                            </span>
                            <h4 className="text-sm font-black text-slate-850 dark:text-white font-display mt-1">
                              {line.site}
                            </h4>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/25 border-t border-slate-150 dark:border-slate-850 space-y-4 text-xs font-sans animate-fade-in">
                            
                            {/* Landmarks */}
                            <div className="p-3.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                              <span className="block text-[9px] font-extrabold text-slate-400 uppercase font-mono tracking-wider mb-1">US Landmarks / Localization</span>
                              <p className="text-slate-655 font-mono text-[11px] leading-relaxed">{line.ultrasoundLandmarks}</p>
                            </div>

                            {/* Indications & Contras */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Site Indications</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                  {line.indications.map((ind, iIdx) => <li key={iIdx}>{ind}</li>)}
                                </ul>
                              </div>
                              <div className="space-y-1.5">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Contraindications</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-red-600 dark:text-red-400 font-mono text-[11px]">
                                  {line.contraindications.map((con, cIdx) => <li key={cIdx}>{con}</li>)}
                                </ul>
                              </div>
                            </div>

                            {/* Procedure Steps */}
                            <div className="space-y-2 border-t border-slate-100 dark:border-slate-850 pt-3">
                              <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Seldinger Procedure Steps</span>
                              <ol className="list-decimal pl-4 space-y-1 text-slate-655 font-mono text-[11px] leading-relaxed">
                                {line.procedureSteps.map((step, sIdx) => <li key={sIdx}>{step}</li>)}
                              </ol>
                            </div>

                            {/* Site-Specific Pearls */}
                            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                              <span className="block text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase font-mono tracking-wider">Site Practice Pearls</span>
                              <ul className="list-disc pl-4 space-y-1 text-blue-950 dark:text-blue-400/95 font-mono text-[11px]">
                                {line.pearls.map((p, pIdx) => <li key={pIdx}>{p}</li>)}
                              </ul>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Arterial Lines Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Arterial Line Insertion Protocols
                </h3>
                <div className="space-y-4">
                  {ARTERIAL_LINE_PROTOCOLS.map((line, idx) => {
                    const isExpanded = expandedSection === `art-${idx}`;
                    return (
                      <div key={idx} className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl overflow-hidden shadow-xs">
                        <button
                          onClick={() => setExpandedSection(isExpanded ? null : `art-${idx}`)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:dark:bg-slate-900/40 transition-all border-b border-transparent dark:border-transparent"
                        >
                          <div>
                            <span className="text-xs bg-teal-500/10 text-teal-600 dark:text-teal-400 font-black px-2.5 py-0.5 rounded font-mono uppercase tracking-wider">
                              Art Line Site
                            </span>
                            <h4 className="text-sm font-black text-slate-850 dark:text-white font-display mt-1">
                              {line.site}
                            </h4>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/25 border-t border-slate-150 dark:border-slate-850 space-y-4 text-xs font-sans animate-fade-in">
                            
                            {/* Indications & Contras */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Indications</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                  {line.indications.map((ind, iIdx) => <li key={iIdx}>{ind}</li>)}
                                </ul>
                              </div>
                              <div className="space-y-1.5">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Contraindications</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-red-600 dark:text-red-400 font-mono text-[11px]">
                                  {line.contraindications.map((con, cIdx) => <li key={cIdx}>{con}</li>)}
                                </ul>
                              </div>
                            </div>

                            {/* Procedure Steps */}
                            <div className="space-y-2 border-t border-slate-100 dark:border-slate-850 pt-3">
                              <span className="block text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">Insertion Procedure Steps</span>
                              <ol className="list-decimal pl-4 space-y-1 text-slate-655 font-mono text-[11px] leading-relaxed">
                                {line.procedureSteps.map((step, sIdx) => <li key={sIdx}>{step}</li>)}
                              </ol>
                            </div>

                            {/* Pearls */}
                            <div className="p-3 bg-teal-500/5 border border-teal-500/10 rounded-xl">
                              <span className="block text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase font-mono tracking-wider">Arterial Access Pearls</span>
                              <ul className="list-disc pl-4 space-y-1 text-teal-950 dark:text-teal-400/95 font-mono text-[11px]">
                                {line.pearls.map((p, pIdx) => <li key={pIdx}>{p}</li>)}
                              </ul>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 7: EMERGENCY DIALYSIS */}
          {activeSubTab === "dialysis" && (
            <div className="space-y-6 animate-fade-in" id="dialysis-view-panel">
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-850 pb-4">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <RefreshCw className="w-5 h-5 animate-spin-slow" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-display">
                      Emergency Dialysis & Renal Replacement
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      Clinical triggers, modalities, and indications for acute RRT in the emergency department
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                    Absolute Indications: The AEIOU Criteria
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {AEIOU_DIALYSIS.map((item) => (
                      <div 
                        key={item.letter} 
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-display">
                              {item.letter}
                            </span>
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-450 font-bold px-2 py-0.5 rounded uppercase font-mono">
                              {item.word}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans mb-3">
                            {item.description}
                          </p>
                        </div>
                        <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-2.5 mt-auto">
                          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono mb-1">
                            Common Triggers
                          </span>
                          <ul className="space-y-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-normal">
                            {item.symptoms.map((s, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-indigo-500">•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-850">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                    Renal Replacement Modalities
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {DIALYSIS_TYPES.map((type, idx) => (
                      <div 
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-slate-850 dark:text-slate-200">
                            {type.name}
                          </h5>
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold px-2 py-0.5 rounded font-mono">
                            {type.duration}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          <strong>Emergency Use:</strong> {type.indications}
                        </p>
                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                          <div>
                            <span className="block font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono mb-1">
                              Clinical Pros
                            </span>
                            <p className="text-slate-500 dark:text-slate-400 leading-normal">{type.positives}</p>
                          </div>
                          <div>
                            <span className="block font-bold text-red-600 dark:text-red-400 uppercase tracking-wider font-mono mb-1">
                              Clinical Cons
                            </span>
                            <p className="text-slate-500 dark:text-slate-400 leading-normal">{type.negatives}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: CLINICAL MNEMONICS */}
          {activeSubTab === "mnemonics" && (
            <div className="space-y-6 animate-fade-in" id="mnemonics-view-panel">
              {/* Toolbar */}
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-display">
                      Clinical Mnemonics Hub
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      High-yield diagnostic guides, safety checklists, and cognitive aids for critical situations
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowContributeForm(!showContributeForm);
                      setSubmitMessage(null);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Contribute a Mnemonic</span>
                  </button>
                </div>

                {/* Form to Contribute Mnemonic */}
                {showContributeForm && (
                  <form onSubmit={handleSubmitContribution} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 animate-fade-in">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                      Submit Clinical Mnemonic Suggestion
                    </h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-normal">
                      We value peer contributions. Once submitted, suggestions will sit in the pending review pipeline where other clinicians can verify and approve them before they enter the active global directory.
                    </p>

                    {/* AI Screenshot Scan Option */}
                    <div className="p-3 bg-emerald-500/5 border border-dashed border-emerald-500/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Scan Mnemonic Screenshot (AI-Assisted)</span>
                          <span className="px-1.5 py-0.5 text-[8px] font-black tracking-wide uppercase bg-emerald-600 text-white rounded font-mono">New</span>
                        </div>
                        {isScanningMnemonic && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-mono animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Scanning...</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                        Have a screenshot, handwritten note, or reference card? Upload it here! ErMate will scan and extract the Title, Mnemonic Key, Category, and detailed Breakdown to populate the fields below automatically.
                      </p>

                      <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white/50 dark:bg-slate-950/40 hover:bg-slate-50 dark:hover:dark:bg-slate-950/80 transition-all cursor-pointer relative group">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleScanMnemonicImage(file);
                            }
                          }}
                          disabled={isScanningMnemonic}
                        />
                        <div className="text-center space-y-1 pointer-events-none">
                          <Upload className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 mx-auto transition-colors" />
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {isScanningMnemonic ? "Analyzing screenshot..." : "Click to select or drag screenshot here"}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">PNG, JPG, or JPEG up to 10MB</p>
                        </div>
                      </div>

                      {mnemonicScanError && (
                        <div className="p-2 bg-red-500/10 text-red-600 border border-red-500/15 rounded-lg text-[10px] font-medium flex items-center gap-1.5 animate-fade-in">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{mnemonicScanError}</span>
                        </div>
                      )}

                      {mnemonicScanSuccess && (
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 rounded-lg text-[10px] font-medium flex items-center gap-1.5 animate-fade-in">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{mnemonicScanSuccess}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Title *</label>
                        <input
                          type="text"
                          required
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="e.g. 5 I's: Causes of High Sugar"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Mnemonic Key *</label>
                        <input
                          type="text"
                          required
                          value={formMnemonic}
                          onChange={(e) => setFormMnemonic(e.target.value)}
                          placeholder="e.g. 5 I's, AEIOU"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Category *</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Cardiology">Cardiology</option>
                          <option value="Nephrology">Nephrology</option>
                          <option value="Metabolic / Endocrinology">Metabolic / Endocrinology</option>
                          <option value="Resuscitation">Resuscitation</option>
                          <option value="Airway">Airway</option>
                          <option value="Pharmacology">Pharmacology</option>
                          <option value="Neurology">Neurology</option>
                          <option value="Trauma / Surgery">Trauma / Surgery</option>
                          <option value="General Emergency">General Emergency</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Detailed Breakdown (What each letter stands for) *</label>
                      <textarea
                        required
                        rows={4}
                        value={formBreakdown}
                        onChange={(e) => setFormBreakdown(e.target.value)}
                        placeholder="e.g.&#10;* **I** - Infection&#10;* **I** - Infarction&#10;* **I** - Infant / Pregnancy..."
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Clinical Explanation / Clinical Context (Optional)</label>
                      <textarea
                        rows={2}
                        value={formExplanation}
                        onChange={(e) => setFormExplanation(e.target.value)}
                        placeholder="Provide details on when to apply this mnemonic, reference books, or clinical pearls."
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {!auth.currentUser && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-indigo-400 uppercase font-mono">Your Name *</label>
                          <input
                            type="text"
                            required
                            value={formSubmitterName}
                            onChange={(e) => setFormSubmitterName(e.target.value)}
                            placeholder="Dr. Sarah Jenkins"
                            className="w-full px-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-indigo-400 uppercase font-mono">Your Email (required for validation) *</label>
                          <input
                            type="email"
                            required
                            value={formSubmitterEmail}
                            onChange={(e) => setFormSubmitterEmail(e.target.value)}
                            placeholder="sarah.j@hospital.com"
                            className="w-full px-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {submitMessage && (
                      <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${
                        submitMessage.type === "success" 
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/15" 
                          : "bg-red-500/10 text-red-600 border border-red-500/15"
                      }`}>
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{submitMessage.text}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowContributeForm(false)}
                        className="px-3 py-1.5 bg-slate-250 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                      >
                        {submitting ? "Submitting..." : "Submit for Peer Review"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={mnemonicSearch}
                    onChange={(e) => setMnemonicSearch(e.target.value)}
                    placeholder="Search mnemonics by title, category, abbreviation, or content (e.g., high sugar, syncope, AEIOU)..."
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] font-mono uppercase tracking-wider font-bold">
                    Search
                  </span>
                </div>
              </div>

              {/* Pending Contributions Section (PEER REVIEW BOARD) */}
              {contributions.some(c => c.status === "pending") && (
                <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/40 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider font-mono">
                        Clinician Peer-Review Board (Pending Approvals)
                      </h3>
                    </div>
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-0.5 rounded font-mono uppercase tracking-widest">
                      Audit Required
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans leading-normal">
                    The following content was suggested by clinical users. According to ER safety regulations, guidelines must be peerchecked for medical safety. Tap <strong>Approve & Integrate</strong> if the details are accurate.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contributions.filter(c => c.status === "pending").map((item) => (
                      <div key={item.id} className="bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-xs">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-900 text-slate-500 font-mono font-bold px-2 py-0.5 rounded">
                              {item.category}
                            </span>
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                              {item.mnemonic}
                            </span>
                          </div>

                          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                            {item.title}
                          </h4>

                          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-lg text-[11px] font-mono leading-relaxed text-slate-650 dark:text-slate-350 whitespace-pre-line">
                            {item.breakdown}
                          </div>

                          {item.explanation && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal italic">
                              <strong>Clinical Use:</strong> {item.explanation}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            By {(item as any).submittedBy}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteContribution(item.id)}
                              className="p-1.5 hover:bg-red-500/10 text-red-600 rounded-lg hover:text-red-700 transition-all"
                              title="Reject & Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleApproveContribution(item.mnemonic, item.id)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] transition-all flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve & Integrate</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Directory */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Verified Directory
                </h3>

                <div className="space-y-3">
                  {(() => {
                    const approvedUserContributions = contributions
                      .filter(c => c.status === "approved")
                      .map(c => ({
                        id: c.id,
                        title: c.title,
                        mnemonic: c.mnemonic,
                        category: c.category,
                        breakdown: c.breakdown,
                        explanation: c.explanation || "",
                        isUserSubmitted: true,
                        submittedBy: c.submittedBy
                      }));

                    const combined = [...BUILTIN_MNEMONICS, ...approvedUserContributions];

                    const filtered = combined.filter(item => {
                      const queryStr = mnemonicSearch.toLowerCase();
                      return (
                        item.title.toLowerCase().includes(queryStr) ||
                        item.mnemonic.toLowerCase().includes(queryStr) ||
                        item.category.toLowerCase().includes(queryStr) ||
                        item.breakdown.toLowerCase().includes(queryStr)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-slate-400 font-mono">
                          No clinical mnemonics match your search query. Try typing another term or submit a new mnemonic!
                        </div>
                      );
                    }

                    return filtered.map((item, idx) => {
                      const isExpanded = expandedSection === `mnemonic-${item.id}`;
                      return (
                        <div key={item.id || idx} className="bg-white dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl overflow-hidden shadow-xs">
                          <button
                            onClick={() => setExpandedSection(isExpanded ? null : `mnemonic-${item.id}`)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:dark:bg-slate-900/40 transition-all"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black px-2.5 py-0.5 rounded font-mono uppercase tracking-wider">
                                  {item.category}
                                </span>
                                {(item as any).isUserSubmitted && (
                                  <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded font-mono flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-indigo-500" />
                                    Clinician Peer Approved
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-black text-slate-850 dark:text-white font-display mt-1.5">
                                {item.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {item.mnemonic}
                              </span>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/25 border-t border-slate-150 dark:border-slate-850 space-y-4 text-xs font-sans animate-fade-in">
                              
                              {/* Breakdown */}
                              <div className="p-3.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-350 whitespace-pre-line">
                                {item.breakdown}
                              </div>

                              {/* Explanation */}
                              {item.explanation && (
                                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                  <span className="block text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono tracking-wider mb-1">
                                    Clinical Context & Utility
                                  </span>
                                  <p className="text-slate-655 dark:text-slate-400 font-sans text-[11px] leading-relaxed">
                                    {item.explanation}
                                  </p>
                                </div>
                              )}

                              {(item as any).isUserSubmitted && (
                                <div className="text-[10px] text-slate-400 font-mono text-right italic">
                                  Contributed to the community database by: {(item as any).submittedBy}
                                </div>
                              )}

                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
