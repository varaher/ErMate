// One place that reads the primary assessment the way the case sheet does, for adults and children alike.
// The discharge summary used to read only the paediatric fields, so adult dictation showed "Not documented".
// Nothing here invents a finding: every value is something already on the case, or an empty string.

const NOT_DOC = ["n/a", "na", "null", "undefined", "not documented", "not recorded", "0"];
const clean = (v: any): string => {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  return NOT_DOC.includes(s.toLowerCase()) ? "" : s;
};
const first = (...vals: any[]): string => {
  for (const v of vals) {
    const s = clean(v);
    if (s) return s;
  }
  return "";
};

export interface ResolvedPrimarySurvey {
  airway: string;
  airwayIntervention: string;
  breathingFindings: string;
  breathingWork: string;
  breathingAirEntry: string;
  breathingCct: string;
  breathingSubcut: string;
  breathingIntervention: string;
  circulationFindings: string;
  circulationCrt: string;
  circulationDnv: string;
  circulationPct: string;
  circulationDeformity: string;
  circulationIntervention: string;
  avpuGcs: string;
  pupils: string;
  grbs: string;
  temp: string;
  trauma: string;
  rr: string;
  spo2: string;
  hr: string;
  bp: string;
  gcsTotal: string;
  gcsParts: string;
}

// "E4 V5 M6" from whatever parts were documented. Never adds a total.
export function gcsPartsText(v: any): string {
  const e = clean(v?.gcs_e ?? v?.gcsE);
  const vb = clean(v?.gcs_v ?? v?.gcsV);
  const m = clean(v?.gcs_m ?? v?.gcsM);
  return [e && `E${e.replace(/^e/i, "")}`, vb && `V${vb.replace(/^v/i, "")}`, m && `M${m.replace(/^m/i, "")}`].filter(Boolean).join(" ");
}

// What to show as the GCS in a one-line field: the total with its parts, or the parts alone.
export function gcsLine(v: any): string {
  const total = clean(v?.gcs).replace(/\s*\/\s*15$/, "");
  const parts = gcsPartsText(v);
  if (total) return parts ? `GCS ${total}/15 (${parts})` : `GCS ${total}/15`;
  if (parts) return `GCS ${parts} (total not documented)`;
  return "";
}

function pupilsFrom(c: any): string {
  const s = c?.primaryAssessment?.survey?.disability;
  if (s) {
    const parts: string[] = [];
    if (s.pupilsEqual === true) parts.push("Equal");
    else if (s.pupilsEqual === false) parts.push("Unequal");
    if (s.pupilSizeR || s.pupilSizeL) parts.push(`${s.pupilSizeR || "?"}mm R / ${s.pupilSizeL || "?"}mm L`);
    if (s.pupilReaction) parts.push(String(s.pupilReaction));
    if (parts.length) return parts.join(", ");
  }
  const raw = c?.primaryAssessment?.disability;
  if (typeof raw === "string" && raw.trim()) {
    const m = raw.match(/\bpupils?\s+([^,.;\n]+)/i);
    if (m && m[1]) {
      const t = m[1].trim();
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
  }
  return "";
}

export function resolveDocumentedPrimarySurvey(c: any): ResolvedPrimarySurvey {
  const ped = c?.pediatricDetails || {};
  const pa = c?.primaryAssessment || {};
  const sv = pa.survey || {};
  const v = c?.vitals || {};
  const avpu = clean(v.avpu);
  const gcs = gcsLine(v);
  return {
    airway: first(pa.airway, ped.airwayStatus, sv.airway?.status),
    airwayIntervention: first(ped.airwayIntervention, sv.airway?.intervention),
    breathingFindings: first(pa.breathing),
    breathingWork: first(ped.breathingWob, ped.patWorkOfBreathing, sv.breathing?.workOfBreathing),
    breathingAirEntry: first(ped.breathingAirEntry, sv.breathing?.airEntry),
    breathingCct: first(sv.breathing?.cct),
    breathingSubcut: first(ped.breathingSubcutaneousEmphysema, sv.breathing?.subcutaneousEmphysema),
    breathingIntervention: first(ped.breathingIntervention, sv.breathing?.intervention),
    circulationFindings: first(pa.circulation, ped.circulationSkinColorTemp, ped.patCirculation),
    circulationCrt: first(ped.circulationCrt, sv.circulation?.crt),
    circulationDnv: first(ped.circulationDistendedNeckVeins, sv.circulation?.distendedNeckVeins),
    circulationPct: first(sv.circulation?.pct),
    circulationDeformity: first(ped.exposureLongBoneDeformities, sv.exposure?.longBones, sv.circulation?.longBoneDeformity),
    circulationIntervention: first(ped.circulationIntervention, sv.circulation?.intervention),
    avpuGcs: [avpu, gcs].filter(Boolean).join(" / ") || first(ped.disabilityAvpuGcs),
    pupils: first(ped.disabilityPupils, pupilsFrom(c)),
    grbs: first(v.grbs, ped.disabilityGrbs, sv.disability?.grbs),
    temp: first(v.temp, ped.exposureTemp, sv.exposure?.temp),
    trauma: first(ped.exposureTraumaLogroll, sv.exposure?.logRoll),
    rr: clean(v.rr),
    spo2: clean(v.spo2),
    hr: clean(v.hr),
    bp: clean(v.bp),
    gcsTotal: clean(v.gcs),
    gcsParts: gcsPartsText(v),
  };
}