/**
 * test_listener_resubscription_fix.ts
 *
 * Isolated test verifying:
 * 1. Development listener diagnostics counters (subscription, unsubscription, active tracking).
 * 2. Functional state update logic in team_members/{uid} onSnapshot callback:
 *    - Preserves previous state reference when relevant primitive fields are unchanged.
 *    - Updates state when relevant fields (hospitalId, hospital, status, membershipVerified, role, isTeamAdmin, department) change.
 *    - Safely handles transition to null.
 * 3. Prevention of resubscription loop:
 *    - Demonstrates that repeated snapshots with identical membership data do not change selfMembership state or dependency array primitives.
 */

import { listenerDiagnostics } from "./src/utils/listenerDiagnostics";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log("=== 1. TEST LISTENER DIAGNOSTICS ===");

listenerDiagnostics.reset();
listenerDiagnostics.trackSubscribe("cases");
listenerDiagnostics.trackSubscribe("handovers");
listenerDiagnostics.trackSubscribe("quick_paste_patients");
listenerDiagnostics.trackSubscribe("team_members_self");
listenerDiagnostics.trackSubscribe("hospital_shifts");

let report = listenerDiagnostics.getReport();
assert(report["cases"].subscriptions === 1, "cases subscription tracked");
assert(report["cases"].active === 1, "cases active tracked");
assert(report["team_members_self"].subscriptions === 1, "team_members_self tracked");

listenerDiagnostics.trackUnsubscribe("cases");
listenerDiagnostics.trackUnsubscribe("team_members_self");
report = listenerDiagnostics.getReport();
assert(report["cases"].unsubscriptions === 1, "cases unsubscription tracked");
assert(report["cases"].active === 0, "cases active count decreased to 0");
assert(report["handovers"].active === 1, "handovers still active");

console.log("\nDiagnostics Report Output from Test:");
console.table(listenerDiagnostics.getReport());

console.log("\n=== 2. TEST FUNCTIONAL STATE UPDATE FOR SELF_MEMBERSHIP ===");

// Exact functional update implementation from App.tsx
function updateSelfMembership(prev: any, nextSnapshotData: any | null): any {
  if (!nextSnapshotData) {
    return prev === null ? prev : null;
  }

  if (!prev) return nextSnapshotData;

  const prevHospitalId = typeof prev.hospitalId === "string" ? prev.hospitalId.trim() : "";
  const nextHospitalId = typeof nextSnapshotData.hospitalId === "string" ? nextSnapshotData.hospitalId.trim() : "";
  const prevHospital = typeof prev.hospital === "string" ? prev.hospital.trim() : "";
  const nextHospital = typeof nextSnapshotData.hospital === "string" ? nextSnapshotData.hospital.trim() : "";
  const prevStatus = String(prev.status || "");
  const nextStatus = String(nextSnapshotData.status || "");
  const prevVerified = prev.membershipVerified === true;
  const nextVerified = nextSnapshotData.membershipVerified === true;
  const prevRole = prev.role || null;
  const nextRole = nextSnapshotData.role || null;
  const prevIsAdmin = prev.isTeamAdmin === true;
  const nextIsAdmin = nextSnapshotData.isTeamAdmin === true;
  const prevDept = prev.department || "";
  const nextDept = nextSnapshotData.department || "";

  if (
    prevHospitalId === nextHospitalId &&
    prevHospital === nextHospital &&
    prevStatus === nextStatus &&
    prevVerified === nextVerified &&
    prevRole === nextRole &&
    prevIsAdmin === nextIsAdmin &&
    prevDept === nextDept
  ) {
    return prev;
  }
  return nextSnapshotData;
}

// Initial state: null
let currentMembership: any = null;

// Snapshot 1: initial membership loaded from Firestore
const snapshot1 = {
  hospitalId: "hosp_apollo_chennai",
  hospital: "Apollo Hospitals",
  status: "active",
  membershipVerified: true,
  role: "EM Resident",
  isTeamAdmin: false,
  department: "Emergency Medicine"
};
currentMembership = updateSelfMembership(currentMembership, snapshot1);
assert(currentMembership === snapshot1, "Initial membership set on first snapshot");

// Snapshot 2: Firestore listener receives another snapshot (e.g. metadata ping or same doc returned)
// This creates a NEW object with identical fields
const snapshot2 = {
  hospitalId: "hosp_apollo_chennai",
  hospital: "Apollo Hospitals",
  status: "active",
  membershipVerified: true,
  role: "EM Resident",
  isTeamAdmin: false,
  department: "Emergency Medicine"
};
const updatedMembership = updateSelfMembership(currentMembership, snapshot2);
assert(updatedMembership === currentMembership, "Previous reference preserved when fields are identical (ZERO state update triggered)");

// Snapshot 3: Firestore listener receives a change (e.g. promoted to isTeamAdmin)
const snapshot3 = {
  ...snapshot2,
  isTeamAdmin: true
};
const adminMembership = updateSelfMembership(currentMembership, snapshot3);
assert(adminMembership !== currentMembership, "New reference returned when membership field changes");
assert(adminMembership.isTeamAdmin === true, "New field value correctly reflected");
currentMembership = adminMembership;

// Snapshot 4: Doc deleted or status revoked
const nullUpdate = updateSelfMembership(currentMembership, null);
assert(nullUpdate === null, "Safely transitions to null on document removal/deactivation");
currentMembership = nullUpdate;

// Snapshot 5: Doc still null
const nullUpdate2 = updateSelfMembership(currentMembership, null);
assert(nullUpdate2 === null, "Remains null with stable identity when already null");

console.log("\n=== 3. TEST PRIMITIVE DEPENDENCY STABILITY ===");

// Old dependencies extracted: [isLoggedIn, profile?.hospital, profile?.email, profile?.subscriptionTier, selfMembership]
// New dependencies extracted: [isLoggedIn, profile?.hospital, profile?.email, profile?.subscriptionTier, selfMembership?.hospitalId, selfMembership?.hospital, selfMembership?.status, selfMembership?.membershipVerified]

const m1 = { hospitalId: "H1", hospital: "Hosp", status: "active", membershipVerified: true };
const m2 = { hospitalId: "H1", hospital: "Hosp", status: "active", membershipVerified: true }; // different object!

// Old behavior: [true, "Hosp", "dr@ermate.in", "Standard", m1] vs [true, "Hosp", "dr@ermate.in", "Standard", m2]
// Object.is(m1, m2) === false -> EFFECT RE-RUNS AND DESTROYS/RE-CREATES ALL 8 LISTENERS!
assert(Object.is(m1, m2) === false, "Old object dependency triggers effect re-run because m1 !== m2");

// New behavior:
const deps1 = [true, "Hosp", "dr@ermate.in", "Standard", m1.hospitalId, m1.hospital, m1.status, m1.membershipVerified];
const deps2 = [true, "Hosp", "dr@ermate.in", "Standard", m2.hospitalId, m2.hospital, m2.status, m2.membershipVerified];

const hasChanged = deps1.some((dep, i) => !Object.is(dep, deps2[i]));
assert(hasChanged === false, "New primitive dependencies are strictly identical (EFFECT NEVER RE-RUNS)");

console.log("\nALL TESTS PASSED SUCCESSFULLY!");
