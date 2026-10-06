import { ClinicalCase } from "../types";
import { normalizeMateBedId, isValidMateBedLocation } from "../mate/mateBedModel";

export interface BedAllocationResult {
  success: boolean;
  canonicalBed?: string;
  error?: string;
  existingOccupant?: ClinicalCase;
}

/**
 * Canonical Bed Allocation & Occupancy Validation
 * 
 * Rules:
 * 1. Normalize input using canonical normalizeMateBedId (e.g. "11", "11A", "11 B" -> "11B", "Bed 10B" -> "10B").
 * 2. Validate location is within hospital physical capacity (default 30).
 * 3. Filter active cases (non-archived, non-discharged, excluding case being modified).
 * 4. For explicit slot (e.g. 11A, 11B):
 *    - If exact slot is occupied by an active case -> refuse, return error with existing occupant name.
 *    - Otherwise -> allocate exact slot.
 * 5. For bare bed (e.g. 11):
 *    - Follow existing locked MATE family allocation semantics:
 *      * neither A nor B occupied -> 11A
 *      * A occupied, B free -> 11B
 *      * B occupied, A free -> 11A
 *      * both A and B occupied -> fail closed, return error with existing occupant.
 */
export function allocateOrValidateBed(
  requestedBed: string | number | null | undefined,
  activeCases: ClinicalCase[],
  physicalCapacity: number = 30,
  currentCaseId?: string | null
): BedAllocationResult {
  if (requestedBed === null || requestedBed === undefined || String(requestedBed).trim() === "") {
    return { success: false, error: "Please enter a valid bed number." };
  }

  const normalized = normalizeMateBedId(requestedBed);
  if (!normalized) {
    return { success: false, error: "Invalid bed number format. Use e.g. 11, 11A, or 11B." };
  }

  const safeCapacity = Math.max(1, Math.min(200, physicalCapacity || 30));
  if (!isValidMateBedLocation(normalized, safeCapacity)) {
    return {
      success: false,
      error: `Bed ${normalized} is outside the configured ER capacity (${safeCapacity} beds).`,
    };
  }

  // Active cases excluding archived, discharged, and the current case being assigned
  const activeCensus = (activeCases || []).filter(
    (c) => c && c.status !== "Discharged" && !(c as any).archivedAt && (!currentCaseId || c.id !== currentCaseId)
  );

  const isExplicitSubdivision = /[AB]$/i.test(normalized);

  if (isExplicitSubdivision) {
    // Explicit slot (e.g. 11A or 11B)
    const exactOccupant = activeCensus.find(
      (c) => normalizeMateBedId(c.bedNo) === normalized
    );

    if (exactOccupant) {
      const occupantName = exactOccupant.patient?.name || exactOccupant.id;
      return {
        success: false,
        canonicalBed: normalized,
        error: `Bed ${normalized} is already occupied by ${occupantName}. Please choose a vacant bed slot.`,
        existingOccupant: exactOccupant,
      };
    }

    return {
      success: true,
      canonicalBed: normalized,
    };
  }

  // Bare bed number (e.g. "11") -> Locked MATE family allocation
  const baseNum = normalized; // pure number string
  const slotAMatches = activeCensus.filter(
    (c) => normalizeMateBedId(c.bedNo) === `${baseNum}A` || normalizeMateBedId(c.bedNo) === baseNum
  );
  const slotBMatches = activeCensus.filter(
    (c) => normalizeMateBedId(c.bedNo) === `${baseNum}B`
  );

  const aOccupied = slotAMatches.length > 0;
  const bOccupied = slotBMatches.length > 0;

  if (aOccupied && bOccupied) {
    const occupantA = slotAMatches[0].patient?.name || slotAMatches[0].id;
    const occupantB = slotBMatches[0].patient?.name || slotBMatches[0].id;
    return {
      success: false,
      canonicalBed: baseNum,
      error: `Bed ${baseNum} is fully occupied (${baseNum}A: ${occupantA}, ${baseNum}B: ${occupantB}). Please select a vacant bed.`,
      existingOccupant: slotAMatches[0],
    };
  }

  if (aOccupied && !bOccupied) {
    return {
      success: true,
      canonicalBed: `${baseNum}B`,
    };
  }

  // If bOccupied or neither occupied -> allocate slot A
  return {
    success: true,
    canonicalBed: `${baseNum}A`,
  };
}
