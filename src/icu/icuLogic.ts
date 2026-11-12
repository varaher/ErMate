/**
 * ErMate — ICU Mode pure logic (no Firebase, no React). Tested by verify_icu_mode.ts.
 *
 * Safety rules implemented here:
 *  - Rule 8: empty = null / "Not documented" / "Not reviewed". No clinical defaults.
 *  - Attested-normal expansion only for systems the doctor attested, never for Neuro or Lines
 *    (an ICU patient is often sedated/ventilated — "GCS 15, oriented" would be fabrication).
 *  - Temperature keeps the dictated unit; no unit → "(unit not stated)".
 *  - GCS total only when dictated, or all three components recorded and in range.
 *  - Device day count exists only when an insertion time is recorded.
 *  - Carried-forward items are marked and do not count as today's documentation.
 */

import type {
  ClarificationFlag, ExamEntry, ExamSystem, FastHugsKey, FastHugsState, IcuAdmission, IcuDevice,
  IcuExtraction, IcuGcs, IcuNote, IcuNoteSections, IcuObservation, IcuProblem, IcuTask, PlanGroup,
} from "./icuTypes";

// ── ids ───────────────────────────────────────────────────────
let idCounter = 0;
export function newId(prefix = "i"): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (/^(null|undefined|n\/?a|none|not documented|not mentioned|-|—)$/i.test(t)) return null;
  return t;
};

// ── Exam ──────────────────────────────────────────────────────
export const EXAM_SYSTEMS: { id: ExamSystem; label: string }[] = [
  { id: "respiratory", label: "Respiratory" },
  { id: "cardiovascular", label: "Cardiovascular" },
  { id: "abdomen", label: "Abdomen" },
  { id: "neurological", label: "Neurological" },
  { id: "renal", label: "Renal / GU" },
  { id: "skin", label: "Skin / pressure areas" },
  { id: "lines", label: "Lines / wounds" },
];

/** ICU normal phrases, offered only when the doctor attests or taps "Review normal findings". */
export const ICU_NORMAL_PHRASES: Partial<Record<ExamSystem, string>> = {
  respiratory: "Bilateral equal air entry. No added sounds.",
  cardiovascular: "S1 and S2 heard. No murmur.",
  abdomen: "Soft, non-distended, non-tender. Bowel sounds present.",
  renal: "No suprapubic distension.",
  skin: "No pressure injury. No rash.",
};

/** Systems a spoken global attestation may expand. Neuro and lines must always be stated. */
export const ATTESTABLE_SYSTEMS: ExamSystem[] = ["respiratory", "cardiovascular", "abdomen", "renal", "skin"];

export const emptyExamEntry = (): ExamEntry => ({
  status: "not_documented", text: null, source: null, reason: null, confirmedAt: null,
});

// ── Plan ──────────────────────────────────────────────────────
export const PLAN_GROUPS: { id: PlanGroup; label: string }[] = [
  { id: "metabolic", label: "Metabolic & electrolytes" },
  { id: "haemo_resp", label: "Haemodynamic & respiratory" },
  { id: "renal", label: "Renal" },
  { id: "fluid_glycaemic", label: "Fluid & glycaemic" },
  { id: "infection", label: "Infection & antibiotics" },
  { id: "investigations", label: "Investigations" },
  { id: "consults", label: "Consultations" },
  { id: "followup", label: "Follow-up" },
  { id: "other", label: "Other" },
];

const emptyPlan = (): Record<PlanGroup, string[]> => ({
  metabolic: [], haemo_resp: [], renal: [], fluid_glycaemic: [], infection: [],
  investigations: [], consults: [], followup: [], other: [],
});

// ── FAST HUGS BID ─────────────────────────────────────────────
export const FAST_HUGS_ITEMS: { key: FastHugsKey; letter: string; label: string; placeholder: string }[] = [
  { key: "feeds", letter: "F", label: "Feeds", placeholder: "e.g. RT feeds 50 ml/h, target 1500 kcal" },
  { key: "analgesia", letter: "A", label: "Analgesia", placeholder: "e.g. Fentanyl 50 mcg/h" },
  { key: "sedation", letter: "S", label: "Sedation", placeholder: "e.g. Midazolam 2 mg/h, RASS target -2" },
  { key: "thromboprophylaxis", letter: "T", label: "Thromboprophylaxis", placeholder: "e.g. Enoxaparin 40 mg SC OD / DVT pump" },
  { key: "head_up", letter: "H", label: "Head up", placeholder: "e.g. Head end 30° elevated" },
  { key: "ulcer_prophylaxis", letter: "U", label: "Ulcer prophylaxis", placeholder: "e.g. Pantoprazole 40 mg IV OD" },
  { key: "glucose", letter: "G", label: "Glucose control", placeholder: "e.g. Insulin infusion as per scale, GRBS hourly" },
  { key: "sbt", letter: "S", label: "Spontaneous breathing trial", placeholder: "e.g. SBT passed / deferred — reason" },
  { key: "bowel", letter: "B", label: "Bowel opening", placeholder: "e.g. Last opened 10 Nov, lactulose 15 ml TDS" },
  { key: "indwelling", letter: "I", label: "Indwelling devices", placeholder: "e.g. CVC R IJV, Foley — continue" },
  { key: "deescalation", letter: "D", label: "De-escalation", placeholder: "e.g. Meropenem day 3, cultures pending" },
];

export function emptyFastHugs(): FastHugsState {
  const out = {} as FastHugsState;
  for (const it of FAST_HUGS_ITEMS) out[it.key] = { status: "not_reviewed", detail: null, reason: null };
  return out;
}

/** An item counts as reviewed only when its status has the information it needs. */
export function isFastHugsComplete(e: { status: string; detail: string | null; reason: string | null }): boolean {
  if (e.status === "addressed") return !!clean(e.detail);
  if (e.status === "not_applicable") return !!clean(e.reason);
  return false;
}

export function fastHugsGapCount(fh: FastHugsState): number {
  return FAST_HUGS_ITEMS.filter((it) => !isFastHugsComplete(fh[it.key])).length;
}

// ── Empty note ────────────────────────────────────────────────
export function emptySections(): IcuNoteSections {
  const exam = {} as Record<ExamSystem, ExamEntry>;
  for (const s of EXAM_SYSTEMS) exam[s.id] = emptyExamEntry();
  return {
    problems: [], background: null, admissionStory: null, events: null,
    ventilation: null, neuro: null, haemodynamic: null,
    vitals: [], gcs: { e: null, v: null, m: null, vText: null, dictatedTotal: null },
    rass: null, camIcu: null, exam, investigations: [], differentials: [], plan: emptyPlan(), summary: null,
  };
}

export function newNote(args: {
  admissionId: string; kind: "admission" | "daily"; authorUid: string; authorName: string | null; now?: Date;
}): IcuNote {
  const now = (args.now || new Date()).toISOString();
  return {
    id: newId("note"), admissionId: args.admissionId, kind: args.kind, status: "draft",
    createdAt: now, updatedAt: now, authorUid: args.authorUid, authorName: args.authorName, signedAt: null,
    sections: emptySections(), fastHugs: emptyFastHugs(), flags: [], tasks: [], devices: [],
  };
}

/**
 * Day 2+ note: carry the stable record forward, marked "carried", never the day's measurements.
 * Vitals, exam, vent/haemodynamic status, FAST HUGS, flags and tasks start empty.
 */
export function carryForwardNote(prev: IcuNote, args: { authorUid: string; authorName: string | null; now?: Date }): IcuNote {
  const note = newNote({ admissionId: prev.admissionId, kind: "daily", ...args });
  note.sections.problems = prev.sections.problems
    .filter((p) => p.status === "active")
    .map((p) => ({ ...p, id: newId("pb"), carried: true }));
  note.sections.background = prev.sections.background;
  note.sections.differentials = [...prev.sections.differentials];
  note.devices = prev.devices
    .filter((d) => d.status !== "removed")
    .map((d) => ({ ...d, id: newId("dev"), carried: true }));
  return note;
}

// ── Time helpers ──────────────────────────────────────────────
export function icuDayNumber(admittedAtIso: string, now = new Date()): number {
  const start = new Date(admittedAtIso);
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((b - a) / 86_400_000) + 1);
}

/** Device day: only when insertion is recorded. Insertion day = Day 1. */
export function deviceDay(d: IcuDevice, now = new Date()): number | null {
  if (d.status !== "in_situ" || !d.insertedAt) return null;
  return icuDayNumber(d.insertedAt, now);
}

/**
 * Resolve a dictated clock time ("8 PM", "12 AM", "4 am", "20:00") to the next occurrence
 * at or after `from`. "12 AM" / "4 AM" said in the afternoon → tomorrow. Non-clock words → null.
 */
export function resolveClockTime(when: string, from = new Date()): string | null {
  const t = (when || "").trim().toLowerCase().replace(/\./g, "");
  let h: number | null = null;
  let m = 0;
  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  const h24 = t.match(/^(\d{1,2}):(\d{2})(?:\s*h(?:rs?)?)?$/);
  if (ampm) {
    h = Number(ampm[1]) % 12;
    m = ampm[2] ? Number(ampm[2]) : 0;
    if (ampm[3] === "pm") h += 12;
  } else if (h24) {
    h = Number(h24[1]);
    m = Number(h24[2]);
  } else if (t === "midnight") {
    h = 0;
  } else if (t === "noon") {
    h = 12;
  }
  if (h === null || h > 23 || m > 59) return null;
  const due = new Date(from);
  due.setHours(h, m, 0, 0);
  if (due.getTime() < from.getTime()) due.setDate(due.getDate() + 1);
  return due.toISOString();
}

/** Splits "8 PM, 12 AM and 4 AM" into separate times. */
export function splitWhen(when: string): string[] {
  return (when || "")
    .split(/,|\band\b|&|\//i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Display helpers ───────────────────────────────────────────
export function formatObservation(o: IcuObservation): string {
  const isTemp = /^temp/i.test(o.name);
  let value = o.value;
  if (isTemp && /\d/.test(o.value)) {
    value = o.unit ? `${o.value} ${o.unit}` : `${o.value} (unit not stated)`;
  } else if (o.unit) {
    value = `${o.value} ${o.unit}`;
  }
  return `${o.name} ${value}${o.time ? ` (${o.time})` : ""}`;
}

export function gcsText(g: IcuGcs): string | null {
  const parts: string[] = [];
  if (g.e !== null) parts.push(`E${g.e}`);
  if (g.v !== null) parts.push(`V${g.v}`);
  else if (g.vText) parts.push(`V${g.vText}`);
  if (g.m !== null) parts.push(`M${g.m}`);
  if (!parts.length && g.dictatedTotal === null) return null;
  let total: number | null = g.dictatedTotal;
  if (total === null && g.e !== null && g.v !== null && g.m !== null
    && g.e >= 1 && g.e <= 4 && g.v >= 1 && g.v <= 5 && g.m >= 1 && g.m <= 6) {
    total = g.e + g.v + g.m;
  }
  const comp = parts.join(" ");
  if (total !== null) return comp ? `GCS ${total} (${comp})` : `GCS ${total}`;
  return `GCS ${comp} (total not calculable)`;
}

export function supportChips(note: IcuNote): string[] {
  const chips: string[] = [];
  const s = note.sections;
  if (s.ventilation && /ventilat|\bmv\b|intubat|niv|bipap|hfnc/i.test(s.ventilation)) chips.push("Ventilated");
  if (s.haemodynamic && /noradrenaline|norepinephrine|dopamine|adrenaline|vasopressin|dobutamine/i.test(s.haemodynamic)) chips.push("Pressors");
  if (note.devices.some((d) => /hd|dialysis/i.test(d.type) && d.status !== "removed")) chips.push("HD line");
  return chips;
}

// ── Merging an extraction into a note (the "Apply all" action) ──
const lc = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const appendText = (a: string | null, b: string | null) => {
  const nb = clean(b);
  if (!nb) return a;
  if (!a) return nb;
  if (lc(a).includes(lc(nb))) return a;
  return `${a}\n${nb}`;
};
const uniqPush = (list: string[], items: string[]) => {
  const seen = new Set(list.map(lc));
  for (const it of items) {
    const c = clean(it);
    if (c && !seen.has(lc(c))) { list.push(c); seen.add(lc(c)); }
  }
};

export function applyExtraction(note: IcuNote, ext: IcuExtraction, now = new Date()): IcuNote {
  const nowIso = now.toISOString();
  const n: IcuNote = JSON.parse(JSON.stringify(note));
  const s = n.sections;

  // Problems — never promote a differential; suspected stays suspected.
  const haveProblem = new Set(s.problems.map((p) => lc(p.text)));
  for (const p of ext.problems) {
    const t = clean(p.text);
    if (!t) continue;
    const existing = s.problems.find((x) => lc(x.text) === lc(t));
    if (existing) { existing.carried = false; continue; }
    if (!haveProblem.has(lc(t))) {
      s.problems.push({ id: newId("pb"), text: t, status: "active", suspected: !!p.suspected, carried: false });
      haveProblem.add(lc(t));
    }
  }
  s.background = appendText(s.background, ext.background);
  s.admissionStory = appendText(s.admissionStory, ext.admissionStory);
  s.events = appendText(s.events, ext.events);
  s.ventilation = appendText(s.ventilation, ext.ventilation);
  s.neuro = appendText(s.neuro, ext.neuro);
  s.haemodynamic = appendText(s.haemodynamic, ext.haemodynamic);
  s.rass = clean(ext.rass) ?? s.rass;
  s.camIcu = clean(ext.camIcu) ?? s.camIcu;
  s.summary = appendText(s.summary, ext.summary);

  for (const v of ext.vitals) {
    const value = clean(v.value);
    if (!value) continue;
    s.vitals.push({ id: newId("vt"), name: clean(v.name) || "Other", value, unit: clean(v.unit), time: clean(v.time) });
  }
  for (const v of ext.investigations) {
    const value = clean(v.value);
    const name = clean(v.name);
    if (!value || !name) continue;
    s.investigations.push({ id: newId("lab"), name, value, unit: clean(v.unit), time: clean(v.time) });
  }

  // GCS — components only replace when dictated now.
  const g = ext.gcs;
  if (g.e !== null || g.v !== null || g.m !== null || g.vText || g.total !== null) {
    s.gcs = { e: g.e, v: g.v, m: g.m, vText: g.vText, dictatedTotal: g.total };
  }

  // Exam — dictated systems first; attestation only fills attestable systems not named.
  for (const sys of Object.keys(ext.exam) as ExamSystem[]) {
    const text = clean(ext.exam[sys]);
    if (!text || !s.exam[sys]) continue;
    s.exam[sys] = { status: "documented", text, source: "dictated", reason: null, confirmedAt: nowIso };
  }
  if (ext.attestedNormal) {
    for (const sys of ATTESTABLE_SYSTEMS) {
      if (clean(ext.exam[sys])) continue; // named exception / specific finding wins
      if (s.exam[sys].status === "documented" && s.exam[sys].source === "dictated") continue;
      s.exam[sys] = { status: "documented", text: ICU_NORMAL_PHRASES[sys] || null, source: "attested-normal", reason: null, confirmedAt: nowIso };
    }
  }

  uniqPush(s.differentials, ext.differentials);
  for (const grp of Object.keys(s.plan) as PlanGroup[]) uniqPush(s.plan[grp], ext.plan[grp] || []);

  // FAST HUGS — only items actually dictated become addressed.
  for (const key of Object.keys(ext.fastHugs) as FastHugsKey[]) {
    const detail = clean(ext.fastHugs[key]);
    if (!detail || !n.fastHugs[key]) continue;
    n.fastHugs[key] = { status: "addressed", detail: appendText(n.fastHugs[key].detail, detail), reason: null };
  }

  const haveFlag = new Set(n.flags.map((f) => lc(f.order + "|" + f.issue)));
  for (const f of ext.flags) {
    const order = clean(f.order); const issue = clean(f.issue);
    if (!order || !issue || haveFlag.has(lc(order + "|" + issue))) continue;
    n.flags.push({ id: newId("fl"), order, issue, resolved: false } as ClarificationFlag);
  }

  for (const t of ext.tasks) {
    const what = clean(t.what); const when = clean(t.when);
    if (!what || !when) continue;
    const times = splitWhen(when);
    const clockTimes = times.map((w) => ({ w, due: resolveClockTime(w, now) }));
    if (clockTimes.length > 1 && clockTimes.every((c) => c.due)) {
      for (const c of clockTimes) n.tasks.push({ id: newId("tk"), what, when: c.w, dueAt: c.due, done: false, doneAt: null } as IcuTask);
    } else {
      n.tasks.push({ id: newId("tk"), what, when, dueAt: resolveClockTime(when, now), done: false, doneAt: null });
    }
  }

  for (const d of ext.devices) {
    const type = clean(d.type);
    if (!type) continue;
    const insertedAt = d.status === "in_situ" && d.insertedTime ? resolvePastClock(d.insertedTime, now) : null;
    const existing = n.devices.find((x) => lc(x.type) === lc(type) && x.status !== "removed");
    if (existing) {
      existing.carried = false;
      if (d.site) existing.site = clean(d.site);
      if (d.status === "in_situ") {
        existing.status = "in_situ";
        existing.insertedAt = existing.insertedAt || insertedAt;
      }
      continue;
    }
    n.devices.push({ id: newId("dev"), type, site: clean(d.site), status: d.status, insertedAt, carried: false });
  }

  n.updatedAt = nowIso;
  return n;
}

/** A dictated insertion time refers to the past: "6 PM" said at 8 PM is today, said at 10 AM is yesterday. */
export function resolvePastClock(when: string, now = new Date()): string | null {
  const next = resolveClockTime(when, now);
  if (!next) return null;
  const d = new Date(next);
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
  return d.toISOString();
}

// ── Sanitise server output (never trust model JSON shape) ─────
const str = (v: unknown, max = 2000) => { const c = clean(v); return c ? c.slice(0, max) : null; };
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

export function sanitizeExtraction(raw: any): IcuExtraction {
  const r = raw && typeof raw === "object" ? raw : {};
  const obs = (list: unknown) => arr(list)
    .map((o) => ({ name: str(o?.name, 60) || "", value: str(o?.value, 200) || "", unit: str(o?.unit, 30), time: str(o?.time, 40) }))
    .filter((o) => o.name && o.value);
  const plan = emptyPlan();
  for (const g of Object.keys(plan) as PlanGroup[]) plan[g] = arr(r.plan?.[g]).map((x) => str(x, 500)).filter(Boolean) as string[];
  const exam: Partial<Record<ExamSystem, string>> = {};
  for (const s of EXAM_SYSTEMS) { const t = str(r.exam?.[s.id], 1000); if (t) exam[s.id] = t; }
  const fastHugs: Partial<Record<FastHugsKey, string>> = {};
  for (const it of FAST_HUGS_ITEMS) { const t = str(r.fastHugs?.[it.key], 500); if (t) fastHugs[it.key] = t; }
  const vRaw = r.gcs?.v;
  return {
    problems: arr(r.problems).map((p) => ({ text: str(p?.text ?? p, 300) || "", suspected: p?.suspected === true })).filter((p) => p.text),
    background: str(r.background), admissionStory: str(r.admissionStory), events: str(r.events),
    ventilation: str(r.ventilation, 500), neuro: str(r.neuro, 500), haemodynamic: str(r.haemodynamic, 500),
    vitals: obs(r.vitals),
    gcs: {
      e: int(r.gcs?.e, 1, 4), v: int(vRaw, 1, 5), m: int(r.gcs?.m, 1, 6),
      vText: typeof vRaw === "string" && /^t$/i.test(vRaw.trim()) ? "T" : str(r.gcs?.vText, 5),
      total: int(r.gcs?.total, 3, 15),
    },
    rass: str(r.rass, 20), camIcu: str(r.camIcu, 40),
    exam, attestedNormal: r.attestedNormal === true,
    investigations: obs(r.investigations),
    differentials: arr(r.differentials).map((x) => str(x, 300)).filter(Boolean) as string[],
    plan, fastHugs,
    flags: arr(r.flags).map((f) => ({ order: str(f?.order, 300) || "", issue: str(f?.issue, 300) || "" })).filter((f) => f.order && f.issue),
    tasks: arr(r.tasks).map((t) => ({ what: str(t?.what, 300) || "", when: str(t?.when, 80) || "" })).filter((t) => t.what && t.when),
    devices: arr(r.devices).map((d) => ({
      type: str(d?.type, 80) || "", site: str(d?.site, 80),
      status: (d?.status === "in_situ" ? "in_situ" : "ordered") as "ordered" | "in_situ",
      insertedTime: str(d?.insertedTime, 40),
    })).filter((d) => d.type),
    summary: str(r.summary),
  };
}

/** Counts shown on the "Not yet applied" card. */
export function extractionCounts(ext: IcuExtraction) {
  return {
    problems: ext.problems.length,
    vitals: ext.vitals.length + (ext.gcs.e !== null || ext.gcs.total !== null ? 1 : 0),
    exam: Object.keys(ext.exam).length + (ext.attestedNormal ? 1 : 0),
    labs: ext.investigations.length,
    plan: Object.values(ext.plan).reduce((a, l) => a + l.length, 0),
    fastHugs: Object.keys(ext.fastHugs).length,
    flags: ext.flags.length,
    tasks: ext.tasks.length,
    devices: ext.devices.length,
  };
}

// ── Note text (Preview + Copy to EMR) ─────────────────────────
const ND = "Not documented";

export interface EmrSection { key: string; title: string; text: string }

export function buildIcuEmrSections(note: IcuNote, adm: Pick<IcuAdmission, "unitName" | "bed" | "admittedAt">, now = new Date()): EmrSection[] {
  const s = note.sections;
  const lines = (l: string[]) => (l.length ? l.join("\n") : ND);

  const problems = s.problems.filter((p) => p.status === "active");
  const diagnosis = lines(problems.map((p, i) => `${i + 1}. ${p.text}${p.suspected ? " (suspected)" : ""}${p.carried ? " [carried forward — not yet confirmed]" : ""}`))
    + (s.background ? `\nBackground: ${s.background}` : "");

  const progress: string[] = [];
  if (note.kind === "admission" && s.admissionStory) progress.push(s.admissionStory);
  if (s.events) progress.push(`Events: ${s.events}`);
  progress.push(`Ventilation: ${s.ventilation || ND}`);
  progress.push(`Neuro / sedation: ${s.neuro || ND}`);
  const gcs = gcsText(s.gcs);
  if (gcs) progress.push(gcs);
  if (s.rass) progress.push(`RASS ${s.rass}`);
  if (s.camIcu) progress.push(`CAM-ICU ${s.camIcu}`);
  progress.push(`Haemodynamic support: ${s.haemodynamic || ND}`);
  progress.push(`Vitals: ${s.vitals.length ? s.vitals.map(formatObservation).join(", ") : ND}`);

  const exam = EXAM_SYSTEMS.map(({ id, label }) => {
    const e = s.exam[id];
    if (e.status === "documented" && e.text) return `${label}: ${e.text}`;
    if (e.status === "not_assessed") return `${label}: Not assessed${e.reason ? ` (${e.reason})` : ""}`;
    if (e.status === "unable") return `${label}: Unable to assess${e.reason ? ` (${e.reason})` : ""}`;
    return `${label}: ${ND}`;
  }).join("\n");

  const labs = lines(s.investigations.map(formatObservation));
  const ddx = lines(s.differentials.map((d) => `- ${d}`));

  const planParts: string[] = [];
  PLAN_GROUPS.forEach(({ id, label }) => {
    const items = s.plan[id];
    if (items.length) planParts.push(`${label}:\n${items.map((x) => `- ${x}`).join("\n")}`);
  });
  const openFlags = note.flags.filter((f) => !f.resolved);
  if (openFlags.length) planParts.push(openFlags.map((f) => `[CLARIFY: ${f.order} — ${f.issue}]`).join("\n"));
  const plan = planParts.length ? planParts.join("\n\n") : ND;

  const fh = FAST_HUGS_ITEMS.map(({ key, letter, label }) => {
    const e = note.fastHugs[key];
    if (e.status === "addressed" && e.detail) return `${letter} — ${label}: ${e.detail}`;
    if (e.status === "not_applicable" && e.reason) return `${letter} — ${label}: Not applicable (${e.reason})`;
    return `${letter} — ${label}: Not reviewed`;
  }).join("\n");

  const devices = lines(note.devices.filter((d) => d.status !== "removed").map((d) => {
    const day = deviceDay(d, now);
    const where = d.site ? ` (${d.site})` : "";
    if (d.status === "ordered") return `${d.type}${where} — ordered, not yet inserted`;
    return `${d.type}${where} — ${day ? `day ${day}` : "insertion time not recorded"}`;
  }));

  const tasks = note.tasks.length
    ? note.tasks.map((t) => `${t.done ? "[done]" : "[ ]"} ${t.when}: ${t.what}`).join("\n")
    : ND;

  return [
    { key: "diagnosis", title: "DIAGNOSIS / ACTIVE PROBLEMS", text: diagnosis },
    { key: "progress", title: "PROGRESS", text: progress.join("\n") },
    { key: "exam", title: "EXAMINATION", text: exam },
    { key: "investigations", title: "INVESTIGATIONS", text: labs },
    { key: "differentials", title: "DIFFERENTIAL CONSIDERATIONS", text: ddx },
    { key: "plan", title: "PLAN FOR THE DAY", text: plan },
    { key: "tasks", title: "TIMED TASKS", text: tasks },
    { key: "fasthugs", title: "FAST HUGS BID", text: fh },
    { key: "devices", title: "LINES & TUBES", text: devices },
    { key: "summary", title: "SUMMARY & PROGNOSIS", text: s.summary || ND },
  ];
}

export function buildIcuNoteText(
  note: IcuNote,
  adm: Pick<IcuAdmission, "unitName" | "bed" | "admittedAt">,
  doctor: { name: string | null; designation?: string | null },
  now = new Date(),
): string {
  const header: string[] = [];
  if (note.status !== "signed") header.push("DRAFT — NOT SIGNED");
  header.push(`ICU ${note.kind === "admission" ? "ADMISSION NOTE" : "DAILY PROGRESS NOTE"}`);
  header.push(`${adm.unitName} · Bed ${adm.bed} · ICU day ${icuDayNumber(adm.admittedAt, now)}`);
  const body = buildIcuEmrSections(note, adm, now).map((sec) => `${sec.title}\n${sec.text}`).join("\n\n");
  const sign = doctor.name
    ? `\n\n${note.status === "signed" ? "Signed" : "Prepared"} by: ${doctor.name}${doctor.designation ? `, ${doctor.designation}` : ""}`
    : "";
  return `${header.join("\n")}\n\n${body}${sign}`;
}

export function noteGapSummary(note: IcuNote) {
  return {
    fastHugsGaps: fastHugsGapCount(note.fastHugs),
    openFlags: note.flags.filter((f) => !f.resolved).length,
    carriedUnconfirmed: note.sections.problems.filter((p) => p.carried).length + note.devices.filter((d) => d.carried).length,
    examDocumented: EXAM_SYSTEMS.filter((x) => note.sections.exam[x.id].status !== "not_documented").length,
  };
}

export const IcuProblemsPreview = (problems: IcuProblem[]): string | null => {
  const act = problems.filter((p) => p.status === "active").map((p) => p.text);
  return act.length ? act.slice(0, 4).join(" · ").slice(0, 300) : null;
};