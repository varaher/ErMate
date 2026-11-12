import { formatCaseSheetText } from "./src/utils/caseSheetFormat";
let fails = 0;
const t = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}`); if (!c) fails++; };
const data: any = {
  hospitalName: "Rajagiri Emergency", caseId: "261112002", clinician: "Dr. JOHN THOMAS", triageCategory: "P2", caseType: "Medical",
  patient: { name: "Leelamma", age: 76, sex: "F", uhid: "26111274", bed: null, weight: null },
  arrival: { date: "12 Nov 2026", time: "08:39" }, presentingComplaint: "Acute left facial deviation since 10 AM",
  primarySurvey: { airway: "Patent", vitalsContext: {} }, notes: {}, disposition: {},
};
const emr = formatCaseSheetText(data, { forEmr: true });
const lines = emr.split("\n");
t("line 1 is the initial assessment title", lines[0] === "INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD");
t("line 2 is CASE SEEN BY with date and time", lines[1] === "CASE SEEN BY Dr JOHN THOMAS on 12/11/2026 at 8.39am");
t("no patient name, UHID, case ID or hospital name", !/Leelamma|26111274|261112002|Rajagiri/.test(emr));
t("no Patient Details block", !/PATIENT DETAILS/.test(emr));
t("clinical content is kept", /PRESENTING COMPLAINT/.test(emr) && /Airway: Patent/.test(emr));
t("evening time reads pm", formatCaseSheetText({ ...data, arrival: { date: "12 Nov 2026", time: "20:05" } }, { forEmr: true }).includes("at 8.05pm"));
t("missing clinician leaves the line out", !formatCaseSheetText({ ...data, clinician: null }, { forEmr: true }).includes("CASE SEEN BY"));
const normal = formatCaseSheetText(data);
t("normal Copy Case Sheet is unchanged", /EMERGENCY DEPARTMENT — CASE SHEET/.test(normal) && /Name: Leelamma/.test(normal) && /Case ID: 261112002/.test(normal));
console.log("\n" + emr.split("\n").slice(0, 8).join("\n"));
process.exit(fails ? 1 : 0);