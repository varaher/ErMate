const CONSULT_PATTERN = /(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)\s*\/?\s*(?:Dr\.?\s*[\w\s]+\s*\(([\w\s]+)\)|(?:Consultation|Consult|Referral|Review)\s+(?:by|with|to)?\s*([A-Za-z\s]+))/gi;

export interface ExtractedConsultation {
  time: string;
  specialty: string;
  reason: string | null;
  consultant?: string | null;
  recommendation?: string | null;
  status?: string | null;
}

export function extractCrossConsultations(
  deidentifiedText: string,
  arrivalTime?: Date
): ExtractedConsultation[] {
  if (!deidentifiedText || typeof deidentifiedText !== "string") return [];

  const results: ExtractedConsultation[] = [];
  const lines = deidentifiedText.split(/\n+/);

  for (const line of lines) {
    let match;
    // Reset pattern index
    CONSULT_PATTERN.lastIndex = 0;
    while ((match = CONSULT_PATTERN.exec(line)) !== null) {
      const time = match[1] || "[Day 1]";
      const specialty = (match[2] || match[3] || "General Specialty").trim();
      if (specialty.length > 2 && !/^(the|a|an|and|or|for|with|by)$/i.test(specialty)) {
        results.push({
          time,
          specialty,
          reason: line.length < 120 ? line.trim() : null,
          consultant: specialty,
          status: "Completed"
        });
      }
    }
  }

  // Deduplicate by time + specialty
  const seen = new Set<string>();
  const deduplicated: ExtractedConsultation[] = [];
  for (const item of results) {
    const key = `${item.time}-${item.specialty.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

export function shouldRenderConsultSection(arrivalTime?: Date | null, now: Date = new Date()): boolean {
  if (!arrivalTime) return true; // Default to true if duration is unknown or non-null consults exist
  const hoursElapsed = (now.getTime() - arrivalTime.getTime()) / 36e5;
  return hoursElapsed > 4;
}
