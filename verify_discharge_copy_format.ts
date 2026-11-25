/**
 * Discharge summary layout for print and Copy to EMR (25 Nov 2026, Neeraj: "all the fonts are of same size,
 * the heading should be bold ... doc just needs to take a printout or copy paste to EMR").
 */
import fs from "node:fs";
import { formatDischargeSummaryText, formatDischargeSummaryHtml, dischargeSummaryPlainForEmr } from "./src/utils/dischargeSummaryFormat";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const d: any = {
  patientName: "Mini A", patientAge: 59, patientGender: "Female", uhid: "U1", isMlc: "No", allergies: "NKDA",
  presentingComplaints: "Vomiting for 1 day", historyOfPresentIllness: "5 episodes since morning.\nNo blood.",
  courseInHospital: "The patient presented to the Emergency Department with the above-mentioned complaints.\n\nThe patient was treated with Inj. Emeset 4 mg IV.\n\nHence, the patient was discharged.",
  dischargeMedications: "1. Tab Emeset 4 mg SOS\n2. Tab Sompraz 40 mg 1-0-0 x 3 days",
  primaryDiagnosis: "Acute gastritis", dispositionStatus: "Expired", dischargeCondition: "", followUpPlan: "OPD <1 week>",
  dischargeDateTime: "25/11/2026", secondaryCvs: "S1 S2 heard",
};
const html = formatDischargeSummaryHtml(d);
t("EMR copy: section headings bold and a little larger", /<strong style="font-size:13\.5px">Course in Hospital with Medications and Procedure:<\/strong>/.test(html) && (html.match(/font-size:13\.5px/g) || []).length >= 15);
t("EMR copy: course paragraphs keep their breaks", /complaints\.<br\/><br\/>The patient was treated/.test(html));
t("EMR copy: medicines stay one per line", /1\. Tab Emeset 4 mg SOS<br\/>2\. Tab Sompraz/.test(html));
t("EMR copy: text is escaped", /OPD &lt;1 week&gt;/.test(html));
t("EMR copy: examination labels bold like the sheet", /<strong>CVS-<\/strong> S1 S2 heard/.test(html));
t("EMR copy: Admitted / Expired in the disposition list", /\[ \] Admitted<br\/>\[x\] Expired/.test(html));

const plain = dischargeSummaryPlainForEmr(formatDischargeSummaryText(d));
t("plain copy: headings on their own line in CAPITALS", /^COURSE IN HOSPITAL WITH MEDICATIONS AND PROCEDURE:$/m.test(plain) && /^PRESENTING COMPLAINTS:$/m.test(plain));
t("plain copy: inline labels stay normal case, no ** left", /PATIENT NAME: Mini A/.test(plain) && !/\*\*/.test(plain));
t("plain copy: Admitted / Expired listed", /\[x\] Expired/.test(plain));

const ds = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
t("sheet: headings bold and larger than the 12px text (screen and print)", (ds.match(/className="ds-h font-bold mt-5 text-\[13\.5px\] print:text-\[13px\] text-black"/g) || []).length === 15 && !/className="font-bold mt-4">/.test(ds));
t("copy button uses the plain-text helper", /dischargeSummaryPlainForEmr\(getFormattedDischargeSummaryText\(\)\)/.test(ds));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);