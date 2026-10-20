import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase.ts";
import { sanitizeForFirestore } from "./firestoreSanitizer.ts";
import type { LogbookEntry } from "../types.ts";

/**
 * Builds a valid, de-identified clinical logbook portfolio entry
 * conforming to LogbookEntry schema from a saved clinical case.
 */
export function buildLogbookEntryFromCase(
  caseData: any,
  uid: string
): LogbookEntry {
  const entryId = `${uid}_${caseData.id}`;
  let proceduresPerformed: string[] = [];
  if (Array.isArray(caseData.proceduresChecked)) {
    proceduresPerformed = [...caseData.proceduresChecked];
  } else if (Array.isArray(caseData.procedures)) {
    proceduresPerformed = [...caseData.procedures];
  }

  const now = new Date().toISOString();

  // Extract date
  const dateSeen = (() => {
    const potentialDates = [caseData.dateSeen, caseData.createdAt, caseData.arrivalDateTime, caseData.savedTime];
    for (const pd of potentialDates) {
      if (typeof pd === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(pd)) {
          return pd;
        }
        if (pd.includes("T")) {
          const datePart = pd.split("T")[0];
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return datePart;
          }
        }
      }
    }
    return new Date().toISOString().split("T")[0];
  })();

  // Age group determination
  const ageGroup = (() => {
    const ageVal = caseData.patient?.age;
    if (ageVal != null && ageVal !== "") {
      const ageStr = String(ageVal).toLowerCase();
      if (
        ageStr.includes("month") ||
        ageStr.includes("day") ||
        ageStr.includes("week") ||
        ageStr.includes("hr") ||
        ageStr.includes("hour")
      ) {
        return "pediatric";
      }
      const age = parseInt(ageStr, 10);
      if (!isNaN(age)) {
        return age <= 16 ? "pediatric" : "adult";
      }
    }
    if (caseData.isPediatric) return "pediatric";
    return "adult";
  })();

  return {
    entryId,
    ownerUid: uid,
    sourceCaseId: caseData.id,
    sourceType: caseData.workspaceType || "hospital",
    hospitalIdAtTime: caseData.hospitalId || caseData.hospital || null,
    hospitalNameAtTime: caseData.hospitalName || caseData.hospitalLabel || caseData.workplaceName || null,
    roleAtTime: caseData.lastEditedByRole || null,
    dateSeen,
    ageGroup,
    gender: caseData.patient?.gender || null,
    triageCategory: caseData.vitals?.triageCategory || caseData.triageCategory || null,
    caseCategory: caseData.caseCategory || caseData.triageCategory || "General ER",
    proceduresPerformed,
    createdAt: caseData.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Validates attribution: doctor personal log book captures cases created,
 * owned, or explicitly attributed to the active doctor.
 */
export function shouldSyncCaseToUserLogbook(
  caseData: any,
  uid: string,
  userEmail?: string | null
): boolean {
  if (!caseData || !caseData.id || !uid) return false;
  if (caseData.createdByUid === uid || caseData.ownerUid === uid) return true;
  if (!caseData.createdByUid && caseData.doctorEmail && userEmail) {
    return caseData.doctorEmail.toLowerCase().trim() === userEmail.toLowerCase().trim();
  }
  return true;
}

/**
 * Direct client-side logbook sync to Firestore.
 * Bypasses backend Admin SDK (which requires service-account IAM credentials
 * not available in client container environments) and writes directly to
 * /users/{uid}/logbook/{entryId} using the authenticated client session.
 */
export async function syncCaseToLogbookDirect(
  caseData: any,
  uid: string,
  userEmail?: string | null
): Promise<void> {
  if (!shouldSyncCaseToUserLogbook(caseData, uid, userEmail)) return;
  try {
    const entry = buildLogbookEntryFromCase(caseData, uid);
    const logbookRef = doc(db, "users", uid, "logbook", entry.entryId);
    await setDoc(logbookRef, sanitizeForFirestore(entry), { merge: true });
  } catch (err) {
    console.warn("[LogbookSync] Direct client logbook sync error (non-fatal):", err);
  }
}
