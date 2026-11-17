import { readFileSync } from "fs";
import { EDITS_KEY, splitEdits, setPath, applyEdits, editableFields, diffEdits, parseEditedValue, collectEditedPaths } from "./src/lib/extractionedits";
import { getMergedUnappliedCaseExtraction, getMergedUnappliedDischargeExtraction } from "./src/components/VoiceScribeChatView";
let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };

// paths
const base = { vitals: { rr: "22" }, drugs: [{ drugName: "Aspirin" }] };
const s1 = setPath(base, "vitals.rr", "24");
t("setPath changes value", s1.vitals.rr === "24");
t("setPath never touches the input", base.vitals.rr === "22");
t("setPath creates missing object", setPath({}, "secondarySurvey.cvs", "S1S2").secondarySurvey.cvs === "S1S2");
t("setPath edits array item", setPath(base, "drugs.0.drugName", "Clopidogrel").drugs[0].drugName === "Clopidogrel" && base.drugs[0].drugName === "Aspirin");
t("applyEdits applies in order, last wins", applyEdits(base, [{ "vitals.rr": "30" }, { "vitals.rr": "18" }]).vitals.rr === "18");
t("splitEdits strips the key", !(EDITS_KEY in splitEdits({ a: 1, [EDITS_KEY]: { x: 1 } }).data) && splitEdits({ a: 1, [EDITS_KEY]: { x: 1 } }).edits.x === 1);

// fields
const f = editableFields({ vitals: { rr: "22", gcs: "15" }, airway: "Patent", diagnosis: "ACS", mlcDetails: { isMlc: false, mlcConfirmedByClinician: true }, clinicianUpdateText: "x", isPediatric: false, currentMedications: ["Aspirin 300 mg", "Heparin"] });
const by = (p: string) => f.find(x => x.path === p);
t("captured RR listed with its label", by("vitals.rr")?.value === "22" && by("vitals.rr")?.label === "RR");
t("captured GCS listed", by("vitals.gcs")?.value === "15");
t("not dictated HR is offered as Add", by("vitals.hr")?.value === "" );
t("not dictated secondary survey offered", by("secondarySurvey.cns")?.value === "");
t("list becomes lines", by("currentMedications")?.kind === "list" && by("currentMedications")?.value === "Aspirin 300 mg\nHeparin");
t("hidden fields not shown", !by("clinicianUpdateText") && !by("isPediatric") && !f.some(x => x.path.includes("mlcConfirmedByClinician")));
t("no duplicate rows", new Set(f.map(x => x.path)).size === f.length);

// diff and parse
const ed = diffEdits(f, { "vitals.rr": "24", "vitals.hr": "100", airway: "Patent" });
t("only changed rows become edits", Object.keys(ed).sort().join() === "vitals.hr,vitals.rr");
t("list parse", JSON.stringify(parseEditedValue("list", "A\n\n B ")) === JSON.stringify(["A", "B"]));
t("number parse", parseEditedValue("number", "12") === 12 && parseEditedValue("number", "x") === "x");
t("bool parse", parseEditedValue("bool", "true") === true && parseEditedValue("bool", "false") === false);
t("cleared field becomes empty text", parseEditedValue("text", "  ") === "");
t("edited paths", collectEditedPaths([{ a: 1 }, { b: 2 }]).size === 2);

// merge across dictations
const m1: any = { id: "a", sender: "ai", text: "", timestamp: "", extractionData: { vitals: { rr: "22", hr: "90" }, [EDITS_KEY]: { "vitals.rr": "24" } } };
const m2: any = { id: "b", sender: "ai", text: "", timestamp: "", extractionData: { vitals: { rr: "30", spo2: "95" } } };
const merged = getMergedUnappliedCaseExtraction([m1, m2]).merged;
t("newer dictation wins over an older edit", merged.vitals.rr === "30" && merged.vitals.hr === "90" && merged.vitals.spo2 === "95");
const m3: any = { id: "c", sender: "ai", text: "", timestamp: "", extractionData: { vitals: { spo2: "96" }, [EDITS_KEY]: { "vitals.rr": "18" } } };
t("edit on the latest dictation wins", getMergedUnappliedCaseExtraction([m1, m2, m3]).merged.vitals.rr === "18");
t("edits key never leaks into the case data", !(EDITS_KEY in merged));
t("discharge merge applies edits too", getMergedUnappliedDischargeExtraction([m1]).merged.vitals.rr === "24");
t("applied dictation is left out", !("vitals" in getMergedUnappliedCaseExtraction([{ ...m1, extractionApplied: true }]).merged));

// wiring
const v = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("card has edit button", v.includes('data-testid="extraction-edit-button"'));
t("save writes edits to the chat message", v.includes("handleSaveExtractionEdits") && v.includes("unappliedExtraction"));
t("editor is not offered once applied", /msg\.extractionApplied !== true[\s\S]{0,400}extraction-edit-button|extraction-edit-button[\s\S]{0,600}extractionApplied/.test(v));
const tips = readFileSync("src/lib/coachTours.ts", "utf8");
t("walkthrough tip exists", tips.includes('feature: "edit-capture"'));
t("firestore.rules untouched", !readFileSync("firestore.rules", "utf8").includes("__edits"));
if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");