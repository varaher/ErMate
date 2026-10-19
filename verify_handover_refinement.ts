import assert from "node:assert/strict";
import fs from "node:fs";

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log("  ok", n); };
const read = (p: string) => fs.readFileSync(p, "utf8");
const hv = read("src/components/HandoverView.tsx");
const hs = read("server/handover.ts");
const css = read("src/styles/handover.css");

// --- Server: AI synthesis must not truncate or call retired models
t("Claude handover call allows a full-size JSON reply", () => {
  const m = hs.match(/max_tokens:\s*(\d+)/);
  assert.ok(m && Number(m[1]) >= 8192, "max_tokens must be >= 8192");
});
t("a truncated Claude reply moves to the next model instead of being parsed", () => {
  assert.ok(/stop_reason\s*===\s*'max_tokens'/.test(hs));
});
t("no retired Gemini 1.5 Pro id anywhere in server code", () => {
  for (const f of ["server/handover.ts", "server/mortalityAudit.ts", "server.ts"]) {
    assert.ok(!/gemini-1\.5-pro/.test(read(f)), f);
  }
});
t("Gemini Pro fallback is still Pro-tier, never Flash", () => {
  const m = hs.match(/GEMINI_PRO:\s*'([^']+)'/);
  assert.ok(m && /pro/.test(m[1]) && !/flash/i.test(m[1]));
});

// --- Client: honest quick-paste card
const vitalsRe = /^\s*(?:not\s+documented|n\/?a|nil|-+)\s*$/i;
t("placeholder vitals are not treated as recorded vitals", () => {
  assert.ok(hv.includes("qpVitalsReal"));
  for (const v of ["Not documented", "not documented ", "N/A", "nil", "--"]) assert.ok(vitalsRe.test(v), v);
  for (const v of ["HR 98 | BP 120/80", "Temp: 97°F"]) assert.ok(!vitalsRe.test(v), v);
  assert.ok(!/doneItems\.push\(`✓ Vitals: \$\{qp\.vitals\}`\)/.test(hv));
});
t("presenting complaint is never printed as the provisional diagnosis", () => {
  assert.ok(!/`PROVISIONAL DIAGNOSIS: \$\{sit\}/.test(hv));
  assert.ok(hv.includes('dxText || "Not yet documented"'));
});
t("internal quick-paste id is not shown as an ER number", () => {
  assert.ok(!/ER# \$\{qp\.id\.substring/.test(hv));
});

// --- Print layout
t("tall patient cards may break across pages (no blank first page)", () => {
  assert.ok(!/\.hov-card,\s*\n?\s*\.print-card\s*\{/.test(css), "combined avoid rule removed");
  const m = css.match(/\.print-card\s*\{([^}]*)\}/);
  assert.ok(m && /break-inside:\s*auto/.test(m[1]));
});
console.log(`PASS ${pass}`);
