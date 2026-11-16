/**
 * ICU Discuss / 7-lens context — pure helper (no React, no Firestore).
 * Builds the de-identified text record of a whole ICU stay that is sent to the
 * thinking partners. The server runs deidentifyText() on it again before any LLM call.
 *
 * Never included: patient name/label, UHID, doctor names, calendar dates.
 * Time is expressed as ICU day numbers ("Day 3") relative to admission.
 * Undocumented items stay "Not documented" (Rule 8) — nothing is filled in.
 */
import type { IcuAdmission, IcuNote } from "./icuTypes";
import { buildIcuEmrSections, icuDayNumber, gcsText, formatObservation } from "./icuLogic";
import { ICU_UNIT_TYPES, ICU_SOURCES } from "./icuTypes";

export const ICU_RECORD_MAX_CHARS = 24_000;
const FULL_NOTES = 2; // latest N notes go in full; older ones are summarised

export interface IcuDiscussRecord {
  text: string;
  icuDay: number;
  unitType: string;
  ageYears: number | null;
  sex: "M" | "F" | "Other" | null;
  noteCount: number;
  truncated: boolean;
}

function dayLabel(iso: string | null | undefined, admittedAt: string): string {
  if (!iso) return "time not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "time not recorded";
  const hh = d.getHours();
  const mm = d.getMinutes();
  const h12 = ((hh + 11) % 12) + 1;
  const clock = `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "AM" : "PM"}`;
  return `Day ${icuDayNumber(admittedAt, d)}, ${clock}`;
}

function noteHeading(n: IcuNote, admittedAt: string): string {
  const kind = n.kind === "admission" ? "Admission note" : "Daily note";
  const status = n.status === "signed" ? "signed" : "DRAFT, not signed";
  return `${kind} · ${dayLabel(n.signedAt || n.updatedAt || n.createdAt, admittedAt)} · ${status}`;
}

/** Short summary for older notes: problems, events, support, numeric results. */
function noteSummary(n: IcuNote): string {
  const s = n.sections;
  const out: string[] = [];
  const probs = s.problems.filter((p) => p.status === "active").map((p) => `${p.text}${p.suspected ? " (suspected)" : ""}`);
  out.push(`Problems: ${probs.length ? probs.join("; ") : "Not documented"}`);
  const resolved = s.problems.filter((p) => p.status === "resolved").map((p) => p.text);
  if (resolved.length) out.push(`Resolved: ${resolved.join("; ")}`);
  if (s.events) out.push(`Events: ${s.events}`);
  if (s.ventilation) out.push(`Ventilation: ${s.ventilation}`);
  if (s.haemodynamic) out.push(`Haemodynamic: ${s.haemodynamic}`);
  const g = gcsText(s.gcs);
  if (g) out.push(g);
  if (s.vitals.length) out.push(`Vitals: ${s.vitals.map(formatObservation).join(", ")}`);
  if (s.investigations.length) out.push(`Results: ${s.investigations.map(formatObservation).join(", ")}`);
  const devices = n.devices.filter((d) => d.status === "in_situ").map((d) => `${d.type}${d.site ? ` (${d.site})` : ""}`);
  if (devices.length) out.push(`Lines/devices: ${devices.join(", ")}`);
  return out.join("\n");
}

function stayHistory(adm: IcuAdmission): string {
  const unitLabel = ICU_UNIT_TYPES.find((u) => u.id === adm.unitType)?.label || adm.unitType;
  const source = ICU_SOURCES.find((s) => s.id === adm.source)?.label || adm.source;
  const lines: string[] = [];
  lines.push(`Unit type: ${unitLabel}`);
  lines.push(`Admitted from: ${source}`);
  if (adm.stays.length > 1) {
    lines.push("Moves during stay:");
    adm.stays.forEach((st) => {
      lines.push(`- ${st.unitName}, bed ${st.bed}: from ${dayLabel(st.inAt, adm.admittedAt)}${st.outAt ? ` to ${dayLabel(st.outAt, adm.admittedAt)}` : " (current)"}`);
    });
  }
  if (adm.status === "closed") lines.push(`Stay closed: ${adm.outcome || "outcome not recorded"} at ${dayLabel(adm.outcomeAt, adm.admittedAt)}`);
  return lines.join("\n");
}

/**
 * @param notes all notes of the stay, any order
 */
export function buildIcuDiscussRecord(adm: IcuAdmission, notes: IcuNote[], now = new Date()): IcuDiscussRecord {
  const sorted = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const icuDay = icuDayNumber(adm.admittedAt, adm.status === "closed" && adm.outcomeAt ? new Date(adm.outcomeAt) : now);
  const unitType = ICU_UNIT_TYPES.find((u) => u.id === adm.unitType)?.label || adm.unitType;

  const demo = [
    adm.ageYears !== null ? `${adm.ageYears} years` : "Age not documented",
    adm.sex || "Sex not documented",
  ].join(", ");

  const header = [
    "ICU PATIENT RECORD (de-identified — names, UHID and dates removed)",
    `Patient: ${demo}`,
    `ICU day ${icuDay} · ${adm.status === "active" ? "currently in ICU" : "stay closed"}`,
    stayHistory(adm),
  ].join("\n");

  const full = sorted.slice(-FULL_NOTES);
  const older = sorted.slice(0, Math.max(0, sorted.length - FULL_NOTES));

  const fullBlocks = full.map((n) => {
    const body = buildIcuEmrSections(n, adm, now)
      .map((sec) => `${sec.title}\n${sec.text}`)
      .join("\n\n");
    return `=== ${noteHeading(n, adm.admittedAt)} ===\n${body}`;
  });

  // Older notes: newest-first so that if we must cut, the oldest go first.
  const olderBlocks = older.reverse().map((n) => `--- ${noteHeading(n, adm.admittedAt)} (summary) ---\n${noteSummary(n)}`);

  let truncated = false;
  const latestPart = fullBlocks.length ? `LATEST NOTES (in full)\n\n${fullBlocks.join("\n\n")}` : "No notes written yet.";
  let text = `${header}\n\n${latestPart}`;

  if (text.length > ICU_RECORD_MAX_CHARS) {
    text = text.slice(0, ICU_RECORD_MAX_CHARS);
    truncated = true;
  } else if (olderBlocks.length) {
    const kept: string[] = [];
    let len = text.length + 40;
    for (const b of olderBlocks) {
      if (len + b.length + 2 > ICU_RECORD_MAX_CHARS) { truncated = true; break; }
      kept.push(b);
      len += b.length + 2;
    }
    if (kept.length) {
      // show chronologically
      text += `\n\nEARLIER IN THE STAY (summaries, oldest first)\n\n${kept.reverse().join("\n\n")}`;
    }
  }
  if (truncated) text += "\n\n[Record shortened — oldest notes left out]";

  return { text, icuDay, unitType, ageYears: adm.ageYears, sex: adm.sex, noteCount: sorted.length, truncated };
}