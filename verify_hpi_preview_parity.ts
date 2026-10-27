// MARKER: ERMATE-HPI-PREVIEW-PARITY-V1
import { readFileSync } from "fs";
import { resolveDraftHpi, resolveHpi } from "./src/utils/historyFields";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };

t("typed HPI is never replaced", resolveDraftHpi({ existingHpi: "Typed by doctor", extractedHpi: "Model HPI", symptoms: "fever", events: "fall" }) === "Typed by doctor");
t("extraction HPI used when sheet has none", resolveDraftHpi({ existingHpi: "", extractedHpi: "Model HPI", symptoms: "fever" }) === "Model HPI");
t("composed from symptoms + events when no HPI anywhere (MATE preview case)", resolveDraftHpi({ symptoms: "Fever and vomiting for 2 days", events: "Collapsed at home" }) === "Fever and vomiting for 2 days. Collapsed at home");
t("symptoms only", resolveDraftHpi({ symptoms: "Chest pain 1 hour" }) === "Chest pain 1 hour");
t("events only", resolveDraftHpi({ events: "Fall from stairs" }) === "Fall from stairs");
t("nothing stated -> nothing invented", resolveDraftHpi({}) === "");
t("whitespace-only inputs -> empty", resolveDraftHpi({ existingHpi: "  ", extractedHpi: " ", symptoms: " ", events: "" }) === "");
t("event already inside symptoms is not repeated", resolveDraftHpi({ symptoms: "Collapsed at home with chest pain", events: "collapsed at home" }) === "Collapsed at home with chest pain");
t("non-string inputs ignored safely", resolveDraftHpi({ existingHpi: 5, extractedHpi: null, symptoms: ["x"], events: undefined }) === "");
t("matches discharge rule (same text as resolveHpi)", resolveDraftHpi({ symptoms: "Fever", events: "Fall" }) === resolveHpi({ symptoms: "Fever", events: "Fall" }));

const app = readFileSync("src/App.tsx", "utf8");
t("draft builder uses resolveDraftHpi", app.includes("hpi: resolveDraftHpi({") && app.includes('import { resolveDraftHpi } from "./utils/historyFields"'));
t("existing sheet HPI passed as first priority", app.includes("existingHpi: existingMatch?.sampleHistory?.hpi"));
t("preview and apply share one draft builder", app.includes("handleApplyPreviewCase") && app.includes("const draftCase = buildExtractedCaseDraft(existingMatch, extracted, {"));
console.log(`\nHPI preview parity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);