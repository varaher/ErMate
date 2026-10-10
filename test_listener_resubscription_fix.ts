/**
 * test_listener_resubscription_fix.ts
 *
 * Isolated Firestore Listener Lifecycle Test Suite:
 * 1. Unchanged membership (no main effect resubscription, no hospital_shifts churn)
 * 2. Changed hospital (clean transition to new hospital_shifts doc)
 * 3. Membership removal / revocation (cleanup of hospital_shifts, revert to defaults)
 * 4. Effect cleanup / unmount (all listeners unsubscribed, active count returns to 0)
 *
 * DOES NOT CONNECT TO LIVE FIRESTORE.
 */

import { listenerDiagnostics } from "./src/utils/listenerDiagnostics";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log("================================================================================");
console.log("ERMATE P0 — ISOLATED FIRESTORE LISTENER LIFECYCLE VERIFICATION SUITE");
console.log("================================================================================\n");

// --- MOCK SIMULATOR FOR MAIN REALTIME FIRESTORE SYNC EFFECT ---
class MockFirestoreLifecycleSimulator {
  public selfMembership: any = null;
  public shifts: any[] = [{ id: "morning", name: "Morning Shift" }];
  public bedCapacity: number | null = null;

  private activeShiftsHospitalId: string | null = null;
  private unsubShifts: () => void = () => {};
  private unsubShiftMembership: () => void = () => {};
  private unsubCases: () => void = () => {};
  private unsubHandovers: () => void = () => {};
  private unsubQuickPaste: () => void = () => {};
  private unsubTeam: () => void = () => {};
  private unsubSub: () => void = () => {};
  private unsubContributions: () => void = () => {};

  public mount() {
    // Subscribe main listeners
    listenerDiagnostics.trackSubscribe("cases");
    this.unsubCases = () => listenerDiagnostics.trackUnsubscribe("cases");

    listenerDiagnostics.trackSubscribe("handovers");
    this.unsubHandovers = () => listenerDiagnostics.trackUnsubscribe("handovers");

    listenerDiagnostics.trackSubscribe("quick_paste_patients");
    this.unsubQuickPaste = () => listenerDiagnostics.trackUnsubscribe("quick_paste_patients");

    listenerDiagnostics.trackSubscribe("contributions");
    this.unsubContributions = () => listenerDiagnostics.trackUnsubscribe("contributions");

    listenerDiagnostics.trackSubscribe("team_members_self");
    this.unsubShiftMembership = () => {
      listenerDiagnostics.trackUnsubscribe("team_members_self");
      this.activeShiftsHospitalId = null;
      this.unsubShifts();
      this.unsubShifts = () => {};
    };
  }

  public onMemberSnapshot(memberSnapshot: { exists: boolean; data?: any }) {
    if (!memberSnapshot.exists) {
      this.activeShiftsHospitalId = null;
      this.unsubShifts();
      this.unsubShifts = () => {};
      this.updateSelfMembershipState(null);
      this.shifts = [{ id: "default_shifts" }];
      this.bedCapacity = null;
      return;
    }

    const membership = memberSnapshot.data;
    const membershipStatus = String(membership.status || "");
    const isActive = membershipStatus === "active" || membershipStatus === "approved";
    const isVerified = membership.membershipVerified === true;
    const trustedHospitalId =
      typeof membership.hospitalId === "string" && membership.hospitalId.trim()
        ? membership.hospitalId.trim()
        : (typeof membership.hospital === "string" ? membership.hospital.trim() : "");

    if (!isActive || !isVerified || !trustedHospitalId) {
      this.activeShiftsHospitalId = null;
      this.unsubShifts();
      this.unsubShifts = () => {};
      this.updateSelfMembershipState(null);
      this.shifts = [{ id: "default_shifts" }];
      this.bedCapacity = null;
      return;
    }

    this.updateSelfMembershipState(membership);

    // Minimal fix check: Only unsubscribe and resubscribe if effective hospital ID changed!
    if (this.activeShiftsHospitalId !== trustedHospitalId) {
      this.activeShiftsHospitalId = trustedHospitalId;
      this.unsubShifts();
      this.unsubShifts = () => {};

      listenerDiagnostics.trackSubscribe("hospital_shifts");
      const localHospitalId = trustedHospitalId;
      this.unsubShifts = () => {
        this.activeShiftsHospitalId = null;
        listenerDiagnostics.trackUnsubscribe("hospital_shifts");
      };
      this.shifts = [{ hospital: localHospitalId, shift: "08:00 - 16:00" }];
      this.bedCapacity = 30;
    }
  }

  private updateSelfMembershipState(nextMembership: any | null) {
    if (!nextMembership) {
      this.selfMembership = null;
      return;
    }
    if (!this.selfMembership) {
      this.selfMembership = nextMembership;
      return;
    }
    const prev = this.selfMembership;
    const next = nextMembership;
    if (
      prev.hospitalId === next.hospitalId &&
      prev.hospital === next.hospital &&
      prev.status === next.status &&
      prev.membershipVerified === next.membershipVerified &&
      prev.role === next.role &&
      prev.isTeamAdmin === next.isTeamAdmin &&
      prev.department === next.department
    ) {
      // Identity unchanged (no reference change)
      return;
    }
    this.selfMembership = next;
  }

  public unmount() {
    this.unsubCases();
    this.unsubHandovers();
    this.unsubQuickPaste();
    this.unsubTeam();
    this.unsubSub();
    this.unsubShiftMembership();
    this.unsubShifts();
    this.unsubContributions();
  }
}

listenerDiagnostics.reset();
const sim = new MockFirestoreLifecycleSimulator();

console.log("--- TEST 1: COMPONENT MOUNT & INITIAL SNAPSHOT ---");
sim.mount();
assert(listenerDiagnostics.getReport()["cases"].active === 1, "Cases listener active");
assert(listenerDiagnostics.getReport()["team_members_self"].active === 1, "Self-membership listener active");

const initialDoc = {
  hospitalId: "hosp_apollo_chennai",
  hospital: "Apollo Hospitals",
  status: "active",
  membershipVerified: true,
  role: "EM Resident",
  isTeamAdmin: false,
  department: "Emergency Medicine"
};
sim.onMemberSnapshot({ exists: true, data: initialDoc });

assert(listenerDiagnostics.getReport()["hospital_shifts"].subscriptions === 1, "hospital_shifts subscribed on initial verified membership");
assert(listenerDiagnostics.getReport()["hospital_shifts"].active === 1, "hospital_shifts active");
assert(sim.bedCapacity === 30, "Bed capacity loaded from shifts");

console.log("\n--- TEST 2: UNCHANGED MEMBERSHIP SNAPSHOT (NO RESUBSCRIPTION CHURN) ---");
const initialShiftSubCount = listenerDiagnostics.getReport()["hospital_shifts"].subscriptions;
const initialShiftUnsubCount = listenerDiagnostics.getReport()["hospital_shifts"].unsubscriptions;
const prevSelfMembershipRef = sim.selfMembership;

// Emit 5 successive unchanged snapshot events (e.g. metadata pings or server ticks)
for (let i = 1; i <= 5; i++) {
  sim.onMemberSnapshot({
    exists: true,
    data: { ...initialDoc } // Fresh object with identical fields
  });
}

assert(sim.selfMembership === prevSelfMembershipRef, "selfMembership object reference preserved across snapshots");
assert(
  listenerDiagnostics.getReport()["hospital_shifts"].subscriptions === initialShiftSubCount,
  "hospital_shifts was NOT resubscribed (subscriptions count unchanged)"
);
assert(
  listenerDiagnostics.getReport()["hospital_shifts"].unsubscriptions === initialShiftUnsubCount,
  "hospital_shifts was NOT unsubscribed (unsubscriptions count unchanged)"
);
assert(listenerDiagnostics.getReport()["hospital_shifts"].active === 1, "hospital_shifts remains continuously active");

console.log("\n--- TEST 3: CHANGED HOSPITAL (CLEAN TRANSITION TO NEW HOSPITAL SHIFTS) ---");
const transferredDoc = {
  ...initialDoc,
  hospitalId: "hosp_fortis_bangalore",
  hospital: "Fortis Hospital Bangalore"
};
sim.onMemberSnapshot({ exists: true, data: transferredDoc });

assert(
  listenerDiagnostics.getReport()["hospital_shifts"].subscriptions === initialShiftSubCount + 1,
  "hospital_shifts cleanly resubscribed exactly once for new hospital ID"
);
assert(
  listenerDiagnostics.getReport()["hospital_shifts"].unsubscriptions === initialShiftUnsubCount + 1,
  "hospital_shifts cleanly unsubscribed previous hospital shift document"
);
assert(listenerDiagnostics.getReport()["hospital_shifts"].active === 1, "hospital_shifts active count is exactly 1");
assert(sim.selfMembership.hospitalId === "hosp_fortis_bangalore", "selfMembership correctly points to new hospital");

console.log("\n--- TEST 4: MEMBERSHIP REMOVAL / REVOCATION (CLEANUP & DEFAULT FALLBACK) ---");
sim.onMemberSnapshot({ exists: false });

assert(sim.selfMembership === null, "selfMembership safely transitioned to null");
assert(sim.bedCapacity === null, "bedCapacity safely reset to null");
assert(listenerDiagnostics.getReport()["hospital_shifts"].active === 0, "hospital_shifts active count dropped to 0");
assert(
  listenerDiagnostics.getReport()["hospital_shifts"].unsubscriptions === initialShiftUnsubCount + 2,
  "hospital_shifts unsubscribed upon membership removal"
);

console.log("\n--- TEST 5: EFFECT CLEANUP / COMPONENT UNMOUNT ---");
sim.unmount();

const finalReport = listenerDiagnostics.getReport();
console.log("\nFinal Listener Diagnostics Report:");
console.table(finalReport);

for (const [listenerName, rec] of Object.entries(finalReport)) {
  assert(rec.active === 0, `Listener "${listenerName}" fully unsubscribed (active: 0)`);
}

console.log("\n================================================================================");
console.log("ALL ISOLATED FIRESTORE LIFECYCLE TESTS PASSED (0 ERRORS, 0 LEAKS)");
console.log("================================================================================");
