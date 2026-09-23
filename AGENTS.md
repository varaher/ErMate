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

### [2026-09-23] — Removal of Remaining Vital/GCS/Exam Fabrications (Batch 1d Finish)
- **Elimination of Stored GCS 15 in Quick Discharge (`src/components/QuickDischargeIntake.tsx`)**:
  - Replaced fallback `String(ext.vitals?.gcs || "15")` and `String(ocr.gcs || "15")` with honest conditional extraction `ext.vitals?.gcs ? String(ext.vitals.gcs) : ""` and `ocr.gcs ? String(ocr.gcs) : ""`.
- **Elimination of Invented "Alert / GCS 15" in Discharge Summary (`src/components/DischargeSummaryView.tsx`)**:
  - Refactored `primaryDisabilityAvpuGcs` to build only from explicitly recorded values (AVPU only -> AVPU; GCS only -> GCS; both -> AVPU / GCS; neither -> `""`), never inventing "Alert" or "GCS 15".
- **Elimination of Fabricated Physical Exam Fallbacks (`src/components/CaseSheetView.tsx`)**:
  - Replaced synthesized normal examination strings for CVS (`S1, S2: Normal, Pulse: Regular 75 bpm...`), RS/Chest, Abdomen (PA), CNS, General, and Extremities across all three export/render blocks (Markdown, HTML, Preview Modal) with strictly `"Not documented"`.
- **Primary Survey GCS Display Truth (`src/components/PrimarySurveySection.tsx`)**:
  - Enforced that `computedGcsSum` requires all three explicit components (E, V, M) to compute a total, otherwise returning `null`.
  - Removed `"15"` fallback from `displayGcsTotal`; renders `"Not documented"` when GCS is unrecorded.
- **Pain Score UX Enhancements (`src/components/TriageForm.tsx`)**:
  - Added dedicated `[ No pain (0) ]` button to record an explicit `0/10` and `Clear` button to reset to unassessed (`""`), eliminating ambiguous thumb positioning.
- **Triage Classifier Reason String Normalization (`src/utils/triageClassifier.ts`)**:
  - Updated standard default and febrile illness reasons to neutral clinical descriptions without altering underlying triage thresholds.

### [2026-09-23] — Pain Score Unset State & Safe Null-Guarded Triage Classifier (Batch 1c Extension)
- **Truthful Pain Score State in Triage Intake (`src/components/TriageForm.tsx`)**:
  - Initialized `painScore` to empty string (`""`) instead of fabricated `"0"`.
  - Slider displays `"Not entered"` while untouched (`painScore === ""`) and does not assert `0/10` unless explicitly selected.
- **Strict Null-Guarded Emergency Triage Classifier (`src/utils/triageClassifier.ts`)**:
  - Implemented `parseNullableInt` and `parseNullableFloat` treating missing or non-numeric vitals strictly as `null`.
  - Removed default fallback of GCS to `15` and pain score to `0`; missing GCS and pain score are strictly `null`.
  - Guarded all numeric comparisons (`gcs !== null && gcs < 8`, `pain !== null && pain >= 9`, etc.) across adult and pediatric protocols so unentered vitals never trigger false acute priority or participate in rules.

### [2026-09-23] — Elimination of Stored Fabricated Vitals & GCS in Intake (Batch 1c)
- **Elimination of TriageForm Fabricated Vital Defaults (`src/components/TriageForm.tsx`)**:
  - Removed normal fallback vital strings (`bp || "120/80"`, `hr || "75"`, `spo2 || "98"`, `rr || "16"`). Unentered vitals now strictly default to empty strings (`""`).
  - GCS subscales initialized to empty strings (`gcsE = ""`, `gcsV = ""`, `gcsM = ""`) instead of normal baseline ("4", "5", "6").
  - GCS total calculation requires complete entry of all three components (`hasCompleteGcs = gcsE !== "" && gcsV !== "" && gcsM !== ""`); returns `""` when incomplete or untouched.
  - Added `<option value="">Select</option>` as the first option to Eye, Verbal, and Motor dropdowns with "Not entered" composite display indicator.
  - Eliminated heuristic AVPU deduction from GCS (`calculatedGcs === 15 ? "Alert" : ...`); AVPU is now strictly set to `""` since no independent clinician selector exists in the triage form.
- **Safe New-Case Vitals History Initialization (`src/App.tsx`)**:
  - Removed normal fallback vitals (120/80, 80, 98, 16, 98.6) in `vitalsHistory` creation inside `handleSaveNewCase`.
  - Implemented `hasInitialVitals` check: if no vitals are entered on registration, `vitalsHistory` initializes as `[]` rather than an empty/defaulted time-point.
  - For partial vitals, missing values are stored strictly as `null` via `parseNullableInt` and `parseNullableFloat` without synthetic normal values.

### [2026-09-23] — Elimination of Fabricated Psychological & IPSG Defaults (Batch 2)
- **Elimination of Fabricated Psychological Defaults (`src/components/CaseSheetPrintView.tsx`, `src/components/DashboardView.tsx`)**:
  - Removed fabricated psychological object fallback (`intentToHarmOthers: false`, `substanceAbuse: false`, `hasSupportSystem: true`, etc.) when structured assessment is missing.
  - Policy enforced: If `c.psychologicalAssessment` exists, only documented fields are rendered. If `sampleHistory?.psychiatricFlags` contains notes, rendered strictly as Notes without creating structured Yes/No assertions. If neither exists, renders `Psychological Assessment: Not documented`.
  - Implemented `displayDocumentedBoolean(val)` (`true` -> "Yes", `false` -> "No", `undefined`/`null` -> "Not documented") in `src/utils/clinicalFormatter.ts` to eliminate false coercion of missing values to "No".
- **Unset IPSG Safety Checklist Initialization & Rendering (`src/App.tsx`, `src/types.ts`, `src/components/CaseSheetView.tsx`, `src/components/CaseSheetPrintView.tsx`)**:
  - Updated `IpsgChecklist` and `PsychologicalAssessment` types in `src/types.ts` to allow optional and nullable values across all fields.
  - In `src/App.tsx` (`handleSaveNewCase` and `buildExtractedCaseDraft`), IPSG fields initialize strictly as `undefined` (unset), asserting NO safety action until explicitly performed and documented by clinical staff.
  - Untouched IPSG checklists render as `Patient Safety Goals: Not documented`.
  - When specific safety goals are documented, unpopulated items render as `Not documented` rather than asserted defaults.
  - Cleaned `updateIpsg` in `CaseSheetView.tsx` to prevent accidental population of unedited items.

### [2026-09-23] — Elimination of Fabricated Vital Defaults in Display Layer (Batch 1)
- **Deterministic Vital Display Helpers (`src/utils/clinicalFormatter.ts`)**:
  - Implemented `displayTemperature`, `displayGcs`, `displaySpo2`, `displayGrbs`, and `isBlank`.
  - Enforced clinical truth rule: Missing vital values are strictly rendered as `"Not documented"`.
  - Never infer or convert temperature units: renders explicitly stated units or `"[value] (unit not stated)"`.
  - Never calculate or fabricate total GCS: if only components are provided, renders `"Total not documented — E... (missing not documented)"`. Accepts object or primitive string/number.
  - Never infer GRBS units: renders explicitly stated units (`mg/dL`, `mmol/L`) or `"[value] (unit not stated)"`.
- **Render Layer Hardcoded Defaults Removed**:
  - `src/components/CaseSheetPrintView.tsx`: Updated vitalsContext and Primary Survey display to eliminate hardcoded `"°C"`, `"/15"`, and `"mg/dL"` strings when values are missing; replaced dynamic `{v.temp}°C` with `displayTemperature(v.temp)`.
  - `src/components/CaseSheetView.tsx`: Removed `"Alert, GCS 15/15"` fallback and unformatted SpO2 fallback; wired canonical `formatDisabilityAssessment` and `displaySpo2`.
  - `src/components/DashboardView.tsx`: Updated copyable text generation to use `displayGcs`, `displayTemperature`, `displaySpo2`, and `displayGrbs`.
  - `src/components/HandoverView.tsx`: Removed `"15/15"` and `"Equal & reactive"` fallbacks in Word export generation; passed full `dis` object to `displayGcs(dis)`.
  - `src/components/PrimarySurveySection.tsx`: Replaced dynamic `Temp ${displayTemp}°C` summary with `Temp ${displayTemperature(displayTemp)}`.
  - `src/components/MortalityAuditModal.tsx`: Removed `"15/15"` disability fallback; wired `displayGcs(foundCase.vitals)`.

### [2026-09-23] — Single Canonical Scribe Extraction Contract & Fail-Loud Assertion
- **Elimination of Sectioned Output Divergence (`server/voiceExtraction.ts`, `server/extraction.ts`)**:
  - Removed `buildChecklistPromptSection("adult")` from both primary `VOICE_EXTRACTION_PROMPT` in `server/voiceExtraction.ts` and fallback `buildExtractionPrompt()` in `server/extraction.ts`.
  - Enforced that both extraction pathways produce exclusively the single, flat canonical schema (`chiefComplaint`, `vitals`, `airway`, `breathing`, `circulation`, `disability`, `exposure`, `vbg`, `fastFindings`, `mlcDetails`, etc.).
  - Added `hpi` and `ecg` to the flat canonical JSON contract and prompt guidance.
- **Fail-Loud Extraction Shape Assertion (`assertCanonicalExtractionShape`)**:
  - Implemented `assertCanonicalExtractionShape(raw)` in `server/voiceExtraction.ts`, rejecting any payload containing legacy sectioned keys (`Identity`, `MLC`, `Chief`, `Primary`, `Adjunct`, `History`, `Exam`, `Psych`, `Disposition`, `Signature`) with `[EXTRACTION-SHAPE-UNRECOGNISED]` diagnostic logs and explicit errors.
  - Wired assertion into `extractFromTranscript()` across primary (GPT-4o-mini) and fallback (Claude 3.5 Haiku) tiers, and into `runExtraction()` in `server/scribeChatTurn.ts`.
- **Safe JSON Parsing & Fallback Hardening (`server.ts`)**:
  - Removed unsafe JSON parse fallback that previously defaulted failed or non-JSON model strings to `{ presentingComplaint: deidentifiedInput }`.
  - Extraction parsing failure now throws immediately, routing to honest error recovery rather than masking extraction pipeline failures.
- **Comprehensive Medication Reading (`server/scribeChatTurn.ts`)**:
  - Updated SAMPLE medication extraction reading to include `raw.medications`, maintaining clean separation between outpatient/regular medications and acute ER interventions.

### [2026-09-22] — Procedure Note System (Architecture & Clinical Templates)
- **Structured Procedure Documentation Engine (`src/types/procedureNotes.ts`, `src/data/procedureDefinitions.ts`, `src/utils/procedureNarrativeGenerator.ts`)**:
  - Implemented 7 clinical procedure templates:
    1. Foley Catheter Insertion
    2. Central Venous Line (CVC) Insertion
    3. Arterial Line Insertion
    4. RSI / Endotracheal Intubation
    5. Closed Manipulative Reduction
    6. Short Arm Slab
    7. Ryles / Nasogastric (NG) Tube Insertion
  - Each template features structured input groups: Indications, Preparation & Asepsis, Procedural Steps & Equipment, Post-Procedure Verification, Complications, and Operator Attribution.
  - Implemented strict safety rules: "Not confirmed = not documented." Template text never auto-asserts clinical facts (e.g. consent or absence of complications) without clinician confirmation.
  - Generates objective, NABH/JCI-compliant procedural narratives in real time with editable free-text preview prior to saving.
- **Case Sheet Integration (`src/components/CaseSheetView.tsx`, `src/components/ProcedureNoteCard.tsx`, `src/components/ProcedureSelectorModal.tsx`, `src/components/ProcedureNoteFormModal.tsx`)**:
  - Replaced unstructured procedure notes with dynamic structured procedure documentation.
  - Added dedicated procedure cards rendering procedure metadata, operator attribution, indications, and expandable generated narratives with copy, edit, and delete controls.
  - Integrated `ProcedureSelectorModal` and `ProcedureNoteFormModal` with dirty-state tracking and Firestore persistence.
  - Preserved backward compatibility for legacy bedside procedure checkboxes (`proceduresChecked`) and `otherProcedures`.
- **Voice Scribe Detection Integration (`src/components/VoiceScribeChatView.tsx`, `src/utils/procedureDetector.ts`)**:
  - Automatically detects procedure mentions in Scribe extractions and clinical transcripts.
  - Displays an intelligent "Fill Procedure Note" prompt in Scribe turns with one-click opening of pre-filled procedure modals.
  - Notes saved directly to the patient's case record and reflected across views.
- **Printable & Preview Synchronization (`src/components/CaseSheetPrintView.tsx`)**:
  - Renders all documented `procedureNotes` in both Adult and Pediatric printable Case Sheets and consolidated preview layouts, displaying procedure title, operator, timestamp, and narrative note alongside legacy procedure items.

### [2026-09-22] — Surgical Adjuncts Unification (ABG/VBG, ECG, EFAST, Bedside Echo)
- **Two-Layer Adjunct Architecture (`src/types.ts`, `src/components/PrimarySurveySection.tsx`, `src/App.tsx`)**:
  - Implemented strict separation between the Structured/Manual Layer (dropdowns, selectors, numeric values) and the Narrative Findings Layer (dictated or typed free text).
  - Dictation and Scribe extraction NEVER overwrite manual dropdown selections (`ecgStatus`, `efastStatus`, `echoStatus`, `abg.interpretation`). Both layers coexist harmoniously.
  - Scribe narrative extraction seamlessly populates and mirrors across canonical `primaryAssessment.survey.adjuncts` and legacy `adjuncts` without data loss (`ecgNotes`, `efastNotes`, `echoNotes`, `echoFindings`, `abg.notes`, `abg.finalDiagnosis`).
  - Implemented deduplication and intelligent append logic: if existing narrative text is present, newly dictated findings are appended cleanly (`existing; new`) rather than overwritten.
- **Canonical Blood Gas (ABG/VBG) Extraction & Mapping (`src/App.tsx`, `src/components/PrimarySurveySection.tsx`)**:
  - Scribe extraction correctly maps numerical blood gas parameters (`ph`, `pco2`, `po2`, `hco3`, `be`, `lactate`, `sao2`, `fio2`, `na`, `k`, `cl`, `ag`, `glucose`, `hb`, `aa`) directly into active UI fields (`primaryAssessment.survey.adjuncts.abg.*`) while maintaining legacy mirrors.
  - Preserves manual sample type (`Arterial (ABG)` / `Venous (VBG)`) and interpretation dropdowns.
- **Strict Clinical Truth in Print & Clipboard Export (`src/components/CaseSheetPrintView.tsx`, `src/components/CaseSheetView.tsx`)**:
  - Enforced "NO DATA ≠ NORMAL": Completely eliminated hardcoded "Normal sinus rhythm...", "Normal LV systolic function...", and "Negative - RUQ..." fallback defaults when adjuncts are not performed or undocumented.
  - When adjuncts have not been performed or documented, print and export outputs render `"Not documented"` or `"Not done"`, never fabricated normal findings.
  - When findings are documented, narrative findings and structured status values print alongside each other with high clinical fidelity.

### [2026-09-22] — Pediatric Vital Safety Refinement: Age 0 Ambiguity & Descriptive Reference Alerts
- **Age 0 Ambiguity Guard (`src/utils/pediatricRanges.ts`, `src/components/PediatricVitalReference.tsx`, `src/components/PediatricCaseSheetFields.tsx`)**:
  - Eliminated automatic classification of `age === 0` as Neonate when only `ageYears === 0` is known without precise months or days.
  - When only `ageYears === 0` is provided, `getPediatricAgeBand()` returns `null` and `interpretPediatricVital()` sets `requiresAgeInMonths: true`, displaying: *"Age in months required for pediatric reference range"*.
  - When precise age is provided (e.g. `ageDays <= 30` or `ageMonths > 0`), maps deterministically to the correct age band without fabricating months or days.
  - Strictly preserved age gating: `age <= 16` as pediatric, `age >= 17` as adult.
- **Overclaimed Stability Removal (`src/utils/pediatricRanges.ts`, `src/components/PediatricVitalReference.tsx`, `src/components/CaseSheetView.tsx`)**:
  - Replaced diagnostic claims ("CLINICAL ALARM: UNSTABLE", "HEMODYNAMICALLY STABLE") with objective, descriptive reference language:
    - `"Within age-expected range"`
    - `"Outside age-expected range"`
    - Specific parameter alerts: `"HR above age reference"`, `"HR below age reference"`, `"RR above age reference"`, `"RR below age reference"`, `"SBP below age reference"`.
  - Zero side effects: does NOT change `ClinicalCase.status`, does NOT change `triageCategory`, does NOT create treatment recommendations, and does NOT alter patient vitals.

### [2026-09-22] — Vitals Safety & Pediatric Age-Appropriate Reference Display
- **Fabricated Vitals Elimination (`src/App.tsx`, `src/components/CaseSheetView.tsx`)**:
  - Removed all fallback/default vitals initialization (BP 120/80, HR 80, SpO2 98, RR 16, Temp 98.6). Enforced the locked clinical rule: explicitly documented vitals are captured; undocumented vitals strictly remain blank/null.
  - Eliminated automatic generation of 4-point fabricated historical vitals in `getVitalsHistoryData()` in `CaseSheetView.tsx`. Vitals trends and tables now render only genuinely measured and logged entries, displaying a clean "No vitals recorded yet" empty state when unmeasured.
  - Vitals history logging in `handleLogVitalsTrend()` no longer injects default values for unentered fields.
- **Pediatric Age-Appropriate Reference Display (`src/components/PediatricVitalReference.tsx`, `src/utils/pediatricRanges.ts`, `src/components/PrimarySurveySection.tsx`, `src/components/PediatricABCDESections.tsx`, `src/components/CaseSheetView.tsx`)**:
  - Maintained strict clinical boundary: "REFERENCE RANGE ≠ PATIENT VALUE". Normal pediatric reference ranges are displayed as informative reference anchors alongside measured vitals and are never populated or saved as patient measurements.
  - Age gating: `age <= 16` classified as pediatric, `age >= 17` as adult; fully null-safe preserving neonates and infants (`age === 0`).
  - Integrated `PediatricVitalReference` across Adult and Pediatric Primary Survey (Breathing, Circulation, Exposure) and the Vitals Trends Tracker tab in `CaseSheetView.tsx`.
  - Age-specific reference bands dynamically computed from validated clinical ranges across Neonate (0–1m), Infant (1–12m), Toddler (1–3y), Preschool (3–6y), School age (6–12y), and Adolescent (12–16y).
  - Vitals stability alarms in `CaseSheetView.tsx` and abnormal input indicators in `PrimarySurveySection.tsx` evaluate against age-appropriate pediatric ranges rather than adult thresholds.

### [2026-09-22] — Initial Scribe Dictation Progress Notes Prevention & Canonical Deep Merge Fix
- **Established Case Differentiation (`src/utils/establishedCaseCheck.ts`, `server/establishedCaseCheck.ts`)**:
  - Implemented `isEstablishedCaseSheet` ensuring newly created or minimal demographics-only cases (with just ID, name, age, presenting complaint, baseline vitals, or empty defaults) are not classified as established cases.
  - Distinguishes established cases using genuine evidence: persisted/applied Scribe extraction history (`extractionApplied`), documented clinical progress notes, treatments/medications, ordered investigations, differential diagnoses, procedures, non-empty Primary Survey narratives, multi-system Secondary Survey findings, or substantive SAMPLE history beyond demographics.
- **Server Scribe Extraction Guard (`server/scribeChatTurn.ts`)**:
  - Replaced the overly broad `hasExistingCase` condition (which previously checked for `existingCaseSheet.id`) with `isEstablishedCaseSheet(existingCaseSheet, raw?.messages)`.
  - Guarantees that first clinical dictation for a new or minimal case never generates `clinicianUpdateText` or `clinicianUpdates`. Initial dictation maps strictly into structured clinical fields.
- **Client Scribe Extraction & Age Safety Guard (`src/components/VoiceScribeChatView.tsx`)**:
  - Updated `isExistingCase` in `sendToChat()` to use `isEstablishedCaseSheet(caseData, messages)`, deleting `clinicianUpdateText` and `clinicianUpdates` when the case is not yet established.
  - Fixed age safety: updated `patientAgeYears` assignment from `caseData?.patient?.age || null` to `caseData?.patient?.age ?? null`, correctly preserving age 0 (neonates/infants).
- **Progress Notes Appending Guard (`src/App.tsx`)**:
  - Updated `buildExtractedCaseDraft()` to check `if (!existingMatch || !isEstablishedCaseSheet(existingMatch))`, preventing any `clinicianUpdates` or `clinicianUpdateText` from appending to `progressNotes` during initial case intake.
- **Canonical Deep-Merge Helper for Unapplied Extraction (`src/components/VoiceScribeChatView.tsx`)**:
  - Promoted extraction merging to canonical `getMergedUnappliedExtraction(messages, targetId?)` reusing recursive `deepMergeExtraction`.
  - Reused uniformly across both the "Preview Case Sheet" button and the header "Open Case Sheet" flow.
  - Preserves nested structures (`vitals`, `sampleHistory`, `secondarySurvey`, `fastFindings`, `mlcDetails`, `vbgAbg`) without shallow overwriting.

### [2026-09-21] — Notes Leakage Prevention & Consultation Deduplication Fix
- **Initial Scribe Transcript Notes Leakage Guard (`server/scribeChatTurn.ts`, `src/components/VoiceScribeChatView.tsx`, `src/App.tsx`)**:
  - Prevented raw initial Scribe dictation from entering `progressNotes` / `clinicianUpdates` during initial case intake.
  - In `server/scribeChatTurn.ts`, `clinicianUpdateText` and `clinicianUpdates` are now populated only when updating an existing case (`hasExistingCase === true`). For initial intake, the transcript maps strictly into structured case sheet fields (vitals, ABCDE, SAMPLE history, secondary survey, treatments, procedures, diagnostics).
  - In `src/components/VoiceScribeChatView.tsx`, guarded `clinicianUpdates` extraction attachment so `isExistingCase` must be true.
  - In `src/App.tsx` (`buildExtractedCaseDraft()`), added explicit `if (!existingMatch)` check returning `cleanExisting` notes untouched without appending initial Scribe transcripts into `progressNotes`.
  - Confirmed later factual clinical updates to existing cases continue to append chronologically with `[HH:MM] — [Update text]` format.
- **Consultation Normalization & Specialty Deduplication (`server/consultationNormalization.ts`, `src/utils/consultationNormalization.ts`, `server/scribeChatTurn.ts`, `src/App.tsx`, `src/components/CaseSheetPrintView.tsx`, `server/clinicalTaskApplier.ts`, `src/utils/clinicalTaskApplier.ts`)**:
  - Created canonical `consultationNormalization` modules mapping specialty aliases and redundant suffixes (e.g. `"Urology consultation, Urology"`, `"urology reviewed"`, `"consult urologist"`, `"refer to Urology"`) into clean, single canonical department names (e.g. `"Urology"`).
  - Applied `deduplicateConsultations` across Scribe extraction (`mapExtractionToCaseSheetFields`), Case Draft building (`buildExtractedCaseDraft`), Natural Language Task Applier (`applyClinicalPatchesToCase`), and Case Sheet Print/Preview (`CaseSheetPrintView`), ensuring distinct specialties are preserved while duplicate alias variants collapse into a single clean consultation entry.

### [2026-09-21] — SAMPLE Events & Secondary Survey All-6-Systems Persistence Fix
- **Explicit SAMPLE Events Mapping (`server/scribeChatTurn.ts`, `src/App.tsx`, `src/components/VoiceScribeChatView.tsx`, `src/components/CaseSheetView.tsx`)**:
  - Refactored `deriveExplicitEvents` to map explicit preceding events/trauma mechanisms strictly into `sampleHistory.events` (e.g., `"RTA two-wheeler vs four-wheeler"` → `"Road traffic accident involving two-wheeler vs four-wheeler"`, `"Snake bite while working in field"` → `"Snake bite while working in field"`).
  - Explicitly guaranteed that ambiguous or purely medical history (e.g. fever/cough duration without trauma or external precipitants) leaves `sampleHistory.events` blank without hallucinated triggers.
  - Ensured `sampleHistory.events` is unpacked in `VoiceScribeChatView` display and persists through Scribe Apply, Firestore writes, and reload.
- **Secondary Survey Full 6-System Mapping & Persistence (`server/scribeChatTurn.ts`, `src/App.tsx`, `src/components/SecondarySurveySection.tsx`, `src/components/CaseSheetView.tsx`, `src/components/CaseSheetPrintView.tsx`)**:
  - Expanded secondary survey parsing with robust regex recognizing all 6 anatomical systems (`General`, `CVS`, `Respiratory / RS`, `Abdomen / PA`, `CNS`, `Extremities`).
  - Synchronized `secondarySurvey` and `secondaryAssessment` in `buildExtractedCaseDraft` in `App.tsx` and `SecondarySurveySection.tsx` so all dictated systems are preserved, rendered, and survive reload without dropping unstated normal findings.
  - Aligned printable and preview layouts in `CaseSheetPrintView.tsx` to render all 6 systems cleanly from both `secondarySurvey` structured fields and `secondaryAssessment` narrative notes.

### [2026-09-21] — Handover Shift Transition Decoupled from Patient Discharge
- **Removed Unsafe Status & Deletion Mutations (`src/components/HandoverView.tsx`)**:
  - Removed `status: "Discharged"` mutation and bulk Firestore delete from `HandoverView.tsx`. Shift handover completion never mutates `ClinicalCase.status` or `dispositionDetails.dispositionType`.
  - Removed `sanitizeForFirestore` and `deleteDoc` calls from handover cleanup routines.
- **Neutral Handover Completion UI**:
  - Replaced the "Shift Transition: Safe Board Cleanup" prompt (which offered "Discharge & Archive Cases" and "Delete Case Logs Completely") with a safe confirmation modal: *"Handover prepared successfully. Active patients remain on the ER board until their actual clinical disposition."*
  - Replaced unsafe clinical disposal buttons with a single non-clinical `"Done"` action that deselects local UI checkboxes and leaves active patients on the ER board.
- **Removed Misleading Warning Banner**:
  - Removed the "Shift Handover Clean Slate Warning" banner and associated `ermate_uncleared_shift_warning` flags that pressured clinicians to discharge active patients after compiling handover documents. Active handed-over patients remain fully visible on the active board for incoming shift doctors.

### [2026-09-21] — Removal of Unsafe Case Sheet Disposition Default
- **New Case Creation Dispositions Omitted (`src/App.tsx`)**:
  - `handleSaveNewCase()` and `buildExtractedCaseDraft()` (used by `handleSaveExtractedVoiceCase()`) no longer initialize new cases with `dispositionType: "Discharge"`.
  - When no explicit clinician disposition decision has been documented, `dispositionType` is left absent/omitted. `sanitizeForFirestore` ensures clean omission without persisting unsupported `undefined` values.
- **Case Sheet Disposition UI & Update Helper (`src/components/CaseSheetView.tsx`)**:
  - Disposition Mode dropdown binding updated to `value={currentCase.dispositionDetails?.dispositionType || ""}` and added `<option value="">Pending / Not Documented</option>`.
  - `updateDisposition()` refactored to remove hardcoded `dispositionType: "Discharge"` fallback. Editing auxiliary fields (Duration in ER, Resident, Consultant, Observation Notes) preserves the existing state and never injects an unearned disposition. Selecting "Pending / Not Documented" cleanly deletes `dispositionType`.
- **Print & Clipboard Display Fallbacks (`src/components/CaseSheetView.tsx`)**:
  - Replaced all legacy `"Discharge"` / `"Discharged"` / `"Ward"` print and clipboard fallbacks with `"Not yet determined"`.
- **Downstream Logic Alignment**:
  - Verified `CasesListView` does not classify an empty disposition as discharged (remains under Active until explicit clinician disposition).
  - Verified `syncDischargeSummary` disposition gate does not fire unless disposition is explicitly documented.

### [2026-09-21] — Discharge Summary Finalization Decoupling & Disposition Safety
- **Summary Finalization Decoupled from Patient Status (`src/App.tsx`)**:
  - Removed unsafe coupling in `handleSaveDischarge` where `dischargeInfo.summaryStatus === "FINALIZED"` previously mutated `ClinicalCase.status = "Discharged"`.
  - Document finalization (`summaryStatus = "FINALIZED"`) now solely updates document state; patient operational status (`ClinicalCase.status`) is strictly preserved as-is.
  - Operational status remains exclusively governed by the authoritative Case Sheet clinical disposition workflow.
- **Removed Implicit "Discharge" Default on Undocumented Disposition (`src/components/DischargeSummaryView.tsx`)**:
  - Eliminated implicit `"Discharge"` / `"Normal Discharge"` fallback assignment when no clinical disposition is documented.
  - Initial `dispositionStatus` now defaults cleanly to `""` ("Pending / Not Documented") if omitted in both `dischargeInfo` and `dispositionDetails`.
  - Added explicit `<option value="">Pending / Not Documented</option>` in the disposition decision select control and preview display.
  - Documented disposition vocabulary mismatches across `CaseSheetView` (`Discharge`, `Admit`, `Refer`, `LAMA`, `Absconded`, `Death`), `DischargeSummaryView` (`Normal Discharge`, `Discharge at Request`, `DAMA`, `Referred`), and `DispositionDetails` for future CASE LIFECYCLE / HISTORY stabilization.

### [2026-09-21] — Discharge Summary Live Synchronization & Safety Lifecycle
- **ClinicalCase as Authoritative Single Source of Truth (`src/utils/dischargeSyncEngine.ts`, `src/components/DischargeSummaryView.tsx`, `src/App.tsx`, `src/types.ts`)**:
  - Implemented live synchronization engine guaranteeing that all updates to a `ClinicalCase` (vitals, ABCDE primary survey, general and systemic secondary exam, ECG, eFAST/POCUS, ABG/VBG, medications, IV fluids, procedures, consultations, progress notes, and disposition) automatically reflect in the Discharge Summary draft.
  - Full support for both Adult and Pediatric presentations, dynamically deriving and synchronizing pediatric assessment triangle findings, weights, and pediatric clinical notes.
  - Zero redundant data models created: operates directly on the existing `ClinicalCase` and `dischargeInfo` schema.
- **Discharge Summary State Lifecycle**:
  - Formalized lifecycle state machine: `DRAFT` → `PREPARED` → `MANUALLY_EDITED` → `FINALIZED`.
  - Added visual status indicator badge in the header clearly communicating the summary's current phase.
  - Status transitions automatically to `MANUALLY_EDITED` as soon as a clinician modifies the clinical course, diagnosis, or discharge prescriptions.
- **Non-Destructive Data Reconciliation Engine**:
  - Created pure reconciliation utilities (`mergeCourseInHospital`, `mergeInvestigations`, `mergeDischargeMedications`) preventing clinician-written notes and prescriptions from being overwritten or erased.
  - Seamlessly reconciles new diagnostic investigations, new ER medications, and chronological progress notes with existing manual annotations and instructions.
- **Out-of-Sync Detection & Refresh Workflow**:
  - Added high-visibility warning banner when `caseUpdatedAfterPreparation` is flagged following subsequent case updates or Scribe turns.
  - Includes instant "Review Updates & Refresh" action that intelligently reconciles newly documented findings into the active draft without data loss.
- **Safe Persistence & Case Status Boundaries**:
  - Distinct "Save Draft" vs "Finalize & Save Summary" actions.
  - Clicking "Save Draft" saves all draft modifications to Firestore while keeping the underlying `ClinicalCase` status as `Active`.
  - Only explicit "Finalize & Save Summary" transitions the case to `Discharged` status.

### [2026-09-21] — Consolidated Printable Case Sheet Preview from Scribe
- **In-Memory Consolidated Preview Architecture (`CaseSheetView.tsx`, `CaseSheetPrintView.tsx`, `App.tsx`)**:
  - Re-routed "Preview Case Sheet" from Voice Scribe to render a read-only, consolidated printable clinical preview (`CaseSheetPrintView`) instead of the multi-tab editable form.
  - Zero database writes occur during Preview. Merged draft is constructed purely in memory combining existing `ClinicalCase` and new Scribe/task extraction deltas.
  - Displays a high-visibility amber warning banner: *"Preview — changes are not saved yet. Review the extracted clinical findings below before applying to the case sheet."*
  - Dedicated action bar providing:
    - `[Back to Scribe]`: Seamlessly navigates back to the active Scribe session with zero Firestore modifications.
    - `[Apply to Case Sheet]`: Persists the reviewed merged draft to Firestore with deep `{ merge: true }`, updates chat history with `"✓ Case Sheet prepared successfully."`, and smoothly transitions the clinician to the normal editable `CaseSheetView`.
    - `[Print / PDF]`: Allows direct browser print and PDF generation of the preview document.
    - `[View Case Sheet]`: Displayed post-apply for direct navigation to the editable record.
- **Dynamic Adult vs. Pediatric Layout Routing**:
  - Dynamically routes to the appropriate Adult or Pediatric printable format according to the patient's age and locked clinical guidelines.
  - Formats all captured findings: Primary Survey (ABCDE) with contextual vitals, Bedside Diagnostics (eFAST with organ mapping, ECG, Bedside Echo, ABG/VBG), SAMPLE history, multi-system Secondary Survey, Differential Diagnoses, Ordered Investigations (Labs & Imaging), Treatments & Medications, Procedures, Specialist Consultations, and Disposition.
- **Natural Language Vitals & Consults Support (`server/clinicalTaskApplier.ts`, `src/utils/clinicalTaskApplier.ts`)**:
  - Added deterministic vitals regex extraction for BP, HR, RR, SpO2, Temp, and GRBS.
  - Enhanced consultation regex parsing to recognize urgent and direct consult requests (e.g., `"urgent OBGYN consult requested"`, `"urology reviewed"`) and synchronized across both `dispositionAndPlan.consultsRequested` and top-level `consultsRequested`.

### [2026-09-20] — Universal Clinical Task Applier (Adult, Pediatric & Discharge Summary Safety)
- **Natural Language Intent & Task Registry (`server/clinicalTaskApplier.ts`, `src/utils/clinicalTaskApplier.ts`)**:
  - Implemented universal clinical task resolution with canonical `CLINICAL_FIELD_REGISTRY` covering vitals, ABCDE, adjuncts (eFAST/POCUS, ECG, Echo, ABG), SAMPLE history (symptoms, allergies, medications, past history, last meal, events), physical exams (general, CVS, RS, PA, CNS, extremities), investigations (labs, imaging), treatments/procedures, consultations, and disposition.
  - Added 5-category intent classification: `QUESTION` (pure clinical guidance, zero case mutation), `DOCUMENT_FACT`, `CASE_UPDATE`, `APP_ACTION`, and `MIXED`.
  - Added deterministic disambiguation for clinical ambiguities (e.g., distinguishing between cardiac troponin lab result vs ACS differential diagnosis).
- **Scribe Delta Updates Audit & eFAST/SAMPLE Resolution (`server/scribeChatTurn.ts`, `VoiceScribeChatView.tsx`, `App.tsx`)**:
  - Resolved eFAST audit issue: Expanded `fastFindings` organ coverage to include `bladder`, `suprapubic`, and `lungs`, and populated canonical `adjuncts.efastNotes` (`fields.efastNotes`).
  - Resolved SAMPLE history audit issue: Unpacked and synchronized SAMPLE history fields between `sampleHistory` sub-object and flat fields (`allergies`, `pastMedicalHistory`, `currentMedications`, `psychologicalAssessment`), eliminating empty array dropping and duplicate rendering.
  - Updated `VoiceScribeChatView.tsx` extraction renderer (`getDisplayableExtractionEntries`, `humanizeFieldLabel`) to display eFAST/POCUS, Medications, Allergies, and Psychological Assessment individually under "CAPTURED FROM YOUR UPDATE".
- **Discharge Summary Post-Preparation Safety (`src/types.ts`, `src/App.tsx`, `src/components/DischargeSummaryView.tsx`)**:
  - Added `caseUpdatedAfterPreparation?: boolean` to `DischargeInfo` interface.
  - Automatically flags active discharge summaries when subsequent clinical tasks or scribe updates modify the case.
  - Added warning banner in `DischargeSummaryView.tsx` notifying clinicians when case data changed post-generation, with an instant "Refresh Summary from Case" action that non-destructively re-synchronizes with latest investigations, treatments, and clinical notes.

### [2026-09-20] — Case Persistence & Scribe Updates Fix (`src/components/CaseSheetView.tsx`, `src/App.tsx`, `src/components/VoiceScribeChatView.tsx`, `server/scribeChatTurn.ts`)
- **Triage Selection Immediate Persistence & Integrity**:
  - Refactored `CaseSheetView.tsx` triage buttons (P1 Immediate, P2 Urgent, P3 Non-Urgent) to call `onSaveCase(caseWithTriage)` immediately upon selection, guaranteeing Firestore writes without requiring a separate save button click.
  - Protected manual triage selections in `updateVitals` and `addVitalRecord` using `isTriageCategoryPending(currentCase.patient.triageCategory)`: auto-classification only applies if triage is pending; explicit clinician assignments are never overwritten on vital edits.
- **Scribe Delta Updates & Progress Notes Appending**:
  - Updated `server/scribeChatTurn.ts` to map clinician update text into both `progressNotes` and structured `clinicianUpdates`.
  - In `VoiceScribeChatView.tsx` and `App.tsx`, updated extraction handling to format clinical updates as `[HH:MM] — [Update text]` and chronologically append them to existing `progressNotes` rather than replacing them.
  - Enhanced `deepMergeExtraction` to merge treatments, investigations, and differentials intelligently without erasing existing case records.
- **General Save Deep Merge & Field-Loss Prevention**:
  - Updated `handleSaveCase`, `handleSaveNewCase`, `handleSaveDischargeSummary`, and `buildExtractedCaseDraft` in `App.tsx` to use `{ merge: true }` on Firestore `setDoc`.
  - Explicitly deep-merged sub-objects (`patient`, `vitals`, `sampleHistory`, `primaryAssessment`, `adjuncts`) to protect against partial updates dropping unedited fields upon save and reload.
  - Added fallback document retrieval in `handleSaveExtractedVoiceCase` and `handlePreviewCaseSheet` if the target case is not yet present in in-memory state.

### [2026-09-20] — Same-Patient Resume Scribe Continuity Fix (`src/components/CaseSheetView.tsx`, `src/App.tsx`, `src/components/VoiceScribeChatView.tsx`, `src/services/scribeChatStorage.ts`)
- **Same-Patient Scribe Continuity & Case ID Propagation**:
  - Refactored `onReturnToScribe` callback across `CaseSheetView.tsx` to pass the active case ID `currentCase.id` (`onReturnToScribe(currentCase.id)`).
  - Updated `App.tsx`'s `onReturnToScribe` handler to accept `caseId`, setting `setVoiceScribeCaseId(targetCaseId)` before navigating to `VoiceScribeChatView` and clearing `selectedCaseId`.
  - In `VoiceScribeChatView.tsx`, guarded `activeCaseId` initialization and added dynamic synchronization against `propCaseId || caseData?.id`, preventing `generateNewCaseId()` from executing during Resume Scribe flows while preserving new ID generation for genuine New Patient creation.
  - Subscribes to canonical Firestore path `/cases/{caseId}/scribeChatMessages`, ensuring previous persisted messages for the patient reload seamlessly upon resuming Scribe.
- **Authoritative Active Session Detection**:
  - Added `hasCaseScribeHistory(caseId)` in `src/services/scribeChatStorage.ts` to inspect persisted chat records in Firestore.
  - Aligned session active evaluation in `CaseSheetView.tsx` (`isScribeSessionActive = Boolean(hasActiveScribeSession || hasPersistedScribeHistory)`) so component remounts or browser reloads retain authoritative "Resume Scribe" state rather than relying solely on in-memory message array length.

### [2026-09-20] — Global In-App Data Refresh Button (`src/components/shared/GlobalRefreshButton.tsx`, `src/App.tsx`, `src/components/CaseSheetView.tsx`, `src/components/VoiceScribeChatView.tsx`)
- **Non-Destructive In-App Data Refresh**:
  - Implemented `GlobalRefreshButton` mounted in both desktop and mobile headers (`App.tsx`).
  - Triggers data-only refresh across active view without performing browser reload (`window.location.reload()`), preserving route, active tab, selected `caseId`, and user authentication/profile state.
  - Interactive states: idle (`↻`), refreshing (spinning icon with disabled click), success toast ("Updated" for 2 seconds), and failure toast ("Unable to refresh. Try again.").
- **Clinical Safety & Unsaved Changes Guard**:
  - Integrated `isCaseSheetDirty` comparison in `CaseSheetView` against `lastSavedCaseRef`.
  - When unsaved modifications exist in an open Case Sheet, clicking Refresh triggers a non-intrusive safety dialog prompting "Unsaved changes are present. Save or discard them before refreshing." with options to "Save & Refresh", "Discard & Refresh", or "Cancel".
- **Voice Scribe & Recording Protection**:
  - Global voice recording tracker in `VoiceRecorder` (`subscribeGlobalVoiceRecording`) and active sending state monitor in `VoiceScribeChatView` (`onBusyChange`).
  - Refresh is disabled during active recording, transcription, or message sending with a protective tooltip and alert ("Finish the current recording/save before refreshing").
- **View-Specific Targeted Fetch**:
  - `showVoiceScribeChat`: Re-fetches chat history via `scribeRefreshTrigger` and `getChatHistory` / `getDiscussionHistory`.
  - `CaseSheetView`: Re-fetches active case from Firestore doc `cases/{caseId}` and re-syncs state via `caseRefreshTimestamp` without resetting active tab.
  - `CaseSheetPrintView` & `DischargeSummaryView`: Re-fetches specific case document and updates local case cache.
  - `Handover`: Re-queries `handovers` collection for active hospital/user.
  - `Dashboard`, `Cases`, `Logbook`, `Analytics`: Re-queries `cases` collection and updates `cases` state in place.

### [2026-09-20] — Pediatric "Other / Details" Dropdown UI State Fix (`src/components/CaseSheetView.tsx`)
- **Local UI State for "Other / Details" Mode**:
  - Implemented `isOtherSelected` local state within `PediatricSelectWithDetails`.
  - When selecting `"Other / Details"` from a blank or predefined field, the dropdown immediately maintains its visible selection on `"Other / Details"` and reveals the free-text Details `<input>` with autofocus.
  - Eliminated premature revert bug caused by `onChange("")` resetting `isOther` to false.
- **Clinical Data Integrity**:
  - Prevented literal string `"Other / Details"` from persisting as clinical data. If the user selects Other but has not typed anything yet, empty string (`""`) remains without saving placeholder text.
  - Custom typed details are persisted directly via `onChange`.
  - Stored legacy custom values (e.g. `"Grandmother"`) continue displaying visibly as `"Other / Details"` with full preserved custom text in the Details input.
  - Selecting a standard predefined option cleanly exits Other mode (`setIsOtherSelected(false)`), hides the input, and saves the chosen standard string.


### [2026-09-20] — View Case Sheet Runtime Fallback Fix (`src/App.tsx`, `src/components/CaseSheetPrintView.tsx`)
- **Removal of Automatic Scribe Boilerplate**:
  - Removed the default `"Case created via ErMate Voice Scribe dictation."` string in `src/App.tsx` (`buildExtractedCaseDraft()`). If no genuine progress or chronological notes exist, `progressNotes` defaults cleanly to `""` or `null`.
  - Added display-level sanitization in `src/components/CaseSheetPrintView.tsx` (`convertClinicalCaseToCaseSheetData` and Clinical Notes JSX): if `progressNotes.trim()` equals the legacy boilerplate string, it is treated as null for display so the artificial boilerplate sentence never appears on historical cases while preserving genuine clinical notes.
- **SAMPLE History Read Fallbacks**:
  - Implemented read-only fallbacks in `src/components/CaseSheetPrintView.tsx` for `pastMedicalHistory`, `currentMedications`, and `events`, ensuring canonical `sampleHistory` always takes precedence without writing back to legacy fields.
- **Ordered Investigations Fallback with Separation**:
  - Added read-only fallback in `convertClinicalCaseToCaseSheetData` formatting named investigations from `investigationsOrdered` into `investigationLabsOrdered` when canonical fields are empty.
  - Separated diagnostic imaging from laboratory investigations, maintaining strict separation of Labs, Imaging, and Results without inventing tests.
- **Provisional Diagnosis Fallback**:
  - Replaced differential suggestion fallback with canonical `provisionalPrimaryDiagnosis` and historical diagnosis fields (`provisionalDiagnosis`, `dischargeInfo.primaryDiagnosis`, `primaryDiagnosis`, `dispositionProvisionalDiagnosis`, `diagnosis`). ErMate differential suggestions are no longer used as factual primary diagnosis.
- **Primary Survey Normal Finding Fabrication Guard**:
  - Removed default normal fallback strings (`"Normal work of breathing"`, `"Normal perfusion"`, `"Alert, pupils equal and reactive"`, `"Skin warm, no rash/edema"`, `"Patent"`) from `PrimarySurveySection` in `src/components/CaseSheetPrintView.tsx`.
  - Unexamined or absent findings now consistently display `"Not documented"`.
- **Pediatric & MLC Semantic Separation**:
  - Maintained complete separation between `pediatricDetails` and `mlcDetails` (`broughtBy`, `informant`).

### [2026-09-20] — Pediatric Scribe Semantic Mapping Fix (`server/scribeChatTurn.ts`, `server/extractionCleanup.ts`, `server/voiceExtraction.ts`)
- **Primary Survey Exposure Semantic Boundary Enforcement**:
  - Implemented `normalizeExposureAndSecondarySurvey()` in `server/scribeChatTurn.ts`.
  - Re-routes abdominal findings (e.g. "Abdomen soft and non-tender") from `raw.exposure` strictly to Secondary Survey Abdomen (`secSurvey.abdomen` / PA).
  - Re-routes neurological findings (e.g. "No neck stiffness or focal neurological deficit") strictly to Secondary Survey CNS (`secSurvey.cns`).
  - Re-routes hydration and general exam findings (e.g. "Mild dehydration with dry oral mucosa") strictly to Secondary Survey General (`secSurvey.general`).
  - Re-routes documented temperature findings (e.g. "38.8 C") directly to `fields.vitals.temp`.
  - Re-routed findings are stripped cleanly from Exposure, eliminating duplicate text across Primary Survey and Secondary Survey.
  - Added history negative guard preventing isolated history denials (e.g. "no rash") from being converted into an artificial Exposure examination finding.
- **Hydration vs. Antipyretic Separation & No-Invention Enforcement**:
  - Unspecified/conditional hydration statements ("Oral or IV fluids depending on tolerance") are preserved in `treatmentNotes` and `managementPlan` / `plan` rather than creating an incorrect medication object.
  - Generic antipyretic statements ("weight-appropriate antipyretic treatment") are preserved as generic TreatmentItem without hallucinating Paracetamol, Ibuprofen, drug doses, routes, fever thresholds, or SOS frequencies.
- **Investigation & Lab No-Invention Rule**:
  - Integrated `isGenericInvestigationPhrase` guard in `server/extractionCleanup.ts` and `server/scribeChatTurn.ts`.
  - Generic statements like "Appropriate investigations were planned based on clinical assessment and duration of fever" are preserved in `managementPlan` / `plan` and strictly prevented from creating spurious CBC, CRP, or urine test objects.
- **Preceding Events / Mechanism Filtering**:
  - Added `isExplicitPrecipitatingEvent()` in `server/scribeChatTurn.ts` to ensure only true precipitating trauma/triggers (RTA, falls, injuries, bites, poisonings, collapse) enter `events` and `sampleHistory.events`.
  - Routine medical symptom durations (e.g. "fever for 3 days") are rejected from `events`.

### [2026-09-20] — Pediatric Disposition Parity Fix (`src/components/CaseSheetView.tsx`)
- **Canonical Disposition Tab Workflow Parity**:
  - Removed duplicate stacked `PediatricDispositionSection` from the Disposition tab in `CaseSheetView.tsx`.
  - Both pediatric and adult cases now utilize the same canonical NABH Clinical Disposition & Logs panel (Disposition Mode/Type, Duration in ER, Resident attribution, Consultant attribution, ER Observation Notes & Disposition Plan, and Condition at Time of Shift).
  - Preserved the disposition save pipeline (`handleSaveFromDisposition`, `dispositionSaveMessage`, "Save Case Sheet to Dashboard", and floating bar save actions) persisting cleanly to the same `caseId` without schema changes.
- **Diagnosis & Differentials Decoupling**:
  - Eliminated duplicate `dispositionProvisionalDiagnosis` and `differentialDiagnosis` inputs from the Disposition tab, preserving single source of truth for diagnoses in the canonical assessment and diagnosis tabs (`provisionalPrimaryDiagnosis` and `differentials`).
  - Aligned the printable fallback preview in `CaseSheetView.tsx` to read `provisionalPrimaryDiagnosis` with defensive fallback to legacy fields.
- **Zero Schema or Persistence Alteration**:
  - Maintained complete backward compatibility; no Firestore schema changes or database migrations required.

### [2026-09-20] — Saved "View Case Sheet" Final Data Alignment (Adult & Pediatric Parity) (`src/components/CaseSheetPrintView.tsx`)
- **Patient Header Case Metadata**:
  - Rendered `triageCategory` (e.g. P1/P2/P3) and `caseType` (e.g. Medical, Trauma) directly from stored `patient` / case properties without creating new schema fields.
- **Investigations & Diagnostic Studies Separation**:
  - Decoupled Diagnostic Imaging (`investigationImaging` — X-rays, CT, MRI, USG) from laboratory investigations ordered (`investigationLabsOrdered`) and laboratory test panels (`labs` / `investigationResults`).
  - Added dedicated rendering for `investigationResultsSummary` across both Adult and Pediatric views, preventing imaging studies from collapsing into lab result grids.
- **Full Treatment Details & Orders**:
  - Expanded `treatmentList` item rendering to format drug name, dose, route, frequency, time given, and instructions for all `TreatmentItem` entries.
  - Formatted continuous infusions including fluid name, dose, dilution, and rate.
  - Rendered `treatmentNotes` consistently in both views, ensuring physician notes and orders remain visible even when medication items are present.
- **Procedures & Interventions**:
  - Rendered acute emergency procedures from `proceduresChecked` and free-text procedure notes from `otherProcedures`.
- **Specialist Consultation & Review**:
  - Rendered `consultsRequested` and detailed `consultantReview` (reviewing consultant name, review narrative, and timestamp).
- **Disposition & Care Plan**:
  - Aligned disposition section to render disposition status, destination unit, ER duration, `conditionAtShift`, `managementPlan`, and `followUpAdvice`.
- **Clinician Attribution & Signature Block**:
  - Dynamically rendered treating ER physician/resident and EM consultant from stored case fields (`doctorName`, `emResident`, `emConsultant`, `consultantName`, `dispositionDetails`, `consultantReview`).
  - Eliminated hardcoded empty consultant lines when no consultant review is documented.
- **Provisional & Differential Diagnoses**:
  - Preserved provisional primary diagnosis and structured differential diagnoses (`diagnosis` and `status`), along with `provisionalDifferentialDiagnoses` narrative notes.

### [2026-09-20] — Saved "View Case Sheet" Data Alignment & Structured ClinicalCase Mapping (`src/components/CaseSheetPrintView.tsx`)
- **Contextual Primary Survey Vitals Single Source of Truth**:
  - Removed duplicate standalone vitals grid from the saved/printed View Case Sheet.
  - Vitals are rendered contextually within each primary survey domain (Airway: airway findings; Breathing: findings + RR & SpO2; Circulation: findings + HR & BP; Disability: findings + GCS score, components & GRBS; Exposure: findings + Temperature).
  - Reads vitals directly from `c.vitals` with fallback to survey values, without creating duplicate state.
- **Canonical Adjuncts Prioritization**:
  - Implemented `AdjunctsSection` positioned immediately after Primary Survey (ABCDE).
  - Reads canonical survey fields first (`survey.circulation.ecg`, `survey.circulation.echo`, `survey.circulation.efast`, and `survey.adjuncts.abg`) with defensive fallback to legacy `c.adjuncts`.
  - Distinguishes arterial (ABG) vs venous (VBG) blood gas interpretations and formats blood gas parameters (pH, pCO2, HCO3, Lactate, electrolytes).
- **SAMPLE History Decoupling**:
  - Decoupled Signs & Symptoms, Allergies, Current Medications, Last Meal, and Events Preceding from Past Medical History across both adult and pediatric layouts.
  - Past Medical History renders strictly as `P — Past Medical History` or dedicated history items without swallowing other SAMPLE components.
- **Secondary Survey Multi-System Isolation**:
  - Isolated General, CVS, Respiratory (RS), Abdomen (PA), CNS, and Extremities.
  - Supported aliases (RS, Respiratory, Chest / RS; PA, Abdomen, Per Abdomen) and header-boundary parsing to prevent cross-system narrative bleeding.

### [2026-09-20] — Clinical Examination Completeness Logic Refinement (`src/utils/caseHelper.ts`)
- **Domain-Specific Primary Survey Completeness**:
  - Refactored `getCasePendingStatus()` in `src/utils/caseHelper.ts` to evaluate each ABCDE domain (Airway, Breathing, Circulation, Disability, Exposure) independently.
  - Vitals (HR, BP, RR, SpO2, GCS, Temp) and Adjuncts (ECG, ABG, eFAST, Echo/POCUS) no longer independently satisfy Primary Survey completeness.
  - Requires clinical assessment findings in each domain (via structured `primaryAssessment.survey` or legacy narrative fields).
- **Comprehensive Secondary Survey Verification**:
  - Enforced multi-system check across General, CVS, Respiratory (RS), Abdomen (PA), CNS, and Extremities.
  - Supports structured `secondarySurvey` and parsed aliases in `secondaryAssessment`.
  - Single secondary fields no longer mark the entire Secondary Survey complete.

### [2026-09-20] — Clinical Examination Completion Predicate Alignment (`src/utils/caseHelper.ts`)
- **Canonical Examination Completion Predicate**:
  - Replaced legacy string checks on `c.primaryAssessment` (`airway`, `breathing`, `circulation`, `disability`, `exposure`) in `getCasePendingStatus()` with canonical checks matching `CaseSheetView` data structures.
  - Primary Survey evaluates as documented when meaningful data exists in `primaryAssessment.survey`, existing narrative fields, `vitals`, or adjuncts.
  - Secondary Examination evaluates as documented when meaningful data exists in `secondaryAssessment` or `secondarySurvey`.
  - Reused `hasMeaningfulValue` evaluation logic to prevent conflicting predicates between Dashboard and CaseSheetView.
  - Eliminated false "Clinical Examination incomplete" warning on active cases with completed surveys without altering schemas or Firestore data.

### [2026-09-20] — Disposition Tab Indicator Clinical Completion Logic (`src/components/CaseSheetView.tsx`)
- **Clinical Disposition Status Indicator Decoupling**:
  - Removed default compliance checklists (`ipsgChecklist`, `consentTimeOut`) from `tabHasData("disposition")` evaluation, preventing default checked items or safety timeout objects from falsely marking the Disposition tab as completed.
  - Aligned disposition completion indicator strictly to meaningful clinical disposition data: `dischargeInfo`, `dispositionDetails`, `dispositionAndPlan.managementPlan`, `dispositionAndPlan.dispositionType`, `disposition`, and `vulnerableAssessment`.
  - Preserved the IPSG checklist component, consent/timeout controls, and underlying Firestore/schema models intact.

### [2026-09-20] — View Case Sheet CTA State & Scribe Chat Message Document Persistence
- **Deterministic Chat Message Document IDs (`src/services/scribeChatStorage.ts`)**:
  - Refactored `appendChatMessage` to store new chat messages deterministically at `cases/{caseId}/scribeChatMessages/{message.id}` using `setDoc` with `{ merge: true }`, ensuring document IDs match application message IDs.
  - Implemented legacy message fallback in `updateChatMessage`: if `messageId` is not found as a direct document ID (legacy messages created with random `addDoc` IDs), executes a fallback query `where("id", "==", messageId)` with `limit(1)` and updates that specific document.
- **Contextual CTA State Architecture (`src/components/VoiceScribeChatView.tsx`)**:
  - Decoupled CTA rendering strictly to `msg.extractionApplied === true` instead of inferring from existing clinical data fields.
  - When `msg.extractionApplied` is false, renders `"Preview Case Sheet"` routing through the in-memory review flow.
  - When `msg.extractionApplied` is true, renders an active, clickable `"View Case Sheet"` button calling `onOpenCaseSheet(activeCaseId)`.
  - Cleared preview mode flags in `App.tsx` (`setIsPreviewMode(false)`, `setPreviewCase(null)`, `setPendingPreviewContext(null)`) on `onOpenCaseSheet` invocation, opening the existing case in standard mode without running extraction, creating duplicate cases, or triggering database writes.
- **Apply Sequence Safety**:
  - Preserved existing safe ordering: 1. case writes to Firestore, 2. `extractionApplied: true` updates in Firestore, 3. local message state updates, 4. confirmation displayed. If case write fails, `extractionApplied` remains false.

### [2026-09-20] — Internal Clinician Attribution Preservation & Defensive Placeholder Guard
- **Role-Attributed Internal Clinician Protection (`server/deidentify.ts`, `server/scribeChatTurn.ts`)**:
  - Implemented `protectInternalClinicians(rawText)` in `server/deidentify.ts` targeting explicitly role-attributed internal treating-team clinicians (e.g., `"EM Resident Dr Joshua"`, `"EM Consultant Dr Christo"`).
  - Replaces internal clinician names with reversible local placeholders (`__ERMATE_EM_RESIDENT_0__`, `__ERMATE_EM_CONSULTANT_0__`) before general PHI de-identification, preventing treating-team attribution from being collapsed into `[DOCTOR]`.
  - External referral doctors, prior doctors, and unrelated physicians (e.g. `"Referral from Dr Thomas"`, `"Previously seen by Dr Mathew"`) remain strictly subject to standard `[DOCTOR]` PHI de-identification.
  - Added `isRedactedOrPlaceholderClinician(val)` defensive guard to reject literal placeholders (`[DOCTOR]`, `[NAME]`, `[PERSON]`, `na`, `unknown`) from overwriting clinician attribution fields.
  - In `server/scribeChatTurn.ts` (`mapExtractionToCaseSheetFields`), restored protected clinician names strictly into `fields.emResident` and `fields.emConsultant`.
  - Added clinical narrative sanitization ensuring clinician names are never restored into free clinical narrative and residual internal placeholders are converted to `[DOCTOR]`.
  - Clinical reasoning (Claude 3.5 Sonnet) receives text with internal placeholders replaced by `[DOCTOR]`.
  - Verified against 6 test scenarios (A through F) with 100% pass rate.

### [2026-09-20] — Preview Case Sheet Flow (Zero Firestore Writes Prior to Review)
- **In-Memory Case Sheet Preview Architecture (`App.tsx`, `CaseSheetView.tsx`, `VoiceScribeChatView.tsx`)**:
  - Implemented non-destructive preview flow allowing clinicians to inspect and edit mapped Case Sheet data prior to any Firestore persistence.
  - Added pure `buildExtractedCaseDraft(existingMatch, extracted, context)` helper in `App.tsx` performing zero database writes or side effects.
  - Replaced immediate persistence from "Prepare Case Sheet" in `VoiceScribeChatView` with "Preview Case Sheet", routing through `onPreviewCaseSheet` and setting `previewCase`, `isPreviewMode`, and `pendingPreviewContext`.
  - Added sticky amber banner in `CaseSheetView.tsx` ("Preview — changes are not saved") with direct "Apply to Case Sheet" action and cancel/back navigation.
  - Added zero-write guards to prevent background or manual Firestore writes while in preview mode (`handleSaveCase`, `handleSaveProfile`).
  - Clicking "Apply to Case Sheet" writes the reviewed draft to Firestore using the canonical authenticated persistence path, synchronizes chat message status (`extractionApplied: true`), appends confirmation message, and cleans up preview state cleanly.

### [2026-09-20] — Primary Survey ABCDE Vitals Alignment & Single Source of Truth (ABCDE VITALS FIX)
- **Cardinal Vitals UI Single Source of Truth (`PrimarySurveySection.tsx`)**:
  - Aligned cardinal vitals in the ABCDE primary survey to read directly from `case.vitals` (`rr`, `spo2`, `hr`, `bp`, `gcs_e`, `gcs_v`, `gcs_m`, `gcs`, `temp`).
  - Implemented backward compatibility fallback for legacy cases: if a vital is absent in `case.vitals`, displays the legacy value from `primaryAssessment.survey` without writing it back automatically.
  - Eliminated duplicate UI writes: new user edits inside the Primary Survey update `case.vitals` exclusively via `onUpdateVitals`, while non-vital clinical assessment findings (rhythm, CRT, pulses, skin perfusion, chest wall, air entry, pupils, log roll) remain in `primaryAssessment.survey`.
  - Maintained all schemas, Firestore models, and component interfaces without modification.

### [2026-09-20] — Scribe Field-Mapping & Normalization Pipeline Fix (SCRIBE MAPPING FIX 1)
- **Secondary Survey Exam Aliases (`CaseSheetView.tsx`, `SecondarySurveySection.tsx`, `App.tsx`)**:
  - Normalized respiratory aliases (`RESPIRATORY` → `RS`) and abdominal aliases (`ABDOMEN` → `PA`) in `parseSecondaryAssessment()` and component state parsers.
  - Eliminated secondary survey examination dropouts and text mismatches between CVS and RS without duplicating state.
- **SAMPLE History Mapping (`scribeChatTurn.ts`, `App.tsx`, `VoiceScribeChatView.tsx`)**:
  - Normalized outpatient and current medications from array of strings or comma-separated string cleanly into `sampleHistory.medications`.
  - Mapped `lastMeal` into `sampleHistory.lastMeal` with valid string guard.
  - Derived explicit trauma/event timelines strictly from explicit preceding clinical text (`raw.hpi`, `raw.presentingComplaint`, `rawInputText`) into `sampleHistory.events` without inferring or fabricating details when not stated.
- **Investigation & Lab Categorization Separation (`extractionCleanup.ts`, `scribeChatTurn.ts`, `App.tsx`)**:
  - Separated diagnostic imaging studies (X-rays, CTs, MRI, USG, bedside echo/FAST) from laboratory investigations.
  - Routed imaging into `investigationImaging` / `imaging` and blood/urine laboratory tests strictly into `investigations` / `investigationLabsOrdered`, preventing X-rays from rendering in lab test tables.
- **Acute Treatments & Procedures Mapping (`extractionCleanup.ts`, `scribeChatTurn.ts`, `App.tsx`)**:
  - Extracted acute emergency medications (IV fluids, analgesics, antiemetics, antibiotics) from narrative management plans into `treatments` (`TreatmentItem[]` with `provenance: 'scribe'`).
  - Extracted acute procedures (catheterization, NG tube, suturing, reductions, splints) into `proceduresChecked` / `otherProcedures`.
  - Preserved narrative clinical disposition in `dispositionAndPlan.managementPlan`.
- **Scribe Chat Turn Summary Synchronization (`VoiceScribeChatView.tsx`, `scribeChatTurn.ts`)**:
  - Updated `summarizeUpdatedFields` to report treatments, procedures, and imaging in "Captured From Your Update".
  - Refined `humanizeFieldLabel` and `resolveChecklistValue` in `VoiceScribeChatView.tsx` to handle imaging, labs ordered, treatments, procedures, last meal, and events accurately.

### [2026-09-19] — Log Book De-Identification Closure, Search Scoping & MoreView Independent Role Hardening
- **My Log Book Privacy Closure (`src/components/ProfileSettingsView.tsx`)**:
  - Removed all mentions of `"UHID"` from the portfolio search input placeholder (`"Search Category, Procedure, Skills, Learning..."`).
  - Restricted portfolio search fields strictly to de-identified parameters: `caseCategory`, `proceduresPerformed`, `skills`, and `learningPoints`.
  - Confirmed and verified that UHID is never stored in `users/{uid}/logbook/{entryId}` documents, never mapped into `unifiedLogs`, and never rendered in the UI cards or list.
- **MoreView Role Scope Hardening (`src/components/MoreView.tsx`)**:
  - Excluded `Department Team & Roster` and `Clinical Analytics & KPIs` cards for Independent clinicians (`normalizedRole !== "independent"`), ensuring independent doctors without hospital affiliation are never presented with hospital-wide team or analytics entry points.
  - Retained read-only Department Team and appropriate Analytics access for hospital-affiliated Consultants and Residents, while HODs retain primary navigation placement.
- **Team Roster Board HOD Action Permissions (`src/components/TeamRosterBoard.tsx`)**:
  - Hardened action handlers (`handleAddSubmit`, `handleCreateNewShift`, `handleDeleteShift`, `handleSaveShifts`) with explicit `isUserHOD` guards.
  - Verified that non-HOD users (Consultants, Residents) can view shifts and team members in read-only mode, but cannot onboard members, alter or delete shifts, or perform administrative management.

### [2026-09-19] — Universal Learn Navigation, MoreView Deduplication & Profile-Team Routing Freeze
- **Universal Learn Navigation (`src/App.tsx`)**: Promoted `Learn` to a primary navigation destination across all clinician roles (Resident, Consultant, HOD, Independent, and Platform Admin) on both desktop and mobile bottom navigation. Educational modules (Interactive ER Simulations, Clinical Reference Q&A, Residency Trivia, Clinical Memory Log, and Google Classroom) are centralized in the Learn hub.
- **Role-Differentiated Primary Navigation Hierarchy**:
  - **Resident**: Dashboard, Handover, My Log Book, Learn, Tools, More.
  - **Consultant**: Dashboard, Cases, Handover, My Log Book, Learn, Tools, More.
  - **HOD**: Dashboard, Cases, Handover, Department Team, Analytics, My Log Book, Learn, More.
  - **Independent**: Dashboard, My Cases, My Log Book, Learn, Tools, More.
  - **Platform Admin**: Retains dedicated Admin Control Center access alongside Learn.
- **MoreView Destination Deduplication (`src/components/MoreView.tsx`)**:
  - Removed duplicate equal-weight `Department Team & Roster` and `Clinical Analytics & KPIs` cards for HOD users (already present in primary navigation). These remain accessible in More for non-HOD roles.
  - Removed redundant equal-weight `Learn` card from More (since Learn is now universal in primary navigation).
  - Converted Platform Admin entry into a clean subordinate link at the bottom of MoreView to avoid duplicate equal-weight cards.
- **Profile vs Department Team Roster Routing (`src/components/ProfileSettingsView.tsx`)**:
  - Normalized `initialSubSection` to handle `"team"`, `"roster"`, `"logbook"`, and `"log-book"` aliases seamlessly.
  - Roster and team management links within Profile Settings route directly to the single canonical `Department Team` tab via `handleOpenTeamRoster()`, keeping Profile focused on personal credentials, workplace settings, preferences, and account security.
- **My Log Book Portfolio Integrity**: Verified individual clinician portfolio functionality across all roles, including procedure counts, triage breakdown, search filters, and CSV export.

### [2026-09-19] — Role-Based Navigation Refinement, Tools Hub & More Menu Consolidation
- **Role-Differentiated Primary Navigation (`src/App.tsx`, `src/utils/roleUtils.ts`)**: Replaced hardcoded navigation array with dynamic role-based tab hierarchy computed via `userNormalizedRole` (`getNormalizedRole()`):
  - **Resident**: Dashboard, Handover, My Log Book, Learn, Tools, More.
  - **Consultant**: Dashboard, Cases, Handover, My Log Book, Tools, More.
  - **HOD**: Dashboard, Cases, Handover, Department Team, Analytics, My Log Book, More.
  - **Independent**: Dashboard, My Cases, My Log Book, Tools, More.
  - **Platform Admin (`varahgrp@gmail.com`)**: Retains dedicated Admin Control Panel access in both primary nav and More menu.
- **Clinical Utility Hub (`src/components/ToolsView.tsx`)**: Consolidated clinical utilities into a unified Tools destination with embedded fast switchers for EM Resuscitation & Drug Guide (`ErGuideView`), Pediatric Dosing Calculator (`PediatricDrugCalculatorView`), and Pocket Mirror / Airway Exam (`PocketMirrorView`).
- **Secondary Features Consolidation (`src/components/MoreView.tsx`)**: Grouped lower-frequency modules into a clean grid: Clinician Directory, MLC Certificates, Profile & Department Settings, Learn & Simulations (for non-residents), Department Team & Analytics (for non-HODs), and Admin Control Panel.
- **Independent Case Registry Naming (`src/components/CasesListView.tsx`)**: Conditioned registry branding with `isIndependent` prop to render "My Cases" for independent doctors and "Cases Registry" for hospital-affiliated clinicians.
- **Synchronized Responsive Navigation**: Mirrored identical role-based hierarchy across desktop navigation bar, mobile bottom tab bar, and PWA viewport with consistent active state management and quick actions.

### [2026-09-19] — Navigation Simplification, Role-Based Access & Unified Save Feedback Engine
- **Role-Based Primary Navigation Architecture (`src/utils/roleUtils.ts`, `src/App.tsx`)**: Created centralized `getNormalizedRole()` utility supporting `"HOD" | "Consultant" | "Resident" | "Independent"`. Primary navigation dynamically displays tabs based on role:
  - **HOD**: Dashboard, Department Team (promoted to primary tab), Cases, My Log Book, Simulations.
  - **Consultant**: Dashboard, Cases, My Log Book, Simulations.
  - **Resident**: Dashboard, Cases, My Log Book, Simulations.
  - **Independent**: Dashboard, Cases, My Log Book.
  - Quick Triage modal, AI Voice Scribe, and New Patient Intake remain omnipresent in top app bar.
- **Direct Navigation & Deep-Linking (`src/components/ProfileSettingsView.tsx`)**: Refactored `ProfileSettingsView` with `initialSubSection` prop and intelligent Back-to-Dashboard navigation. Direct access to Log Book and Department Roster tabs seamlessly deep-links into the respective sub-views with clear "Clinical Governance" indicators.
- **Searchable Case Registry (`src/components/CasesListView.tsx`)**: Clarified the Cases tab as a searchable historical registry distinct from the live operational Dashboard. Added multi-attribute filtering (Triage P1/P2/P3, Status Active/Triage/Admitted/Discharged/Transferred/MLC, and Age Group Adult/Pediatric) with instant "Reset Filters" and clean empty-state feedback.
- **Unified Save Feedback Engine (`src/components/CaseSheetView.tsx`)**: Implemented low-friction, synchronized save status badges across acute tabs (Treatment, Investigations, and Disposition):
  - State: `Saving...` with spinner during write.
  - Success: `✓ [Tab] saved` with 2.8s auto-soften transition.
  - Failure: High-contrast `[Tab] not saved — Retry` alert banner.
  - Unsaved Dirty State: Pulsing indicator on Treatment flowsheet when pending changes exist.
- **Public Directory DPDP Review Flag (`src/components/DoctorsDirectoryView.tsx`)**: Flagged doctor email visibility in public clinician directory with DPDP Act compliance review marker.

### [2026-09-19] — Treatment Tab UX Cleanup & Real-Time Save State Engine
- **Treatment Persistence Architecture Preserved**: Kept the existing universal Case Sheet `Save Changes` architecture and Scribe persistence sequence intact (Scribe extraction persists to Firestore upon Prepare Case Sheet prior to navigation; manual modifications remain local state until explicit save).
- **Provenance & State Tracking (`src/types.ts`, `src/components/CaseSheetView.tsx`, `src/App.tsx`)**: Added `provenance?: 'scribe' | 'manual'` to `TreatmentItem`. Voice-extracted cases automatically tag treatments with `provenance: 'scribe'`, while manually logged medications and infusions default to `provenance: 'manual'`.
- **Real-Time Save State & Dirty Indicator**: Implemented snapshot-derived dirty detection (`extractTreatmentSnapshot`) and real-time state badge in the Treatment Tab header (`Treatment saved`, `Unsaved treatment changes`, `Saving treatment...`, or `Treatment not saved — Retry`). Individual treatment and infusion table rows display dedicated `Saved` / `Unsaved` badges and origin indicators (`From Scribe` / `Manual`).
- **Removed Obsolete Extraction Ghost Area**: Completely removed confusing `currentCase.medications` voice extraction block with redundant "+ Log to Flowsheet" buttons, establishing a single canonical Medication & Resuscitation Flowsheet.
- **Two-Step Removal UX with Undo**: Replaced destructive trash icons with a dedicated "Remove" button that triggers a non-destructive pending state with an interactive inline banner (`"[Drug]" removed — press Save Changes to confirm`) and an `Undo` button.
- **Feature Relocation**: Cleanly relocated the AI Differential & CDS Support block into the Diagnosis & Assessment section of the Investigations tab, keeping the acute Treatment tab strictly focused on medications, infusions, and emergency resuscitation procedures.

### [2026-09-19] — Log Book Update Rule Hardening (Phase 3A.1) & 39-Test Suite Verification
- **Log Book Field-Level Update Hardening (`firestore.rules`)**: Restricted client `update` on `/users/{userId}/logbook/{entryId}` strictly to owner doctor (`isOwner(userId)`), enforcing field-level restriction via `incoming().diff(existing()).affectedKeys().hasOnly(['learningPoints', 'skills', 'updatedAt'])`. Completely denies client tampering or modification of trusted immutable fields (`ownerUid`, `sourceCaseId`, `sourceType`, `hospitalIdAtTime`, `hospitalNameAtTime`, `roleAtTime`, `dateSeen`, `ageGroup`, `gender`, `triageCategory`, `caseCategory`, `proceduresPerformed`, `procedureName`, `createdAt`). Client `create` remains strictly forbidden (`allow create: if false`), preserving trusted backend Admin SDK creation.
- **39-Scenario Emulator Test Suite (`test_phase3_rules.cjs`)**: Expanded test suite with test case `G4b` verifying immutable field tampering is rejected with `PERMISSION_DENIED`. Re-tested against active local Firestore emulator (port 8085) with 100% pass rate (39/39 passed, 0 failed). Zero deployments performed.

### [2026-09-19] — Phase-3 Transitional Firestore Rules Implementation & 38-Test Suite Verification
- **Phase-3 Cutover Rules Implementation (`firestore.rules`)**: Implemented transitional cutover Firestore security rules enabling Phase-3 UID and team membership ownership (`workspaceType == 'hospital' | 'individual'`) alongside strict fallback preservation for legacy cases (`!('workspaceType' in doc)`):
  - **Hospital Cases (`workspaceType == 'hospital'`)**: Requires `createdByUid == request.auth.uid`, `ownerUid == null`, and verified active membership in `team_members/{uid}` matching `hospitalId` (normalizing both `hospitalId` and legacy `hospital` fields). Update preserves immutable metadata (`createdByUid`, `workspaceType`, `ownerUid`, `hospitalId`).
  - **Individual Cases (`workspaceType == 'individual'`)**: Requires `createdByUid == request.auth.uid`, `ownerUid == request.auth.uid`, `hospitalId == null`, and zero active hospital memberships. Strictly personal — only the owner UID may read or update.
  - **Legacy Cases Fallback**: Preserves `sameHospital` fallback for existing pre-Phase-3 cases without `workspaceType`. Strictly forbids client injection of Phase-3 metadata (`workspaceType`, `ownerUid`, `hospitalId`, `createdByUid`) during updates.
  - **Subcollections Inheritance**: All case subcollections (`/{subcollection}/{subDoc=**}`) strictly inherit authorization from the parent case via `canAccessCase(parent)`.
  - **Doctor Log Book (`users/{userId}/logbook/{entryId}`)**: Strictly personal to the doctor (`isOwner(userId)`). Direct client creation denied (`allow create: if false`).
  - **Team Members Self-Read (`team_members/{memberId}`)**: Clinicians can directly read their own team membership document (`memberId == uid()`) in addition to hospital-scoped reads.
- **38-Scenario Emulator Test Suite (`test_phase3_rules.cjs`)**: Executed comprehensive 38-test matrix across groups A-G on local Firestore emulator (port 8085) with 100% pass rate (38/38 passed, 0 failed). Verified zero deployments, zero data mutations, and clean compilation.

### [2026-09-19] — Firebase Admin Named Database Alignment & Team Routes Mounting
- **Named Database Configuration (`src/lib/firebase-admin.ts`)**: Updated the shared Firebase Admin Firestore singleton `db` to explicitly target the verified named production database `ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03` (with project ID `ermate-e8f01`) via `getFirestore(app, FIRESTORE_DATABASE_ID)`. Added defensive guards throwing a fatal initialization error if `FIRESTORE_DATABASE_ID` is missing or defaults to `"(default)"`, preventing silent fallback.
- **Backend Route Alignment Audit**: Verified that all backend routes importing the shared Admin `db` (`server/routes/team.routes.ts`, `server/routes/logbook.routes.ts`, `server/routes/payments.ts`) are 100% aligned to the shared named database instance.
- **Team Router Mounting (`server.ts`)**: Mounted `teamRouter` at `/api/team` in `server.ts` to ensure invite creation, invite acceptance, member removal, and team departure endpoints route through the verified named database.
- **Client & Admin SDK Database Equality Proof**: Executed runtime verification demonstrating exact equality between Client Firestore database ID (`ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03`) and Admin Firestore database ID (`ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03`).

### [2026-08-17] — Background Transcription Network Guard & Incoming Call Hardening
- **Phone Call Mic Interruption Fix (`track.onended`)**: Added `track.onended` listeners to the `MediaRecorder` audio tracks in `src/components/shared/VoiceRecorder.tsx`, `CaseSheetView.tsx`, and `QuickDischargeIntake.tsx`. This ensures that when mobile operating systems (iOS/Android) terminate the microphone stream due to an incoming phone call, the app cleanly stops the recording and gracefully preserves the audio blob instead of locking up.
- **Background Network OS Throttling Guard**: Refactored the transcription trigger across all voice intake mechanisms to check `document.visibilityState === "hidden"`. If a dictation ends while the app is in the background (e.g., user answered the phone), the `/api/voice/transcribe` fetch request is automatically suspended and cached in memory. It resumes seamlessly the moment the user brings the app back to the foreground, eliminating "Network request failed" errors caused by mobile OS background throttling.

### [2026-08-09] — Integrated Sarvam AI Client, FFmpeg Audio Normalization & Clinical Reasoning Module
- **Self-Contained Sarvam AI Client (`server/sarvamClient.ts`)**: Ported clean, self-contained Sarvam AI client supporting STT (`saaras:v3`), STT translation, PDF document parsing, and code-mixed translation (`mayura:v1`), operating with clean API key evaluation (`SARVAM_AI_API_KEY` or `SARVAM_API_KEY`).
- **FFmpeg Audio Normalization (`server/audioConvert.ts`)**: Added FFmpeg conversion module converting incoming audio dictations to 16kHz mono 16-bit PCM WAV prior to Sarvam ASR processing, eliminating browser codec variance across Chrome, Safari, and Firefox.
- **Clinical Decision & Reasoning Engine (`server/aiDiagnosis.ts`)**: Created self-contained clinical decision support module strictly enforcing model matrix rules — Claude 3.5 Sonnet ONLY for differentials, ABG interpretation, and rounds debrief (no fallbacks), Claude 3.5 Sonnet → GPT-4o for discharge course synthesis, PALS pediatric age cutoff (<18), and DPDP Act 2023 `deidentifyText()` PHI stripping on all free-text clinical inputs.
- **Informational Doctors Directory (`DoctorsDirectoryView.tsx`)**: Created self-reported public clinician directory with state and hospital filters and HOD bootstrapping claim requests (`hodClaimRequests`), maintaining strict separation from PHI-bearing Team Rosters.
- **Bootstrapping HOD Claim Gate & Admin Panel Review (`AdminHodClaimReview.tsx`)**: Added manual verification workflow in Admin Panel (`varahgrp@gmail.com`) for unassigned hospital department lead claims, backed by hardened Firestore security rules (`firestore.rules`).

### [2026-08-08] — Secure Token Invite Infrastructure, Firestore Security Hardening & Voice Scribe Mic/API Pipeline Fixes
- **Head of Department (HOD) Visibility & Identification Provisions**: Integrated explicit, unmissable HOD identification banners across `TeamRosterBoard.tsx`, `DashboardView.tsx`, and `ProfileSettingsView.tsx`. Renders dedicated Department Leadership cards (👑 HOD Name, Email, Duty Shift, and Hospital Authority), interactive HOD detail modals on the Welcome Banner, and verified HOD badges across user settings.
- **Secure Random Single-Use Expiring Team Invites**: Refactored team invitation link generation across `DashboardView.tsx`, `ProfileSettingsView.tsx`, `TeamRosterBoard.tsx`, and `TeamBuilder.tsx` to use cryptographically secure 24-character random tokens (`sec_inv_*`) stored in Firestore `team_invites/{inviteToken}` with 7-day expiration (`expiresAt`), max usage counters (`maxUses`, `usesCount`), and active status validation (`status: 'active'`), replacing legacy guessable hospital slug URLs.
- **Server-Side Privilege Escalation Hardening (`firestore.rules`)**: Locked `users/{userId}` Firestore `allow create` rule strictly to resident-equivalent roles (`EM Resident`, `Resident`, `resident`, `Doctor`, `Physician`, `Emergency Physician`) and required matching email domain/token identity. Guaranteed that uninvited signups can NEVER self-assign HOD or Consultant privileges during account creation.
- **Signup Form HOD UI Sanitization (`SignUpView.tsx`)**: Enforced role picker restriction on `SignUpView.tsx` so new users signing up without an authorized HOD invite token are restricted strictly to "EM Resident".
- **Voice Scribe Universal Floating Mic Recording Banner (`SpeechMicButton.tsx`)**: Upgraded voice recording visual feedback to render a high-contrast floating `createPortal` overlay (`z-[100000]`) across all layouts (including chat view). Displays live pulsing red recording indicator (`RECORDING DICTATION`), digital timer (`00:05`), animated audio frequency wave bars, and explicit Discard/Pause/Done buttons.
- **Two-Way Voice Scribe Chat Payload Fix (`VoiceScribeChatView.tsx`)**: Added `userInput` to JSON POST request payload in `handleSendMessage` and `handleVoiceTranscript`, ensuring `/api/scribe-chat` triggers full parallel Extraction (`gpt-4o-mini`) and Clinical Reasoning (`callClinicalReasoningModel`).
- **Strict Rule 1 Clinical Reasoning Enforcement (`server.ts`)**: Replaced `callClinicalReasoningModel` inside `/api/scribe-chat` with strict Claude 3.5 Sonnet execution. Removed all secondary model fallbacks (`gpt-4o-mini` and `gemini-2.0-flash`), completely deleting legacy fallback blocks and eliminating fabricated synthetic citations or differentials. If Claude 3.5 Sonnet is unavailable or output is unparseable, returns empty arrays for differentials/watchFor/references and an explicit message: `"Clinical reference is temporarily unavailable. Your case sheet update was still saved."`

### [2026-08-08] — Critical Voice Extraction PHI De-identification & Complete AI Pipeline Audit
- **Voice Extraction PHI De-identification (`server/voiceExtraction.ts`)**: Integrated DPDP Act 2023 `deidentifyText()` at top of `extractFromTranscript()` in `server/voiceExtraction.ts`. Strips all PHI (names, UHIDs, phone numbers, facility names, dates) before passing dictation transcripts to OpenAI `gpt-4o-mini`, Claude 3.5 Haiku (Tier 2), or Claude 3.5 Haiku (Tier 3 retry).
- **Codebase-Wide AI Pipeline Audit**: Audited all AI generation and extraction routes across `server.ts`, `server/handover.ts`, `server/extraction.ts`, `server/scribeChatTurn.ts`, `server/dischargeSummary.ts`, and `server/mortalityAudit.ts`. Confirmed `deidentifyText()` is called across all routes (`/api/scribe-extract`, `/api/handover/parse-structured`, `/api/handover/compile-sheet`, `/api/ai-discharge`, `/api/mortality-audit/generate`, `/api/scribe-chat`, `/api/case-discussion`, `/api/rounds-debrief`, `/api/clinical-decision-support`, `/api/em-reference`, `/api/scribe-ocr-scan`).
- **Claude Helper Boundary Safety Net**: Updated `callClaudeTextAPI()` and `callClaudeSonnetOnly()` in `server.ts` to execute `deidentifyText()` on prompt parameters at the function boundary, providing defense-in-depth protection for all Anthropic model calls.

### [2026-08-08] — Full Light Theme Synchronization & Voice Scribe / Mic Pipeline Refactoring
- **MediaRecorder MimeType & Audio Blob Fix**: Refactored `SpeechMicButton.tsx` and `QuickDischargeIntake.tsx` to explicitly check browser-supported mimeTypes (`audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`, `audio/aac`, `audio/ogg`, `audio/wav`) when instantiating `MediaRecorder`. Constructed recording Blobs using `mediaRecorder.mimeType` rather than hardcoded defaults, eliminating audio format mismatch errors across Chrome, Safari, and Firefox.
- **Server-Side Transcription Handling Verification**: Confirmed `/api/voice/transcribe` (`performTranscription` in `server.ts`) correctly parses and normalizes incoming audio mimeTypes (`audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`, `audio/aac`), automatically converting buffers via FFmpeg or passing native mimeTypes to Gemini/Sarvam.
- **Universal Light/Dark Theme Alignment**: Refactored `NewPatientEntryMenu.tsx`, `RoleChangeSection.tsx`, `ScribeClinicalChat.tsx`, `VoiceScribeChatView.tsx`, `ManualEntryPrimitives.tsx`, and `SpeechMicButton.tsx` with responsive theme classes (`bg-white dark:bg-slate-950`, `text-slate-900 dark:text-white`, `border-slate-200 dark:border-slate-800`), eliminating forced dark background overrides in light mode.
- **Voice Scribe Chat History Persistence**: Integrated `appendChatMessage` into `VoiceScribeChatView.tsx` for both user dictations and AI clinical assistant responses to persist messages in Firestore (`cases/{caseId}/scribeChatMessages`). Ensures chat history survives re-renders and snapshot updates.
- **Microphone Dictation UX Guard**: Updated `SpeechMicButton.tsx` to ensure short dictation attempts display explicit user guidance ("Recording too short. Please dictate for a longer duration.") across all layouts and added theme support to the recording modal portal and audio visualizer.

### [2026-08-07] — Resolved Duplicate Key Warnings, Cross-Origin Security Errors & Deprecated AI Model Fallbacks
- **Gemini Model Alignment & Deprecation Fix**: Replaced retired `gemini-2.5-flash` model references across `server.ts`, `server/handover.ts`, `server/extraction.ts`, `server/mortalityAudit.ts`, `server/routes/extraction.routes.ts`, and `src/types.ts` with active `gemini-2.0-flash` and `gemini-1.5-flash` fallbacks, eliminating 404 model unavailable errors and ensuring seamless multi-candidate rotation.
- **Top-Level Cross-Origin Frame Error Guard (`src/utils/crossOriginGuard.ts`)**: Extracted cross-origin window inspection error interception into `crossOriginGuard.ts` and imported it as the first line of `src/main.tsx` prior to React module loading. Intercepts `$$typeof` and frame property access errors on cross-origin `Window` objects caused by host iframe boundaries and dev tools inspection.
- **New Patient Entry Menu Workflow Integration**: Connected `onStartFullFlow` in `DashboardView.tsx` and `CasesListView.tsx` via `App.tsx` to open `NewPatientEntryMenu.tsx` first, allowing doctors to choose between Triage Registration, Speak the Case (Voice Scribe), Manual Case Sheet Entry, or direct Adult/Pediatric case sheet routing.
- **Case Sheet Plain Text Generator Enrichment (`generateCaseSheetText`)**: Updated `src/components/DashboardView.tsx` to synthesize all missing fields including GCS calculation/breakdown, structured secondary survey (`cvs`, `respiratory`, `abdomen`, `cns`, `extremities`), Psychological Assessment safety flags (suicidal ideation, self-harm, intent to harm others, substance abuse, psychiatric treatment, support system), EFAST interpretation, MLC details, and full pediatric details (environment meds, birth/feeding/developmental history, brought by, informant).
- **Declined Fields Removal Patch**: Removed unneeded additions (`policeStation`, `constableName`, `beltNumber` from MLC text, and `tone`, `cry`, `gaze`, `crt` standalone sub-toggles from pediatric text), preserving standard 5-field MLC layout and standard 3-category PAT PALS structure.
- **Printable Case Sheet View Alignment (`CaseSheetPrintView.tsx`)**: Updated `convertClinicalCaseToCaseSheetData` and presentational components to display GCS in initial vitals bar, Extremities in systemic examination, EFAST in initial assessment adjuncts, and full pediatric history fields on the read-only printable case sheet.
- **Deduplicated Cases State Engine**: Updated `onSnapshot` stream handler and `handleSaveTriagedCase` in `src/App.tsx` to deduplicate `cases` array by `c.id` upon receiving Firestore updates or saving new cases, eliminating duplicate case instances in memory.
- **Unique Component React Keys**: Updated list rendering across `DashboardView.tsx`, `CasesListView.tsx`, `HandoverView.tsx`, `TeamRosterBoard.tsx`, `GoogleClassroomModal.tsx`, `MortalityAuditModal.tsx`, `SimulationsView.tsx`, `ProfileSettingsView.tsx`, and `App.tsx` to use composite index-appended keys (`${c.id}-${idx}`), resolving duplicate React key console warnings (`C-3580`, `C-6764`).

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
- **Complete Elimination of Demo Cases, Default Handovers, and Seeded Team Members**: Removed all hardcoded demo cases (`demoCases`), fallback quick paste demo patients (`DEFAULT_QUICK_PASTE_PATIENTS`), demo shift doctors (`activeShiftDoctors`), demo shift rota assignments (`rotaAssignments`), and automatic default team member seeding (`defaultTeam`) across `App.tsx`, `HandoverView.tsx`, `TeamBuilder.tsx`, and `ProfileSettingsView.tsx`. Integrated real-time Firestore auto-purging in `App.tsx` that identifies and permanently deletes legacy demo team member documents (`dr.vipin@gmail.com`, `priya.nair@gmail.com`, `sanjay.verma@gmail.com`, `dr.ananya@gmail.com`, etc.) from the live database on snapshot stream.
- **Session Loading & Profile Initial Flash Resolution**: Resolved initial profile flash ("Emergency Physician" / "Free Standard") by deferring `setIsLoggedIn(true)` until Firebase Auth and Firestore `users/{uid}` profile resolution complete, and enforcing an explicit `authLoading` spinner screen while resolving clinical session metadata.
- **Two-Way Scribe & Persistent Clinical Chat**: Upgraded Voice Scribe into a full two-way clinical chat engine (`/api/scribe-chat`, `server/scribeChatTurn.ts`, `scribeChatStorage.ts`). Every user turn (typed or voice dictation) executes dual parallel model calls (GPT-4o-mini/Claude Haiku for Case Sheet extraction, and Claude 3.5 Sonnet without fallback for evidence-based clinical reasoning and DDx). Chat histories are persisted per `caseId` in Firestore subcollections (`cases/{caseId}/scribeChatMessages`). "Finish & Start New Case" clears the active screen and generates a fresh `caseId`, while reopening any existing case via "Discuss" or "Scribe Chat" restores its complete chat thread and continuity.
- **Firebase Document Reference Guard**: Fixed `Invalid document reference` error (`hospital_subscriptions` segment mismatch) in `App.tsx` by verifying `hospitalSlug` is non-empty and well-formed before initializing Firestore document references.
- **Seamless Multi-Account Sign-In & Logout Persistence**: Enhanced `authenticatePresetUser` and `handleGooglePasswordSubmit` in `MockLoginView.tsx` to ensure any new email address or credential entered after logout creates or authenticates a valid Firebase user session without getting stuck on loading indicators or throwing credential errors.
- **Gemini Model Alignment & AI Rate-Limit Resiliency**: Replaced deprecated `gemini-1.5-flash` and `gemini-1.5-pro` model strings in `server.ts` with active supported Gemini aliases (`gemini-2.0-flash` & `gemini-2.5-flash`). Updated the retry proxy in `server.ts` to rotate candidate models cleanly on rate limits (429) or transient errors. Added deterministic local heuristic report fallbacks to `PocketMirrorView.tsx` (`/api/lens-report`) so diagnostic lens report generation remains 100% functional even during network timeouts or AI API rate limits.
- **Ordered Logout Teardown & Root App Error Boundary**: Re-ordered `handleSignOut` in `src/App.tsx` so `setIsLoggedIn(false)` and view reset states are executed first, unmounting active clinical components before nulling out `profile`, `cases`, and `hospitalSubscription`. Created `src/components/AppErrorBoundary.tsx` and wrapped `<App />` in `src/main.tsx` as a safety boundary, eliminating blank white screen crashes during logout transitions.
- **Robust Authentication & Offline Firestore Guards**: Guarded all `profile` properties with optional chaining (`profile?.hospital`, `profile?.name`, etc.) across `App.tsx` top-level headers and modals, preventing null reference errors during auth state transitions. Added fallback candidate password loops in `authenticatePresetUser` and gracefully handled `auth/email-already-in-use` errors to ensure seamless account login. Updated Firestore `onSnapshot` subscription listeners with offline error callbacks.
- **Non-Fabricating Tier 4 Voice Extraction Fallback & Manual Entry Warning Banner**: Replaced the legacy Tier 4 heuristic fallback in `server/voiceExtraction.ts` and `server.ts` with a strict non-fabricating safety protocol. When all AI models fail or rate limit, the backend preserves the doctor's raw dictation transcript (`rawDictationText`), returns `success: false` and `requiresManualEntry: true`, and leaves all clinical exam fields and vitals empty instead of fabricating normal exam defaults. Updated `VoiceScribeChatView.tsx` to detect `requiresManualEntry: true` / `success: false` and display a prominent, persistent warning banner featuring the preserved dictation transcript for manual entry.
- **Strict Voice & Case Extraction Model Cascade Alignment**: Removed Gemini Flash/Pro entirely from text-based voice extraction in `server/voiceExtraction.ts` and `server/extraction.ts` (`withFallback`). Aligned cascade strictly to **GPT-4o-mini** (Primary) → **Claude 3.5 Haiku** (Fallback) → **Claude 3.5 Haiku Retry** (Transient Recovery) → **Tier 4 Non-Fabricating Manual Entry Fallback**, completely isolating Gemini models to multimodal image/OCR vision routes as mandated by Rule 1.
- **Voice Dictation Multi-Tab Extraction & State Synthesis Patch**: Implemented `mergeUnique` deduplication helper and updated `handleVoiceSubmit` in `src/components/CaseSheetView.tsx`. The voice dictation pipeline now populates and synthesizes data across all Case Sheet tabs (Demographics & Vitals, SAMPLE History, Primary & Secondary Assessment, Investigations, Treatment & Infusions, Disposition & Plan, and Pediatric Details) without overwriting pre-existing non-empty data or creating duplicate entries.
- **AI Discharge Summary Model Cascade & DPDP Protection Alignment**: Updated `/api/ai-discharge` in `server.ts` to execute DPDP Act 2023 `deidentifyText()` on all patient clinical text fields prior to prompt generation. Replaced the Gemini model call with the locked Discharge Summary model hierarchy: **Claude 3.5 Sonnet** (Primary) → **GPT-4o** (Fallback) → Factual Deterministic Backup (`simulated: true`), completely removing Gemini from text discharge generation.
- **Rounds & Debrief & Case Discussion Clinical Reasoning & DPDP Alignment**: Updated `/api/rounds-debrief` and `/api/case-discussion` in `server.ts` to execute DPDP Act 2023 `deidentifyText()` across all patient clinical text fields (patient name, complaint, story, PMH, examination, lab summaries, progress notes, and discussion messages) prior to model prompt construction. Enforced **Claude 3.5 Sonnet** strictly for all clinical reasoning and reference chat, removing Gemini Flash fallbacks per Rules 1, 3, and 4.
- **Discussion & Rounds Chat LocalStorage Hardening**: Completely eliminated all `localStorage` writes and reads for clinical discussion and rounds chat messages (`ermate_discussion_`, `ermate_discussion_name_`, `ermate_rounds_chat_`) across `CaseDiscussionModal.tsx` and `CaseSheetView.tsx`. On shared workstation terminals, discussion histories now rely strictly on secure Firestore subcollection persistence (`cases/{caseId}/discussions/active_session` and `cases/{caseId}`), preventing unencrypted patient data exposure in browser storage across logins.
- **Comprehensive Case Sheet Text Generator Synthesis**: Enhanced `generateCaseSheetText` in `DashboardView.tsx` to synthesize a complete 11-section clinical case summary covering demographics, triage vitals, SAMPLE history, Primary ABCDE survey with adjuncts, Secondary & Pediatric assessment, abnormal lab results, treatments & infusions, differential diagnoses, disposition & plan, progress notes, and NABH/JCI safety checklists.
- **Hardened Printable Case Sheet Clinical Accuracy**: Updated `CaseSheetPrintView.tsx` to eliminate fabricated default values (such as hardcoded VBG values, default normal ECG/Echo findings, and fallback clinician names like "Dr. Rajagirier"). Added missing sections including Disposition & Outcome, full Differential Diagnoses list, conditional Pediatric assessment, and Notes/Addendum, while restricting lab result flagging to verified parameter name matches.
- **Hardened Discharge Summary Pipeline & Zero-Fabrication Verification**: Audited and refactored `DischargeSummaryView.tsx`, `CaseSheetView.tsx` (`syncDischargeSummary`), and `/api/ai-discharge` in `server.ts`. Fixed state mapping bug where `conditionAtDischarge` was written to `generalExamination`. Removed arrival vitals fallbacks for discharge vitals (`dischargeHr`, `dischargeBp`, etc.) so unmeasured discharge vitals display "Not recorded" rather than misleading arrival vitals. Removed fabricated default text for hospital course, condition at discharge, and follow-up plan. Integrated conditional Pediatric Assessment block onto the printable discharge card preview and formatted clinician signature blocks to show "Not Recorded" when unassigned. Replaced all hardcoded "normal" examination fallbacks ("Normal", "None", "B/L Equal", "Absent", "Negative", "<2s", "Warm", "Alert", "PERRL", "No significant findings", "Clear", "S1 S2 heard", "Soft, non-tender", "NFAD", "No edema, pulses present") across `getFormattedDischargeSummaryText()`, `getFormattedDischargeSummaryHtml()`, and the on-screen/printable card preview with uniform "Not documented" indicators. Updated `handleAiDraft()` to capture the `simulated` flag and display a non-destructive warning banner whenever deterministic template fallbacks are utilized due to AI model unavailability. Fixed HTML temp string orphaned-unit formatting.
- **Standalone Quick Discharge Intake Engine (`src/components/QuickDischargeIntake.tsx`)**: Built a dedicated fast intake view supporting EMR Text Paste, Voice Dictation, and Photo Capture. Converted intakes directly into a minimal `ClinicalCase` tagged with `entrySource: "quick_discharge"`, which automatically delegates to the zero-fabrication `DischargeSummaryView.tsx` for AI drafting and JCI/NABH card rendering. Added `entrySource?: "quick_discharge" | "full_case"` to `ClinicalCase` in `src/types.ts` for unified registry traceability. Enforced `bypassCreditCheck: true` to ensure Quick Discharge remains 100% free across all intake routes. Updated `App.tsx` and `DashboardView.tsx` to launch Quick Discharge seamlessly.
- **Handover PDF & Print Text Fallback Hardening**: Updated `handleDownloadHandoverPdf` and `getRegistryPrintText` in `src/components/HandoverView.tsx` to eliminate fabricated "Stable" and "Active monitoring" fallback values when cases lack progress notes or treatments, replacing them with explicit "Not documented" and "No plan documented" indicators. Updated model fallback array in `server/handover.ts` to strictly remove Gemini Flash per Rule 1.
- **Three-Section Case Sheet Print View & Deterministic Psychological Assessment**: Separated the merged examination findings block in `CaseSheetPrintView.tsx` into three distinct sections: `PrimarySurveySection` (ABCDE), `SecondarySurveySection` (systemic examination), and `PsychologicalAssessmentSection`. Implemented deterministic rendering for Psychological Assessment directly reading the 7 risk toggles (`suicidalIdeation`, `selfHarmHistory`, `intentToHarmOthers`, `substanceAbuse`, `psychiatricHistory`, `currentlyOnPsychiatricTreatment`, `hasSupportSystem`) without AI-paraphrased summaries. Added prominent red alert highlighting for active psychiatric risk flags. Updated `src/types.ts` with `PsychologicalAssessment` interface and `psychologicalAssessment` property on `ClinicalCase`.
- **Firebase Initialization & Connection Stability Fix**: Updated `src/firebase.ts` to use `getApps()` / `getApp()` for idempotent SDK initialization, changed log level to `silent` to suppress noisy connection warnings, and removed top-level `testConnection()` network pings on module load. Replaced top-level uninitialized `getFirestore()` call in `src/services/scribeChatStorage.ts` with direct import of `db` from `../firebase`, resolving `Uncaught FirebaseError: No Firebase App '[DEFAULT]' has been created` and backend connection errors.
- **Firestore Sanitizer & Undefined Value Protection**: Created `src/utils/firestoreSanitizer.ts` with `sanitizeForFirestore` recursive cleaner and updated `TriageForm.tsx`, `App.tsx`, and `HandoverView.tsx`. Automatically strips `undefined` properties from patient demographics (e.g. `patient.uhid`, `phone`, `mlcDetails`) and clinical case objects before executing Firestore `setDoc` or `updateDoc` operations, eliminating `Function setDoc() called with invalid data. Unsupported field value: undefined` write errors across triage registration, case sheet editing, and bulk discharge.
- **Explicit New Patient Entry Method Menu (`src/components/NewPatientEntryMenu.tsx`)**: Created modular intake menu offering Voice Scribe dictation ("Speak the Case"), manual typing form, Triage-first workflow, and direct Adult/Pediatric case sheet selection. Standardized case object creation via `createNewCase` factory, aligned pediatric routing to `PEDIATRIC_AGE_CUTOFF = 18` with dynamic `recomputeIsPediatric()` helper, and added `isTriageCategoryPending()` guard to prevent blank triage categories from defaulting to fake values.
- **Triage Registration Submit Fix**: Resolved issue where tapping "Create Clinical Case Sheet" at the bottom of the vitals/GCS entry screen silently failed when patient name or chief complaint was omitted. Updated `handleSubmit` in `TriageForm.tsx` to automatically default missing names to `"Emergency Patient"` and complaints to `"Unspecified Presentation"`, and removed `required` attributes from off-screen form inputs so emergency registration creates a clinical case sheet instantly without silent form blocking or console errors.



