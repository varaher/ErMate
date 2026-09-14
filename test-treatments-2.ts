export function stripCarrierPhrases(val: string): string {
  return val; // Mock for testing
}

export function cleanEntityList(values: any[] | null | undefined): any[] {
  if (!values || !Array.isArray(values)) return [];
  return values
    .map(v => typeof v === 'string' ? stripCarrierPhrases(v) : v)
    .filter(v => v !== null && (typeof v !== 'string' || v.length > 0));
}

export interface RawExtractionFields {
  treatment?: any;
}

export function cleanExtractionOutput(raw: RawExtractionFields): any {
  const rawDrugs: any = raw.treatment;
  let drugsArray: any[] = [];
  if (Array.isArray(rawDrugs)) {
    drugsArray = rawDrugs.map(d => typeof d === 'string' ? d : d);
  } else if (typeof rawDrugs === "string" && rawDrugs.trim().length > 0) {
    drugsArray = rawDrugs.split(/;|\n|,/).map(d => d.trim());
  }
  const drugs = cleanEntityList(drugsArray);
  return { drugs };
}

const caseB = {
  treatment: [{
    drugName: "Tranexamic acid",
    dose: "1 g",
    route: "IV",
    frequency: "stat"
  }]
};

console.log(cleanExtractionOutput(caseB));
