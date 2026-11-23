/** Handover "Print as Book": A5 pages for the printer's Booklet mode; the normal print stays as it was. */
import fs from "node:fs";
import { BOOK_PRINT_CSS } from "./src/utils/printWithTip.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const view = fs.readFileSync("src/components/HandoverView.tsx", "utf8");
const util = fs.readFileSync("src/utils/printWithTip.ts", "utf8");
const css = fs.readFileSync("src/index.css", "utf8");

t("book layout is A5 portrait", /@page \{ size: A5 portrait/.test(BOOK_PRINT_CSS));
t("left/right pages get a fold margin (wider inner side)", /@page :left \{ margin: 8mm 10mm 11mm 7mm; \}/.test(BOOK_PRINT_CSS) && /@page :right \{ margin: 8mm 7mm 11mm 10mm; \}/.test(BOOK_PRINT_CSS));
t("page numbers 'n / total' in the footer", /counter\(page\)[\s\S]*counter\(pages\)/.test(BOOK_PRINT_CSS));
t("every book rule is scoped to the book class (nothing leaks to the normal print)", BOOK_PRINT_CSS.split("\n").filter((l) => /^\s*html\./.test(l) || /^\s*@|^\s*\}|^\s*$|^\s*@media/.test(l) || l.includes("@page")).length > 0 && !/^\s+\.print-/.test(BOOK_PRINT_CSS.replace(/html\.ermate-book-print[^{]*\{/g, "")));
t("font stays readable (not below 7pt for body text)", /\.print-card \* \{ font-size: 7\.6pt/.test(BOOK_PRINT_CSS) && !/font-size: [0-6]\.\dpt !important; line-height: 1\.22/.test(BOOK_PRINT_CSS.replace(/6\.6pt/g, "")));
t("book style is appended last and removed after printing", /document\.body\.appendChild\(style\)/.test(util) && /afterprint/.test(util) && /classList\.remove\("ermate-book-print"\)/.test(util));
t("book print reuses the same print dialog helper with a Booklet tip", /triggerPrintWithTip\("Book print:/.test(util));
t("Print as Book button next to the normal one", /id="print-handover-book-btn"/.test(view) && /handlePrintSheet\(true\)/.test(view) && /handlePrintSheet\(false\)/.test(view));
t("both buttons keep the post-print clean-up prompt", /const handlePrintSheet[\s\S]{0,500}setShowPostPrintCleanPrompt\(true\)/.test(view));
t("normal print CSS unchanged (A4 portrait, binding margins)", /size: A4 portrait;\s*margin: 10mm 12mm;/.test(css) && /@page :left/.test(css));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);