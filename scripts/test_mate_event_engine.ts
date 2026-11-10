/**
 * ErMate — behavioural tests for the MATE Events engine (Phase 1, Step 4).
 * Run: npx tsx scripts/test_mate_event_engine.ts   → exits 1 on any failure.
 * Pure: no Firestore, no network.
 */
import {
  decideAlert, planFiring, seenPatch, reviewedPatch, snoozePatch, cancelPatch,
  buildReminder, applyPatch, bedLabelFor, type MateEvent,
} from "../src/utils/mateEventEngine";
import { computeCriticalAlerts } from "../src/utils/criticalAlerts";

let fails = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) fails++; };
const T = (hhmm: string) => `2026-11-10T${hhmm}:00.000Z`;
const kase = (vitals: any, hist: any[] = [], extra: any = {}) =>
  ({ id: "c1", bedNo: "5", status: "Active", vitals, vitalsHistory: hist, ...extra }) as any;
const step = (c: any, e: MateEvent | null, type: "critical" | "abnormal", now: string) => {
  const p = decideAlert(c, e, type, now);
  return { p, e: p ? applyPatch(e, p) : e };
};

// 1. Same HR 110 logged twice → new episode, timer restarts
{
  const c1 = kase({ hr: "110" }, [{ obsId: "A", hr: 110 }]);
  let { e } = step(c1, null, "abnormal", T("10:00"));
  ok("1a abnormal opens pending, due 11:00", e!.alertState === "pending" && e!.nextFireAt === T("11:00"));
  const c2 = kase({ hr: "110" }, [{ obsId: "A", hr: 110 }, { obsId: "B", hr: 110 }]);
  e = step(c2, e, "abnormal", T("10:45")).e;
  ok("1b re-logged same value → due 11:45", e!.nextFireAt === T("11:45"));
  ok("1c nothing fires at 11:00", planFiring(e!, T("11:00")) === null);
}
// 2. Note edit → no write
{
  const c = kase({ hr: "110" }, [{ obsId: "A", hr: 110 }]);
  const e = step(c, null, "abnormal", T("10:00")).e;
  ok("2  note edit → no patch", decideAlert({ ...c, notes: "x" }, e, "abnormal", T("10:05")) === null);
}
// 3 + 4. Critical firing guard, Seen, clinical red stays
{
  const c = kase({ bp: "72/40" }, [{ obsId: "A", bp: "72/40" }]);
  let e = step(c, null, "critical", T("10:00")).e!;
  ok("3a critical opens due now", e.alertState === "due" && e.nextFireAt === T("10:00"));
  e = applyPatch(e, planFiring(e, T("10:00"))!);
  ok("3b fires once, next +15", e.occurrence === 1 && e.nextFireAt === T("10:15"));
  ok("3c tick +30s → no refire", planFiring(e, "2026-11-10T10:00:30.000Z") === null);
  ok("3d +15 min → fires", planFiring(e, T("10:15")) !== null);
  e = applyPatch(e, seenPatch(e, "u1", T("10:05"))!);
  ok("4a Seen → never fires", planFiring(e, T("12:00")) === null);
  ok("4b clinical red still present", computeCriticalAlerts(c).length === 1);
  ok("4c Seen recorded by uid", e.seenByUid === "u1" && e.seenAt === T("10:05"));
  // 5. new critical observation after Seen → new episode
  const c2 = kase({ bp: "70/40" }, [{ obsId: "A", bp: "72/40" }, { obsId: "B", bp: "70/40" }]);
  const r = step(c2, e, "critical", T("10:20"));
  ok("5a new observation → new episode due now", r.e!.alertState === "due" && r.e!.occurrence === 0);
  ok("5b old Seen cleared", r.e!.seenAt === undefined);
  // 6. normalised
  const c3 = kase({ bp: "110/70" }, [{ obsId: "A" }, { obsId: "B" }, { obsId: "C", bp: "110/70" }]);
  const closed = step(c3, r.e, "critical", T("10:30")).e!;
  ok("6  normal reading → closed normalised", closed.alertState === "closed" && closed.closedReason === "normalised");
  // 7. stale snapshot (old observation B, same key as closed episode? no — closed episode key is B)
  ok("7  stale snapshot of same episode → no resurrection", decideAlert(c2, { ...closed, episodeKey: r.e!.episodeKey }, "critical", T("10:31")) === null);
}
// 8. Abnormal fires once only; snooze fires again once
{
  const c = kase({ hr: "110" }, [{ obsId: "A", hr: 110 }]);
  let e = step(c, null, "abnormal", T("10:00")).e!;
  e = applyPatch(e, planFiring(e, T("11:00"))!);
  ok("8a abnormal fired → nextFireAt null", e.alertState === "due" && e.nextFireAt === null);
  let refires = 0;
  for (let i = 1; i <= 10; i++) if (planFiring(e, new Date(Date.parse(T("11:00")) + i * 30000).toISOString())) refires++;
  ok("8b 10 more ticks → no refire", refires === 0);
  e = applyPatch(e, snoozePatch(e, 15, T("11:05"))!);
  ok("8c snooze → fires at 11:20", planFiring(e, T("11:19")) === null && planFiring(e, T("11:20")) !== null);
}
// 9. Reviewed, then new still-abnormal observation → new episode
{
  const c = kase({ hr: "110" }, [{ obsId: "A", hr: 110 }]);
  let e = step(c, null, "abnormal", T("10:00")).e!;
  e = applyPatch(e, reviewedPatch(e, "u1", T("10:10"))!);
  ok("9a reviewed stops firing", planFiring(e, T("11:30")) === null);
  const c2 = kase({ hr: "112" }, [{ obsId: "A" }, { obsId: "B", hr: 112 }]);
  e = step(c2, e, "abnormal", T("10:40")).e!;
  ok("9b new abnormal obs → pending, reviewed cleared", e.alertState === "pending" && e.reviewedAt === undefined);
}
// 10. Paediatric
ok("10 paediatric HR 160 → no alert", decideAlert(kase({ hr: "160" }, [], { isPediatric: true }), null, "critical", T("10:00")) === null);
// 11. Discharged / archived / absent
{
  const c = kase({ bp: "72/40" }, [{ obsId: "A" }]);
  const e = step(c, null, "critical", T("10:00")).e!;
  ok("11a discharged → closed", decideAlert({ ...c, status: "Discharged" }, e, "critical", T("10:05"))?.closedReason === "discharged");
  ok("11b archived → closed", decideAlert({ ...c, archivedAt: "x" }, e, "critical", T("10:05"))?.closedReason === "archived");
  ok("11c discharged with no event → nothing", decideAlert({ ...c, status: "Discharged" }, null, "critical", T("10:05")) === null);
}
// 12. Two devices claim the same occurrence → only one wins (simulated transaction)
{
  const c = kase({ bp: "72/40" }, [{ obsId: "A" }]);
  let server = step(c, null, "critical", T("10:00")).e!;
  const claim = () => { const p = planFiring(server, T("10:00")); if (!p) return false; server = applyPatch(server, p); return true; };
  const a = claim(); const b = claim();
  ok("12 two claims → exactly one presentation", [a, b].filter(Boolean).length === 1 && server.occurrence === 1);
}
// 13. Stale device holds pre-Seen copy; decision against server doc → no overwrite
{
  const c = kase({ bp: "72/40" }, [{ obsId: "A" }]);
  let server = step(c, null, "critical", T("10:00")).e!;
  server = applyPatch(server, seenPatch(server, "u1", T("10:02"))!);
  ok("13 sync against Seen doc → no patch", decideAlert(c, server, "critical", T("10:03")) === null);
}
// 14. Reminders
{
  ok("14a no case → not created", buildReminder({ caseId: "", bedLabel: "", minutes: 10 }, [], T("10:00")) === null);
  const r1 = buildReminder({ caseId: "c1", bedLabel: "Bed 5", minutes: 10 }, [], T("10:00"))!;
  ok("14b reminder due 10:10", r1.nextFireAt === T("10:10"));
  ok("14c duplicate within 60s → not created", buildReminder({ caseId: "c1", bedLabel: "Bed 5", minutes: 10 }, [r1], "2026-11-10T10:00:30.000Z") === null);
  const fired = applyPatch(r1, planFiring(r1, T("10:10"))!);
  ok("14d reminder fires once", fired.nextFireAt === null && planFiring(fired, T("10:20")) === null);
  ok("14e cancel reminder", cancelPatch(r1, T("10:01"))?.alertState === "cancelled");
}
// 15. GCS: only E/V/M (all explicit) = sum (option B); partial = nothing
ok("15a E2V2M3 → critical GCS 7", decideAlert(kase({ gcs_e: "2", gcs_v: "2", gcs_m: "3" }), null, "critical", T("10:00"))?.body === "GCS 7");
ok("15b E2V2 only → no alert", decideAlert(kase({ gcs_e: "2", gcs_v: "2" }), null, "critical", T("10:00")) === null);
// 16. D3 bed label, never a name
ok("16a bed label", bedLabelFor({ id: "x", bedNo: "11A" } as any) === "Bed 11A");
ok("16b no name in title/body", (() => { const p = decideAlert(kase({ bp: "72/40" }, [], { patient: { name: "Ramesh" } }), null, "critical", T("10:00"))!; return !`${p.title}${p.body}${p.bedLabel}`.includes("Ramesh"); })());
// 17. Quick Discharge zeros never alert
ok("17 zeros → no alert", decideAlert(kase({ hr: "0", spo2: "0", rr: "0", grbs: "0" }), null, "critical", T("10:00")) === null);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);