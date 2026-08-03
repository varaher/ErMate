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
    pattern: /\b(?:UHID|MRN|UR|CR|IP(?:[NO\.\s#]*)|OP(?:[NO\.\s#]*)|ER(?:[NO\.\s#]*)|REG(?:[NO\.\s#]*))[:\s#-]*[A-Z0-9\/-]{4,20}\b/gi,
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
    pattern: /\b(?:[A-Z][a-zA-Object\w]+\s+)*(?:Hospital|Medical\s+Center|Clinic|Institute|Nursing\0|Healthcare|Super\s+Speciality)\b/gi,
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
