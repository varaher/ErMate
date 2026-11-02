// MARKER: ERMATE-MATE-CONTEXT-SWITCH-V1
import { readFileSync } from "fs";
import { isExpectedContextSwitch as ok } from "./src/mate/contextSwitch";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
// first render after MATE starts Bed 5A: session changed, activeCaseId still old, caseId prop already new
t("new bed: first render (prop new, active old) is expected", ok({ activeCaseId: null, incomingCaseId: "c5", handoffTargetCaseId: "c5", switchTargetCaseId: null }));
t("new bed: second render (active new) is expected", ok({ activeCaseId: "c5", incomingCaseId: "c5", handoffTargetCaseId: "c5", switchTargetCaseId: null }));
t("existing patient switch is expected", ok({ activeCaseId: "c1", incomingCaseId: "c2", handoffTargetCaseId: null, switchTargetCaseId: "c2" }));
t("doctor opens another case by hand is NOT expected", !ok({ activeCaseId: "c1", incomingCaseId: "c9", handoffTargetCaseId: "c5", switchTargetCaseId: null }));
t("no pending handoff: never expected", !ok({ activeCaseId: "c1", incomingCaseId: "c2", handoffTargetCaseId: null, switchTargetCaseId: null }));
t("null ids never match", !ok({ activeCaseId: null, incomingCaseId: null, handoffTargetCaseId: "c5", switchTargetCaseId: null }));
const src = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("chat uses the helper with the incoming caseId", /isExpectedContextSwitch\(\{[\s\S]*incomingCaseId: propCaseId \|\| caseData\?\.id/.test(src));
t("old late-only comparison removed", !src.includes("activeCaseId === pendingNewPatientHandoffRef.current?.targetCaseId;"));
console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);