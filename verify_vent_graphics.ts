/**
 * ER Guide › Airway & Ventilation › Ventilator graphics (26 Nov 2026, Neeraj: "pictures and animation about
 * ventilator graphs ... normal as well as abnormal").
 */
import fs from "node:fs";
import { VENT_GRAPHICS, VENT_GROUPS, VENT_GRAPHICS_REFERENCES, GRAPH_W, GRAPH_X0 } from "./src/data/ventGraphics";
const X = (sec: number) => GRAPH_X0 + (sec / 10) * (GRAPH_W - GRAPH_X0);
import { findTopic } from "./src/data/protocols";

let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const card = (id: string) => VENT_GRAPHICS.find((c) => c.id === id)!;
const pts = (d: string) => d.replace(/^M/, "").replace(/ Z$/, "").split(" L").map((s) => s.trim().split(" ").map(Number));
const yAt = (d: string, x: number) => pts(d).reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];

t("14 graphs", VENT_GRAPHICS.length === 14);
t("ids unique", new Set(VENT_GRAPHICS.map((c) => c.id)).size === 14);
t("normal and abnormal both present", VENT_GRAPHICS.filter((c) => c.group === "normal").length === 4 && VENT_GRAPHICS.filter((c) => c.group !== "normal").length === 10);
t("every abnormal graph can show the normal underneath", VENT_GRAPHICS.filter((c) => c.group !== "normal").every((c) => c.compare && c.compare.graph.kind === c.graph.kind));
t("every card has what you see, causes and what to do", VENT_GRAPHICS.every((c) => c.see.length >= 2 && c.causes.length > 20 && c.todo.length >= 1 && c.values.length >= 2));
t("every link opens a real Handbook topic", VENT_GRAPHICS.every((c) => c.links.every((l) => !!findTopic(l.id))));
t("every path is finite (no NaN)", VENT_GRAPHICS.every((c) => { const g: any = c.graph; const ds = g.kind === "scalar" ? [g.p, g.f, g.v] : [g.path]; return ds.every((d: string) => !/NaN|Infinity/.test(d) && pts(d).length > 100); }));
t("filters cover every group", VENT_GROUPS.length === 5 && VENT_GRAPHICS.every((c) => VENT_GROUPS.some((g) => g.id === c.group)));
t("references listed", VENT_GRAPHICS_REFERENCES.length >= 3);

// The drawn shapes show the teaching point
const nvc: any = card("normal-vc").graph;
t("normal VC: PIP 25, Pplat 18", nvc.refs.map((r: any) => r.label).join(",") === "PIP 25,Pplat 18");
const hr: any = card("high-resistance").graph;
t("high resistance: PIP 38 with normal Pplat 18", hr.refs.map((r: any) => r.label).join(",") === "PIP 38,Pplat 18");
const lc: any = card("low-compliance").graph;
t("low compliance: PIP 40 and Pplat 33 (both high, gap normal)", lc.refs.map((r: any) => r.label).join(",") === "PIP 40,Pplat 33");
const ap: any = card("auto-peep").graph;
t("auto-PEEP: expiratory flow still below zero when the next breath starts (marked)", ap.marks.length >= 3 && ap.marks.every((m: any) => m.y > 97));
const lk: any = card("leak").graph;
t("leak: volume has not returned to zero just before the next breath", yAt(lk.v, X(4.95)) < 200 && yAt(nvc.v, X(4.95)) > 206);
const dt: any = card("double-trigger").graph;
const maxVol = Math.min(...pts(dt.v).map((p) => p[1]));
t("double trigger: volume stacks above one tidal volume", maxVol < 208 - 46 - 5);
const st: any = card("secretions").graph;
const flowYs = pts(st.f).slice(100, 200).map((p) => p[1]);
let turns = 0; for (let i = 2; i < flowYs.length; i++) if ((flowYs[i] - flowYs[i - 1]) * (flowYs[i - 1] - flowYs[i - 2]) < 0) turns++;
t("secretions: sawtooth (many turns) on the flow curve", turns > 15);
t("missed trigger: efforts marked", (card("missed-trigger").graph as any).marks.length === 2);
const fs1: any = card("flow-starvation").graph;
t("flow starvation: inspiratory pressure is scooped below the normal curve", yAt(fs1.p, X(0.4)) > yAt(nvc.p, X(0.4)) + 3);
const cy: any = card("cycling").graph;
t("early cycling: inspiratory flow bump after the breath ends", yAt(cy.f, X(0.8)) < 96);
t("traces start after the channel labels", VENT_GRAPHICS.filter((c) => c.graph.kind === "scalar").every((c: any) => pts(c.graph.p)[0][0] >= GRAPH_X0));
const fvN: any = card("fv-loop").compare!.graph, fvO: any = card("fv-loop").graph;
const minY = (d: string) => Math.max(...pts(d).map((p) => p[1]));
t("flow–volume: obstruction has a lower expiratory peak than normal", minY(fvO.path) < minY(fvN.path) - 20);
t("loops are drawn as loops", card("pv-loop").graph.kind === "loop" && card("fv-loop").graph.kind === "loop");

// Wiring
const view = fs.readFileSync("src/components/ErGuideView.tsx", "utf8");
const panel = fs.readFileSync("src/components/VentilatorGraphicsPanel.tsx", "utf8");
t("Airway & Ventilation has a Ventilator Graphics tab", /\{ id: "ventgfx", label: "Ventilator Graphics" \}/.test(view) && /activeSubTab === "ventgfx"/.test(view));
t("card links open the Handbook topic", /onOpenTopic=\{\(id\) => \{ setHandbookTopic\(id\); setActiveSubTab\("protocols"\)/.test(view) && /<ProtocolsPanel key=\{handbookTopic \|\| "handbook"\} initialTopicId=\{handbookTopic\} \/>/.test(view));
t("animation: trace + sweep, pausable, off for reduced motion", /vgx-trace/.test(panel) && /vgx-paused/.test(panel) && /prefers-reduced-motion/.test(panel));
t("Show normal toggle and Play/Pause buttons", /aria-pressed=\{showCompare\}/.test(panel) && /setPaused/.test(panel));
t("walkthrough tip", /feature: "vent-graphics"/.test(fs.readFileSync("src/lib/coachTours.ts", "utf8")));

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);