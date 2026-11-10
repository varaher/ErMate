/**
 * ErMate — identity for a saved vital-signs observation (MATE Events Phase 1, Step 2).
 *
 * Call ONCE when a new VitalsRecord object is built, before any save.
 * A save retry must resend the same object; never rebuild the record
 * (a new obsId would look like a new observation and open a false new alert episode).
 *
 * recordedAt = when the reading was SAVED in ErMate. It is NOT the clinical
 * measurement time and must never be displayed as "measured at".
 */
export function newObservationMeta(): { obsId: string; recordedAt: string } {
  const c: any = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  const obsId =
    c && typeof c.randomUUID === "function"
      ? c.randomUUID()
      : `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return { obsId, recordedAt: new Date().toISOString() };
}