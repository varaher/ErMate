import assert from "node:assert";
import fs from "node:fs";

console.log("==================================================");
console.log("ERMATE MOBILE UX & DESIGN SYSTEM VERIFICATION");
console.log("==================================================");

// 1. Verify CSS Design Tokens in src/index.css
const indexCss = fs.readFileSync("./src/index.css", "utf-8");

assert.ok(indexCss.includes("--ermate-brand-primary:"), "CSS must contain --ermate-brand-primary token");
assert.ok(indexCss.includes("--ermate-brand-secondary:"), "CSS must contain --ermate-brand-secondary token");
assert.ok(indexCss.includes("--ermate-bg:"), "CSS must contain --ermate-bg token");
assert.ok(indexCss.includes("--ermate-surface:"), "CSS must contain --ermate-surface token");
assert.ok(indexCss.includes("--ermate-surface-raised:"), "CSS must contain --ermate-surface-raised token");
assert.ok(indexCss.includes("--ermate-text-primary:"), "CSS must contain --ermate-text-primary token");
assert.ok(indexCss.includes("--ermate-text-secondary:"), "CSS must contain --ermate-text-secondary token");
assert.ok(indexCss.includes("--ermate-text-muted:"), "CSS must contain --ermate-text-muted token");
assert.ok(indexCss.includes("--ermate-border:"), "CSS must contain --ermate-border token");
assert.ok(indexCss.includes("--ermate-border-strong:"), "CSS must contain --ermate-border-strong token");
assert.ok(indexCss.includes("--ermate-success:"), "CSS must contain --ermate-success token");
assert.ok(indexCss.includes("--ermate-warning:"), "CSS must contain --ermate-warning token");
assert.ok(indexCss.includes("--ermate-danger:"), "CSS must contain --ermate-danger token");
assert.ok(indexCss.includes("--ermate-info:"), "CSS must contain --ermate-info token");
assert.ok(indexCss.includes("--ermate-pending:"), "CSS must contain --ermate-pending token");
assert.ok(indexCss.includes("--ermate-saved:"), "CSS must contain --ermate-saved token");
assert.ok(indexCss.includes("--ermate-active:"), "CSS must contain --ermate-active token");
assert.ok(indexCss.includes("--ermate-touch-min: 44px"), "CSS must specify minimum touch target 44px");
assert.ok(indexCss.includes("env(safe-area-inset-top"), "CSS must include env(safe-area-inset-top)");
assert.ok(indexCss.includes("env(safe-area-inset-bottom"), "CSS must include env(safe-area-inset-bottom)");
assert.ok(indexCss.includes("100dvh"), "CSS must support dynamic viewport 100dvh");
console.log("  ✓ Part 1: Semantic Design Tokens & CSS system variables verified in src/index.css");

// 2. Verify GlobalHeader sticky position and runtime height measurement
const globalHeaderTsx = fs.readFileSync("./src/components/GlobalHeader.tsx", "utf-8");
assert.ok(globalHeaderTsx.includes("sticky top-0"), "GlobalHeader must be sticky at top 0");
assert.ok(globalHeaderTsx.includes("pt-safe"), "GlobalHeader must respect device safe area pt-safe");
assert.ok(globalHeaderTsx.includes("--ermate-header-height"), "GlobalHeader must measure and set --ermate-header-height variable");
console.log("  ✓ Part 2: GlobalHeader sticky & dynamic height measurement verified");

// 3. Verify ScreenSubHeader implementation and token adherence
const screenSubHeaderTsx = fs.readFileSync("./src/components/shared/ScreenSubHeader.tsx", "utf-8");
assert.ok(screenSubHeaderTsx.includes("sticky top-[var(--ermate-header-height"), "ScreenSubHeader must be sticky below header");
assert.ok(screenSubHeaderTsx.includes("min-w-[44px] min-h-[44px]"), "ScreenSubHeader back button must be minimum 44px");
assert.ok(screenSubHeaderTsx.includes("aria-label={backAriaLabel}"), "ScreenSubHeader must provide accessible aria-label");
console.log("  ✓ Part 3: ScreenSubHeader sticky positioning and accessible touch targets verified");

// 4. Verify CaseSheetView sticky offset & Back button
const caseSheetViewTsx = fs.readFileSync("./src/components/CaseSheetView.tsx", "utf-8");
assert.ok(caseSheetViewTsx.includes("top-[var(--ermate-header-height"), "CaseSheetView sticky bar must stack below global header");
assert.ok(caseSheetViewTsx.includes("min-w-[44px] min-h-[44px]"), "CaseSheetView back button must have min 44px touch target");
assert.ok(caseSheetViewTsx.includes('aria-label='), "CaseSheetView back button must have aria-label");
console.log("  ✓ Part 4: CaseSheetView header overlap prevention & touch target verified");

// 5. Verify CaseSheetPrintView sticky offset & Back button
const caseSheetPrintViewTsx = fs.readFileSync("./src/components/CaseSheetPrintView.tsx", "utf-8");
assert.ok(caseSheetPrintViewTsx.includes("top-[var(--ermate-header-height"), "CaseSheetPrintView sticky bar must stack below global header");
assert.ok(caseSheetPrintViewTsx.includes("min-w-[44px] min-h-[44px]"), "CaseSheetPrintView back button must have min 44px touch target");
console.log("  ✓ Part 5: CaseSheetPrintView preview toolbar stack & touch target verified");

// 6. Verify TriageForm sticky offset & Back button
const triageFormTsx = fs.readFileSync("./src/components/TriageForm.tsx", "utf-8");
assert.ok(triageFormTsx.includes("top-[var(--ermate-header-height"), "TriageForm must have sticky subheader below global header");
assert.ok(triageFormTsx.includes("min-w-[44px] min-h-[44px]"), "TriageForm back button must have min 44px touch target");
console.log("  ✓ Part 6: TriageForm subheader stack & touch target verified");

// 7. Verify DischargeSummaryView sticky offset & Back button
const dischargeTsx = fs.readFileSync("./src/components/DischargeSummaryView.tsx", "utf-8");
assert.ok(dischargeTsx.includes("top-[var(--ermate-header-height"), "DischargeSummaryView must stack below global header");
assert.ok(dischargeTsx.includes("min-w-[44px] min-h-[44px]"), "DischargeSummaryView back button must have min 44px touch target");
console.log("  ✓ Part 7: DischargeSummaryView header stack & touch target verified");

// 8. Verify Tools subheader stacks & touch targets
const drugCalcTsx = fs.readFileSync("./src/components/PediatricDrugCalculatorView.tsx", "utf-8");
assert.ok(drugCalcTsx.includes("top-[var(--ermate-header-height"), "PediatricDrugCalculatorView must stack below global header");
assert.ok(drugCalcTsx.includes("min-w-[44px] min-h-[44px]"), "PediatricDrugCalculatorView back button must have min 44px touch target");

const erGuideTsx = fs.readFileSync("./src/components/ErGuideView.tsx", "utf-8");
assert.ok(erGuideTsx.includes("top-[var(--ermate-header-height"), "ErGuideView must stack below global header");
assert.ok(erGuideTsx.includes("min-w-[44px] min-h-[44px]"), "ErGuideView back button must have min 44px touch target");

const pocketMirrorTsx = fs.readFileSync("./src/components/PocketMirrorView.tsx", "utf-8");
assert.ok(pocketMirrorTsx.includes("top-[var(--ermate-header-height"), "PocketMirrorView must stack below global header");
assert.ok(pocketMirrorTsx.includes("min-w-[44px] min-h-[44px]"), "PocketMirrorView back button must have min 44px touch target");

const quickDischargeTsx = fs.readFileSync("./src/components/QuickDischargeIntake.tsx", "utf-8");
assert.ok(quickDischargeTsx.includes("top-[var(--ermate-header-height"), "QuickDischargeIntake must stack below global header");
assert.ok(quickDischargeTsx.includes("min-w-[44px] min-h-[44px]"), "QuickDischargeIntake cancel button must have min 44px touch target");
console.log("  ✓ Part 8: Tools & Quick Intake subheader stacks & touch targets verified");

// 9. Verify Scribe & MATE drawer header and back targets
const scribeTsx = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf-8");
assert.ok(scribeTsx.includes("min-w-[44px] min-h-[44px]"), "VoiceScribeChatView back/close buttons must have min 44px touch target");
assert.ok(scribeTsx.includes("aria-label="), "VoiceScribeChatView back/close buttons must have aria-label");
console.log("  ✓ Part 9: VoiceScribe & MATE drawer controls verified");

// 10. Verify CaseChatWorkspace Back control touch target
const caseChatTsx = fs.readFileSync("./src/components/CaseChatWorkspace.tsx", "utf-8");
assert.ok(caseChatTsx.includes("min-w-[44px] min-h-[44px]"), "CaseChatWorkspace back button must have min 44px touch target");
assert.ok(caseChatTsx.includes('aria-label="Back to ER workspace"'), "CaseChatWorkspace back button must have aria-label");
console.log("  ✓ Part 10: CaseChatWorkspace back control verified");

// 11. Verify ProfileSettingsView subSection back control
const profileSettingsTsx = fs.readFileSync("./src/components/ProfileSettingsView.tsx", "utf-8");
assert.ok(profileSettingsTsx.includes("min-w-[44px] min-h-[44px]"), "ProfileSettingsView subSection back button must have min 44px touch target");
console.log("  ✓ Part 11: ProfileSettingsView subSection back control verified");

// 12. Verify Bottom Navigation pb-safe & touch targets
const appTsx = fs.readFileSync("./src/App.tsx", "utf-8");
assert.ok(appTsx.includes("pb-safe"), "Bottom navigation bar must have pb-safe");
assert.ok(appTsx.includes("min-w-[48px]"), "Bottom navigation bar items must have min-w-[48px]");
console.log("  ✓ Part 12: Bottom navigation pb-safe & touch targets verified");

console.log("\n==================================================");
console.log("ALL 12 MOBILE UX & DESIGN SYSTEM INVARIANTS PASSED");
console.log("==================================================");
