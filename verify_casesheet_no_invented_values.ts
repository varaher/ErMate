import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log("=== Running verify_casesheet_no_invented_values.ts ===");

const caseSheetViewPath = path.resolve(process.cwd(), "src/components/CaseSheetView.tsx");
assert(fs.existsSync(caseSheetViewPath), "CaseSheetView.tsx exists");
const code = fs.readFileSync(caseSheetViewPath, "utf8");

// Test 1: SECTION_NORMALS.primarySurvey has no invented vitals
console.log("\n[Test 1] SECTION_NORMALS.primarySurvey honesty");
assert(!code.includes("breathing: 'RR 16/min. SpO₂ 98% on room air"), "SECTION_NORMALS does not contain 'RR 16/min. SpO₂ 98%'");
assert(!code.includes("HR 80/min regular. BP 120/80 mmHg"), "SECTION_NORMALS does not contain 'HR 80/min regular. BP 120/80 mmHg'");
assert(!code.includes("GCS 15/15 (E4V5M6). Pupils 3mm"), "SECTION_NORMALS does not contain 'GCS 15/15 (E4V5M6). Pupils 3mm'");
assert(code.includes("breathing: 'Work of breathing normal. Air entry bilaterally equal.'"), "SECTION_NORMALS breathing is purely physical examination finding");
assert(code.includes("circulation: 'CRT < 2 seconds. Pulse regular. Peripheral pulses normal. Warm peripheries.'"), "SECTION_NORMALS circulation is purely physical examination finding");
assert(code.includes("disability: 'Alert. Pupils bilaterally equal and reactive to light.'"), "SECTION_NORMALS disability is alert mental status without invented GCS numbers");

// Test 2: handleSurveyChange BP construction requires both sbp and dbp
console.log("\n[Test 2] Blood Pressure construction in handleSurveyChange");
assert(code.includes("if (sbp && dbp) newVitals.bp = `${sbp}/${dbp}`;"), "BP requires both sbp and dbp; no fallback 120 or 80");
assert(!code.includes("newVitals.bp = `${sbp || '120'}/${dbp || '80'}`;"), "No fallback to 120/80 in handleSurveyChange");

// Test 3: handleSurveyChange narrative does not invent vitals
console.log("\n[Test 3] Primary assessment narratives do not invent vitals");
assert(!code.includes("breathing.rr || '16'"), "No fallback '16' for breathing.rr");
assert(!code.includes("breathing.spo2 || '98'"), "No fallback '98' for breathing.spo2");
assert(!code.includes("circulation.hr || '80'"), "No fallback '80' for circulation.hr");
assert(!code.includes("circulation.sbp || '120'"), "No fallback '120' for circulation.sbp");
assert(!code.includes("disability.gcsTotal || '15'"), "No fallback '15' for disability.gcsTotal");
assert(!code.includes("exposure.temp || '37.0'"), "No fallback '37.0' for exposure.temp");

// Test 4: Dynamic narrative fallback labels
console.log("\n[Test 4] Primary assessment narrative fallback labels");
assert(code.includes("|| 'Breathing assessed'"), "Breathing narrative defaults to 'Breathing assessed' when no params recorded");
assert(code.includes("|| 'Circulation assessed'"), "Circulation narrative defaults to 'Circulation assessed' when no params recorded");
assert(code.includes("|| 'Disability assessed'"), "Disability narrative defaults to 'Disability assessed' when no params recorded");
assert(code.includes("|| 'Exposure assessed'"), "Exposure narrative defaults to 'Exposure assessed' when no params recorded");

// Test 5: markPrimarySurveyNormal does not inject fake vitals
console.log("\n[Test 5] markPrimarySurveyNormal does not inject fake vitals");
assert(!code.includes('{ rr: "16", spo2: "98", hr: "80", bp: "120/80", gcs: "15", temp: "37.0" }'), "markPrimarySurveyNormal does not inject hardcoded vitals bundle");

// Test 6: Behavioral logic test for narrative builders
console.log("\n[Test 6] Behavioral simulation of narrative generation");
function buildBreathingNarrative(breathing: any): string {
  return [
    breathing.rr ? `RR: ${breathing.rr}/min` : null,
    breathing.spo2 ? `SpO2: ${breathing.spo2}%${breathing.o2Delivery ? ` on ${breathing.o2Delivery}` : ''}` : null,
    breathing.workOfBreathing ? `Work: ${breathing.workOfBreathing}` : null,
    breathing.airEntry ? `Air Entry: ${breathing.airEntry}` : null,
    breathing.addedSounds ? `Sounds: ${breathing.addedSounds}` : null,
  ].filter(Boolean).join(', ') || 'Breathing assessed';
}

function buildCirculationNarrative(circulation: any): string {
  return [
    circulation.hr ? `HR: ${circulation.hr}/min` : null,
    circulation.rhythm ? `Rhythm: ${circulation.rhythm}` : null,
    (circulation.sbp && circulation.dbp) ? `BP: ${circulation.sbp}/${circulation.dbp} mmHg` : null,
    circulation.crt ? `CRT: ${circulation.crt}` : null,
    circulation.peripheralPulses ? `Pulses: ${circulation.peripheralPulses}` : null,
    circulation.skinPerfusion ? `Skin: ${circulation.skinPerfusion}` : null,
  ].filter(Boolean).join(', ') || 'Circulation assessed';
}

assert(buildBreathingNarrative({}) === 'Breathing assessed', "Empty breathing survey resolves to 'Breathing assessed'");
assert(
  buildBreathingNarrative({ rr: "22", spo2: "94" }) === "RR: 22/min, SpO2: 94%",
  "Recorded breathing vitals format accurately without inventing air entry or breath sounds"
);
assert(buildCirculationNarrative({}) === 'Circulation assessed', "Empty circulation survey resolves to 'Circulation assessed'");
assert(
  buildCirculationNarrative({ sbp: "110" }) === 'Circulation assessed',
  "Single sbp without dbp does not produce a broken or invented BP string"
);
assert(
  buildCirculationNarrative({ hr: "105", sbp: "110", dbp: "70" }) === "HR: 105/min, BP: 110/70 mmHg",
  "Both sbp and dbp yield properly formatted BP"
);

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
