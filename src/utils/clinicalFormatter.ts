/**
 * Clinical Formatter Utility
 * Standardizes temperature display, medication route validation,
 * medication list deduplication, doctor display names, and disability assessment.
 */

import { TreatmentItem } from '../types';

const isBlank = (v: any) =>
  v === undefined || v === null || String(v).trim() === "" ||
  ["n/a", "na", "null", "undefined", "not documented"].includes(String(v).trim().toLowerCase());

/** Dictated unit only. Never infer or convert. */
export function displayTemperature(raw: any): string {
  if (isBlank(raw)) return "Not documented";
  const s = String(raw).trim();
  const unit = s.match(/(°\s*[cf]\b|\b(?:celsius|fahrenheit)\b|\b[cf]$)/i);
  if (unit) return s;
  return `${s} (unit not stated)`;
}

/** Only what was documented. Never calculates or defaults a total. */
export function displayGcs(v: { gcs?: any; gcs_e?: any; gcs_v?: any; gcs_m?: any; gcsE?: any; gcsV?: any; gcsM?: any } | string | number | null | undefined): string {
  if (!v) return "Not documented";
  if (typeof v === "number" || typeof v === "string") {
    const s = String(v).trim();
    if (isBlank(s)) return "Not documented";
    return s.includes("/15") ? s : `${s}/15`;
  }
  const eVal = v.gcs_e ?? v.gcsE;
  const vVal = v.gcs_v ?? v.gcsV;
  const mVal = v.gcs_m ?? v.gcsM;
  const parts = [
    !isBlank(eVal) ? `E${String(eVal).replace(/^e/i, "")}` : null,
    !isBlank(vVal) ? `V${String(vVal).replace(/^v/i, "")}` : null,
    !isBlank(mVal) ? `M${String(mVal).replace(/^m/i, "")}` : null,
  ].filter(Boolean) as string[];
  const missing = ["E", "V", "M"].filter(c => !parts.some(p => p.startsWith(c)));
  const comp = parts.length
    ? `${parts.join(" ")}${missing.length ? ` (${missing.join(", ")} not documented)` : ""}`
    : "";
  if (!isBlank(v.gcs)) {
    const total = String(v.gcs).replace(/\s*\/\s*15$/, "");
    return comp ? `${total}/15 — ${comp}` : `${total}/15`;
  }
  return comp ? `Total not documented — ${comp}` : "Not documented";
}

export function displaySpo2(raw: any): string {
  if (isBlank(raw)) return "Not documented";
  return `${String(raw).replace(/%/g, "").trim()}%`;
}

export function displayGrbs(raw: any): string {
  if (isBlank(raw)) return "Not documented";
  const s = String(raw).trim();
  return /mg\s*\/?\s*dl|mmol/i.test(s)
    ? s
    : `${s} (unit not stated)`;
}

export function displayDocumentedBoolean(value: any): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not documented";
}

/**
 * Standardizes temperature display by calling displayTemperature.
 * Removed legacy fabricated default 37.0°C (98.6°F) and unit inference/conversion.
 */
export function formatTemperature(rawTemp: string | number | undefined | null): string {
  return displayTemperature(rawTemp);
}

/**
 * Validates and corrects medication route based on drug form.
 * E.g. Tablets (Tab.), Capsules (Cap.), Syrups (Syr.) MUST be Oral, NEVER IV.
 */
export function validateMedRoute(drugName: string, currentRoute?: string): string {
  const name = (drugName || '').trim();
  const lowerName = name.toLowerCase();

  // Oral Solid & Liquid forms
  if (
    /^(tab\.|cap\.|syr\.|syrup|susp\.|tbl|tablet|capsule|oral|po)/i.test(name) ||
    /\b(tablet|capsule|syrup|suspension|oral|po)\b/i.test(name)
  ) {
    return 'Oral';
  }

  // Parenteral forms
  if (/^(inj\.|injection)/i.test(name) || /\b(injection|ampoule|vial)\b/i.test(name)) {
    if (!currentRoute || currentRoute === 'Oral' || currentRoute === 'Stat') {
      return 'IV';
    }
    return currentRoute;
  }

  // IV Fluids
  if (/\b(iv fluids?|normal saline|ns|rl|ringer|d5w|dns)\b/i.test(name)) {
    return 'IV';
  }

  // Nebulization / Inhalation
  if (/\b(neb|nebulization|inhaler|puff|duolin|budecort)\b/i.test(name)) {
    return 'Inhalation / Nebulization';
  }

  // Sublingual
  if (/\b(gtn|sublingual|sl)\b/i.test(name)) {
    return 'Sublingual';
  }

  // Default to current route or Oral
  return currentRoute && currentRoute !== 'Stat' ? currentRoute : 'Oral';
}

/**
 * Deduplicates medication entries (e.g., Inj. Omeprazole vs Omeprazole, Inj. Emeset (Ondansetron) vs Ondansetron).
 */
export function deduplicateMeds<T extends { id?: string; drugName: string; dose?: string; route?: string; timeGiven?: string; ipsgVerified?: boolean }>(meds: T[]): T[] {
  if (!Array.isArray(meds) || meds.length === 0) return [];

  const seenKeys = new Map<string, T>();

  meds.forEach((med) => {
    if (!med || !med.drugName) return;

    // Normalize drug name key
    let baseKey = med.drugName.toLowerCase();

    // Strip prefixes like Inj., Tab., Cap.
    baseKey = baseKey.replace(/^(inj\.|tab\.|cap\.|syr\.|syrup|susp\.)\s*/gi, '');

    // Extract brand/generic from parentheses e.g. "Inj. Emeset (Ondansetron)" -> "ondansetron"
    const parenMatch = baseKey.match(/\((.*?)\)/);
    if (parenMatch) {
      baseKey = parenMatch[1].trim();
    }

    // Standardize common brand aliases
    if (baseKey.includes('emeset')) baseKey = 'ondansetron';
    if (baseKey.includes('ziddot')) baseKey = 'ziddot';
    if (baseKey.includes('sompraz') || baseKey.includes('pan 40') || baseKey.includes('pantocid')) baseKey = 'pantoprazole';
    if (baseKey.includes('ecosprin')) baseKey = 'aspirin';
    if (baseKey.includes('calpol') || baseKey.includes('dolo') || baseKey.includes('pcm')) baseKey = 'paracetamol';

    // Remove dose numbers (e.g., 100mg, 4mg)
    baseKey = baseKey.replace(/\d+[\.\d]*\s*(mg|g|mcg|iu|ml)\b/gi, '').trim();

    // Validate and correct route
    const correctedRoute = validateMedRoute(med.drugName, med.route);
    const updatedMed = { ...med, route: correctedRoute };

    if (!seenKeys.has(baseKey)) {
      seenKeys.set(baseKey, updatedMed);
    } else {
      // If we already have this drug, pick the more descriptive one (e.g. one with explicit dose or brand)
      const existing = seenKeys.get(baseKey)!;
      const existingScore = (existing.drugName.length || 0) + (existing.dose && existing.dose !== 'Stat' ? 10 : 0);
      const newScore = (med.drugName.length || 0) + (med.dose && med.dose !== 'Stat' ? 10 : 0);

      if (newScore > existingScore) {
        seenKeys.set(baseKey, updatedMed);
      }
    }
  });

  return Array.from(seenKeys.values());
}

/**
 * Formats doctor display name cleanly.
 * Capitalizes usernames like "rajagirier" -> "Dr. Rajagirier".
 */
export function formatDoctorName(rawName?: string | null): string {
  if (!rawName || !rawName.trim()) {
    return 'Dr. On Duty';
  }

  let clean = rawName.trim();

  // If it's an email address, extract prefix before @
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }

  // If name contains lowercase-only username without space (e.g. "rajagirier")
  if (/^[a-z0-9_]+$/.test(clean)) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // Title case all words
  clean = clean
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Ensure "Dr." prefix
  if (!/^Dr\.?/i.test(clean)) {
    clean = `Dr. ${clean}`;
  }

  return clean;
}

/**
 * Formats Primary Survey Disability assessment to ensure GCS, Pupils, and GRBS are explicitly shown.
 * Removed fabricated defaults (GCS 15/15, 2mm equal/reactive pupils, 110 mg/dL GRBS).
 */
export function formatDisabilityAssessment(
  disabilityRaw?: string | null,
  gcsVal?: string | null,
  grbsVal?: string | null
): string {
  const gcsText = `GCS: ${displayGcs({ gcs: gcsVal })}`;
  const pupilsText = 'Pupils: Not documented';
  const grbsText = `GRBS: ${displayGrbs(grbsVal)}`;

  const existing = (disabilityRaw || '').trim();

  if (!existing || existing === 'Normal' || existing.includes('Moving all four limbs')) {
    return `${gcsText}, ${pupilsText}, ${grbsText}`;
  }

  // Prepend GCS if not present in existing text
  if (!/gcs/i.test(existing)) {
    return `${gcsText}, ${pupilsText}, ${grbsText}, ${existing}`;
  }

  return existing;
}
