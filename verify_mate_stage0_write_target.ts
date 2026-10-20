import fs from "fs";
import { planMateConversation } from "./src/mate/mateConversationPlanner";
import { detectExplicitNewCaseIntent, shouldHoldPastedSheet, classifyPendingSheetReply } from "./src/mate/mateNewCaseIntent";
import { resolveInterpretedPatient } from "./src/mate/matePatientDisambiguator";
import { resolveMateCaseReference } from "./src/mate/mateCaseResolver";
import { hasExplicitPatientReference, isFocusAuthorized, isImplicitPatientReference, shouldAskWhichPatient, appendHeldUpdate, isHeldUpdateExpired, HELD_UPDATE_TTL_MS, WHICH_PATIENT_QUESTION } from "./src/mate/mateWriteTargetGate";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const mk = (id: string, bedNo: string) => ({ id, bedNo, patient: { name: id, presentingComplaint: "c" }, createdAt: new Date().toISOString() } as any);
const c3 = mk("c3", "3A"), c7 = mk("c7", "7A"), c23 = mk("c23", "23A");
const census = [c3, c7, c23];

// Mirror of the sendToChat gate inputs (clinicalWrite = planner flags clinical content and it is not a question).
const ask = (text: string, o: { active?: any; recent?: any; focusCaseId?: string | null; inUse?: string | null }) => {
  const clinicalWrite = planMateConversation(text).mayContainClinicalUpdate && !/\?\s*$/.test(text);
  return shouldAskWhichPatient({
    clinicalWrite, text, explicitNewCase: detectExplicitNewCaseIntent(text),
    hasContextCase: Boolean(o.active || o.recent),
    focusAuthorized: isFocusAuthorized(o.focusCaseId ?? null, o.inUse ?? (o.active ? o.active.id : null)),
    pasteFlow: shouldHoldPastedSheet({ text, hasOpenPatient: Boolean(o.active) }),
  });
};

// 1-2 general conversation
t("no bed named, 3A open, general conversation -> ask", ask("BP has fallen to 80/50", { active: c3 }));
t("no bed named, last-mentioned 7A (nothing open) -> ask", ask("BP has fallen to 80/50", { recent: c7 }));
t("question is not a write", !ask("what is the usual BP target in sepsis?", { active: c3 }));
t("short vitals dictation -> ask", ask("HR 120 SpO2 88 on room air", { active: c3 }));
t("fresh session, nothing open or mentioned -> new-patient dictation allowed", !ask("45 year old male chest pain", {}));
// 3 explicit
t("'Bed 3A BP is now 80/50' -> explicit, no ask", !ask("Bed 3A BP is now 80/50", { active: c7 }));
t("'3A BP 80/50' compact -> explicit", !ask("3A BP 80/50", { active: c7 }));
t("'patient in bed 7 has fever' -> explicit", !ask("patient in bed 7 has fever", { active: c3 }));
t("'Vit B12 given' is NOT a patient reference", !hasExplicitPatientReference("Vit B12 given, grade 2"));
t("explicit new patient not asked", !ask("new patient bed 5, 45 male abdominal pain", { active: c3 }));
// 4 Patient Focus
t("Bed 3A deliberately opened in Patient Focus -> unreferenced update accepted", !ask("BP has fallen to 80/50", { active: c3, focusCaseId: "c3" }));
t("Focus on 3A but chat now on 7A (switched) -> focus does NOT carry", ask("BP 90/60", { active: c7, focusCaseId: "c3", inUse: "c7" }));
t("displayed case without focus is not focus", !isFocusAuthorized(null, "c3") && !isFocusAuthorized(undefined, "c3"));
t("focus requires the same case in use", isFocusAuthorized("c3", "c3") && !isFocusAuthorized("c3", "c7") && !isFocusAuthorized("c3", null));
// 5 read of another patient does not change write target: reads are not writes and never set focus
t("read of Bed 7 is not a write (no hold, no focus change)", !ask("What is pending for Bed 7?", { active: c3 }));
t("read then unreferenced BP -> ask", ask("BP 80/50", { active: c3, recent: c7 }));
t("read of Bed 7 while 3A focused: BP still resolves to 3A focus (write target unchanged)", !ask("BP 80/50", { active: c3, recent: c7, focusCaseId: "c3" }));
// 6 hold/preserve/no duplication
let held = appendHeldUpdate(null, "BP 80/50", 1, 1000);
held = appendHeldUpdate(held, "HR 120", 1, 2000);
t("second unreferenced update is added to the same hold", held.text === "BP 80/50\nHR 120");
t("same update repeated is not duplicated", appendHeldUpdate(held, "HR 120", 1, 3000).text === "BP 80/50\nHR 120");
t("hold expires after TTL / generation change (patient switch clears it)", !isHeldUpdateExpired(held, 1, 1000 + 1000) && isHeldUpdateExpired(held, 2, 2000) && isHeldUpdateExpired(held, 1, 1000 + HELD_UPDATE_TTL_MS + 1));
t("clarification replies", classifyPendingSheetReply("Bed 3A").kind === "bed" && classifyPendingSheetReply("7").kind === "bed" && classifyPendingSheetReply("cancel").kind === "cancel" && classifyPendingSheetReply("what is pending for bed 7").kind === "other");
// reply resolves through the real resolver (A/B rules intact)
const cases = [mk("a", "3A"), mk("b", "3B"), c7];
const r = (b: string) => resolveMateCaseReference({ utterance: `Bed ${b}`, cases, activeCaseId: null, physicalCapacity: 30 });
t("reply 'Bed 3A' -> exactly 3A", r("3A").status === "RESOLVED" && r("3A").caseId === "a");
t("reply 'Bed 3' with both slots occupied -> AMBIGUOUS (asks 3A or 3B)", r("3").status === "AMBIGUOUS");
t("reply 'Bed 12' empty -> NOT_FOUND (stays held)", r("12").status === "NOT_FOUND");
t("reply 'Bed 99' -> INVALID_LOCATION", r("99").status === "INVALID_LOCATION");

// 7 resolver: no implicit fallback when disallowed; defaults unchanged
const base = { censusCases: census };
const R = (reference: any, allow?: boolean, active: any = c3, recent: any = c7) => resolveInterpretedPatient({ reference, activeCase: active, recentCase: recent, allowImplicitFallback: allow, ...base });
t("NONE + open 3A, fallback allowed (default, reads) -> 3A", R({ type: "NONE" }).status === "RESOLVED" && R({ type: "NONE" }).bedNo === "3A");
t("NONE + open 3A, fallback disallowed -> NO_REFERENCE", R({ type: "NONE" }, false).status === "NO_REFERENCE");
t("NONE + only last-referenced 7A, disallowed -> NO_REFERENCE", R({ type: "NONE" }, false, null).status === "NO_REFERENCE");
t("CURRENT ('this patient') disallowed -> NO_REFERENCE", R({ type: "CURRENT" }, false).status === "NO_REFERENCE");
t("RECENT ('the last one') disallowed -> NO_REFERENCE", R({ type: "RECENT" }, false).status === "NO_REFERENCE");
t("untyped reference disallowed -> NO_REFERENCE", R({}, false).status === "NO_REFERENCE");
t("explicit BED still resolves when fallback disallowed", R({ type: "BED", value: "7A" }, false).caseId === "c7");
t("implicit types detected for the post-interpreter safety net", isImplicitPatientReference(null) && isImplicitPatientReference({ type: "NONE" }) && isImplicitPatientReference({ type: "CURRENT" }) && isImplicitPatientReference({ type: "RECENT" }) && !isImplicitPatientReference({ type: "BED", value: "3A" } as any));

// 8 alternating patients: explicit references never fall back, so there is no cross-patient write
const seq = ["Bed 3A BP 80/50", "Bed 7A fever 3 days", "3A HR 110", "7A vomiting"];
t("alternating explicit updates are all explicit (never ask, never use the previous patient)", seq.every((u) => !ask(u, { active: c3 }) && hasExplicitPatientReference(u)));
t("each alternating reference resolves to its own case", ["3A", "7A"].every((b, i) => resolveMateCaseReference({ utterance: seq[i], cases: census, activeCaseId: i ? "c3" : "c7", physicalCapacity: 30 }).caseId === (b === "3A" ? "c3" : "c7")));

// wiring
const chat = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
const app = fs.readFileSync("./src/App.tsx", "utf8");
const at = (x: string) => chat.indexOf(x);
t("gate runs before the fast path and the interpreter", at("STAGE 0: NEVER GUESS THE PATIENT") > 0 && at("STAGE 0: NEVER GUESS THE PATIENT") < at("const fastPathResult") && at("STAGE 0: NEVER GUESS THE PATIENT") < at("PART 2: SERVER INTERPRETATION"));
t("question text is the specified one", WHICH_PATIENT_QUESTION === "Which patient is this update for, doctor?" && /\$\{WHICH_PATIENT_QUESTION\}/.test(chat));
t("post-interpreter safety net present", /hasClinicalDoc && !focusAuthorized && isImplicitPatientReference\(groundedRef\)/.test(chat));
t("resolver call disallows implicit fallback for unfocused clinical writes", /allowImplicitFallback: focusAuthorized \|\| !clinicalWriteTurn/.test(chat));
t("replay of a clarified update skips re-resolution (no second hold, no duplicate)", /sendToChat\(heldUpdate\.text, \{ skipMatePatientResolution: true \}\)/.test(chat) && /pendingUtteranceAfterSwitchRef\.current = \{\s*targetCaseId: target\.id,\s*utterance: heldUpdate\.text/.test(chat));
t("hold is cleared before replay", chat.indexOf("pendingUnreferencedUpdateRef.current = null;\n          lastReferencedCaseIdRef.current = target.id") > 0);
t("focus is granted only by: prop, new patient started by MATE, first dictated case, 'Open Bed X'", /focusCaseIdRef\.current = newCaseId/.test(chat) && /focusCaseIdRef\.current = ensuredCaseId/.test(chat) && /focusCaseIdRef\.current = fastPathResult\.targetCaseId/.test(chat) && /focusCaseIdRef\.current = patientFocusCaseId/.test(chat));
t("focus is not set from lastReferencedCaseId / activeCaseId anywhere", !/focusCaseIdRef\.current = (activeCaseId|lastReferencedCaseIdRef)/.test(chat));
t("New Chat clears focus and any held update", /focusCaseIdRef\.current = null;\s*pendingUnreferencedUpdateRef\.current = null;\s*onNewChat/.test(chat));
t("App: deliberate opens set focus; tab-bar MATE and free discussion clear it", /setVoiceScribeFocusCaseId\(caseId \|\| null\)/.test(app) && /setVoiceScribeFocusCaseId\(selectedCaseId\)/.test(app) && /Opening MATE from the tab bar[\s\S]{0,120}setVoiceScribeFocusCaseId\(null\)/.test(app) && /patientFocusCaseId=\{voiceScribeFocusCaseId\}/.test(app));
t("existing safety kept: NOT_FOUND hard stop, A/B resolver, Apply workflow", /Explicit reference \(bed \/ case no\.\/ list index\) that matches nothing|Explicit reference \(bed/.test(chat) && /handleApplyExtraction/.test(chat) && /familyOccupant/.test(chat));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
