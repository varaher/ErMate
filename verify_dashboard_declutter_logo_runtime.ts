import fs from "fs";
import path from "path";

console.log("=== RUNNING VERIFICATION: ERMATE DASHBOARD DECLUTTER + OFFICIAL LOGO RUNTIME ===");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = "") {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName} - ${detail}`);
    failed++;
  }
}

// 1. Audit Brand Assets
const publicDir = path.resolve("public");
const icon192 = path.join(publicDir, "icon-192.png");
const icon512 = path.join(publicDir, "icon-512.png");
const logoPng = path.join(publicDir, "logo.png");
const faviconPng = path.join(publicDir, "favicon.png");
const iconSvg = path.join(publicDir, "icon.svg");
const icons192 = path.join(publicDir, "icons", "icon-192.png");
const icons512 = path.join(publicDir, "icons", "icon-512.png");

assert(fs.existsSync(icon192) && fs.statSync(icon192).size > 10000, "public/icon-192.png exists and has valid size");
assert(fs.existsSync(icon512) && fs.statSync(icon512).size > 50000, "public/icon-512.png exists and has valid size");
assert(fs.existsSync(logoPng) && fs.statSync(logoPng).size > 50000, "public/logo.png exists and has valid size");
assert(fs.existsSync(faviconPng) && fs.statSync(faviconPng).size > 2000, "public/favicon.png exists and has valid size");
assert(fs.existsSync(iconSvg) && fs.statSync(iconSvg).size > 2000, "public/icon.svg exists and has valid size");
assert(fs.existsSync(icons192) && fs.existsSync(icons512), "public/icons folder exists for PWA manifest fallback paths");

// 2. Audit ErMateLogo.tsx
const logoCode = fs.readFileSync("src/components/shared/ErMateLogo.tsx", "utf8");
assert(!logoCode.includes(">EM<"), "ErMateLogo has eliminated 'EM' text fallback");
assert(logoCode.includes("OfficialCrossIcon"), "ErMateLogo exports and bundles OfficialCrossIcon");
assert(logoCode.includes("stroke=\"#ffffff\""), "OfficialCrossIcon contains pure white ECG heartbeat pulse line");
assert(logoCode.includes("linearGradient"), "OfficialCrossIcon contains ribbon fold gradients");
assert(logoCode.includes("v=3"), "ErMateLogo includes cache-busting version query for logo assets");

// 3. Audit PWA and Service Worker
const swCode = fs.readFileSync("public/sw.js", "utf8");
assert(swCode.includes("ermate-cache-v3"), "Service worker cache bumped to v3 for cache invalidation");
assert(swCode.includes("/icon-192.png") && swCode.includes("/logo.png") && swCode.includes("/favicon.png"), "Service worker precaches all brand assets");

const manifestCode = fs.readFileSync("public/manifest.json", "utf8");
assert(manifestCode.includes("/icon-192.png") && manifestCode.includes("/icon-512.png"), "manifest.json specifies icon assets");

const viteCode = fs.readFileSync("vite.config.ts", "utf8");
assert(viteCode.includes("includeAssets: [") && viteCode.includes("'icon-192.png'"), "vite.config.ts configures includeAssets for VitePWA");

// 4. Audit DashboardView.tsx Decluttering
const dashCode = fs.readFileSync("src/components/DashboardView.tsx", "utf8");

// Removed duplicate forms:
assert(!dashCode.includes("Whitelist & Onboard Team Clinician"), "Removed 'Whitelist & Onboard Team Clinician' form from Dashboard");
assert(!dashCode.includes("Clinical Department Team Roster"), "Removed 'Clinical Department Team Roster' table from Dashboard");
assert(!dashCode.includes("Institution Profile Details"), "Removed 'Institution Profile Details' form from Dashboard");
assert(!dashCode.includes("Share Invitation Link"), "Removed 'Share Invitation Link' card from Dashboard");
assert(!dashCode.includes("Shift Reports & Roster Sync"), "Removed duplicate 'Shift Reports & Roster Sync' card from Dashboard");

// Preserved canonical destinations & Compact HOD Overview:
assert(dashCode.includes("HOD Operations Overview"), "Compact HOD Operations Overview is present");
assert(dashCode.includes("Pending Approvals"), "HOD Overview includes Pending Approvals stat");
assert(dashCode.includes("On Duty Now"), "HOD Overview includes On Duty Now stat");
assert(dashCode.includes("Pending Handovers"), "HOD Overview includes Pending Handovers stat");
assert(dashCode.includes("M&M Review Queue"), "HOD Overview includes M&M Review Queue stat");
assert(dashCode.includes("onNavigateToTab(\"team\")"), "HOD Overview links directly to Team tab");
assert(dashCode.includes("onNavigateToTab(\"analytics\")"), "HOD Overview links directly to Analytics tab");
assert(dashCode.includes("onNavigateToTab(\"roster\")"), "HOD Overview links directly to Roster tab");
assert(dashCode.includes("setIsMortalityModalOpen(true)"), "HOD Overview links to M&M Audit modal");

// Clinical tools:
assert(dashCode.includes("Voice Scribe"), "Clinical Tools includes Voice Scribe");
assert(dashCode.includes("New Patient"), "Clinical Tools includes New Patient");
assert(dashCode.includes("Shift Handover"), "Clinical Tools includes Shift Handover");
assert(dashCode.includes("Pediatric Dosing"), "Clinical Tools includes Pediatric Dosing");
assert(dashCode.includes("EM Drugs & Guide"), "Clinical Tools includes EM Drugs & Procedures");
assert(!dashCode.includes("iPhone Pocket Mirror"), "iPhone Pocket Mirror moved out of Dashboard high-frequency tools");

// Layout & Density:
assert(dashCode.includes("Today's ER Patient Registry"), "Today's ER Patient Registry is prominent");
assert(!dashCode.includes("lg:w-[360px] xl:w-[420px] shrink-0"), "Today's ER Patient Registry is full width, not cramped in 360px sidebar");
assert(dashCode.includes("pb-28"), "Dashboard container has bottom padding to prevent MATE floating overlap");

console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
