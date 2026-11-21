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
// 21 Nov 2026: adult ER cases follow the hospital record ("Case Seen By: Dr. X at 8:40 AM.") — see verify_er_case_record_format.ts
t("line 2 is Case Seen By with time", lines[1] === "Case Seen By: Dr. JOHN THOMAS at 8:39 AM.");
t("no patient name, UHID, case ID or hospital name", !/Leelamma|26111274|261112002|Rajagiri/.test(emr));
t("no Patient Details block", !/PATIENT DETAILS/.test(emr));
t("clinical content is kept", /\nPresenting Complaint:\n/.test(emr) && /Airway → Patent\./.test(emr));
t("evening time reads pm", formatCaseSheetText({ ...data, arrival: { date: "12 Nov 2026", time: "20:05" } }, { forEmr: true }).includes("at 8:05 PM."));
t("missing clinician says Not documented", formatCaseSheetText({ ...data, clinician: null, signatureBlock: {} }, { forEmr: true }).includes("Case Seen By: Not documented."));
const normal = formatCaseSheetText(data);
t("normal Copy Case Sheet keeps the patient header", /^Rajagiri Emergency\nCase ID: 261112002\nName: Leelamma/.test(normal) && /INITIAL ASSESSMENT AND EMERGENCY DEPARTMENT CASE RECORD/.test(normal));
console.log("\n" + emr.split("\n").slice(0, 8).join("\n"));
process.exit(fails ? 1 : 0);