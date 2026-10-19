import fs from "fs";
import { stampClinicianUpdates, displayTimeForUpdate } from "./src/mate/clinicianUpdateStamp";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };

const localOf = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const isKolkata = Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata";
const instant = new Date("2026-10-19T23:16:00Z"); // 04:46 on 20 Oct in Asia/Kolkata
const serverFields = { presentingComplaint: "Fever", clinicianUpdates: [{ text: "fever since 3 days", timestamp: "11:16 PM" }] };
const out: any = stampClinicianUpdates(serverFields, instant);
t("canonical UTC instant stored", out.clinicianUpdates[0].at === "2026-10-19T23:16:00.000Z");
t("display time is the device-local time of the instant", out.clinicianUpdates[0].timestamp === localOf(instant));
t("in Asia/Kolkata that is 04:46 (not 11:16 PM)", !isKolkata || /04:46/.test(out.clinicianUpdates[0].timestamp));
t("other extracted fields untouched", out.presentingComplaint === "Fever");
t("input object not mutated", serverFields.clinicianUpdates[0].timestamp === "11:16 PM" && !("at" in serverFields.clinicianUpdates[0]));
t("string updates are wrapped", (stampClinicianUpdates({ clinicianUpdates: ["bp low"] } as any, instant) as any).clinicianUpdates[0].text === "bp low");
t("empty updates dropped", (stampClinicianUpdates({ clinicianUpdates: [{ text: "  " }] } as any, instant) as any).clinicianUpdates.length === 0);
t("no updates -> same object", (() => { const f = { a: 1 }; return stampClinicianUpdates(f as any, instant) === f; })());
t("display derives from the instant, not the stored string", displayTimeForUpdate({ at: "2026-10-19T23:16:00.000Z", timestamp: "11:16 PM" }) === localOf(instant));
t("legacy item without instant keeps its stored string", displayTimeForUpdate({ text: "x", timestamp: "09:05 AM" }) === "09:05 AM");
t("bad instant falls back safely", displayTimeForUpdate({ at: "garbage", timestamp: "09:05 AM" }) === "09:05 AM");
t("no data falls back to now", displayTimeForUpdate({}, instant).length > 0);

const chat = fs.readFileSync("./src/components/VoiceScribeChatView.tsx", "utf8");
const app = fs.readFileSync("./src/App.tsx", "utf8");
t("chat stamps updates after extraction", /stampClinicianUpdates\(fieldsToExtract\)\.clinicianUpdates/.test(chat));
t("case sheet note uses the instant-derived time", /const time = displayTimeForUpdate\(item\)/.test(app));
t("status line: awaiting vs saved", /Awaiting your review: these details are not yet saved/.test(chat) && /✓ Saved to the case sheet/.test(chat));
t("'saved' is shown only from extractionApplied (set after the save resolves)", /msg\.extractionApplied === true\s*\? `✓ Saved/.test(chat) && /await onSaveExtractedCase\(extractionData[\s\S]{0,400}extractionApplied: true/.test(chat));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
