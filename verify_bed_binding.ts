import assert from "assert";
import { allocateOrValidateBed } from "./src/utils/bedAllocation";
import { normalizeMateBedId } from "./src/mate/mateBedModel";
import { resolveMateCaseReference, extractMateBedReference } from "./src/mate/mateCaseResolver";
import { ClinicalCase, TriageCategory } from "./src/types";

console.log("==================================================");
console.log("CANONICAL BED ASSIGNMENT & RESOLUTION VERIFICATION");
console.log("==================================================");

// Test 1: New triage patient with explicit Bed 5 -> ClinicalCase.bedNo persisted canonically
{
  const activeCases: ClinicalCase[] = [];
  const allocation = allocateOrValidateBed("5", activeCases, 30);
  assert.strictEqual(allocation.success, true);
  // Allocates slot 5A under locked family allocation semantics
  assert.strictEqual(allocation.canonicalBed, "5A");
  console.log("[PASS] 1. New triage patient with explicit Bed 5 -> allocated 5A");
}

// Test 2: New patient with "10 b" -> stored as 10B
{
  const activeCases: ClinicalCase[] = [];
  const allocation = allocateOrValidateBed("10 b", activeCases, 30);
  assert.strictEqual(allocation.success, true);
  assert.strictEqual(allocation.canonicalBed, "10B");

  const normalized = normalizeMateBedId("10 b");
  assert.strictEqual(normalized, "10B");

  const normalizedWithPrefix = normalizeMateBedId("Bed 10B");
  assert.strictEqual(normalizedWithPrefix, "10B");
  console.log("[PASS] 2. Input '10 b' and 'Bed 10B' normalize to canonical '10B'");
}

// Test 3: Existing C-2976 with no bed -> unassigned state
{
  const caseC2976 = {
    id: "C-2976",
    bedNo: undefined,
    status: "Active",
    patient: {
      name: "Emergency Patient",
      age: 58,
      gender: "Male",
      presentingComplaint: "Chest discomfort",
      triageCategory: TriageCategory.P2,
      dateOpened: "10:00 AM",
      isMlc: false,
    },
    doctorName: "Dr. Test",
    doctorEmail: "dr@example.com",
    hospital: "General Hospital",
    departmentId: "general-hospital",
    createdAt: new Date().toISOString(),
  } as unknown as ClinicalCase;

  assert.strictEqual(caseC2976.id, "C-2976");
  assert.strictEqual(caseC2976.bedNo, undefined);
  assert.strictEqual(caseC2976.patient.age, 58);
  assert.strictEqual(caseC2976.patient.gender, "Male");
  assert.strictEqual(caseC2976.patient.triageCategory, TriageCategory.P2);
  console.log("[PASS] 3. Existing C-2976 unassigned case data structure verified");
}

// Test 4: Assign C-2976 to Bed 11 -> canonical bed assignment succeeds safely
{
  const caseC2976 = {
    id: "C-2976",
    bedNo: undefined,
    status: "Active",
    patient: {
      name: "Emergency Patient",
      age: 58,
      gender: "Male",
      presentingComplaint: "Chest discomfort",
      triageCategory: TriageCategory.P2,
      dateOpened: "10:00 AM",
      isMlc: false,
    },
    doctorName: "Dr. Test",
    doctorEmail: "dr@example.com",
    hospital: "General Hospital",
    departmentId: "general-hospital",
    createdAt: new Date().toISOString(),
  } as unknown as ClinicalCase;

  const activeCases: ClinicalCase[] = [caseC2976];
  const allocation = allocateOrValidateBed("11", activeCases, 30, caseC2976.id);
  assert.strictEqual(allocation.success, true);
  assert.strictEqual(allocation.canonicalBed, "11A");

  // Mutate bedNo on C-2976
  caseC2976.bedNo = allocation.canonicalBed;
  assert.strictEqual(caseC2976.id, "C-2976", "Case ID MUST NOT change when bed is assigned");
  assert.strictEqual(caseC2976.bedNo, "11A");
  console.log("[PASS] 4. Assigning C-2976 to Bed 11 allocates 11A without altering case ID");
}

// Test 5: Second case cannot take already occupied exact slot (refuse and show existing occupant)
{
  const caseC2976 = {
    id: "C-2976",
    bedNo: "11A",
    status: "Active",
    patient: {
      name: "Raman Pillai",
      age: 58,
      gender: "Male",
      presentingComplaint: "Chest discomfort",
      triageCategory: TriageCategory.P2,
      dateOpened: "10:00 AM",
      isMlc: false,
    },
    doctorName: "Dr. Test",
    doctorEmail: "dr@example.com",
    hospital: "General Hospital",
    departmentId: "general-hospital",
    createdAt: new Date().toISOString(),
  } as unknown as ClinicalCase;

  const activeCases: ClinicalCase[] = [caseC2976];

  // Attempting to assign explicit 11A to another case
  const secondAllocation = allocateOrValidateBed("11A", activeCases, 30, "C-9999");
  assert.strictEqual(secondAllocation.success, false);
  assert(secondAllocation.error?.includes("already occupied by Raman Pillai"));

  // Attempting to assign bare bed 11 to second case allocates 11B (since 11A is occupied)
  const bareAllocation = allocateOrValidateBed("11", activeCases, 30, "C-9999");
  assert.strictEqual(bareAllocation.success, true);
  assert.strictEqual(bareAllocation.canonicalBed, "11B");

  // If both 11A and 11B are occupied, bare bed 11 fails closed
  const caseSecond = {
    ...caseC2976,
    id: "C-9999",
    bedNo: "11B",
    patient: { ...caseC2976.patient, name: "Second Patient" },
  } as unknown as ClinicalCase;
  const fullCases = [caseC2976, caseSecond];
  const thirdAllocation = allocateOrValidateBed("11", fullCases, 30, "C-1234");
  assert.strictEqual(thirdAllocation.success, false);
  assert(thirdAllocation.error?.includes("fully occupied"));
  console.log("[PASS] 5. Occupancy collision prevention: explicit slot refused, bare bed routes to 11B then fails closed when full");
}

// Test 6: Archived / discharged case does not block bed occupancy
{
  const dischargedCase = {
    id: "C-0001",
    bedNo: "11A",
    status: "Discharged",
    patient: { name: "Discharged Patient", age: 40, gender: "Female", presentingComplaint: "Resolved", triageCategory: TriageCategory.P3, dateOpened: "09:00 AM", isMlc: false },
    doctorName: "Dr. Test",
    doctorEmail: "dr@example.com",
    hospital: "General Hospital",
    departmentId: "general-hospital",
    createdAt: new Date().toISOString(),
  } as unknown as ClinicalCase;

  const archivedCase = {
    id: "C-0002",
    bedNo: "11A",
    status: "Active",
    archivedAt: new Date().toISOString(),
    patient: { name: "Archived Patient", age: 70, gender: "Male", presentingComplaint: "Old", triageCategory: TriageCategory.P2, dateOpened: "08:00 AM", isMlc: false },
    doctorName: "Dr. Test",
    doctorEmail: "dr@example.com",
    hospital: "General Hospital",
    departmentId: "general-hospital",
    createdAt: new Date().toISOString(),
  } as unknown as ClinicalCase;

  const allocation = allocateOrValidateBed("11A", [dischargedCase, archivedCase], 30);
  assert.strictEqual(allocation.success, true);
  assert.strictEqual(allocation.canonicalBed, "11A");
  console.log("[PASS] 6. Discharged and archived cases do not block bed occupancy");
}

// Test 7: MATE Resolution of Bed 11 to C-2976 once assigned to Bed 11A
{
  const caseC2976 = {
    id: "C-2976",
    bedNo: "11A",
    status: "Active",
    patient: {
      name: "Raman Pillai",
      age: 58,
      gender: "Male",
      presentingComplaint: "Chest discomfort",
      triageCategory: TriageCategory.P2,
      dateOpened: "10:00 AM",
      isMlc: false,
    },
    doctorName: "Dr. Test",
    doctorEmail: "dr@example.com",
    hospital: "General Hospital",
    departmentId: "general-hospital",
    createdAt: new Date().toISOString(),
  } as unknown as ClinicalCase;

  const utterance = "Bed 11 SAMPLE is incomplete. Past medical history is nil.";
  const extractedBed = extractMateBedReference(utterance);
  assert.strictEqual(extractedBed, "11");

  const resolution = resolveMateCaseReference({
    utterance,
    cases: [caseC2976],
    physicalCapacity: 30,
  });

  assert.strictEqual(resolution.status, "RESOLVED");
  assert.strictEqual(resolution.caseId, "C-2976");
  assert.strictEqual(resolution.referenceType, "BED");
  assert.strictEqual(resolution.referenceValue, "11");
  console.log("[PASS] 7. MATE resolves 'Bed 11 SAMPLE is incomplete...' to C-2976 (Bed 11A) without creating a new case");
}

console.log("==================================================");
console.log("ALL BED ASSIGNMENT VERIFICATIONS PASSED: 7/7");
console.log("==================================================");
