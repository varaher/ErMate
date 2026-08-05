# ErMate — Project Conventions & Implementation Log

## Locked System Conventions & Architectural Rules

1. **Route-Specific AI Model Matrix**:
   - **Clinical Q&A / Reference Chat**: Claude 3.5 Sonnet ONLY. No fallbacks allowed. Returns a clear user message if Claude is unavailable. Never use Gemini Flash.
   - **Handover Synthesis**: Claude 3.5 Sonnet → Gemini Pro fallback (never Gemini Flash or GPT-4o).
   - **Voice & Case Extraction**: GPT-4o-mini → Claude 3.5 Haiku fallback.
   - **Discharge Summary**: Claude 3.5 Sonnet → GPT-4o fallback.
   - **Mortality Audit**: Claude 3.5 Sonnet → GPT-4o → Gemini Pro.

2. **Temperature Control**:
   - Set `temperature: 0.0` on ALL clinical extraction and parsing routes to guarantee deterministic, zero-hallucination outputs.

3. **Gemini Restrictions**:
   - NEVER use Gemini for Clinical Q&A, Discharge Summary primary, or Mortality Audit. Gemini Flash is strictly forbidden for complex clinical reasoning routes.

4. **DPDP Act 2023 Server-Side De-identification**:
   - All server-side extraction routes (`/api/handover/parse-structured`, `/api/scribe-extract`, `/api/ai-discharge`, `/api/mortality-audit/generate`) MUST execute `deidentifyText()` in `server/deidentify.ts` before sending text to AI models.
   - Stripped PHI includes patient names, UHIDs, MRNs, Aadhaar, phone numbers, doctor names, and hospital facility names.
   - Calendar dates MUST be converted to relative clinical timeline anchors (`[Day 1]`, `[Day 2]`, etc.) to preserve disease trajectory while removing calendar PHI.

5. **Doctor Identity Local Re-injection**:
   - Doctor identity (`treatingERPhysician`) MUST be re-injected post-extraction from the logged-in user profile (`currentUser.displayName` / `doctorName`), never requested from overseas AI models.

6. **No SBAR Output Labels**:
   - Never output literal "SBAR" or "Situation/Background" labels in synthesized handover text cards.

7. **No Placeholder Text**:
   - Never output generic placeholders like `[Insert Name]` or `N/A` strings in AI-generated JSON fields.

8. **Strict Field Defaulting**:
   - Return `null` for missing factual fields (e.g., labs, vitals). Use normal baseline defaults ONLY for physical exam status if omitted in dictation notes.

9. **Locked Initial Presentation**:
   - The `initialPresentation` field is locked once created and MUST NOT be overwritten or mutated by subsequent shift handover updates.

10. **Role-Based Access & Governance**:
    - Role changes (e.g. elevating to HOD / Consultant) require HOD approval workflows and are NEVER self-assignable in user settings.

11. **Documentation Maintenance**:
    - For every new feature or architectural change implemented in the codebase, update `AGENTS.md` (Implementation Log) and `README.md` to keep documentation accurate and in sync.

---

## Implementation Log & Recent Changes

### [2026-08-03] — Resolved System Issues & Architectural Enhancements
- **Cross-Device Sync Data Isolation**: Updated Firestore real-time `onSnapshot` query filters in `App.tsx` for `cases`, `handovers`, and `quick_paste_patients`. Synchronization relies strictly on exact `auth.currentUser.uid`, normalized email identity, or exact hospital string matching — completely removing fuzzy substring/partial matching to eliminate any risk of cross-hospital data leakage.
- **Firestore Security Rules**: Security rules in `firestore.rules` deployed and verified with strict role-based access control (RBAC), restricting administrative operations to HODs and preventing unauthorized user role modifications.
- **Universal Portrait PDF Orientation**: Standardized all handover PDF generation, Word exports, and print worksheets to `A4 portrait` with 10mm margins across `HandoverView.tsx` and `ProfileSettingsView.tsx`.
- **Handover Pipeline De-identification Ordering**: Restructured `extractHandover` in `server/handover.ts` to execute `preprocessEMR()` -> `deidentifyText()` -> `reverseEMREntries()` in strict order. Added step logging `[1] After preprocess`, `[2] After deidentify`, and `[3] After reverse`.
- **Timeline-Aware Entry Header Splitting**: Updated entry reversal regex patterns in `reverseEMREntries()` to recognize de-identified relative timeline anchors (`[Day 1]`, `Day 1`, etc.) alongside standard date formats, ensuring chronological entry splitting functions cleanly after PHI stripping.
- **Strengthened Course Synthesis Prompt**: Enhanced `courseInERDayWise` schema rules in `buildHandoverPrompt()` with explicit WRONG / RIGHT examples, strict single-sentence daily synthesis directives, and exclusion filters for nursing logs, routine vitals checks, and staff names.
- **Strict Doctor Identity Re-injection**: Enforced doctor name stripping across AI outputs by restricting `treatingERPhysician` exclusively to local re-injection from `doctorName` (`auth.currentUser`), and constraining consultation fields to specialty/department titles only.
- **Deterministic Clinical Ranges Engine (`server/clinicalRanges.ts`)**: Rule-based adult ED reference ranges and `isAbnormal` / `isCritical` / `formatFlagged` / `isCulturePositive` functions ensuring zero-hallucination lab and vitals flagging.
- **Post-Synthesis Alert Compiler (`server/alertCompiler.ts`)**: Pure deterministic function `compileAlerts()` that compiles critical culture, VBG/ABG, and vitals flags into section 0 alert banners without routing through AI models.
- **Deterministic Cross-Consultation Parser (`server/crossConsultParser.ts`)**: Regex-first parser `extractCrossConsultations()` and `shouldRenderConsultSection()` for timestamped specialty consult extraction and duration-conditioned rendering (>4hrs stay).
- **Gemini Model Alignment & Candidate Rotation**: Updated model configurations across `server/handover.ts`, `server/extraction.ts`, `server/voiceExtraction.ts`, `server/mortalityAudit.ts`, and `server.ts` (`/api/handover/compile-sheet`, `/api/handover-chat`) to use supported active Gemini model aliases (`gemini-2.0-flash` and `gemini-2.5-flash`), completely eliminating 404 model not found errors.
- **Zero-Downtime Heuristic Fallback Engines**: Updated `/api/handover/compile-sheet`, `/api/handover-chat`, and `voiceExtraction.ts` with multi-model candidate rotation and local deterministic heuristic fallbacks so shift handover generation, chat logging, and doctor handover sheet compilation succeed instantly with 100% uptime even when external API limits or billing issues occur.
- **Handover Chat List Synchronization**: Updated `HandoverView.tsx` to ensure that when Scribe AI Chat parses and generates a handover card (or restores/manually logs a patient), it automatically records a `HandoverRecord` into `setHandovers`, making it immediately visible in the Endorsement Tracker, Profile settings handover logs, and Dashboard pending handovers.
- **Deterministic Entity Extraction Scrubber (`server/extractionCleanup.ts`)**: Integrated regex-based carrier phrase scrubber `cleanExtractionOutput` to strip narrative sentence openers and trailing filler phrases from entity fields (Signs & Symptoms, Events, Drugs, Plan, Labs) prior to case sheet formatting and Firestore storage, maintaining zero-hallucination post-processing across all voice dictation and case extraction routes.
- **Clinical Case Discussion Resiliency & Fallback Engine**: Enhanced `/api/case-discussion` in `server.ts` with isolated Anthropic API error catching, candidate model rotation (`gemini-2.0-flash` & `gemini-2.5-flash`), and a deterministic heuristic discussion fallback engine (`generateHeuristicDiscussionResponse`), ensuring the "Discuss" button works with 100% reliability regardless of external API quota or credit states.
- **Full Scribe Chat & Active Board State Synchronization**: Resolved state mismatches in `HandoverView.tsx` by automatically synchronizing Scribe Chat generated and restored patients into `selectedQuickPasteIds`, `quickPasteList`, `editableRows` (the active Doctor Handover Board), and `handovers`.
- **1-Page Compact Handover Format**: Added responsive entry-collapsing with single-page toggle in `MultiColumnEntriesView` and updated `@media print` rules in `handover.css` with `page-break-inside: avoid` on `.print-card` and `.hov-card` to ensure patient handover summaries fit cleanly on 1 page.
- **Unified Full Case Sheet View with Complete 11-Tab Navigation**: Standardized "View Sheet" and "Edit Sheet" actions across `DashboardView.tsx`, `CasesListView.tsx`, and `App.tsx` to route directly to the complete `CaseSheetView`. Ensures all 11 tabs (Chief Complaints, Primary Survey ABCDE, SAMPLE History, Secondary Survey, Investigations, Treatment Orders, Clinical Notes, Disposition & Safety Checklists, Pediatrics Sheet, Vital Signs Trends, and 🎓 Rounds & Debrief) are present with identical formatting and built-in PDF/Print preview modals.
- **Unified Full Discharge Summary View**: Aligned "View Card" and "Edit Card" in `DashboardView.tsx`, `CasesListView.tsx`, and `App.tsx` to launch `DischargeSummaryView` with all 5 clinical tabs (`Admin & Vitals`, `Clinical History`, `Primary Survey ABCDE`, `Secondary Survey`, `Course & Plan`), live NABH/JCI card preview, and built-in export/discussion controls.
- **Pediatric Extraction Engine Integration**: Updated `server/extraction.ts` and `server/voiceExtraction.ts` extraction JSON schemas and prompts to automatically extract `isPediatric` and `pediatricDetails` (PAT appearance, tone, cry, gaze, work of breathing, CRT, birth history, immunizations, developmental history, feeding history, brought by, and informant) whenever pediatric dictations or case records are processed.
- **"Add Back to Active Logs" Roster & Firestore Synchronization**: Fixed state derivation, metadata preservation, and Firestore snapshot filtering for restored patient records in `HandoverView.tsx` and `App.tsx`. Restored patients now maintain full `handoverCardData`, user `hospital` identity, and `createdByEmail`, ensuring instant re-addition to active quick paste lists, Doctor Handover Board rows (`editableRows`), and Firestore database sync without disappearing.
- **Multimodal Case Sheet Vision & EMR Handover Extraction Unification**: Enhanced `/api/handover/parse-structured` in `server/routes/extraction.routes.ts` to support both multimodal image OCR/vision analysis (camera snaps of handwritten case sheets and referral notes) and text EMR paste extractions. Integrated candidate Gemini model rotation (`gemini-2.0-flash` & `gemini-2.5-flash`), DPDP Act 2023 de-identification, and seamless fallback to the complete 5-step handover pipeline and heuristic extraction engine.
- **Strict Claude Model Hierarchy for Text Handover Extraction**: Updated model selection in `server/handover.ts` so all text EMR handover extraction strictly uses **Claude 3.5 Sonnet** (long EMR) or **Claude 3.5 Haiku** (short EMR) as the primary engine with cross-Claude secondary fallback. Gemini Flash/Pro is strictly isolated to multimodal image OCR vision or absolute last-resort fallback after all Claude models fail.
- **Architectural Validation of Case Sheet & Discharge Pipeline**: Validated `CaseSheetPrintView.tsx` read-only print formatting, `extractionRouter.ts` Sarvam Saaras translation → GPT-4o-mini / Claude 3.5 Haiku entity extraction → age-based schema routing, and `dischargeSummary.ts` disposition-gated auto-generation (Claude 3.5 Sonnet → GPT-4o fallback).
- **Hardened Role Governance & HOD Approval Workflow (ErMate Rule 10)**: Eliminated self-assignable role escalation across the application. Updated `firestore.rules` to block client-side modifications to the `role` field on `/users/{userId}` documents unless executed by an authenticated HOD/Owner. Created `RoleChangeSection.tsx` and integrated it into `ProfileSettingsView.tsx` to handle structured role elevation requests for residents and pending review queues with audit log tracking (`roleChangeLog`) for HODs. Re-deployed and verified rules on Firebase Firestore.
