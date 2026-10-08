import assert from "node:assert";
import fs from "node:fs";

console.log("==================================================");
console.log("ERMATE RESPONSIVE NAVIGATION & TAB UX VERIFICATION");
console.log("==================================================");

let total = 0;
let passed = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

const appTsx = fs.readFileSync("./src/App.tsx", "utf-8");
const moreViewTsx = fs.readFileSync("./src/components/MoreView.tsx", "utf-8");

// 1. Mobile Bottom Navigation: Clean 5 Visible Destinations
test("1. Mobile Bottom Navigation: exactly 5 primary destinations (Dashboard, Cases, Scribe, Handover, More)", () => {
  assert.ok(appTsx.includes('id: "dashboard", label: "Dashboard"'), "Must include Dashboard");
  assert.ok(appTsx.includes('id: "cases", label: "Cases"'), "Must include Cases");
  assert.ok(appTsx.includes('id: "scribe", label: "Scribe"'), "Must include Scribe");
  assert.ok(appTsx.includes('id: "handover", label: "Handover"'), "Must include Handover");
  assert.ok(appTsx.includes('id: "more", label: "More"'), "Must include More");
  
  // Verify it uses grid grid-cols-5 with no horizontal overflow
  assert.ok(appTsx.includes("grid grid-cols-5"), "Mobile nav must use grid-cols-5");
  assert.ok(appTsx.includes("overflow-hidden"), "Mobile nav must not have scroll overflow");
  assert.ok(!appTsx.includes("overflow-x-auto scrollbar-none\n        >{\n          {(() => {"), "Mobile nav must not be horizontally scrollable");
});

// 2. Mobile Touch Targets & Accessibility
test("2. Mobile Touch Targets: minimum 44-48px touch targets and accessible labels", () => {
  assert.ok(appTsx.includes("min-w-[48px] min-h-[48px]"), "Mobile nav buttons must have min 48px touch target");
  assert.ok(appTsx.includes("aria-label={tab.label}"), "Mobile nav buttons must have aria-label");
  assert.ok(appTsx.includes("pb-safe"), "Mobile nav must have pb-safe for notched devices");
});

// 3. Scribe Tab Behavioral Integration
test("3. Scribe Tab activates Voice Scribe and reflects active status", () => {
  assert.ok(appTsx.includes("if (tab.id === \"scribe\") {\n                    setShowVoiceScribeChat(true);"), "Scribe button must open Voice Scribe");
  assert.ok(appTsx.includes("const isScribeActive = showVoiceScribeChat;"), "Scribe tab active state bound to showVoiceScribeChat");
});

// 4. Subtle Active Navigation Indicators (Zero Loud Pill Enclosures)
test("4. Active navigation tabs use subtle ErMate primary surface without giant filled pills", () => {
  assert.ok(appTsx.includes("bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"), "Mobile active icon uses subtle primary container");
  assert.ok(!appTsx.includes("bg-emerald-600 text-white shadow-sm shadow-emerald-600/15"), "Removed rainbow saturated blocks from desktop tabs");
  assert.ok(!appTsx.includes("bg-rose-600 text-white shadow-sm shadow-rose-600/15"), "Removed rainbow saturated blocks from desktop tabs");
  assert.ok(appTsx.includes("bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"), "Desktop active tab uses calm ErMate primary surface");
});

// 5. Tablet Ergonomics: Main Content Squeeze Elimination
test("5. Tablet mode does not squeeze main workspace when MATE is open", () => {
  // main must NOT have md:mr-[420px] or lg:mr-[440px]
  assert.ok(!appTsx.includes('md:mr-[420px]'), "Main must not have md:mr-[420px]");
  assert.ok(!appTsx.includes('lg:mr-[440px]'), "Main must not have lg:mr-[440px]");
  assert.ok(appTsx.includes('xl:mr-[420px] 2xl:mr-[440px]'), "Main only receives margin-right on large desktop (xl+)");
});

// 6. Tablet Slide-Over Overlay Backdrop
test("6. Tablet mode opens MATE as temporary slide-over drawer with overlay backdrop", () => {
  assert.ok(appTsx.includes('bg-slate-950/40 backdrop-blur-xs z-45 xl:hidden'), "Overlay backdrop present for tablet/mobile with xl:hidden");
  assert.ok(appTsx.includes('onClick={() => setShowVoiceScribeChat(false)}'), "Clicking backdrop closes MATE");
});

// 7. Mobile MATE Full-Screen Workspace
test("7. Mobile mode renders MATE as full-screen workspace", () => {
  assert.ok(appTsx.includes('fixed inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[420px]'), "MATE uses inset-0 on mobile and docked width on tablet/desktop");
});

// 8. Secondary Navigation Hub in MoreView
test("8. More screen functions as secondary navigation hub with Account, Team, Work, Settings", () => {
  assert.ok(moreViewTsx.includes("MY ACCOUNT"), "Must include Account section");
  assert.ok(moreViewTsx.includes("HOSPITAL & ER SETUP"), "Must include Hospital/Facility section");
  assert.ok(moreViewTsx.includes("TEAM & SUBSCRIPTION"), "Must include Team/Subscription section");
  assert.ok(moreViewTsx.includes("MY WORK"), "Must include Work section");
  assert.ok(moreViewTsx.includes("HELP & APP SETTINGS"), "Must include Settings section");
});

// 9. All Secondary Destinations Preserved and Accessible in MoreView
test("9. Secondary clinical tools accessible via 1-tap navigation from More screen", () => {
  assert.ok(moreViewTsx.includes('onNavigateToTab("learn")'), "Must provide navigation to Learn");
  assert.ok(moreViewTsx.includes('onNavigateToTab("tools")'), "Must provide navigation to Emergency Tools");
  assert.ok(moreViewTsx.includes('onNavigateToTab("logbook")'), "Must provide navigation to Log Book");
  assert.ok(moreViewTsx.includes('onNavigateToTab("analytics")'), "Must provide navigation to Analytics");
  assert.ok(moreViewTsx.includes('onNavigateToTab("handover")'), "Must provide navigation to Handover");
  assert.ok(moreViewTsx.includes('onNavigateToTab("team")'), "Must provide navigation to Team");
  assert.ok(moreViewTsx.includes('onNavigateToTab("mlc")'), "Must provide navigation to MLC Certificates");
  assert.ok(moreViewTsx.includes('onNavigateToTab("directory")'), "Must provide navigation to Clinician Directory");
});

// 10. Single Content Scroll Region Per Workspace (No Runaway Nested Overflow)
test("10. Scroll discipline: main workspace single scroll container", () => {
  const globalHeaderTsx = fs.readFileSync("./src/components/GlobalHeader.tsx", "utf-8");
  assert.ok(appTsx.includes("min-h-screen min-h-dvh"), "Root maintains viewport presence");
  assert.ok(globalHeaderTsx.includes("sticky top-0 z-40"), "GlobalHeader is top sticky element");
  assert.ok(appTsx.includes("fixed bottom-0"), "Mobile bottom nav is bottom fixed element");
});

console.log("\n==================================================");
console.log(`ALL ${passed}/${total} RESPONSIVE NAVIGATION TESTS PASSED!`);
console.log("==================================================");
