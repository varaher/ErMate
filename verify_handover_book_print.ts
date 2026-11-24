/**
 * Handover "Print as Book" v2 (24 Nov 2026): ErMate imposes the booklet itself — A5 pages, numbered,
 * two-up on A4 landscape in fold order — so it prints correctly without the printer's Booklet option,
 * with page numbers, and with an option to turn back sides for long-edge-only printers.
 */
import fs from "node:fs";
import { foldStackSheets, packPages, footerText, BOOKLET_CSS, MIN_FIT_SCALE } from "./src/utils/handoverBooklet.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const view = fs.readFileSync("src/components/HandoverView.tsx", "utf8");
const util = fs.readFileSync("src/utils/handoverBooklet.ts", "utf8");
const css = fs.readFileSync("src/index.css", "utf8");
const tours = fs.readFileSync("src/lib/coachTours.ts", "utf8");

// --- Fold-and-stack book (Neeraj, 24 Nov 2026): each sheet = 4 pages; folded sheets stacked in order
const f8 = foldStackSheets(8);
t("8 pages = 2 sheets", f8.length === 2);
t("sheet 1: front [4 | 1], back [2 | 3] (1-based)", JSON.stringify(f8[0]) === JSON.stringify({ front: [3, 0], back: [1, 2] }));
t("sheet 2: front [8 | 5], back [6 | 7] (1-based)", JSON.stringify(f8[1]) === JSON.stringify({ front: [7, 4], back: [5, 6] }));
const f5 = foldStackSheets(5);
t("5 pages: sheet 2 has page 5 as its cover, blanks only after it", f5.length === 2 && f5[1].front[1] === 4 && f5[1].front[0] === null && f5[1].back[0] === null && f5[1].back[1] === null);
// Reading order after folding each sheet: cover (front-right), inside-left (back-left), inside-right (back-right), outer back (front-left)
const readOrder = (n: number) => foldStackSheets(n).flatMap((s) => [s.front[1], s.back[0], s.back[1], s.front[0]]).filter((x) => x !== null);
for (const n of [1, 3, 4, 5, 8, 9, 14, 16]) {
  t(`${n} pages: folded sheets stacked read 1..${n} in order`, readOrder(n).join(",") === Array.from({ length: n }, (_, i) => i).join(","));
  const sheets = foldStackSheets(n);
  const nullsBeforeLast = sheets.slice(0, -1).flatMap((s) => [...s.front, ...s.back]).filter((x) => x === null).length;
  t(`${n} pages: no blank halves except on the last sheet`, nullsBeforeLast === 0);
}
t("folding geometry: inside-left page sits behind the cover (back-left = cover + 1)", foldStackSheets(12).every((s) => (s.back[0] ?? -1) === (s.front[1] as number) + 1 || s.back[0] === null));

t("an empty back side is not printed", /if \(sh\.back\[0\] != null \|\| sh\.back\[1\] != null\) root\.appendChild\(back\)/.test(util));

// --- Packing whole cards into A5 pages
const p1 = packPages([60, 60, 60, 60], 191, 20);
t("cards are kept whole and in order", p1.flat().map((i) => i.card).join(",") === "0,1,2,3");
t("first page reserves header space (2 cards), next page holds the rest", p1[0].length === 2 && p1[1].length === 2);
const p2 = packPages([210], 191, 0);
t("slightly long card is scaled to fit (not cut)", p2.length === 1 && p2[0][0].scale < 1 && p2[0][0].scale >= MIN_FIT_SCALE);
const p3 = packPages([500], 191, 0);
t("very long card is split across pages, never dropped", p3.length === 3 && p3.every((pg) => pg[0].card === 0 && pg[0].slice?.of === 3));
t("no card is lost", packPages([30, 250, 400, 10, 90], 191, 15).flat().reduce((set, i) => set.add(i.card), new Set<number>()).size === 5);

// --- Page numbers
t("footer has 'Page n of N' with date and shift", footerText({ hospitalLine: "", date: "19/10/2026", from: "Night Shift", to: "Morning Shift", time: "" }, 3, 8) === "Confidential handover · 19/10/2026 · Night Shift → Morning Shift · Page 3 of 8");

// --- Print CSS
t("prints A4 landscape with no margin (sheets carry their own margins)", /@page \{ size: A4 landscape; margin: 0; \}/.test(BOOKLET_CSS) && /@page :left \{ margin: 0; \}/.test(BOOKLET_CSS));
t("only the booklet prints (the rest of the app is hidden)", /body > \*:not\(#ermate-booklet-root\) \{ display: none !important; \}/.test(BOOKLET_CSS));
t("one sheet side per printed page", /\.eb-sheet \{ break-after: page; page-break-after: always; \}/.test(BOOKLET_CSS));
t("optional 180° turn of the back sides", /\.eb-sheet\.eb-rotated \{ transform: rotate\(180deg\); \}/.test(BOOKLET_CSS) && /opts\.rotateBack \? "eb-sheet eb-rotated"/.test(util));
t("no nested saddle-stitch or plain 2-up leftovers", !/paddedPageCount|bookletSheets|sequentialSides/.test(util));
t("print look: textareas replaced by their print mirrors, buttons removed", /querySelectorAll\("\.no-print, button, textarea, input, select/.test(util) && /print-mirror-div/.test(util));
t("cleanup after printing", /afterprint/.test(util) && /classList\.remove\("ermate-booklet-print"\)/.test(util));

// --- Wiring
t("Print as Book opens the booklet dialog", /if \(asBook\) \{ setBookletNotice\(null\); setShowBookletDialog\(true\); return; \}/.test(view));
t("dialog says: fold each sheet, stack in order, A4 landscape, flip on SHORT edge, no printer Booklet option, 100%", /Fold every sheet in half with its first page outside/.test(view) && /stack the folded sheets in order/.test(view) && /Flip on SHORT edge/.test(view) && /Landscape/.test(view) && /not<\/strong> choose the printer/.test(view) && /100% \/ Actual size/.test(view));
t("upside-down back option is remembered", /readRotateBack\(\)/.test(view) && /saveRotateBack\(bookletRotateBack\)/.test(view));
t("booklet uses the on-screen handover cards", /#landscape-handover-sheet-workspace \.print-page \.print-card/.test(view));
t("post-print clean-up prompt kept for both prints", /afterPrintCleanupPrompt\(\)/.test(view) && /const afterPrintCleanupPrompt[\s\S]{0,500}setShowPostPrintCleanPrompt\(true\)/.test(view));
t("Print as Book button next to the normal one", /id="print-handover-book-btn"/.test(view) && /handlePrintSheet\(true\)/.test(view) && /handlePrintSheet\(false\)/.test(view));
t("walkthrough tip for the booklet", /feature: "handover-booklet"/.test(tours) && /data-coach="handover-booklet"/.test(view));
t("normal print CSS unchanged (A4 portrait, binding margins)", /size: A4 portrait;\s*margin: 10mm 12mm;/.test(css) && /@page :left/.test(css));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);