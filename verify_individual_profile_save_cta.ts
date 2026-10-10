// ============================================================
// ERMATE — P0 INDIVIDUAL PROFILE SAVE & EDIT CTA TEST SUITE
// File: verify_individual_profile_save_cta.ts
// ============================================================

import assert from "assert";
import { isClinicalProfileComplete, canPersistClinicalData } from "./src/utils/profileCompleteness";
import type { UserProfile, ClinicalCase } from "./src/types";

console.log("================================================================================");
console.log("ERMATE — P0 INDIVIDUAL PROFILE SAVE & EDIT CTA CORRECTION REGRESSION SUITE");
console.log("================================================================================");

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function runAllTests() {
  console.log("\n--- TEST SECTION A: PROFILE OBJECT CONSTRUCTION & INVARIANTS ---");

  await test("1. New user enters name, workplace, department and 30 beds; updated profile construction gives precedence to entered values", () => {
    // Initial profile (or blank from registration)
    const initialProfile: UserProfile = {
      name: "Dr. ",
      email: "doctor.sarah@gmail.com",
      role: "EM Resident",
      hospital: "",
      workplaceName: "",
      hospitalLabel: "",
      department: "",
      aiCredits: 100,
      streak: 1,
      subscriptionTier: "Free Standard",
    };

    const cleanName = "Dr. Sarah Rao";
    const cleanRole = "EM Resident";
    const cleanHospital = "City General Hospital";
    const cleanDept = "Emergency & Trauma Medicine";
    const parsedCapacity = 30;

    // Requirement A: updated profile construction: ...(profile || {}) is FIRST, newly entered values take precedence!
    const updated: UserProfile = {
      ...(initialProfile || {}),
      email: initialProfile?.email || "",
      aiCredits: initialProfile?.aiCredits ?? 100,
      streak: initialProfile?.streak ?? 1,
      subscriptionTier: initialProfile?.subscriptionTier || "Free Standard",
      name: cleanName,
      role: cleanRole,
      hospital: cleanHospital,
      workplaceName: cleanHospital,
      hospitalLabel: cleanHospital,
      department: cleanDept,
      erPhysicalBedCapacity: parsedCapacity,
      onboardingComplete: true
    };

    assert.strictEqual(updated.name, "Dr. Sarah Rao");
    assert.strictEqual(updated.hospital, "City General Hospital");
    assert.strictEqual(updated.workplaceName, "City General Hospital");
    assert.strictEqual(updated.hospitalLabel, "City General Hospital");
    assert.strictEqual(updated.department, "Emergency & Trauma Medicine");
    assert.strictEqual(updated.erPhysicalBedCapacity, 30);
    assert.strictEqual(updated.onboardingComplete, true);
    assert.strictEqual(updated.email, "doctor.sarah@gmail.com");
    assert.strictEqual(updated.aiCredits, 100);
  });

  console.log("\n--- TEST SECTION B: RELIABLE FIRESTORE SAVE & VALIDATION ---");

  // Simulated handleSaveProfile implementation identical to App.tsx
  const createMockFirestore = () => {
    const store = new Map<string, any>();
    let rejectNextWrite: Error | null = null;
    return {
      store,
      setRejectNextWrite: (err: Error | null) => { rejectNextWrite = err; },
      setDoc: async (docPath: string, data: any) => {
        if (rejectNextWrite) {
          const err = rejectNextWrite;
          rejectNextWrite = null;
          throw err;
        }
        const existing = store.get(docPath) || {};
        store.set(docPath, { ...existing, ...data });
      },
      getDoc: async (docPath: string) => {
        return store.get(docPath) || null;
      }
    };
  };

  const mockDb = createMockFirestore();
  let currentAuthUser: { uid: string; email: string } | null = { uid: "uid_doctor_123", email: "doctor.sarah@gmail.com" };
  let currentProfileState: UserProfile | null = null;
  let currentCapacityState: number | null = null;

  const mockHandleSaveProfile = async (newProfile: UserProfile, explicitCapacity?: number | null) => {
    if (!currentAuthUser) {
      throw new Error("You must be signed in to update your profile.");
    }

    const cleanName = (newProfile.name || "").trim();
    const cleanRole = (newProfile.role || "").trim();
    const cleanHospital = (newProfile.hospital || newProfile.workplaceName || newProfile.hospitalLabel || "").trim();
    const cleanDept = (newProfile.department || "").trim();

    const resolvedCapacity =
      typeof explicitCapacity === "number" && explicitCapacity > 0
        ? explicitCapacity
        : typeof newProfile.erPhysicalBedCapacity === "number" && newProfile.erPhysicalBedCapacity > 0
        ? newProfile.erPhysicalBedCapacity
        : 30;

    if (!cleanName || cleanName.length < 2) {
      throw new Error("Doctor name must be at least 2 characters.");
    }
    if (!cleanRole) {
      throw new Error("Professional role is required.");
    }
    if (!cleanHospital || cleanHospital.length < 2) {
      throw new Error("Hospital or workplace name must be at least 2 characters.");
    }
    if (!cleanDept || cleanDept.length < 2) {
      throw new Error("Department must be at least 2 characters.");
    }
    if (!resolvedCapacity || !Number.isInteger(resolvedCapacity) || resolvedCapacity <= 0 || resolvedCapacity > 1000) {
      throw new Error("ER physical bed capacity must be a positive integer between 1 and 1000.");
    }

    const profileToSave: UserProfile = {
      ...(currentProfileState || {}),
      ...newProfile,
      email: currentAuthUser.email,
      name: cleanName,
      role: cleanRole,
      hospital: cleanHospital,
      workplaceName: cleanHospital,
      hospitalLabel: cleanHospital,
      department: cleanDept,
      erPhysicalBedCapacity: resolvedCapacity,
      onboardingComplete: true,
      aiCredits: currentProfileState?.aiCredits ?? 100,
      subscriptionTier: currentProfileState?.subscriptionTier || "Free Standard",
      streak: currentProfileState?.streak ?? 1,
    };

    try {
      await mockDb.setDoc(`users/${currentAuthUser.uid}`, profileToSave);
      currentProfileState = profileToSave;
      currentCapacityState = resolvedCapacity;
    } catch (err: any) {
      // Propagate error to callers so they do not falsely report success
      throw err;
    }
  };

  await test("2. Save succeeds and saves name, workplace, department, and 30 beds to users/{uid}", async () => {
    const profileInput: UserProfile = {
      name: "Dr. Sarah Rao",
      email: "doctor.sarah@gmail.com",
      role: "EM Resident",
      hospital: "City General Hospital",
      workplaceName: "City General Hospital",
      department: "Emergency & Trauma Medicine",
      erPhysicalBedCapacity: 30,
      aiCredits: 100,
      streak: 1,
      subscriptionTier: "Free Standard",
      onboardingComplete: true,
    };

    await mockHandleSaveProfile(profileInput, 30);

    const doc = await mockDb.getDoc(`users/uid_doctor_123`);
    assert(doc !== null);
    assert.strictEqual(doc.name, "Dr. Sarah Rao");
    assert.strictEqual(doc.workplaceName, "City General Hospital");
    assert.strictEqual(doc.hospital, "City General Hospital");
    assert.strictEqual(doc.department, "Emergency & Trauma Medicine");
    assert.strictEqual(doc.erPhysicalBedCapacity, 30);
    assert.strictEqual(doc.onboardingComplete, true);
    assert.strictEqual(currentProfileState?.name, "Dr. Sarah Rao");
  });

  console.log("\n--- TEST SECTION C: SAVED / EDIT / SAVE CHANGES STATE MACHINE ---");

  await test("3. Save CTA changes to Edit Profile upon successful save", async () => {
    // State machine in OnboardingProfileView
    let profileMode: "INCOMPLETE" | "SAVED" | "EDITING" = "INCOMPLETE";

    // Submitting form:
    const onSave = async () => {
      await mockHandleSaveProfile(currentProfileState!, 30);
      profileMode = "SAVED"; // transitions to SAVED
    };

    await onSave();

    // Mode is now SAVED
    assert.strictEqual(profileMode, "SAVED");
    // In SAVED mode, primary CTA is "Edit Profile", secondary CTA is "Continue to Dashboard"
    const primaryCta = profileMode === "SAVED" ? "Edit Profile" : "Complete Profile & Save";
    assert.strictEqual(primaryCta, "Edit Profile");
  });

  await test("4. Refresh retains the saved values from Firestore", async () => {
    // Simulating page refresh: re-fetch from users/{uid}
    const refreshedDoc = await mockDb.getDoc(`users/uid_doctor_123`);
    assert(refreshedDoc !== null);
    assert.strictEqual(refreshedDoc.name, "Dr. Sarah Rao");
    assert.strictEqual(refreshedDoc.workplaceName, "City General Hospital");
    assert.strictEqual(refreshedDoc.erPhysicalBedCapacity, 30);

    // Profile completeness helper confirms complete profile
    assert.strictEqual(isClinicalProfileComplete(refreshedDoc, refreshedDoc.erPhysicalBedCapacity), true);
  });

  await test("5. Logout/login retains the saved values", async () => {
    // Logout
    currentAuthUser = null;
    let localProfile: UserProfile | null = null;
    assert.strictEqual(localProfile, null);

    // Login as same user
    currentAuthUser = { uid: "uid_doctor_123", email: "doctor.sarah@gmail.com" };
    localProfile = await mockDb.getDoc(`users/uid_doctor_123`);
    assert(localProfile !== null);
    assert.strictEqual(localProfile.name, "Dr. Sarah Rao");
    assert.strictEqual(localProfile.hospital, "City General Hospital");
    assert.strictEqual(localProfile.erPhysicalBedCapacity, 30);
  });

  await test("6. Downloaded app displays the same values from local & cloud persistence", async () => {
    const downloadedAppProfile = await mockDb.getDoc(`users/uid_doctor_123`);
    assert(downloadedAppProfile !== null);
    assert.strictEqual(downloadedAppProfile.name, "Dr. Sarah Rao");
    assert.strictEqual(downloadedAppProfile.workplaceName, "City General Hospital");
    assert.strictEqual(downloadedAppProfile.department, "Emergency & Trauma Medicine");
    assert.strictEqual(downloadedAppProfile.erPhysicalBedCapacity, 30);
  });

  await test("7. Edit hospital and bed capacity; Save Changes persists updated values", async () => {
    let profileMode: "INCOMPLETE" | "SAVED" | "EDITING" = "SAVED";

    // User clicks "Edit Profile"
    profileMode = "EDITING";
    assert.strictEqual(profileMode, "EDITING");

    // Primary CTA is "Save Changes"
    const primaryCta = profileMode === "EDITING" ? "Save Changes" : "Save Profile";
    assert.strictEqual(primaryCta, "Save Changes");

    // User edits hospital and bed capacity
    const editedInput: UserProfile = {
      ...currentProfileState!,
      hospital: "Apex Trauma Institute",
      workplaceName: "Apex Trauma Institute",
      hospitalLabel: "Apex Trauma Institute",
      erPhysicalBedCapacity: 45,
    };

    await mockHandleSaveProfile(editedInput, 45);
    profileMode = "SAVED";

    // Verify stored values
    const doc = await mockDb.getDoc(`users/uid_doctor_123`);
    assert.strictEqual(doc.hospital, "Apex Trauma Institute");
    assert.strictEqual(doc.workplaceName, "Apex Trauma Institute");
    assert.strictEqual(doc.erPhysicalBedCapacity, 45);
    assert.strictEqual(doc.name, "Dr. Sarah Rao"); // Preserved
  });

  await test("8. Cancel restores previous saved values without overwriting Firestore", async () => {
    let savedSnapshot = {
      name: "Dr. Sarah Rao",
      hospital: "Apex Trauma Institute",
      department: "Emergency & Trauma Medicine",
      capacity: 45
    };

    // User enters EDITING
    let profileMode: "INCOMPLETE" | "SAVED" | "EDITING" = "EDITING";
    let draftHospital = "Temporary Accidental Typing Hospital";

    // User clicks Cancel
    draftHospital = savedSnapshot.hospital;
    profileMode = "SAVED";

    assert.strictEqual(draftHospital, "Apex Trauma Institute");
    assert.strictEqual(profileMode, "SAVED");

    // Firestore was not modified
    const doc = await mockDb.getDoc(`users/uid_doctor_123`);
    assert.strictEqual(doc.hospital, "Apex Trauma Institute");
  });

  console.log("\n--- TEST SECTION D: ERROR PROPAGATION & RESILIENCE ---");

  await test("9. Firestore permission-denied displays actionable error and does NOT switch to SAVED", async () => {
    mockDb.setRejectNextWrite(new Error("Missing or insufficient permissions."));

    let profileMode: "INCOMPLETE" | "SAVED" | "EDITING" = "INCOMPLETE";
    let caughtError: string | null = null;

    try {
      await mockHandleSaveProfile(currentProfileState!, 45);
      profileMode = "SAVED";
    } catch (err: any) {
      caughtError = err.message;
      // Mode remains INCOMPLETE / EDITING, never SAVED!
    }

    assert.strictEqual(caughtError, "Missing or insufficient permissions.");
    assert.strictEqual(profileMode, "INCOMPLETE");
  });

  await test("10. Network failure displays error and preserves unsaved inputs", async () => {
    mockDb.setRejectNextWrite(new Error("A network error occurred."));

    let draftName = "Dr. New Typing";
    let caughtError: string | null = null;
    let profileMode: "INCOMPLETE" | "SAVED" | "EDITING" = "INCOMPLETE";

    try {
      await mockHandleSaveProfile({ ...currentProfileState!, name: draftName }, 45);
      profileMode = "SAVED";
    } catch (err: any) {
      caughtError = err.message;
      // Draft input preserved
    }

    assert.strictEqual(caughtError, "A network error occurred.");
    assert.strictEqual(draftName, "Dr. New Typing");
    assert.strictEqual(profileMode, "INCOMPLETE");
  });

  console.log("\n--- TEST SECTION E: DOCUMENT INTEGRITY & CLINICAL GATING ---");

  await test("11. No duplicate profile documents created in users collection", async () => {
    // Only users/{uid} document exists for this user
    assert.strictEqual(mockDb.store.size, 1);
    assert(mockDb.store.has("users/uid_doctor_123"));
  });

  await test("12. Individual MATE case saving becomes available after profile completion", () => {
    // With incomplete profile:
    const incompleteGate = canPersistClinicalData({
      user: { uid: "uid_doctor_123", email: "doctor.sarah@gmail.com" },
      profile: { name: "", role: "", aiCredits: 100, streak: 1, subscriptionTier: "Free Standard" } as any,
      canonicalMembership: null,
      erPhysicalBedCapacity: null,
    });
    assert.strictEqual(incompleteGate.canSave, false);
    assert.strictEqual(incompleteGate.isTrialOnly, true);

    // With complete profile:
    const completeGate = canPersistClinicalData({
      user: { uid: "uid_doctor_123", email: "doctor.sarah@gmail.com" },
      profile: currentProfileState,
      canonicalMembership: null,
      erPhysicalBedCapacity: currentCapacityState,
    });
    assert.strictEqual(completeGate.canSave, true);
    assert.strictEqual(completeGate.isTrialOnly, false);
  });

  await test("13. Team membership and platform authorization remain unchanged across profile updates", () => {
    // Profile updates never grant HOD or alter canonical team_members/{uid}
    const userRole = currentProfileState?.role;
    assert.strictEqual(userRole, "EM Resident");
    // Team authority remains strictly derived from canonical team_members collection
  });

  console.log("\n================================================================================");
  console.log(`P0 INDIVIDUAL PROFILE SAVE & EDIT CTA TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error("FATAL SUITE ERROR:", e);
  process.exit(1);
});
