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
- **Duty-Bound Current Clinician Assignment (`Patch D4A/D4B`)**: Preserves original case creation duty provenance (`case.shiftId`, `shiftDate`, `shiftName`) immutably while recording the operational current clinician (`currentAssigneeUid`, `currentAssigneeEmail`, `currentAssigneeName`) and the exact Actual Duty Session (`currentAssignmentDutySessionId`, `currentAssignmentDutyDateKey`, `currentAssignmentShiftId`, `currentAssignmentAt`) during which responsibility was accepted or transferred via handover. Gated by Patch D4B: hospital case takeover strictly requires an active, unexpired Actual Duty Session, rejecting off-duty attempts prior to database mutation while allowing routine edits and emergency case creations unhindered.
- **Current Duty Case Visibility on Home (`Patch H1`)**: Hospital clinician "My Assigned Cases" on the Home dashboard strictly isolates operationally active cases (`status === "Active" || status === "Triage"`) bound to the clinician's valid, running Actual Duty Session (`currentAssignmentDutySessionId === activeDutySession.id` and `currentAssigneeEmail === profile.email` with `isActiveDutySessionNow(activeDutySession) === true`). Completely eliminates stale fallback to `doctorEmail === profile.email`, guaranteeing that old cases from previous shifts, expired duty sessions, or off-duty periods never pollute the doctor's active queue. Department cases and badge counts automatically reflect active admissions with zero database mutation.

### 2. Auto-Discharge Summary & Quick Discharge Generator
- Converts complex ED stay trajectories into NABH/JCI-ready Discharge Summaries.
- **Standalone Quick Discharge Intake**: Fast, direct discharge creation via EMR Text Paste, Voice Dictation, or Photo Capture without requiring full 11-tab case documentation. Tagged with `entrySource: "quick_discharge"` for unified NABH case registry traceability and always 100% free (`bypassCreditCheck: true`).
- Extracts Presenting Complaints, Physical Examination Findings, Diagnostic Course, Procedures Performed, Discharge Medications, and Red-Flag Advice.
- **Live Synchronization Engine & Source of Truth (`src/utils/dischargeSyncEngine.ts`)**: Automatically pulls and reconciles data from the latest saved `ClinicalCase`—including Vitals, ABCDE, secondary systems, ECG, eFAST/POCUS, ABG/VBG, acute medications, IV fluids, procedures, consultations, and chronological progress notes—for both Adult and Pediatric cases.
- **Strict Separation: ER Treatment Given ≠ Discharge Medication (Patches C3 & C3A)**: Completely eliminated automatic crossover between acute ER interventions and take-home discharge prescriptions. Acute medications (e.g. IV ceftriaxone, IV paracetamol, nebulizations, noradrenaline infusions) remain strictly anchored to "Medications administered in ER" and "IV Infusions" under `courseInHospital`. The `dischargeMedications` field populates exclusively from explicit discharge prescriptions (`dischargeInfo.dischargeMedications`) with verified positive provenance in explicit take-home prescription contexts (`isMedicationSupportedInContext`). Replaced `formatDischargeMedicationsText` and `mergeDischargeMedications` to prevent ER treatments from auto-populating or appending to discharge prescriptions. Server-side AI prompts and post-safety guards prevent acute ER orders from entering discharge medications, guaranteeing empty discharge medications for admitted/ICU patients and cases without explicit take-home prescriptions.
- **Narrative ER Course in Hospital (Chronological Clinical Prose)**: Generates Course in Hospital as ONE coherent, chronological clinical narrative describing what occurred during the Emergency Department stay in natural professional prose (1-3 paragraphs) without rigid heading labels ("Presentation:", "Investigations:", "Treatment Given:", etc.) or mini-case-sheet dumps. Flow answers why the patient presented, clinically relevant acute findings, ordered/performed investigations and results, treatments and procedures administered, consultations/counselling/refusal, documented reassessments, and final disposition rationale.
- **Live Course-in-Hospital Three-Way Synchronization (Patch C4B)**: Deterministic three-way merge (`mergeAutoCoursePreservingManualEdits`) protects clinician manual modifications, notes, and headings while automatically incorporating new clinical facts from ongoing case updates. Preserves intentional section deletions and keeps finalized summaries permanently frozen.
- **Elimination of Fabricated Facts & Honest Clinical Documentation (Patch C5)**: Enforced strict separation between documented clinical facts and missing/undocumented data across the entire Discharge Summary pipeline. Explicit positive and negative facts are preserved and displayed, while undocumented fields (allergies, brought by, LMP, past history, general examination, diagnoses, course, investigations, and discharge condition) store as blank (`""`) in state and database records, rendering `"Not documented"` strictly as a presentation layer indicator. Removed all unsafe diagnostic fallbacks from differentials, complaint, and past history.
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
- **Complete ABG/VBG Pipeline & Automatic Acid-Base Interpretation (Patch C2)**: End-to-end capture, cumulative multi-turn merging, and deterministic interpretation across all 16 clinical blood gas parameters (`sampleType`, `ph`, `pco2`, `po2`, `hco3`, `be`, `lactate`, `sao2`, `fio2`, `na`, `k`, `cl`, `ag`, `glucose`, `hb`, `aa`). Explicitly discriminates "ABG" vs. "VBG" without defaulting unspecified samples. Automatically triggers the deterministic emergency medicine acid-base engine (`server/aiDiagnosis.ts`) when core acid-base parameters (`pH`, `pCO2`, `HCO3`) are present, classifying primary and mixed disorders via Winters' formula, calculating Anion Gap, flagging VBG $pO_2$ arterial oxygenation warnings, and preserving stated percentage units on $pO_2$ dictations. Results automatically populate Case Sheet ABG diagnosis and interpretation fields while preserving the manual "Interpret ABG" re-analysis button and propagating into printable case sheets and discharge summary bedside adjuncts.
- **Vitals Safety & Pediatric Age-Appropriate Reference Display**: Complete elimination of fabricated vitals (zero default fallback values like 120/80, 80 bpm, or GCS 15; explicitly documented vitals are captured while unmeasured vitals remain blank or null). Presence-aware string mapping (`toClinicalString`) eliminates fallback "0", "Not recorded", and synthetic GCS subscales ("4", "5", "6") in Quick Discharge intake. Composite GCS calculations strictly require all three components (E, V, M) or explicit total, rendering honest missing-component breakdowns without defaulting to 15/15. Deterministic GCS total from explicit E/V/M components (Patch C1) automatically computes and stores `gcs = E + V + M` when all three components are explicitly documented (e.g. "E2V3M4" → gcs="9", gcs_e="2", gcs_v="3", gcs_m="4") while preserving explicit totals ("GCS 14") and rejecting model hallucinations on partial dictations ("GCS E4"). Disability renders across Markdown, HTML, and Preview modal pathways display strictly documented AVPU, GCS, Pupils, and GRBS findings, eliminating hardcoded "Alert", "Equal and Reactive", and "N/A mg/dL". For pediatric patients (age ≤ 16), displays validated age-appropriate normal reference ranges beside measured vitals across Primary Survey, ABCD sections, and Vitals Trends without populating or saving reference ranges as patient data. Evaluates hemodynamic stability and abnormal indicators against age-specific ranges.
- **Single Canonical Scribe Extraction Contract**: Eliminated duplicate sectioned prompt directives (`buildChecklistPromptSection("adult")`) from both primary and fallback extraction prompts (`server/voiceExtraction.ts` and `server/extraction.ts`). Enforced a single, flat canonical schema (`chiefComplaint`, `vitals`, `airway`, `breathing`, `circulation`, `disability`, `exposure`, `vbg`, `fastFindings`, `mlcDetails`, etc.) with fail-loud shape assertion (`assertCanonicalExtractionShape`) that immediately rejects any payload with sectioned keys (`Identity`, `Chief`, `Primary`, `Exam`, `Psych`, `Disposition`, `Signature`) before processing.
- **Surgical Adjuncts Unification (ABG/VBG, ECG, EFAST, Bedside Echo)**: Decoupled the Structured/Manual layer (dropdowns, selectors, numeric values) from the Narrative Findings layer (free text notes and interpretations). Scribe extraction never overwrites manual dropdowns, and existing notes are intelligently appended and deduplicated (`existing; new`). In the case sheet, printable view, and clipboard export, undocumented adjuncts render objectively as `"Not documented"` or `"Not done"`, fully eliminating fabricated normal defaults.
- **Structured Procedure Note System**: Comprehensive clinical documentation engine implementing 7 core ER procedure templates: Foley Catheter Insertion, Central Venous Line (CVC) Insertion, Arterial Line Insertion, RSI / Endotracheal Intubation, Closed Manipulative Reduction, Short Arm Slab, and Ryles / Nasogastric (NG) Tube Insertion. Replaces unguided free-text entry with structured guided forms, strict clinical truth safeguards ("not confirmed = not documented"), automated objective narrative generation, full operator and timeout attribution, Voice Scribe smart detection, and dynamic rendering across Case Sheet, Printable, and PDF exports.
- **Export, Preview & Print Clinical Truth Sanitization (Batch 3a)**: Completely eliminated all remaining hardcoded findings and fallback assumptions ("Patent", "Spontaneous", "Symmetrical bilaterally", "CCT: Normal", "Subcutaneous emphysema: Absent", "EFAST: Negative", "CRT: < 2s", "Distended Neck Veins: No", "IV access", "Logroll: Completed", "NKDA", "Stabilized in Emergency", "Stable", "Dr. Clinician", "Dr. Consultant", "Dr. Nirmal", and ungrounded "°F" labels) from Markdown export, HTML export, the interactive Case Sheet Preview Modal, Adult/Pediatric inlined print records, and Mortality Audit EMR generation. Centralized primary survey serialization (`buildExportPrimarySurvey`) guarantees that every exported/printed section renders strictly genuine stored clinical data or `"Not documented"`.

### 4. Universal Clinical Task Applier (Adult & Pediatric)
- **Natural Language Intent & Task Registry**: Seamless natural-language commands without requiring the clinician to know underlying Case Sheet schemas (e.g., `"add eFAST positive in bladder area"`, `"add in SAMPLE past medical history, allergy, medication as nil. psychological assessment as normal"`, `"send serum cortisol"`, `"add inj paracetamol 1 gm IV stat"`).
- **5-Tier Intent Engine**: Accurately classifies clinician queries into `QUESTION` (returns clinical guidance with zero case mutations), `DOCUMENT_FACT`, `CASE_UPDATE`, `APP_ACTION`, or `MIXED`.
- **Deterministic Disambiguation**: Intelligently handles ambiguous clinical commands (such as distinguishing cardiac enzyme lab values from coronary syndrome diagnostic assessments).
- **eFAST / POCUS Comprehensive Organ Mapping**: Expanded organ mapping covering heart, abdomen, pelvis, bladder, suprapubic, and lungs, reliably populating `fastFindings` and `adjuncts.efastNotes`.
- **SAMPLE History Synchronization**: Unpacks and links SAMPLE sub-objects to flat fields (`allergies`, `pastMedicalHistory`, `currentMedications`, `psychologicalAssessment`), eliminating empty array dropouts and duplicate card rows.
- **Structured Course in Hospital & Explicit Events (Patch C4A, C4A.1 & C4B)**: Organizes the ER Clinical Course under a strict 9-section ordered hierarchy (`Presentation`, `Events Leading to Presentation`, `Initial Assessment`, `Investigations`, `Treatment Given`, `Procedures`, `Consultations`, `Clinical Course`, `Disposition`). Implements strict zero-filler empty-section rules (omits sections without documented facts instead of fabricating verbose absence statements like "none ordered", "none administered", or "unable to characterize"). Strictly eliminates fabricated presenting complaint fallbacks ("acute presentation", "unspecified complaint", "patient presented for evaluation"): when no presenting complaint was documented, the Presentation section is omitted entirely. Isolates explicit precipitating events (`extractPrecedingEvent`) from ordinary symptom chronology (fever, cough, abdominal pain durations remain in Presentation and are never duplicated as events), honors explicit negative history without manufacturing empty event sections, and preserves separation between factual clinical course and patient advice. Introduces live three-way Course synchronization (`mergeAutoCoursePreservingManualEdits`) that automatically flows newly added investigations, treatments, procedures, consultations, progress notes, and dispositions from the Case Sheet / Scribe directly into the open Course in Hospital textarea while strictly preserving clinician manual edits, custom wording, and intentional deletions without marking automatic sync as a manual edit or modifying finalized records.
- **Zero-Fabricated Facts in Discharge Summaries (Patch C5)**: Distinguishes explicitly documented facts from missing or undocumented data across all Discharge Summary generation and presentation paths. Enforces the strict rule that missing information must remain blank in stored records and appear as `"Not documented"` solely in presentation layers, never converted into fabricated clinical assertions. Eliminates false-positive/false-negative defaults: missing allergies never become `"NKDA"` or `"No Known Drug Allergies"`; unrecorded informant/brought-by never defaults to `"Self / Relatives"`; missing LMP, past medical history, and family history never default to `"None recorded"` or `"N/A"`; missing physical exams never fabricate `"Patient conscious, oriented, vitals recorded on arrival."` from heart rate presence; missing primary/secondary diagnoses never default to differentials, symptoms, or past history; and missing course/investigations/medications never claim `"Patient evaluated and stabilized in ER."`, `"No investigations ordered."`, or `"No outpatient medications prescribed."`.
- **Post-Preparation Discharge Summary Safety & Positive Provenance (Patch C3 & C3A)**: Detects when clinical tasks or scribe updates modify a case after a discharge summary was already drafted. Strictly decouples acute ER treatments given in hospital from take-home discharge prescriptions (`dischargeInfo.dischargeMedications`). Enforces item-by-item positive provenance verification (`isMedicationSupportedInContext`): every take-home medication must be positively supported inside an explicit discharge-prescription context (e.g. "Discharge on...", "Discharge with...", "Home medications...", "Take-home medications...", "On discharge..."), completely eliminating reliance on negative blacklists. Structured clinician discharge medications are authoritative, while acute ER medications (IV antibiotics, IV analgesics, fluids, nebulizations) remain exclusively within Course in Hospital. Correctly handles same-drug different-context scenarios (e.g. ER IV Paracetamol vs. Discharge SOS Paracetamol) based on clinical context. Presents an in-app notice and one-click "Refresh Summary from Case" action that non-destructively updates the summary with newly ordered labs, medications, and clinical notes without contaminating discharge prescriptions.

### 5. Mortality & Morbidity Audit Suite
- Generates thorough M&M audit reviews formatted according to hospital quality standards.
- Produces downloadable `.docx` audit documents directly from EMR stay histories.

### 6. Full-Screen Patient Discuss Workspace & Request Resilience (`src/components/CaseDiscussWorkspace.tsx`)
- **Full-Screen GPT-Style Patient Chat Workspace**: Replaced cramped dialog modals with a dedicated full-viewport patient chat interface (mobile full-screen, desktop centered max-w-5xl).
- **Patient Context Integrity**: Delivers exact documented clinical facts (Demographics, Vitals, SAMPLE, Primary Survey, Secondary Survey, Labs, Treatments, Procedures, Progress Notes, Differentials, Disposition, and Pediatric metrics) to the clinical reasoning engine with zero raw UUID exposure (monotonic 9-digit `displayId` only).
- **Expandable Read-Only Patient Context Panel**: Collapsed mode provides an immediate 1-line essential clinical strip (`Bed 14A • 261007001 • 45 M • Chest pain • P1`), while expanded mode renders a complete 2-column read-only summary without editing controls.
- **Single-Patient Focus & Isolated Switching**: Eliminated horizontal multi-case tabs. A compact selector (`Bed 14A · 261007001 ▾`) enables switching between census patients while strictly isolating independent chat histories (`ermate_chat_session_case_${case.id}`).
- **Same-Case Pending Scribe Pass-Through**: When discussing a case with active unapplied Scribe dictation, unapplied fields are passed as `pendingClinicalContext` labeled `PENDING CLINICIAN DICTATION — NOT YET APPLIED TO CASE SHEET`. Enables conversational assistance without mutating `ClinicalCase` or asserting unconfirmed facts as legal chart records.
- **Request Resilience & Bounded Lifecycle**: All Discuss and Scribe network requests enforce 25s/30s client `AbortController` timeouts and bounded server failovers (Claude Sonnet primary → OpenAI fallback). Loading state is unconditionally reset in `finally` across all success, error, timeout, and stale generation paths, permanently resolving indefinite spinner locks. If both providers fail, displays a calm retry notice (`"I couldn't complete that response right now. Please try again."`) without leaking API or provider internals.

### 8. Inline Unlimited Dictation Recorder (`src/components/shared/VoiceRecorder.tsx`)
- **ChatGPT / WhatsApp Style Composer UX**: Completely replaced legacy centered popups and screen-blocking modals with a clean, inline composer-integrated dictation bar.
  - **Idle State**: `[ + ] Type clinical details / questions...     🎙    ➤` (Quick actions button for clinical lenses and report attachments, clean input textarea, subtle mic button, and responsive send button).
  - **Recording State**: `[ 🗑 ]  01:42   ▂▅▃▇▅▂▆   Listening…   [ Pause ] [ ✓ ]` (Fills bottom composer, trash button discards, tabular monospace timer counts continuously, animated waveform visualizer in ErMate teal/cyan/indigo colors, subtle red pulse indicator, pause/resume toggle, and emerald Done button).
  - **Paused State**: `[ 🗑 ]  01:42   waveform paused   Paused   [ Resume ] [ ✓ ]`.
  - **Processing State**: `[ spinner ] Finalizing dictation…` (Seamlessly finalizes transcription and restores normal composer).
- **Unbounded Recording Duration**: Zero artificial client-side recording limits. Supports practical multi-minute ER dictations (1, 3, 5, 10+ minutes) without auto-stop timers. Clinician maintains full manual control to finish (`Done`) or cancel (`Discard`).
- **Strict Distinction: Recording Length vs Post-Dictation API Timeout**:
  - Voice recording is unbounded and user-controlled.
  - Upstream Sarvam transcription streams continuously via real-time WebSocket with bounded closure finalization.
  - Post-dictation extraction and reasoning (`/api/scribe-chat`) enforces a bounded 30-second `AbortController` network timeout with calm retry handling.
- **Screen & Application Lifecycle Safety**:
  - Automatically requests screen Wake Lock on recording start and releases on completion or discard.
  - Guards against accidental work loss during active recording: navigating away, switching cases, or tab switching prompts an explicit confirmation (`"Dictation is still recording. Discard it and leave?"`).
- **Memory Safety & Duplicate Finalization Protection**:
  - Immediate disposal of raw in-memory audio chunks upon finalization, discard, or batch fallback to prevent memory growth during long dictations.
  - Preserved `finalSubmissionSentRef` guard preventing double-finalization across concurrent WebSocket `session_end` and `closed` events.

### 9. MATE Core Foundation & Universal Controller (`src/mate/`)
- **Canonical Bed Model (`src/mate/mateBedModel.ts`)**: Generates physical ER location namespace (base bed numbers + `A`/`B` subdivisions) with normalizers and boundary checks.
- **Case Reference Resolver (`src/mate/mateCaseResolver.ts`)**: Resolves explicit spoken/text bed references against active cases with fail-closed safety semantics (`RESOLVED`, `CURRENT_CASE`, `NOT_FOUND`, `AMBIGUOUS`).
- **Display-ID Case Resolver (`src/mate/mateCaseDisplayResolver.ts`)**: Resolves 9-digit monotonic daily display numbers (`261006004`) and legacy numbers (`C-xxxx`) deterministically against active records without confusing display numbers with internal collision-resistant UUIDs.
- **MATE Universal App Map & Runtime Context (`src/mate/mateAppMap.ts`, `src/mate/mateRuntimeContext.ts`)**: Defines single source of truth for all MATE-visible capabilities (`navigate.*`, `case.open`, `case.section.*`, `case.completeness.review`, `case.discharge.pending`, `case.rounds.review`) and captures ephemeral UI state without duplicating EMR facts.
- **Universal Action Dispatcher (`src/mate/mateActionDispatcher.ts`)**: Dispatches clinician capabilities to existing ErMate UI handlers (`openCase`, `openCaseSection`, `summarizeCase`, `reviewCaseCompleteness`, `reviewDischargeCompleteness`, `reviewRounds`, `navigateApp`).
- **Phase 1 Read + Navigation Invariant**: Zero ClinicalCase mutations or schema modifications exist in Phase 1. MATE acts strictly as natural-language read & navigation control surface.
- **Deterministic Case & Discharge Completeness Audits**:
  - Reuses `getCasePendingStatus(case)` in `src/utils/caseHelper.ts` to report incomplete clinical sections without guessing.
  - Reuses `checkDischargeCompleteness(case)` in `src/utils/dischargeCompleteness.ts` to deterministically audit discharge readiness, missing primary diagnoses, missing medications, follow-up, and pending lab/imaging reports.
- **Whole-Case Explanations**: Queries like `"Mate, explain Bed 14"` route to the existing Clinical Rounds engine (`/api/rounds-debrief`), providing multi-lens clinical reasoning without modifying patient records.
- **Conversational Memory & Mixed-Content Safety**: Remembers recent patient context across pronoun references (`"his investigations"`, `"summarise him"`). Utterances containing clinical facts (PMH, medications, vitals, allergies) are never swallowed as navigation, strictly preserving the Scribe clinical documentation pipeline.
- **Pediatric Routing Invariant**: Age 0–16 strictly routes to Pediatric Case Sheet, age ≥17 to Adult Case Sheet, with unknown age defaulting to adult with confirmation.
- **Traffic-Police & Critical Session Safety (`src/components/VoiceScribeChatView.tsx`)**: Intercepts social and operational commands locally without Firestore writes or false extractions. When switching patients, suspends processing immediately and automatically replays pending utterances once the canonical Scribe session is safely attached.
- **Persistent Floating MATE Sidecar & Action Badge (`src/App.tsx`, `src/components/VoiceScribeChatView.tsx`)**: Accessible via a floating action badge in the bottom-right corner. On desktop/tablet, slides in as a 420px right-hand panel while keeping the live Dashboard, Case Sheets, and Case Lists active and responsive on the left. On mobile, presents an overlay drawer ending safely above bottom navigation. Updates reflect across the Dashboard in real time without page reload or component unmounting.
- **Canonical ER Bed Assignment & MATE Resolution (`src/utils/bedAllocation.ts`, `src/components/TriageForm.tsx`, `src/components/DashboardView.tsx`)**: Decouples stable ClinicalCase identity from physical ER location (`bedNo`). Normalizes all bed representations using `normalizeMateBedId`. Implements locked family occupancy semantics for bare bed inputs and refuses collisions on occupied explicit slots. Resolves spoken bed references directly to assigned existing cases with zero spurious case creations.
- **MATE Conversational Orchestrator & Live UI Wiring (`src/mate/mateFastPath.ts`, `src/mate/mateInterpreterClient.ts`, `src/mate/mateTaskValidator.ts`, `src/components/VoiceScribeChatView.tsx`)**:
  - **Deterministic Fast Path**: Utterances matching greetings, gratitude, patient count, ER census orientation/overview, incomplete case queries, occupied bed queries, exact bed opening, exact display ID opening, or top-level navigation resolve locally with zero server latency.
  - **Server-Side Intent Interpreter & Task Validation (`POST /api/mate/interpret`)**: Non-fast-path requests invoke structured intent interpretation with de-identified context, validating untrusted model tasks deterministically (`validateAndBuildMateTask`) and strictly binding case and bed IDs to deterministic resolvers.
  - **Fail-Closed Disambiguation**: Ambiguous patient references (e.g. Bed 11 when 11A and 11B exist) prompt a single short clarification question without guessing.
  - **Multi-Task & Mixed Content Preservation**: Phrases combining clinical facts with actions (e.g. "Bed 15 BP dropped to 80/50, noradrenaline started. Add it and show me his investigations.") execute operational navigation while delegating clinical facts to Scribe extraction.
  - **Universal Authenticated Fetch**: All VoiceScribeChatView API calls (`/api/rounds-debrief`, `/api/scribe-chat`, `/api/case-discussion`, `/api/scribe-ocr-scan`) use `authenticatedFetch`, passing Firebase ID Bearer tokens with automated authentication error handling.

### 8. Safe Clinical Case ID Architecture (P0 Patch 1)
- **Separation of Concerns (`src/utils/caseIdentity.ts`)**:
  - **Internal ID (`ClinicalCase.id`)**: Collision-resistant UUID (`crypto.randomUUID()`) serving as the immutable Firestore document ID (`/cases/{id}`), Scribe session link (`linkedCaseId`), and backend reference.
  - **Display ID (`ClinicalCase.displayId`)**: Human-facing clinical case number in format `YYMMDD###` (e.g. `261005001`), resetting daily, strictly monotonic from `001` to `999`.
- **Atomic Daily Sequence Transaction (`case_counters/{YYYY-MM-DD}`)**:
  - Incremented via Firestore transactions with optimistic concurrency control. Concurrent patient creation requests from multiple clinicians never collide or produce duplicate display IDs.
  - Hard ceiling at 999: requests exceeding 999 fail closed with an explicit error without wraparound or silent duplicates. Gaps from downstream failures are acceptable; collisions are prevented.
- **Universal Case Creation Audit (`src/App.tsx`)**:
  - All new-case pathways (Triage, MATE draft creation, Voice Scribe extraction, Preview save) reserve an atomic `displayId` and use internal UUIDs.
  - Existing case modifications strictly preserve existing `id` and `displayId`, never generating a new display ID during edits.
  - Scribe sessions link strictly to internal UUIDs; Firestore paths remain `/cases/{internalId}`.
- **Clinician UI Presentation & Legacy Compatibility**:
  - UI views (`DashboardView`, `CasesListView`, `CaseSheetView`, `CaseSheetPrintView`, `HandoverView`, `VoiceScribeChatView`, global search) display `displayId || id`, showing clean human-facing case numbers for new patients while preserving legacy `C-xxxx` records without migration or breaking changes.

### 9. Controlled Replay & MATE Resolution Bypass (P0 Patch 2)
- **Controlled Scribe Replay Bypass (`src/components/VoiceScribeChatView.tsx`)**:
  - Replaying pending utterances (`pendingNewPatientHandoffRef`, `pendingUtteranceAfterSwitchRef`) sets `{ skipMatePatientResolution: true }`, completely bypassing MATE traffic-police, bed-status queries, bed resolution, and new case detection.
  - Prevents the original utterance containing `"New patient in Bed 11..."` from re-entering MATE, completely eliminating duplicate bed allocation (e.g. allocating `11B` after `11A` was occupied by the first pass) and duplicate case creation.
  - Replay routes directly into the existing clinical Scribe extraction pipeline (`/api/scribe-chat`), extracting clinical information (age, gender, complaints, vitals) into the single created patient record.
- **Generation & Session Link Safety**:
  - Stamped `generation` prevents stale handoffs from replaying if context shifted unexpectedly.
  - Pending handoff refs are cleared to `null` before dispatch, guaranteeing exactly-once replay with single-message chat history.

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
> **Department Team Management**: Unified, mobile-first 4-section architecture:
>   1. **Overview**: Live department census, on-duty active count, summary cards (Members, Pending, On Duty, Configured Shifts), and immediate "Today's Team" roster visibility without admin scrolling.
>   2. **Members**: Clinician-friendly "Member Directory" replacing allowlist jargon, single & bulk clinician onboarding, canonical Team Invitation link & mobile QR onboarding, and HOD approval controls.
>   3. **Rota**: Duty schedule with shift filters (All, Morning, Evening, Night, Off), Universal Shift Setup, Google Calendar synchronization, and shift manager modal.
>   4. **Settings**: Hospital/workplace metadata and branding, HOD leadership identity, Hospital Group License panel, and sandbox onboarding simulator.

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
| `/verify_scribe_draft_case_creation.ts` | Verification suite for automatic ClinicalCase shell creation on first clinical Scribe dictation & idempotency |
| `/src/components/TeamRosterBoard.tsx` | Mobile-first 4-tab Department Team Management (Overview, Member Directory, Rota & Shifts, Department Settings) |
| `/verify_team_ui_reorg.ts` | Verification suite for 4 top-level sections, Overview summary cards, Member Directory, and canonical invitation flow |
| `/src/utils/caseLifecycle.ts` | 24-hour incomplete case soft-archive engine, active non-archived census filtering, and clinical record retention |
| `/verify_team_and_archive.ts` | Verification suite for team membership status normalization, invite restoration, HOD claims, and 24h archive |
| `/server/deidentify.ts` | On-the-fly local PHI stripping engine & date-to-relative-timeline converter |
| `/firestore.rules` | P0 Root-of-Trust Firestore Security Rules (Canonical team_members authorization, verified status enforcement, privilege-escalation prevention) |
| `/server/routes/team.routes.ts` | Backend-mediated team governance API (Platform admin provenance verification, exact invite role policy, Auth identity binding, membership lifecycle) |
| `/test_backend_team_auth.ts` | Real-route backend Express team authorization test suite (44 tests covering AP1–AP9, RQ1–RQ4, AC1–AC11, LHOD1–LHOD5, ROLE1–ROLE5, CI1–CI4, DEC1–DEC3, RM1–RM3) |
| `/test_phase3_rules.cjs` | 79-scenario emulator test suite validating full Phase-3 authorization matrix |
| `/test_privilege_escalation_audit.cjs` | Privilege escalation audit test suite verifying strict closure of P1-P11 attack vectors and P12 shift persistence |
| `/src/lib/firebase-admin.ts` | Named Firestore database Admin singleton (`ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03`) |
| `/firebase.json` | Explicit Named Firestore database targeting for `ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03` security rules deployments |
| `/server/clinicalRanges.ts` | Deterministic adult ED reference ranges & zero-hallucination abnormal flagger |
| `/server/alertCompiler.ts` | Rule-based post-synthesis critical alert compiler (Section 0) |
| `/server/crossConsultParser.ts` | Regex-first cross-consultation extractor & duration-conditioned section renderer |
| `/server/handover.ts` | 5-Step Handover extraction pipeline |
| `/server/dischargeSummary.ts` | Auto-Discharge summary synthesizer |
| `/server/extraction.ts` | Voice dictation & clinical case parser |
| `/server/mortalityAudit.ts` | M&M Audit generator & DOCX builder |
| `/src/utils/dutyWindow.ts` | Pure duty window resolver & overnight midnight transition calculator (Patch D1) |
| `/src/services/dutySessionService.ts` | Persisted actual duty session lifecycle & atomic session-safe termination (Patch D2) |
| `/src/utils/roleUtils.ts` | Role normalization & dynamic navigation permissions helper (`getNormalizedRole`) |
| `/src/components/ToolsView.tsx` | Consolidated acute clinical tools hub (Drug Guide, Peds Calculator, Pocket Mirror) |
| `/verify_more_profile_restructure.ts` | Verification suite for 5-section More/Profile Information Architecture, canonical bed capacity, 2-state subscription model & data safety |
| `/src/components/MoreView.tsx` | Reorganized 5-section More & Clinical Hub (My Account, Hospital & ER Setup, Team & Subscription, Clinical Tools, App Settings) |
| `/src/components/CaseSheetPrintView.tsx` | Official read-only, print-formatted Case Sheet document view |
| `/src/components/HandoverView.tsx` | Interactive Handover UI & PHI Protection Toast |
| `/src/components/ProfileSettingsView.tsx` | Settings router delegating canonical profile/account views to MoreView & subviews to TeamRosterBoard / LogBook |

---

*ErMate Clinical OS — Designed for Emergency Care Excellence.*
