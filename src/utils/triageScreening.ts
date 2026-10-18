import type { TriageScreening, IsolationType } from "../types";

/** Communicable-disease triage is a screening step, not a diagnosis: it only prompts isolation + history. */
export const COMMUNICABLE_SCREEN_PROMPT =
  "Fever with rash, cough, respiratory distress, bleeding, intense headache or extreme fatigue?";

export const ISOLATION_TYPES: IsolationType[] = ["Airborne", "Droplet", "Contact"];

export function emptyScreening(): TriageScreening {
  return {};
}

/** Epidemiological questions are only relevant when the screen is positive or a known communicable disease is reported. */
export function needsEpidemiologicalHistory(s: TriageScreening | undefined | null): boolean {
  return !!s && (s.communicableScreenPositive === true || s.knownCommunicableDisease === true);
}

/** True when any epidemiological flag is positive — drives the isolation suggestion (never auto-sets it). */
export function suggestsIsolation(s: TriageScreening | undefined | null): boolean {
  if (!s) return false;
  return s.communicableScreenPositive === true || s.knownCommunicableDisease === true;
}

/** Drop empty strings / empty arrays so Firestore and print never carry blanks; returns undefined when nothing was recorded. */
export function normalizeScreening(s: TriageScreening | undefined | null): TriageScreening | undefined {
  if (!s) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string") { const t = v.trim(); if (!t) continue; out[k] = t; continue; }
    out[k] = v;
  }
  // Isolation types are meaningless unless isolation is required.
  if (out.isolationRequired !== true) delete out.isolationTypes;
  if (out.knownCommunicableDisease !== true) delete out.knownCommunicableDiseaseName;
  if (out.travelEndemicArea3Weeks !== true) delete out.travelDetails;
  return Object.keys(out).length ? (out as TriageScreening) : undefined;
}

const yn = (v: boolean | null | undefined): string | null => (v === true ? "Yes" : v === false ? "No" : null);

/** Plain-text lines for print / Copy-to-EMR. Only assessed items are listed (no fabricated "No"). */
export function screeningLines(s: TriageScreening | undefined | null): string[] {
  if (!s) return [];
  const lines: string[] = [];
  const add = (label: string, v: string | null | undefined) => { if (v) lines.push(`${label}: ${v}`); };
  add("Level of consciousness", s.levelOfConsciousness);
  add("Orientation", s.orientation);
  add("Arrival mobility", s.arrivalMobility);
  add("Communicable-disease screen positive", yn(s.communicableScreenPositive));
  add("Travel to endemic area (last 3 weeks)", yn(s.travelEndemicArea3Weeks));
  add("Travel details", s.travelDetails);
  add("Close contact with similar symptoms", yn(s.closeContactSimilarSymptoms));
  add("Healthcare-worker exposure", yn(s.healthcareWorkerExposure));
  add("Contact with pets/livestock", yn(s.petsLivestockContact));
  add("Known communicable disease", yn(s.knownCommunicableDisease));
  add("Known disease", s.knownCommunicableDiseaseName);
  add("Isolation required", yn(s.isolationRequired));
  if (s.isolationRequired === true && s.isolationTypes?.length) add("Isolation type", s.isolationTypes.join(", "));
  add("Triage completed", s.completedAt);
  add("Triaged by", [s.triagedByName, s.triagedByEmpId ? `(Emp ID ${s.triagedByEmpId})` : ""].filter(Boolean).join(" "));
  return lines;
}

export function isolationBanner(s: TriageScreening | undefined | null): string | null {
  if (!s || s.isolationRequired !== true) return null;
  return s.isolationTypes?.length ? `Isolation required — ${s.isolationTypes.join(" / ")} precautions` : "Isolation required";
}
