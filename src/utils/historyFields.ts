// History-of-presenting-illness helpers. Pure functions, no LLM, no invented content.
import type { SampleHistory } from "../types";

/** LMP is relevant only for females of reproductive age (10–55). Unknown age + female => applicable. */
export function isLmpApplicable(patient?: { gender?: string | null; age?: number | null } | null): boolean {
  if (!patient) return false;
  const g = String(patient.gender || "").trim().toLowerCase();
  if (!(g === "female" || g === "f" || g.startsWith("female"))) return false;
  const age = patient.age;
  if (age === null || age === undefined || Number.isNaN(Number(age))) return true;
  return Number(age) >= 10 && Number(age) <= 55;
}

/** HPI shown in discharge: explicit hpi, else the recorded symptoms + preceding events joined. Never invented. */
export function resolveHpi(sh?: Partial<SampleHistory> | null): string {
  if (!sh) return "";
  const hpi = (sh.hpi || "").trim();
  if (hpi) return hpi;
  const parts: string[] = [];
  const sym = (sh.symptoms || "").trim();
  const ev = (sh.events || "").trim();
  if (sym) parts.push(sym);
  if (ev && !sym.toLowerCase().includes(ev.toLowerCase())) parts.push(ev);
  return parts.join(". ");
}

/** Past medical + surgical, without repeating surgical text already present in past history. */
export function resolvePastMedicalSurgical(sh?: Partial<SampleHistory> | null): string {
  if (!sh) return "";
  const pm = (sh.pastHistory || "").trim();
  const sx = (sh.surgicalHistory || "").trim();
  if (!sx) return pm;
  if (pm.toLowerCase().includes(sx.toLowerCase())) return pm;
  return pm ? `${pm}. Surgical: ${sx}` : `Surgical: ${sx}`;
}
