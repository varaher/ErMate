const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

function createDeck() {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_WIDE"; // 16:9 widescreen (13.33 x 7.5 in)
  pptx.author = "ErMate Technologies";
  pptx.company = "ErMate";
  pptx.title = "ErMate — Emergency Medicine AI Operating System";
  pptx.subject = "Investor & Clinical Pitch Deck";

  // Clean Theme Palette (Standard 6-char Hex)
  const C_DARK = "0F172A";       // Slate 900
  const C_CARD = "1E293B";       // Slate 800
  const C_ACCENT = "0284C7";     // Sky 600
  const C_CYAN = "38BDF8";       // Sky 400
  const C_EMERALD = "10B981";    // Emerald 500
  const C_ROSE = "F43F5E";       // Rose 500
  const C_AMBER = "F59E0B";      // Amber 500
  const C_WHITE = "FFFFFF";
  const C_MUTED = "94A3B8";      // Slate 400
  const FONT_TITLE = "Calibri";
  const FONT_BODY = "Calibri";

  function setSlideBg(slide) {
    slide.background = { color: C_DARK };
  }

  function addHeader(slide, category, title) {
    slide.addText(category.toUpperCase(), {
      x: 0.8, y: 0.45, w: 10, h: 0.25,
      fontSize: 10, bold: true, color: C_CYAN, fontFace: FONT_TITLE,
    });
    slide.addText(title, {
      x: 0.8, y: 0.72, w: 11.5, h: 0.6,
      fontSize: 22, bold: true, color: C_WHITE, fontFace: FONT_TITLE,
    });
  }

  // -------------------------------------------------------------
  // SLIDE 1: TITLE SLIDE
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 1.1, w: 2.8, h: 0.45,
      fill: { color: C_ACCENT },
      line: { color: C_CYAN, width: 1 },
      rectRadius: 0.1
    });
    slide.addText("EMERGENCY MEDICINE AI", {
      x: 0.8, y: 1.1, w: 2.8, h: 0.45,
      fontSize: 10, bold: true, color: C_WHITE, align: "center", fontFace: FONT_TITLE
    });

    slide.addText("ErMate", {
      x: 0.8, y: 1.8, w: 10, h: 1.2,
      fontSize: 54, bold: true, color: C_WHITE, fontFace: FONT_TITLE
    });

    slide.addText("The Emergency Medicine AI Operating System & Intelligent EMR", {
      x: 0.8, y: 3.1, w: 11.5, h: 0.65,
      fontSize: 20, bold: true, color: C_CYAN, fontFace: FONT_TITLE
    });

    slide.addText("Empowering acute care physicians, eliminating documentation fatigue, and safeguarding patient lives with zero-hallucination, privacy-first clinical AI.", {
      x: 0.8, y: 3.9, w: 10.5, h: 0.8,
      fontSize: 13, color: C_MUTED, fontFace: FONT_BODY
    });

    const pillars = [
      { title: "DPDP Act 2023 Compliant", desc: "Local On-The-Fly PHI Scrubbing" },
      { title: "Voice-First Scribe", desc: "Multilingual Acute Dictation" },
      { title: "Zero Fabrication", desc: "Deterministic Clinical Rules" },
      { title: "Offline-Resilient", desc: "Mission-Critical PWA Engine" },
    ];

    pillars.forEach((p, idx) => {
      const xPos = 0.8 + idx * 2.92;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 5.3, w: 2.75, h: 1.3,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });
      slide.addText(p.title, {
        x: xPos + 0.15, y: 5.45, w: 2.45, h: 0.4,
        fontSize: 11, bold: true, color: C_WHITE, fontFace: FONT_TITLE
      });
      slide.addText(p.desc, {
        x: xPos + 0.15, y: 5.9, w: 2.45, h: 0.5,
        fontSize: 9.5, color: C_MUTED, fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 2: THE PROBLEM (CRISIS IN THE ED)
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "The Clinical Reality", "The Acute Care Crisis: Burnout, Delays, and Medical Errors");

    const cards = [
      {
        num: "45%",
        label: "Shift Time Lost to Documentation",
        detail: "Emergency physicians spend nearly half their 12-hour shifts typing clinical notes into legacy hospital software instead of managing unstable patients at the bedside.",
        color: C_ROSE
      },
      {
        num: "70%+",
        label: "Handoff Sentinel Events",
        detail: "Over 70% of fatal diagnostic delays and hospital malpractice claims stem from unstructured, fragmented doctor-to-doctor shift handovers and forgotten pending tests.",
        color: C_AMBER
      },
      {
        num: "Zero",
        label: "Usable Mobile Solutions",
        detail: "Legacy enterprise EMRs (Epic, Cerner) are desktop-bound, click-heavy, and unsuited for emergency resuscitations. Doctors resort to insecure consumer apps, risking PHI leaks.",
        color: C_CYAN
      }
    ];

    cards.forEach((c, i) => {
      const xPos = 0.8 + i * 3.9;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 1.6, w: 3.65, h: 5.0,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(c.num, {
        x: xPos + 0.3, y: 1.9, w: 3.0, h: 0.8,
        fontSize: 38, bold: true, color: c.color, fontFace: FONT_TITLE
      });

      slide.addText(c.label, {
        x: xPos + 0.3, y: 2.8, w: 3.0, h: 0.6,
        fontSize: 14, bold: true, color: C_WHITE, fontFace: FONT_TITLE
      });

      slide.addText(c.detail, {
        x: xPos + 0.3, y: 3.5, w: 3.0, h: 2.8,
        fontSize: 12, color: C_MUTED, fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 3: THE SOLUTION (ERMATE OPERATING SYSTEM)
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Product Architecture", "ErMate: Purpose-Built Intelligence for Emergency Medicine");

    const solutions = [
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
    ];

    solutions.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const xPos = 0.8 + col * 5.9;
      const yPos = 1.6 + row * 2.55;

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: yPos, w: 5.6, h: 2.25,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(s.badge, {
        x: xPos + 0.3, y: yPos + 0.2, w: 5.0, h: 0.3,
        fontSize: 9, bold: true, color: C_CYAN, fontFace: FONT_TITLE
      });

      slide.addText(s.title, {
        x: xPos + 0.3, y: yPos + 0.45, w: 5.0, h: 0.45,
        fontSize: 16, bold: true, color: C_WHITE, fontFace: FONT_TITLE
      });

      slide.addText(s.desc, {
        x: xPos + 0.3, y: yPos + 0.95, w: 5.0, h: 1.1,
        fontSize: 12, color: C_MUTED, fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 4: THE DEFENSIBLE MOAT (PRIVACY & CLINICAL INTEGRITY)
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Proprietary Advantage", "Clinical Integrity & DPDP 2023 Compliance Architecture");

    const pillars = [
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
    ];

    pillars.forEach((p, idx) => {
      const yPos = 1.6 + idx * 1.28;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8, y: yPos, w: 11.5, h: 1.12,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(p.title, {
        x: 1.1, y: yPos + 0.15, w: 10.9, h: 0.35,
        fontSize: 13, bold: true, color: C_EMERALD, fontFace: FONT_TITLE
      });

      slide.addText(p.desc, {
        x: 1.1, y: yPos + 0.52, w: 10.9, h: 0.5,
        fontSize: 11, color: C_MUTED, fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 5: CLINICAL SUITE BREAKDOWN
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Full-Spectrum Acute Care", "Comprehensive Emergency Department Toolchain");

    const tools = [
      { title: "SBAR Shift Handover", detail: "Real-time board with WhatsApp/PDF exports, bed allocation, and incoming team takeover." },
      { title: "NABH Discharge Summaries", detail: "Instant clinical prose with take-home prescriptions decoupled from acute ER medications." },
      { title: "ABG/VBG Acid-Base Engine", detail: "Automatic delta-delta analysis, Winters' formula, anion gap, and mixed disorder diagnosis." },
      { title: "Pediatric Dosing Calculator", detail: "Weight-banded resuscitation drug calculator adhering to Indian and international pediatric guidelines." },
      { title: "Mortality & Morbidity Audit", detail: "One-click generation of NABH-ready M&M quality audit reviews directly exported to DOCX." },
      { title: "Rounds 7-Lens Debrief", detail: "First Principles, Pathophysiology, Devil's Advocate, and cognitive trap training for residents." }
    ];

    tools.forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const xPos = 0.8 + col * 3.9;
      const yPos = 1.65 + row * 2.5;

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: yPos, w: 3.65, h: 2.2,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(t.title, {
        x: xPos + 0.25, y: yPos + 0.2, w: 3.15, h: 0.4,
        fontSize: 14, bold: true, color: C_WHITE, fontFace: FONT_TITLE
      });

      slide.addText(t.detail, {
        x: xPos + 0.25, y: yPos + 0.65, w: 3.15, h: 1.3,
        fontSize: 11, color: C_MUTED, fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 6: MEASURABLE ROI & CLINICAL OUTCOMES
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Value Proposition", "Delivering Transformational Clinical & Financial Impact");

    const metrics = [
      { stat: "65%", label: "Faster Documentation", sub: "Handover prep reduced from 45 min to under 3 min per shift." },
      { stat: "100%", label: "DPDP 2023 Compliance", sub: "Zero PHI leaves domestic servers; zero risk of regulatory penalties." },
      { stat: "0", label: "Hallucinated Fields", sub: "Missing vitals remain unstated; anti-fabrication guards enforce clinical truth." },
      { stat: "3 hrs", label: "Saved per Doctor / Shift", sub: "Physicians reinvest saved time into acute bedside resuscitations." }
    ];

    metrics.forEach((m, idx) => {
      const xPos = 0.8 + idx * 2.92;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 1.6, w: 2.75, h: 5.0,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(m.stat, {
        x: xPos + 0.15, y: 2.2, w: 2.45, h: 0.8,
        fontSize: 36, bold: true, color: C_CYAN, align: "center", fontFace: FONT_TITLE
      });

      slide.addText(m.label, {
        x: xPos + 0.15, y: 3.1, w: 2.45, h: 0.6,
        fontSize: 13, bold: true, color: C_WHITE, align: "center", fontFace: FONT_TITLE
      });

      slide.addText(m.sub, {
        x: xPos + 0.2, y: 3.8, w: 2.35, h: 2.2,
        fontSize: 11, color: C_MUTED, align: "center", fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 7: BUSINESS MODEL & GO-TO-MARKET
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Monetization & GTM", "Land & Expand: Bottom-Up Clinical Adoption to Enterprise B2B");

    const tiers = [
      {
        name: "1. Resident Freemium Tier",
        badge: "BOTTOM-UP VIRALITY",
        color: C_CYAN,
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
        color: C_EMERALD,
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
        color: C_AMBER,
        items: [
          "Department-wide real-time census board",
          "Verified consultant escalation hierarchy",
          "HL7 / FHIR integration with legacy hospital EMRs",
          "NABH accreditation compliance analytics"
        ]
      }
    ];

    tiers.forEach((t, i) => {
      const xPos = 0.8 + i * 3.9;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 1.6, w: 3.65, h: 5.0,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(t.name, {
        x: xPos + 0.25, y: 1.9, w: 3.15, h: 0.5,
        fontSize: 14, bold: true, color: t.color, fontFace: FONT_TITLE
      });

      slide.addText(t.badge, {
        x: xPos + 0.25, y: 2.45, w: 3.15, h: 0.3,
        fontSize: 9, bold: true, color: C_MUTED, fontFace: FONT_TITLE
      });

      t.items.forEach((item, itemIdx) => {
        slide.addText(`- ${item}`, {
          x: xPos + 0.25, y: 2.9 + itemIdx * 0.8, w: 3.15, h: 0.7,
          fontSize: 11, color: C_WHITE, fontFace: FONT_BODY
        });
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 8: COMPETITIVE ADVANTAGE
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Competitive Landscape", "Why ErMate Dominates the Emergency Department");

    const comparisons = [
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
    ];

    comparisons.forEach((c, idx) => {
      const yPos = 1.6 + idx * 1.28;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8, y: yPos, w: 11.5, h: 1.12,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(c.dim.toUpperCase(), {
        x: 1.1, y: yPos + 0.15, w: 3.2, h: 0.3,
        fontSize: 11, bold: true, color: C_CYAN, fontFace: FONT_TITLE
      });

      slide.addText(`ErMate: ${c.ermate}`, {
        x: 4.4, y: yPos + 0.15, w: 7.6, h: 0.45,
        fontSize: 11, bold: true, color: C_EMERALD, fontFace: FONT_BODY
      });

      slide.addText(`Others: ${c.competitors}`, {
        x: 4.4, y: yPos + 0.58, w: 7.6, h: 0.45,
        fontSize: 10, color: C_MUTED, fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 9: MARKET OPPORTUNITY (TAM / SAM / SOM)
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Market Opportunity", "Capturing a High-Growth Global Acute Care Software Market");

    const marketCards = [
      { title: "TAM: $18.4 Billion", sub: "Global Emergency & Acute Care Software Market", detail: "Over 140,000 acute emergency departments worldwide transitioning to cloud AI clinical infrastructure." },
      { title: "SAM: $3.2 Billion", sub: "India & South/SE Asia Acute Care", detail: "Over 70,000 public and private hospital emergency units undergoing mandatory digital health & NABH quality accreditation." },
      { title: "SOM: $180 Million", sub: "Top 2,500 Private Healthcare Networks", detail: "Focusing on rapid penetration across corporate hospital chains (Apollo, Fortis, Max, Manipal) and teaching medical centers." }
    ];

    marketCards.forEach((m, idx) => {
      const yPos = 1.6 + idx * 1.65;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8, y: yPos, w: 11.5, h: 1.4,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(m.title, {
        x: 1.1, y: yPos + 0.18, w: 5.0, h: 0.4,
        fontSize: 18, bold: true, color: C_CYAN, fontFace: FONT_TITLE
      });

      slide.addText(m.sub, {
        x: 1.1, y: yPos + 0.6, w: 5.0, h: 0.35,
        fontSize: 11, bold: true, color: C_WHITE, fontFace: FONT_TITLE
      });

      slide.addText(m.detail, {
        x: 6.2, y: yPos + 0.25, w: 5.8, h: 0.9,
        fontSize: 11, color: C_MUTED, fontFace: FONT_BODY
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 10: ROADMAP & FUTURE VISION
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);
    addHeader(slide, "Vision & Roadmap", "From Emergency Department Copilot to Hospital-Wide Acute Nerve Center");

    const phases = [
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
    ];

    phases.forEach((p, idx) => {
      const xPos = 0.8 + idx * 3.9;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: xPos, y: 1.6, w: 3.65, h: 5.0,
        fill: { color: C_CARD },
        line: { color: "334155", width: 1 },
        rectRadius: 0.08
      });

      slide.addText(p.quarter, {
        x: xPos + 0.25, y: 1.9, w: 3.15, h: 0.35,
        fontSize: 11, bold: true, color: C_CYAN, fontFace: FONT_TITLE
      });

      slide.addText(p.title, {
        x: xPos + 0.25, y: 2.3, w: 3.15, h: 0.5,
        fontSize: 14, bold: true, color: C_WHITE, fontFace: FONT_TITLE
      });

      p.items.forEach((item, itemIdx) => {
        slide.addText(`- ${item}`, {
          x: xPos + 0.25, y: 2.9 + itemIdx * 0.8, w: 3.15, h: 0.7,
          fontSize: 11, color: C_MUTED, fontFace: FONT_BODY
        });
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 11: THE ASK & CONTACT
  // -------------------------------------------------------------
  {
    const slide = pptx.addSlide();
    setSlideBg(slide);

    slide.addText("PARTNERSHIP & INVESTMENT", {
      x: 0.8, y: 1.4, w: 10, h: 0.3,
      fontSize: 11, bold: true, color: C_CYAN, fontFace: FONT_TITLE
    });

    slide.addText("Join Us in Re-engineering Acute Care Medicine", {
      x: 0.8, y: 1.8, w: 11.5, h: 0.8,
      fontSize: 30, bold: true, color: C_WHITE, fontFace: FONT_TITLE
    });

    slide.addText("ErMate is scaling hospital enterprise deployments, expanding hospital chain partnerships, and building the definitive AI platform for acute medicine.", {
      x: 0.8, y: 2.7, w: 10.5, h: 0.8,
      fontSize: 13, color: C_MUTED, fontFace: FONT_BODY
    });

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8, y: 3.7, w: 11.5, h: 2.7,
      fill: { color: C_CARD },
      line: { color: C_ACCENT, width: 2 },
      rectRadius: 0.08
    });

    slide.addText("Strategic Priorities:", {
      x: 1.2, y: 4.0, w: 5.0, h: 0.4,
      fontSize: 14, bold: true, color: C_CYAN, fontFace: FONT_TITLE
    });

    const priorities = [
      "Accelerate hospital enterprise integrations (HL7 / FHIR)",
      "Expand high-volume hospital pilot networks in India & APAC",
      "Scale dedicated domestic AI compute infrastructure",
      "Onboard key emergency clinical advisory leaders"
    ];

    priorities.forEach((p, idx) => {
      slide.addText(`[OK]  ${p}`, {
        x: 1.2, y: 4.5 + idx * 0.42, w: 6.0, h: 0.35,
        fontSize: 11, color: C_WHITE, fontFace: FONT_BODY
      });
    });

    slide.addText("Live Clinical Platform", {
      x: 7.8, y: 4.0, w: 4.0, h: 0.35,
      fontSize: 13, bold: true, color: C_WHITE, fontFace: FONT_TITLE
    });
    slide.addText("Web & PWA: https://ermate.in\nContact: varahgrp@gmail.com\nClinical Head: Emergency Medicine AI Ops", {
      x: 7.8, y: 4.45, w: 4.0, h: 1.2,
      fontSize: 11, color: "E2E8F0", fontFace: FONT_BODY
    });
  }

  return pptx;
}

const pptx = createDeck();
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const pptxPath = path.join(publicDir, "ErMate_Investor_Pitch_Deck.pptx");
const pptPath = path.join(publicDir, "ErMate_Investor_Pitch_Deck.ppt");

pptx.writeFile({ fileName: pptxPath }).then(() => {
  console.log(`Generated PPTX at ${pptxPath}`);
  // Also create .ppt filename so users who associate presentations with .ppt can open it directly
  fs.copyFileSync(pptxPath, pptPath);
  console.log(`Copied PPT at ${pptPath}`);
}).catch(err => {
  console.error("Error creating presentation:", err);
  process.exit(1);
});
