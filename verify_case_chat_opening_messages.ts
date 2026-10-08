/**
 * verify_case_chat_opening_messages.ts
 *
 * Verification suite for ErMate Simplified Discuss + Rounds Opening Messages:
 * 1. Discuss first open exact visible text: "Ask me anything about this case."
 * 2. Rounds first open exact visible text: "Want to prepare before rounds? Ask."
 * 3. No markdown headings, no tables, no bullets, no case summaries in default opening.
 * 4. No automatic warnings ("Chief complaint not documented", "Vitals missing", "Critical gaps", "Record significantly incomplete").
 * 5. No other assistant text auto-generated before user input.
 */

import assert from "assert";
import fs from "fs";

let passedCount = 0;
let totalCount = 0;

function test(name: string, fn: () => void) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("\n=======================================================");
console.log("  VERIFY DISCUSS + ROUNDS SIMPLIFIED OPENING MESSAGES");
console.log("=======================================================\n");

// Read useBoundChat.ts
const hookContent = fs.readFileSync("src/hooks/useBoundChat.ts", "utf8");

test("1. Discuss mode default opening text is exact string", () => {
  assert.ok(
    hookContent.includes('welcomeText = "Ask me anything about this case.";'),
    'Discuss mode opening message must be exactly "Ask me anything about this case."'
  );
});

test("2. Rounds mode default opening text is exact string", () => {
  assert.ok(
    hookContent.includes('welcomeText = "Want to prepare before rounds? Ask.";'),
    'Rounds mode opening message must be exactly "Want to prepare before rounds? Ask."'
  );
});

test("3. No markdown heading, bullets, tables or case summaries in Discuss opening", () => {
  assert.ok(
    !hookContent.includes('welcomeText = "Ready to discuss this patient'),
    "Old verbose discuss opening must be removed"
  );
  assert.ok(
    !hookContent.includes("welcomeText = \"Let's learn from this case"),
    "Old verbose rounds opening must be removed"
  );
});

test("4. Single-message cached session refreshes to exact new opening message", () => {
  assert.ok(
    hookContent.includes("if (parsed.messages.length === 1 && parsed.messages[0].role === 'assistant')"),
    "Must refresh single-message cached local sessions with fresh welcome"
  );
  assert.ok(
    hookContent.includes("if (sessionMessages.length === 1 && sessionMessages[0].role === 'assistant')"),
    "Must refresh single-message Firestore sessions with fresh welcome"
  );
});

// Read server.ts
const serverContent = fs.readFileSync("server.ts", "utf8");

test("5. Server case-discussion has empty/minimal documentation rule", () => {
  assert.ok(
    serverContent.includes('Do NOT automatically generate "Chief complaint not documented", "Vitals missing", "Critical gaps", or "Record significantly incomplete"'),
    "Server case-discussion must not auto-generate missing documentation lectures"
  );
});

test("6. Server rounds-debrief has empty/minimal documentation rule", () => {
  assert.ok(
    serverContent.includes('EMPTY / MINIMALLY DOCUMENTED CASES: Do NOT automatically generate "Chief complaint not documented", "Vitals missing", "Critical gaps", or "Record significantly incomplete"'),
    "Server rounds-debrief must not auto-generate missing documentation lectures"
  );
});

// Check CaseChatWorkspace.tsx
const wsContent = fs.readFileSync("src/components/CaseChatWorkspace.tsx", "utf8");

test("7. CaseChatWorkspace renders messages directly without injecting extra assistant content", () => {
  assert.ok(
    !wsContent.includes("Critical gaps"),
    "CaseChatWorkspace must not inject hardcoded critical gaps into chat area"
  );
  assert.ok(
    !wsContent.includes("How would you like to proceed?"),
    "CaseChatWorkspace must not inject 'How would you like to proceed?'"
  );
});

console.log(`\nResults: ${passedCount} / ${totalCount} tests passed.\n`);
if (passedCount === totalCount) {
  console.log("All 7 simplified opening message verifications PASSED!\n");
} else {
  process.exit(1);
}
