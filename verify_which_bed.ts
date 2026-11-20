import { readFileSync } from "fs";
import { shouldAskWhichBed, startsNewPatient, openingIdentity, classifyWhichBedReply, WHICH_BED_QUESTION } from "./src/mate/whichBedGate";
let fail = 0;
const t = (n: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (!ok) fail++; };
const open = { age: 60, gender: "Male" };
const ask = (text: string, o: any = {}) => shouldAskWhichBed({ text, clinicalWrite: true, openCase: open, hasRecentCase: true, hasBedRef: false, ...o });

// opening identity
t("60 year old male", JSON.stringify(openingIdentity("60 year old male came with chest pain")) === '{"age":60,"sex":"M"}');
t("45F", openingIdentity("45F with fever")?.sex === "F" && openingIdentity("45F with fever")?.age === 45);
t("60/M", openingIdentity("60/M, RTA")?.age === 60);
t("6 month old counts as age 0", openingIdentity("6 month old boy with fever")?.age === 0);
t("BP is not an age", openingIdentity("BP 90 by 60") === null);

// asks
t("different age -> new patient", ask("45 year old female with abdominal pain"));
t("different sex -> new patient", ask("60 year old female with chest pain"));
t("same patient continues", !ask("60 year old male, BP 90/60, giving fluids"));
t("no demographics, same patient continues", !ask("BP 90/60, started noradrenaline"));
t("'new patient' without bed asks", ask("new patient chest pain"));
t("'we got a patient' asks", ask("we got a patient with seizure", { clinicalWrite: false }));
t("nothing open, nothing recent: asks", ask("chest pain since 2 hours, BP 150/90", { openCase: null, hasRecentCase: false }));
t("nothing open but a recent case: old 'which patient' flow handles it", !ask("BP 90/60", { openCase: null, hasRecentCase: true }));
t("bed named: never asks", !ask("new patient bed 9 chest pain") && !ask("45 year old female", { hasBedRef: true }));
t("compact bed named: never asks", !ask("new patient 9A chest pain"));
t("question never asks", !ask("is this a new patient?"));
t("open case age unknown: cannot tell, no ask", !ask("45 year old female with pain", { openCase: { age: null, gender: null } }));
t("startsNewPatient exported", startsNewPatient({ text: "new patient", openCase: null }));

// replies
t("bed 9", JSON.stringify(classifyWhichBedReply("Bed 9")) === '{"kind":"bed","bed":"9"}');
t("9a", JSON.stringify(classifyWhichBedReply("9a")) === '{"kind":"bed","bed":"9A"}');
for (const w of ["any bed", "any", "next free bed", "you pick", "whichever", "any free bed please"]) t(`any: ${w}`, classifyWhichBedReply(w).kind === "any");
t("cancel", classifyWhichBedReply("cancel").kind === "cancel");
t("clinical text is not an answer", classifyWhichBedReply("BP 90/60 and RR 24").kind === "other");
t("question text mentions bed + any bed", /any bed/.test(WHICH_BED_QUESTION) && /Nothing has been saved/.test(WHICH_BED_QUESTION));

// wiring
const v = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("gate placed before the Which-patient hold", v.indexOf("shouldAskWhichBed({") > 0 && v.indexOf("shouldAskWhichBed({") < v.indexOf("shouldAskWhichPatient({"));
t("gate holds nothing-saved dictation", v.includes('kind: "dictation"') && v.includes("New patient waiting for a bed"));
t("pasted sheet no longer auto-picks a bed", !/const autoBed = onEnsureDraftCase/.test(v) && v.includes('kind: "sheet"'));
t("'any bed' picks the lowest free bed", v.includes('reply.kind === "bed" ? reply.bed : pickNextFreeBed('));
t("held dictation is replayed into the new case", v.includes("startNewCaseInBed(dest.referenceValue || chosenBed, chosenBed, false, heldSheet.text)"));
t("replay skips the gate (no second question)", v.includes("sendToChat(pendingNew.utterance, { skipMatePatientResolution: true })"));
t("full sheets keep the sheet flow", v.includes("!looksLikeFullCaseSheet(trimmed) &&"));
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);