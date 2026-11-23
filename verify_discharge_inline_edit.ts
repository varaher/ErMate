/** Discharge summary: edit on the sheet, and the age text in print/copy. */
import fs from "node:fs";
import { formatDischargeSummaryText, formatDischargeSummaryHtml } from "./src/utils/dischargeSummaryFormat.ts";
import { blockTextToFreeValue, blockTextToValue } from "./src/components/InlineEdit.tsx";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const view = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");

// every tagged place has a setter
const keys = new Set([...view.matchAll(/<D[FB] k="(\w+)"/g)].map((m) => m[1]));
const setterBlock = view.slice(view.indexOf("const setters: Record"), view.indexOf("const set = setters[key]"));
const missing = [...keys].filter((k) => !new RegExp(`\\b${k}: set`).test(setterBlock));
t(`every tagged place has a setter (${keys.size} fields)${missing.length ? " missing " + missing : ""}`, keys.size >= 45 && missing.length === 0);

// wiring
t("provider wraps the view", /<InlineEditCtx\.Provider value=\{\{ editing: inlineOn, onEdit: inlineOn \? applyInline : undefined \}\}>/.test(view));
t("Edit switch exists and is off by default", /const \[inlineOn, setInlineOn\] = useState\(false\)/.test(view) && /Done editing/.test(view));
t("cues only while editing", /\$\{inlineOn \? " ie-on" : ""\}/.test(view));
t("an edit marks the summary as manually edited and unsaved", /setIsManuallyEdited\(true\);[\s\S]{0,120}MANUALLY_EDITED[\s\S]{0,60}setEditedNotSaved\(true\)/.test(view));
t("typed course is protected from the live-course merge", /key === "courseInHospital"\) courseTextRef\.current = value/.test(view));
t("nothing saves by itself (no save call inside applyInline)", !/onSaveDischarge|handleSave/.test(view.slice(view.indexOf("const applyInline"), view.indexOf("const handleApplyPreviewDischargeAction"))));
t("diagnoses print on two lines like the copy text", /DF k="secondaryDiagnosis"/.test(view) && !/` ; \$\{secondaryDiagnosis\}`/.test(view));

// free-text commit keeps the doctor's own marks
t("free text keeps '-' marks and blank lines", blockTextToFreeValue("- a\n\n- b  \n") === "- a\n\n- b");
t("list fields still strip marks (adult sheet unchanged)", blockTextToValue("- a\n\n- b") === "a\nb");

// age text
const base: any = { patientName: "A", patientGender: "Male", uhid: "", isMlc: "No", mlcNo: "", allergies: "" };
const mk = (age: any) => formatDischargeSummaryText({ ...base, patientAge: age } as any);
t("adult number still prints 'N Years'", /AGE \/ GENDER:\*\* 45 Years \/ Male/.test(mk(45)));
t("infant text is printed as given, not as years", /AGE \/ GENDER:\*\* 6 months \/ Male/.test(mk("6 months")) && /14 days/.test(mk("14 days")));
t("missing age stays 'Not documented'", /AGE \/ GENDER:\*\* Not documented/.test(mk("")));
t("html copy follows the same rule", /6 months \/ Male/.test(formatDischargeSummaryHtml({ ...base, patientAge: "6 months" } as any)));
t("view passes months/days for infants", /formatAgeLong\(currentCase\.patient\.age, currentCase\.patient\.ageMonths, \(currentCase\.patient as any\)\.ageDays\)/.test(view));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);