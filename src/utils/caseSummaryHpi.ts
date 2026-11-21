import type { ClinicalCase } from "../types";
import { authenticatedFetch } from "../services/authenticatedFetch";

/**
 * Requests a hospital-style HPI written from the whole case draft before opening the preview.
 * Skipped when the doctor wrote the HPI themselves (hpiSource === "doctor" / "clinician" / "manual"),
 * and fails open (returns the draft untouched) if the network or model is unavailable.
 */
export async function withCaseSummaryHpi(
  draftCase: ClinicalCase
): Promise<{ case: ClinicalCase; updated: boolean }> {
  if (!draftCase) return { case: draftCase, updated: false };

  const sh: any = draftCase.sampleHistory || {};
  const source = String(sh.hpiSource || "").toLowerCase();
  if (source === "doctor" || source === "clinician" || source === "manual") {
    return { case: draftCase, updated: false };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await authenticatedFetch("/api/case-sheet/hpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ caseData: draftCase }),
      });
      if (!res.ok) return { case: draftCase, updated: false };
      const data = await res.json().catch(() => ({}));
      const hpi = typeof data?.hpi === "string" ? data.hpi.trim() : "";
      if (!hpi) return { case: draftCase, updated: false };
      return {
        case: {
          ...draftCase,
          sampleHistory: {
            ...draftCase.sampleHistory,
            hpi,
          },
        },
        updated: true,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { case: draftCase, updated: false };
  }
}
