// PEDS_CALC_MOBILE_LAYOUT_V1
import fs from "fs";
let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { ok ? pass++ : (fail++, console.log("FAIL:", n)); };
const src = fs.readFileSync("src/components/PediatricDrugCalculatorView.tsx", "utf8");
const i = src.indexOf('data-testid="calc-dose-block"');
const block = src.slice(i, i + 1800);

t("dose block stacks on phones (flex-col) and rows from sm up", /flex-col/.test(block) && /sm:flex-row/.test(block));
t("breakdown column can shrink and wraps long words", /min-w-0 flex-1/.test(block) && /break-words/.test(block));
t("dose badge wraps instead of overflowing", /data-testid="calc-dose-badge"[^>]*whitespace-normal[^>]*break-words|data-testid="calc-dose-badge"[^>]*break-words[^>]*whitespace-normal/.test(block) && /max-w-full/.test(block));
t("badge no longer forced to shrink-0 on phones", !/shrink-0 text-right/.test(block));
t("page container never scrolls sideways", /overflow-x-hidden" id="pediatric-calculator-container"/.test(src));
t("calculated dose label is a block (no letter-by-letter wrap)", /block text-\[9px\][^"]*">Calculated Dose/.test(block));
console.log(`pass ${pass} fail ${fail}`);
process.exit(fail ? 1 : 0);
