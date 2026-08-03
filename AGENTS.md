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

### [2026-08-02] — DPDP Act 2023 Server-Side De-identification Engine & System Rules Update
- **Engine Created (`/server/deidentify.ts`)**: Built on-the-fly local de-identification for Cloud Run (`asia-south1`).
- **Relative Date Timeline Conversion**: Absolute calendar dates converted to `[Day 1]`, `[Day 2]` relative labels.
- **Doctor Name Local Re-injection**: Treating physician name populated locally from user profile.
- **UI Protection Shield**: Added `phiProtected` toast notification banner in `HandoverView.tsx` and detailed Privacy Architecture breakdown in `ProfileSettingsView.tsx`.
- **Locked System Conventions Updated**: Updated `AGENTS.md` and `README.md` with route-specific AI model matrix, temperature rules, and DPDP compliance standards.
