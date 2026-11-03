// MARKER: ERMATE-FEATURE-TIPS-V1
// MANDATORY GATE: every user-facing feature must have a walkthrough tip. Add each new feature name to REQUIRED_FEATURES.
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { TOURS, TAB_TO_TOUR, TourId, unseenSteps, markTourSeen, markAllToursSeen, resetTours, isTourSeen, KV } from "./src/lib/coachTours";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const mem = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) }; };

// ---- ADD EVERY NEW FEATURE HERE ----
const REQUIRED_FEATURES = [
  "plan-banner", "critical-badge", "handover-choice",
  "mate-critical-query", "mate-voice", "mate-auto-bed", "whatsapp-share",
  "protocol-chips", "protocol-investigations", "protocol-flag",
];

const all = (Object.entries(TOURS) as [TourId, typeof TOURS[TourId]][]).flatMap(([tour, steps]) => steps.map(s => ({ tour, s })));
for (const f of REQUIRED_FEATURES) t(`feature "${f}" has a tip`, all.some(x => x.s.feature === f));
for (const x of all.filter(x => x.s.feature)) t(`tip "${x.s.id}" feature is registered`, REQUIRED_FEATURES.includes(x.s.feature!));
for (const x of all.filter(x => (x.s.v ?? 1) > 1)) t(`versioned tip "${x.s.id}" names its feature`, !!x.s.feature);
t("tip text is plain and short", all.every(x => x.s.body.length <= 400 && x.s.title.length <= 40));

// every selector a tip points at exists in source
const walk = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(n) ? [p] : []; });
const src = walk("src").map(f => readFileSync(f, "utf8")).join("\n");
for (const x of all.filter(x => x.s.target)) {
  const sel = x.s.target!.sel;
  const ids = [...sel.matchAll(/data-(?:coach|testid)="([^"]+)"/g)].map(m => m[1]);
  for (const id of ids) t(`target ${id} (${x.s.id}) exists in source`, src.includes(`"${id}"`) || src.includes(`data-coach="${id}"`));
}
// every data-coach in source is used by a tip (no orphan markers), nav-* is built dynamically
const used = new Set(all.flatMap(x => [...(x.s.target?.sel || "").matchAll(/data-coach="([^"]+)"/g)].map(m => m[1])));
for (const m of src.matchAll(/data-coach="([a-z-]+)"/g)) t(`data-coach="${m[1]}" is used by a tip`, used.has(m[1]));

// tabs
t("Ask ErMate tab has a tour", TAB_TO_TOUR.scribe === "scribe");
t("Protocols tour is opened by the reader", readFileSync("src/components/ProtocolsPanel.tsx", "utf8").includes('requestTour("protocols")'));

// returning doctors only see newer tips; new doctors see all; replay brings all back
const s = mem();
t("new doctor sees all cases steps", unseenSteps("a@x.com", "cases", s).length === TOURS.cases.length);
s.setItem("ermate_coach_v1_a@x.com_cases", "1"); // flag written by the first release
const fresh = unseenSteps("a@x.com", "cases", s);
t("returning doctor sees only the new critical tip", fresh.length === 1 && fresh[0].id === "critical-badge");
markTourSeen("a@x.com", "cases", s);
t("after seeing, nothing left", isTourSeen("a@x.com", "cases", s));
s.setItem("ermate_coach_v1_a@x.com_home", "1");
t("returning doctor gets plan tip on Home only", unseenSteps("a@x.com", "home", s).map(x => x.id).join() === "plan-banner");
t("never-seen scribe tour shows its tips", unseenSteps("a@x.com", "scribe", s).length === TOURS.scribe.length);
resetTours("a@x.com", s);
t("replay brings back every tip", (Object.keys(TOURS) as TourId[]).every(k => unseenSteps("a@x.com", k, s).length === TOURS[k].length));
markAllToursSeen("a@x.com", s);
t("turn off all silences even brand-new tours", (Object.keys(TOURS) as TourId[]).every(k => unseenSteps("a@x.com", k, s).length === 0));
resetTours("a@x.com", s);
t("replay also clears turn-off", unseenSteps("a@x.com", "scribe", s).length > 0);
t("other doctor unaffected", unseenSteps("b@x.com", "home", mem()).length === TOURS.home.length);
console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);