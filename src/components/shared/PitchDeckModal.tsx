import React, { useState } from "react";
import { 
  X, ChevronLeft, ChevronRight, Download, Presentation, 
  Maximize2, Minimize2, Check, Copy, ExternalLink 
} from "lucide-react";

interface PitchDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SLIDES_DATA = [
  {
    category: "EMERGENCY MEDICINE AI",
    title: "ErMate",
    subtitle: "The Emergency Medicine AI Operating System & Intelligent EMR",
    body: "Empowering acute care physicians, eliminating documentation fatigue, and safeguarding patient lives with zero-hallucination, privacy-first clinical AI.",
    pillars: [
      { title: "DPDP Act 2023 Compliant", desc: "Local On-The-Fly PHI Scrubbing" },
      { title: "Voice-First Scribe", desc: "Multilingual Acute Dictation" },
      { title: "Zero Fabrication", desc: "Deterministic Clinical Rules" },
      { title: "Offline-Resilient", desc: "Mission-Critical PWA Engine" },
    ]
  },
  {
    category: "THE CLINICAL REALITY",
    title: "The Acute Care Crisis: Burnout, Delays, and Medical Errors",
    cards: [
      {
        num: "45%",
        label: "Shift Time Lost to Documentation",
        detail: "Emergency physicians spend nearly half their 12-hour shifts typing clinical notes into legacy hospital software instead of managing unstable patients at the bedside.",
        color: "text-rose-500"
      },
      {
        num: "70%+",
        label: "Handoff Sentinel Events",
        detail: "Over 70% of fatal diagnostic delays and hospital malpractice claims stem from unstructured, fragmented doctor-to-doctor shift handovers and forgotten pending tests.",
        color: "text-amber-500"
      },
      {
        num: "Zero",
        label: "Usable Mobile Solutions",
        detail: "Legacy enterprise EMRs (Epic, Cerner) are desktop-bound, click-heavy, and unsuited for emergency resuscitations. Doctors resort to insecure consumer apps, risking PHI leaks.",
        color: "text-sky-400"
      }
    ]
  },
  {
    category: "PRODUCT ARCHITECTURE",
    title: "ErMate: Purpose-Built Intelligence for Emergency Medicine",
    features: [
      {
        badge: "VOICE SCRIBE",
        title: "Ambient Clinical Scribe",
        desc: "Instant bedside dictation parsing unstructured speech into Primary Survey (ABCDE), SAMPLE history, vitals, and 6-system physical examinations in seconds."
      },
      {
        badge: "HANDOVER BOARD",
        title: "Dynamic SBAR Handover",
        desc: "Real-time automated shift handover board with strictly segregated Plan-Done vs Plan-To-Be-Done, critical alert banners, and 1-click WhatsApp/PDF export."
      },
      {
        badge: "NABH DISCHARGES",
        title: "3-Minute NABH Discharges",
        desc: "Automated, audit-ready discharge summaries with positive take-home medication provenance, separating acute ER interventions from outpatient prescriptions."
      },
      {
        badge: "CLINICAL COPILOT",
        title: "MATE Conversational Partner",
        desc: "Fast, intelligent bedside assistant: 'What is pending for Bed 24?', automatic bed family allocations (11A/11B), and academic rounds debriefs."
      }
    ]
  },
  {
    category: "PROPRIETARY ADVANTAGE",
    title: "Clinical Integrity & DPDP 2023 Compliance Architecture",
    pillarsList: [
      {
        title: "1. DPDP Act 2023 On-The-Fly PHI Scrubbing",
        desc: "Local server-side stripping masks patient names, UHIDs, phone numbers, and Aadhaar before touching LLMs. Calendar dates become relative anchors ([Day 1], [Day 2]) preserving trajectory without storing calendar PHI."
      },
      {
        title: "2. Zero-Hallucination Deterministic Engine",
        desc: "Critical Alerts and reference ranges are hardcoded in pure TypeScript (server/alertCompiler.ts). Undocumented vitals or labs remain null/blank—never manufactured as 'normal' or 'N/A'."
      },
      {
        title: "3. Route-Specific Model Matrix",
        desc: "Claude 3.5 Sonnet exclusively for clinical reasoning; deterministic temperature 0.0 for extraction; zero dependence on untrusted generic models."
      },
      {
        title: "4. Mission-Critical Crash Resilience",
        desc: "PWA offline-first architecture with an in-memory Critical Ops Registry that protects active voice recordings, saves, and syncs from accidental app unloads or refreshes."
      }
    ]
  },
  {
    category: "FULL-SPECTRUM ACUTE CARE",
    title: "Comprehensive Emergency Department Toolchain",
    tools: [
      { title: "SBAR Shift Handover", detail: "Real-time board with WhatsApp/PDF exports, bed allocation, and incoming team takeover." },
      { title: "NABH Discharge Summaries", detail: "Instant clinical prose with take-home prescriptions decoupled from acute ER medications." },
      { title: "ABG/VBG Acid-Base Engine", detail: "Automatic delta-delta analysis, Winters' formula, anion gap, and mixed disorder diagnosis." },
      { title: "Pediatric Dosing Calculator", detail: "Weight-banded resuscitation drug calculator adhering to Indian and international pediatric guidelines." },
      { title: "Mortality & Morbidity Audit", detail: "One-click generation of NABH-ready M&M quality audit reviews directly exported to DOCX." },
      { title: "Rounds 7-Lens Debrief", detail: "First Principles, Pathophysiology, Devil's Advocate, and cognitive trap training for residents." }
    ]
  },
  {
    category: "VALUE PROPOSITION",
    title: "Delivering Transformational Clinical & Financial Impact",
    metrics: [
      { stat: "65%", label: "Faster Documentation", sub: "Handover prep reduced from 45 min to under 3 min per shift." },
      { stat: "100%", label: "DPDP 2023 Compliance", sub: "Zero PHI leaves domestic servers; zero risk of regulatory penalties." },
      { stat: "0", label: "Hallucinated Fields", sub: "Missing vitals remain unstated; anti-fabrication guards enforce clinical truth." },
      { stat: "3 hrs", label: "Saved per Doctor / Shift", sub: "Physicians reinvest saved time into acute bedside resuscitations." }
    ]
  },
  {
    category: "MONETIZATION & GTM",
    title: "Land & Expand: Bottom-Up Clinical Adoption to Enterprise B2B",
    tiers: [
      {
        name: "1. Resident Freemium Tier",
        badge: "BOTTOM-UP VIRALITY",
        color: "text-sky-400 border-sky-500",
        items: [
          "Free standard mobile PWA for ER doctors",
          "Bedside SBAR handover generation",
          "Individual case sheet & quick discharge",
          "Builds deep clinician advocacy & habit loop"
        ]
      },
      {
        name: "2. Pro Clinician / DNB Tier",
        badge: "INDIVIDUAL SAAS",
        color: "text-emerald-400 border-emerald-500",
        items: [
          "Expanded voice transcription minutes",
          "7-lens rounds debrief & exam quizzes",
          "Automated Mortality & Morbidity audits",
          "Advanced pediatric dosing & ABG engines"
        ]
      },
      {
        name: "3. Enterprise Hospital SaaS",
        badge: "B2B CONTRACT",
        color: "text-amber-400 border-amber-500",
        items: [
          "Department-wide real-time census board",
          "Verified consultant escalation hierarchy",
          "HL7 / FHIR integration with legacy hospital EMRs",
          "NABH accreditation compliance analytics"
        ]
      }
    ]
  },
  {
    category: "COMPETITIVE LANDSCAPE",
    title: "Why ErMate Dominates the Emergency Department",
    comparisons: [
      {
        dim: "Emergency Medicine Focus",
        ermate: "100% Acute & ED Native (Primary Survey, eFAST, ABCDE)",
        competitors: "Epic/Cerner: Generic inpatient forms. Ambient scribes: Outpatient clinic focus."
      },
      {
        dim: "Shift Handover (SBAR)",
        ermate: "Autonomous synthesis, bed boards, Plan Done vs To Be Done",
        competitors: "Legacy EMRs: Copy-paste paper. Generic scribes: No handover board."
      },
      {
        dim: "Privacy & Compliance",
        ermate: "DPDP 2023 domestic de-identification before model reach",
        competitors: "Cloud LLMs: Massive PHI leak risk. Legacy EMRs: Locked on-prem."
      },
      {
        dim: "Safety & Integrity",
        ermate: "Deterministic rules: missing vitals remain unstated, never invented",
        competitors: "Pure LLMs: Hallucinate normal findings, leading to clinical hazard."
      }
    ]
  },
  {
    category: "MARKET OPPORTUNITY",
    title: "Capturing a High-Growth Global Acute Care Software Market",
    marketCards: [
      { title: "TAM: $18.4 Billion", sub: "Global Emergency & Acute Care Software Market", detail: "Over 140,000 acute emergency departments worldwide transitioning to cloud AI clinical infrastructure." },
      { title: "SAM: $3.2 Billion", sub: "India & South/SE Asia Acute Care", detail: "Over 70,000 public and private hospital emergency units undergoing mandatory digital health & NABH quality accreditation." },
      { title: "SOM: $180 Million", sub: "Top 2,500 Private Healthcare Networks", detail: "Focusing on rapid penetration across corporate hospital chains (Apollo, Fortis, Max, Manipal) and teaching medical centers." }
    ]
  },
  {
    category: "VISION & ROADMAP",
    title: "From Emergency Department Copilot to Hospital-Wide Acute Nerve Center",
    phases: [
      {
        quarter: "Q1 - Q2 2026",
        title: "Phase 1: Core ED Dominance",
        items: ["Ambient multilingual Sarvam/Whisper ASR", "Full NABH discharge & handover automation", "PWA offline resilience & bed family allocation", "DPDP 2023 certified domestic infrastructure"]
      },
      {
        quarter: "Q3 - Q4 2026",
        title: "Phase 2: Enterprise Ecosystem",
        items: ["Direct FHIR / HL7 bidirectional EMR connectors", "Hospital consultant on-call escalation boards", "Integrated ICU transfer & bed management", "Multi-hospital network centralized quality analytics"]
      },
      {
        quarter: "2027 & Beyond",
        title: "Phase 3: Autonomous Acute Care",
        items: ["Real-time monitor telemetry & early shock alerts", "Predictive clinical deterioration (NEWS2 / qSOFA)", "Automated STEMI / Stroke code door-to-needle timers", "Autonomous clinical trials & registry matching"]
      }
    ]
  },
  {
    category: "PARTNERSHIP & INVESTMENT",
    title: "Join Us in Re-engineering Acute Care Medicine",
    body: "ErMate is scaling hospital enterprise deployments, expanding hospital chain partnerships, and building the definitive AI platform for acute medicine.",
    priorities: [
      "Accelerate hospital enterprise integrations (HL7 / FHIR)",
      "Expand high-volume hospital pilot networks in India & APAC",
      "Scale dedicated domestic AI compute infrastructure",
      "Onboard key emergency clinical advisory leaders"
    ],
    contact: {
      platform: "ErMate Web & PWA",
      url: "https://ermate.in",
      email: "varahgrp@gmail.com",
      role: "Emergency Medicine AI Ops"
    }
  }
];

export default function PitchDeckModal({ isOpen, onClose }: PitchDeckModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const slide = SLIDES_DATA[currentSlide];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/api/download/pitch-deck?format=ppt`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[800px] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Control Bar */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
              <Presentation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                ErMate Pitch Deck
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  Slide {currentSlide + 1} of {SLIDES_DATA.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Emergency Medicine AI Operating System & Intelligent EMR</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              type="button"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Link Copied" : "Copy PPT Link"}</span>
            </button>

            <a
              href="/api/download/pitch-deck?format=ppt"
              download="ErMate_Investor_Pitch_Deck.ppt"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .PPT</span>
            </a>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slide Canvas (16:9 ratio feel) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col justify-center bg-slate-950">
          <div className="w-full max-w-4xl mx-auto bg-slate-900 border border-slate-800/80 rounded-2xl p-6 sm:p-10 shadow-xl flex flex-col justify-between min-h-[460px]">
            
            {/* Header */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 block mb-1">
                {slide.category}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-4">
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="text-base text-sky-300 font-semibold mb-3">{slide.subtitle}</p>
              )}
              {slide.body && (
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl mb-6">{slide.body}</p>
              )}
            </div>

            {/* Slide-Specific Contents */}
            {slide.pillars && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                {slide.pillars.map((p, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5">
                    <h4 className="text-xs font-bold text-white mb-1">{p.title}</h4>
                    <p className="text-[11px] text-slate-400">{p.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.cards && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-auto">
                {slide.cards.map((c, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between">
                    <span className={`text-4xl font-extrabold ${c.color} mb-2 block`}>{c.num}</span>
                    <h4 className="text-sm font-bold text-white mb-2">{c.label}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{c.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.features && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-auto">
                {slide.features.map((f, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
                    <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider block mb-1">{f.badge}</span>
                    <h4 className="text-sm font-bold text-white mb-1.5">{f.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.pillarsList && (
              <div className="space-y-2.5 my-auto">
                {slide.pillarsList.map((p, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                    <h4 className="text-xs font-bold text-emerald-400 mb-0.5">{p.title}</h4>
                    <p className="text-xs text-slate-400">{p.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.tools && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-auto">
                {slide.tools.map((t, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5">
                    <h4 className="text-xs font-bold text-white mb-1">{t.title}</h4>
                    <p className="text-xs text-slate-400">{t.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.metrics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-auto">
                {slide.metrics.map((m, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 text-center">
                    <span className="text-3xl font-black text-sky-400 block mb-1">{m.stat}</span>
                    <h4 className="text-xs font-bold text-white mb-1">{m.label}</h4>
                    <p className="text-[11px] text-slate-400">{m.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.tiers && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-auto">
                {slide.tiers.map((t, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.badge}</span>
                      <h4 className={`text-sm font-bold ${t.color.split(' ')[0]} mb-3`}>{t.name}</h4>
                      <ul className="space-y-1.5">
                        {t.items.map((it, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                            <span className="text-sky-400 mt-0.5">•</span>
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.comparisons && (
              <div className="space-y-2.5 my-auto">
                {slide.comparisons.map((c, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-sky-400 sm:w-1/4">{c.dim}</span>
                    <div className="sm:w-3/4 space-y-0.5">
                      <p className="text-xs font-semibold text-emerald-400"><span className="text-white">ErMate:</span> {c.ermate}</p>
                      <p className="text-[11px] text-slate-400"><span className="text-slate-300">Others:</span> {c.competitors}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.marketCards && (
              <div className="space-y-3 my-auto">
                {slide.marketCards.map((m, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="sm:w-1/3">
                      <span className="text-xl font-black text-sky-400 block">{m.title}</span>
                      <span className="text-xs text-slate-300 font-medium">{m.sub}</span>
                    </div>
                    <p className="text-xs text-slate-400 sm:w-2/3 leading-relaxed">{m.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.phases && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-auto">
                {slide.phases.map((ph, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
                    <span className="text-[10px] font-bold text-sky-400 block mb-1">{ph.quarter}</span>
                    <h4 className="text-sm font-bold text-white mb-2">{ph.title}</h4>
                    <ul className="space-y-1.5">
                      {ph.items.map((it, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <span className="text-slate-500">•</span>
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {slide.priorities && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">Strategic Priorities</h4>
                  <ul className="space-y-2">
                    {slide.priorities.map((pr, idx) => (
                      <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{pr}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {slide.contact && (
                  <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">Live Production Clinical Platform</h4>
                      <div className="space-y-1.5 text-xs text-slate-300">
                        <p><span className="text-slate-500">Platform:</span> <span className="font-semibold text-white">{slide.contact.platform}</span></p>
                        <p><span className="text-slate-500">Web URL:</span> <a href={slide.contact.url} target="_blank" rel="noreferrer" className="text-sky-400 underline">{slide.contact.url}</a></p>
                        <p><span className="text-slate-500">Clinical Inquiries:</span> <span className="text-white">{slide.contact.email}</span></p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Slide Footer */}
            <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>ErMate — Emergency Medicine AI Operating System</span>
              <span>Slide {currentSlide + 1} / {SLIDES_DATA.length}</span>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Controls */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-950/80">
          <button
            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-bold transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-2">
            {SLIDES_DATA.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                type="button"
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  currentSlide === idx ? "bg-sky-500 w-6" : "bg-slate-700 hover:bg-slate-600"
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentSlide(prev => Math.min(SLIDES_DATA.length - 1, prev + 1))}
            disabled={currentSlide === SLIDES_DATA.length - 1}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
