import fs from "fs";
import { buildLogbookEntryFromCase, shouldSyncCaseToUserLogbook } from "./src/utils/logbookSync";

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${description}`);
    failed++;
  }
}

console.log("--- TEST SUITE: Logbook Synchronization & Security Verification ---");

// 1. Blueprint schema verification
const blueprint = JSON.parse(fs.readFileSync("./firebase-blueprint.json", "utf-8"));
assert("Blueprint defines LogbookEntry entity", !!blueprint.entities?.LogbookEntry);
assert("Blueprint defines /users/{userId}/logbook/{entryId} path", !!blueprint.firestore?.["/users/{userId}/logbook/{entryId}"]);
assert("Blueprint path references LogbookEntry", blueprint.firestore?.["/users/{userId}/logbook/{entryId}"]?.schema === "LogbookEntry");

// 2. firestore.rules verification
const rules = fs.readFileSync("./firestore.rules", "utf-8");
assert("firestore.rules contains logbook subcollection match", rules.includes("match /logbook/{entryId}"));
assert("firestore.rules allows create for logged in owner", rules.includes("allow create: if isLoggedIn() && isOwner(userId)"));
assert("firestore.rules allows update for logged in owner", rules.includes("allow update: if isLoggedIn() && isOwner(userId)"));
assert("firestore.rules allows read, delete for logged in owner", rules.includes("allow read, delete: if isLoggedIn() && isOwner(userId)"));
assert("firestore.rules enforces isValidId on entryId", rules.includes("isValidId(entryId)"));
assert("firestore.rules enforces ownerUid matching userId", rules.includes("incoming().get('ownerUid', '') == userId"));

// 3. buildLogbookEntryFromCase testing
const mockAdultCase: any = {
  id: "case-123",
  patient: { name: "John Doe", age: 45, gender: "male" },
  vitals: { triageCategory: "Priority 2 (Yellow)" },
  proceduresChecked: ["IV Cannulation", "12-Lead ECG"],
  dateSeen: "2026-10-20",
  createdAt: "2026-10-20T10:00:00.000Z",
  workspaceType: "hospital",
  hospitalId: "hosp-alpha",
  hospitalName: "Metro Emergency Hospital",
  doctorEmail: "doctor@test.com",
  createdByUid: "doc-uid-1"
};

const adultEntry = buildLogbookEntryFromCase(mockAdultCase, "doc-uid-1");
assert("Entry has correct composite entryId", adultEntry.entryId === "doc-uid-1_case-123");
assert("Entry has correct ownerUid", adultEntry.ownerUid === "doc-uid-1");
assert("Entry has correct sourceCaseId", adultEntry.sourceCaseId === "case-123");
assert("Entry classifies age 45 as adult", adultEntry.ageGroup === "adult");
assert("Entry captures procedures performed", adultEntry.proceduresPerformed?.length === 2 && adultEntry.proceduresPerformed[0] === "IV Cannulation");
assert("Entry captures triage category", adultEntry.triageCategory === "Priority 2 (Yellow)");
assert("Entry captures hospital metadata", adultEntry.hospitalNameAtTime === "Metro Emergency Hospital");

// 4. Pediatric case classification
const mockPedsCase: any = {
  id: "case-peds-456",
  patient: { name: "Baby Jane", age: "6 months", gender: "female" },
  vitals: { triageCategory: "Priority 1 (Red)" },
  procedures: ["Bag-Valve-Mask Ventilation"],
  createdAt: "2026-10-20T11:00:00.000Z",
  workspaceType: "hospital",
  createdByUid: "doc-uid-1"
};

const pedsEntry = buildLogbookEntryFromCase(mockPedsCase, "doc-uid-1");
assert("Entry classifies 6 months as pediatric", pedsEntry.ageGroup === "pediatric");
assert("Entry captures procedures from procedures array", pedsEntry.proceduresPerformed?.includes("Bag-Valve-Mask Ventilation") === true);

// 5. Attribution logic testing
assert("shouldSyncCaseToUserLogbook returns true if createdByUid matches", shouldSyncCaseToUserLogbook(mockAdultCase, "doc-uid-1", "doctor@test.com"));
assert("shouldSyncCaseToUserLogbook returns true if doctorEmail matches", shouldSyncCaseToUserLogbook({ id: "case-x", doctorEmail: "doc@domain.com" }, "doc-other", "doc@domain.com"));

// 6. Server route graceful error handling check
const logbookRouteCode = fs.readFileSync("./server/routes/logbook.routes.ts", "utf-8");
assert("server logbook route handles permission error gracefully", logbookRouteCode.includes("isPermissionOrAuthError"));
assert("server logbook route returns client_sync_fallback status", logbookRouteCode.includes("client_sync_fallback"));
assert("server logbook route does not output fatal error for missing Admin credentials", !logbookRouteCode.includes('console.error("Logbook sync error:", error)'));

// 7. App.tsx direct sync wiring check
const appCode = fs.readFileSync("./src/App.tsx", "utf-8");
assert("App.tsx imports syncCaseToLogbookDirect", appCode.includes("syncCaseToLogbookDirect"));
assert("App.tsx calls syncCaseToLogbookDirect in case save handler", appCode.includes("syncCaseToLogbookDirect(caseToSave"));
assert("App.tsx calls syncCaseToLogbookDirect in review handler", appCode.includes("syncCaseToLogbookDirect(finalSavedCase"));

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All logbook synchronization and security tests passed!");
}
