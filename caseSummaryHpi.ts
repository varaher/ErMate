/**
 * src/utils/caseSummaryHpi.ts
 *
 * HPI written from the whole recorded case (Neeraj, 21 Nov 2026), in the hospital's style.
 * Runs when the case sheet is prepared (Preview) and from the "Rewrite HPI from case" button.
 *
 * - An HPI the doctor typed or edited (sampleHistory.hpiSource === "doctor") is never replaced
 *   automatically; only the button (force) rewrites it.
 * - If the server can't write one, the case is returned unchanged (nothing is invented).
 * - Only history fields are sent; no patient name / UHID. The server removes identifiers again.
 */
import { auth } from "../firebase";
import type { ClinicalCase } from "../types";

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function hpiInputFromCase(c: ClinicalCase) {
  const sh: any = c.sampleHistory || {};
  const p: any = c.patient || {};
  return {
    sex: text(p.gender) || null,
    presentingComplaint: text(p.presentingComplaint) && p.presentingComplaint !== "Not documented" ? text(p.presentingComplaint) : null,
    symptoms: text(sh.symptoms) || null,
    events: text(sh.events) || text((c as any).events) || null,
    currentHpi: text(sh.hpi) || null,
    pastHistory: text(sh.pastHistory) || null,
    surgicalHistory: text(sh.surgicalHistory) || null,
    medications: text(sh.medications) || null,
    arrivalMode: text(p.arrivalMode) || null,
  };
}

export function hasHistoryToSummarise(c: ClinicalCase): boolean {
  const i = hpiInputFromCase(c);
  return Boolean(i.presentingComplaint || i.symptoms || i.events || i.currentHpi);
}

/** True when the automatic rewrite must leave the HPI alone. */
export function isDoctorWrittenHpi(c: ClinicalCase): boolean {
  return (c.sampleHistory as any)?.hpiSource === "doctor" && text(c.sampleHistory?.hpi).length > 0;
}

/** Marks an HPI change made by the clinician (typing in the HPI box or editing the preview). */
export function markHpiEditedByDoctor<T extends ClinicalCase>(c: T, hpi: string): T {
  return { ...c, sampleHistory: { ...(c.sampleHistory || ({} as any)), hpi, hpiSource: "doctor" } };
}

/**
 * Returns the case with its HPI written from the whole case, or the same case when that isn't
 * possible / allowed. force = the doctor pressed "Rewrite HPI from case".
 */
export async function withCaseSummaryHpi<T extends ClinicalCase>(
  c: T,
  opts: { force?: boolean; timeoutMs?: number; fetchImpl?: typeof fetch; getToken?: () => Promise<string | null> } = {}
): Promise<{ case: T; changed: boolean; reason?: string }> {
  if (!opts.force && isDoctorWrittenHpi(c)) return { case: c, changed: false, reason: "doctor-written HPI kept" };
  if (!hasHistoryToSummarise(c)) return { case: c, changed: false, reason: "no history recorded" };

  const getToken = opts.getToken || (async () => (auth.currentUser ? await auth.currentUser.getIdToken() : null));
  const token = await getToken().catch(() => null);
  if (!token) return { case: c, changed: false, reason: "not signed in" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await (opts.fetchImpl || fetch)("/api/case-sheet/hpi-from-case", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(hpiInputFromCase(c)),
      signal: ctrl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    const hpi = text(data?.hpi);
    if (!res.ok || !hpi) return { case: c, changed: false, reason: data?.reason || data?.error || "no HPI returned" };
    if (hpi === text(c.sampleHistory?.hpi)) return { case: c, changed: false, reason: "unchanged" };
    return {
      case: { ...c, sampleHistory: { ...(c.sampleHistory || ({} as any)), hpi, hpiSource: "case-summary" } },
      changed: true,
    };
  } catch (e: any) {
    return { case: c, changed: false, reason: e?.name === "AbortError" ? "timed out" : (e?.message || "failed") };
  } finally {
    clearTimeout(timer);
  }
}