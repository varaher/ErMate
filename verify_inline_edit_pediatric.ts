/**
 * Pediatric sheet + shared edit base: every place tagged in the print view must map to a real field in
 * src/lib/previewedit.ts, the pediatric sheet must use the same Edit switch as the adult sheet, and the
 * shared pieces (context, EdText, EdBlock) must exist for ICU / OPD sheets to reuse.
 */
import fs from "node:fs";
import { EDIT_SECTIONS } from "./src/lib/previewedit.ts";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const view = fs.readFileSync("src/components/CaseSheetPrintView.tsx", "utf8");
const base = fs.readFileSync("src/components/InlineEdit.tsx", "utf8");

// 1. every s="..." k="..." (JSX tags) points at a real field
const tags = [...view.matchAll(/<(?:EdText|EdBlock)\s+s=(?:"([^"]+)"|\{(\w+)\})\s+k="([^"]+)"/g)];
ok("pediatric tags found (" + tags.length + ")", tags.length >= 14);
const consts: Record<string, string> = {};
for (const m of view.matchAll(/const (\w+) = "([^"]+)";/g)) consts[m[1]] = m[2];
let bad: string[] = [];
for (const m of tags) {
  const section = m[1] ?? consts[m[2]];
  const key = m[3];
  if (!section || !(EDIT_SECTIONS[section] || []).some((f) => f.key === key)) bad.push(`${section}/${key}`);
}
ok("every tagged place maps to a previewedit field " + (bad.length ? JSON.stringify(bad) : ""), bad.length === 0);
const dyn = [...view.matchAll(/<EdText s=\{editSection\} k=\{r\.key\}/g)].length;
ok("exam rows use the section title as field section", dyn === 1);
for (const k of ["general", "cvs", "respiratory", "abdomen", "cns", "extremities"]) ok("Focused Physical Examination has " + k, EDIT_SECTIONS["Focused Physical Examination"].some((f) => f.key === k));

// 2. wiring: pediatric uses the same Edit switch
ok("inline edit no longer excludes pediatric", /const inlineEdit = Boolean\(canEditPreview && data && !applySuccess\)/.test(view));
ok("context provider wraps the sheet", /<InlineEditCtx\.Provider value=\{\{ editing: ieNow, onEdit: ieNow \? commitInlineEdit : undefined \}\}>/.test(view) && /<\/InlineEditCtx\.Provider>/.test(view));
ok("pediatric body gets the cue class only while editing", /ieNow && data\.isPediatric \? " ie-on" : ""/.test(view));
ok("section components read the shared context", (view.match(/React\.useContext\(InlineEditCtx\)/g) || []).length >= 3);

// 3. shared base for every sheet type
ok("base exports context + EdText + EdBlock", /export const InlineEditCtx/.test(base) && /export function EdText/.test(base) && /export function EdBlock/.test(base));
ok("outside edit mode the base prints the plain text", /if \(!editing \|\| !onEdit \|\| !s\) return/.test(base));

// 4. print safety: cues hidden in print (shared CSS)
ok("print CSS hides cues", /@media print[\s\S]*\.ie-on \[data-testid="inline-edit-view"\]/.test(base));

// 5. nothing writes outside the draft: commit goes through applySectionEdits
ok("commit uses applySectionEdits on the draft", /applySectionEdits\(shownCase, data, section, \{ \[key\]: value \}\)/.test(view));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);