import { ClinicalCase } from "./src/types";
import { computeCensusOrientation, formatErOverviewMessage } from "./src/mate/mateOrientation";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log("=== VERIFYING MATE ORIENTATION ===");

// Scenario 1: Empty cases
const emptyOrientation = computeCensusOrientation([]);
assert(emptyOrientation.activePatientCount === 0, "Empty active count should be 0");
assert(emptyOrientation.occupiedBeds.length === 0, "Empty occupied beds should be empty");
const emptyMsg = formatErOverviewMessage(emptyOrientation);
assert(emptyMsg.includes("no active patients"), "Empty message mentions clear census");

// Scenario 2: Active cases with mixed triage, beds, unassigned, incomplete
const mockCases: ClinicalCase[] = [
  {
    id: "uuid-1",
    displayId: "261006001",
    bedNo: "9",
    status: "Active",
    patient: { name: "Ramesh", age: 58, gender: "Male", triageCategory: "P1" },
    presentingComplaints: { chiefComplaints: ["Chest pain"] },
    triageCategory: "P1",
  } as any,
  {
    id: "uuid-2",
    displayId: "261006002",
    bedNo: "11A",
    status: "Active",
    patient: { name: "Suresh", age: 42, gender: "Male", triageCategory: "P2" },
    triageCategory: "P2",
  } as any,
  {
    id: "uuid-3",
    displayId: "261006003",
    bedNo: "",
    status: "Active",
    patient: { name: "Priya", age: 30, gender: "Female", triageCategory: "P3" },
    triageCategory: "P3",
  } as any,
  {
    id: "uuid-4",
    displayId: "261006004",
    bedNo: "15",
    status: "Discharged", // should be filtered out
    patient: { name: "Anita", age: 65, gender: "Female" },
  } as any,
];

const orientation = computeCensusOrientation(mockCases);
assert(orientation.activePatientCount === 3, "Active count should be 3 (excluding discharged)");
assert(orientation.occupiedBeds.includes("9") && orientation.occupiedBeds.includes("11A"), "Should include beds 9 and 11A");
assert(!orientation.occupiedBeds.includes("15"), "Should not include discharged bed 15");
assert(orientation.unassignedCount === 1, "Should count 1 unassigned bed");
assert(orientation.triageCounts.p1 === 1, "Should count 1 P1");
assert(orientation.triageCounts.p2 === 1, "Should count 1 P2");
assert(orientation.triageCounts.p3 === 1, "Should count 1 P3");

const overviewMsg = formatErOverviewMessage(orientation);
assert(overviewMsg.includes("3 active patients"), "Overview message includes active count");
assert(overviewMsg.includes("1 P1"), "Overview message includes P1 count");
assert(overviewMsg.includes("Bed"), "Overview message includes beds");

console.log("✓ All mate orientation tests passed (3/3)");
