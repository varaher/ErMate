import {
  extractMateBedReference,
  resolveMateCaseReference,
} from "../src/mate/mateCaseResolver";
import type { ClinicalCase } from "../src/types";

function expect(
  condition: boolean,
  label: string
) {
  if (!condition) {
    console.error(`❌ ${label}`);
    process.exit(1);
  }

  console.log(`✅ ${label}`);
}

const cases = [
  {
    id: "CASE-3",
    bedNo: "3",
    status: "Active",
  },
  {
    id: "CASE-4A",
    bedNo: "4A",
    status: "Active",
  },
  {
    id: "CASE-5-DISCHARGED",
    bedNo: "5",
    status: "Discharged",
  },
  {
    id: "CASE-7-A",
    bedNo: "7",
    status: "Active",
  },
  {
    id: "CASE-7-B",
    bedNo: "7",
    status: "Active",
  },
] as ClinicalCase[];

console.log(
  "\n=== MATE CANONICAL CASE RESOLVER TESTS ===\n"
);

expect(
  extractMateBedReference("bed 3") === "3",
  `"bed 3" extraction`
);

expect(
  extractMateBedReference(
    "patient in bed no 4 a"
  ) === "4A",
  `"bed no 4 a" extraction`
);

expect(
  extractMateBedReference(
    "45 year old male"
  ) === null,
  `bare age is NOT a bed`
);

expect(
  extractMateBedReference(
    "BP is 90/50"
  ) === null,
  `BP values are NOT beds`
);

const existing =
  resolveMateCaseReference({
    utterance:
      "Mate review the patient in bed 3",
    cases,
    physicalCapacity: 20,
  });

expect(
  existing.status === "RESOLVED" &&
    existing.caseId === "CASE-3",
  `Bed 3 resolves existing case`
);

const subdivision =
  resolveMateCaseReference({
    utterance: "open bed 4a",
    cases,
    physicalCapacity: 20,
  });

expect(
  subdivision.status === "RESOLVED" &&
    subdivision.caseId === "CASE-4A",
  `Bed 4A resolves existing case`
);

const discharged =
  resolveMateCaseReference({
    utterance: "bed 5",
    cases,
    physicalCapacity: 20,
  });

expect(
  discharged.status === "NOT_FOUND",
  `Discharged Bed 5 is treated as available`
);

const empty =
  resolveMateCaseReference({
    utterance:
      "I have a new patient in bed 6B",
    cases,
    physicalCapacity: 20,
  });

expect(
  empty.status === "NOT_FOUND" &&
    empty.referenceValue === "6B",
  `Unused valid Bed 6B is NOT_FOUND`
);

const invalid =
  resolveMateCaseReference({
    utterance: "bed 21",
    cases,
    physicalCapacity: 20,
  });

expect(
  invalid.status === "INVALID_LOCATION",
  `Bed 21 rejected when capacity is 20`
);

const ambiguous =
  resolveMateCaseReference({
    utterance: "review bed 7",
    cases,
    physicalCapacity: 20,
  });

expect(
  ambiguous.status === "AMBIGUOUS" &&
    ambiguous.candidateCaseIds.length === 2,
  `Duplicate active occupancy fails closed`
);

const current =
  resolveMateCaseReference({
    utterance:
      "his BP is now 90 over 50",
    cases,
    activeCaseId: "CASE-3",
    physicalCapacity: 20,
  });

expect(
  current.status === "CURRENT_CASE" &&
    current.caseId === "CASE-3",
  `Follow-up utterance remains on current patient`
);

const noReference =
  resolveMateCaseReference({
    utterance:
      "what are the causes of metabolic acidosis",
    cases,
    physicalCapacity: 20,
  });

expect(
  noReference.status === "NO_REFERENCE",
  `No patient context remains NO_REFERENCE`
);

const dischargedCurrent =
  resolveMateCaseReference({
    utterance: "update his vitals",
    cases,
    activeCaseId:
      "CASE-5-DISCHARGED",
    physicalCapacity: 20,
  });

expect(
  dischargedCurrent.status === "NO_REFERENCE",
  `Discharged case cannot silently remain current`
);


// ============================================================
// MATE BED-FAMILY TRAFFIC-POLICE CONTRACT
// ============================================================

const bedFamilyCases = [
  {
    id: "CASE-11A",
    bedNo: "11A",
    status: "Active",
  },
  {
    id: "CASE-12B",
    bedNo: "12B",
    status: "Active",
  },
  {
    id: "CASE-13A",
    bedNo: "13A",
    status: "Active",
  },
  {
    id: "CASE-13B",
    bedNo: "13B",
    status: "Active",
  },
  {
    id: "CASE-14-LEGACY",
    bedNo: "14",
    status: "Active",
  },
  {
    id: "CASE-15B",
    bedNo: "15B",
    status: "Active",
  },
] as ClinicalCase[];

const newBed11 = resolveMateCaseReference({
  utterance: "I have a new patient in bed 11, prepare a case sheet",
  cases: bedFamilyCases,
  physicalCapacity: 30,
  newCaseIntent: true,
});

expect(
  newBed11.status === "NOT_FOUND" &&
    newBed11.referenceValue === "11B",
  `New patient at bare Bed 11 uses free 11B when 11A is occupied`
);

const newEmptyBed10 = resolveMateCaseReference({
  utterance: "new patient in bed 10",
  cases: bedFamilyCases,
  physicalCapacity: 30,
  newCaseIntent: true,
});

expect(
  newEmptyBed10.status === "NOT_FOUND" &&
    newEmptyBed10.referenceValue === "10A",
  `New patient at empty bare Bed 10 gets 10A`
);

const newBed12 = resolveMateCaseReference({
  utterance: "new patient in bed 12",
  cases: bedFamilyCases,
  physicalCapacity: 30,
  newCaseIntent: true,
});

expect(
  newBed12.status === "NOT_FOUND" &&
    newBed12.referenceValue === "12A",
  `New patient at Bed 12 gets 12A when only 12B is occupied`
);

const fullBed13 = resolveMateCaseReference({
  utterance: "new patient in bed 13",
  cases: bedFamilyCases,
  physicalCapacity: 30,
  newCaseIntent: true,
});

expect(
  fullBed13.status === "AMBIGUOUS" &&
    fullBed13.candidateCaseIds.length === 2,
  `New patient at Bed 13 fails closed when 13A and 13B are occupied`
);

const explicitFree11B = resolveMateCaseReference({
  utterance: "new patient in bed 11B",
  cases: [],
  physicalCapacity: 30,
  newCaseIntent: true,
});

expect(
  explicitFree11B.status === "NOT_FOUND" &&
    explicitFree11B.referenceValue === "11B",
  `Explicit free Bed 11B is preserved for new patient`
);

const explicitOccupied11A = resolveMateCaseReference({
  utterance: "new patient in bed 11A",
  cases: bedFamilyCases,
  physicalCapacity: 30,
  newCaseIntent: true,
});

expect(
  explicitOccupied11A.status === "AMBIGUOUS" &&
    explicitOccupied11A.candidateCaseIds.includes("CASE-11A"),
  `Explicit occupied Bed 11A fails closed for new patient`
);

const reviewBed11 = resolveMateCaseReference({
  utterance: "review bed 11",
  cases: bedFamilyCases,
  physicalCapacity: 30,
});

expect(
  reviewBed11.status === "RESOLVED" &&
    reviewBed11.caseId === "CASE-11A",
  `Bare Bed 11 resolves to the sole active subdivision`
);

const reviewBed13 = resolveMateCaseReference({
  utterance: "review bed 13",
  cases: bedFamilyCases,
  physicalCapacity: 30,
});

expect(
  reviewBed13.status === "AMBIGUOUS" &&
    reviewBed13.candidateCaseIds.length === 2,
  `Bare Bed 13 fails closed when both subdivisions are occupied`
);

const explicitReview13B = resolveMateCaseReference({
  utterance: "review bed 13B",
  cases: bedFamilyCases,
  physicalCapacity: 30,
});

expect(
  explicitReview13B.status === "RESOLVED" &&
    explicitReview13B.caseId === "CASE-13B",
  `Explicit Bed 13B resolves exactly`
);

const legacyBed14Review = resolveMateCaseReference({
  utterance: "review bed 14",
  cases: bedFamilyCases,
  physicalCapacity: 30,
});

expect(
  legacyBed14Review.status === "RESOLVED" &&
    legacyBed14Review.caseId === "CASE-14-LEGACY",
  `Legacy plain Bed 14 remains resolvable`
);

const legacyBed14NewPatient = resolveMateCaseReference({
  utterance: "new patient in bed 14",
  cases: bedFamilyCases,
  physicalCapacity: 30,
  newCaseIntent: true,
});

expect(
  legacyBed14NewPatient.status === "NOT_FOUND" &&
    legacyBed14NewPatient.referenceValue === "14B",
  `Legacy plain Bed 14 occupies A-side for new allocation`
);

const onlyBReview = resolveMateCaseReference({
  utterance: "review bed 15",
  cases: bedFamilyCases,
  physicalCapacity: 30,
});

expect(
  onlyBReview.status === "RESOLVED" &&
    onlyBReview.caseId === "CASE-15B",
  `Bare Bed 15 resolves safely when only 15B is occupied`
);


console.log(
  "\n✅ MATE CANONICAL CASE RESOLVER CONTRACT PASSED\n"
);
