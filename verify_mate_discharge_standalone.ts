import fs from "fs";
import { isDischargeSummaryRequest, stripDischargeRequest, classifyDischargeRequest, missingDischargeItems } from "./src/mate/mateDischargeIntent";
import { looksLikeFullCaseSheet, shouldHoldPastedSheet } from "./src/mate/mateNewCaseIntent";
import { mergePastedSheetIntoExtraction } from "./src/mate/pastedSheetParser";
import { resolveMateCaseReference } from "./src/mate/mateCaseResolver";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const sheet = `Mr. TEST PATIENT\nAge/Sex: 45/M\nChief complaints: loose stools and fever since 3 days\nHistory of present illness: ${"watery stools, no blood. ".repeat(12)}\nPast history: nil\nVitals: BP 110/70 HR 98 SpO2 98% RR 18 Temp 99\nExamination: abdomen soft\nInvestigations: stool routine normal\nTreatment: ORS, IV fluids\nPlan: observe\nFinal diagnosis: acute gastroenteritis\nCondition at discharge: stable\nDischarge medications: ORS sachets\n`;
const noDx = sheet.replace(/Final diagnosis:.*\n/, "").replace(/Condition at discharge:.*\n/, "").replace(/Discharge medications:.*\n/, "");

// request detection
for (const u of ["Prepare discharge summary", "prepare his discharge summary", "make DS for bed 3A", "can you draft the discharge note?", "I need a discharge summary for bed 3", "discharge summary", "please prepare the discharge summary", "generate a discharge summary now"])
  t(`request: ${u}`, isDischargeSummaryRequest(u));
for (const u of ["What is pending in discharge summary?", "is the discharge summary complete", "Plan: discharge tomorrow", "patient discharged home, treatment ORS", "discharge medications ORS and zinc", "BP 90/60", sheet])
  t(`not a request: ${u.slice(0, 40).replace(/\n/g, " ")}`, !isDischargeSummaryRequest(u));

// routes
const withReq = "Mate, here is the complete case sheet. Prepare a discharge summary.\n" + sheet;
t("sheet + request -> STANDALONE", classifyDischargeRequest(withReq).kind === "STANDALONE");
t("request at the end -> STANDALONE", classifyDischargeRequest(sheet + "\nPlease prepare discharge summary.").kind === "STANDALONE");
t("request alone / with a bed -> EXISTING_PATIENT", classifyDischargeRequest("prepare discharge summary for bed 3A").kind === "EXISTING_PATIENT" && classifyDischargeRequest("make DS").kind === "EXISTING_PATIENT");
t("sheet without a request -> NONE (normal paste flow)", classifyDischargeRequest(sheet).kind === "NONE");
t("ordinary dictation -> NONE", classifyDischargeRequest("fever and vomiting since 2 days").kind === "NONE");

// stripping keeps all clinical facts and removes the request
const r: any = classifyDischargeRequest(withReq);
const cleaned: string = r.clinicalText;
t("request sentence removed before extraction", !/prepare a discharge summary/i.test(cleaned) && !/discharge summary/i.test(cleaned));
t("every clinical line is kept", ["Chief complaints", "Vitals: BP 110/70", "Treatment: ORS, IV fluids", "Final diagnosis: acute gastroenteritis", "Discharge medications: ORS sachets"].every((x) => cleaned.includes(x)));
t("cleaned text is still a full case sheet", looksLikeFullCaseSheet(cleaned));
t("a request word inside a labelled section is not stripped (Plan: observe)", cleaned.includes("Plan: observe"));

// standalone draft content: only what the sheet states; nothing invented
const draft: any = mergePastedSheetIntoExtraction({}, cleaned);
t("draft takes name/age/sex from the sheet header", draft.patientName && /TEST PATIENT/i.test(draft.patientName) && String(draft.age) === "45");
t("draft takes stated diagnosis, condition and medications", /gastroenteritis/i.test(draft.dischargeInfoDraft?.primaryDiagnosis || "") && /stable/i.test(draft.dischargeInfoDraft?.conditionAtDischarge || "") && /ORS/.test(draft.dischargeInfoDraft?.dischargeMedications || ""));
const draft2: any = mergePastedSheetIntoExtraction({}, stripDischargeRequest(noDx));
const miss = missingDischargeItems(draft2.dischargeInfoDraft);
t("missing discharge-critical items are flagged, not invented", miss.includes("final diagnosis") && miss.includes("discharge medications") && miss.includes("condition at discharge") && !(draft2.dischargeInfoDraft?.dischargeMedications));
t("missingDischargeItems handles an empty draft", missingDischargeItems(null).length === 4 && missingDischargeItems({ primaryDiagnosis: "x", dischargeMedications: "y", conditionAtDischarge: "z", followUpPlan: "w" }).length === 0);

// routing safety: the standalone route is independent of the paste-first / bed flow
t("paste-first would have asked for a bed for this text (so discharge routing must run first)", shouldHoldPastedSheet({ text: cleaned, hasOpenPatient: false }));

// existing-patient route uses the real resolver (A/B rules intact)
const mk = (id: string, bedNo: string) => ({ id, bedNo, patient: { name: id } } as any);
const cases = [mk("a", "3A"), mk("b", "3B"), mk("c", "7A")];
const R = (u: string) => resolveMateCaseReference({ utterance: u, cases, activeCaseId: null, physicalCapacity: 30 });
t("'for Bed 7A' -> exactly 7A", R("prepare discharge summary for bed 7A").caseId === "c");
t("'for Bed 3' with both slots -> AMBIGUOUS (asks 3A or 3B)", R("prepare discharge summary for bed 3").status === "AMBIGUOUS");
t("'for Bed 12' -> NOT_FOUND (nothing opened)", R("prepare discharge summary for bed 12").status === "NOT_FOUND");
t("no bed -> NO_REFERENCE (open case or ask)", R("prepare his discharge summary").status === "NO_REFERENCE");

// wiring
const chat = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
const app = fs.readFileSync("./src/App.tsx", "utf8");
const dsv = fs.readFileSync("./src/components/DischargeSummaryView.tsx", "utf8");
const a = chat.indexOf("STAGE 2B-1");
const standalone = chat.slice(chat.indexOf('if (dischargeRoute.kind === "STANDALONE")'), chat.indexOf("// Existing patient route"));
t("discharge routing runs before the Stage 0 gate, the fast path, the bed-announce and the interpreter", a > 0 && a < chat.indexOf("if (\n        shouldAskWhichPatient") && a < chat.indexOf("const fastPathResult") && a < chat.indexOf("PART 2: SERVER INTERPRETATION"));
t("standalone sends only the pasted text with no case, no history", /caseId: null,\s*caseData: \{\},\s*patientAgeYears: null,\s*caseContext: \{\},\s*messages: \[\],/.test(standalone) && /userInput: dischargeRoute\.clinicalText/.test(standalone));
t("standalone never creates, switches or attaches a case, and writes no chat extraction", !/onEnsureDraftCase|startNewCaseInBed|onSwitchCase|setActiveCaseId|extractionData|onSaveExtractedCase|onCaseSheetUpdated/.test(standalone));
t("standalone opens the discharge preview with standalone:true and no case id", /onPreviewDischargeSummary\(draftFields, \{ existingCaseId: null, standalone: true \}\)/.test(standalone));
t("request/clinical-updates fields dropped from the draft", /delete draftFields\.clinicianUpdateText;\s*delete draftFields\.clinicianUpdates;/.test(standalone));
t("failure says nothing saved and no record created", /Nothing was saved and no patient record was created/.test(standalone));
t("App: standalone uses a throwaway id and never the open/displayed case", /options\?\.standalone\s*\?\s*generateInternalCaseId\(\)/.test(app) && /options\?\.standalone \? null : \(cases\.find/.test(app));
t("App: standalone context is recorded, banner prop passed", /standalone: Boolean\(options\?\.standalone\)/.test(app) && /standaloneDraft=\{isDischargePreviewMode && Boolean\(pendingDischargePreviewContext\?\.standalone\)\}/.test(app));
t("a standalone draft cannot be saved to a patient (apply fails closed without a persisted case)", /Apply the Case Sheet first to establish the patient record/.test(app) && /if \(!persistedCase\)/.test(app));
t("discharge screen shows Draft prepared / Not saved / Review required", /Draft prepared/.test(dsv) && /Not saved to any patient record/.test(dsv) && /Review required/.test(dsv));
t("existing-patient route opens preview only (no writes) for the resolved case", /onPreviewDischargeSummary\(\{\}, \{ existingCaseId: dischargeTarget\.id \}\)/.test(chat));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
