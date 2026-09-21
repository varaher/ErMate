// ============================================================
// ErMate — DPDP-Compliant Server-Side PHI De-identification Engine
// File: server/deidentify.ts
// ============================================================
// Performs local on-the-fly de-identification on Cloud Run (India)
// BEFORE any EMR or transcript text is sent to LLM processing.
// Guarantees DPDP Act 2023 compliance for sensitive health data.

export interface DeidentifyResult {
  deidentified: string;
  phiFound: string[];
  phiCount: number;
  details: {
    names: number;
    ids: number;
    phones: number;
    doctors: number;
    aadhaar: number;
    dates: number;
    hospitals: number;
  };
}

const PHI_PATTERNS = [
  // 1. Phone numbers (Indian formats)
  {
    type: 'phones' as const,
    pattern: /(?:\+91[\s-]?)?(?:0)?[6-9]\d{9}|\b[6-9]\d{4}[\s-]\d{5}\b/g,
    replacement: '[PHONE]',
    label: 'Phone Number'
  },

  // 2. Aadhaar Number (12 digits, spaced or dash)
  {
    type: 'aadhaar' as const,
    pattern: /\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
    replacement: '[AADHAAR]',
    label: 'Aadhaar ID'
  },

  // 3. UHID / MRN / Hospital Registration IDs
  {
    type: 'ids' as const,
    // FIX (Sept 2026): added a mandatory-digit lookahead. The bare prefixes
    // (UR, CR, IP, OP, ER, REG) combined with a case-insensitive, all-letters
    // suffix class previously matched ordinary clinical words with no digits
    // at all — "Ipratropium" (IP+ratropium), "Creatinine" (CR+eatinine),
    // "erythema" (ER+ythema), "Registered"/"Regular" (REG+suffix), "Urgent"
    // (UR+gent) — and silently replaced them with "[PATIENT-ID]" before the
    // text ever reached the extraction model, corrupting drug names, lab
    // names, and clinical descriptors with no visible trace of the error.
    // A real UHID/MRN/ER number always contains at least one digit;
    // requiring that here removes the false positives without weakening
    // genuine ID detection.
    pattern: /\b(?:UHID|MRN|UR|CR|IP(?:[NO\.\s#]*)|OP(?:[NO\.\s#]*)|ER(?:[NO\.\s#]*)|REG(?:[NO\.\s#]*))[:\s#-]*(?=[A-Z0-9\/-]*\d)[A-Z0-9\/-]{4,20}\b/gi,
    replacement: '[PATIENT-ID]',
    label: 'Hospital UHID/MRN'
  },

  // 4. Explicit Doctor / Consultant Names
  {
    type: 'doctors' as const,
    pattern: /\b(?:Dr\.?|Doctor|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g,
    replacement: '[DOCTOR]',
    label: 'Doctor Name'
  },

  // 5. Patient Name Explicit Headers
  {
    type: 'names' as const,
    pattern: /\b(?:Patient\s*Name|Name\s*of\s*Patient|Pt\s*Name|Name)\s*[:=-]\s*([A-Za-z\s]{2,30})(?=\r?\n|,|;|$|\d)/gi,
    replacement: 'Patient Name: [PATIENT]',
    label: 'Patient Name Header'
  },

  // 6. Common Salutation Patient Names (Mr / Mrs / Ms / Mast / Baby of)
  {
    type: 'names' as const,
    pattern: /\b(?:Mr\.?|Mrs\.?|Ms\.?|Mast\.?|Baby\s+of|B\/O)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/gi,
    replacement: '[PATIENT]',
    label: 'Patient Name'
  },

   // 7. Hospital & Facility Names
  {
    type: 'hospitals' as const,
    pattern: /\b(?:[A-Za-z]+\s+)*(?:Hospital|Medical\s+Center|Clinic|Institute|Nursing\s+Home|Healthcare|Super\s+Speciality)\b/gi,
    replacement: '[HOSPITAL]',
    label: 'Hospital Facility'
  }
];

const DATE_PATTERN = /\b(?<!\d)(?:(?:0?[1-9]|[12]\d|3[01])[\/\.-](?:0?[1-9]|1[012])[\/\.-](?:19|20)?\d\d|(?:19|20)\d\d[\/\.-](?:0?[1-9]|1[012])[\/\.-](?:0?[1-9]|[12]\d|3[01]))(?!\d)\b/g;

/**
 * Parses a raw date string (dd/mm/yyyy or yyyy-mm-dd) into a JS Date object.
 */
function parseDateString(dateStr: string): Date | null {
  try {
    const parts = dateStr.split(/[\/\.-]/).map(p => parseInt(p, 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    let day: number, month: number, year: number;
    if (parts[0] > 1000) {
      // YYYY-MM-DD
      year = parts[0];
      month = parts[1] - 1;
      day = parts[2];
    } else {
      // DD-MM-YYYY
      day = parts[0];
      month = parts[1] - 1;
      year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
    }

    const d = new Date(year, month, day);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Converts absolute calendar dates in text to relative clinical day labels ("Day 1", "Day 2", etc.)
 * preserving temporal trajectory while removing absolute calendar PHI.
 */
function convertDatesToRelativeTimeline(text: string): { text: string; datesFound: number; phiFound: string[] } {
  const matches = text.match(DATE_PATTERN);
  if (!matches || matches.length === 0) {
    return { text, datesFound: 0, phiFound: [] };
  }

  const phiFound: string[] = [];
  const parsedMap: { match: string; dateObj: Date | null }[] = matches.map(m => {
    const clean = m.trim();
    phiFound.push(`Calendar Date: ${clean}`);
    return { match: clean, dateObj: parseDateString(clean) };
  });

  // Find valid dates and sort to determine earliest baseline date
  const validDates = parsedMap
    .map(p => p.dateObj)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const earliest = validDates.length > 0 ? validDates[0] : null;

  let processed = text;
  for (const item of parsedMap) {
    let replacement = '[Day 1]';
    if (item.dateObj && earliest) {
      const diffTime = item.dateObj.getTime() - earliest.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        replacement = `Day ${diffDays + 1}`;
      } else {
        replacement = `Day ${diffDays}`;
      }
    }
    // Replace all exact instances of this date string
    processed = processed.replace(new RegExp(item.match.replace(/[\/\.-]/g, '[\\/\\.-]'), 'g'), `[${replacement}]`);
  }

  return {
    text: processed,
    datesFound: matches.length,
    phiFound
  };
}

export function deidentifyText(rawText: string): DeidentifyResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      deidentified: '',
      phiFound: [],
      phiCount: 0,
      details: { names: 0, ids: 0, phones: 0, doctors: 0, aadhaar: 0, dates: 0, hospitals: 0 }
    };
  }

  let processed = rawText;
  const phiFound: string[] = [];
  const details = {
    names: 0,
    ids: 0,
    phones: 0,
    doctors: 0,
    aadhaar: 0,
    dates: 0,
    hospitals: 0
  };

  // Step A: Convert calendar dates to relative clinical timeline labels ("Day 1", "Day 2"...)
  const dateResult = convertDatesToRelativeTimeline(processed);
  processed = dateResult.text;
  details.dates = dateResult.datesFound;
  for (const f of dateResult.phiFound) {
    if (!phiFound.includes(f)) phiFound.push(f);
  }

  // Step B: Replace other PHI patterns (phones, IDs, names, doctors, hospitals, Aadhaar)
  for (const rule of PHI_PATTERNS) {
    const matches = processed.match(rule.pattern);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        const cleanMatch = m.trim();
        if (!phiFound.includes(`${rule.label}: ${cleanMatch}`)) {
          phiFound.push(`${rule.label}: ${cleanMatch}`);
        }
        details[rule.type]++;
      }
      processed = processed.replace(rule.pattern, rule.replacement);
    }
  }

  const phiCount = Object.values(details).reduce((acc, curr) => acc + curr, 0);

  return {
    deidentified: processed,
    phiFound,
    phiCount,
    details
  };
}

// ============================================================
// Internal Clinician Attribution Preservation & Guards
// ============================================================

export interface InternalClinicianAttribution {
  emResident?: string;
  emConsultant?: string;
}

export interface ProtectedCliniciansResult {
  protectedText: string;
  clinicians: InternalClinicianAttribution;
  placeholders: Record<string, string>;
}

const CLINICAL_ROLE_STOPWORDS = new Set([
  "patient", "pt", "presents", "presented", "evaluating", "evaluated", "saw", "seen",
  "reports", "reported", "complaining", "complained", "complains", "noted", "admitted",
  "referred", "ordered", "vitals", "history", "examination", "assessment", "plan",
  "airway", "breathing", "circulation", "disability", "exposure", "male", "female",
  "years", "yo", "old", "with", "for", "and", "but", "on", "at", "in", "to", "he", "she",
  "em", "er", "ed", "resident", "consultant"
]);

/**
 * Protects explicitly role-attributed INTERNAL treating-team clinician names
 * (e.g. "EM Resident Dr Joshua", "Emergency Medicine Consultant Dr Christo")
 * before general de-identification by temporarily replacing the clinician name
 * with local reversible placeholders (e.g. __ERMATE_EM_RESIDENT_0__).
 *
 * External referral doctor names and other unrelated doctor names are NOT protected
 * and remain subject to standard [DOCTOR] de-identification.
 */
export function protectInternalClinicians(rawText: string): ProtectedCliniciansResult {
  if (!rawText || typeof rawText !== "string") {
    return { protectedText: rawText || "", clinicians: {}, placeholders: {} };
  }

  const clinicians: InternalClinicianAttribution = {};
  const placeholders: Record<string, string> = {};
  let protectedText = rawText;

  // Regex matches only internal treating-team roles: EM / ER / ED / Emergency Medicine / Emergency Department
  const roleRegex = /\b((?:(?:Treating\s+)?(?:Emergency\s+Medicine|Emergency\s+Department|EM|ER|ED)\s+)(Resident|Consultant))\s*[:=-]?\s*(\b(?:Dr\.?|Doctor|Prof\.?)\s+[A-Za-z]+(?:\s+[A-Za-z]+)?|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi;

  let residentIdx = 0;
  let consultantIdx = 0;

  protectedText = protectedText.replace(roleRegex, (fullMatch, fullRole, roleType, nameGroup) => {
    const isResident = /resident/i.test(roleType);
    const isConsultant = /consultant/i.test(roleType);

    const cleanName = nameGroup.trim();
    const hasDr = /^(?:dr\.?|doctor|prof\.?)\s+/i.test(cleanName);
    const withoutDr = cleanName.replace(/^(?:dr\.?|doctor|prof\.?)\s+/i, "").trim();
    const nameWords = withoutDr.split(/\s+/).filter(Boolean);

    if (nameWords.length === 0) return fullMatch;
    if (CLINICAL_ROLE_STOPWORDS.has(nameWords[0].toLowerCase())) return fullMatch;

    const validNameWords: string[] = [nameWords[0]];
    for (let i = 1; i < nameWords.length; i++) {
      if (CLINICAL_ROLE_STOPWORDS.has(nameWords[i].toLowerCase())) break;
      validNameWords.push(nameWords[i]);
    }

    const capRest = validNameWords.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    const formattedName = hasDr ? `Dr ${capRest}` : capRest;
    const matchedSubstring = (hasDr ? cleanName.match(/^(?:dr\.?|doctor|prof\.?)\s+/i)![0] : "") + validNameWords.join(" ");

    if (isResident && !clinicians.emResident) {
      const ph = `__ERMATE_EM_RESIDENT_${residentIdx++}__`;
      clinicians.emResident = formattedName;
      placeholders[ph] = formattedName;
      return fullMatch.replace(matchedSubstring, ph);
    } else if (isConsultant && !clinicians.emConsultant) {
      const ph = `__ERMATE_EM_CONSULTANT_${consultantIdx++}__`;
      clinicians.emConsultant = formattedName;
      placeholders[ph] = formattedName;
      return fullMatch.replace(matchedSubstring, ph);
    }

    return fullMatch;
  });

  return { protectedText, clinicians, placeholders };
}

/**
 * Defensive guard checking whether a clinician attribution string is an
 * invalid, redacted, or placeholder value (e.g. [DOCTOR], [NAME], [PERSON]).
 */
export function isRedactedOrPlaceholderClinician(val: any): boolean {
  if (!val || typeof val !== "string") return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (/^\[.*\]$/.test(trimmed)) return true;
  if (/^__ERMATE_[A-Z0-9_]+__$/i.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  const invalidTokens = [
    "doctor", "physician", "resident", "consultant",
    "dr", "dr.", "unknown", "n/a", "na", "none", "null",
    "undefined", "not specified", "not documented", "unnamed"
  ];
  if (invalidTokens.includes(lower)) return true;
  return false;
}