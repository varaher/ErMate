/**
 * verify_manual_no_diagnosis_generator.ts
 * MARKER: ERMATE-MANUAL-NO-DX-GENERATOR-V1
 * The manual case sheet (Investigations tab) must not offer an AI "Generate Differential" action.
 * Diagnosis fields stay manual; differentials already on the case stay visible; MATE owns discussion.
 */
import fs from "fs";

let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };

const cs = fs.readFileSync("./src/components/CaseSheetView.tsx", "utf8");
const menu = fs.readFileSync("./src/components/NewPatientEntryMenu.tsx", "utf8");
const guide = fs.readFileSync("./src/data/guide.ts", "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");
const csCode = strip(cs);

// Generator gone
check(!/Generate Differential/i.test(csCode), "no 'Generate Differential' button text in CaseSheetView");
check(!/runClinicalDecisionSupport/.test(csCode), "runClinicalDecisionSupport handler removed");
check(!/clinical-decision-support/.test(csCode), "CaseSheetView no longer calls /api/clinical-decision-support");
check(!/ErMate Differential & Clinical Decision Support/.test(csCode), "old CDS heading removed");
check(!/Analyzing Records/.test(csCode), "old 'Analyzing Records...' loading label removed");

// Manual diagnosis entry stays
check(/Provisional Primary Diagnosis/.test(cs) && /provisionalPrimaryDiagnosis: e\.target\.value/.test(cs), "Provisional Primary Diagnosis textarea still editable");
check(/Provisional Differential Diagnoses/.test(cs) && /provisionalDifferentialDiagnoses: e\.target\.value/.test(cs), "Provisional Differential Diagnoses textarea still editable");
check(/Diagnosis \/ Interpretation/.test(cs), "Diagnosis / Interpretation section kept");

// Differentials already on the case stay visible, only when present
check(/Differentials on record/.test(cs), "'Differentials on record' list kept for saved/dictated differentials");
check(/currentCase\.differentials && currentCase\.differentials\.length > 0 \?/.test(cs), "differentials list is conditional on data");
check(/currentCase\.differentials\.map\(\(diff, index\)/.test(cs), "differentials still rendered from case data");

// Other uses of aiLoading (OCR) intact
check(/handleOcrSubmit/.test(cs) && /Run OCR & Map Fields/.test(cs), "OCR flow unaffected");

// Copy no longer promises the feature
check(!/AI diagnosis/i.test(menu), "entry menu no longer advertises 'AI diagnosis' for the manual form");
check(/Manual form — all fields, ABG analysis/.test(menu), "entry menu subtitle updated");
check(!/Generate Differentials/.test(guide), "help guide no longer tells users to tap Generate Differentials");

// No other client path triggers CDS
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
const callers = walk("./src").filter((f) => /\.(ts|tsx)$/.test(f) && fs.readFileSync(f, "utf8").includes("/api/clinical-decision-support"));
check(callers.length === 0, `no src file calls /api/clinical-decision-support (${callers.join(",") || "none"})`);

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log("\nAll manual-entry diagnosis-generator removal checks passed.");
