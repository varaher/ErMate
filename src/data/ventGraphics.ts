// ErMate ER Guide — Airway & Ventilation › Ventilator graphics (26 Nov 2026, Neeraj).
// Waveforms are DRAWN from a simple breath model (no copied pictures): pressure, flow and volume against time,
// plus pressure–volume and flow–volume loops. Each card shows what the pattern looks like, the common ER causes
// and what to do. Draft for clinical sign-off.

export type VentGroup = "normal" | "mechanics" | "trapping" | "asynchrony";

export interface VentCurves {
  kind: "scalar";
  p: string; f: string; v: string;
  /** Reference lines on the pressure channel (PIP, Pplat, PEEP) */
  refs: Array<{ y: number; label: string; tone: "peak" | "plateau" }>;
  peepY: number;
  /** Red circles on the problem points */
  marks: Array<{ x: number; y: number }>;
}
export interface VentLoop {
  kind: "loop";
  path: string;
  xLabel: string; yLabel: string;
}
export type VentGraph = VentCurves | VentLoop;

export interface VentCard {
  id: string;
  group: VentGroup;
  title: string;
  mode: string;
  /** Figures shown under the graph */
  values: Array<[string, string]>;
  see: string[];
  causesTitle: string;
  causes: string;
  todo: string[];
  /** Handbook topic ids this card links to */
  links: Array<{ id: string; label: string }>;
  /** The live (animated) graph and the faint comparison drawn under it */
  graph: VentGraph;
  compare?: { graph: VentGraph; label: string };
}

// ---------------------------------------------------------------------------------------------------------------
// Breath model. Time window 10 s, drawn into a 326 × 214 box (pressure top, flow middle, volume bottom).
// ---------------------------------------------------------------------------------------------------------------
export const GRAPH_W = 326;
export const GRAPH_H = 214;
/** Traces start after the channel labels (P / Flow / Vol) so the labels never sit on a curve. */
export const GRAPH_X0 = 24;
const WIN = 10;
const N = 520;
const pY = (v: number) => 62 - (v / 45) * 52;
// Flow is clipped to the channel (−110 to +70 L/min) so a very fast exhalation never runs into the volume curve.
const fY = (v: number) => 96 - Math.max(-110, Math.min(70, v)) * 0.42;
const vY = (v: number) => 208 - (v / 600) * 46;
const r1 = (n: number) => Math.round(n * 10) / 10;

interface BreathCfg {
  mode: "vc" | "pc";
  /** Breath start times (s) inside the 10-s window */
  starts: number[];
  peep: number;
  /** VC: set tidal volume (mL); PC: inspiratory pressure above PEEP */
  vt: number;
  pinsp?: number;
  tf: number;        // VC: inspiratory flow time; PC: inspiratory time
  hold: number;      // VC inspiratory hold (s)
  r: number;         // VC: resistive pressure (cmH2O) at set flow
  el: number;        // VC: elastic pressure at full Vt (Vt / compliance)
  tau: number;       // expiratory time constant (s)
  tauI?: number;     // PC inspiratory time constant (s)
  /** fraction of each breath lost to a leak (0–1): exhaled volume never returns to baseline */
  leak?: number;
  /** let volume stack from one breath to the next (double triggering) */
  stack?: boolean;
  /** extra shaping */
  sawtooth?: boolean;
  scoop?: number;                 // flow starvation: dip (cmH2O) in the inspiratory pressure
  missedEfforts?: number[];       // times of ineffective efforts (s)
  cardiacRipple?: boolean;        // auto-triggering
  late?: number[];                // breath indexes cycled late (pressure spike at end of inspiration)
  early?: number[];               // breath indexes cycled early (flow bump after cycling)
  tfPer?: Record<number, number>; // inspiratory time per breath index
  markEndFlow?: boolean;
}

function scalar(cfg: BreathCfg): VentCurves {
  const p: string[] = [], f: string[] = [], v: string[] = [];
  const marks: Array<{ x: number; y: number }> = [];
  const starts = cfg.starts;
  let peakP = cfg.peep;
  // residual volume carried into each breath (only when stacking)
  const residual: number[] = [];
  let lastEnd = 0;
  for (let b = 0; b < starts.length; b++) residual[b] = 0;

  const breathAt = (t: number) => {
    let b = -1;
    for (let i = 0; i < starts.length; i++) if (t >= starts[i]) b = i;
    return b;
  };

  // Volume at the end of a breath's inspiration and at a time te into its expiration.
  const tfOf = (b: number) => (cfg.tfPer && cfg.tfPer[b] !== undefined ? cfg.tfPer[b] : cfg.tf);
  const inspVol = (b: number, tb: number) => {
    const tf = tfOf(b);
    if (cfg.mode === "vc") return (cfg.vt * Math.min(tb, tf)) / tf;
    const tauI = cfg.tauI || 0.45;
    const peakFlow = (cfg.pinsp || 15) * 4; // L/min
    return (peakFlow / 60) * 1000 * tauI * (1 - Math.exp(-Math.min(tb, tf) / tauI));
  };

  for (let i = 0; i <= N; i++) {
    const t = (i / N) * WIN;
    const x = r1(GRAPH_X0 + (t / WIN) * (GRAPH_W - GRAPH_X0));
    const b = breathAt(t);
    let P = cfg.peep, F = 0, V = 0;
    if (b >= 0) {
      const tb = t - starts[b];
      const tf = tfOf(b);
      const ti = tf + (cfg.mode === "vc" ? cfg.hold : 0);
      const base = cfg.stack ? residual[b] : 0;
      if (cfg.mode === "vc") {
        const fin = (cfg.vt / 1000 / tf) * 60;
        if (tb < tf) {
          const rise = Math.min(1, tb / 0.06);
          F = fin * rise;
          V = base + inspVol(b, tb);
          P = cfg.peep + cfg.r * rise + (cfg.el * V) / cfg.vt;
          if (cfg.scoop) P -= cfg.scoop * Math.sin((Math.PI * tb) / tf);
        } else if (tb < ti) {
          F = 0; V = base + cfg.vt;
          P = cfg.peep + (cfg.el * V) / cfg.vt + cfg.r * Math.exp(-(tb - tf) / 0.04);
        } else {
          const te = tb - ti;
          const v0 = base + cfg.vt;
          const exhaled = cfg.leak ? 1 - cfg.leak : 1;
          V = v0 - v0 * exhaled * (1 - Math.exp(-te / cfg.tau));
          F = -((v0 * exhaled) / 1000 / cfg.tau) * 60 * Math.exp(-te / cfg.tau);
          P = cfg.peep + cfg.el * (v0 / cfg.vt) * Math.exp(-te / 0.09);
        }
      } else {
        // Pressure control / pressure support: square pressure, decelerating flow
        const tauI = cfg.tauI || 0.45;
        const peakFlow = (cfg.pinsp || 15) * 4;
        if (tb < tf) {
          P = cfg.peep + (cfg.pinsp || 15) * (1 - Math.exp(-tb / 0.05));
          F = peakFlow * Math.exp(-tb / tauI);
          V = inspVol(b, tb);
          if (cfg.late && cfg.late.includes(b) && tb > tf - 0.3) P += 6 * Math.sin(((tb - (tf - 0.3)) / 0.3) * Math.PI);
        } else {
          const te = tb - tf;
          const v0 = inspVol(b, tf);
          V = v0 * Math.exp(-te / cfg.tau);
          F = -(v0 / 1000 / cfg.tau) * 60 * Math.exp(-te / cfg.tau);
          P = cfg.peep + (cfg.pinsp || 15) * Math.exp(-te / 0.06);
          if (cfg.early && cfg.early.includes(b)) {
            // patient still breathing in after the ventilator cycled off
            const bump = Math.exp(-Math.pow((te - 0.25) / 0.12, 2));
            F += 38 * bump; P -= 2.5 * bump;
          }
        }
      }
      if (cfg.sawtooth) {
        const s = Math.sin(2 * Math.PI * 9 * t);
        F += (F < 0 ? 6 : 3) * s;
        P += 0.8 * s;
      }
      if (cfg.cardiacRipple && F <= 0) {
        F += 4 * Math.sin(2 * Math.PI * 1.6 * t);
      }
      if (cfg.missedEfforts) {
        for (const m of cfg.missedEfforts) {
          const g = Math.exp(-Math.pow((t - m) / 0.13, 2));
          F += 22 * g; P -= 2 * g;
        }
      }
      // remember what is left in the lungs for the next breath (stacking / end-expiratory flow marks)
      if (b + 1 < starts.length && t <= starts[b + 1] && t + WIN / N > starts[b + 1]) {
        residual[b + 1] = cfg.stack ? Math.max(0, V) : 0;
        if (cfg.markEndFlow && F < -2) marks.push({ x, y: r1(fY(F)) });
      }
    }
    peakP = Math.max(peakP, P);
    lastEnd = t;
    p.push(`${x} ${r1(pY(P))}`);
    f.push(`${x} ${r1(fY(F))}`);
    v.push(`${x} ${r1(vY(Math.max(0, V)))}`);
  }
  void lastEnd;
  const refs: VentCurves["refs"] = [];
  if (cfg.mode === "vc") {
    const pip = Math.round(cfg.peep + cfg.r + cfg.el);
    const plat = Math.round(cfg.peep + cfg.el);
    refs.push({ y: r1(pY(pip)), label: `PIP ${pip}`, tone: "peak" });
    if (cfg.hold > 0) refs.push({ y: r1(pY(plat)), label: `Pplat ${plat}`, tone: "plateau" });
  } else {
    const pk = Math.round(cfg.peep + (cfg.pinsp || 15));
    refs.push({ y: r1(pY(pk)), label: `Peak ${pk}`, tone: "peak" });
  }
  return { kind: "scalar", p: "M" + p.join(" L"), f: "M" + f.join(" L"), v: "M" + v.join(" L"), refs, peepY: r1(pY(cfg.peep)), marks };
}

/**
 * One breath as a loop. "pv": pressure (x) vs volume (y), anticlockwise; "fv": volume (x) vs flow (y),
 * inspiration above the line (left → right), expiration below (right → left).
 */
function loop(kind: "pv" | "fv", cfg: { r: number; el: number; peep: number; vt: number; overdistend?: boolean; obstructed?: boolean }): VentLoop {
  const n = 160;
  const pts: string[] = [];
  const X = (val: number, max: number) => r1(30 + (val / max) * 280);
  const Ypv = (vol: number) => r1(196 - (vol / 600) * 176);
  const Yfv = (flow: number) => r1(90 - flow * 0.95);
  const fin = 37.5; // L/min, square inspiratory flow (500 mL over 0.8 s)
  for (let i = 0; i <= n; i++) {
    const insp = i <= n / 2;
    const s = insp ? i / (n / 2) : (i - n / 2) / (n / 2); // 0 → 1 through each phase
    if (kind === "pv") {
      let P: number, V: number;
      if (insp) {
        V = cfg.vt * s;
        P = cfg.peep + cfg.r * Math.min(1, s / 0.07) + (cfg.el * V) / cfg.vt;
        if (cfg.overdistend && s > 0.65) P += 16 * Math.pow((s - 0.65) / 0.35, 2);
      } else {
        // expiration: pressure falls first, volume follows (hysteresis: the expiratory limb lies to the left)
        V = cfg.vt * (1 - s);
        const pTop = cfg.peep + cfg.r + cfg.el + (cfg.overdistend ? 16 : 0);
        const pCurve = cfg.peep + cfg.el * Math.pow(V / cfg.vt, 1.8) * 0.85;
        const k = Math.min(1, s / 0.12); // pressure falls quickly but smoothly from the top of the loop
        P = pTop * (1 - k) + pCurve * k;
      }
      pts.push(`${X(P, 45)} ${Ypv(V)}`);
    } else {
      let V: number, F: number;
      if (insp) {
        V = cfg.vt * s; F = fin * Math.min(1, s / 0.05) * Math.min(1, (1 - s) / 0.03 + 0.001);
      } else {
        V = cfg.vt * (1 - s);
        const frac = V / cfg.vt;            // fraction still to breathe out
        const onset = Math.min(1, s / 0.04); // flow peaks almost at once
        // normal: peak then a straight fall with volume; obstruction: low peak and a scooped (concave) limb
        F = cfg.obstructed ? -45 * onset * Math.pow(frac, 2.4) : -95 * onset * frac;
      }
      pts.push(`${X(V, 600)} ${Yfv(F)}`);
    }
  }
  return kind === "pv"
    ? { kind: "loop", path: "M" + pts.join(" L") + " Z", xLabel: "Pressure (cmH₂O) →", yLabel: "Volume (mL) ↑" }
    : { kind: "loop", path: "M" + pts.join(" L") + " Z", xLabel: "Volume (mL) →", yLabel: "Flow: in ↑ out ↓" };
}

const every = (period: number, from = 0) => {
  const s: number[] = [];
  for (let t = from; t < WIN; t += period) s.push(Math.round(t * 1000) / 1000);
  return s;
};
const VC = { mode: "vc" as const, peep: 5, vt: 500, tf: 0.8, hold: 0.3, r: 7, el: 13, tau: 0.3 };
const PC = { mode: "pc" as const, peep: 5, vt: 0, pinsp: 15, tf: 1.0, hold: 0, r: 0, el: 0, tau: 0.45, tauI: 0.45 };

const normalVc = scalar({ ...VC, starts: every(5) });
const normalPc = scalar({ ...PC, starts: every(5) });

// ---------------------------------------------------------------------------------------------------------------
// The 14 cards
// ---------------------------------------------------------------------------------------------------------------
export const VENT_GRAPHICS: VentCard[] = [
  {
    id: "normal-vc", group: "normal", title: "Volume control: normal breath", mode: "VC · RR 12 · Vt 500 mL · PEEP 5",
    values: [["PIP", "25"], ["Pplat", "18"], ["PEEP", "5"], ["PIP − Pplat", "7"], ["Driving pressure", "13"]],
    see: [
      "Flow is square while air goes in, then stops for the inspiratory hold.",
      "Pressure rises to the peak (PIP), then settles to the plateau (Pplat) during the hold.",
      "Expiratory flow and volume return to baseline before the next breath.",
    ],
    causesTitle: "Numbers to remember",
    causes: "PIP − Pplat reflects airway resistance (normally under 10). Pplat − PEEP is the driving pressure (aim 15 or less). Keep Pplat 30 or less.",
    todo: ["Use this as the reference breath: tap Show normal on any abnormal graph to compare."],
    links: [{ id: "rsi-procedure", label: "RSI — the 7 Ps" }],
    graph: normalVc,
  },
  {
    id: "normal-pc", group: "normal", title: "Pressure control: normal breath", mode: "PC · RR 12 · Pinsp 15 · PEEP 5",
    values: [["Peak pressure", "20"], ["PEEP", "5"], ["Vt", "≈ 400 mL (varies)"]],
    see: [
      "Pressure is square: it rises quickly to the set level and holds until the breath ends.",
      "Flow starts high and falls (decelerating) as the lungs fill.",
      "Tidal volume is not fixed: it changes with the lungs and the patient's effort.",
    ],
    causesTitle: "Watch for",
    causes: "Falling tidal volume at the same pressure means the lungs are getting stiffer or the airway is narrowing.",
    todo: ["Set an alarm for low tidal volume and low minute ventilation.", "If inspiratory flow does not reach zero before the breath ends, a longer inspiratory time may add volume."],
    links: [{ id: "rsi-procedure", label: "RSI — the 7 Ps" }],
    graph: normalPc,
  },
  {
    id: "pv-loop", group: "normal", title: "Pressure–volume loop", mode: "VC · one breath · normal vs overdistension",
    values: [["Normal", "smooth, upright loop"], ["Overdistension", "flat ‘beak’ at the top"]],
    see: [
      "The loop runs anticlockwise: inspiration on the right, expiration on the left.",
      "A steeper loop means more compliant lungs; a flatter loop means stiffer lungs.",
      "A flat ‘beak’ at the top means pressure keeps rising with little more volume: overdistension.",
    ],
    causesTitle: "Common ER causes of a beak",
    causes: "Tidal volume too large for the patient's lungs (ARDS, one-lung intubation, small patient).",
    todo: ["Check tube depth and air entry on both sides.", "Reduce tidal volume to 6 mL/kg ideal body weight; keep Pplat 30 or less."],
    links: [{ id: "rsi-procedure", label: "RSI — the 7 Ps" }],
    graph: loop("pv", { r: 7, el: 13, peep: 5, vt: 500, overdistend: true }),
    compare: { graph: loop("pv", { r: 7, el: 13, peep: 5, vt: 500 }), label: "Show normal" },
  },
  {
    id: "fv-loop", group: "normal", title: "Flow–volume loop", mode: "VC · one breath · normal vs obstruction",
    values: [["Normal", "expiratory limb straight"], ["Obstruction", "expiratory limb scooped"]],
    see: [
      "Inspiration is above the line, expiration below.",
      "In airway obstruction the expiratory limb is low and scooped (concave).",
      "If the loop does not close back at zero flow, air is trapped or leaking.",
    ],
    causesTitle: "Common ER causes of a scooped limb",
    causes: "Bronchospasm (asthma, COPD, anaphylaxis), secretions, kinked or narrow tube.",
    todo: ["Treat as high airway resistance (see that card): check the tube, suction, bronchodilator."],
    links: [{ id: "dyspnea-adult", label: "Breathlessness" }],
    graph: loop("fv", { r: 20, el: 13, peep: 5, vt: 500, obstructed: true }),
    compare: { graph: loop("fv", { r: 7, el: 13, peep: 5, vt: 500 }), label: "Show normal" },
  },
  {
    id: "high-resistance", group: "mechanics", title: "High airway resistance", mode: "VC · RR 12 · Vt 500 mL · PEEP 5",
    values: [["PIP", "38 ↑"], ["Pplat", "18"], ["PIP − Pplat", "20 ↑"]],
    see: [
      "PIP is high but the plateau is normal: the gap between them is over 10.",
      "Expiratory flow is lower and drawn out (scooped).",
      "The lungs are not stiff: the problem is in the tube or the airways.",
    ],
    causesTitle: "Common ER causes",
    causes: "Bronchospasm (asthma, COPD, anaphylaxis), kinked or bitten tube, secretions or mucus plug, small tube, blocked HME filter.",
    todo: [
      "Check the tube and circuit: kinks, biting (bite block), blocked filter.",
      "Pass a suction catheter: if it will not pass, the tube is blocked — change it.",
      "Treat bronchospasm: in-line salbutamol, steroid; consider ketamine for sedation.",
      "Do not raise the rate to clear CO₂: it causes air trapping.",
    ],
    links: [{ id: "anaphylaxis-adult", label: "Anaphylaxis" }, { id: "dyspnea-adult", label: "Breathlessness" }],
    graph: scalar({ ...VC, starts: every(5), r: 20, tau: 0.85 }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "low-compliance", group: "mechanics", title: "Low compliance (stiff lungs or chest)", mode: "VC · RR 12 · Vt 500 mL · PEEP 5",
    values: [["PIP", "40 ↑"], ["Pplat", "33 ↑"], ["PIP − Pplat", "7"], ["Driving pressure", "28 ↑"]],
    see: [
      "PIP and plateau are BOTH high; the gap between them stays normal.",
      "Expiration is fast and short: stiff lungs empty quickly.",
      "Plateau over 30 or driving pressure over 15 risks lung injury.",
    ],
    causesTitle: "Common ER causes",
    causes: "Tension pneumothorax, ARDS, pulmonary oedema, pneumonia, tube in the right main bronchus, abdominal distension, chest wall burns.",
    todo: [
      "Sudden rise: think DOPE — Displaced tube, Obstruction, Pneumothorax, Equipment. Check air entry on both sides.",
      "Tension pneumothorax with hypotension: decompress now.",
      "Pull back a tube that is too deep; treat the cause (diuretic for oedema).",
      "Lower tidal volume to 6 mL/kg ideal body weight; keep Pplat 30 or less.",
    ],
    links: [{ id: "tension-pneumothorax-adult", label: "Tension pneumothorax" }, { id: "pneumonia-adult", label: "Pneumonia" }],
    graph: scalar({ ...VC, starts: every(5), el: 28, tau: 0.18 }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "auto-peep", group: "trapping", title: "Air trapping (auto-PEEP)", mode: "VC · RR 25 · Vt 500 mL · PEEP 5",
    values: [["Set PEEP", "5"], ["End-expiratory flow", "not zero"], ["Effect", "BP may fall"]],
    see: [
      "Expiratory flow does not reach zero before the next breath starts (red circles).",
      "Air stays in the lungs and builds up breath after breath.",
      "Over time PIP and plateau rise and blood pressure can fall.",
    ],
    causesTitle: "Common ER causes",
    causes: "Rate set too high, long inspiratory time, large tidal volume, asthma or COPD with slow emptying.",
    todo: [
      "Hypotensive or in arrest: disconnect the tube for 10–20 seconds and let the chest empty.",
      "Give more time to breathe out: lower the rate (10–12), raise inspiratory flow, shorten inspiratory time.",
      "Lower the tidal volume and accept a higher CO₂.",
      "Measure it with an expiratory hold; treat the bronchospasm.",
    ],
    links: [{ id: "dyspnea-adult", label: "Breathlessness" }, { id: "post-rosc-adult", label: "Post-ROSC care" }],
    graph: scalar({ ...VC, starts: every(2.4), hold: 0, r: 14, tau: 1.0, markEndFlow: true }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "leak", group: "trapping", title: "Leak (cuff, circuit or chest drain)", mode: "VC · RR 12 · Vt 500 mL · PEEP 5",
    values: [["Set Vt", "500 mL"], ["Exhaled Vt", "≈ 350 mL ↓"]],
    see: [
      "The volume curve does not come back to zero; it drops straight down when the next breath starts.",
      "Exhaled tidal volume is less than the set volume.",
      "PEEP may not hold; the ventilator may alarm for low minute volume.",
    ],
    causesTitle: "Common ER causes",
    causes: "Cuff leak or burst cuff, tube pulled up to the cords, loose circuit connection, bronchopleural fistula through a chest drain.",
    todo: [
      "Listen at the mouth for a leak; check cuff pressure (20–30 cmH₂O) and tube depth at the lips.",
      "Check every circuit connection, including the filter and the closed suction.",
      "Tube at the cords or burst cuff: re-secure or change the tube.",
      "Air leak through a chest drain: inform the surgeon; avoid high pressures.",
    ],
    links: [{ id: "chest-drain-procedure", label: "Chest drain" }],
    graph: scalar({ ...VC, starts: every(5), leak: 0.3 }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "secretions", group: "trapping", title: "Secretions or water in the circuit", mode: "VC · RR 12 · Vt 500 mL · PEEP 5",
    values: [["Pattern", "sawtooth"], ["Where", "mainly expiratory flow"]],
    see: [
      "A sawtooth (fine zigzag) pattern on the flow curve, often the pressure curve too.",
      "PIP may creep up as secretions build.",
      "You may hear crackles over the trachea or see water in the tubing.",
    ],
    causesTitle: "Common ER causes",
    causes: "Secretions in the tube or airways, condensed water in the circuit, blood after airway trauma.",
    todo: [
      "Suction the tube (closed suction if available).",
      "Drain water from the circuit, away from the patient.",
      "Check the HME filter and change it if wet or blocked.",
    ],
    links: [],
    graph: scalar({ ...VC, starts: every(5), sawtooth: true }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "missed-trigger", group: "asynchrony", title: "Missed trigger (ineffective effort)", mode: "Assist · RR 12 · PEEP 5",
    values: [["Patient efforts", "more than breaths given"], ["Sign", "bumps without a breath"]],
    see: [
      "Small upward bumps in expiratory flow (with a dip in pressure) that are NOT followed by a breath (red circles).",
      "The patient is trying to breathe but the ventilator does not respond.",
      "Often seen with air trapping: the effort cannot overcome the trapped pressure.",
    ],
    causesTitle: "Common ER causes",
    causes: "Auto-PEEP, trigger set too insensitive, weak patient (heavy sedation, neuromuscular weakness), too much support.",
    todo: [
      "Treat air trapping first (see that card).",
      "Make the trigger more sensitive (flow trigger 1–2 L/min), without causing auto-triggering.",
      "Review sedation and the level of support.",
    ],
    links: [],
    graph: (() => {
      const g = scalar({ ...VC, starts: every(5), tau: 0.7, missedEfforts: [2.9, 7.9] });
      g.marks = [2.9, 7.9].map((t) => ({ x: r1(GRAPH_X0 + (t / WIN) * (GRAPH_W - GRAPH_X0)), y: r1(fY(-4)) }));
      return g;
    })(),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "double-trigger", group: "asynchrony", title: "Double triggering (breath stacking)", mode: "VC · Vt 500 mL · PEEP 5",
    values: [["Set Vt", "500 mL"], ["Stacked", "≈ 750 mL ↑"], ["Risk", "volutrauma"]],
    see: [
      "Two breaths come back to back, with little or no exhalation between them.",
      "Volume stacks: the second breath starts before the first is breathed out, so the lungs get far more than the set volume.",
      "Peak pressure on the second breath is higher.",
    ],
    causesTitle: "Common ER causes",
    causes: "Patient wants a longer or bigger breath than set: inspiratory time too short, tidal volume too small for a strong respiratory drive (acidosis, pain, anxiety).",
    todo: [
      "Treat the drive: analgesia, sedation, correct acidosis.",
      "Lengthen inspiratory time or lower the inspiratory flow; consider a pressure mode.",
      "Re-check tidal volume per kg ideal body weight after the change.",
    ],
    links: [],
    graph: scalar({ ...VC, starts: [0, 1.1, 5, 6.1], hold: 0.1, tau: 0.3, stack: true }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "flow-starvation", group: "asynchrony", title: "Flow starvation", mode: "VC · RR 12 · Vt 500 mL · PEEP 5",
    values: [["Pressure curve", "scooped (concave)"], ["Patient", "working hard"]],
    see: [
      "The inspiratory pressure curve is scooped inwards instead of rising smoothly.",
      "The patient is pulling in air faster than the set flow gives it.",
      "You may see the patient using accessory muscles.",
    ],
    causesTitle: "Common ER causes",
    causes: "Inspiratory flow set too low for a breathless, acidotic or anxious patient; high respiratory drive.",
    todo: [
      "Increase the inspiratory flow (60–80 L/min) or switch to a decelerating flow pattern.",
      "Consider a pressure mode, which gives flow on demand.",
      "Treat the drive: analgesia, sedation, acidosis.",
    ],
    links: [],
    graph: scalar({ ...VC, starts: every(5), scoop: 12 }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "auto-trigger", group: "asynchrony", title: "Auto-triggering", mode: "Assist · set RR 12 · measured RR 28",
    values: [["Set rate", "12"], ["Measured rate", "28 ↑"]],
    see: [
      "Breaths are delivered faster than the patient is breathing, with no patient effort before them.",
      "Small ripples on the baseline flow, often in time with the heartbeat.",
      "Measured rate is much higher than the set rate; CO₂ falls.",
    ],
    causesTitle: "Common ER causes",
    causes: "Trigger too sensitive, leak in the circuit or cuff, water in the tubing, strong cardiac oscillations (hyperdynamic heart).",
    todo: [
      "Look at the patient: is he really breathing at that rate?",
      "Fix any leak or water in the circuit.",
      "Make the trigger less sensitive (for example flow trigger 3–5 L/min).",
    ],
    links: [],
    graph: scalar({ ...VC, starts: [0, 2.1, 4.1, 6.2, 8.2], hold: 0.1, tau: 0.3, cardiacRipple: true }),
    compare: { graph: normalVc, label: "Show normal" },
  },
  {
    id: "cycling", group: "asynchrony", title: "Early and late cycling", mode: "PC / PS · PEEP 5",
    values: [["Breath 1", "cycled early"], ["Breath 2", "cycled late"]],
    see: [
      "Early: the ventilator stops while the patient is still breathing in — a second bump of inspiratory flow just after the breath ends.",
      "Late: the ventilator keeps pushing after the patient starts to breathe out — a pressure spike at the end of the breath.",
      "Both make the patient fight the ventilator.",
    ],
    causesTitle: "Common ER causes",
    causes: "Inspiratory time (or pressure-support cycle-off %) not matched to the patient: COPD tends to late cycling, strong drive or ARDS to early cycling.",
    todo: [
      "Early cycling: lengthen inspiratory time, or lower the cycle-off % in pressure support.",
      "Late cycling: shorten inspiratory time, or raise the cycle-off % (for example 40–50% in COPD).",
      "Treat pain, anxiety and acidosis that drive the patient's own breathing.",
    ],
    links: [],
    graph: scalar({ ...PC, starts: [0, 5], tfPer: { 0: 0.55, 1: 1.6 }, early: [0], late: [1] }),
    compare: { graph: normalPc, label: "Show normal" },
  },
];

export const VENT_GROUPS: Array<{ id: VentGroup | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "normal", label: "Normal & loops" },
  { id: "mechanics", label: "Resistance & compliance" },
  { id: "trapping", label: "Trapping, leak, secretions" },
  { id: "asynchrony", label: "Asynchrony" },
];

export const VENT_GRAPHICS_REFERENCES = [
  "Dexter AM, Clark K. Ventilator graphics: scalars, loops, and secondary measures. Respir Care. 2020",
  "Georgopoulos D, Prinianakis G, Kondili E. Bedside waveforms interpretation as a tool to identify patient-ventilator asynchronies. Intensive Care Med. 2006",
  "Thille AW, Rodriguez P, Cabello B, et al. Patient-ventilator asynchrony during assisted mechanical ventilation. Intensive Care Med. 2006",
  "ARDS Network. Ventilation with lower tidal volumes as compared with traditional tidal volumes for ALI and ARDS. N Engl J Med. 2000",
];