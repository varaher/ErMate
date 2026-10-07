import React, { useState, useEffect, useRef } from 'react';
import VoiceRecorder from './shared/VoiceRecorder';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Check,
  RefreshCw,
  Activity,
  HeartPulse,
  Stethoscope,
  Pill,
  Microscope,
  Clock,
  AlertTriangle,
  FileText,
  UserCheck
} from 'lucide-react';
import { useBoundChat, ChatContext, ChatMessage } from '../hooks/useBoundChat';
import { getDisplayCaseId } from '../utils/caseIdentity';

export interface CaseDiscussWorkspaceProps {
  context: ChatContext;
  activeContexts?: ChatContext[];
  onSelectContext?: (ctx: ChatContext) => void;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const CaseDiscussWorkspace: React.FC<CaseDiscussWorkspaceProps> = ({
  context,
  activeContexts,
  onSelectContext,
  isOpen,
  onClose,
  title
}) => {
  const {
    messages,
    loading,
    sending,
    pendingUpdates,
    bannerNotice,
    sendMessage,
    applyUpdate,
    dismissUpdate
  } = useBoundChat(context);

  const [inputText, setInputText] = useState('');
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setIsSelectorOpen(false);
      }
    };
    if (isSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSelectorOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isOpen) return null;

  const handleSend = () => {
    if (!inputText.trim() || sending) return;
    const text = inputText;
    setInputText('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const d = context.data || {};
  const pending = context.pendingClinicalContext || {};
  const bed = d.bedNo || d.patient?.bed || 'Unassigned';
  const displayId = getDisplayCaseId(d);
  const age = d.patient?.age ?? pending?.patient?.age;
  const rawGender = d.patient?.gender ?? pending?.patient?.gender;
  const gender = rawGender ? (rawGender.toUpperCase().startsWith('M') ? 'M' : rawGender.toUpperCase().startsWith('F') ? 'F' : 'O') : '';
  const ageGender = [age !== undefined && age !== null ? `${age}` : '', gender].filter(Boolean).join(' ');
  const presentingComplaint = d.patient?.presentingComplaint || d.chiefComplaint || pending?.presentingComplaint || 'Emergency presentation';
  const triageCategory = d.patient?.triageCategory || 'P2 (Urgent)';
  const provisionalDx = d.dischargeInfo?.primaryDiagnosis || d.provisionalPrimaryDiagnosis || d.diagnosis || pending?.provisionalDiagnosis || 'Under evaluation';

  const isPediatric = !!d.isPediatric || (typeof age === 'number' && age <= 16);
  const peds = d.pediatricDetails || {};

  // Quick Prompt Chips
  const quickPrompts = [
    'What are top 3 differentials?',
    'Suggest next diagnostic workup',
    'Review drug doses & interactions',
    'Check ECG & lab findings',
    'Summarize patient for consultant review',
    'What red flags should I watch for?'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col w-screen h-screen overflow-hidden animate-fade-in font-sans">
      <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 max-w-5xl mx-auto shadow-2xl border-x border-slate-200 dark:border-slate-800">
        
        {/* ── TOP BAR ──────────────────────────────────────────────── */}
        <header className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3 shadow-xs">
          {/* Left: Back & Patient Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Back to ER workspace"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-xs font-bold hidden sm:inline">Back</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

            {/* Patient Header & Compact Selector */}
            <div className="relative min-w-0" ref={selectorRef}>
              <button
                type="button"
                onClick={() => activeContexts && activeContexts.length > 1 && setIsSelectorOpen(!isSelectorOpen)}
                disabled={!activeContexts || activeContexts.length <= 1}
                className={`flex items-center gap-2 text-left group rounded-lg px-1.5 py-0.5 -mx-1.5 transition-colors ${
                  activeContexts && activeContexts.length > 1
                    ? 'hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                      {bed !== 'Unassigned' ? `Bed ${bed}` : 'Bed Unassigned'} • {displayId}
                    </span>
                    {activeContexts && activeContexts.length > 1 && (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 shrink-0 transition-transform" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 font-medium">
                    {ageGender && <span>{ageGender}</span>}
                    {ageGender && <span>•</span>}
                    <span className="truncate max-w-[180px] sm:max-w-[280px]">{presentingComplaint}</span>
                    <span>•</span>
                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">{triageCategory}</span>
                  </div>
                </div>
              </button>

              {/* Compact Active Cases Dropdown Selector */}
              {isSelectorOpen && activeContexts && activeContexts.length > 1 && (
                <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-scale-in">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 font-mono uppercase tracking-wider flex items-center justify-between">
                    <span>Active Census Cases ({activeContexts.length})</span>
                    <span className="text-[9px] text-indigo-500">Select to Discuss</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {activeContexts.map((ctx) => {
                      const isCurrent = ctx.id === context.id;
                      const cBed = ctx.data?.bedNo || ctx.data?.patient?.bed || 'Unassigned';
                      const cDisplayId = getDisplayCaseId(ctx.data || {});
                      const cAge = ctx.data?.patient?.age;
                      const cSex = ctx.data?.patient?.gender ? (ctx.data.patient.gender.toUpperCase().startsWith('M') ? 'M' : 'F') : '';
                      const cComplaint = ctx.data?.patient?.presentingComplaint || 'Emergency intake';
                      return (
                        <button
                          key={ctx.id}
                          type="button"
                          onClick={() => {
                            setIsSelectorOpen(false);
                            onSelectContext?.(ctx);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{cBed !== 'Unassigned' ? `Bed ${cBed}` : 'Unassigned'}</span>
                              <span className="text-slate-400 font-mono text-[11px]">• {cDisplayId}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {[cAge && cSex ? `${cAge}${cSex}` : '', cComplaint].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Expandable Patient Context Toggle & Close */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsContextExpanded(!isContextExpanded)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isContextExpanded
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Patient Context</span>
              {isContextExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              title="Close discussion"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── EXPANDABLE PATIENT CONTEXT PANEL (READ-ONLY) ─────────────── */}
        {isContextExpanded ? (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 p-4 max-h-[46vh] overflow-y-auto shrink-0 shadow-inner text-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Read-Only Documented Clinical Context
              </span>
              <span className="text-[10px] text-slate-500 font-mono">No edits allowed from discuss panel</span>
            </div>

            {/* Grid of Clinical Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Demographics & Triage */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase">Demographics & Triage</div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Bed: {bed} | Case ID: {displayId}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  {ageGender ? `${ageGender} • ` : ''}Arrival: {d.patient?.arrivalMode || 'Walk-in'} • Type: {d.patient?.caseType || 'Medical'}
                </div>
                <div className="text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[11px]">
                  Triage: {triageCategory}
                </div>
              </div>

              {/* Presenting Complaint & HPI */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase">Chief Complaint & HPI</div>
                <div className="font-semibold text-slate-900 dark:text-white">{presentingComplaint}</div>
                {d.hpi && <p className="text-slate-600 dark:text-slate-300 line-clamp-3 text-[11px]">{d.hpi}</p>}
              </div>

              {/* Vitals on Presentation */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase flex items-center gap-1">
                  <Activity className="w-3 h-3 text-rose-500" /> Vitals on Presentation
                </div>
                <div className="font-mono text-slate-700 dark:text-slate-300 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                  <span>BP: <b className="text-slate-900 dark:text-white">{d.vitals?.bp || 'N/A'}</b></span>
                  <span>HR: <b className="text-slate-900 dark:text-white">{d.vitals?.hr || 'N/A'} bpm</b></span>
                  <span>SpO2: <b className="text-slate-900 dark:text-white">{d.vitals?.spo2 || 'N/A'}%</b></span>
                  <span>RR: <b className="text-slate-900 dark:text-white">{d.vitals?.rr || 'N/A'}/min</b></span>
                  <span>Temp: <b className="text-slate-900 dark:text-white">{d.vitals?.temp || 'N/A'} °F</b></span>
                  <span>GRBS: <b className="text-slate-900 dark:text-white">{d.vitals?.grbs || 'N/A'} mg/dL</b></span>
                  <span>GCS: <b className="text-slate-900 dark:text-white">{d.vitals?.gcs || '15'}</b></span>
                </div>
              </div>

              {/* SAMPLE History */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase">SAMPLE History</div>
                <div className="text-[11px] space-y-0.5 text-slate-600 dark:text-slate-300">
                  <div><b>Symptoms:</b> {d.sampleHistory?.symptoms || 'N/A'}</div>
                  <div><b>Allergies:</b> <span className={d.sampleHistory?.allergies ? 'text-rose-600 font-bold' : ''}>{d.sampleHistory?.allergies || 'NKDA'}</span></div>
                  <div><b>Medications:</b> {d.sampleHistory?.medications || 'None'}</div>
                  <div><b>Past History:</b> {d.sampleHistory?.pastHistory || 'None documented'}</div>
                  <div><b>Events:</b> {d.sampleHistory?.events || 'N/A'}</div>
                </div>
              </div>

              {/* Primary Survey (ABCDE) */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase flex items-center gap-1">
                  <HeartPulse className="w-3 h-3 text-emerald-500" /> Primary Survey (ABCDE)
                </div>
                <div className="text-[11px] space-y-0.5 text-slate-600 dark:text-slate-300 font-mono">
                  <div>Airway: <b>{d.primaryAssessment?.airway || 'Patent'}</b></div>
                  <div>Breathing: <b>{d.primaryAssessment?.breathing || 'Normal'}</b></div>
                  <div>Circulation: <b>{d.primaryAssessment?.circulation || 'Normal'}</b></div>
                  <div>Disability: <b>{d.primaryAssessment?.disability || 'Normal'}</b></div>
                  <div>Exposure: <b>{d.primaryAssessment?.exposure || 'Normal'}</b></div>
                </div>
              </div>

              {/* Focused / Secondary Examination */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase flex items-center gap-1">
                  <Stethoscope className="w-3 h-3 text-indigo-500" /> Secondary Survey / Physical Exam
                </div>
                <div className="text-[11px] space-y-0.5 text-slate-600 dark:text-slate-300">
                  {typeof d.secondaryAssessment === 'string' && d.secondaryAssessment ? (
                    <p>{d.secondaryAssessment}</p>
                  ) : d.secondarySurvey ? (
                    <>
                      {d.secondarySurvey.generalExam && <div><b>General:</b> {d.secondarySurvey.generalExam}</div>}
                      {d.secondarySurvey.chest && <div><b>Chest:</b> {d.secondarySurvey.chest}</div>}
                      {d.secondarySurvey.abdomen && <div><b>Abdomen:</b> {d.secondarySurvey.abdomen}</div>}
                      {d.secondarySurvey.neurological && <div><b>Neuro:</b> {d.secondarySurvey.neurological}</div>}
                      {d.secondarySurvey.extremities && <div><b>Extremities:</b> {d.secondarySurvey.extremities}</div>}
                    </>
                  ) : (
                    <div className="text-slate-400 italic">Within normal limits / not documented</div>
                  )}
                </div>
              </div>

              {/* Investigations & Results */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase flex items-center gap-1">
                  <Microscope className="w-3 h-3 text-amber-500" /> Investigations & Labs
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  {Array.isArray(d.investigations) && d.investigations.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5">
                      {d.investigations.map((i: any, idx: number) => (
                        <li key={idx}>
                          <b>{i.testName || i.name}:</b> {i.result || i.value || 'Ordered'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400 italic">No investigations documented yet</div>
                  )}
                </div>
              </div>

              {/* Treatments & Procedures */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase flex items-center gap-1">
                  <Pill className="w-3 h-3 text-blue-500" /> Treatments & Procedures
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  {Array.isArray(d.treatments) && d.treatments.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5">
                      {d.treatments.map((t: any, idx: number) => (
                        <li key={idx}>
                          {t.drugName || t.name} {t.dose || ''} ({t.route || 'IV'})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400 italic">No treatments recorded yet</div>
                  )}
                  {Array.isArray(d.procedures) && d.procedures.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                      <b>Procedures:</b> {d.procedures.map((p: any) => p.procedureName || p.name).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Provisional Diagnosis & Differentials */}
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 md:col-span-2">
                <div className="text-[10px] font-bold text-slate-400 font-mono uppercase">Working Diagnosis & Differentials</div>
                <div className="font-bold text-slate-900 dark:text-white">
                  Primary: {provisionalDx}
                </div>
                {Array.isArray(d.differentials) && d.differentials.length > 0 && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    <b>Differentials:</b> {d.differentials.map((x: any) => typeof x === 'string' ? x : x.name || x.diagnosis).join(', ')}
                  </div>
                )}
                {d.progressNotes && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                    <b>Progress Notes:</b> {d.progressNotes}
                  </div>
                )}
              </div>

              {/* Pediatric Details (if applicable) */}
              {isPediatric && (
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1 md:col-span-2 text-amber-950 dark:text-amber-200">
                  <div className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Pediatric Assessment & Dosing Parameters
                  </div>
                  <div className="text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>Weight: <b>{peds.patientWeight || peds.weight || 'N/A'} kg</b></div>
                    <div>Tone: <b>{peds.patAppearanceTone || 'N/A'}</b></div>
                    <div>Look: <b>{peds.patAppearanceLookGaze || 'N/A'}</b></div>
                    <div>Cry: <b>{peds.patAppearanceSpeechCry || 'N/A'}</b></div>
                  </div>
                </div>
              )}

              {/* Pending Unapplied Scribe Dictation (if active and unapplied) */}
              {pending && Object.keys(pending).length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/40 p-3 rounded-xl space-y-1 md:col-span-2">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] font-mono uppercase tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Pending Clinician Dictation (Not Yet Applied to Case Sheet)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {pending.presentingComplaint && <span>Complaint: "{pending.presentingComplaint}" · </span>}
                    {pending.vitals && <span>Vitals: BP {pending.vitals.bp || '-'}, HR {pending.vitals.hr || '-'}, SpO2 {pending.vitals.spo2 || '-'} · </span>}
                    {pending.provisionalDiagnosis && <span>Provisional Dx: {pending.provisionalDiagnosis} · </span>}
                    <span className="italic opacity-80">Awaiting confirmation via Preview → Apply</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Collapsed Summary Strip */
          <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Bed {bed}
              </span>
              <span>•</span>
              <span className="font-mono text-slate-500">{displayId}</span>
              <span>•</span>
              {ageGender && <span>{ageGender} •</span>}
              <span className="truncate">{presentingComplaint}</span>
              <span>•</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{triageCategory}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsContextExpanded(true)}
              className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
            >
              [View Full Context ▾]
            </button>
          </div>
        )}

        {/* ── BANNER NOTICE ────────────────────────────────────────── */}
        {bannerNotice && (
          <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold font-mono flex items-center justify-between shrink-0">
            <span>{bannerNotice}</span>
          </div>
        )}

        {/* ── PENDING RECORD UPDATE BANNER ─────────────────────────── */}
        {pendingUpdates && (
          <div className="p-3 bg-gradient-to-r from-indigo-900 to-indigo-950 text-white border-b border-indigo-800 flex items-center justify-between gap-3 shrink-0 shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0 text-xs">
                <span className="font-extrabold text-amber-300 font-mono block text-[11px]">
                  Suggested Record Update
                </span>
                <span className="text-slate-200 truncate block text-[11px]">
                  {Object.keys(pendingUpdates).map((k) => `${k}: ${String(pendingUpdates[k]).slice(0, 40)}`).join(' · ')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => applyUpdate()}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Apply
              </button>
              <button
                type="button"
                onClick={dismissUpdate}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── FULL CHAT HISTORY AREA (GPT-STYLE) ──────────────────── */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-mono font-bold">Loading patient discussion history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400 space-y-2 text-center">
              <Bot className="w-10 h-10 text-indigo-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Discussing {bed !== 'Unassigned' ? `Bed ${bed}` : `Case ${displayId}`}
              </p>
              <p className="text-xs max-w-sm">
                Ask about clinical reasoning, differentials, drug doses, or investigation workup.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 shadow-xs text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none font-medium'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none space-y-2'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                  {msg.suggestedUpdate && (
                    <div className="mt-3 p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 font-mono uppercase">
                          💡 Update Proposed
                        </span>
                        <button
                          type="button"
                          onClick={() => applyUpdate(msg.suggestedUpdate!)}
                          className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-emerald-500"
                        >
                          <Check className="w-3 h-3" /> Apply
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto bg-white dark:bg-slate-900 p-1.5 rounded-md">
                        {JSON.stringify(msg.suggestedUpdate, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div
                    className={`text-[9px] font-mono mt-1 ${
                      msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none w-fit shadow-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>ErMate AI is analyzing record context...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── QUICK PROMPTS CHIPS ─────────────────────────────────── */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 shrink-0">
            Quick Prompts:
          </span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInputText(prompt)}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-lg shrink-0 transition-colors cursor-pointer whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* ── STICKY INPUT BAR ────────────────────────────────────── */}
        <footer className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything about Bed ${bed} • ${displayId}... (Shift+Enter for new line)`}
              rows={2}
              className="flex-1 bg-transparent border-0 focus:outline-none resize-none text-xs sm:text-sm text-slate-900 dark:text-white p-1"
            />

            <div className="flex items-center gap-1.5 shrink-0 pb-1">
              <VoiceRecorder
                renderMode="compact-button"
                onTranscript={(txt) => setInputText((prev) => (prev ? `${prev} ${txt}` : txt))}
              />

              <button
                type="button"
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center mt-1.5 px-1">
            <span className="text-[10px] text-slate-400 font-mono">
              Discuss session auto-saved to Firestore `/chatSessions`
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ErMate Clinical Engine
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CaseDiscussWorkspace;
