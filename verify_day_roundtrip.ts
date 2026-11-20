import { readFileSync } from "fs";
import { deidentifyText } from "./server/deidentify";
import { dayMapFromText, restoreDayMarkers, restoreDayMarkersDeep } from "./src/mate/dayplaceholder";

let fail = 0;
const t = (n: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); if (!ok) fail++; };

// What the doctor pasted: an old date in the header (e.g. an earlier visit) and an LMP months/years later.
const sheet = [
  "Patient attended earlier on 13/10/2016 for rhinitis.",
  "Past history: Lichen amyloidosis, IBS.",
  "Outside hospital investigations (16/11/2026): CBC normal.",
  "LMP: 28/10/26",
].join("\n");

// The server sends the AI this version. The AI echoes the markers back in its answer.
const safe = deidentifyText(sheet).deidentified;
t("server really replaces dates with markers", /\[Day \d+\]/.test(safe) && !/28\/10\/26/.test(safe));
const lmpMarker = (safe.match(/LMP:\s*(\[Day \d+\])/) || [])[1];
t("LMP became a large Day number (the reported bug)", !!lmpMarker && parseInt(lmpMarker.replace(/\D/g, ""), 10) > 3000);

// The AI's extraction, as the app receives it
const ext: any = { sampleHistory: { lmp: lmpMarker, events: `Investigations done on ${(safe.match(/\(\[Day \d+\]\)/) || ["([Day 1])"])[0].slice(1, -1)}` } };
const fixed: any = restoreDayMarkersDeep(ext, sheet);
t("LMP is the doctor's own date again", fixed.sampleHistory.lmp === "28/10/26");
t("other date restored too", /16\/11\/2026/.test(fixed.sampleHistory.events));

// Every marker the server can produce maps back to the same calendar day
const many = "Admitted 02/11/2026. Seen 03/11/2026. Review 2026-11-09. Old note 15-08-2025. LMP 28.10.26";
const safeMany = deidentifyText(many).deidentified;
const map = dayMapFromText(many);
const restoredMany = restoreDayMarkers(safeMany, map);
const dates = (s: string) => (s.match(/\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}/g) || []).length;
t("no markers left after restore", !/\[Day/.test(restoredMany));
t("same number of dates back", dates(restoredMany) === dates(many));
t("exact original text recovered", restoredMany === many);

// Not clinical text: unmatched markers are removed, never shown
t("unknown marker removed", !/\[Day/.test(restoreDayMarkers("seen on [Day 99]", map)));
t("text without markers is untouched", restoreDayMarkers("No dates here", map) === "No dates here");

// wiring: every route that gets AI fields back restores dates
const q = readFileSync("src/components/QuickDischargeIntake.tsx", "utf8");
t("quick discharge restores dates from the pasted text", q.includes("restoreDayMarkersDeep(resData.data || resData.extracted || {}, rawText)"));
const v = readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
t("MATE chat restores dates", (v.match(/restoreDayMarkersDeep\(/g) || []).length >= 2);

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);