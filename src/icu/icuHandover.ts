/**
 * ErMate — ICU handover in ISBAR (Identify, Situation, Background, Assessment, Recommendation).
 * Pure functions, no AI: every line is taken from the admission and its latest note.
 * Anything the note does not hold says "Not documented". Names are hidden unless asked for.
 * Tested by verify_icu_mode.ts.
 */

import type { IcuAdmission, IcuNote } from "./icuTypes";
import { EXAM_SYSTEMS, FAST_HUGS_ITEMS, PLAN_GROUPS, deviceDay, formatObservation, gcsText, icuDayNumber, isFastHugsComplete } from "./icuLogic";
import { ICU_SOURCES } from "./icuTypes";

const ND = "Not documented";

export type IsbarKey = "I" | "S" | "B" | "A" | "R";

export interface IsbarBlock {
  key: IsbarKey;
  title: string;
  text: string;
}

export interface IcuHandoverEntry {
  admissionId: string;
  bedLabel: string;
  /** today = latest note written today; old = latest note from an earlier day; none = no note yet */
  noteState: "today" | "old" | "none";
  noteDate: string | null;
  blocks: IsbarBlock[];
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function buildIcuIsbar(
  adm: IcuAdmission,
  note: IcuNote | null,
  opts: { showNames: boolean; now?: Date },
): IcuHandoverEntry {
  const now = opts.now || new Date();
  const s = note?.sections;

  // I — Identify
  const who = opts.showNames ? adm.patientLabel : "Patient";
  const demo = [adm.ageYears !== null ? `${adm.ageYears}` : "", adm.sex || ""].join(" ").trim();
  const source = ICU_SOURCES.find((x) => x.id === adm.source)?.label || adm.source;
  const identify = [
    `${adm.unitName} · Bed ${adm.bed} · ${who}${demo ? `, ${demo}` : ""}`,
    `ICU day ${icuDayNumber(adm.admittedAt, now)} · from ${source}${opts.showNames && adm.uhid ? ` · UHID ${adm.uhid}` : ""}`,
  ].join("\n");

  if (!note || !s) {
    return {
      admissionId: adm.id,
      bedLabel: `${adm.unitName} · Bed ${adm.bed}`,
      noteState: "none",
      noteDate: null,
      blocks: [
        { key: "I", title: "Identify", text: identify },
        { key: "S", title: "Situation", text: "No ICU note yet." },
        { key: "B", title: "Background", text: ND },
        { key: "A", title: "Assessment", text: ND },
        { key: "R", title: "Recommendation", text: "Start the admission note." },
      ],
    };
  }

  // S — Situation: active problems + current support + lines in situ
  const problems = s.problems.filter((p) => p.status === "active")
    .map((p, i) => `${i + 1}. ${p.text}${p.suspected ? " (suspected)" : ""}`);
  const support: string[] = [];
  if (s.ventilation) support.push(s.ventilation);
  if (s.haemodynamic) support.push(s.haemodynamic);
  const lines = note.devices.filter((d) => d.status === "in_situ").map((d) => {
    const day = deviceDay(d, now);
    return `${d.type}${d.site ? ` (${d.site})` : ""}${day ? ` day ${day}` : ""}`;
  });
  const situation = [
    problems.length ? problems.join("\n") : `Problems: ${ND}`,
    `On: ${support.length ? support.join(" · ") : ND}`,
    lines.length ? `Lines: ${lines.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  // B — Background
  const background = s.background || ND;

  // A — Assessment: vitals, neuro, recent results, documented exam
  const neuro = [gcsText(s.gcs), s.rass ? `RASS ${s.rass}` : "", s.camIcu ? `CAM-ICU ${s.camIcu}` : ""].filter(Boolean).join(" · ");
  const exam = EXAM_SYSTEMS
    .filter(({ id }) => s.exam[id].status === "documented" && s.exam[id].text)
    .map(({ id, label }) => `${label}: ${s.exam[id].text}`);
  const labs = s.investigations.slice(-8).map(formatObservation);
  const assessment = [
    `Vitals: ${s.vitals.length ? s.vitals.map(formatObservation).join(", ") : ND}`,
    neuro ? `Neuro: ${neuro}` : "",
    labs.length ? `Results: ${labs.join(", ")}` : "",
    exam.length ? exam.join("\n") : `Exam: ${ND}`,
  ].filter(Boolean).join("\n");

  // R — Recommendation: plan, pending tasks, clarifications, FAST HUGS gaps
  const plan = PLAN_GROUPS.flatMap(({ id }) => s.plan[id]);
  const pendingTasks = note.tasks.filter((t) => !t.done).map((t) => `${t.when}: ${t.what}`);
  const flags = note.flags.filter((f) => !f.resolved).map((f) => `${f.order} — ${f.issue}`);
  const fhGaps = FAST_HUGS_ITEMS.filter((it) => !isFastHugsComplete(note.fastHugs[it.key])).map((it) => it.label);
  const recommendation = [
    plan.length ? `Plan: ${plan.slice(0, 8).join("; ")}${plan.length > 8 ? ` (+${plan.length - 8} more)` : ""}` : `Plan: ${ND}`,
    pendingTasks.length ? `Pending tasks: ${pendingTasks.join(" · ")}` : "",
    flags.length ? `To clarify: ${flags.join(" · ")}` : "",
    fhGaps.length ? `FAST HUGS not reviewed: ${fhGaps.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const created = new Date(note.createdAt);
  return {
    admissionId: adm.id,
    bedLabel: `${adm.unitName} · Bed ${adm.bed}`,
    noteState: sameDay(created, now) ? "today" : "old",
    noteDate: note.createdAt,
    blocks: [
      { key: "I", title: "Identify", text: identify },
      { key: "S", title: "Situation", text: situation },
      { key: "B", title: "Background", text: background },
      { key: "A", title: "Assessment", text: assessment },
      { key: "R", title: "Recommendation", text: recommendation },
    ],
  };
}

/** Plain text for Copy and WhatsApp. No markdown. */
export function icuHandoverText(entries: IcuHandoverEntry[], opts: { doctorName?: string | null; now?: Date } = {}): string {
  const now = opts.now || new Date();
  const head = `ICU HANDOVER · ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    + `${opts.doctorName ? ` · by ${opts.doctorName}` : ""}`;
  const body = entries.map((e) => {
    const warn = e.noteState === "old" && e.noteDate
      ? `(Latest note is from ${new Date(e.noteDate).toLocaleDateString()} — not today)\n`
      : "";
    return `— ${e.bedLabel} —\n${warn}${e.blocks.map((b) => `${b.key} · ${b.title.toUpperCase()}\n${b.text}`).join("\n")}`;
  }).join("\n\n");
  return `${head}\n\n${body}`;
}