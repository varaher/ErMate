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
2. **Local Doctor Re-Injection & Clinician Attribution Preservation**:
   - The AI model never sees doctor identities. The treating physician name (`Dr. Name`) is securely attached locally post-extraction via the logged-in user profile (`currentUser.displayName`).
   - For explicitly role-attributed internal emergency clinicians (e.g., `"EM Resident Dr Joshua"`, `"EM Consultant Dr Christo"`), names are protected with reversible placeholders before de-identification and restored strictly into `emResident` and `emConsultant` attribution fields, with defensive guards preventing `[DOCTOR]` placeholders from overwriting valid data. Free clinical narratives remain 100% de-identified. External referral doctors continue through standard `[DOCTOR]` de-identification.
3. **PHI Shield Metadata & Transparency**:
   - All extraction API responses return `phiProtected` metadata details (count, categories stripped), which are rendered transparently to the treating doctor via UI banners.

---

## ⚡ Core Functional Modules

### 1. AI-Assisted Structured Handover (EMR & OCR)
- **5-Step Handover Pipeline**: Preprocess -> Reverse chronological EMR entries -> Route -> Multi-LLM Synthesis -> Standardized Clinical JSON.
- **SBAR Structure**: Situation, Background, Assessment, Recommendation, Alert Banners, Pending Labs, and Vitals Trajectory.
- **Direct PDF & WhatsApp Export**: One-click formatted handover sheets for shift transitions.
- **Decoupled Shift Transition & Operational Continuity**: Doctor shift end is strictly decoupled from patient encounter termination (`Doctor shift ended ≠ Patient encounter ended`). Handover PDF download, printing, or text export never alters `ClinicalCase.status` or `dispositionDetails.dispositionType`. Active patients remain visible on the active ER board for the incoming shift team until an explicit clinical disposition occurs. Unsafe board-clearing mutations and misleading clean-slate warnings have been completely eliminated.

### 2. Auto-Discharge Summary & Quick Discharge Generator
- Converts complex ED stay trajectories into NABH/JCI-ready Discharge Summaries.
- **Standalone Quick Discharge Intake**: Fast, direct discharge creation via EMR Text Paste, Voice Dictation, or Photo Capture without requiring full 11-tab case documentation. Tagged with `entrySource: "quick_discharge"` for unified NABH case registry traceability and always 100% free (`bypassCreditCheck: true`).
- Extracts Presenting Complaints, Physical Examination Findings, Diagnostic Course, Procedures Performed, Discharge Medications, and Red-Flag Advice.
- **Live Synchronization Engine & Source of Truth (`src/utils/dischargeSyncEngine.ts`)**: Automatically pulls and reconciles data from the latest saved `ClinicalCase`—including Vitals, ABCDE, secondary systems, ECG, eFAST/POCUS, ABG/VBG, acute medications, IV fluids, procedures, consultations, and chronological progress notes—for both Adult and Pediatric cases.
- **Lifecycle State Machine**: Explicit status tracking (`DRAFT` → `PREPARED` → `MANUALLY_EDITED` → `FINALIZED`) with status badge indicators in the discharge header.
- **Non-Destructive Reconciliation**: When subsequent case updates occur after preparation, a prominent alert banner allows clinicians to refresh and merge newly documented investigations, treatments, and notes without erasing or overwriting manual edits and instructions.
- **Separated Save Boundaries & Patient Status Decoupling**: Dedicated "Save Draft" versus "Finalize & Save Summary" controls. Summary finalization updates the document lifecycle (`summaryStatus = "FINALIZED"`) while strictly preserving `ClinicalCase.status` without altering the patient's operational bed/admission state. Operational status remains exclusively governed by the authoritative clinical disposition workflow.

### 3. Voice & Text Case Sheet Extraction
- Supports real-time clinical dictation and OCR case sheet capture.
- Standardizes voice notes into structured EHR fields (Vitals, GCS, Airway status, Disposition, Treatment Plan).
- **Strict Clinical Semantic Boundaries**: Deterministic semantic normalization prevents Primary Survey Exposure from capturing abdominal, neurological, or hydration findings; automatically re-routes systemic findings to Secondary Survey (PA, CNS, General) and vitals (`c.vitals.temp`), separates conditional hydration statements from acute medication orders, and strictly enforces zero-invention guards for unstated lab tests or drug attributes.
- **Immediate Triage Selection Persistence & Vital Shield**: Explicit clinician triage selections (P1/P2/P3) immediately write to Firestore without requiring secondary save actions. Vital edits and automated calculators only run if triage is in pending status, safeguarding manual triage assignments.
- **Scribe Delta Updates & Established Case Differentiation**: Subsequent Scribe updates append timestamped progress entries (`[HH:MM] — [Update text]`) rather than overwriting historical clinical notes. Initial Scribe dictations during intake are strictly barred from entering `progressNotes` / Clinical Notes, mapping solely to structured fields through authoritative established-case detection (`isEstablishedCaseSheet`). Intelligently deep-merges medications, labs, and differentials without erasing existing case records.
- **Canonical Deep Merge for Unapplied Scribe Turns**: Unified `getMergedUnappliedExtraction` canonical helper recursively deep-merges all unapplied turns across both the message "Preview Case Sheet" action and the header "Open Case Sheet" button, preserving nested structures (`vitals`, `sampleHistory`, `secondarySurvey`, `fastFindings`, `mlcDetails`, `vbgAbg`) without shallow overwriting. Preserves pediatric age 0 safely using nullish coalescing.
- **Consultation Deduplication & Specialty Normalization**: Redundant department entries (e.g. `"Urology consultation, Urology"`, `"urology reviewed"`) are automatically normalized and deduplicated across Scribe, Case Sheet, and Task Applier into single canonical specialties (e.g. `"Urology"`), while preserving distinct clinical departments.
- **SAMPLE Events & Secondary Survey All-6-Systems Integrity**: Preceding events/trauma mechanisms are deterministically mapped into `sampleHistory.events` (e.g., `"RTA two-wheeler vs four-wheeler"` → `"Road traffic accident involving two-wheeler vs four-wheeler"`, `"Snake bite while working in field"` → `"Snake bite while working in field"`), leaving ambiguous medical history cleanly blank without hallucinated triggers. Secondary physical examination comprehensively captures, parses, and persists all 6 anatomical systems (`General`, `CVS`, `Respiratory / RS`, `Abdomen / PA`, `CNS`, `Extremities`), guaranteeing survival across extraction, Apply, Firestore persistence, and reload.
- **Deep-Merge Persistence & Field Protection**: All case save handlers use `{ merge: true }` and deep object synthesis across Demographics, Vitals, Primary Survey, SAMPLE history, and Adjuncts, preventing partial updates from inadvertently dropping unedited fields upon reload.
- **Same-Patient Resume Scribe Continuity**: Propagates existing case IDs directly from CaseSheetView to VoiceScribeChatView, restoring persisted `/cases/{caseId}/scribeChatMessages` and preventing orphan session or case ID generation while maintaining full new-patient Scribe creation capability. Authoritative Firestore check ensures "Resume Scribe" state persists across component remounts.
- **In-Memory Consolidated Preview Flow**: Clinicians clicking "Preview Case Sheet" from Scribe view an instant, read-only consolidated printable clinical preview (`CaseSheetPrintView`) showing all pending updates with zero database writes. Features an amber warning banner ("Preview — changes are not saved yet"), direct "Back to Scribe" navigation without saving, and an "Apply to Case Sheet" action that persists to Firestore with `{ merge: true }`, appends `"✓ Case Sheet prepared successfully."`, and transitions to the editable CaseSheetView. Automatically adapts to Adult or Pediatric printable formats based on locked age criteria.
- **Canonical Flowsheet & Treatment State Engine**: Unified acute medication and resuscitation flowsheet with explicit Scribe vs. Manual origin tracking, real-time dirty state indicators, and two-step non-destructive item removal with undo.
- **NABH-Ready Saved Case Sheet View**: High-fidelity adult and pediatric case sheet document view with contextual primary survey vitals, decoupled SAMPLE history, multi-system secondary survey, separated diagnostic imaging vs. laboratory investigations, complete medication orders with infusions and treatment notes, emergency procedures, specialist consultation reviews, dynamic clinician signature blocks, unified adult-pediatric disposition workflows with explicit "Pending / Not Documented" state (zero automatic discharge defaults on intake or auxiliary edits), robust legacy read-fallbacks without data fabrication, and automatic removal of Scribe boilerplate text.
- **Vitals Safety & Pediatric Age-Appropriate Reference Display**: Complete elimination of fabricated vitals (zero default fallback values like 120/80 or 80 bpm; explicitly documented vitals are captured while unmeasured vitals remain blank). For pediatric patients (age ≤ 16), displays validated age-appropriate normal reference ranges beside measured vitals across Primary Survey, ABCD sections, and Vitals Trends without populating or saving reference ranges as patient data. Evaluates hemodynamic stability and abnormal indicators against age-specific ranges.
- **Single Canonical Scribe Extraction Contract**: Eliminated duplicate sectioned prompt directives (`buildChecklistPromptSection("adult")`) from both primary and fallback extraction prompts (`server/voiceExtraction.ts` and `server/extraction.ts`). Enforced a single, flat canonical schema (`chiefComplaint`, `vitals`, `airway`, `breathing`, `circulation`, `disability`, `exposure`, `vbg`, `fastFindings`, `mlcDetails`, etc.) with fail-loud shape assertion (`assertCanonicalExtractionShape`) that immediately rejects any payload with sectioned keys (`Identity`, `Chief`, `Primary`, `Exam`, `Psych`, `Disposition`, `Signature`) before processing.
- **Surgical Adjuncts Unification (ABG/VBG, ECG, EFAST, Bedside Echo)**: Decoupled the Structured/Manual layer (dropdowns, selectors, numeric values) from the Narrative Findings layer (free text notes and interpretations). Scribe extraction never overwrites manual dropdowns, and existing notes are intelligently appended and deduplicated (`existing; new`). In the case sheet, printable view, and clipboard export, undocumented adjuncts render objectively as `"Not documented"` or `"Not done"`, fully eliminating fabricated normal defaults.
- **Structured Procedure Note System**: Comprehensive clinical documentation engine implementing 7 core ER procedure templates: Foley Catheter Insertion, Central Venous Line (CVC) Insertion, Arterial Line Insertion, RSI / Endotracheal Intubation, Closed Manipulative Reduction, Short Arm Slab, and Ryles / Nasogastric (NG) Tube Insertion. Replaces unguided free-text entry with structured guided forms, strict clinical truth safeguards ("not confirmed = not documented"), automated objective narrative generation, full operator and timeout attribution, Voice Scribe smart detection, and dynamic rendering across Case Sheet, Printable, and PDF exports.

### 4. Universal Clinical Task Applier (Adult & Pediatric)
- **Natural Language Intent & Task Registry**: Seamless natural-language commands without requiring the clinician to know underlying Case Sheet schemas (e.g., `"add eFAST positive in bladder area"`, `"add in SAMPLE past medical history, allergy, medication as nil. psychological assessment as normal"`, `"send serum cortisol"`, `"add inj paracetamol 1 gm IV stat"`).
- **5-Tier Intent Engine**: Accurately classifies clinician queries into `QUESTION` (returns clinical guidance with zero case mutations), `DOCUMENT_FACT`, `CASE_UPDATE`, `APP_ACTION`, or `MIXED`.
- **Deterministic Disambiguation**: Intelligently handles ambiguous clinical commands (such as distinguishing cardiac enzyme lab values from coronary syndrome diagnostic assessments).
- **eFAST / POCUS Comprehensive Organ Mapping**: Expanded organ mapping covering heart, abdomen, pelvis, bladder, suprapubic, and lungs, reliably populating `fastFindings` and `adjuncts.efastNotes`.
- **SAMPLE History Synchronization**: Unpacks and links SAMPLE sub-objects to flat fields (`allergies`, `pastMedicalHistory`, `currentMedications`, `psychologicalAssessment`), eliminating empty array dropouts and duplicate card rows.
- **Post-Preparation Discharge Summary Safety**: Detects when clinical tasks or scribe updates modify a case after a discharge summary was already drafted. Presents an in-app notice and one-click "Refresh Summary from Case" action that non-destructively updates the summary with newly ordered labs, medications, and clinical notes.

### 5. Mortality & Morbidity Audit Suite
- Generates thorough M&M audit reviews formatted according to hospital quality standards.
- Produces downloadable `.docx` audit documents directly from EMR stay histories.

### 6. Non-Destructive In-App Data Refresh Engine
- **Global Header Refresh Button**: Seamlessly available across desktop and mobile headers (`↻ Refresh`) to pull real-time Firestore updates without page reloads.
- **Unsaved Clinical Work Protection**: Evaluates open Case Sheet dirty state and presents a safe "Save or discard" prompt before refreshing.
- **Voice Scribe Protection**: Prevents refreshing during active voice recording, transcription, or message transmission.
- **Context & Route Preservation**: Preserves active routes, selected cases, active tabs, and clinician credentials without resetting in-memory UI navigation.

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

## 🧭 Role-Based Navigation Architecture

ErMate employs a dynamic role-based navigation hierarchy computed from `getNormalizedRole()` across desktop and mobile bottom navigation:

- **Resident**: Dashboard · Handover · My Log Book · Learn · Tools · More
- **Consultant**: Dashboard · Cases · Handover · My Log Book · Learn · Tools · More
- **HOD**: Dashboard · Cases · Handover · Department Team · Analytics · My Log Book · Learn · More
- **Independent**: Dashboard · My Cases · My Log Book · Learn · Tools · More
- **Platform Admin**: Retains dedicated Admin Control Center access alongside Learn.

> **Continuous Learning Hub**: `Learn` is universally visible across all clinician roles as the central education hub containing interactive ER Simulations, Clinical Reference Q&A, Residency Trivia, Clinical Memory Log, and Google Classroom.
> **Department Governance**: Hospital roster management is strictly consolidated in `Department Team`, with Profile Settings dedicated to personal credentials, workplace settings, preferences, and account security.

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
| `/firestore.rules` | Phase-3 Transitional Firestore Security Rules (UID/membership & legacy coexistence; hardened Phase 3A.1 Log Book rules) |
| `/test_phase3_rules.cjs` | 39-scenario emulator test suite validating Phase-3 authorization matrix |
| `/src/lib/firebase-admin.ts` | Named Firestore database Admin singleton (`ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03`) |
| `/server/clinicalRanges.ts` | Deterministic adult ED reference ranges & zero-hallucination abnormal flagger |
| `/server/alertCompiler.ts` | Rule-based post-synthesis critical alert compiler (Section 0) |
| `/server/crossConsultParser.ts` | Regex-first cross-consultation extractor & duration-conditioned section renderer |
| `/server/handover.ts` | 5-Step Handover extraction pipeline |
| `/server/dischargeSummary.ts` | Auto-Discharge summary synthesizer |
| `/server/extraction.ts` | Voice dictation & clinical case parser |
| `/server/mortalityAudit.ts` | M&M Audit generator & DOCX builder |
| `/src/utils/roleUtils.ts` | Role normalization & dynamic navigation permissions helper (`getNormalizedRole`) |
| `/src/components/ToolsView.tsx` | Consolidated acute clinical tools hub (Drug Guide, Peds Calculator, Pocket Mirror) |
| `/src/components/MoreView.tsx` | Secondary utilities hub (Directory, MLC, Governance, Settings, Admin) |
| `/src/components/CaseSheetPrintView.tsx` | Official read-only, print-formatted Case Sheet document view |
| `/src/components/HandoverView.tsx` | Interactive Handover UI & PHI Protection Toast |
| `/src/components/ProfileSettingsView.tsx` | Settings, Privacy Policy & DPDP Shield Architecture Overview |

---

*ErMate Clinical OS — Designed for Emergency Care Excellence.*
