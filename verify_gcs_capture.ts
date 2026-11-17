import { mapExtractionToCaseSheetFields } from "./server/scribeChatTurn";
let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const run = (text: string, raw: any) => mapExtractionToCaseSheetFields({} as any, raw, {}, text) as any;
const v = (text: string, raw: any) => run(text, { vitals: raw }).vitals || {};

// totals, every way a doctor says it
for (const [txt, label] of [
  ["GCS 15", "digits"], ["GCS 15/15", "15 slash 15"], ["GCS-15", "dash"], ["gcs is fifteen", "words"], ["GCS fifteen by fifteen", "words by"],
  ["Glasgow 15", "Glasgow alone"], ["GCS at 15", "at"], ["GCS came to 14", "came to"], ["Glasgow coma scale 12", "coma scale"], ["GCS: 9", "colon"], ["total GCS is thirteen", "total words"],
] as const) {
  const n = String(txt.match(/\d+/)?.[0] || ({ fifteen: "15", thirteen: "13", fourteen: "14" } as any)[(txt.match(/fifteen|thirteen|fourteen/i) || [""])[0].toLowerCase()]);
  t(`total kept: ${label}`, v(txt + ", RR 20", { gcs: n, rr: "20" }).gcs === n);
}
// never invented
t("no GCS dictated -> no GCS", v("RR 20, HR 90, patient comfortable", { gcs: "15", rr: "20" }).gcs === undefined);
t("BP 120/80 is not a GCS", v("BP 120/80 RR 18", { gcs: "12", rr: "18" }).gcs === undefined);
t("limb power 5/5 is not a GCS", v("power 5/5 in all limbs", { gcs: "5" }).gcs === undefined);
t("age is not a GCS", v("14 year old male", { gcs: "14" }).gcs === undefined);
t("eye only keeps eye, no total", (() => { const r = v("GCS E4", { gcs: "15", gcs_e: "4", gcs_v: "5", gcs_m: "6" }); return r.gcs_e === "4" && r.gcs === undefined && r.gcs_v === undefined && r.gcs_m === undefined; })());

// components
t("E4V5M6 keeps parts and sums", (() => { const r = v("GCS E4V5M6", { gcs_e: "4", gcs_v: "5", gcs_m: "6" }); return r.gcs === "15" && r.gcs_m === "6"; })());
t("E four V five M six (words)", (() => { const r = v("E four V five M six", { gcs_e: "4", gcs_v: "5", gcs_m: "6" }); return r.gcs === "15"; })());
t("eye 3 verbal 4 motor 5", (() => { const r = v("eye 3 verbal 4 motor 5", { gcs_e: "3", gcs_v: "4", gcs_m: "5" }); return r.gcs === "12"; })());
t("spoken descriptions keep parts", (() => { const r = v("eyes opening spontaneously, verbal oriented, motor obeying commands", { gcs_e: "4", gcs_v: "5", gcs_m: "6" }); return r.gcs_e === "4" && r.gcs_v === "5" && r.gcs_m === "6" && r.gcs === "15"; })());
t("words that disagree with the model are dropped", v("eyes open to pain", { gcs_e: "4" }).gcs_e === undefined);
t("words agreeing with the model kept", v("eyes open to pain", { gcs_e: "2" }).gcs_e === "2");
t("only two parts dictated -> no total", (() => { const r = v("E3 V4", { gcs_e: "3", gcs_v: "4", gcs_m: "5" }); return r.gcs === undefined && r.gcs_m === undefined; })());

// vitals are text, other vitals untouched
t("number vital becomes text", v("RR 20", { rr: 20 }).rr === "20");
t("RR spo2 hr pass through", (() => { const r = v("RR 22 SpO2 94 HR 100 GRBS 120", { rr: "22", spo2: "94", hr: "100", grbs: "120" }); return r.rr === "22" && r.spo2 === "94" && r.hr === "100" && r.grbs === "120"; })());
// primary assessment text still maps
t("airway breathing circulation map", (() => { const r = run("airway patent breathing bilateral air entry circulation CRT under 2 seconds", { airway: "patent", breathing: "bilateral air entry", circulation: "CRT under 2 seconds" }); return r.airway === "patent" && r.breathing === "bilateral air entry" && r.circulation === "CRT under 2 seconds"; })());
if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");