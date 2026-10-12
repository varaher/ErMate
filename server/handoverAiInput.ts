// ============================================================
// ErMate — Handover AI input whitelist
// File: server/handoverAiInput.ts
// ============================================================
// Builds the ONLY patient payload that may be sent to an external AI
// provider for handover-sheet compilation. Whitelist, not blacklist:
// identity fields (name, UHID, phone, ID numbers, emails, creator
// identity) are never copied. Clinical free text is passed through
// deidentifyText() and the patient's own known name tokens are masked.
// Identity is re-attached afterwards ONLY from the original request
// record (see getOriginalHandoverIdentity).

import { deidentifyText } from "./deidentify.ts";

const GENERIC_NAME = /^(bed patient|anonymous|patient|unknown|n\/a|\[patient\])$/i;

function str(v: any): string {
  return typeof v === "string" ? v : (typeof v === "number" ? String(v) : "");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getOriginalHandoverIdentity(p: any): { name: string; bed: string } {
  const candidates = [
    p?.patient?.name,
    p?.handoverCardData?.patientLabel?.name,
    p?.name,
    p?.patientName,
  ].map(str).map(s => s.trim()).filter(s => s && !GENERIC_NAME.test(s));
  const bed = str(p?.bedNo || p?.bed || p?.handoverCardData?.patientLabel?.bed).trim();
  return { name: candidates[0] || "", bed };
}

export function toSafeHandoverAiInput(p: any): Record<string, string> {
  const card = p?.handoverCardData || {};
  const sbar = p?.structuredSBAR || {};

  const nameTokens = Array.from(new Set(
    [p?.patient?.name, card?.patientLabel?.name, p?.name, p?.patientName]
      .map(str).map(s => s.trim()).filter(s => s && !GENERIC_NAME.test(s))
      .flatMap(n => n.split(/\s+/)).filter(t => t.length > 2)
  ));
  const scrub = (v: any): string => {
    const s = str(v);
    if (!s.trim()) return "";
    let t = deidentifyText(s).deidentified;
    for (const tok of nameTokens) {
      t = t.replace(new RegExp(`\\b${escapeRegex(tok)}\\b`, "gi"), "[PATIENT]");
    }
    return t;
  };

  const joinLines = (arr: any): string =>
    Array.isArray(arr) ? arr.map(str).filter(Boolean).join("\n") : str(arr);

  const vitals = typeof p?.vitals === "string"
    ? p.vitals
    : (p?.vitals && typeof p.vitals === "object"
        ? Object.entries(p.vitals).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => `${k} ${v}`).join(", ")
        : "");

  const investigations = Array.isArray(p?.investigations)
    ? p.investigations.map((i: any) => `${str(i?.testName)}: ${str(i?.result).trim() || "result pending"}`).join("\n")
    : str(p?.investigationResultsSummary);

  const treatments = Array.isArray(p?.treatments)
    ? p.treatments.map((t: any) => [str(t?.drugName), str(t?.dose), str(t?.route)].filter(Boolean).join(" ")).filter(Boolean).join(", ")
    : "";

  const notes = str(p?.rawNotes) || str(p?.chronologicalNotes) ||
    (Array.isArray(p?.notes) ? p.notes.map((n: any) => str(n?.content)).filter(Boolean).join("\n") : "");

  const age = str(p?.patient?.age);
  const gender = str(p?.patient?.gender);

  return {
    id: str(p?.id),
    bed: str(p?.bedNo || p?.bed || card?.patientLabel?.bed),
    ageGender: str(p?.ageGender) || str(card?.patientLabel?.ageSex) || [age, gender].filter(Boolean).join(" "),
    complaints: scrub(p?.complaints || p?.presentingComplaint || p?.patient?.presentingComplaint || card?.presentingComplaint),
    history: scrub(p?.history || p?.pmh || p?.sampleHistory?.pastHistory || card?.pmh),
    allergies: scrub(p?.allergies || p?.sampleHistory?.allergies),
    medications: scrub(p?.medications || p?.sampleHistory?.medications),
    diagnosis: scrub(p?.provisionalPrimaryDiagnosis || p?.diagnosis || card?.diagnosis),
    vitals: scrub(vitals || card?.vitalsNow),
    investigations: scrub(investigations),
    treatments: scrub(treatments),
    done: scrub(joinLines(card?.done)),
    toBeDone: scrub(joinLines(card?.toBeDone) || p?.dispositionDetails?.observationNotes),
    sbar: scrub([sbar.situation, sbar.background, sbar.assessment, sbar.recommendation].map(str).filter(Boolean).join("\n")),
    rawNotes: scrub(notes),
  };
}
