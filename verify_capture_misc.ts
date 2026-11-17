import { readFileSync } from "fs";
import { detectClinicalNormalcy } from "./server/clinicalLanguageNormalizer";
let fail = 0; const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const srv = readFileSync("server.ts", "utf8");
const i = srv.indexOf('app.post("/api/scribe-extract"');
const block = srv.slice(i, srv.indexOf('app.post("/api/scribe-chat"', i));

// the words "Not documented" are never saved as data by the scribe-extract route
t("status fields never saved as Not documented", !/Status:[^,\n]*"Not documented"/.test(block));
t("secondary assessment skips undictated systems", !block.includes('"Not documented")}`') && block.includes(".filter(([, v]) => v)"));
t("allergies not defaulted to Not documented", !block.includes('allergies: ext.allergies || "Not documented"'));
t("GCS and RR still taken from vitals", block.includes("gcs: ext.vitals?.gcs || null") && block.includes("rr: ext.vitals?.rr || null"));

// the app merge keeps an earlier value when a later one is empty
const app = readFileSync("src/App.tsx", "utf8");
t("empty new value does not erase an old one", app.includes("rr: extracted.vitals?.rr || existingMatch?.vitals.rr") && app.includes("airway: extractedPA.airway || extracted.airway || existingPA.airway"));

// normal primary survey wording
const yes = ["primary survey normal", "ABCDE normal", "primary assessment stable", "ABC stable", "ABCs intact", "A B C D E intact", "primary survey: no abnormality", "vitals stable, ABCs intact", "primary survey is okay"];
for (const s of yes) t(`normal phrase: ${s}`, detectClinicalNormalcy(s).abcdeNormal === true);
const no = ["airway patent breathing normal circulation stable", "primary survey airway compromised, now stable", "airway obstructed hemodynamically stable ABC", "vitals stable", "patient stable", "airway patent, GCS 15"];
for (const s of no) t(`not a normal phrase: ${s}`, detectClinicalNormalcy(s).abcdeNormal === false);
if (fail) { console.log(fail + " failed"); process.exit(1); } console.log("ALL PASS");