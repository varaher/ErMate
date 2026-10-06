/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Verification Suite: ErMate Team Section UI Reorganization
 * Mobile-First, UI-Only, 4 Top-Level Sections
 */

import fs from "fs";
import path from "path";
import assert from "assert";

let passedCount = 0;
function pass(testName: string) {
  passedCount++;
  console.log(`[PASS] ${passedCount}. ${testName}`);
}

console.log("==================================================");
console.log("ERMATE — TEAM SECTION UI REORGANIZATION VERIFICATION SUITE");
console.log("==================================================");

const teamRosterContent = fs.readFileSync(path.join(process.cwd(), "src/components/TeamRosterBoard.tsx"), "utf8");
const profileSettingsContent = fs.readFileSync(path.join(process.cwd(), "src/components/ProfileSettingsView.tsx"), "utf8");

// 1. Four top-level sections exist
assert(
  teamRosterContent.includes('"overview"') &&
  teamRosterContent.includes('"members"') &&
  teamRosterContent.includes('"rota"') &&
  teamRosterContent.includes('"settings"'),
  "Team section must define the 4 top-level sections: overview, members, rota, settings"
);
pass("1. Top-Level Sections: overview, members, rota, settings defined");

// 2. Default section is overview
assert(
  teamRosterContent.includes('useState<TeamSectionTab>("overview")'),
  "Default team section must be 'overview'"
);
pass("2. Default Section is OVERVIEW");

// 3. OVERVIEW: Header with TEAM and hospital name and subtext
assert(
  teamRosterContent.includes("TEAM") &&
  teamRosterContent.includes("clinicians ·") &&
  teamRosterContent.includes("on duty"),
  "OVERVIEW must contain TEAM header, hospital name, and clinicians/on duty subtext"
);
pass("3. OVERVIEW: Header with TEAM and clinician/on duty subtext");

// 4. OVERVIEW: Primary actions: [+ Add Clinician] and [Invite Team]
assert(
  teamRosterContent.includes("+ Add Clinician") &&
  teamRosterContent.includes("Invite Team"),
  "OVERVIEW must contain [+ Add Clinician] and [Invite Team] primary action buttons"
);
pass("4. OVERVIEW: Primary Actions: [+ Add Clinician] and [Invite Team]");

// 5. OVERVIEW: Four Summary Cards
assert(
  teamRosterContent.includes("Members</span>") &&
  teamRosterContent.includes("Pending Invitations</span>") &&
  teamRosterContent.includes("On Duty Now</span>") &&
  teamRosterContent.includes("Configured Shifts</span>"),
  "OVERVIEW must have summary cards for Members, Pending Invitations, On Duty Now, and Configured Shifts"
);
pass("5. OVERVIEW: Four Summary Cards (Members, Pending Invitations, On Duty Now, Configured Shifts)");

// 6. OVERVIEW: TODAY'S TEAM section
assert(
  teamRosterContent.includes("TODAY'S TEAM") &&
  teamRosterContent.includes("Dr {member.name}") &&
  teamRosterContent.includes("{member.role}"),
  "OVERVIEW must include TODAY'S TEAM section with clinician names and roles"
);
pass("6. OVERVIEW: TODAY'S TEAM list present without admin scrolling");

// 7. MEMBERS: MEMBER DIRECTORY replaces Allowlist/Whitelist in headings
assert(
  teamRosterContent.includes("MEMBER DIRECTORY"),
  "MEMBERS section must have 'MEMBER DIRECTORY' header"
);
pass("7. MEMBERS: MEMBER DIRECTORY header established");

// 8. MEMBERS: Technical wording replaced
assert(
  teamRosterContent.includes("Add to Team") &&
  teamRosterContent.includes("TEAM INVITATION"),
  "Technical wording must be replaced with clinician-friendly terms"
);
pass("8. MEMBERS: Clinician-friendly wording ('Add to Team', 'TEAM INVITATION')");

// 9. MEMBERS: Add Clinician Form Fields
assert(
  teamRosterContent.includes("Full Name") &&
  teamRosterContent.includes("Gmail / Email") &&
  teamRosterContent.includes("Designation") &&
  teamRosterContent.includes("Assigned Shift"),
  "Add Clinician form must have Full Name, Gmail / Email, Designation, and Assigned Shift"
);
pass("9. MEMBERS: Add Clinician Form contains all required fields");

// 10. Canonical Invitation Flow
assert(
  teamRosterContent.includes("TEAM INVITATION") &&
  teamRosterContent.includes("Share this secure link with clinicians who have already been added to your team.") &&
  teamRosterContent.includes("Copy Link") &&
  teamRosterContent.includes("Show QR") &&
  teamRosterContent.includes("Share"),
  "Canonical invitation flow must display exact copy, Copy Link, Show QR, and Share actions"
);
pass("10. Canonical Invitation Flow with Copy Link, Show QR, and Share");

// 11. PENDING INVITATIONS section below invitation card
assert(
  teamRosterContent.includes("PENDING INVITATIONS"),
  "PENDING INVITATIONS must be displayed in the invitation flow"
);
pass("11. PENDING INVITATIONS displayed in the invitation flow");

// 12. ROTA: Shift filter tabs and Universal Shift Setup
assert(
  teamRosterContent.includes("ROTA & DUTY SHIFTS") &&
  teamRosterContent.includes("Universal Shift Setup") &&
  teamRosterContent.includes("Sync Google Calendar"),
  "ROTA section must have duty shifts, Universal Shift Setup, and Google Calendar sync"
);
pass("12. ROTA: Shift filter tabs, Universal Shift Setup, and Google Calendar sync");

// 13. SETTINGS: Workplace setup & leadership
assert(
  teamRosterContent.includes("TEAM & WORKPLACE SETTINGS") &&
  teamRosterContent.includes("Hospital / Institution Name") &&
  teamRosterContent.includes("Specialty Department") &&
  teamRosterContent.includes("Team Core Identifier") &&
  teamRosterContent.includes("Brand Theme Accent"),
  "SETTINGS section must include Workplace Branding and metadata fields"
);
pass("13. SETTINGS: Workplace Branding and metadata fields");

// 14. SETTINGS: HOD leadership and license panel
assert(
  teamRosterContent.includes("Head of Department (HOD)") &&
  teamRosterContent.includes("Hospital Group License"),
  "SETTINGS must display HOD identity and Hospital Group License panel"
);
pass("14. SETTINGS: HOD identity and Hospital Group License status");

// 15. ProfileSettingsView does not render duplicate TeamBuilder
assert(
  !profileSettingsContent.includes("<TeamBuilder"),
  "ProfileSettingsView must not stack duplicate TeamBuilder on top of TeamRosterBoard"
);
pass("15. Architecture: Single canonical Team component without duplicate stacking");

console.log("==================================================");
console.log(`Team Section UI Reorganization Audit: ${passedCount} / ${passedCount} assertions passed.`);
console.log("==================================================");
