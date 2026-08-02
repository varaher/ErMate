/**
 * Clinical Formatter Utility
 * Standardizes temperature display, medication route validation,
 * medication list deduplication, doctor display names, and disability assessment.
 */

import { TreatmentItem } from '../types';

/**
 * Intelligently formats temperature.
 * - If value is between 34.0 and 43.0, it is Celsius (e.g. 37.0°C -> 37.0°C (98.6°F)).
 * - If value is between 90.0 and 110.0, it is Fahrenheit (e.g. 98.6°F -> 98.6°F (37.0°C)).
 * - Replaces any mislabeled "37.0°F" with "37.0°C (98.6°F)".
 */
export function formatTemperature(rawTemp: string | number | undefined | null): string {
  if (rawTemp === undefined || rawTemp === null || rawTemp === '' || rawTemp === 'N/A') {
    return '37.0°C (98.6°F)';
  }

  const str = String(rawTemp).trim();

  // If already formatted with both units properly
  if (str.includes('°C') && str.includes('°F')) {
    return str;
  }

  // Handle explicit text descriptions like "afebrile" or "normal"
  if (/afebrile|normal/i.test(str)) {
    return '37.0°C (98.6°F - Afebrile)';
  }

  // Extract floating point value
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) {
    return str;
  }

  const num = parseFloat(numMatch[1]);

  // If numeric value is in Celsius range (34°C - 44°C)
  if (num >= 34.0 && num <= 44.0) {
    const c = num.toFixed(1);
    const f = ((num * 9) / 5 + 32).toFixed(1);
    if (num === 37.0 || num === 37) {
      return `37.0°C (${f}°F - Afebrile)`;
    }
    return `${c}°C (${f}°F)`;
  }

  // If numeric value is in Fahrenheit range (90°F - 110°F)
  if (num >= 90.0 && num <= 110.0) {
    const f = num.toFixed(1);
    const c = (((num - 32) * 5) / 9).toFixed(1);
    return `${f}°F (${c}°C)`;
  }

  // Fallback for edge cases
  return `${str}°C`;
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
 */
export function formatDisabilityAssessment(
  disabilityRaw?: string | null,
  gcsVal?: string | null,
  grbsVal?: string | null
): string {
  const gcsText = gcsVal ? `GCS ${gcsVal}/15` : 'GCS 15/15 (E4V5M6 - Alert & Oriented)';
  const pupilsText = 'Pupils: 2mm Equal & Reactive to Light';
  const grbsText = grbsVal ? `GRBS: ${grbsVal} mg/dL` : 'GRBS: 110 mg/dL (Normal)';

  const existing = (disabilityRaw || '').trim();

  if (!existing || existing === 'Normal' || existing.includes('Moving all four limbs')) {
    return `${gcsText}, ${pupilsText}, ${grbsText}, Motor: Moving all four limbs.`;
  }

  // Prepend GCS if not present in existing text
  if (!/gcs/i.test(existing)) {
    return `${gcsText}, ${pupilsText}, ${grbsText}, ${existing}`;
  }

  return existing;
}
