// MARKER: ERMATE-TRIAGE-DESK-V1
import { readFileSync } from "fs";
import { parseTriageDictation as P } from "./src/utils/triageDictation";
import { buildTriageQueue } from "./src/utils/triageQueue";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, extra = "") => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n} ${extra}`); } };
const src = (p: string) => readFileSync(p, "utf8");

// ── dictation parser
const a = P("Name is Ramesh Kumar, 45 year old male, chest pain since 2 hours, BP 150 over 90, pulse 110, saturation 94, rr 22, came by ambulance, no travel history");
check("name needs an explicit cue and is title-cased", a.name === "Ramesh Kumar");
check("age + sex", a.age === 45 && a.gender === "Male");
check("vitals parsed", a.vitals.bp === "150/90" && a.vitals.hr === "110" && a.vitals.spo2 === "94" && a.vitals.rr === "22");
check("arrival", a.arrivalMode === "Ambulance");
check("'no travel history' is stored as an explicit No", a.screening.travelEndemicArea3Weeks === false);
check("complaint kept without vitals/demographics", a.complaint === "Chest pain since 2 hours", String(a.complaint));
const b = P("8 month old girl, fever and cough, temp 38.5 celsius, heart rate 160, travelled to Wayanad, isolation required droplet");
check("infant months, not years", b.age === 0 && b.ageMonths === 8 && b.gender === "Female");
check("celsius converted to °F", b.vitals.temp === "101.3", String(b.vitals.temp));
check("travel positive with place", b.screening.travelEndemicArea3Weeks === true && b.screening.travelDetails === "Wayanad");
check("isolation + type, not leaked into complaint", b.screening.isolationRequired === true && b.screening.isolationTypes?.[0] === "Droplet" && b.complaint === "Fever cough", String(b.complaint));
const c = P("70 year old female, drowsy, not oriented, sugar 48, known case of TB, wheelchair");
check("LOC, orientation, mobility, known disease", c.screening.levelOfConsciousness === "Drowsy" && c.screening.orientation === "Disoriented" && c.screening.arrivalMobility === "Wheelchair" && c.screening.knownCommunicableDisease === true && c.screening.knownCommunicableDiseaseName === "TB");
check("GRBS parsed", c.vitals.grbs === "48");
check("no complaint invented", c.complaint === undefined);
const d = P("newborn male not feeding");
check("newborn = under 1 month", d.age === 0 && d.ageMonths === 0.5);
check("empty dictation fills nothing", P("").filled.length === 0 && P("   ").filled.length === 0);
check("'not alert' is not Alert", P("patient not alert").screening.levelOfConsciousness === undefined);
check("implausible values rejected", P("BP 20 over 300, pulse 900, spo2 150").filled.length === 0);
check("no isolation / not required -> false", P("no isolation needed").screening.isolationRequired === false);
check("screening positive phrase", P("fever with rash").screening.communicableScreenPositive === true);
check("MLC only on explicit word", P("RTA, MLC case").isMlc === true && P("chest pain").isMlc === undefined);
check("temp already in F is kept", P("temperature 101.5 fahrenheit").vitals.temp === "101.5");
check("pain score", P("pain score 7").vitals.painScore === "7");

// ── queue
const mk = (id: string, level: number | undefined, cat: string, min: number, extra: any = {}) => ({
  id, awaitingDoctor: true, triagedAt: new Date(Date.UTC(2026, 9, 18, 10, 0, 0) - min * 60000).toISOString(), status: "Triage",
  patient: { name: id, age: 30, triageCategory: cat, ...(level ? { triageLevel: level } : {}) }, ...extra,
}) as any;
const now = Date.UTC(2026, 9, 18, 10, 0, 0);
const q = buildTriageQueue([mk("p4", 4, "P3 (Non-Urgent)", 50), mk("p2old", 2, "P2 (Urgent)", 20), mk("p2new", 2, "P2 (Urgent)", 3), mk("p1", 1, "P1 (Immediate)", 1), mk("legacy", undefined, "P3 (Non-Urgent)", 5)], now);
check("queue order: level then longest wait", q.map(x => x.id).join(",") === "p1,p2old,p2new,legacy,p4" || q.map(x => x.id).join(",") === "p1,p2old,p2new,p4,legacy", q.map(x => x.id).join(","));
check("wait minutes computed", q.find(x => x.id === "p2old")!.waitMinutes === 20);
check("over-target flag (P2 target 5 min)", q.find(x => x.id === "p2old")!.overTarget === true && q.find(x => x.id === "p2new")!.overTarget === false);
check("P1 any wait is over target (0 min)", q.find(x => x.id === "p1")!.overTarget === true);
check("taken / archived / discharged excluded", buildTriageQueue([mk("t", 3, "P2 (Urgent)", 5, { awaitingDoctor: false }), mk("a", 3, "P2 (Urgent)", 5, { archivedAt: "x" }), mk("d", 3, "P2 (Urgent)", 5, { status: "Discharged" }), { id: "n", status: "Triage", patient: {} } as any], now).length === 0);

// ── source wiring
const app = src("src/App.tsx");
check("queue hand-off only in hospital workspace", app.includes('Boolean(options?.queueForDoctor) && workspace.workspaceType === "hospital"'));
check("queued case has no doctor/assignee stamped", app.includes('doctorEmail: queueForDoctor ? "" : profile.email') && app.includes("...(queueForDoctor\n        ? {}\n        : {\n            currentAssigneeUid"));
check("queued case not recorded as 'Dr.' desk user", app.includes('createdByRole: queueForDoctor ? "triage"'));
check("take-patient is a transaction that checks awaitingDoctor", app.includes("runTransaction(db, async (tx)") && app.includes("current.awaitingDoctor !== true"));
check("take-patient requires active duty (same rule as takeover)", app.includes("Start your current duty before taking a patient"));
check("normal (non-queue) flow unchanged: opens case sheet", app.includes("setSelectedCaseId(newCase.id);\n    setActiveFormMode(null);\n    checkConsentOnCaseSaved();"));
check("queue toggle gated to active verified hospital members", app.includes("canQueueForDoctor={Boolean(") && app.includes("selfMembership.membershipVerified === true"));
const tf = src("src/components/TriageForm.tsx");
check("TriageForm has dictation + confirmation notice + queue toggle", tf.includes('data-testid="triage-dictation"') && tf.includes('data-testid="dictation-result"') && tf.includes('data-testid="queue-toggle"'));
check("dictation never overwrites typed fields", tf.includes("!name.trim()") && tf.includes('age === ""') && tf.includes("...r.screening, ...prev"));
check("dictation is local only (no network call)", !/fetch\(|axios|\/api\//.test(src("src/utils/triageDictation.ts")));
check("dashboard renders the queue", src("src/components/DashboardView.tsx").includes("<TriageQueueCard"));
check("no source-form number in new files", !/\/FO\/ER\/|Rev 0\d/.test(src("src/utils/triageDictation.ts") + src("src/components/TriageQueueCard.tsx") + src("src/utils/triageQueue.ts")));

console.log(`\nTriage desk: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
