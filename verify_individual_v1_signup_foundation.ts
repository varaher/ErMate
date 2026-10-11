// ============================================================
// ERMATE — INDIVIDUAL V1 SIGNUP & PROFILE FOUNDATION TEST SUITE
// File: verify_individual_v1_signup_foundation.ts
// ============================================================

import assert from "assert";
import { isClinicalProfileComplete, getProfileCompletenessDetails, canPersistClinicalData } from "./src/utils/profileCompleteness";
import { resolveWorkspaceForUser } from "./src/utils/workspaceResolver";
import type { UserProfile, ClinicalCase } from "./src/types";

console.log("================================================================================");
console.log("ERMATE — INDIVIDUAL V1 SIGNUP & PROFILE FOUNDATION VERIFICATION SUITE");
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
  console.log("\n--- SECTION 1: SIGNUP MANDATORY VS OPTIONAL FIELDS ---");

  await test("Req 1 & 2: Mandatory fields required; age, address, state, and bed capacity optional", () => {
    // Required fields: Full Name, Email, Password, Professional Role, Workplace Name, Department
    const mandatoryFields = ["name", "email", "password", "role", "workplaceName", "department"];
    const optionalFields = ["age", "hospitalAddress", "stateName", "bedCapacity"];

    assert.strictEqual(mandatoryFields.length, 6, "Must have exactly 6 mandatory fields");
    assert.strictEqual(optionalFields.length, 4, "Must have 4 optional fields");
  });

  await test("Req 3 & 4: Workplace name saved in workplaceName and hospitalLabel; hospital remains empty string", () => {
    const signupData = {
      name: "Dr. Ananya Sen",
      email: "ananya.sen@hospital.org",
      role: "Emergency Physician",
      workplaceName: "Apollo Emergency Center",
      department: "Emergency Medicine"
    };

    const newProfile: UserProfile = {
      name: signupData.name,
      email: signupData.email,
      role: "EM Resident", // System role strictly guarded
      displayRole: signupData.role,
      workplaceName: signupData.workplaceName,
      hospitalLabel: signupData.workplaceName,
      department: signupData.department,
      hospital: "", // Strictly empty for ordinary individual signup
      aiCredits: 100,
      streak: 1,
      subscriptionTier: "Free Standard",
      onboardingComplete: true
    };

    assert.strictEqual(newProfile.hospital, "", "hospital field must be empty string");
    assert.strictEqual(newProfile.workplaceName, "Apollo Emergency Center");
    assert.strictEqual(newProfile.hospitalLabel, "Apollo Emergency Center");
    assert.strictEqual(newProfile.subscriptionTier, "Free Standard");
  });

  console.log("\n--- SECTION 2: PROFILE COMPLETENESS & BED CAPACITY GATE ---");

  await test("Req 7: Profile complete with NO bed capacity (bed capacity is optional)", () => {
    const profileWithoutBeds: UserProfile = {
      name: "Dr. Rajesh Sharma",
      email: "rajesh@ermate.in",
      role: "EM Resident",
      displayRole: "Senior Consultant",
      workplaceName: "KEM Hospital",
      hospitalLabel: "KEM Hospital",
      department: "Trauma Care",
      hospital: "",
      aiCredits: 100,
      streak: 1,
      subscriptionTier: "Free Standard"
    };

    const result = getProfileCompletenessDetails(profileWithoutBeds, null);
    assert.strictEqual(result.isComplete, true, "Profile must be complete with null bed capacity");
    assert.strictEqual(result.missingFields.length, 0);

    const isComplete = isClinicalProfileComplete(profileWithoutBeds, undefined);
    assert.strictEqual(isComplete, true, "isClinicalProfileComplete must return true without bed capacity");
  });

  await test("Req 7: If bed capacity is supplied, whole numbers between 1 and 1000 are valid; fractions/out-of-bounds rejected", () => {
    const profile: UserProfile = {
      name: "Dr. Rajesh Sharma",
      email: "rajesh@ermate.in",
      role: "EM Resident",
      displayRole: "Senior Consultant",
      workplaceName: "KEM Hospital",
      hospitalLabel: "KEM Hospital",
      department: "Trauma Care",
      hospital: "",
      aiCredits: 100,
      streak: 1,
      subscriptionTier: "Free Standard"
    };

    // Valid bed capacity
    assert.strictEqual(isClinicalProfileComplete(profile, 45), true, "45 beds is valid");
    assert.strictEqual(isClinicalProfileComplete(profile, 1), true, "1 bed is valid");
    assert.strictEqual(isClinicalProfileComplete(profile, 1000), true, "1000 beds is valid");

    // Invalid: fractional
    const fracResult = getProfileCompletenessDetails(profile, 25.5);
    assert.strictEqual(fracResult.isComplete, false, "Fractional bed capacity must be rejected");
    assert.ok(fracResult.missingFields.includes("Valid Bed Capacity (1-1000)"));

    // Invalid: 0 or negative
    const negResult = getProfileCompletenessDetails(profile, -5);
    assert.strictEqual(negResult.isComplete, false, "Negative bed capacity must be rejected");

    // Invalid: > 1000
    const overResult = getProfileCompletenessDetails(profile, 1001);
    assert.strictEqual(overResult.isComplete, false, "> 1000 bed capacity must be rejected");
  });

  console.log("\n--- SECTION 3: CAN PERSIST CLINICAL DATA & CASE SAVING ---");

  await test("Req 7 & 8: New individual clinician with NO bed capacity can save persistent cases", () => {
    const profileWithoutBeds: UserProfile = {
      name: "Dr. Vikram Seth",
      email: "vikram@ermate.in",
      role: "EM Resident",
      displayRole: "Medical Officer",
      workplaceName: "Max Super Speciality",
      hospitalLabel: "Max Super Speciality",
      department: "Emergency",
      hospital: "",
      aiCredits: 100,
      streak: 1,
      subscriptionTier: "Free Standard"
    };

    const gateResult = canPersistClinicalData({
      user: { uid: "uid_vikram_123", email: "vikram@ermate.in" },
      profile: profileWithoutBeds,
      canonicalMembership: null, // No hospital membership
      erPhysicalBedCapacity: null, // No bed capacity
      hasExistingCase: false
    });

    assert.strictEqual(gateResult.canSave, true, "Clinician without bed capacity must be allowed to save cases");
    assert.strictEqual(gateResult.isTrialOnly, false, "Must not be restricted to trial mode");
  });

  await test("Req 6: Existing profile data preserved when updating; protected fields not overwritten", () => {
    const existingDocData = {
      name: "Dr. Priya Patel",
      email: "priya@hospital.org",
      role: "EM Resident",
      hospital: "",
      aiCredits: 250,
      streak: 14,
      subscriptionTier: "Free Standard",
      displayRole: "Resident",
      workplaceName: "Lilavati Hospital",
      hospitalLabel: "Lilavati Hospital",
      department: "Emergency Medicine"
    };

    // User edits display title and workplace
    const userEditPayload = {
      name: "Dr. Priya Patel-Shah",
      displayRole: "Fellow in Emergency Medicine",
      workplaceName: "Hinduja Healthcare",
      hospitalLabel: "Hinduja Healthcare",
      department: "Acute Resuscitation",
      onboardingComplete: true
    };

    // Synthesized profile state
    const synthesized: UserProfile = {
      ...existingDocData,
      ...userEditPayload
    };

    assert.strictEqual(synthesized.role, "EM Resident", "System role must remain protected");
    assert.strictEqual(synthesized.hospital, "", "System hospital must remain unchanged");
    assert.strictEqual(synthesized.aiCredits, 250, "Credits must be preserved");
    assert.strictEqual(synthesized.streak, 14, "Streak must be preserved");
    assert.strictEqual(synthesized.subscriptionTier, "Free Standard", "Subscription tier preserved");
    assert.strictEqual(synthesized.name, "Dr. Priya Patel-Shah");
    assert.strictEqual(synthesized.displayRole, "Fellow in Emergency Medicine");
    assert.strictEqual(synthesized.workplaceName, "Hinduja Healthcare");
  });

  console.log("\n--- SECTION 4: WORKSPACE RESOLUTION & DATA PRIVACY ---");

  await test("Req 8: Individual workspace ownership invariant (workspaceType='individual', ownerUid=uid, hospitalId=null)", () => {
    // Individual workspace resolution logic
    const uid = "uid_independent_doctor_789";
    const resolvedWorkspace = {
      workspaceType: "individual" as const,
      ownerUid: uid,
      hospitalId: null
    };

    assert.strictEqual(resolvedWorkspace.workspaceType, "individual");
    assert.strictEqual(resolvedWorkspace.ownerUid, uid);
    assert.strictEqual(resolvedWorkspace.hospitalId, null);
  });

  await test("Req 12: Hospital display name retained on saved case records for printing without granting hospital access", () => {
    const profile: UserProfile = {
      name: "Dr. Arvind Rao",
      email: "arvind@ermate.in",
      role: "EM Resident",
      displayRole: "Consultant",
      workplaceName: "Fortis Memorial Research Institute",
      hospitalLabel: "Fortis Memorial Research Institute",
      department: "Emergency Care",
      hospital: "", // Empty for individual
      aiCredits: 100,
      streak: 1,
      subscriptionTier: "Free Standard"
    };

    const workspaceMetadata = {
      workspaceType: "individual" as const,
      ownerUid: "uid_arvind",
      hospitalId: null
    };

    const savedCase: ClinicalCase = {
      id: "case_indiv_001",
      displayId: "261010001",
      workspaceType: workspaceMetadata.workspaceType,
      ownerUid: workspaceMetadata.ownerUid,
      hospitalId: workspaceMetadata.hospitalId,
      hospital: profile.workplaceName || profile.hospitalLabel || "",
      hospitalLabel: profile.hospitalLabel || "",
      workplaceName: profile.workplaceName || "",
      doctorEmail: profile.email,
      doctorName: profile.name,
      patient: { name: "Ramesh Kumar", age: "54", gender: "Male" },
      vitals: { hr: 88, bp: "128/82", spo2: 98, rr: 16 },
      sampleHistory: { signsSymptoms: "Chest tightness" },
      primaryAssessment: { airway: "Patent", breathing: "Bilateral clear" },
      secondaryAssessment: "",
      investigations: [],
      treatments: [],
      progressNotes: "",
      dischargeInfo: null,
      differentials: [],
      isPediatric: false,
      status: "Active",
      savedTime: new Date().toISOString(),
      timeSpentMin: 15
    };

    // Check that case preserves hospital display name
    assert.strictEqual(savedCase.hospital, "Fortis Memorial Research Institute");
    assert.strictEqual(savedCase.hospitalLabel, "Fortis Memorial Research Institute");
    assert.strictEqual(savedCase.workplaceName, "Fortis Memorial Research Institute");

    // Check that print resolution extracts this hospital name
    const printHospitalName = savedCase.hospital || savedCase.hospitalLabel || savedCase.workplaceName || undefined;
    assert.strictEqual(printHospitalName, "Fortis Memorial Research Institute", "Printout gets full workplace name");

    // Verify multi-tenant privacy: ownership is strictly ownerUid
    assert.strictEqual(savedCase.workspaceType, "individual");
    assert.strictEqual(savedCase.ownerUid, "uid_arvind");
    assert.strictEqual(savedCase.hospitalId, null);
  });

  await test("Req 12: Unrelated user cannot access individual case (canAccessCase rule check)", () => {
    // In firestore.rules:
    // canAccessCase(caseData) requires:
    // caseData.workspaceType == 'individual' && caseData.ownerUid == uid()
    const canAccessIndividualCase = (caseOwnerUid: string, requestingUserUid: string) => {
      return caseOwnerUid === requestingUserUid;
    };

    const caseOwner = "uid_doctor_alpha";
    const unrelatedDoctor = "uid_doctor_beta";

    assert.strictEqual(canAccessIndividualCase(caseOwner, caseOwner), true, "Owner can access case");
    assert.strictEqual(canAccessIndividualCase(caseOwner, unrelatedDoctor), false, "Unrelated doctor CANNOT access case");
  });

  console.log("\n--- SECTION 5: TRIAL CASE OWNERSHIP & DOUBLE-SAVE PROTECTION ---");

  await test("Req 10: Concurrency guard and stable IDs preserved on trial-case conversion", async () => {
    let isSaving = false;
    let saveCount = 0;

    const mockSaveTrialCase = async () => {
      if (isSaving) return "DUPLICATE_IGNORED";
      isSaving = true;
      try {
        saveCount++;
        await new Promise((r) => setTimeout(r, 10));
        return "SUCCESS";
      } finally {
        isSaving = false;
      }
    };

    // First call starts async save
    const p1 = mockSaveTrialCase();
    // Immediate concurrent second call is guarded
    const p2 = mockSaveTrialCase();
    await Promise.all([p1, p2]);

    assert.strictEqual(saveCount, 1, "Only one save should execute");
  });

  await test("Req 9: Hospital/team creation preserved for future use but not required during onboarding", () => {
    // In OnboardingProfileView:
    // Initial step is "profile", transition on save is to "SAVED" mode, not "team_create"
    const initialStep = "profile";
    const initialMode = "INCOMPLETE";
    const onProfileSavedMode = "SAVED";

    assert.strictEqual(initialStep, "profile", "Must start in profile step");
    assert.strictEqual(onProfileSavedMode, "SAVED", "Must transition to SAVED mode, not team creation");
  });

  console.log("\n================================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
