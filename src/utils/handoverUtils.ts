import type { HandoverPatient } from '../types';

/**
 * saveHandoverPatient
 * Implements write-once logic for Section 3 (Initial Presentation at Arrival).
 * First write locks initialPresentation with a timestamp.
 * Subsequent writes preserve initialPresentation and update mutable current shift fields.
 */
export function saveHandoverPatient(existing: HandoverPatient | null | undefined, incoming: HandoverPatient): HandoverPatient {
  const isLocked = Boolean(existing?.initialPresentation_lockedAt || existing?.initialPresentation?.lockedAt);
  const now = new Date().toISOString();

  if (isLocked && existing) {
    return {
      ...incoming,
      initialPresentation_lockedAt: existing.initialPresentation_lockedAt || existing.initialPresentation?.lockedAt || now,
      initialPresentation: existing.initialPresentation,
      adjunctsAtArrival: existing.adjunctsAtArrival || existing.initialPresentation?.adjunctsAtArrival,
      presentingComplaint: existing.presentingComplaint || incoming.presentingComplaint,
      adjunctsNow: incoming.adjunctsNow || incoming.adjuncts,
      adjuncts: incoming.adjunctsNow || incoming.adjuncts,
    };
  } else {
    const lockedAt = incoming.initialPresentation_lockedAt || now;
    const initialPres = incoming.initialPresentation || {
      chiefComplaint: incoming.presentingComplaint || "Presenting complaint recorded.",
      initialVitals: incoming.latestVitals?.bp ? `BP ${incoming.latestVitals.bp}, HR ${incoming.latestVitals.hr}` : undefined,
      adjunctsAtArrival: typeof incoming.adjunctsAtArrival === 'string' 
        ? incoming.adjunctsAtArrival 
        : (incoming.adjunctsAtArrival ? Object.values(incoming.adjunctsAtArrival).filter(Boolean).join(' · ') : undefined),
      lockedAt,
    };

    return {
      ...incoming,
      initialPresentation_lockedAt: lockedAt,
      initialPresentation: {
        ...initialPres,
        lockedAt,
      },
      adjunctsAtArrival: incoming.adjunctsAtArrival || incoming.adjuncts,
      adjunctsNow: incoming.adjunctsNow || incoming.adjuncts,
      adjuncts: incoming.adjunctsNow || incoming.adjuncts,
    };
  }
}
