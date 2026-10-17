// MARKER: ERMATE-COPY-TO-EMR-V1
import { readFileSync } from "fs";
let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };
const cs = readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
const ds = readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
const cb = readFileSync("src/utils/copyToClipboard.ts", "utf8");

check("helper exports copyTextToClipboard", /export async function copyTextToClipboard/.test(cb));
check("helper has rich ClipboardItem path", cb.includes("new ClipboardItem") && cb.includes('"text/html"'));
check("helper has writeText fallback", cb.includes("navigator.clipboard.writeText"));
check("helper has execCommand fallback", cb.includes('execCommand("copy")'));
check("helper returns false on total failure", /return false;\s*\n\s*}\s*\n}/.test(cb));
check("case sheet imports helper", cs.includes('from "../utils/copyToClipboard"'));
check("discharge imports helper", ds.includes('from "../utils/copyToClipboard"'));
check("case sheet handler awaits helper", /handleCopyCaseSheet = async[\s\S]*?await copyTextToClipboard\(formatCaseSheetText\(data\)\)/.test(cs));
check("discharge handler awaits helper with html", /handleCopyDischargeSummary = async[\s\S]*?await copyTextToClipboard\(plainText, htmlText\)/.test(ds));
check("case sheet: 2 buttons labelled Copy to EMR", (cs.match(/"Copy to EMR"/g) || []).length === 2);
check("case sheet: old 'Copy Case Sheet' label gone", !cs.includes('"Copy Case Sheet"'));
check("case sheet: preview + print button ids kept", cs.includes('id="preview-copy-casesheet-button"') && cs.includes('id="print-copy-casesheet-button"'));
check("case sheet: failure state shown", cs.includes("Copy failed"));
check("discharge: Copy to EMR has id", ds.includes('id="copy-to-emr-discharge"'));
check("discharge: failure state shown", ds.includes("Copy failed"));
check("discharge: Copy to EMR precedes Delete/Discuss in toolbar", ds.indexOf('id="copy-to-emr-discharge"') < ds.indexOf("Discuss Discharge", ds.indexOf('id="copy-to-emr-discharge"') - 10));
check("discharge: toolbar group wraps", ds.includes('flex flex-wrap gap-2 w-full sm:w-auto'));
check("discharge: copy still before print (copy-first)", ds.indexOf('id="copy-to-emr-discharge"') < ds.indexOf('id="print-btn-discharge"'));
console.log(`\nCopy to EMR: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
