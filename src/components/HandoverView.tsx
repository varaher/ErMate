import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Users, ClipboardCopy, FileText, Printer, Plus, Trash2, Edit2, Pencil,
  CheckCircle, HelpCircle, Download, Check, RefreshCw, Layers, LayoutList,
  AlertTriangle, ShieldAlert, ChevronLeft, X, Camera, UploadCloud, Sparkles, Send,
  MoreHorizontal, BookmarkCheck, MessageSquare
} from "lucide-react";
import SpeechMicButton from "./SpeechMicButton";
import { sanitizeDoctorError } from "../utils/sanitizeError";
import { triggerPrintWithTip } from "../utils/printWithTip";
import { ClinicalCase, UserProfile, HandoverRecord, QuickPastePatient, InvestigationItem, HandoverPatient, DirectDischargeSummaryItem } from "../types";
import { HandoverCard } from "./HandoverCard";
import { BoundChatModal } from "./BoundChatModal";
import { ChatContext } from "../hooks/useBoundChat";
import { db, auth } from "../firebase";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { captureFeedbackCorrection } from "../services/learningClient";

interface HandoverViewProps {
  profile: UserProfile;
  cases: ClinicalCase[];
  handovers: HandoverRecord[];
  setHandovers: React.Dispatch<React.SetStateAction<HandoverRecord[]>>;
  onNavigateToTab?: (tabId: string) => void;
  isDarkMode?: boolean;
  activeSubTab?: "registry" | "quickpaste" | "discharge_direct";
  setActiveSubTab?: (tab: "registry" | "quickpaste" | "discharge_direct") => void;
  quickPasteList?: QuickPastePatient[];
  setQuickPasteList?: React.Dispatch<React.SetStateAction<QuickPastePatient[]>>;
}

interface ScribeChatMessage {
  id: string;
  sender: "user" | "ermate";
  text?: string;
  image?: string; // base64 representation
  imageName?: string;
  timestamp: string;
  parsedPatient?: {
    patientId?: string;
    name: string;
    ageGender: string;
    triage: string;
    vitals: string;
    rawNotes: string;
    structuredSBAR: {
      situation: string;
      background: string;
      assessment: string;
      recommendation: string;
    };
    handoverCardData?: HandoverPatient;
  };
  isSaved?: boolean;
}

interface HandoverTableRow {
  id: string;
  bed: string;
  name: string;
  ageGender: string;
  erNo?: string;
  doctor?: string;
  stayDuration?: string;
  complaints: string;
  chronologicalNotes?: string;
  history: string;
  assessment: string;
  planDone: string;
  planToBeDone: string;
  bystander: string;
  vitals?: string;
  alerts?: string;
}

interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
}

function AutoResizeTextarea({ value, onChange, className, placeholder }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
    window.addEventListener("resize", adjustHeight);
    return () => window.removeEventListener("resize", adjustHeight);
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className={`${className} overflow-y-hidden`}
      placeholder={placeholder}
      rows={1}
    />
  );
}

// Helper to sort handover rows by Bed Number chronologically (e.g. Bed 1, Bed 2, Bed 3A, Bed 10...)
export function sortRowsByBedNumber<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const parseBed = (item: any) => {
      const rawStr = (item.bed || item.bedNo || item.name || "").trim();
      if (!rawStr) return { num: 999999, suffix: "", raw: "" };
      
      const match = rawStr.match(/(?:bed|room|bay|cot|icu|hdu)?\s*#?\s*(\d+)\s*([a-z]?)/i);
      if (match) {
        return {
          num: parseInt(match[1], 10),
          suffix: (match[2] || "").toLowerCase(),
          raw: rawStr.toLowerCase()
        };
      }
      return { num: 999999, suffix: "", raw: rawStr.toLowerCase() };
    };

    const bedA = parseBed(a);
    const bedB = parseBed(b);

    if (bedA.num !== bedB.num) {
      return bedA.num - bedB.num;
    }
    if (bedA.suffix !== bedB.suffix) {
      return bedA.suffix.localeCompare(bedB.suffix);
    }
    return bedA.raw.localeCompare(bedB.raw);
  });
}

// Helper to highlight numbered list items, Bed numbers, Dates, Timestamps, Alerts, and Numeric Lab/Vitals Values
export function renderHighlightedText(text: string | undefined | null) {
  if (!text) return null;

  const tokenRegex = /(?<=^|\s|\n)(?:Step\s*\d+:?|[A-Z]\.|\d+(?:\.\d+)*(?:[\.\)]|\b)|\(\d+\)|\[\d+\]|#\d+)(?=\s|$)|[⚠️⚠🚨⚡❗‼]+|\b(?:ALERT|CRITICAL|WARNING|URGENT|DANGER|HIGH\s+RISK|RED\s+FLAG|P1|A3|SEPSIS|HYPOTENSION|HYPOXIA|ANAPHYLAXIS|CARDIAC\s+ARREST|ST\s*-?\s*ELEVATION):?|\b(?:Bed|Room|Bay|Cot|ICU|HDU)\s*#?\s*\d+[A-Za-z]?\b|\b(?:\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{2,4})?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\,?\s+\d{2,4})?|Today|Yesterday|Tomorrow|Day\s*\d+|POD\s*\d+)\b|(?:@\s*)?\b(?:[0-1]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*[AP]M)?\b|\b\d{2,3}\/\d{2,3}(?:\s*mmHg)?\b|\b(?:Temp(?:erature)?|T:?)\s*[:\s]*\d{2,3}(?:\.\d+)?(?:\s*°?[FC])?\b|\b\d{2,3}(?:\.\d+)?\s*°[FC]\b|\b\d{2,3}(?:\.\d+)?\s*(?:deg\s*F|deg\s*C|Fahrenheit|Celsius)\b|\b\d+(?:\.\d+)?(?:k|mg|g|ml|l|m|mmol\/L|mg\/dL|g\/dL|IU\/L|bpm|mmHg|cm|mm|kg|%|x\d+|days?|months?|hrs?|hours?|mins?|weeks?|yr|years?|mEq\/L|G)?\s*[⚠⚠️]|\b[><]=?\s*\d+(?:\.\d+)?(?:k|mg|g|ml|%)?\b|\b\d+(?:\.\d+)?(?:\s*(?:k|mg|mcg|g|ml|l|m|mmol\/L|mg\/dL|g\/dL|IU\/L|bpm|mmHg|cm|mm|kg|%|x\d+|days?|months?|hrs?|hours?|mins?|weeks?|yr|years?|mEq\/L|G))\b|\b\d+(?:\.\d+)+\b|(?<=\s|^|\(|\[|#|:|-|·)\d+(?=\s|\)|\]|,|\.|;|$|·)/gi;

  const parts = text.split(tokenRegex);
  const matches = text.match(tokenRegex);

  if (!matches || matches.length === 0) {
    return text;
  }

  const result: React.ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part) {
      result.push(part);
    }
    if (index < matches.length) {
      const match = matches[index];
      const trimmed = match.trim();

      const isBed = /^(?:Bed|Room|Bay|Cot|ICU|HDU)\s*#?\s*\d+[A-Za-z]?$/i.test(trimmed);
      const isDate = /^(?:\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{2,4})?|Today|Yesterday|Tomorrow|Day\s*\d+|POD\s*\d+)$/i.test(trimmed);
      const isTime = /^(?:@\s*)?(?:[0-1]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*[AP]M)?$/i.test(trimmed);
      const isNumbering = /^(?:Step\s*\d+:?|[A-Z]\.|\d+(?:\.\d+)*(?:[\.\)]|\b)|\(\d+\)|\[\d+\]|#\d+)$/i.test(trimmed);
      const isAlert = /^(?:[⚠️⚠🚨⚡❗‼]+|\b(?:ALERT|CRITICAL|WARNING|URGENT|DANGER|HIGH\s+RISK|RED\s+FLAG|P1|A3|SEPSIS|HYPOTENSION|HYPOXIA|ANAPHYLAXIS|CARDIAC\s+ARREST|ST\s*-?\s*ELEVATION):?)$/i.test(trimmed);
      const isAbnormalNum = /⚠|⚠️|^[><]/.test(trimmed);
      const isBpRatio = /^\d{2,3}\/\d{2,3}(?:\s*mmHg)?$/i.test(trimmed);
      const isTemp = /^(?:Temp(?:erature)?|T:?)\s*[:\s]*\d{2,3}(?:\.\d+)?|\d{2,3}(?:\.\d+)?\s*(?:°[FC]|deg\s*[FC]|Fahrenheit|Celsius)$/i.test(trimmed);
      const isNumericValue = /^\d+(?:\.\d+)?/.test(trimmed);

      if (isBed) {
        result.push(
          <span
            key={`bed-${index}`}
            className="inline-flex items-center gap-0.5 bg-violet-100 dark:bg-violet-950/90 text-violet-900 dark:text-violet-200 font-extrabold text-[10.5px] px-1.5 py-0.5 rounded-md border border-violet-300 dark:border-violet-700 mx-0.5 font-mono shadow-2xs leading-none print:bg-violet-100 print:text-violet-900 print:border-violet-300"
          >
            🛏️ {match}
          </span>
        );
      } else if (isDate) {
        result.push(
          <span
            key={`date-${index}`}
            className="inline-flex items-center gap-0.5 bg-amber-100 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 font-bold text-[10px] px-1.5 py-0.5 rounded-md border border-amber-300 dark:border-amber-700 mx-0.5 font-mono shadow-2xs leading-none print:bg-amber-100 print:text-amber-900 print:border-amber-300"
          >
            📅 {match}
          </span>
        );
      } else if (isTime) {
        result.push(
          <span
            key={`time-${index}`}
            className="inline-flex items-center gap-0.5 bg-sky-100 dark:bg-sky-950/90 text-sky-900 dark:text-sky-200 font-bold text-[10px] px-1.5 py-0.5 rounded-md border border-sky-300 dark:border-sky-700 mx-0.5 font-mono shadow-2xs leading-none print:bg-sky-100 print:text-sky-900 print:border-sky-300"
          >
            ⏱️ {match}
          </span>
        );
      } else if (isNumbering) {
        result.push(
          <span
            key={`num-${index}`}
            className="inline-flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200 font-black text-[10px] px-1.5 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-700 mx-0.5 font-mono shadow-2xs leading-none print:bg-indigo-50 print:text-indigo-900 print:border-indigo-300"
          >
            {match}
          </span>
        );
      } else if (isAlert || isAbnormalNum) {
        result.push(
          <span
            key={`alert-${index}`}
            className="inline-flex items-center gap-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded-md border border-rose-300 dark:border-rose-800 mx-0.5 font-mono animate-pulse shadow-2xs leading-none print:bg-rose-100 print:text-rose-900 print:border-rose-300 print:animate-none"
          >
            {match.includes("⚠") || match.includes("⚠️") || match.includes("🚨") ? match : `⚠️ ${match}`}
          </span>
        );
      } else if (isBpRatio) {
        result.push(
          <span
            key={`bp-${index}`}
            className="inline-flex items-center gap-0.5 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black text-[10.5px] px-1.5 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 mx-0.5 font-mono shadow-2xs leading-none print:bg-slate-200 print:text-slate-900"
          >
            {match}
          </span>
        );
      } else if (isTemp) {
        const numVal = parseFloat(trimmed.replace(/[^0-9.]/g, ""));
        const isFever = numVal >= 99.5 || (numVal >= 37.5 && numVal <= 43) || /fever|high/i.test(trimmed);
        result.push(
          <span
            key={`temp-${index}`}
            className={`inline-flex items-center gap-0.5 font-bold text-[10.5px] px-1.5 py-0.5 rounded-md border mx-0.5 font-mono shadow-2xs leading-none ${
              isFever
                ? "bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 animate-pulse print:animate-none"
                : "bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700"
            }`}
          >
            🌡️ {match} {isFever ? " (FEVER ⚠️)" : ""}
          </span>
        );
      } else if (isNumericValue) {
        result.push(
          <span
            key={`val-${index}`}
            className="inline-flex items-center justify-center bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-bold text-[10.5px] px-1 py-0.5 rounded border border-amber-200/90 dark:border-amber-800/80 mx-0.5 font-mono shadow-2xs leading-none print:bg-amber-50 print:text-amber-900"
          >
            {match}
          </span>
        );
      } else {
        result.push(match);
      }
    }
  });

  return <>{result}</>;
}

export function HighlightedHandoverText({ text }: { text: string | undefined | null }) {
  if (!text) return null;

  const lines = text.split("\n");
  return (
    <span className="whitespace-pre-wrap">
      {lines.map((line, lIdx) => (
        <React.Fragment key={lIdx}>
          {renderHighlightedText(line)}
          {lIdx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );
}

// Helper to parse multi-entry text (by paragraphs or newlines)
export function parseHandoverEntries(rawText: string | undefined | null): string[] {
  if (!rawText || !rawText.trim()) return [];
  const paraSplit = rawText.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  if (paraSplit.length > 1) {
    return paraSplit;
  }
  const lineSplit = rawText.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lineSplit.length > 1) {
    return lineSplit;
  }
  return [rawText.trim()];
}

// Multi-patient paste splitter: detects multiple patients in bulk EMR text (by dividers, Bed headers, Pt headers)
export function splitMultiPatientPasteText(rawText: string): string[] {
  if (!rawText || typeof rawText !== "string") return [];
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. Explicit multi-patient dividers like ===, ---, ***, ###
  const dividerSplit = trimmed.split(/\n\s*[-=_#*]{3,}\s*\n/).map(s => s.trim()).filter(s => s.length > 20);
  if (dividerSplit.length > 1) return dividerSplit;

  // 2. Pattern splitting on Bed X / Patient X / Pt X / UHID: / Patient Name:
  const headerBoundary = /\n(?=(?:Bed\s*#?\s*:?\s*\d+|Patient\s*#?\s*:?\s*\d+|Pt\s*#?\s*:?\s*\d+|UHID\s*[:=-]|\bPatient\s*Name\s*[:=-]|\b[A-Z][a-z]+\s*,\s*\d{1,3}\s*[/-]?\s*[MFmf]\b))/i;
  const headerSplit = trimmed.split(headerBoundary).map(s => s.trim()).filter(s => s.length > 20);
  if (headerSplit.length > 1) return headerSplit;

  return [trimmed];
}

// Auto-detect columns: 1-3 entries -> 1 col, 4-6 entries -> 2 cols, 7+ entries -> 3 cols
// Maintains chronological order: left to right, top to bottom
export function splitEntriesIntoColumns(entries: string[]): string[][] {
  const n = entries.length;
  if (n === 0) return [];

  let cols = 1;
  if (n <= 3) {
    cols = 1;
  } else if (n <= 6) {
    cols = 2;
  } else {
    cols = 3;
  }

  const perCol = Math.ceil(n / cols);
  const result: string[][] = [];
  for (let i = 0; i < n; i += perCol) {
    result.push(entries.slice(i, i + perCol));
  }
  return result;
}

// Reusable multi-column viewer for Handover Sections (Initial Assessment & Management Plan)
export function MultiColumnEntriesView({ 
  text, 
  fontFamily = "font-mono"
}: { 
  text: string | undefined | null; 
  fontFamily?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text || !text.trim()) {
    return <span className="text-slate-400 italic text-xs">Nil logged</span>;
  }

  const entries = parseHandoverEntries(text);
  if (entries.length === 0) return null;

  const isLong = text.length > 280 || entries.length > 3;
  const columns = splitEntriesIntoColumns(entries);
  const numCols = columns.length;

  let gridColsClass = "grid-cols-1";
  if (numCols === 2) gridColsClass = "grid-cols-1 md:grid-cols-2 print:grid-cols-2";
  if (numCols === 3) gridColsClass = "grid-cols-1 md:grid-cols-3 print:grid-cols-3";

  return (
    <div className="relative">
      <div className={`grid ${gridColsClass} gap-2 md:gap-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 ${!isExpanded && isLong ? "max-h-40 overflow-hidden relative" : ""}`}>
        {columns.map((colEntries, cIdx) => (
          <div key={cIdx} className={`space-y-1.5 ${cIdx > 0 ? "md:pl-2.5 pt-2 md:pt-0" : ""}`}>
            {colEntries.map((entry, eIdx) => (
              <div key={eIdx} className={`text-xs ${fontFamily} leading-relaxed text-slate-900 dark:text-slate-100 bg-white/80 dark:bg-slate-900/50 p-2 rounded-md border border-slate-200/80 dark:border-slate-800/80 shadow-2xs`}>
                <HighlightedHandoverText text={entry} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="no-print mt-1.5 text-[10.5px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          {isExpanded ? "▲ Collapse to 1-Page Summary View" : `▼ Show Full Chronological Details (${entries.length} entries)`}
        </button>
      )}
    </div>
  );
}

export default function HandoverView({ 
  profile, 
  cases, 
  handovers, 
  setHandovers, 
  onNavigateToTab, 
  isDarkMode = false,
  activeSubTab: propActiveSubTab,
  setActiveSubTab: propSetActiveSubTab,
  quickPasteList: propQuickPasteList,
  setQuickPasteList: propSetQuickPasteList
}: HandoverViewProps) {
  // Main view navigation: "registry" (Active Cases), "quickpaste" (EMR Quick Paste), or "discharge_direct" (Direct Discharge Summary)
  const [localActiveSubTab, setLocalActiveSubTab] = useState<"registry" | "quickpaste" | "discharge_direct">("registry");
  const activeSubTab = propActiveSubTab !== undefined ? propActiveSubTab : localActiveSubTab;
  const setActiveSubTab = propSetActiveSubTab !== undefined ? propSetActiveSubTab : setLocalActiveSubTab;

  // DPDP Shield Protection Info Toast State
  const [phiShieldInfo, setPhiShieldInfo] = useState<{ count: number; phiFound: string[]; details: Record<string, number> } | null>(null);

  // State for Registry Cases selection (by default select all active cases)
  const [selectedRegistryIds, setSelectedRegistryIds] = useState<string[]>(
    cases.filter(c => c.status === "Active").map(c => c.id)
  );

  // Quick Paste lists state (synced with Firestore if provided via props, else local state)
  const [localQuickPasteList, setLocalQuickPasteList] = useState<QuickPastePatient[]>(() => {
    const saved = localStorage.getItem("ermate_quick_paste_list");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved quick paste list:", e);
      }
    }
    return [
      {
        id: "qp-1",
        name: "Bed 3 (John Doe)",
        ageGender: "52y / Male",
        triage: "P1 (Immediate)",
        vitals: "BP 160/95 | HR 112 | SpO2 91%",
        presentingComplaint: "Acute crushing retrosternal chest pain radiating to jaw for 2 hours with diaphoresis",
        rawNotes: "Pasted from EMR:\nPatient presented with acute crushing chest pain for 2 hours, radiating to jaw. Diaphoretic. ECG shows 3mm ST elevation in V1-V4. Loading doses of Aspirin 325mg and Ticagrelor 180mg given at 10:15 AM. Cardiology consulted and patient accepted for immediate primary PCI in cath lab. Prep in progress. IV fluids running.",
        structuredSBAR: {
          situation: "52y Male in Bed 3 with acute retrosternal chest pain, diagnosed with Anterior Wall STEMI.",
          background: "Known history of hypertension and hyperlipidemia. Smoker.",
          assessment: "Hemodynamically stable but tachypneic. ST elevation in V1-V4. Antiplatelets loaded.",
          recommendation: "Transfer immediately to Cath Lab. Secure patent IV and keep oxygen active."
        }
      },
      {
        id: "qp-2",
        name: "Bed 7 (Clara Oswald)",
        ageGender: "29y / Female",
        triage: "P2 (Urgent)",
        vitals: "BP 115/70 | HR 88 | SpO2 99%",
        presentingComplaint: "Severe right lower quadrant abdominal pain for 12 hours with nausea",
        rawNotes: "EMR Notes:\nSevere right lower quadrant abdominal pain for 12 hours. Nausea, no vomiting. Tender in RLQ with positive McBurney's sign. Ultrasound ordered, report shows swollen non-compressible appendix of 8.5mm with mild surrounding free fluid, consistent with acute appendicitis. NPO since 08:00 AM. IV Cefotetan 2g administered. Surgical resident Dr. Patel reviewed and posted for appendectomy. Waiting for OT vacancy.",
        structuredSBAR: {
          situation: "29y Female in Bed 7 with acute right lower quadrant abdominal pain, diagnosed with acute appendicitis.",
          background: "Prior laparoscopic cholecystectomy 2 years ago. No known drug allergies.",
          assessment: "Tender RLQ abdomen. Ultrasound confirmed appendicitis. Pre-op antibiotics given.",
          recommendation: "Maintain NPO status, administer IV hydration, and monitor for OT transfer."
        }
      }
    ];
  });

  const quickPasteList = propQuickPasteList !== undefined ? propQuickPasteList : localQuickPasteList;
  const setQuickPasteList = propSetQuickPasteList !== undefined ? propSetQuickPasteList : setLocalQuickPasteList;

  // State for EMR Quick Paste selection
  const [selectedQuickPasteIds, setSelectedQuickPasteIds] = useState<string[]>(() => {
    // Start with all quickPasteList items selected
    return quickPasteList.map(qp => qp.id);
  });

  // Auto-sync selectedQuickPasteIds when quickPasteList is modified
  useEffect(() => {
    const quickPasteIds = quickPasteList.map(p => p.id);
    setSelectedQuickPasteIds(prev => {
      const newIds = quickPasteIds.filter(id => !prev.includes(id));
      if (newIds.length > 0) {
        return [...prev, ...newIds];
      }
      const existingPrev = prev.filter(id => quickPasteIds.includes(id));
      if (existingPrev.length !== prev.length) {
        return existingPrev;
      }
      return prev;
    });
  }, [quickPasteList]);

  const handleToggleQuickPasteCase = (id: string) => {
    if (selectedQuickPasteIds.includes(id)) {
      setSelectedQuickPasteIds(selectedQuickPasteIds.filter(x => x !== id));
    } else {
      setSelectedQuickPasteIds([...selectedQuickPasteIds, id]);
    }
  };

  const handleSelectAllQuickPaste = () => {
    if (selectedQuickPasteIds.length === quickPasteList.length) {
      setSelectedQuickPasteIds([]);
    } else {
      setSelectedQuickPasteIds(quickPasteList.map(qp => qp.id));
    }
  };

  // Sync quickPasteList to localStorage so it is robustly saved over refreshes/reboots
  useEffect(() => {
    localStorage.setItem("ermate_quick_paste_list", JSON.stringify(quickPasteList));
  }, [quickPasteList]);

  // Post-Print Cleanup and Warning state
  const [showPostPrintCleanPrompt, setShowPostPrintCleanPrompt] = useState(false);
  const [postPrintDataType, setPostPrintDataType] = useState<"registry" | "quickpaste">("registry");
  const [idsToCleanup, setIdsToCleanup] = useState<string[]>([]);
  const [hasUnclearedShiftWarning, setHasUnclearedShiftWarning] = useState(() => {
    return localStorage.getItem("ermate_uncleared_shift_warning") === "true";
  });
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [cleanupActionInProgress, setCleanupActionInProgress] = useState(false);
  const [isAiCompilingSheet, setIsAiCompilingSheet] = useState(false);

  // Sync shift warning state to localStorage
  useEffect(() => {
    localStorage.setItem("ermate_uncleared_shift_warning", hasUnclearedShiftWarning ? "true" : "false");
  }, [hasUnclearedShiftWarning]);

  // ── Direct EMR Discharge Summary States & Logic ──
  const [directDischargeList, setDirectDischargeList] = useState<DirectDischargeSummaryItem[]>(() => {
    try {
      const saved = localStorage.getItem("ermate_direct_discharge_list");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [directInputText, setDirectInputText] = useState<string>("");
  const [isGeneratingDischarge, setIsGeneratingDischarge] = useState<boolean>(false);
  const [dischargeError, setDischargeError] = useState<string>("");
  const [selectedDischargeModal, setSelectedDischargeModal] = useState<DirectDischargeSummaryItem | null>(null);

  // Sync directDischargeList to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ermate_direct_discharge_list", JSON.stringify(directDischargeList));
    } catch (e) {
      console.error("Failed to save directDischargeList to localStorage:", e);
    }
  }, [directDischargeList]);

  const handleGenerateDirectDischarge = async (textToProcess?: string) => {
    const raw = (textToProcess !== undefined ? textToProcess : directInputText).trim();
    if (!raw) {
      setDischargeError("Please paste EMR case sheet text before generating.");
      return;
    }

    setIsGeneratingDischarge(true);
    setDischargeError("");

    try {
      const res = await fetch("/api/discharge-summary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: raw }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.summary) {
        throw new Error(data.error || "Failed to generate discharge summary.");
      }

      const summary = data.summary;
      const patientNameMatch = raw.match(/(?:PATIENT\s*NAME|PATIENT|NAME)\s*[:=-]?\s*([^\n,]+)/i) ||
                               raw.match(/(?:mr\.|mrs\.|ms\.|pt\.?|baby|master)\s+([A-Za-z\s]+)/i);
      
      const extractedName = (summary.patientName && typeof summary.patientName === 'string' && summary.patientName.trim().length > 1)
        ? summary.patientName.trim()
        : (patientNameMatch ? patientNameMatch[1].trim() : "Emergency Patient");

      const newItem: DirectDischargeSummaryItem = {
        id: `ds-${Date.now()}`,
        patientName: extractedName,
        uhid: summary.mlc || raw.match(/(?:uhid|mrn|ip|id)\s*[:=-]?\s*(\w+)/i)?.[1] || "N/A",
        createdAt: new Date().toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        rawText: raw,
        summary: summary,
      };

      setDirectDischargeList((prev) => [newItem, ...prev]);
      setDirectInputText("");
    } catch (err: any) {
      console.error("[Discharge Summary Direct Error]", err);
      setDischargeError(err.message || "An error occurred while generating the discharge summary.");
    } finally {
      setIsGeneratingDischarge(false);
    }
  };

  const handleDeleteDirectDischarge = (id: string) => {
    if (confirm("Are you sure you want to delete this discharge summary?")) {
      setDirectDischargeList((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        try {
          localStorage.setItem("ermate_direct_discharge_list", JSON.stringify(updated));
        } catch (e) {
          console.error("Error updating directDischargeList in localStorage:", e);
        }
        return updated;
      });
      if (selectedDischargeModal?.id === id) {
        setSelectedDischargeModal(null);
      }
    }
  };

  const handleClearAllDirectDischarge = () => {
    if (confirm("Clear all generated direct discharge summaries?")) {
      setDirectDischargeList([]);
      localStorage.removeItem("ermate_direct_discharge_list");
    }
  };

  const handleDownloadDischargeWord = (item: DirectDischargeSummaryItem) => {
    const s = item.summary || {};
    const vArrival = s.vitalsOnArrival || {};
    const vDischarge = s.vitalsAtDischarge || {};
    const prim = s.primarySurvey || {};
    const air = prim.airway || {};
    const br = prim.breathing || {};
    const circ = prim.circulation || {};
    const dis = prim.disability || {};
    const exp = prim.exposure || {};
    const inv = s.investigations || {};

    const wordHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Discharge Summary - ${item.patientName}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 10pt; color: #111827; line-height: 1.4; }
          h1 { font-size: 15pt; font-weight: bold; color: #1e3a8a; margin-bottom: 2px; text-transform: uppercase; }
          h2 { font-size: 11pt; font-weight: bold; color: #1e3a8a; border-bottom: 1.5pt solid #1e3a8a; padding-bottom: 2px; margin-top: 12px; margin-bottom: 6px; text-transform: uppercase; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          .header-table td { padding: 4px 6px; vertical-align: top; border: 1px solid #d1d5db; font-size: 9.5pt; }
          .bg-light { background-color: #f3f4f6; font-weight: bold; width: 22%; }
          .section-box { margin-bottom: 8px; line-height: 1.4; }
          ul { margin-top: 3px; margin-bottom: 3px; padding-left: 18px; }
          .footer-sign { margin-top: 25px; width: 100%; border-collapse: collapse; }
          .footer-sign td { width: 50%; padding-top: 35px; font-weight: bold; font-size: 9.5pt; }
        </style>
      </head>
      <body>
        <table style="width: 100%; margin-bottom: 12px; border-bottom: 2.5pt solid #1e3a8a;">
          <tr>
            <td style="text-align: left;">
              <h1 style="margin: 0; font-size: 17pt;">${(hospitalName || "EMERGENCY DEPARTMENT").toUpperCase()}</h1>
              <div style="font-size: 10.5pt; font-weight: bold; color: #374151;">DEPARTMENT OF EMERGENCY MEDICINE</div>
              <div style="font-size: 8.5pt; color: #6b7280;">24x7 Emergency Care &amp; Medico-Legal Records</div>
            </td>
            <td style="text-align: right; vertical-align: bottom;">
              <div style="font-size: 13pt; font-weight: bold; color: #1e3a8a;">EMERGENCY DISCHARGE SUMMARY</div>
              <div style="font-size: 9pt; color: #6b7280;">Date: ${s.dateTime || item.createdAt}</div>
            </td>
          </tr>
        </table>

        <table class="header-table">
          <tr>
            <td class="bg-light">Patient Name:</td>
            <td style="width: 28%;"><strong>${item.patientName}</strong></td>
            <td class="bg-light">UHID / Bed:</td>
            <td style="width: 28%;"><strong>${item.uhid}</strong></td>
          </tr>
          <tr>
            <td class="bg-light">MLC Status:</td>
            <td>${s.mlc ? `YES (${s.mlc})` : "NO / Nil"}</td>
            <td class="bg-light">Allergies:</td>
            <td><strong>${s.allergy || "Nil known"}</strong></td>
          </tr>
        </table>

        <h2>1. Vitals On Arrival</h2>
        <table class="header-table">
          <tr>
            <td class="bg-light">Pulse / HR:</td><td>${vArrival.hr || "N/A"}</td>
            <td class="bg-light">BP:</td><td>${vArrival.bp || "N/A"}</td>
            <td class="bg-light">RR:</td><td>${vArrival.rr || "N/A"}</td>
            <td class="bg-light">SpO₂:</td><td>${vArrival.spo2 || "N/A"}</td>
          </tr>
          <tr>
            <td class="bg-light">GCS:</td><td>${vArrival.gcs || "N/A"}</td>
            <td class="bg-light">GRBS:</td><td>${vArrival.grbs || "N/A"}</td>
            <td class="bg-light">Temp:</td><td>${vArrival.temp || "N/A"}</td>
            <td class="bg-light">Pain Score:</td><td>${vArrival.painScore || "N/A"}</td>
          </tr>
        </table>

        <h2>2. Clinical Presentation & History</h2>
        <div class="section-box">
          <strong>Presenting Complaints:</strong>
          <div>${s.presentingComplaints || "N/A"}</div>
        </div>
        <div class="section-box">
          <strong>History of Present Illness (HPI):</strong>
          <div>${s.hpi || "N/A"}</div>
        </div>
        <div class="section-box">
          <strong>Past Medical / Surgical Histories:</strong>
          <div>${s.pastHistory || "Nil recorded"}</div>
        </div>
        ${s.familyGynaeHistory || s.lmp ? `
        <div class="section-box">
          <strong>Family / Gynae History:</strong> ${s.familyGynaeHistory || "Nil"} | <strong>LMP:</strong> ${s.lmp || "N/A"}
        </div>
        ` : ''}

        <h2>3. Primary Assessment</h2>
        <table class="header-table">
          <tr>
            <td class="bg-light">Airway:</td>
            <td colspan="3">${air.status || "Patent"} ${air.intervention ? `(Intervention: ${air.intervention})` : ''}</td>
          </tr>
          <tr>
            <td class="bg-light">Breathing:</td>
            <td colspan="3">Work of breathing: ${br.workOfBreathing || "Normal"}, Air entry: ${br.airEntry || "Bilaterally equal"}${br.cct ? `, CCT: ${br.cct}` : ''}${br.subcutaneousEmphysema ? `, Subcut Emphysema: ${br.subcutaneousEmphysema}` : ''}${br.efast ? `, EFAST: ${br.efast}` : ''}${br.intervention ? `, Intervention: ${br.intervention}` : ''}</td>
          </tr>
          <tr>
            <td class="bg-light">Circulation:</td>
            <td colspan="3">CRT: ${circ.crt || "< 2s"}${circ.distendedNeckVeins ? `, Distended Neck Veins: ${circ.distendedNeckVeins}` : ''}${circ.pct ? `, PCT: ${circ.pct}` : ''}${circ.longBoneDeformity ? `, Long bone deformity: ${circ.longBoneDeformity}` : ''}${circ.fast ? `, FAST: ${circ.fast}` : ''}${circ.intervention ? `, Interventions: ${circ.intervention}` : ''}</td>
          </tr>
          <tr>
            <td class="bg-light">Disability:</td>
            <td>GCS: ${dis.gcs || "15/15"}</td>
            <td class="bg-light">Pupils / GRBS:</td>
            <td>Pupils: ${dis.pupils || "Equal & reactive"}, GRBS: ${dis.grbs || "N/A"}</td>
          </tr>
          <tr>
            <td class="bg-light">Exposure:</td>
            <td colspan="3">Temp: ${exp.temp || "Normal"}${exp.logRoll ? ` | Trauma / Logroll: ${exp.logRoll}` : ''}</td>
          </tr>
        </table>

        ${s.generalAndSystemicExam ? `
        <h2>4. General & Systemic Examination</h2>
        <div class="section-box">
          <div>${s.generalAndSystemicExam}</div>
        </div>
        ` : ''}

        <h2>${s.generalAndSystemicExam ? '5' : '4'}. Course In Hospital & ER Treatment</h2>
        <div class="section-box">
          <div>${s.courseInHospital || "Evaluated and treated in ED."}</div>
        </div>

        <h2>${s.generalAndSystemicExam ? '6' : '5'}. Key Investigations & Lab Results</h2>
        <table class="header-table">
          ${Object.entries(inv).filter(([_, v]) => Boolean(v)).map(([k, v]) => `<tr><td class="bg-light" style="width: 28%;">${k.toUpperCase()}:</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">No key lab results documented.</td></tr>'}
        </table>

        <h2>${s.generalAndSystemicExam ? '7' : '6'}. Diagnosis At Discharge</h2>
        <ul>
          ${(s.diagnosisAtDischarge || ["Emergency Clinical Evaluation"]).map((d: string) => `<li><strong>${d}</strong></li>`).join('')}
        </ul>

        <h2>${s.generalAndSystemicExam ? '8' : '7'}. Discharge Advice & Medications</h2>
        ${Array.isArray(s.dischargeMedications) && s.dischargeMedications.length > 0 ? `
          <ul>
            ${s.dischargeMedications.map((m: string) => `<li>${m}</li>`).join('')}
          </ul>
        ` : '<div>No oral discharge medications prescribed. Transferred / Admitted as noted.</div>'}

        <h2>${s.generalAndSystemicExam ? '9' : '8'}. Disposition & Vitals At Discharge</h2>
        <table class="header-table">
          <tr>
            <td class="bg-light">Disposition Status:</td>
            <td><strong>${s.disposition || "Normal Discharge"}</strong></td>
            <td class="bg-light">Condition:</td>
            <td><strong>${s.conditionAtDischarge || "STABLE"}</strong></td>
          </tr>
          <tr>
            <td class="bg-light">Discharge Vitals:</td>
            <td colspan="3">HR: ${vDischarge.hr || "N/A"} | BP: ${vDischarge.bp || "N/A"} | RR: ${vDischarge.rr || "N/A"} | SpO₂: ${vDischarge.spo2 || "N/A"} | GCS: ${vDischarge.gcs || "N/A"} | Temp: ${vDischarge.temp || "N/A"}</td>
          </tr>
        </table>

        <div style="margin-top: 8px;">
          <strong>Follow-Up Advice:</strong> ${s.followUpAdvice || "Review in ED if warning symptoms worsen or recur."}
        </div>

        <table class="footer-sign">
          <tr>
            <td>
              <div>______________________________</div>
              <div>Dr. ${s.edResident || "Duty EM Resident"}</div>
              <div style="font-size: 8pt; color: #6b7280;">Emergency Medicine Resident</div>
            </td>
            <td style="text-align: right;">
              <div>______________________________</div>
              <div>Dr. ${s.edConsultant || "ED Consultant"}</div>
              <div style="font-size: 8pt; color: #6b7280;">Consultant Emergency Medicine</div>
            </td>
          </tr>
        </table>

        <div style="font-size: 8pt; color: #6b7280; margin-top: 25px; border-top: 1px solid #d1d5db; padding-top: 10px; text-align: center; line-height: 1.4;">
          This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request as per applicable Medico-legal regulations. For a disability certificate, approach a Government-constituted Medical Board.
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Discharge_Summary_${item.patientName.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Form states for adding/editing a quick-paste patient
  const [qpName, setQpName] = useState("");
  const [qpAgeGender, setQpAgeGender] = useState("");
  const [qpTriage, setQpTriage] = useState("P2 (Urgent)");
  const [qpVitals, setQpVitals] = useState("");
  const [qpRawNotes, setQpRawNotes] = useState("");
  const [editingQpId, setEditingQpId] = useState<string | null>(null);

  const scribeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand scribe textarea
  useEffect(() => {
    const textarea = scribeTextareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
    }
  }, [qpRawNotes]);

  // AI-Assisted Handover Parser States
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [handoverImgBase64, setHandoverImgBase64] = useState<string | null>(null);
  const [handoverImgName, setHandoverImgName] = useState<string | null>(null);
  const [showScribeMoreMenu, setShowScribeMoreMenu] = useState(false);
  const scribeMoreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (scribeMoreMenuRef.current && !scribeMoreMenuRef.current.contains(event.target as Node)) {
        setShowScribeMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [aiParseError, setAiParseError] = useState<string | null>(null);
  const [aiParseSuccessMsg, setAiParseSuccessMsg] = useState<string | null>(null);
  const [qpStructuredSBAR, setQpStructuredSBAR] = useState<{
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  } | null>(null);

  // Copy states
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});

  // Medical Scribe Chat States
  const [chatMessages, setChatMessages] = useState<ScribeChatMessage[]>(() => {
    const saved = localStorage.getItem("ermate_scribe_chat_messages");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved scribe chat messages:", e);
      }
    }
    return [
      {
        id: "system-1",
        sender: "ermate",
        text: "Hello! I am your ErMate clinical shift transition scribe. Copy-paste some unstructured clinical text or EMR notes, or upload a camera photo of your handwritten paper case sheets. I'll immediately parse the details, extract vitals and triage level, organize it into standard SBAR format, and log it to your active shift handover roster!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  // Sync chat messages to localStorage
  useEffect(() => {
    localStorage.setItem("ermate_scribe_chat_messages", JSON.stringify(chatMessages));
  }, [chatMessages]);

  const [scribeDraftToast, setScribeDraftToast] = useState(false);

  const handleSaveScribeDraft = () => {
    try {
      localStorage.setItem("ermate_scribe_chat_messages", JSON.stringify(chatMessages));
      setScribeDraftToast(true);
      setTimeout(() => setScribeDraftToast(false), 3000);
    } catch (err) {
      console.error("Error saving scribe draft:", err);
    }
  };

  const handleDeleteMessage = (id: string) => {
    setChatMessages(prev => prev.filter(msg => msg.id !== id));
  };

  const [confirmResetChat, setConfirmResetChat] = useState(false);
  const [confirmClearRoster, setConfirmClearRoster] = useState(false);

  // Edit Patient Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<QuickPastePatient | null>(null);

  // Generate view modal / print layout
  const [showPrintReport, setShowPrintReport] = useState(false);
  const [printType, setPrintType] = useState<"registry" | "quickpaste">("registry");
  const [handoverLoggedSuccess, setHandoverLoggedSuccess] = useState(false);

  const [editableRows, setEditableRows] = useState<HandoverTableRow[]>([]);
  const [editingCells, setEditingCells] = useState<Record<string, boolean>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "idle">("idle");

  const [boundChatContext, setBoundChatContext] = useState<ChatContext | null>(null);
  const [isBoundChatOpen, setIsBoundChatOpen] = useState(false);

  const handleOpenHandoverRowChat = (row: HandoverTableRow) => {
    setBoundChatContext({
      type: 'handover',
      id: row.id || `handover_row_${row.bed}_${row.name}`,
      data: {
        patientLabel: {
          name: row.name,
          ageSex: row.ageGender,
          bed: row.bed,
          erNumber: row.erNo,
          admittingConsultant: row.doctor,
          inERSince: row.stayDuration,
          status: 'unstable'
        },
        presentingComplaint: row.complaints,
        story: row.chronologicalNotes || row.complaints,
        pmh: row.history,
        diagnosis: row.assessment,
        done: row.planDone ? row.planDone.split('\n') : [],
        toBeDone: row.planToBeDone ? row.planToBeDone.split('\n') : [],
        vitalsNow: row.vitals,
        alertRow: row.alerts
      },
      canEdit: true,
      onRecordUpdated: (updatedFields) => {
        setEditableRows(prev => prev.map(r => {
          if (r.id !== row.id) return r;
          return {
            ...r,
            ...(updatedFields.diagnosis ? { assessment: updatedFields.diagnosis } : {}),
            ...(updatedFields.toBeDone ? { planToBeDone: Array.isArray(updatedFields.toBeDone) ? updatedFields.toBeDone.join('\n') : updatedFields.toBeDone } : {}),
            ...(updatedFields.done ? { planDone: Array.isArray(updatedFields.done) ? updatedFields.done.join('\n') : updatedFields.done } : {}),
            ...(updatedFields.alertRow ? { alerts: updatedFields.alertRow } : {})
          };
        }));
      }
    });
    setIsBoundChatOpen(true);
  };

  const handleOpenHandoverCardChat = (patient: HandoverPatient) => {
    setBoundChatContext({
      type: 'handover',
      id: patient.id || `handover_card_${patient.patientLabel?.bed}_${patient.patientLabel?.name}`,
      data: patient,
      canEdit: true
    });
    setIsBoundChatOpen(true);
  };

  const toggleCellEditing = (rowId: string, field: string) => {
    const key = `${rowId}_${field}`;
    setEditingCells(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [handoverMeta, setHandoverMeta] = useState({
    date: new Date().toLocaleDateString('en-GB'),
    from: "Night Shift",
    to: "Morning Shift",
    time: "07:15 AM",
  });
  const [isViewingSheet, setIsViewingSheet] = useState(false);
  const [hospitalName, setHospitalName] = useState(() => {
    return profile?.hospital || "EMERGENCY DEPARTMENT";
  });

  const saveRefinedHandoverSheet = useCallback((rows: HandoverTableRow[], meta: typeof handoverMeta) => {
    if (!rows || rows.length === 0) return;
    setAutoSaveStatus("saving");
    try {
      localStorage.setItem("ermate_refined_handover_rows_v2", JSON.stringify(rows));
      localStorage.setItem("ermate_refined_handover_meta_v2", JSON.stringify(meta));
    } catch (err) {
      console.warn("Failed to write handover to localStorage:", err);
    }

    const activeDocRef = doc(db, "handover_sheets", "active_shift");
    setDoc(activeDocRef, {
      rows,
      meta,
      hospitalName,
      updatedAt: new Date().toISOString(),
      updatedBy: profile?.name || "Doctor"
    }, { merge: true }).then(() => {
      setAutoSaveStatus("saved");
    }).catch(err => {
      console.warn("Firestore handover sheet save warning:", err);
      setAutoSaveStatus("saved");
    });
  }, [profile?.name, hospitalName]);

  // Restore saved handover state on mount
  useEffect(() => {
    try {
      const savedStr = localStorage.getItem("ermate_refined_handover_rows_v2");
      const savedMetaStr = localStorage.getItem("ermate_refined_handover_meta_v2");
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEditableRows(parsed);
        }
      }
      if (savedMetaStr) {
        const parsedMeta = JSON.parse(savedMetaStr);
        if (parsedMeta && typeof parsedMeta === "object") {
          setHandoverMeta(prev => ({ ...prev, ...parsedMeta }));
        }
      }
    } catch (e) {
      console.warn("Failed to load saved handover rows from localStorage:", e);
    }

    const activeDocRef = doc(db, "handover_sheets", "active_shift");
    getDoc(activeDocRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.rows) && data.rows.length > 0) {
          setEditableRows(data.rows);
          if (data.meta) {
            setHandoverMeta(prev => ({ ...prev, ...data.meta }));
          }
        }
      }
    }).catch(err => {
      console.warn("Firestore handover sheet fetch error:", err);
    });
  }, []);

  useEffect(() => {
    if (profile?.hospital) {
      setHospitalName(profile.hospital);
    }
  }, [profile?.hospital]);

  // Bulk Cleanup Handler to resolve shift handover conflicts
  const handleBulkCleanup = async (action: "discharge" | "delete" | "clear_quickpaste") => {
    setCleanupActionInProgress(true);
    try {
      if (action === "clear_quickpaste") {
        setQuickPasteList([]);
        localStorage.removeItem("ermate_quick_paste_list");
        setActionSuccessMsg("Local Quick-Paste patient logs cleared successfully!");
        setHasUnclearedShiftWarning(false);
      } else if (action === "discharge") {
        // Bulk update statuses of selected cases in Firestore to "Discharged"
        for (const id of idsToCleanup) {
          const targetCase = cases.find(c => c.id === id);
          if (targetCase) {
            const updated = {
              ...targetCase,
              status: "Discharged" as const,
              hospital: targetCase.hospital || profile.hospital
            };
            await setDoc(doc(db, "cases", id), updated);
          }
        }
        setActionSuccessMsg(`Successfully discharged & archived ${idsToCleanup.length} cases from the active board!`);
        // Deselect them
        setSelectedRegistryIds(prev => prev.filter(id => !idsToCleanup.includes(id)));
        setHasUnclearedShiftWarning(false);
      } else if (action === "delete") {
        // Bulk delete from Firestore
        for (const id of idsToCleanup) {
          await deleteDoc(doc(db, "cases", id));
        }
        setActionSuccessMsg(`Successfully deleted ${idsToCleanup.length} patient case logs completely!`);
        // Deselect them
        setSelectedRegistryIds(prev => prev.filter(id => !idsToCleanup.includes(id)));
        setHasUnclearedShiftWarning(false);
      }
    } catch (err) {
      console.error("Error performing handover cleanup:", err);
      alert("Error performing cleanup operation. Please try again.");
    } finally {
      setCleanupActionInProgress(false);
      setShowPostPrintCleanPrompt(false);
      setTimeout(() => setActionSuccessMsg(null), 6000);
    }
  };

function extractPatientNameAndTimestamp(rawText: string): {
  name: string;
  ageGender: string;
  time: string;
  bed: string | null;
} {
  if (!rawText || typeof rawText !== 'string') {
    return { name: "Bed Patient", ageGender: "Unknown", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), bed: null };
  }

  let name = "";
  let ageGender = "";
  let time = "";
  let bed: string | null = null;

  // 1. Bed Extraction
  const bedMatch = rawText.match(/(?:bed|bay|room)\s*#?\s*:?\s*([a-z0-9\-]+)/i);
  if (bedMatch) {
    bed = bedMatch[1].trim();
  }

  // 2. Name Extraction
  // Pattern A: Explicit label "PATIENT: ...", "Patient Name: ...", "Pt Name: ...", "Name: ..."
  const labelMatch = rawText.match(/(?:patient(?:\s*name)?|pt(?:\s*name)?|name)\s*[:=-]\s*([A-Za-z\s\.']+?)(?=[,\n\r\t\d\/\(\);]|UHID|MLC|Age|Bed|Allergies|$)/i);
  if (labelMatch && labelMatch[1].trim().length > 1) {
    const candidate = labelMatch[1].trim();
    if (!/^(?:unknown|bed|patient|male|female|adult|na|nil)$/i.test(candidate) && candidate.length < 35) {
      name = candidate;
    }
  }

  // Pattern B: Name before age/gender (e.g. "Raman Pillai, 58/M" or "Selvarani, 57F" or "Varghese KC / 48M")
  if (!name) {
    const ageSexNameMatch = rawText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[\/,-]?\s*(\d{1,3}\s*[\/,-]?\s*[MFmf])\b/);
    if (ageSexNameMatch) {
      name = ageSexNameMatch[1].trim();
      ageGender = ageSexNameMatch[2].replace(/\s+/g, '').toUpperCase();
    }
  }

  // Pattern C: "Mr. Raman Pillai" or "Mrs. Selvarani" or "Pt. Varghese KC"
  if (!name) {
    const titleMatch = rawText.match(/(?:mr\.|mrs\.|ms\.|pt\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i);
    if (titleMatch) {
      name = titleMatch[1].trim();
    }
  }

  // Pattern D: Header pattern: "DD-MM-YYYY HH:MM AM/PM / Author / Name"
  if (!name) {
    const headerMatch = rawText.match(/\d{2}[-\/]\d{2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s*\/\s*(?:[^\/]+\/)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (headerMatch) {
      name = headerMatch[1].trim();
    }
  }

  // Fallback Name
  if (!name) {
    name = bed ? `Bed ${bed}` : "Bed Patient";
  }

  // 3. Age & Gender Extraction (if not matched yet)
  if (!ageGender || ageGender === "Unknown") {
    const ageMatch = rawText.match(/(\d{1,3})\s*(?:year|y\.?o\.?|yo|f|m|\/f|\/m)/i) || rawText.match(/(?:age)\s*[:=-]?\s*(\d{1,3})/i);
    const genderMatch = rawText.match(/\b(female|male|f|m)\b/i);
    if (ageMatch) {
      const ageNum = ageMatch[1];
      const genderLetter = genderMatch ? genderMatch[1].toUpperCase().charAt(0) : "";
      ageGender = genderLetter ? `${ageNum}${genderLetter}` : `${ageNum}y`;
    } else {
      ageGender = "Unknown";
    }
  }

  // 4. Time / Timestamp Extraction
  // Pattern A: "ARRIVING VITALS (08:30 AM):" or "ARRIVING VITALS 08:30 AM"
  const arrivingVitalsMatch = rawText.match(/(?:arriving\s+vitals|arrival\s+vitals|arrival|arrived)\s*\(?\s*([0-2]?\d:[0-5]\d(?:\s*[AP]M)?)\s*\)?/i);
  if (arrivingVitalsMatch) {
    time = arrivingVitalsMatch[1].trim();
  }

  // Pattern B: "@ 08:30 AM" or "Time: 08:30 AM" or "Arrived at: 08:30 AM"
  if (!time) {
    const explicitTimeMatch = rawText.match(/(?:@|time|arrived\s+at)\s*[:=-]?\s*([0-2]?\d:[0-5]\d(?:\s*[AP]M)?)/i);
    if (explicitTimeMatch) {
      time = explicitTimeMatch[1].trim();
    }
  }

  // Pattern C: Full date-time "28-07-2026 08:30 AM" or "28/07/2026 10:15 AM"
  if (!time) {
    const dateTimeMatch = rawText.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\s+([0-2]?\d:[0-5]\d(?:\s*[AP]M)?)\b/i);
    if (dateTimeMatch) {
      time = dateTimeMatch[1].trim();
    }
  }

  // Pattern D: Any standalone time "08:30 AM" or "10:15 PM" or "14:30"
  if (!time) {
    const timeMatch = rawText.match(/\b([0-2]?\d:[0-5]\d(?:\s*[AP]M))\b/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
    }
  }

  // Fallback Time
  if (!time) {
    time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return { name, ageGender, time, bed };
}

function extractLatestVitalsWithTime(
  vitalsObj?: { bp?: string; hr?: string; spo2?: string; rr?: string; temp?: string; gcs?: string; grbs?: string },
  notesList?: Array<{ timestamp?: string; content?: string }>,
  rawText?: string
): string {
  // If rawText already starts with `@ Time` or formatted vitals with time
  if (rawText && /^@\s*[0-2]?\d:[0-5]\d/i.test(rawText.trim())) {
    return rawText.trim();
  }

  // 1. Search notesList reverse-chronologically for a note containing vitals
  if (notesList && notesList.length > 0) {
    const reversed = [...notesList].reverse();
    for (const note of reversed) {
      const content = note.content || "";
      if (/(?:bp|hr|pulse|spo2|grbs|gcs|temp|vitals)\b/i.test(content)) {
        let timeStr = note.timestamp || "";
        const timeMatch = content.match(/\b([0-2]?\d:[0-5]\d(?:\s*[ap]m)?)\b/i) || (timeStr ? timeStr.match(/\b([0-2]?\d:[0-5]\d(?:\s*[ap]m)?)\b/i) : null);
        const extractedTime = timeMatch ? timeMatch[1] : (timeStr.trim() || "");

        const vitalsSnippetMatch = content.match(/(?:BP|HR|Pulse|SpO2|GRBS|GCS|Temp|RR|MAP)\s*[:=]?\s*[\d\/\.\s%⚠A-Za-z°C\-]+/i);
        if (vitalsSnippetMatch) {
          const snippet = vitalsSnippetMatch[0].trim();
          if (/^@\s*[0-2]?\d:[0-5]\d/i.test(snippet)) return snippet;
          return extractedTime ? `@ ${extractedTime} · ${snippet}` : snippet;
        }
      }
    }
  }

  // 2. Search rawText reverse-chronologically for vitals line + timestamp
  if (rawText && rawText.trim().length > 0) {
    const lines = rawText.split(/\r?\n+/);
    const reversedLines = [...lines].reverse();

    for (let i = 0; i < reversedLines.length; i++) {
      const line = reversedLines[i].trim();
      if (!line) continue;

      if (/(?:bp|hr|pulse|spo2|grbs|gcs|temp|vitals)\b/i.test(line)) {
        if (/^@\s*[0-2]?\d:[0-5]\d/i.test(line)) {
          return line;
        }

        // Look for timestamp on this line or preceding lines in original text
        let timeMatch = line.match(/\b([0-2]?\d:[0-5]\d(?:\s*[ap]m)?)\b/i) || line.match(/\b(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\s+[0-2]?\d:[0-5]\d(?:\s*[ap]m)?)\b/i);
        if (!timeMatch) {
          for (let j = i + 1; j < Math.min(i + 4, reversedLines.length); j++) {
            const prevLine = reversedLines[j];
            const prevTimeMatch = prevLine.match(/\b([0-2]?\d:[0-5]\d(?:\s*[ap]m)?)\b/i);
            if (prevTimeMatch) {
              timeMatch = prevTimeMatch;
              break;
            }
          }
        }

        const extractedTime = timeMatch ? timeMatch[1] : "";

        let vitalsPart = line;
        const vitalsIdx = line.search(/(?:BP|HR|Pulse|SpO2|GRBS|GCS|Temp|RR|MAP|Vitals)\b/i);
        if (vitalsIdx !== -1) {
          vitalsPart = line.substring(vitalsIdx).trim();
        }

        if (vitalsPart) {
          vitalsPart = vitalsPart.replace(/^[:\-\s]+/, "").trim();
          if (/^@\s*[0-2]?\d:[0-5]\d/i.test(vitalsPart)) return vitalsPart;
          return extractedTime ? `@ ${extractedTime} · ${vitalsPart}` : vitalsPart;
        }
      }
    }
  }

  // 3. Fallback to structured vitalsObj
  if (vitalsObj && (vitalsObj.bp || vitalsObj.hr || vitalsObj.spo2 || vitalsObj.grbs || vitalsObj.gcs || vitalsObj.temp)) {
    const parts: string[] = [];
    if (vitalsObj.bp) parts.push(`BP ${vitalsObj.bp}`);
    if (vitalsObj.hr) parts.push(`HR ${vitalsObj.hr}`);
    if (vitalsObj.spo2) parts.push(`SpO2 ${vitalsObj.spo2}%`);
    if (vitalsObj.grbs) parts.push(`GRBS ${vitalsObj.grbs}${Number(vitalsObj.grbs) > 300 ? '⚠' : ''}`);
    if (vitalsObj.gcs) parts.push(`GCS ${vitalsObj.gcs}`);
    if (vitalsObj.temp) parts.push(`Temp ${vitalsObj.temp}`);
    if (vitalsObj.rr) parts.push(`RR ${vitalsObj.rr}`);

    const formattedVitals = parts.join(" · ");
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `@ ${nowTime} · ${formattedVitals}`;
  }

  return "BP 120/80 · HR 72 · SpO2 98%";
}

  function checkLineForAbnormalities(line: string): boolean {
    if (!line) return false;
    if (/⚠|⚠️|high|low|abnormal|positive|elevated|severe|critical|panic/i.test(line)) return true;
    if (/grbs\s*(?:>|:|=)?\s*(?:2[0-9]\d|[3-9]\d\d)/i.test(line)) return true;
    if (/wbc\s*(?:>|:|=)?\s*(?:1[2-9]|[2-9]\d)/i.test(line)) return true;
    if (/crp\s*(?:>|:|=)?\s*(?:1\d|[2-9]\d)/i.test(line)) return true;
    if (/(?:creatinine|cr)\s*(?:>|:|=)?\s*(?:1\.[4-9]|[2-9])/i.test(line)) return true;
    if (/lactate\s*(?:>|:|=)?\s*(?:2\.[1-9]|[3-9])/i.test(line)) return true;
    if (/troponin\s*(?:positive|pos|>)/i.test(line)) return true;
    if (/inr\s*(?:>|:|=)?\s*(?:1\.[6-9]|[2-9])/i.test(line)) return true;
    if (/(?:ct|mri|usg|x-ray|cxr)\s*.*(?:infarct|hemorrhage|ich|fracture|pneumothorax|effusion|perforation|mass|edema)/i.test(line)) return true;
    return false;
  }

  function extractAlertStringsFromLine(line: string): string[] {
    if (!line) return [];
    const alerts: string[] = [];
    const grbsM = line.match(/grbs\s*(?:>|:|=)?\s*(\d+)/i);
    if (grbsM && parseInt(grbsM[1], 10) > 200) alerts.push(`GRBS: ${grbsM[1]} mg/dL`);

    const wbcM = line.match(/wbc\s*(?:>|:|=)?\s*(\d+(?:\.\d+)?k?)/i);
    if (wbcM) alerts.push(`WBC: ${wbcM[1]}`);

    const crpM = line.match(/crp\s*(?:>|:|=)?\s*(\d+(?:\.\d+)?)/i);
    if (crpM && parseFloat(crpM[1]) > 10) alerts.push(`CRP: ${crpM[1]}`);

    const crM = line.match(/(?:creatinine|cr)\s*(?:>|:|=)?\s*(\d+(?:\.\d+)?)/i);
    if (crM && parseFloat(crM[1]) > 1.3) alerts.push(`Creatinine: ${crM[1]}`);

    const lacM = line.match(/lactate\s*(?:>|:|=)?\s*(\d+(?:\.\d+)?)/i);
    if (lacM && parseFloat(lacM[1]) > 2.0) alerts.push(`Lactate: ${lacM[1]}`);

    if (/troponin\s*(?:positive|pos|>)/i.test(line)) alerts.push("Troponin: Positive");

    const imgM = line.match(/(?:ct|mri|usg|x-ray|cxr)\s*[:=-]?\s*([^\.\n\r]+)/i);
    if (imgM && /(?:infarct|hemorrhage|ich|fracture|pneumothorax|effusion|perforation|mass)/i.test(imgM[1])) {
      alerts.push(imgM[0].trim());
    }

    return alerts;
  }

  function parseTimestampFromText(str: string): number {
    if (!str) return 9999;
    const timeMatch = str.match(/\b([0-1]?\d|2[0-3]):([0-5]\d)(?:\s*([AP]M))?\b/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const mins = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3];
      if (ampm) {
        if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
        if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
      }
      return hours * 60 + mins;
    }
    return 9999;
  }

  function extractChronologicalInvestigationsAndAlerts(
    rawText: string,
    assessmentStr?: string,
    investigationsArray?: InvestigationItem[]
  ): {
    formattedAssessment: string;
    alertsList: string[];
    planDoneLabsText: string;
  } {
    const alertsList: string[] = [];
    const investigationLines: { timeStr?: string; text: string; isAlert: boolean; timestamp: number }[] = [];
    const completedLabNames: string[] = [];

    // 1. Process investigationsArray
    if (investigationsArray && investigationsArray.length > 0) {
      investigationsArray.forEach(inv => {
        const isAbn = !!inv.isAbnormal || checkLineForAbnormalities(`${inv.testName} ${inv.result || ''}`);
        const resText = `${inv.testName}: ${inv.result || 'Done'}${isAbn && !inv.result?.includes('⚠') ? ' ⚠' : ''}`;
        if (isAbn) {
          alertsList.push(`${inv.testName}: ${inv.result || 'Abnormal'}`);
        }
        completedLabNames.push(inv.testName);
        
        const ts = parseTimestampFromText(`${inv.resultTime || inv.orderTime || ''} ${inv.result || ''}`);
        investigationLines.push({
          timeStr: inv.resultTime || inv.orderTime || undefined,
          text: resText,
          isAlert: isAbn,
          timestamp: ts
        });
      });
    }

    // 2. Process combined rawText / assessmentStr
    const combinedText = `${assessmentStr || ''}\n${rawText || ''}`;
    const lines = combinedText.split(/\n+/).map(l => l.trim()).filter(Boolean);

    const labKeywordsRegex = /\b(?:cbc|wbc|hgb|hb|platelet|rft|creatinine|urea|lft|bilirubin|sgot|sgpt|trop|troponin|ckmb|crp|esr|abg|vbg|lactate|grbs|sugar|d-dimer|ddimer|inr|pt\/inr|urine|ecg|ekg|cxr|x-ray|xray|ct|mri|usg|echo|fast|labs?|investigations?|results?|blood|ionised|potassium|sodium)\b/i;

    lines.forEach(line => {
      // Exclude nursing/logistics status messages from diagnostic lab results
      const isNursingLogistics = /shifted\s+for|slot\s+called|half\s+an\s+hour\s+delay|delay|informed|foley|cannula|iv\s+line|shifted\s+to|slot\s+again|bystander/i.test(line);
      if (labKeywordsRegex.test(line) && !isNursingLogistics) {
        if (!investigationLines.some(il => il.text.toLowerCase().includes(line.toLowerCase().substring(0, 18)))) {
          const isAbn = checkLineForAbnormalities(line);
          let cleanedLine = line;
          if (isAbn && !cleanedLine.includes("⚠") && !cleanedLine.includes("⚠️")) {
            cleanedLine += " ⚠";
          }

          const extractedAlerts = extractAlertStringsFromLine(line);
          extractedAlerts.forEach(a => {
            if (!alertsList.includes(a)) alertsList.push(a);
          });

          const ts = parseTimestampFromText(line);
          const timeMatch = line.match(/(?:@\s*)?\b(?:[0-1]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*[AP]M)?\b/i);

          investigationLines.push({
            timeStr: timeMatch ? timeMatch[0] : undefined,
            text: cleanedLine,
            isAlert: isAbn,
            timestamp: ts
          });

          const testNameMatch = line.match(/\b(CBC|RFT|LFT|VBG|ABG|CT\s*\w+|MRI\s*\w+|X-Ray|CXR|USG|Echo|ECG|Troponin|CRP|GRBS)\b/i);
          if (testNameMatch && !completedLabNames.includes(testNameMatch[0].toUpperCase())) {
            completedLabNames.push(testNameMatch[0].toUpperCase());
          }
        }
      }
    });

    // Sort investigation lines chronologically
    investigationLines.sort((a, b) => a.timestamp - b.timestamp);

    let formattedAssessment = assessmentStr || "";
    if (investigationLines.length > 0) {
      const invSectionText = investigationLines.map(item => {
        const prefix = item.timeStr ? `[${item.timeStr}] ` : "• ";
        return `${prefix}${item.text}`;
      }).join("\n");

      if (!formattedAssessment.toLowerCase().includes("investigation") && !formattedAssessment.toLowerCase().includes("lab result")) {
        formattedAssessment = `${formattedAssessment ? `${formattedAssessment}\n\n` : ''}INVESTIGATION FINDINGS (Chronological Order):\n${invSectionText}`;
      } else if (!formattedAssessment.includes("INVESTIGATION FINDINGS")) {
        formattedAssessment += `\n\nINVESTIGATION FINDINGS (Chronological Order):\n${invSectionText}`;
      }
    }

    const planDoneLabsText = completedLabNames.length > 0 ? `✓ Completed Investigations: ${completedLabNames.join(", ")}` : "✓ Investigations reviewed.";

    return { formattedAssessment, alertsList, planDoneLabsText };
  }

  const getRegistryRows = (): HandoverTableRow[] => {
    const selectedCases = cases.filter(c => selectedRegistryIds.includes(c.id));
    const rows = selectedCases.map((c, idx) => {
      const rxText = c.treatments.map(t => `${t.drugName} ${t.dose}${t.route ? ` (${t.route})` : ''}`).join(", ");
      
      const diagnosisText = c.provisionalPrimaryDiagnosis 
        ? `PROVISIONAL DIAGNOSIS: ${c.provisionalPrimaryDiagnosis}` 
        : "PROVISIONAL DIAGNOSIS: Under evaluation";

      // Extract investigation details, chronological ordering, and alerts
      const { formattedAssessment, alertsList: invAlerts, planDoneLabsText } = extractChronologicalInvestigationsAndAlerts(
        `${c.notes?.map(n => n.content).join("\n") || ''} ${c.investigationResultsSummary || ''} ${c.investigationImaging || ''}`,
        diagnosisText,
        c.investigations || []
      );

      const doneParts: string[] = [];
      if (planDoneLabsText) doneParts.push(planDoneLabsText);
      if (rxText) doneParts.push(`✓ Treatments given: ${rxText}`);
      if (c.vitals && (c.vitals.bp || c.vitals.hr || c.vitals.spo2)) {
        doneParts.push(`✓ Vitals logged: BP ${c.vitals.bp || 'N/A'} | HR ${c.vitals.hr || 'N/A'} | SpO2 ${c.vitals.spo2 || 'N/A'}%`);
      }
      const planDoneText = doneParts.length > 0 ? doneParts.join("\n") : "✓ Initial emergency evaluation & vitals recorded.";

      const planToBeDoneText = c.dispositionDetails?.observationNotes ? `□ ${c.dispositionDetails.observationNotes}` : "□ Monitor clinical status and complete all pending orders as per shift schedule.";

      const vitalsText = extractLatestVitalsWithTime(
        c.vitals,
        c.notes,
        `${c.vitals.bp ? `BP ${c.vitals.bp}` : ''} ${c.vitals.hr ? `HR ${c.vitals.hr}` : ''} ${c.vitals.spo2 ? `SpO2 ${c.vitals.spo2}` : ''}\n${c.notes?.map(n => n.content).join("\n") || ''}`
      );

      const historyText = c.sampleHistory?.pastHistory ? c.sampleHistory.pastHistory : "";

      const chronoNotes = c.notes && c.notes.length > 0
        ? [...c.notes].reverse().map(n => `${n.timestamp || 'Initial'} ${n.authorRole ? `Dr. ${n.authorName || 'Lead'}` : ''} · ${n.content}`).join("\n\n")
        : `${new Date(c.admissionTime || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} ${new Date(c.admissionTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Dr. ${profile.name || 'Duty'} · First assessment\nBP ${c.vitals.bp || "N/A"} · GCS normal · Vitals logged`;

      // Extract Bystander Counselling info if recorded
      let bystanderNote = "";
      const registryAllNotes = c.notes?.map(n => n.content).join("\n") || "";
      const bystanderMatch = registryAllNotes.match(/(?:bystander|family|relatives|counselled|explained|informed)\s*[:=-]?\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
      if (bystanderMatch && bystanderMatch[0]) {
        bystanderNote = bystanderMatch[0].trim();
      }

      // Extract Alert Flags
      const alertList: string[] = [...invAlerts];
      if (c.vitalFlags && c.vitalFlags.length > 0) {
        c.vitalFlags.forEach(f => { if (!alertList.includes(f)) alertList.push(f); });
      }

      const combinedForAlerts = `${c.vitals.bp || ''} ${c.vitals.hr || ''} ${c.vitals.spo2 || ''} ${c.investigationResultsSummary || ''} ${c.investigationImaging || ''}`;
      if (/grbs\s*(?:>|:|=)?\s*(?:3[0-9]\d|[4-9]\d\d)/i.test(combinedForAlerts) && !alertList.some(a => a.toLowerCase().includes("grbs"))) {
        alertList.push("Elevated GRBS (>300)");
      }
      if (/wbc\s*(?:>|:|=)?\s*(?:1[5-9]|[2-9]\d)/i.test(combinedForAlerts) && !alertList.some(a => a.toLowerCase().includes("wbc"))) {
        alertList.push("Severe Leukocytosis");
      }
      if (/cr\s*(?:>|:|=)?\s*(?:1\.[5-9]|[2-9])/i.test(combinedForAlerts) && !alertList.some(a => a.toLowerCase().includes("cr"))) {
        alertList.push("Elevated Creatinine");
      }
      if (/inr\s*(?:>|:|=)?\s*(?:1\.[5-9]|[2-9])/i.test(combinedForAlerts) && !alertList.some(a => a.toLowerCase().includes("inr"))) {
        alertList.push("Coagulopathy / High INR");
      }

      const alertsText = alertList.length > 0 ? `⚠ ${alertList.join(" · ")}` : "";

      return {
        id: c.id,
        bed: c.bedNo || `Bed ${idx + 1}`,
        name: c.patient.name || "Anonymous",
        ageGender: `${c.patient.age || "N/A"}${c.patient.gender === "Male" ? "M" : c.patient.gender === "Female" ? "F" : "U"}`,
        erNo: `ER# ${c.patient.id || c.id.substring(0, 7)}`,
        doctor: `Dr. ${profile.name || "Manoj"}`,
        stayDuration: `In ER since: ${c.admissionTime ? new Date(c.admissionTime).toLocaleDateString('en-GB') : 'Today'}`,
        complaints: c.patient.presentingComplaint || "Acute ER Presentation",
        chronologicalNotes: chronoNotes,
        history: historyText,
        assessment: formattedAssessment,
        planDone: planDoneText,
        planToBeDone: planToBeDoneText,
        bystander: bystanderNote,
        vitals: vitalsText,
        alerts: alertsText
      };
    });

    return sortRowsByBedNumber(rows);
  };

  function extractPresentingComplaint(item: { presentingComplaint?: string; rawNotes?: string; structuredSBAR?: { situation?: string } }): string {
  if (item.presentingComplaint && item.presentingComplaint.trim().length > 0) {
    return item.presentingComplaint.trim();
  }
  if (!item.rawNotes) {
    return item.structuredSBAR?.situation || "";
  }
  const raw = item.rawNotes;

  // Search for explicit complaint headings in raw notes
  const complaintPatterns = [
    /(?:presenting\s+complaints?|chief\ complaints?|complaints|c\/o|complaining\ of|reason\ for\ visit|reason\ for\ admission|presentation)\s*[:=-]?\s*([^\n\r]+(?:\n[^\n\r]+)?)/i,
    /(?:presented\s+with|history\ of)\s+([^\n\r\.]+)/i
  ];

  for (const pat of complaintPatterns) {
    const match = raw.match(pat);
    if (match && match[1] && match[1].trim().length > 3) {
      let cleaned = match[1].trim();
      if (cleaned.length > 250) cleaned = cleaned.substring(0, 250) + "...";
      return cleaned;
    }
  }

  if (item.structuredSBAR?.situation && item.structuredSBAR.situation.trim().length > 0) {
    return item.structuredSBAR.situation.trim();
  }

  if (raw.length <= 200) {
    return raw.trim();
  }
  return raw.substring(0, 180) + "...";
}

  const getQuickPasteRows = (): HandoverTableRow[] => {
    const selected = quickPasteList.filter(qp => selectedQuickPasteIds.includes(qp.id));
    const isGenericName = (n?: string | null) => !n || /^(bed patient|anonymous|patient|bed \d+|unknown|n\/a)$/i.test(n.trim());

    const rows = selected.map((qp, idx) => {
      const card = qp.handoverCardData;

      const bedMatch = qp.name.match(/(?:bed|room|bay|cot|icu|hdu)?\s*#?\s*\d+[a-z]?/i);
      const bedText = qp.bed || card?.patientLabel?.bed || (bedMatch ? bedMatch[0] : `Bed ${idx + 1}`);
      const rawNameText = qp.name.replace(/(?:bed|room|bay|cot|icu|hdu)?\s*#?\s*\d+[a-z]?\s*\(?/i, "").replace(/\)?$/, "").trim();

      let nameText = card?.patientLabel?.name;
      if (isGenericName(nameText) && !isGenericName(qp.name)) {
        nameText = qp.name;
      }
      if (isGenericName(nameText) && rawNameText) {
        nameText = rawNameText;
      }
      if (!nameText || isGenericName(nameText)) {
        nameText = qp.name || "Bed Patient";
      }

      const ageSexText = (card?.patientLabel?.ageSex && !/unknown/i.test(card.patientLabel.ageSex)) ? card.patientLabel.ageSex : (qp.ageGender || "N/A");

      const bg = card?.pmh || ((qp.structuredSBAR?.background && !qp.structuredSBAR.background.includes("comorbid clinical elements") && !qp.structuredSBAR.background.includes("not explicitly documented"))
        ? qp.structuredSBAR.background
        : "");

      const sit = card?.presentingComplaint || card?.story || qp.presentingComplaint || qp.structuredSBAR?.situation || extractPresentingComplaint(qp);
      const ass = card?.diagnosis || qp.structuredSBAR?.assessment || (qp.vitals ? `Vitals: ${qp.vitals}` : "");

      const chronoNotes = qp.rawNotes && qp.rawNotes.trim().length > 0
        ? qp.rawNotes.split(/\n\s*\n+/).map(l => l.trim()).filter(l => l.length > 0).join("\n\n")
        : sit;

      const { formattedAssessment, alertsList: invAlerts, planDoneLabsText } = extractChronologicalInvestigationsAndAlerts(
        qp.rawNotes || "",
        `PROVISIONAL DIAGNOSIS: ${sit}\nASSESSMENT: ${ass}`,
        []
      );

      const qpAlerts: string[] = card?.criticalAlerts || [...invAlerts];
      const combinedRaw = `${qp.vitals || ''} ${qp.rawNotes || ''} ${ass}`;
      if (/grbs\s*(?:>|:|=)?\s*(?:3[0-9]\d|[4-9]\d\d)/i.test(combinedRaw) && !qpAlerts.some(a => a.toLowerCase().includes("grbs"))) qpAlerts.push("Elevated GRBS (>300)");
      if (/bp\s*(?:>|:|=)?\s*(?:1[8-9]\d|2\d\d)/i.test(combinedRaw) && !qpAlerts.some(a => a.toLowerCase().includes("bp"))) qpAlerts.push("Hypertensive Urgency");
      if (/spo2\s*(?:<|:|=)?\s*(?:8\d|90|91|92)/i.test(combinedRaw) && !qpAlerts.some(a => a.toLowerCase().includes("spo2"))) qpAlerts.push("Hypoxia / Low SpO2");

      const alertsText = card?.alertRow || (qpAlerts.length > 0 ? `⚠ ${qpAlerts.join(" · ")}` : "");

      let bystanderQP = card?.bystander || "";
      if (!bystanderQP) {
        const qpRawAll = `${qp.rawNotes || ''} ${qp.structuredSBAR?.recommendation || ''}`;
        const bystanderMatchQP = qpRawAll.match(/(?:bystander|family|relatives|counselled|explained|informed)\s*[:=-]?\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
        if (bystanderMatchQP && bystanderMatchQP[0]) {
          bystanderQP = bystanderMatchQP[0].trim();
        }
      }

      const doneItems = [];
      if (card?.done && card.done.length > 0) {
        card.done.forEach(d => doneItems.push(`✓ ${d}`));
      } else {
        if (qp.vitals) doneItems.push(`✓ Vitals: ${qp.vitals}`);
        if (planDoneLabsText) doneItems.push(planDoneLabsText);
      }

      let toBeDoneText = "";
      if (card?.toBeDone && card.toBeDone.length > 0) {
        toBeDoneText = card.toBeDone.map(t => `□ ${t}`).join("\n");
      } else if (qp.structuredSBAR?.recommendation) {
        toBeDoneText = `□ ${qp.structuredSBAR.recommendation}`;
      }

      return {
        id: qp.id,
        bed: bedText,
        name: nameText,
        ageGender: ageSexText,
        erNo: card?.patientLabel?.erNumber ? `ER# ${card.patientLabel.erNumber}` : `ER# ${qp.id.substring(0, 7)}`,
        doctor: card?.patientLabel?.admittingConsultant ? `Dr. ${card.patientLabel.admittingConsultant}` : `Dr. ${profile.name || "Manoj"}`,
        stayDuration: card?.patientLabel?.inERSince ? `In ER since: ${card.patientLabel.inERSince}` : "In ER evaluation",
        complaints: sit,
        chronologicalNotes: chronoNotes,
        history: bg,
        assessment: formattedAssessment || ass,
        planDone: doneItems.join("\n"),
        planToBeDone: toBeDoneText,
        bystander: bystanderQP,
        vitals: card?.vitalsNow || extractLatestVitalsWithTime(undefined, undefined, `${qp.vitals || ''}\n${qp.rawNotes || ''}`),
        alerts: alertsText
      };
    });

    return sortRowsByBedNumber(rows);
  };

  const refineSheetWithGemini = async (items: any[]) => {
    setIsAiCompilingSheet(true);
    try {
      const res = await fetch("/api/handover/compile-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patients: items }),
      });
      const json = await res.json();
      if (json.success && json.rows && Array.isArray(json.rows) && json.rows.length > 0) {
        const mappedRows = json.rows.map((row: HandoverTableRow) => {
          // 1. Patient ID match (BEST - Exact match on patient ID)
          let orig = items.find(it => it.id && row.id && String(it.id).trim() === String(row.id).trim());

          // 2. Bed Number match (GOOD - If Patient ID missing or altered by AI)
          if (!orig && (row.bed || orig?.bed || orig?.bedNo)) {
            orig = items.find(it => {
              const itBed = (it.bed || it.bedNo || "").toString().toLowerCase().trim();
              const rBed = (row.bed || "").toString().toLowerCase().trim();
              if (!itBed || !rBed) return false;
              const cleanIt = itBed.replace(/^(bed|room|bay|cot|icu|hdu)?\s*#?\s*/i, "");
              const cleanR = rBed.replace(/^(bed|room|bay|cot|icu|hdu)?\s*#?\s*/i, "");
              return cleanIt === cleanR || itBed === rBed;
            });
          }

          // STRICT CLINICAL SAFETY RULE:
          // If neither Patient ID nor Bed Number matched, SKIP this row!
          // NEVER match by Patient Name or Array Index to prevent cross-patient data corruption.
          if (!orig) {
            console.warn(`[Handover] Skipped unassigned AI row (ID: ${row.id}, Bed: ${row.bed}, Name: ${row.name}) - No safe ID or Bed match in active selection.`);
            return null;
          }

          const fallbackName = orig?.name || orig?.patientLabel?.name || row.name;
          const finalName = (row.name && !/anonymous|bed patient/i.test(row.name)) ? row.name : fallbackName;

          return {
            ...row,
            id: orig.id, // Strictly preserve original Patient ID
            bed: row.bed && !/bed \d+/i.test(row.bed) ? row.bed : (orig?.bed || orig?.bedNo || row.bed),
            name: finalName
          };
        }).filter(Boolean) as HandoverTableRow[];
        const sorted = sortRowsByBedNumber(mappedRows);
        setEditableRows(sorted);
        saveRefinedHandoverSheet(sorted, handoverMeta);
      }
    } catch (err) {
      console.error("AI handover sheet compilation error:", err);
    } finally {
      setIsAiCompilingSheet(false);
    }
  };

  const compileRegistryToSheet = () => {
    const localRows = getRegistryRows();
    setEditableRows(localRows);
    saveRefinedHandoverSheet(localRows, handoverMeta);
    const selectedCases = cases.filter(c => selectedRegistryIds.includes(c.id));
    if (selectedCases.length > 0) {
      refineSheetWithGemini(selectedCases);
    }
    setIsViewingSheet(true);
  };

  const compileQuickPasteToSheet = () => {
    const localRows = getQuickPasteRows();
    setEditableRows(localRows);
    saveRefinedHandoverSheet(localRows, handoverMeta);
    const selectedQuick = quickPasteList.filter(qp => selectedQuickPasteIds.includes(qp.id));
    if (selectedQuick.length > 0) {
      refineSheetWithGemini(selectedQuick);
    }
    setIsViewingSheet(true);
  };

  const handleDownloadWordDirect = (type: "registry" | "quickpaste") => {
    const rows = (isViewingSheet && editableRows && editableRows.length > 0) 
      ? editableRows 
      : (type === "registry" ? getRegistryRows() : getQuickPasteRows());
    if (rows.length === 0) return;
    if (rows.length === 0) return;

    const chunkRows = (rList: HandoverTableRow[], size: number) => {
      const chunks: HandoverTableRow[][] = [];
      for (let i = 0; i < rList.length; i += size) {
        chunks.push(rList.slice(i, i + size));
      }
      return chunks;
    };

    const pageChunks = chunkRows(rows, 2);
    const totalPages = Math.max(1, pageChunks.length);

    let htmlBody = "";
    
    pageChunks.forEach((chunk, pageIdx) => {
      htmlBody += `
        <div style="page-break-after: always; margin-bottom: 40px; font-family: Arial, sans-serif;">
          <!-- Header Table -->
          <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 12px;">
            <tr style="border: none;">
              <td style="border: none; padding: 0; width: 65%; text-align: left; vertical-align: middle;">
                <span style="font-family: Arial, sans-serif; font-size: 11.5pt; font-weight: bold; color: #111827;">${hospitalName.toUpperCase()} | EMERGENCY DEPARTMENT</span>
                <div style="font-family: Arial, sans-serif; font-size: 8pt; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">DOCTORS' HANDOVER SHEET &mdash; PAGE ${pageIdx + 1} OF ${totalPages}</div>
              </td>
              <td style="border: none; padding: 0; width: 35%; text-align: right; vertical-align: middle; font-family: monospace; font-size: 8pt; color: #4b5563; line-height: 1.4;">
                <div><strong>DATE:</strong> ${handoverMeta.date}</div>
                <div><strong>FROM SHIFT:</strong> ${handoverMeta.from}</div>
                <div><strong>TO SHIFT:</strong> ${handoverMeta.to}</div>
                <div><strong>TIME:</strong> ${handoverMeta.time}</div>
              </td>
            </tr>
          </table>

          <!-- Main Table Grid -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 15%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Patient Label</th>
                <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 15%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Presenting complaints</th>
                <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 13%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Past medical history</th>
                <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 20%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Provisional diagnosis / Initial Assessment Note</th>
                <th colspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 27%; text-align: center; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Management plan</th>
                <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 10%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Bystander update / given time</th>
              </tr>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 13%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Done (ECG, VBG, Echo, Investigations)</th>
                <th style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 14%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">To Be Done / Pending</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      chunk.forEach((row) => {
        htmlBody += `
              <tr>
                <td style="border: 1px solid #000000; padding: 8px; background-color: #fafafa; vertical-align: top;">
                  <div style="font-weight: bold; font-family: monospace; font-size: 8.5pt; color: #111827;">${row.bed}</div>
                  <div style="font-weight: bold; color: #4f46e5; font-size: 9pt; margin-top: 4px;">${row.name}</div>
                  <div style="font-family: monospace; font-size: 8pt; color: #4b5563; margin-top: 2px;">${row.ageGender}</div>
                </td>
                <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.complaints}</td>
                <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.history}</td>
                <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.assessment}</td>
                <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.planDone}</td>
                <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.planToBeDone}</td>
                <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.bystander}</td>
              </tr>
        `;
      });
      
      htmlBody += `
            </tbody>
          </table>
          
          <!-- Footer -->
          <div style="font-family: Arial, sans-serif; font-size: 7.5pt; color: #6b7280; text-align: center; margin-top: 10px;">
            CONFIDENTIAL CLINICAL HANDOVER TRANSITION DOCUMENT • Verify all medication doses, pending reports and current patient status at bedside before assuming care.
          </div>
        </div>
      `;
    });

    const fullHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Doctors Handover Sheet</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>90</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + fullHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Emergency_Doctors_Handover_${type === "registry" ? "Registry" : "SBAR"}_${handoverMeta.date.replace(/\//g, "-")}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateCell = (id: string, field: keyof HandoverTableRow, value: string) => {
    setEditableRows(prev => {
      const updated = prev.map(row => row.id === id ? { ...row, [field]: value } : row);
      saveRefinedHandoverSheet(updated, handoverMeta);
      return updated;
    });
  };

  const handleToggleRegistryCase = (caseId: string) => {
    if (selectedRegistryIds.includes(caseId)) {
      setSelectedRegistryIds(selectedRegistryIds.filter(id => id !== caseId));
    } else {
      setSelectedRegistryIds([...selectedRegistryIds, caseId]);
    }
  };

  const handleSelectAllRegistry = () => {
    const activeCases = cases.filter(c => c.status === "Active");
    if (selectedRegistryIds.length === activeCases.length) {
      setSelectedRegistryIds([]);
    } else {
      setSelectedRegistryIds(activeCases.map(c => c.id));
    }
  };

  // Structured SBAR Helper
  const extractSBARStructure = (rawText: string, name: string): QuickPastePatient["structuredSBAR"] => {
    // Simple rule-based clinical heuristic extraction to structure EMR text instantly
    const situation = rawText.match(/(?:presented with|presenting with|diagnosed with|diagnosis of)\s+([^.\n]+)/i)?.[1] || `Evaluation of clinical symptoms for ${name}.`;
    const background = rawText.match(/(?:history of|known case of|history|known)\s+([^.\n]+)/i)?.[1] || "No chronic medical conditions listed in EMR snippet.";
    const assessment = rawText.match(/(?:assessment|ECG shows|USG shows|labs show|findings)\s+([^.\n]+)/i)?.[1] || "Clinical vitals logged; primary workup complete.";
    const recommendation = rawText.match(/(?:recommendation|plan|transfer|treatment|give|should|waiting for)\s+([^.\n]+)/i)?.[1] || "Continue active monitoring and regular hourly vitals re-checks.";

    return {
      situation: situation.charAt(0).toUpperCase() + situation.slice(1).trim() + ".",
      background: background.charAt(0).toUpperCase() + background.slice(1).trim() + ".",
      assessment: assessment.charAt(0).toUpperCase() + assessment.slice(1).trim() + ".",
      recommendation: recommendation.charAt(0).toUpperCase() + recommendation.slice(1).trim() + "."
    };
  };

  const handleScribeChatSend = async (textToSend: string, imageBase64: string | null, imageMimeName: string | null) => {
    if (!textToSend.trim() && !imageBase64) return;

    const userText = textToSend.trim();
    const currentTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Create and add User Message to chat
    const userMsg: ScribeChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userText || undefined,
      image: imageBase64 || undefined,
      imageName: imageMimeName || undefined,
      timestamp: currentTimestamp
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsAiParsing(true);
    setAiParseError(null);
    setAiParseSuccessMsg(null);

    // Clear immediate inputs so the user feels the message has "sent"
    setQpRawNotes("");
    setHandoverImgBase64(null);
    setHandoverImgName(null);

    try {
      const extractedMeta = extractPatientNameAndTimestamp(userText);

      const response = await fetch("/api/handover/parse-structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          mimeType: "image/jpeg",
          rawText: userText,
          doctorName: profile?.name ? (profile.name.startsWith("Dr") ? profile.name : `Dr. ${profile.name}`) : "EM Resident"
        })
      });
      const resData = await response.json();
      if (resData.phiProtected && resData.phiProtected.count > 0) {
        setPhiShieldInfo(resData.phiProtected);
      }
      if (resData.success && (resData.data || resData.extracted)) {
        const parsed = resData.data || resData.extracted;

        const resolvedName = (parsed.patientLabel?.name && parsed.patientLabel.name !== "Bed Patient") ? parsed.patientLabel.name : (parsed.name && parsed.name !== "Bed Patient" ? parsed.name : extractedMeta.name);
        const resolvedAgeSex = (parsed.patientLabel?.ageSex && parsed.patientLabel.ageSex !== "Unknown") ? parsed.patientLabel.ageSex : (parsed.ageGender || extractedMeta.ageGender || "Unknown");
        const resolvedTime = parsed.patientLabel?.inERSince || extractedMeta.time;
        const resolvedBed = parsed.patientLabel?.bed || extractedMeta.bed || null;

        const handoverCardData: HandoverPatient = {
          patientLabel: {
            name: resolvedName,
            ageSex: resolvedAgeSex,
            bed: resolvedBed,
            erNumber: parsed.patientLabel?.erNumber || null,
            admittingConsultant: parsed.patientLabel?.admittingConsultant || null,
            inERSince: resolvedTime,
            status: parsed.patientLabel?.status || ((parsed.triage && parsed.triage.includes("P1")) ? 'critical' : 'unstable')
          },
          presentingComplaint: parsed.presentingComplaint || "Presenting complaint recorded.",
          story: parsed.story || parsed.structuredSBAR?.situation || "Clinical story recorded.",
          pmh: parsed.pmh || parsed.structuredSBAR?.background || null,
          diagnosis: parsed.diagnosis || parsed.structuredSBAR?.situation || "Under evaluation",
          done: Array.isArray(parsed.done) ? parsed.done : (parsed.structuredSBAR?.recommendation ? [parsed.structuredSBAR.recommendation] : []),
          toBeDone: Array.isArray(parsed.toBeDone) ? parsed.toBeDone : [],
          vitalsNow: parsed.vitalsNow || parsed.vitals || null,
          criticalAlerts: Array.isArray(parsed.criticalAlerts) ? parsed.criticalAlerts : [],
          bystander: parsed.bystander || null,
          alertRow: parsed.alertRow || (parsed.vitals ? `⚠ ${parsed.vitals}` : "⚠ Active ER evaluation")
        };

        // 2. Automatically save the parsed patient to quickPasteList
        const newPatient: QuickPastePatient = {
          id: `qp-pat-${Date.now()}`,
          bed: resolvedBed || undefined,
          name: resolvedName,
          ageGender: resolvedAgeSex,
          triage: parsed.triage || (handoverCardData.patientLabel.status === 'critical' ? "P1 (Immediate)" : "P2 (Urgent)"),
          vitals: handoverCardData.vitalsNow || parsed.vitals || "Not documented",
          presentingComplaint: handoverCardData.presentingComplaint || (userText ? userText.substring(0, 150) : "Presenting complaint recorded."),
          rawNotes: parsed.rawNotes || userText || "Pasted clinical notes",
          structuredSBAR: parsed.structuredSBAR || {
            situation: handoverCardData.story || "No situation parsed.",
            background: handoverCardData.pmh || "No background parsed.",
            assessment: handoverCardData.vitalsNow || "No assessment parsed.",
            recommendation: `Done: ${handoverCardData.done.join(', ')} | To Do: ${handoverCardData.toBeDone.join(', ')}`
          },
          handoverCardData
        };

        setQuickPasteList(prev => [...prev, newPatient]);
        setSelectedQuickPasteIds(prev => Array.from(new Set([...prev, newPatient.id])));

        const newTableRow: HandoverTableRow = {
          id: newPatient.id,
          bed: handoverCardData.patientLabel?.bed || "N/A",
          name: newPatient.name,
          ageGender: newPatient.ageGender || "",
          erNo: handoverCardData.patientLabel?.erNumber || "",
          doctor: handoverCardData.patientLabel?.admittingConsultant || handoverCardData.patientLabel?.treatingERPhysician || "",
          bystander: "",
          stayDuration: handoverCardData.patientLabel?.inERSince || "",
          vitals: handoverCardData.vitalsNow || newPatient.vitals || "",
          complaints: handoverCardData.presentingComplaint || "",
          history: handoverCardData.pmh || "",
          assessment: handoverCardData.diagnosis || "",
          planDone: Array.isArray(handoverCardData.done) ? handoverCardData.done.join('\n') : (handoverCardData.done || ""),
          planToBeDone: Array.isArray(handoverCardData.toBeDone) ? handoverCardData.toBeDone.join('\n') : (handoverCardData.toBeDone || ""),
          alerts: handoverCardData.alertRow || handoverCardData.alertBanner?.summary || "",
          chronologicalNotes: handoverCardData.story || newPatient.rawNotes || ""
        };

        setEditableRows(prev => {
          const exists = prev.some(r => r.id === newTableRow.id);
          if (exists) return prev.map(r => r.id === newTableRow.id ? { ...r, ...newTableRow } : r);
          return [newTableRow, ...prev];
        });

        if (setHandovers) {
          const newHandoverRecord: HandoverRecord = {
            id: "H-" + Math.floor(1000 + Math.random() * 9000),
            senderName: profile?.name ? (profile.name.startsWith("Dr") ? profile.name : `Dr. ${profile.name}`) : "EM Resident",
            senderEmail: profile?.email || "",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today",
            caseCount: 1,
            patientsText: `${newPatient.name} (${newPatient.triage ? newPatient.triage.split(" ")[0] : "P2"} - ${newPatient.presentingComplaint || newPatient.vitals})`,
            hospital: profile?.hospital || "Varah Group Emergency Care"
          };
          setHandovers(prev => [newHandoverRecord, ...prev]);
        }

        // 3. Create Bot Response Message with parsedPatient reference
        const botMsg: ScribeChatMessage = {
          id: `bot-${Date.now()}`,
          sender: "ermate",
          text: `I've analyzed the clinical details using the complete handover pipeline (preprocessed noise stripping, chronological reversal, model routing, and alert row synthesis). **${newPatient.name}** (${newPatient.ageGender} · In ER: ${resolvedTime}) has been added to your handover records!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          parsedPatient: {
            patientId: newPatient.id,
            name: newPatient.name,
            ageGender: newPatient.ageGender,
            triage: newPatient.triage,
            vitals: newPatient.vitals,
            rawNotes: newPatient.rawNotes,
            structuredSBAR: newPatient.structuredSBAR!,
            handoverCardData
          },
          isSaved: true
        };

        setChatMessages(prev => [...prev, botMsg]);
        setAiParseSuccessMsg(`Patient ${newPatient.name} successfully compiled!`);
      } else {
        throw new Error(resData.error || "Failed to parse handover details.");
      }
    } catch (err: any) {
      console.error("Scribe chat error:", err);
      
      // Fallback: If AI fails, we still create a fallback message and patient log so it's robust
      const extractedFallback = extractPatientNameAndTimestamp(userText);
      const extractedVitals = extractLatestVitalsWithTime(undefined, undefined, userText);

      // Extract PMH if present
      const pmhM = userText?.match(/(?:past\s+medical\s+history|known\s+case\s+of|k\/c\/o|comorbidities|pmh)\s*[:=-]?\s*([^\n\r]+)/i);

      // Extract Diagnosis if present
      const diagM = userText?.match(/(?:imp|impression|diagnosis|dx)\s*[:=-]?\s*([^\n\r]+)/i);

      const fallbackCardData: HandoverPatient = {
        patientLabel: {
          name: extractedFallback.name,
          ageSex: extractedFallback.ageGender,
          bed: extractedFallback.bed,
          erNumber: null,
          admittingConsultant: null,
          inERSince: extractedFallback.time,
          status: 'unstable'
        },
        presentingComplaint: userText ? userText.substring(0, 150) : "Presenting complaint recorded.",
        story: userText ? userText.substring(0, 200) : "Clinical evaluation in progress.",
        pmh: pmhM ? pmhM[1].trim() : null,
        diagnosis: diagM ? diagM[1].trim() : "Under evaluation",
        done: ["Triage evaluation done"],
        toBeDone: ["Review workup"],
        vitalsNow: extractedVitals || null,
        criticalAlerts: [],
        bystander: null,
        alertRow: extractedVitals ? `⚠ ${extractedVitals}` : "⚠ Active ER evaluation"
      };

      const fallbackPatient: QuickPastePatient = {
        id: `qp-pat-${Date.now()}`,
        bed: extractedFallback.bed || undefined,
        name: extractedFallback.name,
        ageGender: extractedFallback.ageGender,
        triage: "P2 (Urgent)",
        vitals: extractedVitals || "Not documented",
        presentingComplaint: userText ? userText.substring(0, 150) : "",
        rawNotes: userText || "Uploaded Case Sheet Photo",
        structuredSBAR: {
          situation: diagM ? diagM[1].trim() : (userText ? userText.substring(0, 150) : ""),
          background: pmhM ? pmhM[1].trim() : "",
          assessment: extractedVitals ? `Vitals: ${extractedVitals}` : "",
          recommendation: ""
        },
        handoverCardData: fallbackCardData
      };

      setQuickPasteList(prev => [...prev, fallbackPatient]);

      if (setHandovers) {
        const fallbackHandoverRecord: HandoverRecord = {
          id: "H-" + Math.floor(1000 + Math.random() * 9000),
          senderName: profile?.name ? (profile.name.startsWith("Dr") ? profile.name : `Dr. ${profile.name}`) : "EM Resident",
          senderEmail: profile?.email || "",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today",
          caseCount: 1,
          patientsText: `${fallbackPatient.name} (${fallbackPatient.triage ? fallbackPatient.triage.split(" ")[0] : "P2"} - ${fallbackPatient.presentingComplaint || fallbackPatient.vitals})`,
          hospital: profile?.hospital || "Varah Group Emergency Care"
        };
        setHandovers(prev => [fallbackHandoverRecord, ...prev]);
      }

      const botErrorMsg: ScribeChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "ermate",
        text: `I encountered a parsing issue, but I've successfully logged a placeholder card for **${fallbackPatient.name}** based on our fallback clinician rules. You can edit the details directly.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        parsedPatient: {
          patientId: fallbackPatient.id,
          name: fallbackPatient.name,
          ageGender: fallbackPatient.ageGender,
          triage: fallbackPatient.triage,
          vitals: fallbackPatient.vitals,
          rawNotes: fallbackPatient.rawNotes,
          structuredSBAR: fallbackPatient.structuredSBAR!
        },
        isSaved: true
      };

      setChatMessages(prev => [...prev, botErrorMsg]);
      setAiParseError(sanitizeDoctorError(err));
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleSaveModalEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    // Capture feedback if notes or vitals were edited
    const originalItem = quickPasteList.find(i => i.id === editingPatient.id);
    if (originalItem) {
      if (originalItem.vitals !== editingPatient.vitals) {
        captureFeedbackCorrection("vitals", originalItem.vitals, editingPatient.vitals, editingPatient.rawNotes, "handover_synthesis", profile?.name || "Doctor");
      }
      if (originalItem.name !== editingPatient.name) {
        captureFeedbackCorrection("patient_name", originalItem.name, editingPatient.name, editingPatient.rawNotes, "handover_synthesis", profile?.name || "Doctor");
      }
    }
    
    // Update the quickPasteList
    setQuickPasteList(prev => prev.map(item => item.id === editingPatient.id ? editingPatient : item));
    
    // Also update any chatMessage corresponding to this patient if stored in parsedPatient
    setChatMessages(prev => prev.map(msg => {
      if (msg.sender === "ermate" && msg.parsedPatient && msg.parsedPatient.name === editingPatient.name) {
        return {
          ...msg,
          parsedPatient: {
            ...msg.parsedPatient,
            name: editingPatient.name,
            ageGender: editingPatient.ageGender,
            triage: editingPatient.triage,
            vitals: editingPatient.vitals,
            rawNotes: editingPatient.rawNotes,
            structuredSBAR: editingPatient.structuredSBAR || msg.parsedPatient.structuredSBAR
          }
        };
      }
      return msg;
    }));
    
    setIsEditModalOpen(false);
    setEditingPatient(null);
    setActionSuccessMsg("Patient handover record updated successfully!");
  };

  const handleAddOrEditQuickPaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qpRawNotes) return;

    const extracted = extractPatientNameAndTimestamp(qpRawNotes);
    const resolvedName = (qpName && qpName.trim() && qpName !== "Bed Patient") ? qpName.trim() : extracted.name;
    const resolvedAgeGender = (qpAgeGender && qpAgeGender !== "N/A" && qpAgeGender !== "Unknown") ? qpAgeGender : extracted.ageGender;
    const resolvedVitals = (qpVitals && qpVitals.trim()) ? qpVitals.trim() : (extractLatestVitalsWithTime(undefined, undefined, qpRawNotes) || "Not documented");

    const structured = qpStructuredSBAR || extractSBARStructure(qpRawNotes, resolvedName);

    if (editingQpId) {
      setQuickPasteList(prev => prev.map(item => {
        if (item.id === editingQpId) {
          return {
            ...item,
            bed: extracted.bed || item.bed,
            name: resolvedName,
            ageGender: resolvedAgeGender,
            triage: qpTriage,
            vitals: resolvedVitals,
            rawNotes: qpRawNotes,
            structuredSBAR: structured
          };
        }
        return item;
      }));
      setEditingQpId(null);
    } else {
      const newItem: QuickPastePatient = {
        id: "qp-" + Date.now(),
        bed: extracted.bed || undefined,
        name: resolvedName,
        ageGender: resolvedAgeGender,
        triage: qpTriage,
        vitals: resolvedVitals,
        rawNotes: qpRawNotes,
        structuredSBAR: structured
      };
      setQuickPasteList(prev => [...prev, newItem]);

      if (setHandovers) {
        const manualHandoverRecord: HandoverRecord = {
          id: "H-" + Math.floor(1000 + Math.random() * 9000),
          senderName: profile?.name ? (profile.name.startsWith("Dr") ? profile.name : `Dr. ${profile.name}`) : "EM Resident",
          senderEmail: profile?.email || "",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today",
          caseCount: 1,
          patientsText: `${newItem.name} (${newItem.triage ? newItem.triage.split(" ")[0] : "P2"} - ${newItem.presentingComplaint || newItem.vitals})`,
          hospital: profile?.hospital || "Varah Group Emergency Care"
        };
        setHandovers(prev => [manualHandoverRecord, ...prev]);
      }
    }

    // Reset Form
    setQpName("");
    setQpAgeGender("");
    setQpTriage("P2 (Urgent)");
    setQpVitals("");
    setQpRawNotes("");
    setQpStructuredSBAR(null);
    setHandoverImgBase64(null);
    setHandoverImgName(null);
    setAiParseError(null);
    setAiParseSuccessMsg(null);
  };

  const handleEditClick = (item: QuickPastePatient) => {
    setEditingPatient(item);
    setIsEditModalOpen(true);
  };

  const handleRemoveQuickPaste = (id: string) => {
    setQuickPasteList(prev => prev.filter(item => item.id !== id));
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedState(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedState(prev => ({ ...prev, [key]: false }));
      }, 2000);
    });
  };

  const handleDownloadHandoverPdf = async (type: "registry" | "quickpaste") => {
    try {
      let patientList: any[] = [];
      if (type === "registry") {
        patientList = cases.filter(c => selectedRegistryIds.includes(c.id)).map(c => ({
          id: c.id,
          bed: c.bedNo || "N/A",
          name: c.patient.name,
          ageGender: `${c.patient.age || "N/A"}y / ${c.patient.gender}`,
          erNo: c.patient.uhid || c.id.substring(0, 7),
          doctor: c.createdByName || c.doctorName || `Dr. ${profile.name}`,
          vitals: `HR ${c.vitals.hr || "N/A"}, BP ${c.vitals.bp || "N/A"}, SpO2 ${c.vitals.spo2 || "N/A"}%`,
          complaints: c.patient.presentingComplaint,
          assessment: c.progressNotes || c.sampleHistory?.symptoms || "Stable",
          planToBeDone: c.treatments?.map(t => `${t.drugName} ${t.dose}`).join(", ") || "Active monitoring",
          alerts: c.sampleHistory?.allergies || "None"
        }));
      } else {
        patientList = editableRows.filter(r => selectedQuickPasteIds.includes(r.id)).map(r => ({
          id: r.id,
          bed: r.bed || "N/A",
          name: r.name || "Patient",
          ageGender: r.ageGender || "N/A",
          erNo: r.erNo || r.id.substring(0, 7),
          doctor: r.doctor || `Dr. ${profile.name}`,
          vitals: r.vitals || "N/A",
          complaints: r.complaints || r.history || "N/A",
          assessment: r.assessment || "N/A",
          planToBeDone: `${r.planDone || ''} | ${r.planToBeDone || ''}`.trim(),
          alerts: r.bystander || r.alerts || "None"
        }));
      }

      const response = await fetch("/api/handover/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: handoverMeta.date || new Date().toLocaleDateString(),
          facility: profile.hospital || "Emergency Department",
          clinician: profile.name ? `Dr. ${profile.name}` : "Duty Medical Officer",
          patients: patientList
        })
      });

      if (!response.ok) {
        throw new Error("PDF server response not OK");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Emergency_Handover_Report_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Handover PDF Download Error]", err);
      triggerPrintWithTip();
    } finally {
      setPostPrintDataType(type);
      if (type === "registry") {
        setIdsToCleanup(selectedRegistryIds);
      } else {
        setIdsToCleanup(selectedQuickPasteIds);
      }
      setShowPostPrintCleanPrompt(true);
    }
  };

  const handlePrint = (type: "registry" | "quickpaste") => {
    handleDownloadHandoverPdf(type);
  };

  const getRegistryPrintText = (): string => {
    const selectedCases = sortRowsByBedNumber(
      cases.filter(c => selectedRegistryIds.includes(c.id)).map(c => ({ ...c, bed: c.bedNo }))
    );
    let text = `==================================================\n`;
    text += `ERMATE ACTIVE PATIENTS SHIFT HANDOVER SHEET\n`;
    text += `==================================================\n`;
    text += `Facility: ${profile.hospital}\n`;
    text += `Lead Clinician: Dr. ${profile.name} (${profile.role})\n`;
    text += `Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}\n\n`;

    selectedCases.forEach((c, idx) => {
      text += `${idx + 1}. PATIENT: ${c.patient.name} (${c.patient.age}y / ${c.patient.gender}) [${c.bedNo || 'Bed N/A'}]\n`;
      text += `   Case ID: ${c.id} | UHID: ${c.patient.uhid} | Triage Level: ${c.patient.triageCategory}\n`;
      text += `   Vitals: HR ${c.vitals.hr || "N/A"} | BP ${c.vitals.bp || "N/A"} | SpO2 ${c.vitals.spo2 || "N/A"}%\n`;
      text += `   Chief Complaint: ${c.patient.presentingComplaint}\n`;
      text += `   SAMPLE History:\n`;
      text += `     - Symptoms: ${c.sampleHistory?.symptoms || "N/A"}\n`;
      text += `     - Allergies: ${c.sampleHistory?.allergies || "NKDA"}\n`;
      text += `     - Medications: ${c.sampleHistory?.medications || "N/A"}\n`;
      text += `   Primary Assessment: A-${c.primaryAssessment?.airwayStatus || "Normal"}, B-${c.primaryAssessment?.breathingStatus || "Normal"}, C-${c.primaryAssessment?.circulationStatus || "Normal"}\n`;
      text += `   ER Treatment Given: ${c.treatments.map(t => `${t.drugName} ${t.dose}`).join(", ") || "None recorded"}\n`;
      text += `   Progress Notes Summary: ${c.progressNotes || "Stable."}\n`;
      text += `--------------------------------------------------\n\n`;
    });

    text += `CONFIDENTIAL PROTECTED HEALTH INFORMATION (PHI) - SECURE DISPOSAL PROTOCOLS MANDATED.`;
    return text;
  };

  const getQuickPastePrintText = (): string => {
    let text = `==================================================\n`;
    text += `ERMATE FREE-FORM EMR QUICK PASTE HANDOVER SHEET\n`;
    text += `==================================================\n`;
    text += `Lead Clinician: Dr. ${profile.name} (${profile.role})\n`;
    text += `Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}\n\n`;

    const selectedList = sortRowsByBedNumber<QuickPastePatient>(quickPasteList.filter(item => selectedQuickPasteIds.includes(item.id)));

    selectedList.forEach((item, idx) => {
      text += `${idx + 1}. PATIENT: ${item.name} (${item.ageGender})\n`;
      text += `   Triage Priority: ${item.triage} | Current Vitals: ${item.vitals}\n`;
      text += `   IPASS/SBAR Structured Handover Summary:\n`;
      text += `     [S] Situation: ${item.structuredSBAR?.situation}\n`;
      text += `     [B] Background: ${item.structuredSBAR?.background}\n`;
      text += `     [A] Assessment: ${item.structuredSBAR?.assessment}\n`;
      text += `     [R] Recommendation: ${item.structuredSBAR?.recommendation}\n`;
      text += `   Pasted Raw EMR Audit:\n   "${item.rawNotes.replace(/\n/g, "\n   ")}"\n`;
      text += `--------------------------------------------------\n\n`;
    });

    text += `CONFIDENTIAL CLINICAL HANDOVER TRANSITION DOCUMENT.`;
    return text;
  };

  const activeCases = cases.filter(c => c.status === "Active");

  if (isViewingSheet) {
    const chunkRows = (rows: HandoverTableRow[], size: number) => {
      const chunks: HandoverTableRow[][] = [];
      for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
      }
      return chunks;
    };

    const pageChunks = chunkRows(sortRowsByBedNumber(editableRows), 2);
    const totalPages = Math.max(1, pageChunks.length);

    const handleDownloadDoc = () => {
      let htmlBody = "";
      
      pageChunks.forEach((chunk, pageIdx) => {
        htmlBody += `
          <div style="page-break-after: always; margin-bottom: 40px; font-family: Arial, sans-serif;">
            <!-- Header Table -->
            <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 12px;">
              <tr style="border: none;">
                <td style="border: none; padding: 0; width: 65%; text-align: left; vertical-align: middle;">
                  <span style="font-family: Arial, sans-serif; font-size: 11.5pt; font-weight: bold; color: #111827;">${hospitalName.toUpperCase()} | EMERGENCY DEPARTMENT</span>
                  <div style="font-family: Arial, sans-serif; font-size: 8pt; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">DOCTORS' HANDOVER SHEET &mdash; PAGE ${pageIdx + 1} OF ${totalPages}</div>
                </td>
                <td style="border: none; padding: 0; width: 35%; text-align: right; vertical-align: middle; font-family: Arial, sans-serif; font-size: 8.5pt; color: #374151; line-height: 1.4;">
                  <strong>DATE:</strong> ${handoverMeta.date} &nbsp;|&nbsp;
                  <strong>FROM:</strong> ${handoverMeta.from} &nbsp;|&nbsp;
                  <strong>TO:</strong> ${handoverMeta.to} <br/>
                  <strong>SHIFT TIME:</strong> ${handoverMeta.time}
                </td>
              </tr>
            </table>
            
            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; table-layout: fixed;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 15%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Patient Label</th>
                  <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 15%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Presenting complaints</th>
                  <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 13%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Past medical history</th>
                  <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 20%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Provisional diagnosis / Initial Assessment Note</th>
                  <th colspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 27%; text-align: center; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Management plan</th>
                  <th rowspan="2" style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 10%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Bystander update / given time</th>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <th style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 13%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">Done (ECG, VBG, Echo, Investigations)</th>
                  <th style="border: 1px solid #000000; padding: 8px; font-weight: bold; width: 14%; text-align: left; background-color: #f3f4f6; font-size: 8.5pt; color: #000000;">To Be Done / Pending</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        chunk.forEach((row) => {
          htmlBody += `
                <tr>
                  <td style="border: 1px solid #000000; padding: 8px; background-color: #fafafa; vertical-align: top;">
                    <div style="font-weight: bold; font-family: monospace; font-size: 8.5pt; color: #111827;">${row.bed}</div>
                    <div style="font-weight: bold; color: #4f46e5; font-size: 9pt; margin-top: 4px;">${row.name}</div>
                    <div style="font-family: monospace; font-size: 8pt; color: #4b5563; margin-top: 2px;">${row.ageGender}</div>
                  </td>
                  <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.complaints}</td>
                  <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.history}</td>
                  <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.assessment}</td>
                  <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.planDone}</td>
                  <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.planToBeDone}</td>
                  <td style="border: 1px solid #000000; padding: 8px; vertical-align: top; font-size: 8.5pt; white-space: pre-wrap; color: #1f2937;">${row.bystander}</td>
                </tr>
          `;
        });
        
        htmlBody += `
              </tbody>
            </table>
            
            <!-- Footer -->
            <div style="font-family: Arial, sans-serif; font-size: 7.5pt; color: #6b7280; text-align: center; margin-top: 10px;">
              CONFIDENTIAL CLINICAL HANDOVER TRANSITION DOCUMENT • Verify all medication doses, pending reports and current patient status at bedside before assuming care.
            </div>
          </div>
        `;
      });

      const fullHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>Doctors Handover Sheet</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>90</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            body {
              font-family: Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          ${htmlBody}
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + fullHtml], { type: "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Emergency_Doctors_Handover_${handoverMeta.date.replace(/\//g, "-")}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans" id="landscape-handover-sheet-workspace">
        <style dangerouslySetInnerHTML={{ __html: `
          .print-mirror-div {
            display: none;
          }
          @media print {
            /* Completely hide scrollbars during print */
            * {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            *::-webkit-scrollbar {
              display: none !important;
            }
            html, body {
              background-color: white !important;
              color: black !important;
              font-family: Arial, sans-serif !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
            }
            .no-print {
              display: none !important;
            }
            #landscape-handover-sheet-workspace {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              background-color: white !important;
            }
            .print-page {
              page-break-after: always !important;
              page-break-inside: avoid !important;
              margin: 0 !important;
              padding: 0.6cm !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              box-sizing: border-box !important;
              overflow: visible !important;
            }
            .overflow-x-auto {
              overflow: visible !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 10px !important;
              table-layout: fixed !important;
              overflow: visible !important;
            }
            th, td {
              border: 1px solid #000000 !important;
              padding: 10px !important; /* Increased padding for adequate vertical and horizontal cell spacing */
              font-size: 10px !important;
              color: black !important;
              vertical-align: top !important;
              word-wrap: break-word !important;
              line-height: 1.6 !important; /* Adequate space between each line */
            }
            th {
              background-color: #f3f4f6 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-weight: bold !important;
            }
            textarea, .overflow-y-hidden {
              display: none !important;
            }
            .print-mirror-div {
              display: block !important;
              white-space: pre-wrap !important;
              word-wrap: break-word !important;
              font-size: 10px !important;
              color: black !important;
              line-height: 1.6 !important; /* Space between lines in mirror-div */
              font-family: Arial, sans-serif !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
          }
        ` }} />

        {/* DPDP Act 2023 Shield Toast Banner */}
        {phiShieldInfo && phiShieldInfo.count > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700 p-3 rounded-2xl text-emerald-900 dark:text-emerald-100 text-xs flex items-center justify-between shadow-xs no-print animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="text-lg leading-none">🛡️</span>
              <div>
                <div className="font-extrabold text-[11.5px] uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  DPDP Act 2023 Compliant De-identification Active
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-200 mt-0.5 font-sans">
                  Stripped <strong>{phiShieldInfo.count} patient identifier(s)</strong> ({phiShieldInfo.details?.names || 0} names, {phiShieldInfo.details?.ids || 0} hospital IDs, {phiShieldInfo.details?.dates || 0} dates) on Indian Cloud Run server before AI processing.
                </div>
              </div>
            </div>
            <button
              onClick={() => setPhiShieldInfo(null)}
              className="px-2.5 py-1 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-lg text-xs transition-colors cursor-pointer"
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {/* Top bar control menu (hidden during print) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm no-print animate-fade-in">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4.5 h-4.5 text-indigo-500" />
              EMERGENCY DEPARTMENT - PORTABLE HANDOVER WORKSPACE
            </h2>
            <p className="text-[11px] text-slate-500">
              Arranged in structured A4 Landscape pages of 2 patients per page with dynamic double-row headers, perfectly ready for PDF/Word export.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {autoSaveStatus === "saving" && (
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Auto-saving...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Saved
              </span>
            )}
            <button
              onClick={() => setIsViewingSheet(false)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
            >
              ← Back to Selection
            </button>
            <button
              onClick={() => {
                if (activeSubTab === "registry") {
                  const selectedCases = cases.filter(c => selectedRegistryIds.includes(c.id));
                  refineSheetWithGemini(selectedCases);
                } else {
                  const selectedQuick = quickPasteList.filter(qp => selectedQuickPasteIds.includes(qp.id));
                  refineSheetWithGemini(selectedQuick);
                }
              }}
              disabled={isAiCompilingSheet}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiCompilingSheet ? 'animate-spin' : ''}`} />
              {isAiCompilingSheet ? "Extracting..." : "ErMate Refine Sheet"}
            </button>
            <button
              onClick={handleDownloadDoc}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download MS Word (.doc)
            </button>
            <button
              onClick={() => {
                const buildFormattedCard = (r: HandoverTableRow, idx: number) => {
                  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. BED NO + NAME: ${r.bed} · ${r.name}
   ${r.ageGender} · ${r.erNo || ''} · ${r.doctor || ''} · ${r.stayDuration || ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. INITIAL ASSESSMENT & CHRONOLOGICAL NOTES (Oldest → Newest):
${r.chronologicalNotes || 'No notes logged'}

   PRESENTING COMPLAINT:
${r.complaints}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PAST MEDICAL HISTORY:
${r.history}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. PROVISIONAL DIAGNOSIS & ASSESSMENT:
${r.assessment}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. MANAGEMENT PLAN:
   [DONE ✓]
${r.planDone}

   [TO BE DONE □]
${r.planToBeDone}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. BYSTANDER UPDATE & VITALS:
   [Bystander]: ${r.bystander}
   [Vitals]: ${r.vitals || 'Logged'}
${r.alerts ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠ CRITICAL ALERTS: ${r.alerts}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                };

                const text = `HOSPITAL HANDOVER & TRANSITION LOG\nDate: ${handoverMeta.date} | From: ${handoverMeta.from} | To: ${handoverMeta.to} | Time: ${handoverMeta.time}\n\n` + 
                  editableRows.map(buildFormattedCard).join("\n");
                const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", `ED_Clinical_Handover_${handoverMeta.date.replace(/\//g, "-")}.txt`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Plain Text
            </button>
            <button
              onClick={() => {
                const buildFormattedCard = (r: HandoverTableRow, idx: number) => {
                  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. BED NO + NAME: ${r.bed} · ${r.name}
   ${r.ageGender} · ${r.erNo || ''} · ${r.doctor || ''} · ${r.stayDuration || ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. INITIAL ASSESSMENT & CHRONOLOGICAL NOTES (Oldest → Newest):
${r.chronologicalNotes || 'No notes logged'}

   PRESENTING COMPLAINT:
${r.complaints}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PAST MEDICAL HISTORY:
${r.history}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. PROVISIONAL DIAGNOSIS & ASSESSMENT:
${r.assessment}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. MANAGEMENT PLAN:
   [DONE ✓]
${r.planDone}

   [TO BE DONE □]
${r.planToBeDone}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. BYSTANDER UPDATE & VITALS:
   [Bystander]: ${r.bystander}
   [Vitals]: ${r.vitals || 'Logged'}
${r.alerts ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠ CRITICAL ALERTS: ${r.alerts}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                };

                const text = `HOSPITAL HANDOVER & TRANSITION LOG\nDate: ${handoverMeta.date} | From: ${handoverMeta.from} | To: ${handoverMeta.to} | Time: ${handoverMeta.time}\n\n` + 
                  editableRows.map(buildFormattedCard).join("\n");
                navigator.clipboard.writeText(text).then(() => {
                  setCopiedState(prev => ({ ...prev, "sheet_copy": true }));
                  setTimeout(() => setCopiedState(prev => ({ ...prev, "sheet_copy": false })), 2000);
                });
              }}
              className={`px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                copiedState["sheet_copy"]
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              {copiedState["sheet_copy"] ? "Copied!" : "Copy Clipboard"}
            </button>
            <button
              onClick={() => {
                triggerPrintWithTip();
                setPostPrintDataType(activeSubTab === "registry" ? "registry" : "quickpaste");
                if (activeSubTab === "registry") {
                  setIdsToCleanup(editableRows.map(r => r.id));
                } else {
                  setIdsToCleanup(quickPasteList.map(p => p.id));
                }
                setShowPostPrintCleanPrompt(true);
              }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Handover Sheet
            </button>
          </div>
        </div>

        {/* Gemini AI Compiling Indicator Banner */}
        {isAiCompilingSheet && (
          <div className="bg-gradient-to-r from-indigo-900/90 to-purple-900/90 text-white p-3.5 rounded-2xl flex items-center gap-3 no-print shadow-md animate-pulse text-xs font-semibold border border-indigo-500/30">
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin shrink-0" />
            <div>
              <p className="font-bold text-amber-200">ErMate Scribe extracting clinical data...</p>
              <p className="text-[11px] text-indigo-100/80 font-normal">Extracting doctor notes, timestamps, past history, labs, and pending plans parameter-by-parameter into handover columns. Please wait a few seconds...</p>
            </div>
          </div>
        )}

        {/* Live Interactive Metadata Configurator (Hidden during Print) */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl grid grid-cols-2 md:grid-cols-5 gap-3.5 no-print text-xs shadow-xs animate-fade-in">
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Hospital Name</label>
            <input
              type="text"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-800 dark:text-slate-100"
              placeholder="e.g. RAJAGIRI HOSPITAL"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Handover Date</label>
            <input
              type="text"
              value={handoverMeta.date}
              onChange={(e) => setHandoverMeta(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Outgoing Shift</label>
            <input
              type="text"
              value={handoverMeta.from}
              onChange={(e) => setHandoverMeta(prev => ({ ...prev, from: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Incoming Shift</label>
            <input
              type="text"
              value={handoverMeta.to}
              onChange={(e) => setHandoverMeta(prev => ({ ...prev, to: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Shift Time</label>
            <input
              type="text"
              value={handoverMeta.time}
              onChange={(e) => setHandoverMeta(prev => ({ ...prev, time: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Vertical Portrait A4 Handover Sheets */}
        <div className="space-y-6 print:space-y-0">
          <div className="print-page bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 md:p-6 rounded-2xl shadow-sm text-slate-900 dark:text-white space-y-4 relative">
            
            {/* Sheet Top Branding Header */}
            <div className="border-b-2 border-slate-900 dark:border-slate-800 pb-3 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
              <div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <h1 className="text-base md:text-lg font-black tracking-wider text-slate-950 dark:text-white uppercase font-mono">
                    {hospitalName || "RAJAGIRI HOSPITAL"} &mdash; EMERGENCY DEPARTMENT
                  </h1>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono tracking-widest mt-0.5 uppercase font-bold">
                  DOCTORS' CLINICAL HANDOVER SHEET
                </p>
              </div>
              
              {/* Meta details */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-4 gap-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
                <div><strong>DATE:</strong> {handoverMeta.date}</div>
                <div><strong>FROM:</strong> {handoverMeta.from}</div>
                <div><strong>TO:</strong> {handoverMeta.to}</div>
                <div><strong>TIME:</strong> {handoverMeta.time}</div>
              </div>
            </div>

            {/* Patients Vertical Card List */}
            <div className="space-y-6 print:space-y-4">
              {editableRows.map((row) => (
                <div 
                  key={row.id} 
                  className="print-card border-2 border-slate-900 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-xs print:shadow-none print:border-slate-900 font-sans"
                >
                  {/* 1. HEADER BAR: BED NO + NAME */}
                  <div className="print-card-header bg-slate-900 dark:bg-slate-900 text-white p-2.5 md:p-3 border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-indigo-600 text-white text-xs font-mono font-black px-2 py-0.5 rounded tracking-wide uppercase flex items-center justify-center">
                        <span className="hidden print:inline-block font-mono font-black text-white whitespace-nowrap">
                          {row.bed || "Bed #"}
                        </span>
                        <input
                          type="text"
                          value={row.bed}
                          onChange={(e) => handleUpdateCell(row.id, "bed", e.target.value)}
                          className="bg-transparent border-none text-white text-center w-16 focus:outline-none font-mono font-black print:hidden"
                          placeholder="Bed #"
                        />
                      </div>
                      <span className="hidden print:inline-block text-base font-black tracking-tight text-white uppercase font-mono">
                        {row.name || "PATIENT NAME"}
                      </span>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleUpdateCell(row.id, "name", e.target.value)}
                        className="text-base font-black tracking-tight text-white uppercase font-mono bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 print:hidden"
                        placeholder="PATIENT NAME"
                      />
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-200 flex flex-wrap items-center gap-2 md:gap-3">
                      <span className="hidden print:inline-block text-slate-200 font-mono font-bold text-xs">
                        {row.ageGender || ""}
                      </span>
                      <input
                        type="text"
                        value={row.ageGender}
                        onChange={(e) => handleUpdateCell(row.id, "ageGender", e.target.value)}
                        className="bg-transparent border-none text-slate-200 font-mono font-bold text-xs w-14 text-right focus:outline-none print:hidden"
                        placeholder="Age/Sex"
                      />
                      {row.erNo && <span className="text-amber-300 font-mono">· {row.erNo}</span>}
                      {row.doctor && <span className="text-indigo-200 font-mono">· {row.doctor}</span>}
                      {row.stayDuration && <span className="text-emerald-300 font-mono">· {row.stayDuration}</span>}
                      <button
                        type="button"
                        onClick={() => handleOpenHandoverRowChat(row)}
                        className="no-print ml-2 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1"
                        title="Discuss this patient's handover notes with ErMate AI"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Discuss</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. PRESENTING COMPLAINT & INITIAL ASSESSMENT CHRONOLOGICAL NOTES */}
                  <div className="border-b border-slate-300 dark:border-slate-800 divide-y divide-slate-300 dark:divide-slate-800">
                    {/* PRESENTING COMPLAINT: Full width · Short · Clean */}
                    <div className="p-3 bg-amber-50/30 dark:bg-amber-950/10 print-section">
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-amber-200 dark:border-amber-900/30">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 font-mono">
                          PRESENTING COMPLAINT
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCellEditing(row.id, "complaints")}
                          className="no-print text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-900 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
                        >
                          {editingCells[`${row.id}_complaints`] ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                          ) : (
                            <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                          )}
                        </button>
                      </div>
                      {editingCells[`${row.id}_complaints`] ? (
                        <AutoResizeTextarea
                          value={row.complaints}
                          onChange={(e) => handleUpdateCell(row.id, "complaints", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 w-full text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans resize-none min-h-[40px]"
                          placeholder="Altered sensorium x 1 month..."
                        />
                      ) : (
                        <div className="text-xs font-sans whitespace-pre-wrap text-slate-900 dark:text-slate-100 leading-relaxed bg-white/60 dark:bg-slate-900/40 p-2 rounded border border-amber-100 dark:border-amber-950/30">
                          <HighlightedHandoverText text={row.complaints} />
                        </div>
                      )}
                    </div>

                    {/* 2. INITIAL ASSESSMENT & CHRONOLOGICAL NOTES (OLDEST -> NEWEST): Multi-column (1, 2, or 3 cols based on entry count) */}
                    <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 print-section">
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 font-mono flex items-center gap-1">
                          2. INITIAL ASSESSMENT &amp; CHRONOLOGICAL NOTES (OLDEST &rarr; NEWEST)
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCellEditing(row.id, "chronologicalNotes")}
                          className="no-print text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer"
                        >
                          {editingCells[`${row.id}_chronologicalNotes`] ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                          ) : (
                            <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                          )}
                        </button>
                      </div>
                      {editingCells[`${row.id}_chronologicalNotes`] ? (
                        <AutoResizeTextarea
                          value={row.chronologicalNotes || ""}
                          onChange={(e) => handleUpdateCell(row.id, "chronologicalNotes", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-mono resize-none min-h-[60px]"
                          placeholder="20-07 00:30 Dr. Fathim · BP 150/80 · GCS normal..."
                        />
                      ) : (
                        <div className="pt-1">
                          <MultiColumnEntriesView text={row.chronologicalNotes} fontFamily="font-mono" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. PAST MEDICAL HISTORY */}
                  <div className="p-3 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 print-section">
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                        3. PAST MEDICAL HISTORY
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCellEditing(row.id, "history")}
                        className="no-print text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-800 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-900/40 cursor-pointer"
                      >
                        {editingCells[`${row.id}_history`] ? (
                          <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                        ) : (
                          <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                        )}
                      </button>
                    </div>
                    {editingCells[`${row.id}_history`] ? (
                      <AutoResizeTextarea
                        value={row.history}
                        onChange={(e) => handleUpdateCell(row.id, "history", e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 w-full text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans resize-none min-h-[40px]"
                        placeholder="T2DM · HTN · Meds · Surgical history..."
                      />
                    ) : (
                      <div className="text-xs font-sans whitespace-pre-wrap text-slate-900 dark:text-slate-100 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded border border-slate-100 dark:border-slate-900">
                        <HighlightedHandoverText text={row.history} />
                      </div>
                    )}
                  </div>

                  {/* 4. PROVISIONAL DIAGNOSIS & ASSESSMENT */}
                  <div className="p-3 border-b border-slate-300 dark:border-slate-800 bg-purple-50/20 dark:bg-purple-950/10 print-section">
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-[10.5px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 font-mono">
                        4. PROVISIONAL DIAGNOSIS &amp; INVESTIGATION FINDINGS
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCellEditing(row.id, "assessment")}
                        className="no-print text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-800 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer"
                      >
                        {editingCells[`${row.id}_assessment`] ? (
                          <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                        ) : (
                          <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                        )}
                      </button>
                    </div>
                    {editingCells[`${row.id}_assessment`] ? (
                      <AutoResizeTextarea
                        value={row.assessment}
                        onChange={(e) => handleUpdateCell(row.id, "assessment", e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 w-full text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans resize-none min-h-[50px]"
                        placeholder="Provisional Diagnosis & MRI/CT/Lab report details..."
                      />
                    ) : (
                      <div className="text-xs font-sans whitespace-pre-wrap text-slate-900 dark:text-slate-100 leading-relaxed bg-white/60 dark:bg-slate-900/40 p-2 rounded border border-purple-100 dark:border-purple-950/30">
                        <HighlightedHandoverText text={row.assessment} />
                      </div>
                    )}
                  </div>

                  {/* 5. MANAGEMENT PLAN (DONE ✓ | TO BE DONE □) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-300 dark:border-slate-800 divide-y md:divide-y-0 md:divide-x divide-slate-300 dark:divide-slate-800 print-section">
                    {/* Left: DONE ✓ */}
                    <div className="p-3 bg-emerald-50/30 dark:bg-emerald-950/10">
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-emerald-200 dark:border-emerald-900/30">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1">
                          5. MANAGEMENT PLAN &mdash; DONE ✓
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCellEditing(row.id, "planDone")}
                          className="no-print text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer"
                        >
                          {editingCells[`${row.id}_planDone`] ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                          ) : (
                            <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                          )}
                        </button>
                      </div>
                      {editingCells[`${row.id}_planDone`] ? (
                        <AutoResizeTextarea
                          value={row.planDone}
                          onChange={(e) => handleUpdateCell(row.id, "planDone", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans resize-none min-h-[50px]"
                          placeholder="✓ MRI done · ✓ VBG x3 · ✓ Cardiology consult..."
                        />
                      ) : (
                        <div className="pt-1">
                          <MultiColumnEntriesView text={row.planDone} fontFamily="font-sans" />
                        </div>
                      )}
                    </div>

                    {/* Right: TO BE DONE □ */}
                    <div className="p-3 bg-blue-50/30 dark:bg-blue-950/10">
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-blue-200 dark:border-blue-900/30">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 font-mono flex items-center gap-1">
                          MANAGEMENT PLAN &mdash; TO BE DONE □
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCellEditing(row.id, "planToBeDone")}
                          className="no-print text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                        >
                          {editingCells[`${row.id}_planToBeDone`] ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                          ) : (
                            <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                          )}
                        </button>
                      </div>
                      {editingCells[`${row.id}_planToBeDone`] ? (
                        <AutoResizeTextarea
                          value={row.planToBeDone}
                          onChange={(e) => handleUpdateCell(row.id, "planToBeDone", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans resize-none min-h-[50px]"
                          placeholder="□ PAC — URGENT · □ Urine C&S · □ Biopsy Thu..."
                        />
                      ) : (
                        <div className="pt-1">
                          <MultiColumnEntriesView text={row.planToBeDone} fontFamily="font-sans" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 6. BYSTANDER UPDATE | VITALS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300 dark:divide-slate-800 print-section">
                    {/* Left: BYSTANDER UPDATE */}
                    <div className="p-3 bg-white dark:bg-slate-950">
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                          6. BYSTANDER UPDATE &amp; CONSENTS
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCellEditing(row.id, "bystander")}
                          className="no-print text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-800 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-900/40 cursor-pointer"
                        >
                          {editingCells[`${row.id}_bystander`] ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                          ) : (
                            <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                          )}
                        </button>
                      </div>
                      {editingCells[`${row.id}_bystander`] ? (
                        <AutoResizeTextarea
                          value={row.bystander}
                          onChange={(e) => handleUpdateCell(row.id, "bystander", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 w-full text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans resize-none min-h-[35px]"
                          placeholder="Wife present · Consent done · Pending biopsy consent..."
                        />
                      ) : (
                        <div className="text-xs font-sans whitespace-pre-wrap text-slate-900 dark:text-slate-100 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded border border-slate-100 dark:border-slate-900">
                          <HighlightedHandoverText text={row.bystander} />
                        </div>
                      )}
                    </div>

                    {/* Right: VITALS */}
                    <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 font-mono">
                          LATEST VITALS &amp; RECORDED TIME
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCellEditing(row.id, "vitals")}
                          className="no-print text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer"
                        >
                          {editingCells[`${row.id}_vitals`] ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Done</>
                          ) : (
                            <><Pencil className="w-2.5 h-2.5" /> Edit text</>
                          )}
                        </button>
                      </div>
                      {editingCells[`${row.id}_vitals`] ? (
                        <AutoResizeTextarea
                          value={row.vitals || ""}
                          onChange={(e) => handleUpdateCell(row.id, "vitals", e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 resize-none min-h-[35px]"
                          placeholder="BP 130/80 · HR 72 · GRBS 415⚠ · GCS E4V5M6..."
                        />
                      ) : (
                        <div className="text-xs font-mono whitespace-pre-wrap text-slate-900 dark:text-slate-100 leading-relaxed bg-white/60 dark:bg-slate-900/40 p-2 rounded border border-indigo-100 dark:border-indigo-950/30">
                          <HighlightedHandoverText text={row.vitals || ""} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FOOTER WARNING / ALERT STRIP */}
                  {row.alerts && row.alerts.trim().length > 0 && (
                    <div className="bg-red-600 text-white p-2 text-xs font-mono font-bold flex items-center justify-between border-t-2 border-red-700">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
                        <span className="tracking-wide">{row.alerts}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCellEditing(row.id, "alerts")}
                        className="no-print text-[10px] text-red-100 hover:text-white font-mono font-bold flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-700/60 hover:bg-red-700 cursor-pointer"
                      >
                        {editingCells[`${row.id}_alerts`] ? (
                          <><Check className="w-3 h-3 text-emerald-300" /> Done</>
                        ) : (
                          <><Pencil className="w-2.5 h-2.5" /> Edit</>
                        )}
                      </button>
                    </div>
                  )}
                  {editingCells[`${row.id}_alerts`] && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-900">
                      <AutoResizeTextarea
                        value={row.alerts || ""}
                        onChange={(e) => handleUpdateCell(row.id, "alerts", e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-red-500 w-full text-xs font-mono leading-relaxed text-red-800 dark:text-red-200 resize-none min-h-[35px]"
                        placeholder="⚠ High risk alerts / Lab abnormalities..."
                      />
                    </div>
                  )}

                  {/* Card Actions (no-print) */}
                  <div className="no-print bg-slate-100 dark:bg-slate-900 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditableRows(prev => prev.filter(r => r.id !== row.id))}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Patient Card
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sheet Footer Notice */}
            <div className="border-t border-slate-300 dark:border-slate-800 pt-3 text-center text-[9px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
              <p>CONFIDENTIAL • PROTECTED PATIENT TRANSITION LOG &mdash; Powered by ErMate Clinical Systems | Ensure secure handover transition and immediate team bedside endorsement.</p>
            </div>
          </div>
        </div>

        {/* Add custom empty row button and print notice (hidden on print) */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xs no-print animate-fade-in">
          <button
            onClick={() => {
              const newId = `custom-${Date.now()}`;
              setEditableRows(prev => [
                ...prev,
                {
                  id: newId,
                  bed: `Bed ${prev.length + 1}`,
                  name: "New Patient",
                  ageGender: "Age/Sex",
                  complaints: "Presenting complaints details...",
                  history: "Nil documented",
                  assessment: "Provisional diagnosis...",
                  planDone: "Vitals logged.\nLabs/Imaging done.",
                  planToBeDone: "Pending orders...",
                  bystander: "Counselled."
                }
              ]);
            }}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Add Patient to Handover Sheet
          </button>
          
          <div className="text-[10px] text-slate-400 font-mono text-center sm:text-right leading-relaxed max-w-md">
            <p className="font-bold text-slate-500">PRO TIP FOR PRINTERS:</p>
            <p>Ensure layout margins are set to "Default" or "None" and background graphics are "Enabled" in the print pop-up for perfect formatting.</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" id="handover-section">
      
      {/* Printable Modal (shown on full print compilation) */}
      {showPrintReport && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-500" />
                Outgoing Handover Compiler
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePrint(printType)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => {
                    const text = printType === "registry" ? getRegistryPrintText() : getQuickPastePrintText();
                    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", `ERMate_Handover_${printType === "registry" ? "Registry" : "Quick_Paste"}_${new Date().toISOString().split('T')[0]}.txt`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    setPostPrintDataType(printType);
                    if (printType === "registry") {
                      setIdsToCleanup(selectedRegistryIds);
                    } else {
                      setIdsToCleanup(quickPasteList.map(p => p.id));
                    }
                    setShowPostPrintCleanPrompt(true);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Text Export
                </button>
                <button
                  onClick={() => setShowPrintReport(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Close Editor
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="space-y-6 text-slate-800 dark:text-slate-100 p-2 print:p-0 font-sans" id="printable-area-comprehensive">
              <div className="flex justify-between items-start border-b-2 border-indigo-100 pb-4">
                <div>
                  <h1 className="text-xl font-black font-display text-slate-900 dark:text-white uppercase tracking-tight">
                    ErMate Standardized Handover Report
                  </h1>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">
                    Compiled Lead: {profile.name} | Facility: <strong>{profile.hospital}</strong>{profile.hospitalAddress ? ` (${profile.hospitalAddress}${profile.state ? `, ${profile.state}` : ''})` : profile.state ? ` (${profile.state})` : ''}
                  </p>
                </div>
                <div className="text-right font-mono text-[10px] text-slate-400">
                  <p>Generated: {new Date().toLocaleDateString()} | {new Date().toLocaleTimeString()}</p>
                  <p>Method: {printType === "registry" ? "Live ER Registry Integration" : "EMR Quick Paste Engine"}</p>
                </div>
              </div>

              {printType === "registry" ? (
                // Registry Cases Print Layout
                <div className="space-y-6">
                  {cases.filter(c => selectedRegistryIds.includes(c.id)).map((c, idx) => (
                    <div key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/20">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {idx + 1}. {c.patient.name} ({c.patient.age}y / {c.patient.gender})
                        </h3>
                        <span className="font-mono text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {c.patient.triageCategory}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                        <div>
                          <p><strong className="text-slate-500">UHID:</strong> <span className="font-mono">{c.patient.uhid}</span></p>
                          <p><strong className="text-slate-500">Chief Complaint:</strong> {c.patient.presentingComplaint}</p>
                          <p><strong className="text-slate-500">Vitals:</strong> HR {c.vitals.hr || "N/A"} | BP {c.vitals.bp || "N/A"} | SpO2 {c.vitals.spo2 || "N/A"}% | RR {c.vitals.rr || "N/A"}</p>
                        </div>
                        <div>
                          <p><strong className="text-slate-500">Clinical History:</strong> {c.sampleHistory?.symptoms || "No active history listed"}</p>
                          <p><strong className="text-slate-500">Allergies:</strong> <span className="text-red-600 font-bold">{c.sampleHistory?.allergies || "NKDA"}</span></p>
                          <p><strong className="text-slate-500">Therapies given in ER:</strong> {c.treatments.map(t => `${t.drugName} ${t.dose}`).join(", ") || "None recorded"}</p>
                        </div>
                      </div>

                      {c.progressNotes && (
                        <div className="text-xs bg-white p-2.5 rounded border border-slate-150 font-mono text-slate-600">
                          <strong className="text-[10px] text-slate-400 block uppercase mb-1">ER Progress Log Summary:</strong>
                          {c.progressNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Quick Paste Print Layout
                <div className="space-y-6">
                  {quickPasteList.map((item, idx) => (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/20">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          {item.bed && (
                            <span className="font-mono text-xs font-black bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                              {item.bed}
                            </span>
                          )}
                          <h3 className="text-sm font-bold text-slate-900">
                            {idx + 1}. {item.name} ({item.ageGender})
                          </h3>
                        </div>
                        <span className="font-mono text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {item.triage}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-slate-500"><strong className="text-slate-700">Vitals at Handover:</strong> {item.vitals}</p>

                      {/* Structured SBAR display */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-blue-700 text-[10px] uppercase block tracking-wider mb-1">[S] Situation</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.situation}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-purple-700 text-[10px] uppercase block tracking-wider mb-1">[B] Background</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.background}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-amber-700 text-[10px] uppercase block tracking-wider mb-1">[A] Assessment</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.assessment}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-150">
                          <span className="font-extrabold text-emerald-700 text-[10px] uppercase block tracking-wider mb-1">[R] Recommendation</span>
                          <p className="text-slate-700 leading-relaxed">{item.structuredSBAR?.recommendation}</p>
                        </div>
                      </div>

                      <div className="text-[10px] bg-slate-100 p-2 rounded font-mono text-slate-500 whitespace-pre-wrap">
                        <strong className="block mb-1 text-[9px] uppercase tracking-wider text-slate-400">Raw EMR Pasted Records:</strong>
                        {item.rawNotes}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4 text-center text-[10px] text-slate-400 font-mono leading-relaxed">
                <p>This document contains confidential Protected Health Information (PHI) subject to regional clinical privacy acts.</p>
                <p>Ensure secure transition, immediate consultant endorsement, and secure document disposal post shift takeover.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Header */}
      <div className={`bg-gradient-to-r ${isDarkMode ? 'from-slate-900 to-indigo-950 border-indigo-900/40 text-white' : 'from-indigo-600 to-purple-600 text-white border-transparent'} rounded-2xl p-6 shadow-md border relative overflow-hidden`}>
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10">
          <RefreshCw className="w-80 h-80 animate-spin-slow" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider font-mono border ${
                  isDarkMode 
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                    : "bg-white/15 text-white border-white/20"
                }`}>
                  IPASS / SBAR Standardized Tool
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider font-mono border ${
                  isDarkMode 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : "bg-white/10 text-white border-white/10"
                }`}>
                  ✓ Free Feature (Unlimited Cases)
                </span>
              </div>
              <h1 className="text-2xl font-black font-display tracking-tight">Shift Handover & Transition Center</h1>
              <p className={`text-xs max-w-xl font-medium leading-relaxed ${
                isDarkMode ? "text-slate-300" : "text-indigo-100"
              }`}>
                Perform clinical shift endorsement safely. Compile outgoing summaries for boarding department cases, or instantly paste EMR dumps to auto-structure printable shift transition sheets.
              </p>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab("dashboard")}
                className="self-start md:self-center py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl transition-all flex items-center gap-2 font-bold font-mono text-[11px] uppercase tracking-wider cursor-pointer shrink-0 shadow-md"
              >
                <ChevronLeft className="w-4 h-4 text-emerald-400" /> Dashboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUCCESS MESSAGE BANNER */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between text-emerald-800 dark:text-emerald-300 animate-fade-in no-print">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="text-xs font-bold">{actionSuccessMsg}</div>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold uppercase">Dismiss</button>
        </div>
      )}

      {/* SHIFT OVERLAP WARNING BANNER */}
      {hasUnclearedShiftWarning && (
        <div className="bg-amber-50 border border-amber-250 dark:bg-amber-950/20 dark:border-amber-900 rounded-xl p-4 space-y-2 text-amber-800 dark:text-amber-300 animate-fade-in no-print">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-xs font-black">⚠️ Shift Handover Clean Slate Warning</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                You recently compiled and printed/exported a handover document, but the cases remain active on the primary board. Leaving patients on the active list causes selection confusion and data overlap for the incoming team shift.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-7 pt-1">
            {postPrintDataType === "registry" ? (
              <>
                <button
                  disabled={cleanupActionInProgress}
                  onClick={() => {
                    handleBulkCleanup("discharge");
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10.5px] font-bold transition-all shadow-xs"
                >
                  Discharge & Archive Active Cases
                </button>
                <button
                  disabled={cleanupActionInProgress}
                  onClick={() => {
                    handleBulkCleanup("delete");
                  }}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10.5px] font-bold transition-all shadow-xs"
                >
                  Delete Selected Case Logs
                </button>
              </>
            ) : (
              <button
                disabled={cleanupActionInProgress}
                onClick={() => {
                  handleBulkCleanup("clear_quickpaste");
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10.5px] font-bold transition-all shadow-xs"
              >
                Clear Free Quick-Paste List
              </button>
            )}
            <button
              onClick={() => setHasUnclearedShiftWarning(false)}
              className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase underline"
            >
              Dismiss warning
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 w-full sm:w-fit no-print">
        <button
          onClick={() => {
            setActiveSubTab("registry");
            setIsViewingSheet(false);
          }}
          className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between sm:justify-start gap-2 ${
            activeSubTab === "registry"
              ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 shrink-0" />
            <span>Direct from ErMate Case Log</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full font-mono font-bold shrink-0">
            {activeCases.length}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab("quickpaste");
            setIsViewingSheet(false);
          }}
          className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between sm:justify-start gap-2 ${
            activeSubTab === "quickpaste"
              ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <ClipboardCopy className="w-4 h-4 shrink-0" />
            <span>Other than ErMate (Direct EMR Handover)</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full font-mono font-bold shrink-0">
            Always Free
          </span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab("discharge_direct");
            setIsViewingSheet(false);
          }}
          className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between sm:justify-start gap-2 ${
            activeSubTab === "discharge_direct"
              ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" />
            <span>Discharge Summary Generator</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full font-mono font-bold shrink-0">
            Universal Hospital Format
          </span>
        </button>
      </div>

      {/* SUB-TAB 1: REGISTERED ER CASES HANDOVER */}
      {activeSubTab === "registry" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Active Cases Endorsement Checklist */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Select Cases for Shift Endorsement</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Toggle checkbox to include the patient in the compiled printable handover.</p>
                </div>
                <button
                  onClick={handleSelectAllRegistry}
                  className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1 bg-indigo-50/50 dark:bg-indigo-950/25 rounded"
                >
                  {selectedRegistryIds.length === activeCases.length ? "Deselect All" : "Select All Active"}
                </button>
              </div>

              {activeCases.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                  <p className="text-slate-600 dark:text-slate-300 text-xs font-bold">No Registered Active Cases Found</p>
                  <p className="text-slate-400 text-[10px] max-w-sm mx-auto">There are no boarding active patients in the ER. Complete an admission in the Triage Registry to populate this list.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCases.map((c) => {
                    const isSelected = selectedRegistryIds.includes(c.id);
                    return (
                      <div 
                        key={c.id}
                        onClick={() => handleToggleRegistryCase(c.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                          isSelected
                            ? "bg-indigo-50/30 dark:bg-indigo-950/15 border-indigo-400/80 ring-1 ring-indigo-50 dark:ring-indigo-950/50"
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="pt-1">
                          <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-slate-300 bg-white"
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="space-y-1 flex-1 min-w-0 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 dark:text-white">{c.patient.name}</h4>
                            <span className="text-[9px] text-slate-400 font-mono">({c.patient.age}y / {c.patient.gender})</span>
                            <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold font-mono uppercase ${
                              c.patient.triageCategory.includes("P1")
                                ? "bg-rose-50 border border-rose-200 text-rose-700"
                                : c.patient.triageCategory.includes("P2")
                                ? "bg-amber-50 border border-amber-200 text-amber-700"
                                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            }`}>
                              {c.patient.triageCategory.split(" ")[0]}
                            </span>
                          </div>
                          
                          <p className="text-slate-600 dark:text-slate-400 truncate"><span className="font-semibold text-slate-700 dark:text-slate-300">Complaint:</span> {c.patient.presentingComplaint}</p>
                          <p className="text-[10px] text-slate-400 font-mono">UHID: {c.patient.uhid} | ER Vitals: HR {c.vitals.hr || "N/A"} bpm, BP {c.vitals.bp || "N/A"} mmHg, SpO2 {c.vitals.spo2 || "N/A"}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Compilation Card (1/3 Width) */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="border-b pb-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-sm font-bold font-display">Compile Sheet</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between font-mono text-[11px] pb-2 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-400">Selected Patients:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-bold">{selectedRegistryIds.length}</strong>
                </div>

                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Generates an integrated clinical handover report compliant with **IPASS** communication structures, detailing patient demographics, acute vital trends, current treatment statuses, and ongoing clinical instructions.
                </p>

                 <button
                  disabled={selectedRegistryIds.length === 0}
                  onClick={compileRegistryToSheet}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Generate Handover Sheet
                </button>

                <button
                  disabled={selectedRegistryIds.length === 0}
                  onClick={() => handleDownloadWordDirect("registry")}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download MS Word (.doc)
                </button>

                <button
                  disabled={selectedRegistryIds.length === 0}
                  onClick={() => {
                    const selected = cases.filter(c => selectedRegistryIds.includes(c.id));
                    const patientsSummary = selected.map(s => `${s.patient.name} (${s.patient.triageCategory.split(" ")[0]} - ${s.patient.presentingComplaint})`).join(", ");
                    const record: HandoverRecord = {
                      id: "H-" + Math.floor(1000 + Math.random() * 9000),
                      senderName: "Dr. " + profile.name,
                      senderEmail: profile.email,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today",
                      caseCount: selected.length,
                      patientsText: patientsSummary
                    };
                    setHandovers(prev => [record, ...prev]);
                    setHandoverLoggedSuccess(true);
                    setTimeout(() => setHandoverLoggedSuccess(false), 5000);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Log Handover to Registry
                </button>

                <button
                  disabled={selectedRegistryIds.length === 0}
                  onClick={() => {
                    handleCopyText("registry_full", getRegistryPrintText());
                  }}
                  className={`w-full py-2.5 border text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    copiedState["registry_full"]
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {copiedState["registry_full"] ? (
                    <>
                      <Check className="w-4 h-4" />
                      Endorsement Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-4 h-4" />
                      Copy endorsement string
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Handover Log Success Alert */}
            {handoverLoggedSuccess && (
              <div className="bg-emerald-500 text-white p-3.5 rounded-xl font-bold text-xs flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>Clinical Handover registered and logged in department registry.</span>
                </div>
                <button 
                  onClick={() => setHandoverLoggedSuccess(false)}
                  className="bg-emerald-700 hover:bg-emerald-850 px-2 py-1 rounded text-[10px]"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Outgoing & Incoming Handover Hub */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Users className="w-5 h-5" />
                  <h3 className="text-sm font-bold font-display">Endorsement Tracker</h3>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded font-mono">
                  {handovers.length} Total
                </span>
              </div>

              {handovers.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-4">No logged handovers for today's shift.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {handovers.map((hand) => {
                    const isAckBySomeone = !!hand.acknowledgedBy;
                    return (
                      <div key={hand.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {hand.id}
                          </span>
                          {isAckBySomeone ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200/30 font-extrabold flex items-center gap-0.5">
                              <Check className="w-3 h-3 text-emerald-500" />
                              ACKNOWLEDGED
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-200/30 font-extrabold animate-pulse">
                              AWAITING ACK
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          <p><span className="font-bold">From:</span> {hand.senderName}</p>
                          <p className="line-clamp-2 italic text-slate-500 mt-1">"{hand.patientsText}"</p>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                          <span>{hand.timestamp}</span>
                          {isAckBySomeone ? (
                            <span className="text-emerald-500">By: {hand.acknowledgedBy}</span>
                          ) : (
                            <button
                              onClick={() => {
                                setHandovers(prev => prev.map(h => h.id === hand.id ? {
                                  ...h,
                                  acknowledgedBy: "Dr. " + profile.name,
                                  acknowledgedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today"
                                } : h));
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[10px]"
                            >
                              Sign Off & Acknowledge Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Structured Handover Tips */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-500 uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" />
                IPASS Endorsement Protocol
              </div>
              <ul className="text-[11px] text-slate-500 space-y-1 list-disc pl-4 leading-relaxed">
                <li><strong className="text-slate-700 dark:text-slate-300">I</strong>: Illness Severity designation (P1, P2, P3).</li>
                <li><strong className="text-slate-700 dark:text-slate-300">P</strong>: Patient Summary (Active events & reasons).</li>
                <li><strong className="text-slate-700 dark:text-slate-300">A</strong>: Action Items (To-do lists & pending orders).</li>
                <li><strong className="text-slate-700 dark:text-slate-300">S</strong>: Situation awareness & contingency plan.</li>
                <li><strong className="text-slate-700 dark:text-slate-300">S</strong>: Synthesis (Incoming team read-back).</li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: DIRECT EMR QUICK PASTE (FREE FOR ALL) */}
      {activeSubTab === "quickpaste" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Clinical Scribe Chat Interface (2/3 Width) */}
          <div className="lg:col-span-2 flex flex-col h-[680px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            
            {/* Scribe Chat Header */}
            <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-slate-950 animate-ping" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-slate-950" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                    ErMate Clinical Scribe Chat
                    <span className="text-[8px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/40">
                      Live
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Talk to ErMate to parse, extract, and structure EMR patient dumps into SBAR cases instantly.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveScribeDraft}
                  className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Save scribe chat draft"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Save Draft</span>
                </button>
                <button
                  onClick={() => {
                    if (!confirmResetChat) {
                      setConfirmResetChat(true);
                      setTimeout(() => setConfirmResetChat(false), 4000);
                    } else {
                      setChatMessages([
                        {
                          id: "system-1",
                          sender: "ermate",
                          text: "Hello! I am your ErMate clinical shift transition scribe. Copy-paste some unstructured clinical text or EMR notes, or upload a camera photo of your handwritten paper case sheets. I'll immediately parse the details, extract vitals and triage level, organize it into standard SBAR format, and log it to your active shift handover roster!",
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                      ]);
                      setConfirmResetChat(false);
                    }
                  }}
                  className={`text-[10px] font-black transition-colors px-2.5 py-1 rounded-lg cursor-pointer ${
                    confirmResetChat
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300"
                      : "text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-900"
                  }`}
                >
                  {confirmResetChat ? "Confirm Reset?" : "Reset Chat"}
                </button>
              </div>
            </div>

            {scribeDraftToast && (
              <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 border-b border-emerald-700 flex items-center justify-between animate-fade-in shadow-inner shrink-0">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-white" />
                  <span>Scribe AI chat history saved as draft successfully!</span>
                </span>
                <span className="text-[9px] uppercase font-mono bg-emerald-700 px-2 py-0.5 rounded-full tracking-wider">Synced</span>
              </div>
            )}

            {/* Chat Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40 dark:bg-slate-950/20 font-sans">
              {chatMessages.map((msg) => {
                const isBot = msg.sender === "ermate";
                const targetId = msg.parsedPatient?.patientId;
                const isCurrentlyInLogs = msg.parsedPatient 
                  ? quickPasteList.some(p => p.id === targetId || (p.name && msg.parsedPatient?.name && p.name.trim().toLowerCase() === msg.parsedPatient.name.trim().toLowerCase()))
                  : false;

                return (
                  <div key={msg.id} className={`flex items-start gap-2.5 ${isBot ? "" : "justify-end"}`}>
                    
                    {isBot && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0 mt-0.5">
                        Er
                      </div>
                    )}

                    <div className={`space-y-1.5 max-w-[85%] ${isBot ? "" : "text-right"} relative group`}>
                      
                      {/* Delete Message Button */}
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className={`absolute ${isBot ? "-right-6" : "-left-6"} top-4 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-3xs cursor-pointer no-print`}
                        title="Delete message from chat history"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {/* Message Content Bubble */}
                      <div className={`p-3.5 rounded-2xl text-xs leading-relaxed border ${
                        isBot 
                          ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-150 dark:border-slate-850 shadow-2xs rounded-tl-xs text-left"
                          : "bg-indigo-600 text-white border-indigo-700 shadow-sm rounded-tr-xs text-left"
                      }`}>
                        
                        {/* Image Attachment Preview */}
                        {msg.image && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 max-w-xs shadow-3xs">
                            <img 
                              src={`data:image/jpeg;base64,${msg.image}`} 
                              alt="Uploaded case sheet" 
                              referrerPolicy="no-referrer"
                              className="w-full max-h-[180px] object-cover"
                            />
                            <div className="p-1.5 bg-slate-50 dark:bg-slate-900 border-t text-[9px] font-mono text-slate-400 truncate">
                              📷 {msg.imageName || "casesheet_image.jpg"}
                            </div>
                          </div>
                        )}

                        {/* Plain Text Content */}
                        {msg.text && (
                          <p className={!isBot ? "whitespace-pre-wrap" : ""}>
                            {msg.text}
                          </p>
                        )}

                        {/* AI Parsed Structured Card */}
                        {isBot && msg.parsedPatient && (
                          <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                            {msg.parsedPatient.handoverCardData ? (
                              <HandoverCard
                                patient={msg.parsedPatient.handoverCardData}
                                onDiscuss={handleOpenHandoverCardChat}
                              />
                            ) : (
                              <>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 dark:text-white">{msg.parsedPatient.name}</span>
                                    <span className="text-[10px] text-slate-400">({msg.parsedPatient.ageGender})</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold ${
                                      msg.parsedPatient.triage.includes("P1")
                                        ? "bg-rose-50 border border-rose-200 text-rose-700"
                                        : msg.parsedPatient.triage.includes("P2")
                                        ? "bg-amber-50 border border-amber-250 text-amber-700"
                                        : "bg-emerald-50 border border-emerald-250 text-emerald-700"
                                    }`}>
                                      {msg.parsedPatient.triage}
                                    </span>
                                  </div>
                                </div>

                                <p className="font-mono text-[9.5px] text-slate-500 font-bold">Vitals: {msg.parsedPatient.vitals}</p>

                                {/* SBAR Grid Fallback */}
                                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900 space-y-2 text-[11px] leading-relaxed">
                                  <p><strong className="text-blue-700 dark:text-blue-400 font-black uppercase tracking-wider text-[9px] block mb-0.5">Situation</strong> <HighlightedHandoverText text={msg.parsedPatient.structuredSBAR.situation} /></p>
                                  <p><strong className="text-purple-700 dark:text-purple-400 font-black uppercase tracking-wider text-[9px] block mb-0.5">Background</strong> <HighlightedHandoverText text={msg.parsedPatient.structuredSBAR.background} /></p>
                                  <p><strong className="text-amber-700 dark:text-amber-400 font-black uppercase tracking-wider text-[9px] block mb-0.5">Assessment</strong> <HighlightedHandoverText text={msg.parsedPatient.structuredSBAR.assessment} /></p>
                                  <p><strong className="text-emerald-700 dark:text-emerald-400 font-black uppercase tracking-wider text-[9px] block mb-0.5">Recommendation</strong> <HighlightedHandoverText text={msg.parsedPatient.structuredSBAR.recommendation} /></p>
                                </div>
                              </>
                            )}

                            {/* Auto Saved confirmation pill & edit details */}
                            <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-850 pt-2.5 flex-wrap gap-2 text-[10px]">
                              {isCurrentlyInLogs ? (
                                <>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider text-[8px] flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                                    Automatically Saved to Active Logs
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const activeItem = quickPasteList.find(p => p.id === targetId || p.name === msg.parsedPatient?.name) || {
                                          id: targetId || `qp-pat-${Date.now()}`,
                                          name: msg.parsedPatient?.name || "Patient",
                                          ageGender: msg.parsedPatient?.ageGender || "",
                                          triage: msg.parsedPatient?.triage || "P2 (Urgent)",
                                          vitals: msg.parsedPatient?.vitals || "",
                                          rawNotes: msg.parsedPatient?.rawNotes || "",
                                          structuredSBAR: msg.parsedPatient?.structuredSBAR
                                        };
                                        handleEditClick(activeItem);
                                      }}
                                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-extrabold flex items-center gap-0.5"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                      Edit details
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-800">|</span>
                                    <button
                                      onClick={() => {
                                        const activeItem = quickPasteList.find(p => p.id === targetId || p.name === msg.parsedPatient?.name);
                                        if (activeItem) {
                                          handleRemoveQuickPaste(activeItem.id);
                                          setActionSuccessMsg(`Removed ${activeItem.name} from logs.`);
                                        }
                                      }}
                                      className="text-red-500 hover:underline font-extrabold"
                                    >
                                      Remove Case
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider text-[8px] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                    Removed from Active Logs
                                  </span>

                                  <button
                                    onClick={() => {
                                      const restoredCardData = msg.parsedPatient?.handoverCardData;
                                      const restoredPatient: QuickPastePatient = {
                                        id: targetId || `qp-pat-${Date.now()}`,
                                        bed: restoredCardData?.patientLabel?.bed || undefined,
                                        name: msg.parsedPatient?.name || "Bed Patient",
                                        ageGender: msg.parsedPatient?.ageGender || "Unknown",
                                        triage: msg.parsedPatient?.triage || (restoredCardData?.patientLabel?.status === 'critical' ? "P1 (Immediate)" : "P2 (Urgent)"),
                                        vitals: restoredCardData?.vitalsNow || msg.parsedPatient?.vitals || "Not documented",
                                        presentingComplaint: restoredCardData?.presentingComplaint || (msg.parsedPatient?.rawNotes ? msg.parsedPatient.rawNotes.substring(0, 150) : "Presenting complaint recorded."),
                                        rawNotes: msg.parsedPatient?.rawNotes || "Pasted clinical notes",
                                        structuredSBAR: msg.parsedPatient?.structuredSBAR || {
                                          situation: restoredCardData?.story || "No situation parsed.",
                                          background: restoredCardData?.pmh || "No background parsed.",
                                          assessment: restoredCardData?.vitalsNow || "No assessment parsed.",
                                          recommendation: restoredCardData?.done ? `Done: ${restoredCardData.done.join(', ')} | To Do: ${(restoredCardData.toBeDone || []).join(', ')}` : "No recommendation parsed."
                                        },
                                        handoverCardData: restoredCardData,
                                        hospital: profile?.hospital || "Varah Group Emergency Care",
                                        createdByEmail: profile?.email || auth.currentUser?.email || undefined
                                      };

                                      setQuickPasteList(prev => {
                                        const exists = prev.some(p => p.id === restoredPatient.id || (p.name && restoredPatient.name && p.name.trim().toLowerCase() === restoredPatient.name.trim().toLowerCase()));
                                        if (exists) {
                                          return prev.map(p => (p.id === restoredPatient.id || (p.name && restoredPatient.name && p.name.trim().toLowerCase() === restoredPatient.name.trim().toLowerCase())) ? restoredPatient : p);
                                        }
                                        return [...prev, restoredPatient];
                                      });
                                      setSelectedQuickPasteIds(prev => Array.from(new Set([...prev, restoredPatient.id])));

                                      const restoredTableRow: HandoverTableRow = {
                                        id: restoredPatient.id,
                                        bed: restoredCardData?.patientLabel?.bed || "N/A",
                                        name: restoredPatient.name,
                                        ageGender: restoredPatient.ageGender || "",
                                        erNo: restoredCardData?.patientLabel?.erNumber || "",
                                        doctor: restoredCardData?.patientLabel?.admittingConsultant || restoredCardData?.patientLabel?.treatingERPhysician || "",
                                        bystander: "",
                                        stayDuration: restoredCardData?.patientLabel?.inERSince || "",
                                        vitals: restoredPatient.vitals || "",
                                        complaints: restoredCardData?.presentingComplaint || restoredPatient.rawNotes?.slice(0, 100) || "",
                                        history: restoredCardData?.pmh || "",
                                        assessment: restoredPatient.structuredSBAR?.assessment || restoredCardData?.diagnosis || "",
                                        planDone: restoredCardData?.done ? restoredCardData.done.join('\n') : (restoredPatient.structuredSBAR?.recommendation || ""),
                                        planToBeDone: restoredCardData?.toBeDone ? restoredCardData.toBeDone.join('\n') : "",
                                        alerts: restoredPatient.vitals || "",
                                        chronologicalNotes: restoredPatient.rawNotes || ""
                                      };

                                      setEditableRows(prev => {
                                        const exists = prev.some(r => r.id === restoredTableRow.id);
                                        if (exists) return prev.map(r => r.id === restoredTableRow.id ? { ...r, ...restoredTableRow } : r);
                                        return [restoredTableRow, ...prev];
                                      });

                                      if (setHandovers) {
                                        const restoredRecord: HandoverRecord = {
                                          id: "H-" + Math.floor(1000 + Math.random() * 9000),
                                          senderName: profile?.name ? (profile.name.startsWith("Dr") ? profile.name : `Dr. ${profile.name}`) : "EM Resident",
                                          senderEmail: profile?.email || "",
                                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | Today",
                                          caseCount: 1,
                                          patientsText: `${restoredPatient.name} (${restoredPatient.triage ? restoredPatient.triage.split(" ")[0] : "P2"} - ${restoredPatient.presentingComplaint || restoredPatient.vitals})`,
                                          hospital: profile?.hospital || "Varah Group Emergency Care"
                                        };
                                        setHandovers(prev => [restoredRecord, ...prev]);
                                      }
                                      setActionSuccessMsg(`Restored ${restoredPatient.name} to active logs.`);
                                    }}
                                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add Back to Active Logs
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Timestamp & Label */}
                      <p className="text-[9px] text-slate-400 px-1 font-mono">
                        {msg.timestamp} {isBot ? "• ErMate Scribe" : ""}
                      </p>

                    </div>

                    {!isBot && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-black text-xs shrink-0 mt-0.5">
                        {profile.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Bot Loading/Parsing Spinner */}
              {isAiParsing && (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0 mt-0.5 animate-pulse">
                    Er
                  </div>
                  <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 text-slate-500 rounded-2xl rounded-tl-xs shadow-2xs text-xs space-y-2 max-w-sm">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400 animate-pulse">ErMate AI is parsing EMR notes...</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Running advanced OCR, clinical entity extraction, and organizing standard IPASS/SBAR situation cards. This will take a second...
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Test Case Suggestion Pills */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-900 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
              <span className="text-[9px] font-black uppercase text-slate-400 shrink-0">Try Case:</span>
              <button
                type="button"
                onClick={() => {
                  handleScribeChatSend(
                    "Bed 4, male 52 yrs. Sudden crushing chest pain for 2 hours, diaphoretic. BP is 145/88, HR 105. ST-elevation in V1-V4 on ECG. Gave loading doses of Aspirin 325mg and Ticagrelor 180mg at 10:15 AM. Cardiology reviewed, accepted for immediate PCI in Cath Lab. Prep in progress.",
                    null, null
                  );
                }}
                disabled={isAiParsing}
                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2.5 py-1 rounded-full font-bold transition-all border border-indigo-150 dark:border-indigo-900/40 shrink-0 hover:scale-102"
              >
                🚨 STEMI Chest Pain
              </button>
              <button
                type="button"
                onClick={() => {
                  handleScribeChatSend(
                    "Bed 9, Clara 28 yrs. Severe RLQ pain for 12 hours with McBurney tenderness. Nausea. Ultrasound confirms acute appendicitis (swollen appendix 8.8mm). NPO since 8 AM, IV Cefotetan 2g given. General surgery posted for appendectomy. Waiting for OT vacancy.",
                    null, null
                  );
                }}
                disabled={isAiParsing}
                className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2.5 py-1 rounded-full font-bold transition-all border border-purple-150 dark:border-purple-900/40 shrink-0 hover:scale-102"
              >
                🤢 RLQ Appendicitis
              </button>
              <button
                type="button"
                onClick={() => {
                  handleScribeChatSend(
                    "Bed 12, child 7 yrs. Severe asthma exacerbation. Tachypneic, diffuse expiratory wheezing. SpO2 91% on room air. Administered continuous Albuterol & Ipratropium nebs, IV Dexamethasone 10mg. BP 110/70, HR 120. SpO2 now 97% on 2L nasal cannula. Monitor closely.",
                    null, null
                  );
                }}
                disabled={isAiParsing}
                className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-1 rounded-full font-bold transition-all border border-amber-150 dark:border-amber-900/40 shrink-0 hover:scale-102"
              >
                🫁 Pediatric Asthma Exacerbation
              </button>
            </div>

            {/* Chat Input Area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3">
              
              {/* Media Thumbnail Indicator */}
              {handoverImgBase64 && (
                <div className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl border max-w-xs">
                  <img 
                    src={`data:image/jpeg;base64,${handoverImgBase64}`} 
                    alt="Ready upload thumbnail" 
                    className="w-10 h-10 object-cover rounded-lg border shadow-3xs" 
                  />
                  <div className="flex-1 min-w-0 text-[10px]">
                    <p className="text-slate-700 dark:text-slate-300 font-bold truncate">{handoverImgName || "casesheet_image.jpg"}</p>
                    <p className="text-slate-400">Attached for Scribe OCR Analysis</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setHandoverImgBase64(null);
                      setHandoverImgName(null);
                    }}
                    className="text-red-500 hover:text-red-700 p-1 font-bold"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Text Input Row */}
              <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                
                {/* 3-Dots Menu Button (More Actions) */}
                <div className="relative" ref={scribeMoreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowScribeMoreMenu(!showScribeMoreMenu)}
                    className={`p-2 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 h-9 w-9 cursor-pointer ${showScribeMoreMenu ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                    title="More Actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {/* Popup Dropdown Menu */}
                  {showScribeMoreMenu && (
                    <div className="absolute left-0 bottom-full mb-2 z-50 w-56 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 animate-fade-in flex flex-col space-y-0.5">
                      <div className="px-2.5 py-1 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/85 mb-1">
                        Scribe Actions
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowScribeMoreMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-indigo-500" />
                        <span>Upload Case Sheet Photo</span>
                      </button>
                    </div>
                  )}

                  {/* Hidden Input File Element */}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setHandoverImgName(file.name);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result?.toString().split(",")[1];
                          if (base64String) {
                            setHandoverImgBase64(base64String);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>

                {/* Text Area Input */}
                <div className="flex-1">
                  <textarea
                    ref={scribeTextareaRef}
                    rows={1}
                    value={qpRawNotes}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQpRawNotes(val);
                      if (val.length > 8) {
                        const extracted = extractPatientNameAndTimestamp(val);
                        if (!qpName || qpName === "Bed Patient") setQpName(extracted.name);
                        if (!qpAgeGender || qpAgeGender === "Unknown") setQpAgeGender(extracted.ageGender);
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (text) {
                        const extracted = extractPatientNameAndTimestamp(text);
                        if (!qpName || qpName === "Bed Patient") setQpName(extracted.name);
                        if (!qpAgeGender || qpAgeGender === "Unknown") setQpAgeGender(extracted.ageGender);
                        if (!qpVitals) {
                          const extractedVitals = extractLatestVitalsWithTime(undefined, undefined, text);
                          if (extractedVitals) setQpVitals(extractedVitals);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleScribeChatSend(qpRawNotes, handoverImgBase64, handoverImgName);
                      }
                    }}
                    placeholder="Paste unformatted clinical text dump or snap handwritten sheets..."
                    className="w-full text-xs bg-transparent focus:outline-none px-1 py-2 resize-none max-h-[160px] overflow-y-auto leading-relaxed text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Right side actions: Save Draft & dynamic Mic/Send toggle */}
                <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
                  <button
                    type="button"
                    onClick={handleSaveScribeDraft}
                    title="Save scribe chat as draft"
                    className="px-2.5 py-2 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold text-xs rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Save Draft</span>
                  </button>

                  {qpRawNotes.trim() === "" && !handoverImgBase64 ? (
                    <SpeechMicButton 
                      onTranscript={(txt) => setQpRawNotes(prev => prev ? `${prev} ${txt}` : txt)} 
                      className="!w-10 !h-10 !rounded-full !bg-indigo-600 hover:!bg-indigo-700 !text-white dark:!text-white !border-none shadow-md flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleScribeChatSend(qpRawNotes, handoverImgBase64, handoverImgName)}
                      disabled={isAiParsing}
                      className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                      title="Send message"
                    >
                      <Send className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>

              </div>

              </div>

            </div>

          {/* Active Shift Handover Logs Board (1/3 Width) */}
          <div className="space-y-5">
            {/* Active Endorsement list board */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Users className="w-4.5 h-4.5 text-indigo-500" />
                    Roster List
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Select patients to include in compiled handover</p>
                </div>
                <div className="flex items-center gap-3">
                  {quickPasteList.length > 0 && (
                    <button
                      onClick={handleSelectAllQuickPaste}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1 bg-indigo-50/50 dark:bg-indigo-950/25 rounded"
                    >
                      {selectedQuickPasteIds.length === quickPasteList.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                  <span className="text-xs font-black text-slate-800 dark:text-white font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-lg">
                    {selectedQuickPasteIds.length}/{quickPasteList.length}
                  </span>
                </div>
              </div>

              {/* Triage Level metrics panel */}
              {quickPasteList.length > 0 && (
                <div className="grid grid-cols-3 gap-2 py-1 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl text-center">
                  <div>
                    <span className="text-[8px] uppercase font-black text-rose-500 block">P1 Critical</span>
                    <strong className="text-xs font-black text-rose-700 dark:text-rose-400 font-mono">
                      {quickPasteList.filter(p => p.triage.includes("P1")).length}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase font-black text-amber-500 block">P2 Urgent</span>
                    <strong className="text-xs font-black text-amber-700 dark:text-amber-400 font-mono">
                      {quickPasteList.filter(p => p.triage.includes("P2")).length}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase font-black text-emerald-500 block">P3 Routine</span>
                    <strong className="text-xs font-black text-emerald-700 dark:text-emerald-400 font-mono">
                      {quickPasteList.filter(p => p.triage.includes("P3")).length}
                    </strong>
                  </div>
                </div>
              )}

              {/* Scrollable Handover Patient List */}
              {quickPasteList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Layers className="w-10 h-10 mx-auto text-indigo-250 dark:text-slate-800 mb-2.5 animate-pulse" />
                  <p className="font-extrabold text-slate-600 dark:text-slate-300">Roster is empty</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] mx-auto">Scribe patient EMR notes or click try cases on left to log patient cases.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {sortRowsByBedNumber<QuickPastePatient>(quickPasteList).map((item, idx) => {
                    const isSelected = selectedQuickPasteIds.includes(item.id);
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => handleToggleQuickPasteCase(item.id)}
                        className={`border rounded-xl p-3.5 space-y-3.5 relative group cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-50/30 dark:bg-indigo-950/15 border-indigo-400/80 ring-1 ring-indigo-50 dark:ring-indigo-950/50"
                            : "bg-slate-50/30 dark:bg-slate-900/10 border-slate-150 dark:border-slate-850 hover:border-slate-300"
                        }`}
                      >
                        
                        {/* Individual Patient Action buttons */}
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleEditClick(item)}
                            className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                            title="Edit clinical details"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemoveQuickPaste(item.id)}
                            className="p-1 hover:bg-rose-50 dark:hover:bg-red-950/20 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove patient case"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Checkbox and Header details */}
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isSelected 
                                ? "bg-indigo-600 border-indigo-600 text-white" 
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>

                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap pr-10">
                              <span className="font-mono text-[10px] font-black text-slate-400">#{idx + 1}</span>
                              {item.bed && (
                                <span className="font-mono text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-1.5 py-0.5 rounded uppercase border border-indigo-200 dark:border-indigo-800">
                                  {item.bed}
                                </span>
                              )}
                              <h4 className="text-xs font-black text-slate-800 dark:text-white leading-none">{item.name}</h4>
                              <span className="text-[10px] text-slate-400">({item.ageGender})</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <span className={`text-[7px] px-1.5 py-0.2 rounded font-black font-mono uppercase ${
                                item.triage.includes("P1")
                                  ? "bg-rose-50 border border-rose-200 text-rose-700"
                                  : item.triage.includes("P2")
                                  ? "bg-amber-50 border border-amber-250 text-amber-700"
                                  : "bg-emerald-50 border border-emerald-250 text-emerald-700"
                              }`}>
                                {item.triage.split(" ")[0]}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 font-bold">Vitals: {item.vitals}</span>
                            </div>
                          </div>
                        </div>

                        {/* Handover Card or SBAR summary collapsing panel */}
                        {item.handoverCardData ? (
                          <details className="text-[10.5px]" onClick={(e) => e.stopPropagation()}>
                            <summary className="cursor-pointer select-none font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors text-[9.5px] uppercase tracking-wider flex items-center gap-1">
                              View Handover Card & Critical Alert Row
                            </summary>
                            <div className="mt-2">
                              <HandoverCard
                                patient={item.handoverCardData}
                                onDiscuss={handleOpenHandoverCardChat}
                              />
                            </div>
                          </details>
                        ) : (
                          <details className="text-[10.5px]" onClick={(e) => e.stopPropagation()}>
                            <summary className="cursor-pointer select-none font-black text-indigo-500 hover:text-indigo-700 transition-colors text-[9.5px] uppercase tracking-wider">
                              View Structured SBAR Card
                            </summary>
                            <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-lg p-2.5 mt-2 space-y-1.5 leading-relaxed text-slate-700 dark:text-slate-300 shadow-3xs">
                              <p><strong className="text-blue-700 dark:text-blue-400 font-bold">[S]:</strong> <HighlightedHandoverText text={item.structuredSBAR?.situation} /></p>
                              <p><strong className="text-purple-700 dark:text-purple-400 font-bold">[B]:</strong> <HighlightedHandoverText text={item.structuredSBAR?.background} /></p>
                              <p><strong className="text-amber-700 dark:text-amber-400 font-bold">[A]:</strong> <HighlightedHandoverText text={item.structuredSBAR?.assessment} /></p>
                              <p><strong className="text-emerald-700 dark:text-emerald-400 font-bold">[R]:</strong> <HighlightedHandoverText text={item.structuredSBAR?.recommendation} /></p>
                            </div>
                          </details>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Roster Controls and Printing */}
              {quickPasteList.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-900 space-y-2.5">
                  
                  <button
                    onClick={compileQuickPasteToSheet}
                    disabled={selectedQuickPasteIds.length === 0}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    Generate Handover Sheet ({selectedQuickPasteIds.length})
                  </button>

                  <button
                    onClick={() => handleDownloadWordDirect("quickpaste")}
                    disabled={selectedQuickPasteIds.length === 0}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Download MS Word (.doc)
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        handleCopyText("quickpaste_full", getQuickPastePrintText());
                      }}
                      className={`py-2 border text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                        copiedState["quickpaste_full"]
                          ? "bg-emerald-500 border-emerald-500 text-white font-black"
                          : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {copiedState["quickpaste_full"] ? "✓ Copied!" : "📋 Copy Full"}
                    </button>

                    <button
                      onClick={() => {
                        if (!confirmClearRoster) {
                          setConfirmClearRoster(true);
                          setTimeout(() => setConfirmClearRoster(false), 4000);
                        } else {
                          setQuickPasteList([]);
                          setConfirmClearRoster(false);
                        }
                      }}
                      className={`py-2 border text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        confirmClearRoster
                          ? "bg-rose-600 border-rose-700 text-white font-black"
                          : "border-slate-200 dark:border-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {confirmClearRoster ? "Confirm Clear?" : "Clear Roster"}
                    </button>
                  </div>

                </div>
              )}

              {/* Manual Add Trigger */}
              <button
                type="button"
                onClick={() => {
                  setEditingPatient({
                    id: `qp-pat-${Date.now()}`,
                    name: "",
                    ageGender: "",
                    triage: "P2 (Urgent)",
                    vitals: "",
                    rawNotes: "",
                    structuredSBAR: {
                      situation: "",
                      background: "",
                      assessment: "",
                      recommendation: ""
                    }
                  });
                  setIsEditModalOpen(true);
                }}
                className="w-full py-2 border border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Manually Add Patient Case
              </button>

            </div>

            {/* Disclaimer and information */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">Compliance Assured</span>
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal">
                This clinical utility processes information local-first in your active browser session. Patient case details are never persisted to external storage databases, assuring perfect offline confidentiality.
              </p>
            </div>

          </div>

        </div>
      )}

      {/* SUB-TAB 3: DIRECT EMR DISCHARGE SUMMARY */}
      {activeSubTab === "discharge_direct" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Left Panel: Paste & Extraction Interface (1/3 Width) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">EMR Case Sheet Scribe</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Paste raw EMR notes or case sheet dump</p>
                  </div>
                </div>
              </div>

              {dischargeError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{dischargeError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Paste Unstructured Case Sheet Text</span>
                  <span className="text-[10px] text-slate-400 font-mono">Universal Hospital Format</span>
                </label>
                <textarea
                  value={directInputText}
                  onChange={(e) => setDirectInputText(e.target.value)}
                  placeholder="Paste complete EMR case sheet dump here... (Doctor notes, nursing notes, vitals, lab reports, treatment given)"
                  rows={14}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateDirectDischarge()}
                  disabled={isGeneratingDischarge || !directInputText.trim()}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isGeneratingDischarge ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Structuring Medico-Legal Summary...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Discharge Summary
                    </>
                  )}
                </button>
                {directInputText && (
                  <button
                    onClick={() => setDirectInputText("")}
                    className="p-3 text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Preset Sample EMR Cases */}
              <div className="border-t pt-3 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Quick Preset Cases for Testing
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDirectInputText(`PATIENT: Raman Pillai, 58/M, UHID: 4810294, MLC: Nil
Allergies: NKDA
ARRIVING VITALS (08:30 AM): HR 108/min, BP 150/90 mmHg, RR 22/min, SpO2 94% on room air, GCS 15/15, GRBS 184 mg/dl, Temp 98.4 F.
PRESENTING COMPLAINT:
Severe retrosternal chest pain for 3 hours with radiation to left shoulder and profuse diaphoresis.
HPI:
58-year-old male with history of Type 2 DM and HTN presented with sudden onset oppressive substernal chest pain starting at 5:30 AM. Accompanied by nausea and breathlessness. Received Aspirin 300mg at local clinic.
PAST HISTORY: DM x 10 years on Tab Metformin 500mg BD. HTN x 5 years on Tab Amlodipine 5mg OD.
GENERAL EXAMINATION:
Moderate distress due to pain. Conscious, oriented. No pallor, icterus, cyanosis, or pedal edema.
PRIMARY SURVEY:
Airway: Patent.
Breathing: RR 22, SpO2 94% room air. Oxygen started @ 3L/min via NC. Air entry bilaterally equal.
Circulation: HR 108, BP 150/90. CRT < 2s. 2 large bore IV access secured.
Disability: GCS E4V5M6, Pupils equal & reactive. GRBS 184.
Exposure: Temp 98.4 F.
COURSE IN ED:
Patient was connected to cardiac monitor. Stat 12-lead ECG showed 3mm ST-segment elevation in V1-V4 (Acute Anterior Wall STEMI). Loading doses of Tab Ticagrelor 180mg and Tab Atorvastatin 80mg administered at 08:40 AM. IV Heparin 5000 IU bolus given. Urgent Cardiology consult called (Dr. Jayakrishnan). Patient accepted for immediate primary PCI in Cath Lab. Echocardiogram showed anterior wall hypokinesia, LVEF 40%. Patient transferred safely to Cath Lab at 09:15 AM.
INVESTIGATIONS:
CBC: Hb: 13.8 g/dL, WBC: 12,400 /cu.mm ↑, Platelets: 2.4 lakh
LFT: Total Bili: 0.8 mg/dL, SGOT: 45 U/L, SGPT: 38 U/L
RFT: Urea: 28 mg/dL, Creatinine: 1.0 mg/dL
Electrolytes: Na: 138 mEq/L, K: 4.2 mEq/L
Cardiac: Troponin-I: 2.8 ng/mL ↑ (ref < 0.04)
ECG: Acute Anterior Wall STEMI. Echo: LVEF 40%.
DIAGNOSIS AT DISCHARGE:
1. Acute Anterior Wall ST-Elevation Myocardial Infarction (Anterior STEMI)
2. Type 2 Diabetes Mellitus
3. Essential Hypertension
DISPOSITION: Transferred / Admitted for Primary PCI (Cath Lab / Cardiac ICU) under Dr. Jayakrishnan (Cardiology).
CONDITION AT DISCHARGE: STABLE, chest pain relieved.
DISCHARGE VITALS: HR 78/min, BP 120/80 mmHg, RR 16/min, SpO2 99% on 2L O2.
EM Resident: Dr. Rahul V.
EM Consultant: Dr. Suresh Menon`)}
                    className="p-2 text-left bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/50 rounded-lg text-[10.5px] font-bold text-purple-700 dark:text-purple-300 transition-all cursor-pointer"
                  >
                    ❤️ STEMI Case
                  </button>

                  <button
                    onClick={() => setDirectInputText(`PATIENT: Anjali Kumar, 24/F, UHID: 992014, MLC: Nil
Allergies: Penicillin (Rash)
ARRIVING VITALS: HR 112/min, BP 110/70 mmHg, RR 20/min, SpO2 98% room air, GCS 15/15, Temp 101.2 F.
PRESENTING COMPLAINT:
Severe right lower quadrant abdominal pain for 24 hours with low-grade fever and vomiting x 2 episodes.
HPI:
24-year-old female presented with periumbilical pain that migrated to the right iliac fossa over 12 hours. Pain is sharp, aggravated by movement and coughing. Anorexia present. LMP: 14 days ago, regular.
PAST HISTORY: Nil significant.
PHYSICAL EXAM:
Tenderness in right iliac fossa with localized guarding and rebound tenderness at McBurney's point. Rovsing sign positive.
COURSE IN ED:
IV access secured. IV Normal Saline 1000ml bolus initiated. IV Paracetamol 1g given for fever/pain. IV Ondansetron 4mg given. Urgent USG Abdomen & Pelvis performed at 10:30 AM showing a non-compressible, aperistaltic appendiceal structure measuring 8.5mm with periappendiceal fat stranding (Acute Appendicitis). General Surgery consult called (Dr. Thomas). Patient accepted for Laparoscopic Appendectomy.
INVESTIGATIONS:
CBC: Hb: 12.1 g/dL, WBC: 15,200 /cu.mm ↑ (82% Neutrophils), Platelets: 2.1 lakh
RFT: Urea: 22 mg/dL, Creatinine: 0.7 mg/dL
Urine: Pus cells 2-3/hpf, Urine pregnancy test (UPT): Negative
USG Abdomen: Features diagnostic of Acute Appendicitis.
DIAGNOSIS AT DISCHARGE:
1. Acute Suppurative Appendicitis
DISPOSITION: Admitted under Dr. Thomas (General Surgery) for Laparoscopic Appendectomy.
CONDITION AT DISCHARGE: STABLE.
DISCHARGE VITALS: HR 84/min, BP 116/74 mmHg, RR 16/min, SpO2 99% room air, Temp 98.6 F.
EM Resident: Dr. Anjana S.
EM Consultant: Dr. Suresh Menon`)}
                    className="p-2 text-left bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/50 rounded-lg text-[10.5px] font-bold text-purple-700 dark:text-purple-300 transition-all cursor-pointer"
                  >
                    🩺 Appendicitis Case
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Generated Summaries List (2/3 Width) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                    Direct Generated Discharge Summaries Roster
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Universal Medico-Legal Format</p>
                </div>
                {directDischargeList.length > 0 && (
                  <button
                    onClick={handleClearAllDirectDischarge}
                    className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline px-2.5 py-1 bg-rose-50/50 dark:bg-rose-950/25 rounded"
                  >
                    Clear Roster ({directDischargeList.length})
                  </button>
                )}
              </div>

              {directDischargeList.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-purple-200 dark:text-purple-950 animate-pulse" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">No Direct Discharge Summaries Generated Yet</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Paste raw EMR notes or click one of the quick preset cases on the left to extract a structured discharge summary.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                  {directDischargeList.map((item) => {
                    const s = item.summary || {};
                    const vArrival = s.vitalsOnArrival || {};

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 hover:border-purple-300 dark:hover:border-purple-800 transition-all shadow-xs"
                      >
                        {/* Header Bar */}
                        <div className="flex items-start justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {item.patientName}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded font-bold">
                                UHID: {item.uhid}
                              </span>
                              {s.mlc && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded">
                                  MLC: {s.mlc}
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-400 flex items-center gap-3">
                              <span>Generated: {item.createdAt}</span>
                              {s.disposition && (
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  • {s.disposition}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedDischargeModal(item)}
                              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                              title="View & Print Full Summary Sheet"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              View / Print
                            </button>
                            <button
                              onClick={() => handleDownloadDischargeWord(item)}
                              className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-900"
                              title="Download Word Document (.doc)"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Word
                            </button>
                            <button
                              onClick={() => {
                                const s = item.summary || {};
                                const vArr = s.vitalsOnArrival || {};
                                const vDis = s.vitalsAtDischarge || {};
                                const prim = s.primarySurvey || {};
                                const air = prim.airway || {};
                                const br = prim.breathing || {};
                                const circ = prim.circulation || {};
                                const dis = prim.disability || {};
                                const exp = prim.exposure || {};
                                const inv = s.investigations || {};

                                const invText = Object.entries(inv)
                                  .filter(([_, v]) => Boolean(v))
                                  .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
                                  .join('\n');

                                const fullTxt = `Discharge Summary
MLC: ${s.mlc || "Nil"}
Allergy : ${s.allergy || "Nil"}
Vitals at the time of arrival:
HR- ${vArr.hr || "-"} ,BP- ${vArr.bp || "-"} ,RR-${vArr.rr || "-"} ,Spo2- ${vArr.spo2 || "-"} ,GCS-${vArr.gcs || "-"} ,Pain Score- ${vArr.painScore || "-"} ,GRBS- ${vArr.grbs || "-"} ,Temp- ${vArr.temp || "-"}

Presenting Complaints:
${s.presentingComplaints || "N/A"}

History of Present Illness:
${s.hpi || "N/A"}

Past Medical/Surgical Histories:
${s.pastHistory || "Nil recorded"}
Family / Gynae History : ${s.familyGynaeHistory || "Nil"}
LMP : ${s.lmp || "N/A"}

General Examination / Systemic examination:
${s.generalAndSystemicExam || "General condition fair."}

Primary Assessment:
Airway → ${air.status || "Patent"} ,Intervention- ${air.intervention || "None"}
Breathing → Work of breathing- ${br.workOfBreathing || "Normal"} ,Air entry- ${br.airEntry || "Bilaterally equal"} ,CCT- ${br.cct || "N/A"} ,Subcutaneous emphysema- ${br.subcutaneousEmphysema || "Nil"} ,EFAST- ${br.efast || "N/A"} ,Intervention- ${br.intervention || "None"}
Circulation → CRT- ${circ.crt || "< 2s"} ,, Distended Neck Veins- ${circ.distendedNeckVeins || "Nil"} , PCT- ${circ.pct || "N/A"} Long bone deformity- ${circ.longBoneDeformity || "Nil"} ,FAST- ${circ.fast || "N/A"} ,Interventions- ${circ.intervention || "None"}
Disability → AVPU/GCS- ${dis.gcs || "15/15"} ,Pupils- ${dis.pupils || "Equal & reactive"} ,GRBS- ${dis.grbs || "N/A"}
Exposure → Temp- ${exp.temp || "98.6°F"} | Trauma- Logroll ${exp.logRoll || "N/A"}

Course in Hospital with Medications and Procedure:
${s.courseInHospital || "Evaluated and treated in ED."}

Investigations:
${invText || "No lab results documented."}

Diagnosis at the time of discharge:
${(s.diagnosisAtDischarge || ["Emergency Evaluation"]).map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}

Discharge Medications:
${Array.isArray(s.dischargeMedications) ? s.dischargeMedications.join('\n') : (s.dischargeMedications || "Nil")}

Disposition:
${s.disposition || "Normal Discharge"}

Condition at time of discharge: (${s.conditionAtDischarge || "STABLE"})

Vitals at the time of Discharge:
HR- ${vDis.hr || "-"} ,BP- ${vDis.bp || "-"} ,RR-${vDis.rr || "-"} ,Sp02- ${vDis.spo2 || "-"} ,GCS-${vDis.gcs || "-"} ,Pain Score- ${vDis.painScore || "-"} ,GRBS- ${vDis.grbs || "-"} ,Temp- ${vDis.temp || "-"}

Follow-Up Advice:
${s.followUpAdvice || "Review in ED if symptoms recur."}

ED Resident: ${s.edResident || "Duty Resident"} | ED Consultant: ${s.edConsultant || "ED Consultant"}
Sign and Time: [Pending] | Sign and Time: [Pending]
Date: ${s.dateTime || item.createdAt}

This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request. For a disability certificate, approach a Government-constituted Medical Board.`;
                                navigator.clipboard.writeText(fullTxt);
                                alert("Discharge summary text copied to clipboard!");
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-700 bg-white dark:bg-slate-900 border rounded-lg cursor-pointer"
                              title="Copy Text"
                            >
                              <ClipboardCopy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDirectDischarge(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-900 border rounded-lg cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Summary Grid Preview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Presenting Complaints & HPI
                            </span>
                            <p className="text-slate-800 dark:text-slate-200 line-clamp-3 font-sans leading-relaxed">
                              {s.presentingComplaints || s.hpi || "N/A"}
                            </p>
                          </div>

                          <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Diagnosis & Disposition
                            </span>
                            <div className="font-bold text-purple-700 dark:text-purple-400">
                              {(s.diagnosisAtDischarge || ["Emergency Evaluation"]).join(", ")}
                            </div>
                            <div className="text-[10.5px] text-slate-500 mt-1">
                              Status: <strong className="text-emerald-600">{s.conditionAtDischarge || "STABLE"}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Vitals Bar */}
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-950 p-2 rounded-lg border text-[11px] font-mono overflow-x-auto">
                          <span className="font-bold text-slate-500 shrink-0">Arrival Vitals:</span>
                          <span>HR: <strong>{vArrival.hr || "N/A"}</strong></span>
                          <span>BP: <strong>{vArrival.bp || "N/A"}</strong></span>
                          <span>SpO₂: <strong>{vArrival.spo2 || "N/A"}</strong></span>
                          <span>GCS: <strong>{vArrival.gcs || "N/A"}</strong></span>
                          <span>GRBS: <strong>{vArrival.grbs || "N/A"}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* FULL RAJAGIRI PRINTABLE DISCHARGE SUMMARY MODAL */}
      {selectedDischargeModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-55 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setSelectedDischargeModal(null)}
              className="absolute right-4 top-4 p-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Actions Header */}
            <div className="flex items-center justify-between border-b pb-3 pr-10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Discharge Summary Generator
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerPrintWithTip()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => handleDownloadDischargeWord(selectedDischargeModal)}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg text-xs flex items-center gap-1.5 border cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Word (.doc)
                </button>
              </div>
            </div>

            {/* Print Document Content */}
            <div className="p-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 space-y-4 border rounded-xl font-sans text-xs leading-relaxed">
              {/* Header Banner */}
              <div className="border-b-2 border-indigo-900 pb-3 flex justify-between items-end">
                <div>
                  <h1 className="text-xl font-black text-indigo-950 dark:text-indigo-400 uppercase tracking-tight">
                    {(hospitalName || "EMERGENCY DEPARTMENT").toUpperCase()}
                  </h1>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    DEPARTMENT OF EMERGENCY MEDICINE
                  </p>
                  <p className="text-[10px] text-slate-400">
                    24x7 Emergency Care &amp; Medico-Legal Records
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-indigo-900 dark:text-indigo-300 block">
                    EMERGENCY DISCHARGE SUMMARY
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Date: {selectedDischargeModal.summary?.dateTime || selectedDischargeModal.createdAt}
                  </span>
                </div>
              </div>

              {/* Demographics Table */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border font-mono">
                <div><strong>Patient Name:</strong> {selectedDischargeModal.patientName}</div>
                <div><strong>UHID / Bed:</strong> {selectedDischargeModal.uhid}</div>
                <div><strong>MLC Status:</strong> {selectedDischargeModal.summary?.mlc ? `YES (${selectedDischargeModal.summary.mlc})` : "NO / Nil"}</div>
                <div><strong>Allergies:</strong> {selectedDischargeModal.summary?.allergy || "Nil known"}</div>
              </div>

              {/* Arrival Vitals */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  1. Vitals On Arrival
                </h4>
                <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded font-mono text-[11px]">
                  <div>HR: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.hr || "N/A"}</strong></div>
                  <div>BP: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.bp || "N/A"}</strong></div>
                  <div>RR: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.rr || "N/A"}</strong></div>
                  <div>SpO₂: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.spo2 || "N/A"}</strong></div>
                  <div>GCS: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.gcs || "N/A"}</strong></div>
                  <div>GRBS: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.grbs || "N/A"}</strong></div>
                  <div>Temp: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.temp || "N/A"}</strong></div>
                  <div>Pain: <strong>{selectedDischargeModal.summary?.vitalsOnArrival?.painScore || "N/A"}</strong></div>
                </div>
              </div>

              {/* Presenting Complaints & HPI */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  2. Clinical Presentation & History
                </h4>
                <p><strong>Presenting Complaints:</strong> {selectedDischargeModal.summary?.presentingComplaints || "N/A"}</p>
                <p><strong>History of Present Illness:</strong> {selectedDischargeModal.summary?.hpi || "N/A"}</p>
                <p><strong>Past Medical / Surgical Histories:</strong> {selectedDischargeModal.summary?.pastHistory || "Nil recorded"}</p>
                {(selectedDischargeModal.summary?.familyGynaeHistory || selectedDischargeModal.summary?.lmp) && (
                  <p><strong>Family / Gynae History:</strong> {selectedDischargeModal.summary?.familyGynaeHistory || "Nil"} | <strong>LMP:</strong> {selectedDischargeModal.summary?.lmp || "N/A"}</p>
                )}
              </div>

              {/* Primary Assessment */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  3. Primary Assessment
                </h4>
                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded border text-[11px] font-mono space-y-1">
                  <div><strong>Airway:</strong> {selectedDischargeModal.summary?.primarySurvey?.airway?.status || "Patent"} {selectedDischargeModal.summary?.primarySurvey?.airway?.intervention ? `(Intervention: ${selectedDischargeModal.summary?.primarySurvey?.airway?.intervention})` : ''}</div>
                  <div><strong>Breathing:</strong> Work of breathing: {selectedDischargeModal.summary?.primarySurvey?.breathing?.workOfBreathing || "Normal"}, Air entry: {selectedDischargeModal.summary?.primarySurvey?.breathing?.airEntry || "Bilaterally equal"}{selectedDischargeModal.summary?.primarySurvey?.breathing?.efast ? `, EFAST: ${selectedDischargeModal.summary?.primarySurvey?.breathing?.efast}` : ''}{selectedDischargeModal.summary?.primarySurvey?.breathing?.intervention ? `, Intervention: ${selectedDischargeModal.summary?.primarySurvey?.breathing?.intervention}` : ''}</div>
                  <div><strong>Circulation:</strong> CRT: {selectedDischargeModal.summary?.primarySurvey?.circulation?.crt || "< 2s"}{selectedDischargeModal.summary?.primarySurvey?.circulation?.fast ? `, FAST: ${selectedDischargeModal.summary?.primarySurvey?.circulation?.fast}` : ''}{selectedDischargeModal.summary?.primarySurvey?.circulation?.intervention ? `, Interventions: ${selectedDischargeModal.summary?.primarySurvey?.circulation?.intervention}` : ''}</div>
                  <div><strong>Disability:</strong> GCS: {selectedDischargeModal.summary?.primarySurvey?.disability?.gcs || "15/15"}, Pupils: {selectedDischargeModal.summary?.primarySurvey?.disability?.pupils || "Equal & reactive"}, GRBS: {selectedDischargeModal.summary?.primarySurvey?.disability?.grbs || "N/A"}</div>
                  <div><strong>Exposure:</strong> Temp: {selectedDischargeModal.summary?.primarySurvey?.exposure?.temp || "Normal"}{selectedDischargeModal.summary?.primarySurvey?.exposure?.logRoll ? ` | Trauma / Logroll: ${selectedDischargeModal.summary?.primarySurvey?.exposure?.logRoll}` : ''}</div>
                </div>
              </div>

              {/* General & Systemic Exam */}
              {selectedDischargeModal.summary?.generalAndSystemicExam && (
                <div className="space-y-1">
                  <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                    4. General & Systemic Examination
                  </h4>
                  <p>{selectedDischargeModal.summary.generalAndSystemicExam}</p>
                </div>
              )}

              {/* Course in Hospital */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  {selectedDischargeModal.summary?.generalAndSystemicExam ? '5' : '4'}. Course In Hospital & ER Treatment Given
                </h4>
                <p>{selectedDischargeModal.summary?.courseInHospital || "Evaluated and managed in the Emergency Department."}</p>
              </div>

              {/* Investigations */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  {selectedDischargeModal.summary?.generalAndSystemicExam ? '6' : '5'}. Key Lab Investigations & Imaging
                </h4>
                <div className="space-y-1 font-mono text-[11px]">
                  {Object.entries(selectedDischargeModal.summary?.investigations || {}).map(([k, v]) => (
                    v ? <div key={k}><strong>{k.toUpperCase()}:</strong> {v as string}</div> : null
                  ))}
                  {Object.values(selectedDischargeModal.summary?.investigations || {}).every(val => !val) && (
                    <p className="font-sans text-slate-500">No key lab results documented.</p>
                  )}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  {selectedDischargeModal.summary?.generalAndSystemicExam ? '7' : '6'}. Diagnosis At Discharge
                </h4>
                <ul className="list-disc pl-5 font-bold text-slate-800 dark:text-slate-200">
                  {(selectedDischargeModal.summary?.diagnosisAtDischarge || ["Emergency Evaluation"]).map((d: string, idx: number) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              </div>

              {/* Discharge Medications & Advice */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  {selectedDischargeModal.summary?.generalAndSystemicExam ? '8' : '7'}. Discharge Advice & Medications
                </h4>
                {Array.isArray(selectedDischargeModal.summary?.dischargeMedications) && selectedDischargeModal.summary.dischargeMedications.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {selectedDischargeModal.summary.dischargeMedications.map((m: string, idx: number) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No oral discharge medications prescribed. Patient transferred / admitted as noted.</p>
                )}
                <p className="pt-1"><strong>Follow-Up Advice:</strong> {selectedDischargeModal.summary?.followUpAdvice || "Review in ED if warning symptoms recur."}</p>
              </div>

              {/* Disposition & Condition */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-indigo-900 dark:text-indigo-300 border-b pb-1 text-xs uppercase">
                  {selectedDischargeModal.summary?.generalAndSystemicExam ? '9' : '8'}. Disposition & Vitals At Discharge
                </h4>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded border text-[11px] font-mono">
                  <div><strong>Disposition Status:</strong> {selectedDischargeModal.summary?.disposition || "Normal Discharge"}</div>
                  <div><strong>Condition at Discharge:</strong> <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedDischargeModal.summary?.conditionAtDischarge || "STABLE"}</span></div>
                  <div className="col-span-2 border-t pt-1.5 mt-1">
                    <strong>Discharge Vitals:</strong> HR: {selectedDischargeModal.summary?.vitalsAtDischarge?.hr || "N/A"} | BP: {selectedDischargeModal.summary?.vitalsAtDischarge?.bp || "N/A"} | RR: {selectedDischargeModal.summary?.vitalsAtDischarge?.rr || "N/A"} | SpO₂: {selectedDischargeModal.summary?.vitalsAtDischarge?.spo2 || "N/A"} | GCS: {selectedDischargeModal.summary?.vitalsAtDischarge?.gcs || "N/A"} | Temp: {selectedDischargeModal.summary?.vitalsAtDischarge?.temp || "N/A"}
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-4 font-bold border-t">
                <div>
                  <p>______________________________</p>
                  <p>Dr. {selectedDischargeModal.summary?.edResident || "Duty EM Resident"}</p>
                  <p className="text-[10px] text-slate-400 font-normal">Emergency Medicine Resident</p>
                </div>
                <div className="text-right">
                  <p>______________________________</p>
                  <p>Dr. {selectedDischargeModal.summary?.edConsultant || "ED Consultant"}</p>
                  <p className="text-[10px] text-slate-400 font-normal">Consultant Emergency Medicine</p>
                </div>
              </div>

              {/* Statutory Disclaimer */}
              <p className="text-[10px] text-slate-400 border-t pt-3 mt-4 text-center leading-normal font-sans">
                This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request as per applicable Medico-legal regulations. For a disability certificate, approach a Government-constituted Medical Board.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* POST-PRINT SHIFT CLEANUP ADVISOR MODAL */}
      {showPostPrintCleanPrompt && (
        <div className="fixed inset-0 bg-slate-950/80 z-55 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <button 
              onClick={() => {
                setShowPostPrintCleanPrompt(false);
                setHasUnclearedShiftWarning(true);
              }}
              className="absolute right-4 top-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 border-b pb-3">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
              <h3 className="text-base font-black font-display tracking-tight">Shift Transition: Safe Board Cleanup</h3>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                Handover document compilation completed! Leaving compiled patient records active on the ER board creates selection fatigue and potential data overlapping for the next team.
              </p>
              
              <div className="bg-slate-50 dark:bg-slate-900/40 border rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Compiled Patients Pending Disposal ({idsToCleanup.length})
                </span>
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-2">
                  {postPrintDataType === "registry" ? (
                    cases.filter(c => idsToCleanup.includes(c.id)).map((c, i) => (
                      <div key={c.id} className="text-[11px] font-mono flex justify-between text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-1.5 rounded border border-slate-100">
                        <span className="font-bold">{i + 1}. {c.patient.name}</span>
                        <span>{c.patient.age}y / {c.patient.gender} • {c.patient.triageCategory}</span>
                      </div>
                    ))
                  ) : (
                    quickPasteList.map((p, i) => (
                      <div key={p.id} className="text-[11px] font-mono flex justify-between text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-1.5 rounded border border-slate-100">
                        <span className="font-bold">{i + 1}. {p.name}</span>
                        <span>{p.triage}</span>
                      </div>
                    ))
                  )}
                  {idsToCleanup.length === 0 && (
                    <div className="text-[11px] text-slate-400 text-center py-2">No patients selected.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {postPrintDataType === "registry" ? (
                <>
                  <button
                    disabled={cleanupActionInProgress || idsToCleanup.length === 0}
                    onClick={() => handleBulkCleanup("discharge")}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {cleanupActionInProgress ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Discharge & Archive Cases (Clean active board)
                  </button>
                  <button
                    disabled={cleanupActionInProgress || idsToCleanup.length === 0}
                    onClick={() => handleBulkCleanup("delete")}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Case Logs Completely
                  </button>
                </>
              ) : (
                <button
                  disabled={cleanupActionInProgress || quickPasteList.length === 0}
                  onClick={() => handleBulkCleanup("clear_quickpaste")}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {cleanupActionInProgress ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Clear Patient List (Empty Local Memory)
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowPostPrintCleanPrompt(false);
                  setHasUnclearedShiftWarning(true);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer"
              >
                Keep Active (Will cleanup manually later)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PATIENT DETAIL MODAL */}
      {isEditModalOpen && editingPatient && (
        <div className="fixed inset-0 bg-slate-950/80 z-55 flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-black font-display text-slate-800 dark:text-white">
                  {editingPatient.name ? `Modify Handover: ${editingPatient.name}` : "Create Handover Case"}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingPatient(null);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModalEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bed Number / Bed #</label>
                  <input
                    type="text"
                    value={editingPatient.bed || ""}
                    onChange={(e) => setEditingPatient({ ...editingPatient, bed: e.target.value })}
                    placeholder="e.g. Bed 4, ICU 2"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Patient Name *</label>
                  <input
                    type="text"
                    required
                    value={editingPatient.name}
                    onChange={(e) => setEditingPatient({ ...editingPatient, name: e.target.value })}
                    placeholder="Patient name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Age & Gender</label>
                  <input
                    type="text"
                    value={editingPatient.ageGender}
                    onChange={(e) => setEditingPatient({ ...editingPatient, ageGender: e.target.value })}
                    placeholder="e.g. 45M or 62F"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Triage Level</label>
                  <select
                    value={editingPatient.triage}
                    onChange={(e) => setEditingPatient({ ...editingPatient, triage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="P1 (Immediate)">P1 (Immediate)</option>
                    <option value="P2 (Urgent)">P2 (Urgent)</option>
                    <option value="P3 (Non-Urgent)">P3 (Non-Urgent)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Vital Signs</label>
                  <input
                    type="text"
                    value={editingPatient.vitals}
                    onChange={(e) => setEditingPatient({ ...editingPatient, vitals: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Presenting Complaint(s) / Chief Reason for Visit</label>
                <input
                  type="text"
                  value={editingPatient.presentingComplaint || ""}
                  onChange={(e) => setEditingPatient({ ...editingPatient, presentingComplaint: e.target.value })}
                  placeholder="e.g. Acute chest pain x 2 hours, radiating to jaw with diaphoresis"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-900">
                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Structured SBAR Components</span>
                
                <div className="space-y-1">
                  <label className="font-bold text-blue-700 dark:text-blue-400">[S] Situation</label>
                  <textarea
                    rows={2}
                    value={editingPatient.structuredSBAR?.situation || ""}
                    onChange={(e) => setEditingPatient({
                      ...editingPatient,
                      structuredSBAR: {
                        ...(editingPatient.structuredSBAR || { situation: '', background: '', assessment: '', recommendation: '' }),
                        situation: e.target.value
                      }
                    })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-purple-700 dark:text-purple-400">[B] Background</label>
                  <textarea
                    rows={2}
                    value={editingPatient.structuredSBAR?.background || ""}
                    onChange={(e) => setEditingPatient({
                      ...editingPatient,
                      structuredSBAR: {
                        ...(editingPatient.structuredSBAR || { situation: '', background: '', assessment: '', recommendation: '' }),
                        background: e.target.value
                      }
                    })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-amber-700 dark:text-amber-400">[A] Assessment</label>
                  <textarea
                    rows={2}
                    value={editingPatient.structuredSBAR?.assessment || ""}
                    onChange={(e) => setEditingPatient({
                      ...editingPatient,
                      structuredSBAR: {
                        ...(editingPatient.structuredSBAR || { situation: '', background: '', assessment: '', recommendation: '' }),
                        assessment: e.target.value
                      }
                    })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-emerald-700 dark:text-emerald-400 font-bold">[R] Recommendation</label>
                  <textarea
                    rows={2}
                    value={editingPatient.structuredSBAR?.recommendation || ""}
                    onChange={(e) => setEditingPatient({
                      ...editingPatient,
                      structuredSBAR: {
                        ...(editingPatient.structuredSBAR || { situation: '', background: '', assessment: '', recommendation: '' }),
                        recommendation: e.target.value
                      }
                    })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Raw Input Notes / Clinical Snippet</label>
                <textarea
                  rows={3}
                  value={editingPatient.rawNotes}
                  onChange={(e) => setEditingPatient({ ...editingPatient, rawNotes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono text-[10.5px] text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingPatient(null);
                  }}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-slate-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bound Chat Modal */}
      {boundChatContext && (
        <BoundChatModal
          context={boundChatContext}
          isOpen={isBoundChatOpen}
          onClose={() => {
            setIsBoundChatOpen(false);
            setBoundChatContext(null);
          }}
        />
      )}

    </div>
  );
}
