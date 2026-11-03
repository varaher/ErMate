// MARKER: ERMATE-ESTABLISHED-DEFAULTS-V1
// A blank draft case (bed assigned, nothing documented) must NOT count as an established case sheet,
// otherwise the first dictation is dumped into Clinical Notes as a raw transcript.
import { readFileSync } from "fs";
import { getInitialPrimarySurvey } from "./src/types";
import { isEstablishedCaseSheet as client } from "./src/utils/establishedCaseCheck";
import { isEstablishedCaseSheet as server } from "./server/establishedCaseCheck";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const draft = (): any => ({ id: "c1", bedNo: "7A", patient: { name: "", age: null }, progressNotes: "", treatments: [], investigations: [], differentials: [],
  primaryAssessment: { airway: "", breathing: "", circulation: "", disability: "", exposure: "", survey: getInitialPrimarySurvey("Medical") },
  sampleHistory: { symptoms: "", allergies: "", medications: "", pastHistory: "", events: "" } });
for (const [name, fn] of [["client", client], ["server", server]] as const) {
  t(`${name}: blank draft with default survey is NOT established`, fn(draft(), []) === false);
  t(`${name}: Case created via Voice Scribe default note is NOT established`, fn({ ...draft(), progressNotes: "Case created via ErMate Voice Scribe dictation." }, []) === false);
  const a = draft(); a.primaryAssessment.survey.breathing.workOfBreathing = "labored";
  t(`${name}: documented abnormal work of breathing IS established`, fn(a, []) === true);
  const b = draft(); b.primaryAssessment.survey.circulation.rhythm = "irregular";
  t(`${name}: documented irregular rhythm IS established`, fn(b, []) === true);
  const c = draft(); c.primaryAssessment.survey.disability.focalDeficit = "Right arm weakness";
  t(`${name}: documented focal deficit IS established`, fn(c, []) === true);
  const d = draft(); d.primaryAssessment.survey.airway.intervention = "Intubated";
  t(`${name}: documented airway intervention IS established`, fn(d, []) === true);
  t(`${name}: a treatment makes it established`, fn({ ...draft(), treatments: [{ name: "Aspirin" }] }, []) === true);
  t(`${name}: real progress notes make it established`, fn({ ...draft(), progressNotes: "[10:00] - BP improved" }, []) === true);
  t(`${name}: applied extraction in the chat makes it established`, fn(draft(), [{ extractionApplied: true }]) === true);
  t(`${name}: past history makes it established`, fn({ ...draft(), sampleHistory: { pastHistory: "Diabetes" } }, []) === true);
  t(`${name}: no case is not established`, fn(null, []) === false);
}
const v = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("update text always comes from the doctor's own words (no server placeholders)", /Always the doctor's own words[\s\S]{0,400}fieldsToExtract\.clinicianUpdateText = trimmed;[\s\S]{0,300}fieldsToExtract\.clinicianUpdates = \[/.test(v) && !v.includes("if (!fieldsToExtract.clinicianUpdates && trimmed"));
t("initial dictation still never becomes a note", v.includes("delete fieldsToExtract.clinicianUpdates;"));
console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);