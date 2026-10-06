import { Firestore, doc, runTransaction } from "firebase/firestore";
import { ClinicalCase } from "../types";
import { sanitizeForFirestore } from "./firestoreSanitizer";

/**
 * ErMate Phase 0 Safety Foundation: Concurrent Case Update & Leaf-Level Deep Merge
 *
 * Prevents silent nested-field data loss when multiple clinicians (or Scribe sessions)
 * update the same ClinicalCase concurrently.
 *
 * Invariants:
 * 1. Preserves existing ClinicalCase schema without creating a second record model.
 * 2. Deep-merges individual leaves for complex nested objects:
 *    - vitals (bp, hr, spo2, rr, temp, gcs, grbs, etc.)
 *    - sampleHistory (symptoms, allergies, pastHistory, events, medications, etc.)
 *    - primaryAssessment & adjuncts
 *    - secondarySurvey
 *    - investigations (testName deduplication)
 *    - treatments (drugName + dose deduplication)
 *    - progressNotes (chronological timestamped append)
 * 3. Exact field collision policy: When two doctors update the exact same leaf field
 *    at the same instant, the last-committed transaction wins deterministically for
 *    that specific leaf, while preserving all other non-conflicting leaves.
 */

/**
 * Pure leaf-level merge function.
 * Merges updated fields from `incoming` on top of `baseCase` without wiping non-conflicting leaves.
 */
export function mergeConcurrentCaseLeaves(
  baseCase: ClinicalCase,
  incoming: Partial<ClinicalCase>
): ClinicalCase {
  if (!baseCase) return incoming as ClinicalCase;
  if (!incoming) return baseCase;

  // 1. Merge Vitals leaf-by-leaf
  const baseVitals = baseCase.vitals || {};
  const inVitals = incoming.vitals || {};
  const mergedVitals = {
    ...baseVitals,
    ...(inVitals.bp !== undefined && inVitals.bp !== "" ? { bp: inVitals.bp } : {}),
    ...(inVitals.hr !== undefined && inVitals.hr !== "" ? { hr: inVitals.hr } : {}),
    ...(inVitals.spo2 !== undefined && inVitals.spo2 !== "" ? { spo2: inVitals.spo2 } : {}),
    ...(inVitals.rr !== undefined && inVitals.rr !== "" ? { rr: inVitals.rr } : {}),
    ...(inVitals.temp !== undefined && inVitals.temp !== "" ? { temp: inVitals.temp } : {}),
    ...(inVitals.gcs !== undefined && inVitals.gcs !== "" ? { gcs: inVitals.gcs } : {}),
    ...(inVitals.gcs_e !== undefined && inVitals.gcs_e !== "" ? { gcs_e: inVitals.gcs_e } : {}),
    ...(inVitals.gcs_v !== undefined && inVitals.gcs_v !== "" ? { gcs_v: inVitals.gcs_v } : {}),
    ...(inVitals.gcs_m !== undefined && inVitals.gcs_m !== "" ? { gcs_m: inVitals.gcs_m } : {}),
    ...(inVitals.grbs !== undefined && inVitals.grbs !== "" ? { grbs: inVitals.grbs } : {}),
    ...(inVitals.avpu !== undefined && inVitals.avpu !== "" ? { avpu: inVitals.avpu } : {}),
    ...(inVitals.painScore !== undefined && inVitals.painScore !== "" ? { painScore: inVitals.painScore } : {}),
  };

  // 2. Merge SAMPLE History leaf-by-leaf
  const baseSample = baseCase.sampleHistory || {};
  const inSample = incoming.sampleHistory || {};
  const mergedSample = {
    ...baseSample,
    ...(inSample.symptoms !== undefined && inSample.symptoms !== "" ? { symptoms: inSample.symptoms } : {}),
    ...(inSample.allergies !== undefined && inSample.allergies !== "" ? { allergies: inSample.allergies } : {}),
    ...(inSample.medications !== undefined && inSample.medications !== "" ? { medications: inSample.medications } : {}),
    ...(inSample.pastHistory !== undefined && inSample.pastHistory !== "" ? { pastHistory: inSample.pastHistory } : {}),
    ...(inSample.lastMeal !== undefined && inSample.lastMeal !== "" ? { lastMeal: inSample.lastMeal } : {}),
    ...(inSample.events !== undefined && inSample.events !== "" ? { events: inSample.events } : {}),
    ...(inSample.socialHistory !== undefined && inSample.socialHistory !== "" ? { socialHistory: inSample.socialHistory } : {}),
    ...(inSample.familyHistory !== undefined && inSample.familyHistory !== "" ? { familyHistory: inSample.familyHistory } : {}),
    ...(inSample.psychiatricFlags !== undefined && inSample.psychiatricFlags !== "" ? { psychiatricFlags: inSample.psychiatricFlags } : {}),
  };

  // 3. Merge Primary Assessment & Adjuncts
  const basePA: any = baseCase.primaryAssessment || {};
  const inPA: any = incoming.primaryAssessment || {};
  const mergedPA = {
    ...basePA,
    ...inPA,
    survey: {
      ...(basePA.survey || {}),
      ...(inPA.survey || {}),
      adjuncts: {
        ...(basePA.survey?.adjuncts || {}),
        ...(inPA.survey?.adjuncts || {}),
        abg: {
          ...(basePA.survey?.adjuncts?.abg || {}),
          ...(inPA.survey?.adjuncts?.abg || {}),
        },
      },
    },
  };

  // 4. Merge Secondary Survey
  const baseSec = baseCase.secondarySurvey || {};
  const inSec = incoming.secondarySurvey || {};
  const mergedSec = {
    ...baseSec,
    ...inSec,
  };

  // 5. Merge Investigations (deduplicate by testName case-insensitive)
  const baseInv = Array.isArray(baseCase.investigations) ? baseCase.investigations : [];
  const inInv = Array.isArray(incoming.investigations) ? incoming.investigations : [];
  const mergedInv = [...baseInv];
  for (const item of inInv) {
    if (!item?.testName) continue;
    const exists = mergedInv.some(
      (m) => m.testName.toLowerCase().trim() === item.testName.toLowerCase().trim()
    );
    if (!exists) {
      mergedInv.push(item);
    }
  }

  // 6. Merge Treatments (deduplicate by drugName + dose)
  const baseTrt = Array.isArray(baseCase.treatments) ? baseCase.treatments : [];
  const inTrt = Array.isArray(incoming.treatments) ? incoming.treatments : [];
  const mergedTrt = [...baseTrt];
  for (const item of inTrt) {
    if (!item?.drugName) continue;
    const exists = mergedTrt.some(
      (m) =>
        m.drugName.toLowerCase().trim() === item.drugName.toLowerCase().trim() &&
        (!item.dose || m.dose === item.dose)
    );
    if (!exists) {
      mergedTrt.push(item);
    }
  }

  // 7. Merge Progress Notes
  const baseNotes = (baseCase.progressNotes || "").trim();
  const inNotes = (incoming.progressNotes || "").trim();
  let mergedNotes = baseNotes;
  if (inNotes && inNotes !== baseNotes) {
    if (!baseNotes) {
      mergedNotes = inNotes;
    } else if (!baseNotes.includes(inNotes)) {
      mergedNotes = `${baseNotes}\n${inNotes}`;
    }
  }

  // 8. Construct merged ClinicalCase
  return {
    ...baseCase,
    ...incoming,
    id: baseCase.id || incoming.id!,
    displayId: baseCase.displayId || incoming.displayId,
    bedNo: incoming.bedNo || baseCase.bedNo,
    patient: {
      ...(baseCase.patient || {}),
      ...(incoming.patient || {}),
      bed: incoming.patient?.bed || incoming.bedNo || baseCase.patient?.bed || baseCase.bedNo,
      name: incoming.patient?.name || baseCase.patient?.name || "",
      age: incoming.patient?.age !== undefined ? incoming.patient.age : baseCase.patient?.age,
      gender: incoming.patient?.gender || baseCase.patient?.gender || "",
      uhid: baseCase.patient?.uhid || incoming.patient?.uhid || "",
    },
    vitals: mergedVitals,
    sampleHistory: mergedSample,
    primaryAssessment: mergedPA,
    secondarySurvey: Object.keys(mergedSec).length > 0 ? mergedSec : undefined,
    investigations: mergedInv,
    treatments: mergedTrt,
    progressNotes: mergedNotes,
    lastEditedAt: new Date().toISOString(),
  };
}

/**
 * Transactional runner for concurrent case updates in Firestore.
 * Automatically handles Firestore optimistic concurrency retry (up to 5 attempts)
 * ensuring concurrent writes by Doctor A and Doctor B do not overwrite each other.
 */
export async function applyConcurrentCaseUpdate(
  dbInstance: Firestore,
  caseId: string,
  updater: (currentCase: ClinicalCase) => ClinicalCase
): Promise<ClinicalCase> {
  const caseRef = doc(dbInstance, "cases", caseId);

  return await runTransaction(dbInstance, async (txn) => {
    const snap = await txn.get(caseRef);
    if (!snap.exists()) {
      throw new Error(`ClinicalCase ${caseId} does not exist in Firestore.`);
    }

    const currentServerCase = snap.data() as ClinicalCase;
    const updatedCase = updater(currentServerCase);
    const cleanCase = sanitizeForFirestore(updatedCase);

    txn.set(caseRef, cleanCase, { merge: true });
    return updatedCase;
  });
}
