// MATE modes. A window always opens in Dictate. The doctor switches by tap or by voice.
// Only Dictate can write to a case sheet (through the preview). Every other mode is read-only.
import { normalizeMateBedId } from "./mateBedModel";

export type MateMode = "dictate" | "case" | "ward" | "chat" | "rounds";

export const MATE_MODES: { id: MateMode; label: string }[] = [
  { id: "dictate", label: "Dictate" },
  { id: "case", label: "Ask: this case" },
  { id: "ward", label: "Ask: my list" },
  { id: "chat", label: "Chat" },
  { id: "rounds", label: "Rounds" },
];

export const DICTATE_PLACEHOLDER = "Talk to MATE — dictate, ask, or give a command...";

export const MODE_PLACEHOLDER: Record<MateMode, string> = {
  dictate: DICTATE_PLACEHOLDER,
  case: "Ask about the open patient...",
  ward: "Ask about all your open beds...",
  chat: "Chat about anything...",
  rounds: "Rounds on which bed? e.g. “devil’s advocate bed 2”",
};

export const MODE_HINT: Record<MateMode, string> = {
  dictate: "",
  case: "Read-only. Nothing here changes the case sheet.",
  ward: "Read-only. Answers come from your open beds, without names.",
  chat: "Read-only general assistant. Nothing is saved.",
  rounds: "Read-only teaching lenses on the bed you name.",
};

export const MODE_ENTERED: Record<MateMode, string> = {
  dictate: "Dictate mode. Say the bed number first, then the case.",
  case: "Ask mode: this case. I'll answer about the open patient. Nothing is saved to the case sheet.",
  ward: "Ask mode: my list. I'll answer from all your open beds. Nothing is saved.",
  chat: "Chat mode. Ask me anything. Nothing is saved to any case sheet.",
  rounds: "Rounds mode. Name a bed and a lens, e.g. “devil’s advocate bed 2”. Nothing is saved.",
};

const SWITCHES: { mode: MateMode; re: RegExp }[] = [
  { mode: "dictate", re: /^(?:please\s+)?(?:(?:switch|go|come)\s+(?:back\s+)?to\s+|back\s+to\s+)dictat(?:e|ion)(?:\s+mode)?$|^dictat(?:e|ion)\s+mode$/i },
  { mode: "case", re: /^(?:please\s+)?(?:(?:switch|go)\s+to\s+)?(?:ask\s+(?:about\s+)?(?:this|the|my)\s+(?:case|patient)|(?:case|ask)\s+mode)$/i },
  { mode: "ward", re: /^(?:please\s+)?(?:(?:switch|go)\s+to\s+)?(?:ask\s+(?:about\s+)?(?:my|the)\s+(?:ward|list)|(?:ward|list)\s+mode)$/i },
  { mode: "chat", re: /^(?:please\s+)?(?:(?:switch|go)\s+to\s+)?chat\s+mode$|^(?:please\s+)?(?:switch|go)\s+to\s+chat$/i },
  { mode: "rounds", re: /^(?:please\s+)?(?:(?:switch|go)\s+to\s+)?rounds\s+mode$/i },
];

/** Whole short utterance only ("chat mode", "back to dictate"). Never matches clinical text. */
export function parseModeSwitch(text: string): MateMode | null {
  const t = (text || "").trim().replace(/[.!?]+$/, "");
  if (!t || t.length > 40) return null;
  for (const s of SWITCHES) if (s.re.test(t)) return s.mode;
  return null;
}

/** Lens for Rounds mode when the exact whitelist did not match. Defaults to the full debrief. */
export function lensFromText(text: string): string {
  const t = (text || "").toLowerCase();
  if (/devil/.test(t)) return "devils-advocate";
  if (/first\s+principles?/.test(t)) return "first-principles";
  if (/rare\s+but\s+real/.test(t)) return "rare-but-real";
  if (/patho/.test(t)) return "pathophysiology";
  if (/guideline/.test(t)) return "guidelines";
  if (/snapshot/.test(t)) return "disease-snapshot";
  return "full-debrief";
}

/** "bed 2" -> "2", "bed 7b" -> "7B". */
export function bedFromText(text: string): string | null {
  const m = (text || "").match(/\bbed\s*(?:no\.?|number|#)?\s*(\d{1,3})\s*([ab])?\b/i);
  return m ? `${parseInt(m[1], 10)}${(m[2] || "").toUpperCase()}` : null;
}

interface CaseLike { bedNo?: string | null; status?: string; archivedAt?: unknown; [k: string]: any }

/** A bare number matches that bed's A slot first, then B. */
export function findCaseByBed<T extends CaseLike>(cases: T[], bedRef: string | null): T | null {
  if (!bedRef) return null;
  const want = normalizeMateBedId(bedRef);
  if (!want) return null;
  const live = (cases || []).filter((c) => c && !c.archivedAt && c.status !== "Discharged");
  const exact = live.find((c) => normalizeMateBedId(c.bedNo) === want);
  if (exact) return exact;
  if (/^\d+$/.test(want)) {
    return live.find((c) => normalizeMateBedId(c.bedNo) === `${want}A`) || live.find((c) => normalizeMateBedId(c.bedNo) === `${want}B`) || null;
  }
  return null;
}

const short = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Whole hours since an ISO time ("12h in ER"), or "" when the time is missing or unreadable. */
function hoursSince(iso: unknown, now: number): string {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t) || t > now) return "";
  const h = Math.floor((now - t) / 3600000);
  return h < 1 ? "<1h in ER" : `${h}h in ER`;
}

/** Only the vitals that were recorded, exactly as stored (no units added: Temp keeps the unit it was entered with). */
function vitalsText(v: any): string {
  if (!v) return "";
  return [
    v.bp ? `BP ${short(v.bp, 12)}` : "",
    v.hr ? `HR ${short(v.hr, 6)}` : "",
    v.rr ? `RR ${short(v.rr, 6)}` : "",
    v.spo2 ? `SpO2 ${short(v.spo2, 6)}` : "",
    v.temp ? `Temp ${short(v.temp, 10)}` : "",
    v.gcs ? `GCS ${short(v.gcs, 6)}` : "",
    v.grbs ? `GRBS ${short(v.grbs, 8)}` : "",
  ].filter(Boolean).join(", ");
}

/**
 * One line per open bed for "Ask: my list". No names, no UHID. The server de-identifies again before the model sees it.
 * Only what is documented is listed: a missing item is simply absent (the server tells the model absent means not documented).
 */
export function buildWardLines(cases: CaseLike[], max: number = 30, now: number = Date.now()): string[] {
  const rows = (cases || [])
    .filter((c) => c && !c.archivedAt && c.status !== "Discharged")
    .map((c) => {
      const bed = normalizeMateBedId(c.bedNo) || "unassigned";
      const age = c.patient?.age ? `${c.patient.age}` : "";
      const sex = short(c.patient?.gender || c.patient?.sex, 1).toUpperCase();
      const pendingTests: string[] = [
        ...(Array.isArray(c.dispositionAndPlan?.pendingInvestigations) ? c.dispositionAndPlan.pendingInvestigations : []),
        ...(Array.isArray(c.investigationsOrdered) ? c.investigationsOrdered.filter((i: any) => i && /pend|order/i.test(String(i.status || "ordered"))).map((i: any) => i.name) : []),
        ...(Array.isArray(c.investigations) ? c.investigations.filter((i: any) => i && i.testName && !String(i.result || "").trim()).map((i: any) => i.testName) : []),
      ].map((x) => short(x, 30)).filter(Boolean);
      const abnormal = (Array.isArray(c.investigations) ? c.investigations : [])
        .filter((i: any) => i && i.isAbnormal && String(i.result || "").trim())
        .slice(0, 3).map((i: any) => `${short(i.testName, 24)} ${short(i.result, 20)}`);
      const drugs = (Array.isArray(c.treatments) ? c.treatments : [])
        .map((t: any) => short(t?.drugName || t?.name, 40)).filter(Boolean).slice(0, 4);
      const flags = (Array.isArray(c.vitalFlags) ? c.vitalFlags : []).map((f: any) => short(f, 30)).filter(Boolean).slice(0, 4);
      const consults = Array.isArray(c.dispositionAndPlan?.consultsRequested) ? c.dispositionAndPlan.consultsRequested.slice(0, 3).map((x: any) => short(x, 24)).filter(Boolean) : [];
      const parts = [
        `Bed ${bed}`,
        age || sex ? `${age}${sex ? " " + sex : ""}`.trim() : "",
        c.patient?.presentingComplaint ? `Complaint: ${short(c.patient.presentingComplaint, 90)}` : "",
        c.provisionalPrimaryDiagnosis ? `Dx: ${short(c.provisionalPrimaryDiagnosis, 90)}` : "",
        c.status ? `Status: ${short(c.status, 30)}` : "",
        c.awaitingDoctor ? "Awaiting doctor" : "",
        c.conditionAtShift ? `Condition: ${short(c.conditionAtShift, 30)}` : "",
        hoursSince(c.createdAt || c.admissionTime, now),
        vitalsText(c.vitals) ? `Vitals: ${vitalsText(c.vitals)}` : "",
        flags.length ? `Alerts: ${flags.join("; ")}` : "",
        abnormal.length ? `Abnormal: ${abnormal.join("; ")}` : "",
        pendingTests.length ? `Pending tests: ${Array.from(new Set(pendingTests)).slice(0, 5).join(", ")}` : "",
        drugs.length ? `Rx: ${drugs.join(", ")}` : "",
        consults.length ? `Consults: ${consults.join(", ")}` : "",
        c.dispositionAndPlan?.managementPlan ? `Plan: ${short(c.dispositionAndPlan.managementPlan, 120)}` : "",
      ].filter(Boolean);
      return { bed, line: parts.join(" | ") };
    })
    .sort((a, b) => a.bed.localeCompare(b.bed, undefined, { numeric: true }));
  return rows.slice(0, max).map((r) => r.line);
}

/** A reply is worth a "Use in Dictate" chip when it reads like clinical content (doses, vitals, orders). */
export function looksClinicalReply(text: string): boolean {
  return /\b(?:mg|mcg|ml|mmhg|bpm|gcs|ecg|iv|inj|bp|hr|spo2|dose|aspirin|ct|mri)\b/i.test(text || "");
}