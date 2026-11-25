/**
 * Course in Hospital rules from Neeraj's sample summaries (25 Nov 2026):
 *  1. open with the mechanism when an event is documented (trauma, fall, poisoning, bite …)
 *  2. GCS and pupils stated for head injury / seizure / syncope / stroke, even when normal
 *  3. the consultant's advice / plan written in its own words
 *  4. results kept as recorded ("verbal report")
 *  5. observation is never listed as a drug
 */
import fs from "node:fs";
import { deriveInitialCourseInHospital as course } from "./src/utils/dischargeSyncEngine";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

// The football head-injury sample
const football: any = {
  id: "f", patient: { name: "A", age: 24, gender: "Male", presentingComplaint: "Facial pain and nasal discharge" },
  vitals: { bp: "120/80", hr: "78", spo2: "99", gcs: "E4V5M6" },
  sampleHistory: { events: "Alleged accidental head and facial injury due to impact by a football" },
  primaryAssessment: { disability: "Conscious, oriented, GCS E4V5M6, pupils bilaterally equal and reactive to light, GRBS 110" },
  investigationImaging: "CT brain and CT cervical spine (verbal report): no acute intracranial bleed or fracture",
  dispositionAndPlan: { consultsRequested: ["Neurosurgery"], managementPlan: "Neurosurgery advised no active intervention at present; ENT consultation advised in view of bilateral nasal discharge" },
  treatments: [{ drugName: "Observation in ER" }],
  dischargeInfo: { dispositionStatus: "Normal Discharge", dischargeCondition: "STABLE", followUpPlan: "ENT OPD review and neurosurgery review SOS if any neurological deficit develops" },
};
const fb = course(football);
t("1. opens with the mechanism", fb.startsWith("The patient presented to the Emergency Department following an alleged accidental head and facial injury due to impact by a football."));
t("2. head injury: conscious, GCS and pupils stated though normal", /The patient was conscious and oriented, with GCS E4V5M6 and pupils bilaterally equal and reactive to light\./.test(fb));
t("2. E4V5M6 is not called altered; hemodynamically stable still said", !/Initial assessment revealed GCS/.test(fb) && /The patient was hemodynamically stable\./.test(fb));
t("4. imaging result kept as recorded (no 'was done')", /CT brain and CT cervical spine \(verbal report\): no acute intracranial bleed or fracture\./.test(fb) && !/fracture was done/.test(fb));
t("3. specialist advice in its own words", /Neurosurgery advised no active intervention at present; ENT consultation advised in view of bilateral nasal discharge\./.test(fb));
t("5. observation is not a drug, it is a sentence", !/treated with Observation/.test(fb) && /The patient was kept under observation in the Emergency Department\./.test(fb));
t("ends with discharge and the follow-up advice", /Hence, the patient was discharged from the Emergency Department in a clinically stable condition with advice for ENT OPD review and neurosurgery review SOS if any neurological deficit develops\.$/.test(fb));

// Rule 2 only where it matters
const vomiting = course({ ...football, sampleHistory: {}, patient: { ...football.patient, presentingComplaint: "Vomiting" } });
t("2. not for a non-neurological complaint", !/conscious and oriented|pupils/.test(vomiting));
t("2. intubated GCS (E1VTM1) is reported as abnormal, not 'conscious'", /Initial assessment revealed GCS E1VTM1/.test(course({ ...football, vitals: { ...football.vitals, gcs: "E1VTM1" }, primaryAssessment: { disability: "pupils right 2 mm, left 3 mm" } })));

// Rule 1 does not break an event written as a sentence or a non-mechanism event
const fall = course({ ...football, sampleHistory: { events: "The patient sustained a fall from approximately 6 feet" } });
t("1. an event already written as a sentence stays a sentence", /with the above-mentioned complaints\. The patient sustained a fall from approximately 6 feet\./.test(fall));
const stairs = course({ ...football, patient: { ...football.patient, presentingComplaint: "Chest pain" }, sampleHistory: { events: "Pain started while climbing stairs" } });
t("1. a non-mechanism event keeps 'above-mentioned complaints'", /with the above-mentioned complaints\. Pain started while climbing stairs\./.test(stairs));

// Child with head nodding (paediatric sample): PAT in one phrase, no exam repetition
const child: any = {
  id: "c", isPediatric: true, patient: { name: "B", age: 1, gender: "Male", presentingComplaint: "Recurrent episodes of abnormal head nodding movements since yesterday evening" },
  pediatricDetails: { patNormal: true }, investigationImaging: "Chest X-ray was normal", primaryAssessment: { airway: "Patent", breathing: "Bilateral air entry equal" },
  dispositionAndPlan: { consultsRequested: ["Neonatology"] }, treatments: [{ drugName: "Observation" }], dischargeInfo: { dispositionStatus: "ER Observation" },
};
const ch = course(child);
t("child: PAT in one phrase; airway / air entry not repeated", /The Pediatric Assessment Triangle was documented as normal\./.test(ch) && !/airway|air entry/i.test(ch));
t("child: result kept, consultation, observation as the outcome", /Chest X-ray was normal\./.test(ch) && /Neonatology consultation was sought\./.test(ch) && /The child remains under observation in the Emergency Department\.$/.test(ch) && !/treated with Observation/.test(ch));

t("AI prompt carries the same five rules", /Open with the mechanism/.test(fs.readFileSync("server/dischargeSummary.ts", "utf8")));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);