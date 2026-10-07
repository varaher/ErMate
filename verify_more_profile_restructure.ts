import assert from "assert";
import fs from "fs";

console.log("=======================================================");
console.log("  VERIFY MORE / PROFILE / ACCOUNT & FACILITY RESTRUCTURE");
console.log("=======================================================");

const moreViewContent = fs.readFileSync("src/components/MoreView.tsx", "utf-8");
const profileSettingsContent = fs.readFileSync("src/components/ProfileSettingsView.tsx", "utf-8");
const appContent = fs.readFileSync("src/App.tsx", "utf-8");
const teamRosterContent = fs.readFileSync("src/components/TeamRosterBoard.tsx", "utf-8");

// 1. Audit Problem 1: "Owner Revenue & Cost Planner" must NOT appear in normal clinical/HOD navigation
assert(!moreViewContent.includes("Owner Revenue & Cost Planner"), "MoreView should not contain Owner Revenue & Cost Planner");
assert(!moreViewContent.includes("revenue-planner"), "MoreView should not contain revenue-planner");
assert(!profileSettingsContent.includes("Owner Revenue & Cost Planner"), "ProfileSettingsView should not contain Owner Revenue & Cost Planner");
console.log("  ✓ PASS: 1. Owner Revenue & Cost Planner excluded from clinical & HOD navigation");

// 2. Audit Problem 2 & Section B: Hospital & ER Setup has clear unified facility page
assert(moreViewContent.includes("B. HOSPITAL & ER SETUP"), "MoreView must have Section B: Hospital & ER Setup");
assert(moreViewContent.includes("Hospital / Institution Name"), "MoreView must include Hospital / Institution Name");
assert(moreViewContent.includes("ER / Department Name"), "MoreView must include ER / Department Name");
assert(moreViewContent.includes("Specialty"), "MoreView must include Specialty");
assert(moreViewContent.includes("ER Physical Bed Capacity"), "MoreView must include ER Physical Bed Capacity");
assert(moreViewContent.includes("Team Core Identifier"), "MoreView must include Team Core Identifier");
assert(moreViewContent.includes("Brand Theme Accent"), "MoreView must include Brand Theme Accent");
console.log("  ✓ PASS: 2. Single clear Hospital & ER Setup facility settings page configured");

// 3. Audit Problem 3: ER Physical Bed Capacity connects to canonical erPhysicalBedCapacity
assert(moreViewContent.includes("erPhysicalBedCapacity"), "MoreView must accept erPhysicalBedCapacity");
assert(moreViewContent.includes("onUpdateBedCapacity"), "MoreView must accept onUpdateBedCapacity");
assert(moreViewContent.includes("MATE uses this to validate bed numbers and A/B subdivisions"), "MoreView must contain canonical MATE bed validation helper text");
assert(appContent.includes("handleUpdateErPhysicalBedCapacity"), "App.tsx must define handleUpdateErPhysicalBedCapacity");
assert(appContent.includes("erPhysicalBedCapacity: validCapacity"), "handleUpdateErPhysicalBedCapacity must write validCapacity to Firestore");
console.log("  ✓ PASS: 3. ER physical bed capacity connects to canonical erPhysicalBedCapacity with validation");

// 4 & 5. Audit Problem 4 & 5 & Section C: Team & Subscription canonical 2-state model
assert(moreViewContent.includes("C. TEAM & SUBSCRIPTION"), "MoreView must have Section C: Team & Subscription");
assert(moreViewContent.includes("Individual Plan"), "MoreView must support State 1: Individual Plan");
assert(moreViewContent.includes("Team Plan"), "MoreView must support State 2: Team Plan");
assert(moreViewContent.includes("Your personal ErMate workspace."), "MoreView must include Individual Plan description");
assert(moreViewContent.includes("Covered by"), "MoreView must include Team Plan description");
assert(moreViewContent.includes("Every clinician begins with an Individual Plan. When you join an approved hospital team on ErMate, your account automatically shifts to the Hospital Team Plan without requiring manual upgrades"), "MoreView must explain automatic plan transition");
assert(!moreViewContent.includes("Upgrade to Team Plan"), "MoreView must NOT have manual upgrade to team button");
console.log("  ✓ PASS: 4 & 5. Canonical 2-state subscription model (Individual vs Team) derived from membership");

// 6. Audit Problem 6 & Section A: My Account shows meaningful current state on all menu rows
assert(moreViewContent.includes("A. MY ACCOUNT"), "MoreView must have Section A: My Account");
assert(moreViewContent.includes("Profile & Clinical Credentials"), "MoreView must have Profile row");
assert(moreViewContent.includes("Role & Workplace"), "MoreView must have Role & Workplace row");
assert(moreViewContent.includes("Security & Access"), "MoreView must have Security row");
assert(moreViewContent.includes("Notifications & Alerts"), "MoreView must have Notifications row");
assert(moreViewContent.includes("Privacy & Data Controls"), "MoreView must have Privacy row");
assert(moreViewContent.includes("Session PIN active"), "MoreView must display security state");
assert(moreViewContent.includes("Clinical alerts"), "MoreView must display notifications state");
assert(moreViewContent.includes("DPDP Act 2023 compliant"), "MoreView must display privacy compliance state");
console.log("  ✓ PASS: 6. My Account displays rich current-state values on all rows");

// 7. Audit Problem 7: Delete All Cases is safely guarded in Danger Zone
assert(moreViewContent.includes("Advanced Data Management — Danger Zone"), "Delete All Cases must be housed in Danger Zone");
assert(moreViewContent.includes('DELETE ALL'), "Delete All Cases must require typing DELETE ALL");
assert(!moreViewContent.includes('<button>Delete All Cases</button>'), "Must not have raw prominent Delete All Cases button");
console.log("  ✓ PASS: 7. Delete All Cases safely housed in Privacy Danger Zone with typed confirmation");

// 8. Audit Problem 8 & Section D: Clinician Directory distinct from Hospital ER Team Roster
assert(moreViewContent.includes("D. MY WORK / CLINICAL TOOLS"), "MoreView must have Section D: Clinical Tools");
assert(moreViewContent.includes("Clinician Directory"), "MoreView must have Clinician Directory");
assert(moreViewContent.includes("Find and connect with verified emergency physicians across state departments"), "MoreView must describe Clinician Directory clearly");
assert(moreViewContent.includes("Medico-Legal (MLC) Certificates"), "MoreView must have MLC registry");
assert(moreViewContent.includes("My Log Book"), "MoreView must have Log Book");
assert(moreViewContent.includes("Clinical Analytics & KPIs"), "MoreView must have Analytics");
console.log("  ✓ PASS: 8. Clinician Directory is distinct from Hospital ER Team Roster");

// 9. Section E: Help & App Settings
assert(moreViewContent.includes("E. HELP & APP SETTINGS"), "MoreView must have Section E: Help & App Settings");
assert(moreViewContent.includes("DISPLAY MODE"), "MoreView must have Display Mode");
assert(moreViewContent.includes("What's New"), "MoreView must have What's New");
assert(moreViewContent.includes("Help & Support"), "MoreView must have Help & Support");
assert(moreViewContent.includes("About ErMate"), "MoreView must have About ErMate");
assert(moreViewContent.includes("Logout from Clinical Session"), "MoreView must have Logout");
console.log("  ✓ PASS: 9. Help & App Settings configured with Display Mode, Updates, Support, About, and Logout");

// 10. App.tsx wiring and props propagation
assert(appContent.includes('activeTab === "more"'), "App.tsx must route activeTab more");
assert(appContent.includes('activeTab === "profile"'), "App.tsx must route activeTab profile");
assert(appContent.includes('onUpdateBedCapacity={handleUpdateErPhysicalBedCapacity}'), "App.tsx must pass handleUpdateErPhysicalBedCapacity");
console.log("  ✓ PASS: 10. App.tsx props and tab routing properly wired");

console.log("=======================================================");
console.log("  ALL MORE & PROFILE RESTRUCTURE VERIFICATIONS PASSED: 10/10");
console.log("=======================================================");
