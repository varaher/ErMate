/**
 * Edit-in-preview: which fields of the case sheet preview can be changed, and how a typed value is
 * written back onto the draft case. Pure functions, no UI.
 *
 * Each field reads the text exactly as the preview shows it, and writes to the field the preview reads FIRST,
 * so the edited text is what shows up (and what is saved when the doctor applies the preview).
 */

export interface PreviewField {
  key: string;
  label: string;
  multiline?: boolean;
  /** Text as the preview shows it (case = draft case, d = converted case-sheet data). */
  get: (c: any, d: any) => string;
  /** Returns a new draft case with the typed value written in. */
  set: (c: any, v: string) => any;
}

export function setIn<T extends Record<string, any>>(obj: T, path: string[], value: any): T {
  const [head, ...rest] = path;
  const base: any = obj && typeof obj === "object" ? obj : {};
  return { ...base, [head]: rest.length ? setIn(base[head], rest, value) : value };
}

const txt = (v: any) => (typeof v === "string" ? v : v == null ? "" : String(v));
const join = (a: any, sep: string) => (Array.isArray(a) ? a.filter(Boolean).join(sep) : txt(a));

const sh = (key: string, label: string, multiline = true): PreviewField => ({
  key, label, multiline,
  get: (c, d) => {
    const fromData: Record<string, string> = {
      symptoms: join(d.symptoms, ", "), allergies: join(d.allergies, ", "), medications: join(d.currentMedications, ", "),
      pastHistory: join(d.pastHistory, " · "), lastMeal: txt(d.lastMeal), events: txt(d.events),
      familyHistory: txt(d.familyHistory), socialHistory: txt(d.socialHistory), hpi: txt(d.hpi), surgicalHistory: txt(d.surgicalHistory), lmp: txt(d.lmp),
    };
    return fromData[key] ?? "";
  },
  set: (c, v) => setIn(c, ["sampleHistory", key], v),
});

const survey = (key: "general" | "cvs" | "respiratory" | "abdomen" | "cns" | "extremities", label: string): PreviewField => {
  const dischargeKey: Record<string, string> = { general: "secondaryPicle", cvs: "secondaryCvs", respiratory: "secondaryChest", abdomen: "secondaryPa", cns: "secondaryCns" };
  return {
    key, label, multiline: true,
    get: (_c, d) => txt(d.secondarySurvey?.[key]),
    set: (c, v) => {
      let out = setIn(c, ["secondarySurvey", key], v);
      // The preview reads a discharge copy first when there is one, so keep it in step.
      const dk = dischargeKey[key];
      if (dk && out.dischargeInfo && txt(out.dischargeInfo[dk]).trim()) out = setIn(out, ["dischargeInfo", dk], v);
      return out;
    },
  };
};

const vital = (key: "rr" | "hr" | "spo2" | "bp" | "grbs" | "temp", label: string): PreviewField => ({
  key, label, multiline: false,
  get: (c) => txt(c.vitals?.[key]),
  set: (c, v) => setIn(c, ["vitals", key], v.trim()),
});

const primary = (key: "airway" | "breathing" | "circulation" | "disability" | "exposure", label: string): PreviewField => ({
  key, label, multiline: true,
  get: (_c, d) => txt(d.primarySurvey?.[key]),
  set: (c, v) => setIn(c, ["primaryAssessment", key], v),
});

const caseText = (key: string, label: string, path: string[], getFrom: (c: any, d: any) => string, multiline = true): PreviewField => ({
  key, label, multiline, get: getFrom, set: (c, v) => setIn(c, path, v),
});

const HISTORY: PreviewField[] = [
  sh("symptoms", "Signs & symptoms"), sh("allergies", "Allergies"), sh("medications", "Current medications"),
  sh("pastHistory", "Past medical history"), sh("lastMeal", "Last meal", false), sh("events", "Events preceding"),
  sh("familyHistory", "Family history"),
  sh("socialHistory", "Social history"),
  // Editing the HPI in the preview makes it the doctor's HPI (the case-summary writer will not replace it).
  ((f: PreviewField): PreviewField => ({ ...f, set: (c, v) => setIn(f.set(c, v), ["sampleHistory", "hpiSource"], "doctor") }))(sh("hpi", "History of presenting illness")),
  sh("surgicalHistory", "Surgical history"),
  sh("lmp", "LMP", false),
];

const SURVEY: PreviewField[] = [
  survey("general", "General"), survey("cvs", "CVS"), survey("respiratory", "Respiratory"),
  survey("abdomen", "Abdomen"), survey("cns", "CNS"), survey("extremities", "Extremities"),
];

const INVESTIGATIONS: PreviewField[] = [
  caseText("labsOrdered", "Laboratory investigations ordered", ["investigationLabsOrdered"], (_c, d) => txt(d.investigationLabsOrdered)),
  caseText("imaging", "Diagnostic imaging", ["investigationImaging"], (_c, d) => txt(d.investigationImaging)),
  caseText("resultsSummary", "Investigation results summary", ["investigationResultsSummary"], (_c, d) => txt(d.investigationResultsSummary)),
];

/** One drug per line. Rows are rebuilt from the lines; dose, route and rate stay in the same line as typed. */
const DRUGS: PreviewField = {
  key: "drugs", label: "Treatment given (one per line)", multiline: true,
  get: (_c, d) => join(d.treatmentGiven, "\n"),
  set: (c, v) => {
    const lines = v.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      ...c,
      treatments: lines.map((l, i) => ({ id: `edit-rx-${i}`, drugName: l, dose: "", route: "" })),
      infusions: [],
    };
  },
};

const TREATMENT: PreviewField[] = [
  DRUGS,
  caseText("treatmentNotes", "Treatment notes & orders", ["treatmentNotes"], (_c, d) => txt(d.treatmentNotes)),
];

const DIFFERENTIALS: PreviewField = {
  key: "differentials", label: "Differentials (one per line)", multiline: true,
  get: (_c, d) => (Array.isArray(d.differentials) ? d.differentials.map((x: any) => x.diagnosis).filter(Boolean).join("\n") : ""),
  set: (c, v) => {
    const old: any[] = Array.isArray(c.differentials) ? c.differentials : [];
    const lines = v.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      ...c,
      differentials: lines.map((l) => {
        const prev = old.find((o) => txt(o?.diagnosis).trim() === l);
        return prev || { diagnosis: l, status: "POSSIBLE", reasoning: "", citations: [], nextSteps: [] };
      }),
    };
  },
};

const DIAGNOSIS: PreviewField[] = [
  caseText("provisional", "Provisional diagnosis", ["provisionalPrimaryDiagnosis"], (_c, d) => txt(d.provisionalDiagnosis), false),
  DIFFERENTIALS,
  caseText("diffNotes", "Differential notes", ["provisionalDifferentialDiagnoses"], (_c, d) => txt(d.provisionalDifferentialDiagnoses)),
];

const DISPOSITION: PreviewField[] = [
  {
    key: "status", label: "Status", multiline: false,
    get: (_c, d) => txt(d.disposition?.status),
    set: (c, v) => {
      let out = setIn(c, ["dispositionAndPlan", "dispositionStatus"], v);
      if (txt(out.dispositionDetails?.dispositionType).trim()) out = setIn(out, ["dispositionDetails", "dispositionType"], v);
      return out;
    },
  },
  caseText("destination", "Destination", ["dispositionAndPlan", "destinationUnit"], (_c, d) => txt(d.disposition?.destinationUnit), false),
  caseText("condition", "Condition at shift", ["conditionAtShift"], (_c, d) => txt(d.disposition?.conditionAtShift)),
  caseText("plan", "Management plan", ["dispositionAndPlan", "managementPlan"], (_c, d) => txt(d.disposition?.managementPlan)),
  caseText("followUp", "Follow-up advice", ["dispositionAndPlan", "followUpAdvice"], (_c, d) => txt(d.disposition?.followUpAdvice)),
];

/** Psychological assessment: the preview reads the structured notes first, then the SAMPLE note, so both are written. */
const PSYCH: PreviewField[] = [{
  key: "psych", label: "Psychological assessment", multiline: true,
  get: (_c, d) => txt(d.psychologicalAssessment?.notes),
  set: (c, v) => {
    let out = setIn(c, ["sampleHistory", "psychiatricFlags"], v);
    const pa = out.psychologicalAssessment;
    if (typeof pa === "string") out = { ...out, psychologicalAssessment: v };
    else if (pa && typeof pa === "object") out = setIn(out, ["psychologicalAssessment", "notes"], v);
    return out;
  },
}];

/** GCS: "E4V5M6" fills the three components and the total; a number fills the total (25 Nov 2026). */
const GCS_FIELD: PreviewField = {
  key: "gcs", label: "GCS", multiline: false,
  get: (c) => {
    const v: any = c.vitals || {};
    return v.gcs_e || v.gcs_v || v.gcs_m ? `E${v.gcs_e || "?"}V${v.gcs_v || "?"}M${v.gcs_m || "?"}` : txt(v.gcs);
  },
  set: (c, raw) => {
    const v = raw.trim();
    const m = v.match(/E\s*(\d)\s*V\s*(\d|T)\s*M\s*(\d)/i);
    let out = c;
    if (m) {
      out = setIn(out, ["vitals", "gcs_e"], m[1]);
      out = setIn(out, ["vitals", "gcs_v"], m[2].toUpperCase());
      out = setIn(out, ["vitals", "gcs_m"], m[3]);
      out = setIn(out, ["vitals", "gcs"], m[2].toUpperCase() === "T" ? `E${m[1]}VTM${m[3]}` : String(Number(m[1]) + Number(m[2]) + Number(m[3])));
    } else {
      for (const k of ["gcs_e", "gcs_v", "gcs_m"]) if ((out as any).vitals?.[k]) out = setIn(out, ["vitals", k], "");
      out = setIn(out, ["vitals", "gcs"], v.replace(/\s*\/\s*15\s*$/, ""));
    }
    return out;
  },
};

const PRIMARY: PreviewField[] = [
  primary("airway", "Airway"), primary("breathing", "Breathing"), primary("circulation", "Circulation"),
  primary("disability", "Disability"), primary("exposure", "Exposure"),
  vital("rr", "RR"), vital("hr", "HR"), vital("spo2", "SpO₂"), vital("bp", "BP"), vital("grbs", "GRBS"), vital("temp", "Temp (with unit)"), GCS_FIELD,
];

/**
 * Adjuncts to the primary survey (24 Nov 2026). The preview reads survey.adjuncts first, then older copies;
 * a typed text goes into survey.adjuncts and, when cleared, the older copies are cleared too, so the
 * sheet shows exactly what was typed (or "Not documented.").
 */
const SA = ["primaryAssessment", "survey", "adjuncts"];
const isObj = (v: any) => v && typeof v === "object";
const low = (v: any) => txt(v).toLowerCase();
const clearOld = (c: any, adjKeys: string[], circKey?: string, doneKey?: string): any => {
  let out = c;
  if (isObj(out.adjuncts)) {
    for (const k of adjKeys) if (txt(out.adjuncts[k])) out = setIn(out, ["adjuncts", k], "");
    if (doneKey && out.adjuncts[doneKey]) out = setIn(out, ["adjuncts", doneKey], false);
  }
  const circ = out.primaryAssessment?.survey?.circulation;
  if (circKey && isObj(circ) && typeof circ[circKey] === "string" && circ[circKey]) out = setIn(out, ["primaryAssessment", "survey", "circulation", circKey], "");
  return out;
};
/** ECG / echo: notes plus a dropdown status that the preview puts in front of the notes. */
const adjText = (key: "ecg" | "echo", label: string, getFrom: (d: any) => string, notesKey: string, statusKey: string, old: string[], circKey: string, doneKey: string): PreviewField => ({
  key, label, multiline: true,
  get: (_c, d) => txt(getFrom(d)),
  set: (c, v) => {
    let out = setIn(c, [...SA, notesKey], v);
    const status = txt(out.primaryAssessment?.survey?.adjuncts?.[statusKey]);
    if (status && (!v || !low(v).includes(status.toLowerCase()))) out = setIn(out, [...SA, statusKey], "");
    if (!v) {
      // survey.adjuncts.echoFindings is read right after echoNotes.
      if (key === "echo" && txt(out.primaryAssessment?.survey?.adjuncts?.echoFindings)) out = setIn(out, [...SA, "echoFindings"], "");
      out = clearOld(out, old, circKey, doneKey);
    }
    return out;
  },
});
/** The eFAST line the preview builds from the structured windows (same rule as the preview). */
export function efastStructuredText(c: any): string {
  const circ = c?.primaryAssessment?.survey?.circulation;
  const all: Record<string, any> = { ...(isObj(circ?.efast) ? circ.efast : {}), ...(isObj(c?.fastFindings) ? c.fastFindings : {}) };
  const pos = Object.entries(all).filter(([, v]) => {
    if (!v) return false;
    const s = String(v).toLowerCase();
    return s !== "not_done" && s !== "negative" && s !== "no_blines" && (s.includes("pos") || s === "done" || s.includes("fluid"));
  });
  if (pos.length) return `Positive (${pos.map(([k, v]) => `${k}: ${v}`).join(", ")})`;
  return Object.values(all).some((v) => v && v !== "not_done") ? "Negative" : "";
}
const EFAST: PreviewField = {
  key: "efast", label: "eFAST", multiline: true,
  get: (_c, d) => txt(d.efast?.findings),
  set: (c, v) => {
    const structured = efastStructuredText(c);
    let notes = v;
    let out = c;
    if (structured.startsWith("Positive")) {
      // Keep the structured windows when their line is still in the typed text; otherwise the typed text replaces them.
      const i = low(v).indexOf(structured.toLowerCase());
      if (i >= 0 && v) notes = (v.slice(0, i) + v.slice(i + structured.length)).replace(/^[\s·,;.]+|[\s·,;]+$/g, "").trim();
      else {
        if (isObj(out.primaryAssessment?.survey?.circulation?.efast)) out = setIn(out, ["primaryAssessment", "survey", "circulation", "efast"], {});
        if (isObj(out.fastFindings)) out = { ...out, fastFindings: {} };
      }
    } else if (structured && !v) {
      if (isObj(out.primaryAssessment?.survey?.circulation?.efast)) out = setIn(out, ["primaryAssessment", "survey", "circulation", "efast"], {});
      if (isObj(out.fastFindings)) out = { ...out, fastFindings: {} };
    }
    out = setIn(out, [...SA, "efastNotes"], notes);
    if (!v) {
      if (txt(out.primaryAssessment?.survey?.adjuncts?.efastStatus)) out = setIn(out, [...SA, "efastStatus"], "");
      out = clearOld(out, ["efastNotes", "efastInterpretation", "efastFindings"], undefined, "efastDone");
    }
    return out;
  },
};
/** VBG / ABG: values stay as measured; the interpretation is typeable. */
const GAS: PreviewField = {
  key: "gas", label: "VBG / ABG interpretation", multiline: true,
  get: (_c, d) => txt(d.vbgAbg?.notes),
  set: (c, v) => {
    let out = setIn(c, [...SA, "abg", "finalDiagnosis"], v);
    if (!v) for (const k of ["interpretation", "clinicalInterpretation"]) if (txt(out.primaryAssessment?.survey?.adjuncts?.abg?.[k])) out = setIn(out, [...SA, "abg", k], "");
    return out;
  },
};
const ADJUNCTS: PreviewField[] = [
  adjText("ecg", "ECG", (d) => d.ecg?.findings, "ecgNotes", "ecgStatus", ["ecgNotes", "ecgFindings", "ecgRhythm"], "ecg", "ecgDone"),
  GAS,
  adjText("echo", "Bedside screening echo", (d) => d.bedsideEcho?.findings, "echoNotes", "echoStatus", ["echoNotes", "echoFindings"], "echo", "echoDone"),
  EFAST,
];

/**
 * Pediatric Assessment (PAT) block of the pediatric sheet (24 Nov 2026). Written to pediatricDetails under
 * the name the preview reads first; a cleared value also clears the older name it falls back to.
 */
const ped = (key: string, label: string, write: string, older: string[] = [], multiline = false): PreviewField => ({
  key, label, multiline,
  get: (_c, d) => txt(d.pediatricDetails?.[key]),
  set: (c, v) => {
    let out = setIn(c, ["pediatricDetails", write], key === "weight" ? v.replace(/\s*kg\s*$/i, "").trim() : v);
    if (!v) for (const o of older) if (txt(out.pediatricDetails?.[o])) out = setIn(out, ["pediatricDetails", o], "");
    return out;
  },
});
const PEDIATRIC_PAT: PreviewField[] = [
  ped("weight", "Weight (kg)", "patientWeight", ["weight"]),
  ped("patAppearanceTone", "Tone", "patAppearanceTone"),
  ped("patAppearanceInteractivity", "Interactivity", "patAppearanceInteractivity"),
  ped("patAppearanceConsolability", "Consolability", "patAppearanceConsolability"),
  ped("patAppearanceLookGaze", "Look / gaze", "patAppearanceLookGaze"),
  ped("patAppearanceSpeechCry", "Speech / cry", "patAppearanceSpeechCry"),
  ped("patWorkOfBreathing", "Work of breathing", "patWorkOfBreathing", ["workOfBreathing"]),
  ped("patCirculation", "Circulation (skin)", "patCirculation", ["circulation"]),
  ped("birthHistory", "Birth history", "birthHistory", [], true),
  ped("feedingHistory", "Feeding history", "feedingHistory", [], true),
  ped("developmentalHistory", "Developmental history", "developmentalHistory", [], true),
  ped("immunizationHistory", "Immunization history", "immunizationHistory", [], true),
  ped("broughtBy", "Brought by", "broughtBy"),
  ped("informant", "Informant", "informant"),
];

/** Section heading text (as printed in the preview) -> its editable fields. */
export const EDIT_SECTIONS: Record<string, PreviewField[]> = {
  "Presenting Complaint": [caseText("cc", "Presenting complaint", ["patient", "presentingComplaint"], (_c, d) => txt(d.presentingComplaint))],
  "Primary Survey": PRIMARY,
  "Adjuvants to Primary": ADJUNCTS,
  "Adjuncts to Primary Assessment": ADJUNCTS,
  "Pediatric Assessment (PAT)": PEDIATRIC_PAT,
  "Secondary Assessment / History": HISTORY,
  "History": HISTORY,
  "Psychological Assessment": PSYCH,
  "Focused Physical Examination": SURVEY,
  "Secondary Survey": SURVEY,
  "Investigations & Diagnostic Studies": INVESTIGATIONS,
  "Treatment Given & Emergency Orders": TREATMENT,
  "Provisional Diagnosis": DIAGNOSIS,
  "Differential Diagnosis": DIAGNOSIS,
  "Provisional & Differential Diagnosis": DIAGNOSIS,
  "Condition at Time of Shift / Disposition": DISPOSITION,
  "Disposition & Outcome": DISPOSITION,
  "Clinical Notes & Addendum": [
    caseText("notes", "Clinical notes", ["progressNotes"], (_c, d) => txt(d.notes?.progressNotes)),
    caseText("addendum", "Addendum", ["addendumNotes"], (_c, d) => txt(d.notes?.addendum)),
  ],
};

export function isEditableSection(title: string): boolean {
  return Object.prototype.hasOwnProperty.call(EDIT_SECTIONS, title);
}

/** Writes only the fields whose text actually changed. Returns the new draft and how many fields changed. */
export function applySectionEdits(
  draft: any,
  data: any,
  title: string,
  values: Record<string, string>,
): { next: any; changed: number } {
  let next = draft;
  let changed = 0;
  for (const f of EDIT_SECTIONS[title] || []) {
    if (!(f.key in values)) continue;
    const before = f.get(next, data).trim();
    const after = (values[f.key] ?? "").trim();
    if (before === after) continue;
    next = f.set(next, after);
    changed++;
  }
  return { next, changed };
}

/** One-window edit form: jump chips and the order of sections shown. */
export const EDIT_GROUPS: { id: string; label: string; title: string; pediatricOnly?: boolean }[] = [
  { id: "complaint", label: "Complaint", title: "Presenting Complaint" },
  { id: "pat", label: "PAT", title: "Pediatric Assessment (PAT)", pediatricOnly: true },
  { id: "primary", label: "Primary", title: "Primary Survey" },
  { id: "adjuncts", label: "Adjuncts", title: "Adjuvants to Primary" },
  { id: "history", label: "History", title: "History" },
  { id: "exam", label: "Exam", title: "Secondary Survey" },
  { id: "psych", label: "Psych", title: "Psychological Assessment" },
  { id: "tests", label: "Tests", title: "Investigations & Diagnostic Studies" },
  { id: "treatment", label: "Treatment", title: "Treatment Given & Emergency Orders" },
  { id: "diagnosis", label: "Diagnosis", title: "Provisional Diagnosis" },
  { id: "disposition", label: "Disposition", title: "Disposition & Outcome" },
  { id: "notes", label: "Notes", title: "Clinical Notes & Addendum" },
];