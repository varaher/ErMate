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
      familyHistory: txt(d.familyHistory), hpi: txt(d.hpi), surgicalHistory: txt(d.surgicalHistory), lmp: txt(d.lmp),
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

const PRIMARY: PreviewField[] = [
  primary("airway", "Airway"), primary("breathing", "Breathing"), primary("circulation", "Circulation"),
  primary("disability", "Disability"), primary("exposure", "Exposure"),
  vital("rr", "RR"), vital("hr", "HR"), vital("spo2", "SpO₂"), vital("bp", "BP"), vital("grbs", "GRBS"), vital("temp", "Temp (with unit)"),
];

/** Section heading text (as printed in the preview) -> its editable fields. */
export const EDIT_SECTIONS: Record<string, PreviewField[]> = {
  "Presenting Complaint": [caseText("cc", "Presenting complaint", ["patient", "presentingComplaint"], (_c, d) => txt(d.presentingComplaint))],
  "Primary Survey": PRIMARY,
  "Secondary Assessment / History": HISTORY,
  "History": HISTORY,
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
export const EDIT_GROUPS: { id: string; label: string; title: string }[] = [
  { id: "complaint", label: "Complaint", title: "Presenting Complaint" },
  { id: "primary", label: "Primary", title: "Primary Survey" },
  { id: "history", label: "History", title: "History" },
  { id: "exam", label: "Exam", title: "Secondary Survey" },
  { id: "tests", label: "Tests", title: "Investigations & Diagnostic Studies" },
  { id: "treatment", label: "Treatment", title: "Treatment Given & Emergency Orders" },
  { id: "diagnosis", label: "Diagnosis", title: "Provisional Diagnosis" },
  { id: "disposition", label: "Disposition", title: "Disposition & Outcome" },
  { id: "notes", label: "Notes", title: "Clinical Notes & Addendum" },
];