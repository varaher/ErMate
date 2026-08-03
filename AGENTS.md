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
- **Multi-Patient Paste Splitting Engine**: Implemented `splitMultiPatientPasteText()` in `HandoverView.tsx` to automatically parse and split bulk EMR notes containing multiple patient records (by dividers, Bed headers, or Patient labels) into individual structured Quick Paste handover cards.
- **Chapter Topic Citation Standard**: Enforced mandatory Chapter TOPIC Name citations (e.g., *Tintinalli's Emergency Medicine, 9th Ed — Cardiac Rhythm Disturbances*) across `server.ts`, `VoiceScribeChatView.tsx`, and `CaseDiscussionModal.tsx`, forbidding bare chapter numbers.
