/**
 * HPI written from the whole case (Neeraj, 21 Nov 2026).
 * Run: npx tsx verify_case_summary_hpi.ts
 */
import { readFileSync } from "fs";
import {
  writeHpiFromCase, cleanHpiOutput, numbersAreFromCase, templateHpi, pronounFor, buildSafeCaseText,
  buildUserPrompt, HPI_SYSTEM_PROMPT,
} from "./server/caseSummaryHpi";
import { withCaseSummaryHpi, hpiInputFromCase, isDoctorWrittenHpi, markHpiEditedByDoctor } from "./src/utils/caseSummaryHpi";
import { EDIT_SECTIONS, applySectionEdits } from "./src/lib/previewedit";

let passed = 0, failed = 0;
const ok = (c: any, n: string, extra = "") => { if (c) passed++; else { failed++; console.error("FAIL:", n, extra); } };

const caseInput = {
  sex: "Male",
  presentingComplaint: "Breathing difficulty since today morning, fever with chills since today morning",
  symptoms: "Fever with chills, breathing difficulty",
  events: null,
  currentHpi: "Went to a local hospital first, given Inj. Lasix and symptomatic treatment. Came here as he is on regular follow-up with Pulmonology department here.",
  pastHistory: "Known case of COPD on nocturnal home oxygen, CAD, DLP, Hypertension",
  surgicalHistory: "Post CABG",
  medications: null, arrivalMode: null, notes: null,
};
const GOOD = "The patient presented to the Emergency Department with complaints of fever with chills and breathing difficulty since today morning. He initially sought medical attention at a local hospital, where Inj. Lasix and symptomatic treatment were administered. The patient presented to our Emergency Department for further evaluation and management, as he is on regular follow-up with the Pulmonology department at our hospital.";

(async () => {
  // ── Server writer ──
  let sys = "", usr = "";
  const r1 = await writeHpiFromCase(caseInput, { primary: async (s, u) => { sys = s; usr = u; return GOOD; } });
  ok(r1.source === "ai" && r1.hpi === GOOD, "GPT-4o-mini HPI accepted");
  ok(/Pronoun for the patient: He\./.test(usr) && /Past medical history: Known case of COPD/.test(usr), "prompt carries pronoun and the whole case");
  ok(/Use ONLY facts written in the case/.test(sys) && /Do not include vitals, examination findings, investigations, ED treatment, diagnosis or plan/.test(sys), "prompt forbids invented facts and non-history content");
  ok(sys === HPI_SYSTEM_PROMPT, "one fixed system prompt");

  const r2 = await writeHpiFromCase(caseInput, {
    primary: async () => { throw new Error("down"); },
    fallback: async () => GOOD,
  });
  ok(r2.source === "ai" && r2.hpi === GOOD, "falls back to Claude Haiku when GPT fails");

  const invented = "The patient presented with fever for 3 days and was given 40 mg of Lasix.";
  const r3 = await writeHpiFromCase(caseInput, { primary: async () => invented, fallback: async () => invented });
  ok(r3.hpi === null && r3.source === "none", "invented numbers rejected; existing HPI kept (no template over it)", JSON.stringify(r3));

  const r4 = await writeHpiFromCase({ ...caseInput, currentHpi: null }, { primary: async () => { throw new Error("x"); } });
  ok(r4.source === "template" && r4.hpi === "The patient presented to the Emergency Department with complaints of breathing difficulty since today morning, fever with chills since today morning.", "no AI and no HPI → plain template from the complaint", r4.hpi || "");

  const r5 = await writeHpiFromCase({ sex: "F" }, { primary: async () => GOOD });
  ok(r5.hpi === null && r5.reason === "no history recorded", "nothing recorded → nothing written");

  // Output cleaning
  ok(cleanHpiOutput("HPI: [PATIENT] presented with cough", "cough") === "The patient presented with cough.", "name placeholder becomes 'the patient', heading stripped");
  ok(cleanHpiOutput("Seen at [HOSPITAL] for cough", "cough") === null, "other placeholders leaking → rejected");
  ok(numbersAreFromCase("fever for two days", "fever x 2 days") && numbersAreFromCase("fever for 2 days", "fever since two days"), "number words and digits are treated alike");
  ok(!numbersAreFromCase("fever for 5 days", "fever x 2 days"), "a number not in the case is caught");
  ok(pronounFor("F") === "She" && pronounFor("male") === "He" && pronounFor("") === null, "pronoun only from recorded sex");
  ok(/use "the patient", never he or she/.test(buildUserPrompt("x", null)), "no sex recorded → no he/she");
  const safe = buildSafeCaseText({ ...caseInput, currentHpi: "Mr. Ravi Kumar went to Jubilee Mission Hospital, UHID 12345678" });
  ok(!/Ravi Kumar|12345678/.test(safe), "identifiers removed before the model sees the text", safe);
  ok(templateHpi({ presentingComplaint: "Chest pain since 2 hours", events: "Fall from bike" }) === "The patient presented to the Emergency Department with complaints of chest pain since 2 hours. Fall from bike.", "template wording");

  // ── App side ──
  const c: any = {
    id: "C1", patient: { gender: "Male", presentingComplaint: caseInput.presentingComplaint, arrivalMode: "Walk-in", name: "Ravi", uhid: "U9" },
    sampleHistory: { symptoms: caseInput.symptoms, events: "", hpi: caseInput.currentHpi, pastHistory: caseInput.pastHistory, surgicalHistory: "Post CABG", medications: "" },
  };
  const input = hpiInputFromCase(c);
  ok(!JSON.stringify(input).includes("Ravi") && !JSON.stringify(input).includes("U9"), "app never sends patient name or UHID");

  let calls = 0;
  const fakeFetch: any = async (_u: string, init: any) => { calls++; JSON.parse(init.body); return new Response(JSON.stringify({ success: true, hpi: GOOD, source: "ai" }), { status: 200 }); };
  const token = async () => "t";
  const a = await withCaseSummaryHpi(c, { fetchImpl: fakeFetch, getToken: token });
  ok(a.changed && a.case.sampleHistory.hpi === GOOD && (a.case.sampleHistory as any).hpiSource === "case-summary", "preview writes the HPI from the case");

  const doctorCase = markHpiEditedByDoctor(c, "Doctor's own words.");
  calls = 0;
  const b = await withCaseSummaryHpi(doctorCase, { fetchImpl: fakeFetch, getToken: token });
  ok(!b.changed && calls === 0 && b.case.sampleHistory.hpi === "Doctor's own words.", "doctor-written HPI is never replaced automatically");
  const f = await withCaseSummaryHpi(doctorCase, { fetchImpl: fakeFetch, getToken: token, force: true });
  ok(f.changed && f.case.sampleHistory.hpi === GOOD, "Rewrite HPI from case (force) replaces it on purpose");

  const failFetch: any = async () => new Response(JSON.stringify({ success: false, hpi: null }), { status: 503 });
  const d = await withCaseSummaryHpi(c, { fetchImpl: failFetch, getToken: token });
  ok(!d.changed && d.case === c, "server failure → case unchanged (nothing invented)");
  const slowFetch: any = (_u: string, init: any) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const e = await withCaseSummaryHpi(c, { fetchImpl: slowFetch, getToken: token, timeoutMs: 30 });
  ok(!e.changed && e.reason === "timed out", "slow server → preview opens with the existing HPI");
  ok(isDoctorWrittenHpi(doctorCase) && !isDoctorWrittenHpi(c), "doctor marker detected");

  // Preview edit marks the HPI as the doctor's
  const histTitle = Object.keys(EDIT_SECTIONS).find((t) => EDIT_SECTIONS[t].some((fld) => fld.key === "hpi"))!;
  const edited = applySectionEdits(c, { hpi: c.sampleHistory.hpi }, histTitle, { hpi: "Edited in preview." });
  ok(edited.next.sampleHistory.hpi === "Edited in preview." && edited.next.sampleHistory.hpiSource === "doctor", "editing the HPI in the preview marks it as the doctor's");

  // ── Wiring ──
  const app = readFileSync("src/App.tsx", "utf8");
  ok(/draftCase = \(await withCaseSummaryHpi\(builtDraft\)\)\.case;/.test(app), "Preview case sheet runs the HPI writer");
  ok(/hpiSource: \(existingMatch!\.sampleHistory as any\)\.hpiSource/.test(app), "draft keeps who wrote the HPI");
  ok(/Preparing case sheet — writing HPI…/.test(app) && /preparingPreviewRef\.current\) return;/.test(app), "shows a preparing notice and ignores double taps");
  const csv = readFileSync("src/components/CaseSheetView.tsx", "utf8");
  ok(/field === "hpi" \? \{ hpiSource: "doctor" as const \}/.test(csv), "typing in the HPI box marks it as the doctor's");
  ok(/Rewrite HPI from case/.test(csv) && /withCaseSummaryHpi\(currentCase, \{ force: true \}\)/.test(csv), "Rewrite HPI from case button");
  const server = readFileSync("server.ts", "utf8");
  ok(/app\.use\("\/api\/case-sheet", hpiRouter\)/.test(server), "route mounted");
  const route = readFileSync("server/routes/hpi.routes.ts", "utf8");
  ok(/router\.post\("\/hpi-from-case", requireAuth/.test(route), "route needs sign-in");
  const mod = readFileSync("server/caseSummaryHpi.ts", "utf8");
  ok(/gpt-4o-mini/.test(mod) && /claude-haiku/.test(mod) && !/gemini/i.test(mod.replace(/No Gemini/g, "")), "GPT-4o-mini → Claude Haiku, no Gemini");
  ok((mod.match(/temperature: 0\b/g) || []).length === 2, "temperature 0 on both models");
  ok(/feature: "er-record-hpi"/.test(readFileSync("src/lib/coachTours.ts", "utf8")), "walkthrough tip");

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });