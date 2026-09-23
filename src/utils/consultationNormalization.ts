/**
 * consultationNormalization.ts
 *
 * Normalizes and deduplicates medical specialty consultation names.
 * Ensures entries like "Urology consultation", "Urology consult", and "Urology"
 * merge into a single canonical specialty: "Urology".
 * Handles aliases like "General Surgery" and "Surgery consult" -> "General Surgery".
 * Preserves distinct specialties like "Urology" and "Cardiology".
 */

export function normalizeConsultationSpecialty(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "";
  let clean = rawName.trim();
  if (!clean) return "";

  // Strip prefix/action phrases like "urgent", "refer to", "opinion from", etc.
  clean = clean.replace(/^(?:urgent\s+|emergency\s+|stat\s+|refer\s+to\s+|referral\s+to\s+|opinion\s+from\s+|call\s+|seek\s+)/i, "").trim();

  // Strip consultation suffixes like "consultation requested", "consult", "consultation", "opinion", "review", etc.
  clean = clean.replace(/\s+(?:consultation(?:\s+requested|\s+sought|\s+called|\s+sent|\s+planned)?|consult(?:s)?(?:\s+requested|\s+sought|\s+called|\s+sent|\s+planned)?|opinion(?:\s+taken|\s+sought|\s+requested)?|review(?:\s+requested|\s+done)?|referral)$/i, "").trim();

  // Also handle leading "consult" e.g. "consult Urology"
  clean = clean.replace(/^(?:consult(?:ation)?|referral|opinion)\s+/i, "").trim();

  const lower = clean.toLowerCase();

  // Canonical Specialty Dictionary
  const SPECIALTY_MAP: Record<string, string> = {
    "urology": "Urology",
    "uro": "Urology",
    "cardiology": "Cardiology",
    "cardio": "Cardiology",
    "general surgery": "General Surgery",
    "surgery": "General Surgery",
    "surgical": "General Surgery",
    "gen surg": "General Surgery",
    "gen surgery": "General Surgery",
    "orthopedics": "Orthopedics",
    "orthopaedics": "Orthopedics",
    "ortho": "Orthopedics",
    "neurology": "Neurology",
    "neuro": "Neurology",
    "neurosurgery": "Neurosurgery",
    "neuro surgery": "Neurosurgery",
    "nephrology": "Nephrology",
    "nephro": "Nephrology",
    "pulmonology": "Pulmonology",
    "pulmonary medicine": "Pulmonology",
    "pulmo": "Pulmonology",
    "respiratory medicine": "Pulmonology",
    "chest medicine": "Pulmonology",
    "gastroenterology": "Gastroenterology",
    "gastro": "Gastroenterology",
    "medical gastroenterology": "Gastroenterology",
    "surgical gastroenterology": "Surgical Gastroenterology",
    "surgical gastro": "Surgical Gastroenterology",
    "gi surgery": "Surgical Gastroenterology",
    "pediatrics": "Pediatrics",
    "paediatrics": "Pediatrics",
    "peds": "Pediatrics",
    "pediatric surgery": "Pediatric Surgery",
    "paediatric surgery": "Pediatric Surgery",
    "obgyn": "OBGYN",
    "ob-gyn": "OBGYN",
    "obstetrics and gynecology": "OBGYN",
    "obstetrics & gynecology": "OBGYN",
    "obstetrics": "OBGYN",
    "gynecology": "OBGYN",
    "gynaecology": "OBGYN",
    "ent": "ENT",
    "ear nose throat": "ENT",
    "otorhinolaryngology": "ENT",
    "ophthalmology": "Ophthalmology",
    "eye": "Ophthalmology",
    "dermatology": "Dermatology",
    "derma": "Dermatology",
    "skin": "Dermatology",
    "psychiatry": "Psychiatry",
    "psych": "Psychiatry",
    "radiology": "Radiology",
    "interventional radiology": "Interventional Radiology",
    "plastic surgery": "Plastic Surgery",
    "vascular surgery": "Vascular Surgery",
    "cardiothoracic surgery": "Cardiothoracic Surgery",
    "ctvs": "Cardiothoracic Surgery",
    "surgical oncology": "Surgical Oncology",
    "medical oncology": "Medical Oncology",
    "oncology": "Oncology",
    "endocrinology": "Endocrinology",
    "endo": "Endocrinology",
    "infectious disease": "Infectious Disease",
    "infectious diseases": "Infectious Disease",
    "general medicine": "General Medicine",
    "internal medicine": "General Medicine",
    "medicine": "General Medicine",
    "anesthesia": "Anesthesia",
    "anaesthesia": "Anesthesia",
    "critical care": "Critical Care",
    "intensive care": "Critical Care",
    "icu": "Critical Care",
    "hematology": "Hematology",
    "haematology": "Hematology",
    "rheumatology": "Rheumatology",
  };

  if (SPECIALTY_MAP[lower]) {
    return SPECIALTY_MAP[lower];
  }

  // Fallback: title-case each word
  return clean.replace(/\b[a-z]/g, ch => ch.toUpperCase());
}

/**
 * Deduplicates and normalizes an array of consultation requests.
 * Breaks down any comma-separated entries, normalizes each item, and ensures
 * each canonical specialty appears only once.
 */
export function deduplicateConsultations(rawList: any[]): string[] {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];
  const canonicalMap = new Map<string, string>();

  for (const item of rawList) {
    if (!item) continue;
    const parts = typeof item === "string" ? item.split(/[,;\n]+/) : [String(item)];
    for (const part of parts) {
      const normalized = normalizeConsultationSpecialty(part);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (!canonicalMap.has(key)) {
        canonicalMap.set(key, normalized);
      }
    }
  }

  return Array.from(canonicalMap.values());
}
