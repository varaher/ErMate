import type { TriageScreening, IsolationType } from "../types";

/**
 * Deterministic parser for ONE spoken triage dictation, e.g.
 *   "Name is Ramesh Kumar, 45 year old male, chest pain since 2 hours, BP 150 over 90,
 *    pulse 110, saturation 94, came by ambulance, no travel history"
 *
 * Rules: only what is explicitly said is returned (null/absent over guessing); nothing is sent to any
 * external service; the nurse always confirms the filled fields before saving.
 */
export interface TriageDictationResult {
  name?: string;
  age?: number;
  ageMonths?: number; // 0.5 = under 1 month
  ageDays?: number;
  ageUnit?: "years" | "months" | "days";
  gender?: "Male" | "Female";
  complaint?: string;
  vitals: { bp?: string; hr?: string; spo2?: string; rr?: string; temp?: string; grbs?: string; painScore?: string };
  arrivalMode?: "Walk-in" | "Ambulance" | "Referred";
  isMlc?: boolean;
  weight?: string;
  screening: Partial<TriageScreening>;
  /** Human-readable names of everything that was filled — shown to the nurse for confirmation. */
  filled: string[];
}

const toTitle = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const cToF1 = (c: number) => Math.round(((c * 9) / 5 + 32) * 10) / 10;

const DISEASES = "tb|tuberculosis|hiv|hepatitis [abc]|covid(?:-?19)?|dengue|malaria|measles|chicken ?pox|varicella|mumps|typhoid|cholera|swine flu|h1n1|nipah|leptospirosis|scabies|meningitis";

export function parseTriageDictation(input: string): TriageDictationResult {
  const original = (input || "").replace(/\s+/g, " ").trim();
  const t = original.toLowerCase();
  const out: TriageDictationResult = { vitals: {}, screening: {}, filled: [] };
  if (!t) return out;
  const spans: Array<[number, number]> = [];
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(t);
    if (m) spans.push([m.index, m.index + m[0].length]);
    return m;
  };
  const note = (label: string) => { if (!out.filled.includes(label)) out.filled.push(label); };

  // ── name (only with an explicit cue)
  const nm = /(?:patient(?:'s)? name(?: is)?|name is|named|name[:\-])\s+([a-z][a-z .'-]{1,40}?)(?=\s*(?:[,.;]|$)|\s+(?:aged|age|\d|male|female|is a|years?|presenting|came|brought|with|who|having|complaining))/i.exec(original);
  if (nm) {
    out.name = toTitle(nm[1]);
    spans.push([nm.index, nm.index + nm[0].length]);
    note("name");
  }

  // ── age: days / weeks (neonates/infants) first so "14 days old" isn't swallowed
  const daysMatch = take(/(\d{1,2})\s*[- ]?\s*days?(?:\s*old)?\b/);
  if (daysMatch && out.age === undefined) {
    const d = parseInt(daysMatch[1], 10);
    if (d >= 0 && d <= 90) {
      out.age = 0;
      out.ageMonths = 0.5;
      out.ageDays = d;
      out.ageUnit = "days";
      note("age (days)");
    }
  }

  const weeksMatch = take(/(\d{1,2})\s*[- ]?\s*weeks?(?:\s*old)?\b/);
  if (weeksMatch && out.age === undefined) {
    const w = parseInt(weeksMatch[1], 10);
    if (w >= 1 && w <= 12) {
      out.age = 0;
      out.ageMonths = 0.5;
      out.ageDays = w * 7;
      out.ageUnit = "days";
      note("age (weeks)");
    }
  }

  const newborn = take(/\bnew ?born\b|\bneonate\b/);
  if (out.age === undefined && newborn) {
    out.age = 0;
    out.ageMonths = 0.5;
    out.ageDays = 1;
    out.ageUnit = "days";
    note("age (newborn)");
  }

  // ── age: months
  const mo = take(/(\d{1,2})\s*[- ]?\s*months?(?:\s*old)?\b/);
  if (mo && out.age === undefined) {
    const months = parseInt(mo[1], 10);
    if (months >= 1 && months <= 36) {
      if (months >= 12) {
        out.age = Math.floor(months / 12);
        out.ageMonths = months % 12 || undefined;
      } else {
        out.age = 0;
        out.ageMonths = months;
      }
      out.ageUnit = "months";
      note("age (months)");
    }
  }

  // ── age: years suffix (e.g. "45 years old", "45 yo")
  let m = take(/(\d{1,3})\s*[- ]?\s*(?:years?|yrs?|y\/o|yo)(?:\s*old)?\b/);
  if (m && out.age === undefined) {
    const y = parseInt(m[1], 10);
    if (y >= 0 && y <= 120) {
      out.age = y;
      out.ageUnit = "years";
      note("age");
    }
  }

  // ── age: direct prefix (e.g. "age 45", "aged 52", "age is 35")
  if (out.age === undefined) {
    const directAge = take(/(?:\baged|\bage(?: is|:)?)\s*(\d{1,3})\b(?!\s*[- ]?(?:days?|weeks?|months?))/);
    if (directAge) {
      const y = parseInt(directAge[1], 10);
      if (y >= 0 && y <= 120) {
        out.age = y;
        out.ageUnit = "years";
        note("age");
      }
    }
  }

  // ── sex
  const g = take(/\b(male|female|man|woman|boy|girl|lady|gentleman)\b/);
  if (g) {
    out.gender = /^(female|woman|girl|lady)$/.test(g[1]) ? "Female" : "Male";
    note("sex");
  }

  // ── vitals
  const bp = take(/(?:\bbp\b|blood pressure)\s*(?:is|of|was|:|-)?\s*(\d{2,3})\s*(?:\/|over|by)\s*(\d{2,3})/) || take(/\b(\d{2,3})\s*over\s*(\d{2,3})\b/);
  if (bp) {
    const s = parseInt(bp[1], 10), d = parseInt(bp[2], 10);
    if (s >= 40 && s <= 300 && d >= 20 && d <= 200 && s > d) { out.vitals.bp = `${s}/${d}`; note("BP"); }
  }
  const hr = take(/(?:\bhr\b|heart rate|pulse(?: rate)?)\s*(?:is|of|was|:|-)?\s*(\d{2,3})/);
  if (hr) { const v = parseInt(hr[1], 10); if (v >= 20 && v <= 300) { out.vitals.hr = String(v); note("HR"); } }
  const sp = take(/(?:spo2|sp o2|saturation|sats?|oxygen saturation)\s*(?:is|of|was|:|-)?\s*(\d{2,3})\s*%?/);
  if (sp) { const v = parseInt(sp[1], 10); if (v >= 30 && v <= 100) { out.vitals.spo2 = String(v); note("SpO₂"); } }
  const rr = take(/(?:\brr\b|resp(?:iratory)? rate|respiration)\s*(?:is|of|was|:|-)?\s*(\d{1,2})/);
  if (rr) { const v = parseInt(rr[1], 10); if (v >= 4 && v <= 80) { out.vitals.rr = String(v); note("RR"); } }
  const tp = take(/\btemp(?:erature)?\s*(?:is|of|was|:|-)?\s*(\d{2,3}(?:\.\d)?)\s*(°?\s*[cf]\b|celsius|centigrade|fahrenheit|degrees?)?/);
  if (tp) {
    let v = parseFloat(tp[1]);
    const unit = (tp[2] || "").replace(/[°\s]/g, "");
    const isC = /^(c|celsius|centigrade)$/.test(unit) || (unit === "" || unit.startsWith("degree") ? v < 45 : false);
    if (isC) v = cToF1(v);
    if (v >= 85 && v <= 115) { out.vitals.temp = String(Math.round(v * 10) / 10); note("temperature (°F)"); }
  }
  const gr = take(/(?:grbs|rbs|hgt|blood sugar|blood glucose|sugar|glucose)\s*(?:is|of|was|:|-)?\s*(\d{2,3})/);
  if (gr) { const v = parseInt(gr[1], 10); if (v >= 10 && v <= 800) { out.vitals.grbs = String(v); note("GRBS"); } }
  const pn = take(/pain(?: score| scale)?\s*(?:is|of|was|:|-)?\s*(\d{1,2})(?:\s*(?:\/|out of)\s*10)?/);
  if (pn) { const v = parseInt(pn[1], 10); if (v >= 0 && v <= 10) { out.vitals.painScore = String(v); note("pain score"); } }
  const wt = take(/(?:weight|wt)\s*(?:is|of|was|:|-)?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:kgs?|kilos?|kilograms?)?/);
  if (wt) { const v = parseFloat(wt[1]); if (v >= 0.5 && v <= 350) { out.weight = wt[1]; note("weight (kg)"); } }

  // ── arrival
  if (take(/\bambulance\b/)) { out.arrivalMode = "Ambulance"; note("arrival"); }
  else if (take(/\breferred\b|\breferral\b/)) { out.arrivalMode = "Referred"; note("arrival"); }
  else if (take(/\bwalk(?:ed)?[- ]?in\b|\bwalking in\b|\bself[- ]?arrival\b|\bcame (?:on|by) (?:his|her|their) own\b/)) { out.arrivalMode = "Walk-in"; note("arrival"); }
  const mob = take(/\b(?:on a |on |in a )?(stretcher|wheel ?chair|in (?:the )?(?:mother's |mothers )?lap|walking)\b/);
  if (mob) {
    const w = mob[1];
    out.screening.arrivalMobility = /stretcher/.test(w) ? "Stretcher" : /wheel/.test(w) ? "Wheelchair" : /lap/.test(w) ? "In lap" : "Walking";
    note("arrived (mobility)");
  }

  // ── consciousness / orientation (negation aware)
  const notBefore = (idx: number) => /\b(not|no|never|isn't|wasn't)\s*$/.test(t.slice(Math.max(0, idx - 12), idx));
  const loc = /\b(unconscious|unresponsive|drowsy|alert)\b/.exec(t);
  if (loc && !notBefore(loc.index)) {
    out.screening.levelOfConsciousness = loc[1] === "alert" ? "Alert" : loc[1] === "drowsy" ? "Drowsy" : "Unconscious";
    spans.push([loc.index, loc.index + loc[0].length]);
    note("level of consciousness");
  }
  const dis = /\b(dis-?oriented|not oriented|confused)\b/.exec(t);
  const ori = /\boriented\b/.exec(t);
  if (dis) { out.screening.orientation = "Disoriented"; note("orientation"); spans.push([dis.index, dis.index + dis[0].length]); }
  else if (ori && !notBefore(ori.index)) { out.screening.orientation = "Oriented"; note("orientation"); spans.push([ori.index, ori.index + ori[0].length]); }

  // ── MLC (explicit word only)
  if (take(/\bmlc\b|\bmedico[- ]?legal\b/) && !/\b(not|non|no)[- ]mlc\b/.test(t)) { out.isMlc = true; note("MLC"); }

  // ── communicable-disease screening (explicit statements only)
  const S = out.screening;
  if (take(/\b(?:communicable )?screen(?:ing)? (?:is )?positive\b|\bfever (?:with|and) rash\b|\brash (?:with|and) fever\b/)) { S.communicableScreenPositive = true; note("communicable screen positive"); }
  else if (take(/\b(?:communicable )?screen(?:ing)? (?:is )?negative\b/)) { S.communicableScreenPositive = false; note("communicable screen negative"); }

  if (take(/\bno (?:recent |significant )?(?:travel|travelling|travelled|traveled)(?: history)?\b/)) { S.travelEndemicArea3Weeks = false; note("travel: none"); }
  else {
    const tr = take(/\b(?:recently )?(?:travel(?:l)?ed|returned|came back|arrived) (?:to|from|back from)\s+([a-z][a-z .'-]{2,40}?)(?=\s*(?:[,.;]|$|\band\b|\bwith\b|\bbp\b|\bhr\b|\bno\b|\bshe\b|\bhe\b|\bfever\b|\bcough\b))|\btravel history (?:to|of|is|:)\s+([a-z][a-z .'-]{2,40}?)(?=\s*(?:[,.;]|$|\band\b|\bwith\b|\bno\b))/);
    if (tr) {
      S.travelEndemicArea3Weeks = true;
      const place = (tr[1] || tr[2] || "").trim();
      if (place) S.travelDetails = toTitle(place);
      note("travel history");
    }
  }

  const kd = take(new RegExp(`\\b(?:known case of|k/c/o|kco|known|diagnosed with|history of)\\s+(${DISEASES})\\b`));
  if (kd) { S.knownCommunicableDisease = true; S.knownCommunicableDiseaseName = kd[1].toUpperCase() === kd[1] ? kd[1] : (kd[1].length <= 4 ? kd[1].toUpperCase() : toTitle(kd[1])); note("known communicable disease"); }

  if (take(/\b(?:close )?contact (?:with|of)\b[^.;,]{0,40}?(?:similar symptoms|same symptoms|fever|cough|tb|tuberculosis|covid|dengue|chicken ?pox|measles)\b/)) { S.closeContactSimilarSymptoms = true; note("close contact"); }
  if (take(/\bhospital exposure\b|\bhealth ?care worker exposure\b/)) { S.healthcareWorkerExposure = true; note("healthcare exposure"); }
  if (take(/\bno (?:animal|pet|livestock|cattle|poultry) contact\b/)) { S.petsLivestockContact = false; note("animal contact: none"); }
  else if (take(/\bcontact with (?:animals?|pets?|livestock|cattle|poultry|bats?|pigs?)\b/)) { S.petsLivestockContact = true; note("animal contact"); }

  const types: IsolationType[] = [];
  if (take(/\bairborne(?: precautions?)?\b/)) { types.push("Airborne"); }
  if (take(/\bdroplet(?: precautions?)?\b/)) { types.push("Droplet"); }
  if (take(/\bcontact precautions?\b|\bcontact isolation\b/)) { types.push("Contact"); }
  const isoNo = take(/\bno isolation\b|\bisolation (?:is )?not (?:required|needed)\b/);
  const isoYes = take(/\bisolation(?: is)? (?:required|needed)\b|\bisolate\b|\bneeds? isolation\b/);
  if (isoNo) { S.isolationRequired = false; note("isolation: not required"); }
  else if (types.length || isoYes) {
    S.isolationRequired = true;
    if (types.length) S.isolationTypes = types;
    note("isolation required");
  }

  // ── complaint: explicit cue, else what is left after removing everything recognised
  const cue = /(?:presenting (?:with|complaint(?:s)? (?:is|are|of)?)|complaint(?:s)? (?:of|is|are)|c\/o|came with|brought with|presents with|presented with|complaining of|chief complaint(?: is| of)?)\s+(.+?)(?=\s*(?:\.|;|$)|\s+\b(?:bp|blood pressure|hr|pulse|heart rate|spo2|saturation|rr|temp|temperature|grbs|came by|no travel)\b)/i.exec(original);
  let complaint = cue ? cue[1] : "";
  if (!complaint) {
    const ranges = spans.sort((a, b) => a[0] - b[0]);
    let rest = "", cur = 0;
    for (const [a, b] of ranges) { if (a > cur) rest += original.slice(cur, a) + " "; cur = Math.max(cur, b); }
    rest += original.slice(cur);
    complaint = rest;
  }
  complaint = complaint
    .replace(/\b(patient|pt|is|a|an|the|came|brought|with|who|having|has|had|by|and|of|name|aged|age|old|came in|presenting|presents|complaints?)\b/gi, (w) => (cue ? w : " "))
    .replace(/[,;.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cue) complaint = complaint.replace(/^(and|with)\s+/i, "").trim();
  if (complaint.replace(/[^a-z]/gi, "").length >= 4) { out.complaint = complaint.charAt(0).toUpperCase() + complaint.slice(1); note("complaint"); }
  return out;
}
