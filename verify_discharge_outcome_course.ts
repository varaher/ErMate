/**
 * Course in Hospital by outcome (25 Nov 2026, Neeraj: "we have scenarios in er: normal discharge, referral,
 * lama, death, so course in hospital should be accordingly").
 *  - The course does not repeat complaints, normal vitals or the primary survey.
 *  - It ends with a paragraph written for the outcome, only from what was recorded (Rule 8).
 *  - LAMA / death / referral details missing => Finalise is blocked with a list of what to record.
 */
import fs from "node:fs";
import { deriveInitialCourseInHospital as course, classifyDisposition, outcomeChecklist } from "./src/utils/dischargeSyncEngine";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

// The outside RTA case that came to our ED
const rta: any = {
  id: "rta", patient: { name: "X", age: 66, gender: "Male", presentingComplaint: "Alleged RTA with head injury", arrivalMode: "Referred", referredFrom: "St. James' Hospital, Chalakudy" },
  vitals: { bp: "120/80", hr: "80", spo2: "99", rr: "20", gcs: "E1VTM1", grbs: "345", temp: "97 F" },
  treatments: [{ drugName: "Inj. Sompraz", dose: "40 mg", route: "IV" }, { drugName: "Inj. Mannitol", dose: "100 mL", route: "IV" }],
  treatmentNotes: "3% NaCl continued at 15 mL/hr; GCS and pupils monitored",
  investigationLabsOrdered: "emergency PA panel",
  dispositionAndPlan: { consultsRequested: ["Neurosurgery"] },
};
const withOutcome = (dispositionStatus: string, extra: any = {}) => ({ ...rta, dischargeInfo: { dispositionStatus, ...extra } });

// ---- Shared body
const base = course(withOutcome(""));
t("opens with 'above-mentioned complaints' and the referral source", base.startsWith("The patient presented to the Emergency Department with the above-mentioned complaints, referred from St. James' Hospital, Chalakudy."));
t("only abnormal findings that matter (GCS, GRBS), not the normal BP / SpO2", /Initial assessment revealed GCS E1VTM1, GRBS 345 mg\/dL\./.test(base) && !/120\/80|99%|RR 20/.test(base));
t("treatment with doses, joined with 'and'", /treated with Inj\. Sompraz 40 mg IV and Inj\. Mannitol 100 mL IV\./.test(base));
t("consultation sentence", /Neurosurgery consultation was sought\./.test(base));
t("no outcome paragraph when the disposition is not chosen", !/discharged|referred to|declared dead|admitted/.test(base.split("\n\n").slice(-1)[0]));
t("more than three drugs become a 'Medications given' list", /Medications given:\n• A 1 mg IV\n• B 2 mg IV\n• C 3 mg IV\n• D 4 mg oral/.test(course({ ...rta, treatments: [["A", "1 mg", "IV"], ["B", "2 mg", "IV"], ["C", "3 mg", "IV"], ["D", "4 mg", "Oral"]].map(([drugName, dose, route]) => ({ drugName, dose, route })) })));

// ---- Normal discharge (acute gastritis sample)
const gastritis: any = {
  id: "g", patient: { name: "M", age: 59, gender: "Female", presentingComplaint: "Vomiting" }, vitals: { bp: "130/80", hr: "84", spo2: "98" },
  treatments: [{ drugName: "Inj. Emeset", dose: "4 mg", route: "IV" }, { drugName: "Inj. Pantoprazole", dose: "40 mg", route: "IV" }],
  progressNotes: "patient was symptomatically better, with no further episodes of vomiting and tolerating oral feeds well",
  dischargeInfo: { dispositionStatus: "Normal Discharge", dischargeCondition: "STABLE", followUpPlan: "review in Gastroenterology OPD after 1 week" },
};
const g = course(gastritis);
t("normal: 'hemodynamically stable' when HR, BP and SpO2 are normal", /The patient was hemodynamically stable\./.test(g));
t("normal: reassessment only from the note", /On reassessment, patient was symptomatically better/.test(g));
t("normal: closes with 'Hence … clinically stable condition … follow-up'", /Hence, the patient was discharged from the Emergency Department in a clinically stable condition with advice for review in Gastroenterology OPD after 1 week\./.test(g));
t("normal: no 'stable' claimed when the condition is not recorded", !/clinically stable/.test(course({ ...gastritis, dischargeInfo: { dispositionStatus: "Normal Discharge" } })));
t("normal: no 'hemodynamically stable' when SpO2 is missing", !/hemodynamically stable/.test(course({ ...gastritis, vitals: { bp: "130/80", hr: "84" } })));

// ---- Referral
const ref = course(withOutcome("Referred", { dischargeCondition: "CRITICAL", outcome: { referredTo: "Govt Medical College, Thrissur (Neurosurgery)", referralReason: "Non-availability of neurosurgical ICU bed", acceptingDoctor: "Dr. Menon", transportMode: "ALS ambulance", transferSupport: "Ventilator and noradrenaline infusion" } }));
t("referral: reason, destination, accepting doctor", /In view of non-availability of neurosurgical ICU bed, the patient was referred to Govt Medical College, Thrissur \(Neurosurgery\) for further management, after discussion with Dr\. Menon\./.test(ref));
t("referral: transport, support and condition (acronyms kept)", /The patient was transferred by ALS ambulance with ventilator and noradrenaline infusion in a critical condition\./.test(ref));
const refBare = course(withOutcome("Referred"));
t("referral with nothing recorded: one plain sentence, nothing invented", /The patient was referred for further management\.$/.test(refBare));

// ---- LAMA
const lama = course(withOutcome("Discharge Against Medical Advice", { dischargeCondition: "CRITICAL", outcome: { counselledPerson: "Ravi", counselledRelation: "Son", risksExplained: "Yes", lamaFormSignedAt: "11:40 AM on 17/11/2026", witness: "Staff Nurse Anu", policeInformed: "Chalakudy PS" } }));
t("LAMA: who was counselled, risks including death (no language named)", /The son \(Ravi\) was counselled regarding the clinical condition and the need for further treatment, and the risks of leaving, including deterioration and death, were explained\./.test(lama));
t("LAMA: form time and witness", /Despite counselling, they chose to leave against medical advice, and the LAMA form was signed at 11:40 AM on 17\/11\/2026 in the presence of Staff Nurse Anu\./.test(lama));
t("LAMA: police and closing line with condition", /Police were informed \(Chalakudy PS\)\. Hence, the patient was discharged against medical advice in a critical condition\./.test(lama));
const lamaBare = course(withOutcome("Discharge Against Medical Advice"));
t("LAMA with nothing recorded: no counselling invented", !/counselled|risks|LAMA form/.test(lamaBare) && /Hence, the patient was discharged against medical advice\.$/.test(lamaBare));
const lamaSelf = course(withOutcome("LAMA", { outcome: { counselledRelation: "Self", risksExplained: "Yes" } }));
t("LAMA by the patient himself", /The patient was counselled/.test(lamaSelf) && /Despite counselling, the patient chose/.test(lamaSelf));

// ---- Death
const death = course(withOutcome("Expired", { outcome: { resuscitation: "CPR as per ACLS for 30 minutes", timeOfDeath: "2:15 PM on 17/11/2026", declaredBy: "Dr Neeraj", causeOfDeath: "Severe traumatic brain injury with refractory shock", bodyHandedTo: "the mortuary for post-mortem (MLC)", policeInformed: "Chalakudy PS" } }));
t("death: resuscitation, time, declared by", /Resuscitation was done \(CPR as per ACLS for 30 minutes\)\. Despite resuscitative measures, the patient was declared dead at 2:15 PM on 17\/11\/2026 by Dr Neeraj\./.test(death));
t("death: cause, police, body handed over", /Cause of death: Severe traumatic brain injury with refractory shock\. Police were informed \(Chalakudy PS\)\. The body was handed over to the mortuary for post-mortem \(MLC\)\./.test(death));
const dnr = course(withOutcome("Death", { outcome: { resuscitation: "Not attempted (DNR)", timeOfDeath: "4:00 AM" } }));
t("death without resuscitation: no 'despite resuscitative measures'", /Resuscitation was not attempted \(Not attempted \(DNR\)\)\. The patient was declared dead at 4:00 AM\./.test(dnr) && !/Despite resuscitative/.test(dnr));
t("death with nothing recorded: no resuscitation invented", !/[Rr]esuscitat/.test(course(withOutcome("Expired"))));

// ---- Admission / observation / at request
t("admission", /In view of the clinical condition, the patient was admitted to SICU\./.test(course(withOutcome("Admitted to SICU"))));
t("observation", /The patient remains under observation in the Emergency Department\./.test(course(withOutcome("ER Observation"))));
t("discharge at request", /discharged at request/.test(course(withOutcome("Discharge at Request"))));

// ---- Classification
t("dispositions classified", ["Normal Discharge", "Discharge at Request", "Referred", "Discharge Against Medical Advice", "LAMA", "Expired", "Death", "Admitted", "ER Observation", ""].map(classifyDisposition).join(",") === "discharge,request,referral,lama,lama,death,death,admit,observation,none");

// ---- Finalise check
const lamaChk = outcomeChecklist("lama", {}, { isMlc: true });
t("LAMA needs: person, relation, risks, form time, witness, condition, vitals, police (MLC)", lamaChk.required.length === 8 && !/language/i.test([...lamaChk.required, ...lamaChk.advised].join(" ")));
t("LAMA complete => nothing required", outcomeChecklist("lama", { counselledPerson: "Ravi", counselledRelation: "Son", risksExplained: "Yes", lamaFormSignedAt: "11:40", witness: "SN Anu" }, { condition: "CRITICAL", vitalsAtExit: true }).required.length === 0);
t("death needs: time, cause, declared by, body handed over", outcomeChecklist("death", {}, {}).required.join("|") === "Date and time of death|Cause of death|Declared by (doctor)|Body handed over to (name, relationship) or mortuary");
t("referral needs: destination, reason, transport, condition, vitals", outcomeChecklist("referral", {}, {}).required.length === 5);
t("normal discharge never blocks Finalise", outcomeChecklist("discharge", {}, {}).required.length === 0);

// ---- Wiring
const ds = fs.readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
const types = fs.readFileSync("src/types.ts", "utf8");
t("outcome details saved with the summary", /outcome\?: DischargeOutcomeDetails;/.test(types) && /dispositionStatus,\s*outcome,\s*\};/.test(ds));
t("course follows the outcome chosen on screen", /deriveInitialCourseInHospital\(\{\s*\.\.\.currentCase,\s*dischargeInfo: \{ \.\.\.\(currentCase\.dischargeInfo \|\| \{\}\), dispositionStatus, dischargeCondition, followUpPlan, outcome \}/.test(ds));
t("details box shown for referral / LAMA / death", /<DischargeOutcomeFields[\s\S]{0,200}kind=\{outcomeKind\}/.test(ds));
t("Finalise disabled while details are missing, and guarded in save", /disabled=\{finaliseBlocked\}/.test(ds) && /if \(statusToSave === "FINALIZED"\) \{[\s\S]{0,400}if \(chk\.required\.length\)/.test(ds));
t("disposition choices include Admitted and Expired; condition includes CRITICAL", /<option value="Admitted">Admitted<\/option>/.test(ds) && /<option value="Expired">Expired \(Death\)<\/option>/.test(ds) && /<option value="CRITICAL">CRITICAL<\/option>/.test(ds));
t("walkthrough tip", /feature: "discharge-outcome"/.test(fs.readFileSync("src/lib/coachTours.ts", "utf8")));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);