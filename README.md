# ErMate — Emergency Medicine AI Operating System & Clinical EMR

> **DPDP Act 2023 Compliant · Offline-Resilient · Multi-Model AI Clinical Copilot**

ErMate is a high-speed, enterprise-grade Emergency Department (ED) Clinical AI Assistant and EMR platform designed specifically for fast-paced acute care environments (India & Global). It optimizes ED handovers, automates discharge summaries, performs real-time clinical case extractions, and generates mortality/morbidity audit documents with zero data leakage.

---

## 🛡️ DPDP Act 2023 Compliance & Privacy Architecture

ErMate implements **Local On-The-Fly PHI De-identification** hosted on Indian Cloud Run infrastructure (`asia-south1`) before any medical notes or voice transcripts reach overseas LLM endpoints.

### Key Privacy Pillars:
1. **Server-Side Local PHI Stripping (`server/deidentify.ts`)**:
   - **Identifiers Removed**: Patient names, hospital UHIDs, MRNs, Aadhaar numbers, phone numbers, consultant names, and hospital facility labels are automatically detected and masked (`[PATIENT]`, `[PATIENT-ID]`, `[PHONE]`, `[AADHAAR]`).
   - **Universal Coverage**: Applied across all extraction routes—including Voice Dictation (`server/voiceExtraction.ts`), Case Extractions, Handover Parsing, Discharge Summaries, and Clinical Chats.
   - **Relative Clinical Timeline Conversion**: Absolute calendar dates (e.g., `25/07/2026`, `27/07/2026`) are converted into relative clinical timeline anchors (`[Day 1]`, `[Day 3]`). This preserves vital disease progression context while stripping calendar-based PHI.
2. **Local Doctor Re-Injection**:
   - The AI model never sees doctor identities. The treating physician name (`Dr. Name`) is securely attached locally post-extraction via the logged-in user profile (`currentUser.displayName`).
3. **PHI Shield Metadata & Transparency**:
   - All extraction API responses return `phiProtected` metadata details (count, categories stripped), which are rendered transparently to the treating doctor via UI banners.

---

## ⚡ Core Functional Modules

### 1. AI-Assisted Structured Handover (EMR & OCR)
- **5-Step Handover Pipeline**: Preprocess -> Reverse chronological EMR entries -> Route -> Multi-LLM Synthesis -> Standardized Clinical JSON.
- **SBAR Structure**: Situation, Background, Assessment, Recommendation, Alert Banners, Pending Labs, and Vitals Trajectory.
- **Direct PDF & WhatsApp Export**: One-click formatted handover sheets for shift transitions.

### 2. Auto-Discharge Summary & Quick Discharge Generator
- Converts complex ED stay trajectories into NABH/JCI-ready Discharge Summaries.
- **Standalone Quick Discharge Intake**: Fast, direct discharge creation via EMR Text Paste, Voice Dictation, or Photo Capture without requiring full 11-tab case documentation. Tagged with `entrySource: "quick_discharge"` for unified NABH case registry traceability and always 100% free (`bypassCreditCheck: true`).
- Extracts Presenting Complaints, Physical Examination Findings, Diagnostic Course, Procedures Performed, Discharge Medications, and Red-Flag Advice.

### 3. Voice & Text Case Sheet Extraction
- Supports real-time clinical dictation and OCR case sheet capture.
- Standardizes voice notes into structured EHR fields (Vitals, GCS, Airway status, Disposition, Treatment Plan).

### 4. Mortality & Morbidity Audit Suite
- Generates thorough M&M audit reviews formatted according to hospital quality standards.
- Produces downloadable `.docx` audit documents directly from EMR stay histories.

---

## 🤖 AI Model Assignments & Route-Specific Cascades

ErMate enforces strict per-route AI model assignments and dedicated fallback cascades to maximize accuracy, safety, and operational resilience:

| Clinical Route | Primary Model | Secondary Fallback | Fail-Safe / Rule |
| :--- | :--- | :--- | :--- |
| **Clinical Q&A / Reference Chat** | **Claude 3.5 Sonnet** | *None* | Strict Single Model — Returns friendly error if unavailable. Never uses Gemini Flash. |
| **Handover Synthesis** | **Claude 3.5 Sonnet** | **Gemini Pro** | Heuristic Local Engine fallback ensures handover generation never fails. |
| **Voice & Case Extraction** | **GPT-4o-mini** | **Claude 3.5 Haiku** | Fast, low-latency dictation parsing with guaranteed local JSON fallbacks. |
| **Discharge Summary** | **Claude 3.5 Sonnet** | **GPT-4o** | Heuristic discharge builder fallback. |
| **Mortality & Morbidity Audit** | **Claude 3.5 Sonnet** | **GPT-4o** | **Gemini Pro** fallback before local DOCX audit generator. |

> **Temperature Enforcement**: All clinical extraction routes operate strictly at `temperature: 0.0` for zero-hallucination, deterministic outputs.

---

## 🏗️ Technical Architecture

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Motion (Framer Motion).
- **Backend**: Express.js custom server (`server.ts`, TypeScript, CommonJS bundled with `esbuild`).
- **Database & Sync**: Firebase Firestore (or Cloud SQL PostgreSQL) with automatic offline local persistence, real-time `onSnapshot` deduplication, and cross-origin frame error protection.
- **Build / Dev Commands**:
  - `npm run dev`: Boots server via `tsx server.ts` on port 3000.
  - `npm run build`: Builds Vite SPA bundle and compiles Express server into `dist/server.cjs`.
  - `npm run lint`: Runs TypeScript validation (`tsc --noEmit`).

---

## 📜 Key File Map

| Path | Purpose |
| :--- | :--- |
| `/server/deidentify.ts` | On-the-fly local PHI stripping engine & date-to-relative-timeline converter |
| `/server/clinicalRanges.ts` | Deterministic adult ED reference ranges & zero-hallucination abnormal flagger |
| `/server/alertCompiler.ts` | Rule-based post-synthesis critical alert compiler (Section 0) |
| `/server/crossConsultParser.ts` | Regex-first cross-consultation extractor & duration-conditioned section renderer |
| `/server/handover.ts` | 5-Step Handover extraction pipeline |
| `/server/dischargeSummary.ts` | Auto-Discharge summary synthesizer |
| `/server/extraction.ts` | Voice dictation & clinical case parser |
| `/server/mortalityAudit.ts` | M&M Audit generator & DOCX builder |
| `/src/components/CaseSheetPrintView.tsx` | Official read-only, print-formatted Case Sheet document view |
| `/src/components/HandoverView.tsx` | Interactive Handover UI & PHI Protection Toast |
| `/src/components/ProfileSettingsView.tsx` | Settings, Privacy Policy & DPDP Shield Architecture Overview |

---

*ErMate Clinical OS — Designed for Emergency Care Excellence.*
