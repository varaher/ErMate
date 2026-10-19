import assert from "node:assert/strict";
import fs from "node:fs";
import { sanitizeForFirestore } from "./src/utils/firestoreSanitizer.ts";

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log("  ok", n); };

t("shared (non-circular) reference is preserved everywhere", () => {
  const v = { hr: 110, bp: "90/60" };
  const out: any = sanitizeForFirestore({ vitals: v, pediatricDetails: { vitals: v }, arr: [v, v] });
  assert.deepEqual(out.vitals, v);
  assert.deepEqual(out.pediatricDetails.vitals, v);
  assert.deepEqual(out.arr, [v, v]);
});
t("true cycle is still cut to null, no infinite loop", () => {
  const a: any = { n: 1 }; a.self = a;
  const out: any = sanitizeForFirestore(a);
  assert.equal(out.n, 1);
  assert.equal(out.self, null);
});
t("undefined keys dropped, null/false/0/'' kept", () => {
  const out: any = sanitizeForFirestore({ a: undefined, b: null, c: false, d: 0, e: "" });
  assert.deepEqual(out, { b: null, c: false, d: 0, e: "" });
});
t("Dates and arrays pass through", () => {
  const d = new Date(0);
  const out: any = sanitizeForFirestore({ d, l: [1, { x: undefined, y: 2 }] });
  assert.equal(out.d, d);
  assert.deepEqual(out.l, [1, { y: 2 }]);
});

t("case-sheet export uses the patient's own address", () => {
  const s = fs.readFileSync("src/components/CaseSheetView.tsx", "utf8");
  assert.equal((s.match(/currentCase\.patient\.address \|\| "Not Provided"/g) || []).length, 2);
});
t("handover header has no hospital fallback literal", () => {
  const s = fs.readFileSync("src/components/HandoverView.tsx", "utf8");
  assert.ok(!/hospitalName \|\| "[A-Z ]*HOSPITAL"/.test(s));
});
console.log(`PASS ${pass}`);
