import fs from "fs";
import path from "path";

console.log("=== VERIFYING ERMATE DASHBOARD DECLUTTER + OFFICIAL LOGO RUNTIME FIX ===\n");

let passed = 0;
let total = 0;

function assert(description: string, condition: boolean, details?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${description}`);
  } else {
    console.error(`[FAIL] ${description} ${details ? `-> ${details}` : ""}`);
  }
}

// 1. Audit Brand Assets
const icon192 = fs.existsSync(path.resolve("public/icon-192.png"));
const icon512 = fs.existsSync(path.resolve("public/icon-512.png"));
const iconSvg = fs.existsSync(path.resolve("public/icon.svg"));
const logoPng = fs.existsSync(path.resolve("public/logo.png"));
const faviconPng = fs.existsSync(path.resolve("public/favicon.png"));
const iconsDir192 = fs.existsSync(path.resolve("public/icons/icon-192.png"));
const iconsDir512 = fs.existsSync(path.resolve("public/icons/icon-512.png"));

assert("public/icon-192.png exists and is non-empty", icon192 && fs.statSync("public/icon-192.png").size > 1000);
assert("public/icon-512.png exists and is non-empty", icon512 && fs.statSync("public/icon-512.png").size > 1000);
assert("public/icons/icon-192.png exists for path compatibility", iconsDir192);
assert("public/icons/icon-512.png exists for path compatibility", iconsDir512);
assert("public/icon.svg exists and is non-empty", iconSvg && fs.statSync("public/icon.svg").size > 100);
assert("public/logo.png exists", logoPng && fs.statSync("public/logo.png").size > 1000);
assert("public/favicon.png exists", faviconPng && fs.statSync("public/favicon.png").size > 500);

// 2. Audit ErMateLogo.tsx
const logoSrc = fs.readFileSync("src/components/shared/ErMateLogo.tsx", "utf-8");
assert("ErMateLogo has OfficialCrossIcon component", logoSrc.includes("OfficialCrossIcon"));
assert("ErMateLogo contains ECG pulse path in vector icon", logoSrc.includes("M 92 190") && logoSrc.includes("stroke=\"#ffffff\""));
assert("ErMateLogo contains teal/cyan/blue/purple gradient", logoSrc.includes("#10b981") && logoSrc.includes("#06b6d4") && (logoSrc.includes("#9333ea") || logoSrc.includes("#7c3aed") || logoSrc.includes("#8b5cf6")));
assert("ErMateLogo does NOT render plain 'EM' text fallback on error", !logoSrc.includes(">EM<"));

// 3. Audit PWA Cache & Manifest
const manifestSrc = fs.readFileSync("public/manifest.json", "utf-8");
const manifestObj = JSON.parse(manifestSrc);
assert("Manifest has standalone display", manifestObj.display === "standalone");
assert("Manifest icons include icon-192.png and icon-512.png", manifestObj.icons.some((i: any) => i.src.includes("icon-192.png")) && manifestObj.icons.some((i: any) => i.src.includes("icon-512.png")));

const swSrc = fs.readFileSync("public/sw.js", "utf-8");
assert("Service worker cache bumped to v3", swSrc.includes("ermate-cache-v3"));
assert("Service worker caches icon assets and favicon", swSrc.includes("/icon-192.png") && swSrc.includes("/icon.svg") && swSrc.includes("/favicon.png"));
assert("Service worker clears old caches in activate handler", swSrc.includes("caches.delete"));

const viteSrc = fs.readFileSync("vite.config.ts", "utf-8");
assert("vite.config.ts includesAssets includes brand assets", viteSrc.includes("favicon.png") && viteSrc.includes("icon.svg") && viteSrc.includes("icon-192.png"));

// 4. Audit DashboardView.tsx Decluttering
const dashSrc = fs.readFileSync("src/components/DashboardView.tsx", "utf-8");

assert("Dashboard does NOT contain legacy 'Whitelist & Onboard Team Clinician'", !dashSrc.includes("Whitelist & Onboard Team Clinician"));
assert("Dashboard does NOT contain legacy 'Clinical Department Team Roster'", !dashSrc.includes("Clinical Department Team Roster"));
assert("Dashboard does NOT contain legacy 'Institution Profile Details'", !dashSrc.includes("Institution Profile Details"));
assert("Dashboard does NOT contain legacy 'Share Invitation Link'", !dashSrc.includes("Share Invitation Link"));
assert("Dashboard does NOT render 'iPhone Pocket Mirror' in rapid tools", !dashSrc.includes("iPhone Pocket Mirror"));

// 5. Audit Dashboard Operations & Flow
assert("Dashboard retains Compact HOD Operations Overview", dashSrc.includes("HOD Operations Overview") || dashSrc.includes("HOD Overview"));
assert("Dashboard HOD overview contains Pending Approvals", dashSrc.includes("Pending Approvals"));
assert("Dashboard HOD overview contains On Duty Now", dashSrc.includes("On Duty Now"));
assert("Dashboard HOD overview contains Pending Handovers", dashSrc.includes("Pending Handovers"));
assert("Dashboard HOD overview contains M&M Review Queue", dashSrc.includes("M&M Review Queue"));
assert("Dashboard HOD overview contains Open Team button", dashSrc.includes("Open Team"));
assert("Dashboard HOD overview contains View Analytics button", dashSrc.includes("View Analytics"));

// 6. Section Ordering
const shiftIndex = dashSrc.indexOf("Shift Status Banner & Controls");
const welcomeIndex = dashSrc.indexOf("2. Welcome Banner");
const alertsIndex = dashSrc.indexOf("3. Important Clinical & Leadership Alerts");
const toolsIndex = dashSrc.indexOf("Clinical Tools & Active Workflows");
const snapshotIndex = dashSrc.indexOf("4. ER Snapshot");
const registryIndex = dashSrc.indexOf("Today's ER Patient Registry");
const hodSummaryIndex = dashSrc.indexOf("Compact HOD Operations Overview");

assert("Section ordering: Shift status appears before Welcome", shiftIndex !== -1 && welcomeIndex !== -1 && shiftIndex < welcomeIndex);
assert("Section ordering: Welcome appears before Alerts", welcomeIndex < alertsIndex);
assert("Section ordering: Alerts appears before Tools", alertsIndex < toolsIndex);
assert("Section ordering: Tools appears before Snapshot", toolsIndex < snapshotIndex);
assert("Section ordering: Snapshot appears before Registry", snapshotIndex < registryIndex);
assert("Section ordering: Registry appears before HOD Summary", registryIndex < hodSummaryIndex);

// 7. Mobile density & bottom padding
assert("Dashboard has bottom padding for floating MATE button", dashSrc.includes("pb-28"));

console.log(`\n=== RESULTS: ${passed}/${total} assertions passed ===\n`);
if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
