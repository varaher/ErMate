// MARKER: ERMATE-QUICK-INVESTIGATION-PANELS-V1
import { readFileSync } from "fs";
import { ORDER_PANELS } from "./src/data/orderPanels";
import {
  EMPTY_PREFS, getEffectivePanels, sanitizePrefs, parseTests, validatePanelName, orderForCase, testsToAdd,
  MAX_CUSTOM_PANELS, MAX_TESTS_PER_PANEL, MAX_NAME_LEN,
} from "./src/utils/quickPanels";

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}`); } };

// ---- defaults untouched ----
const base = getEffectivePanels(EMPTY_PREFS);
check("no prefs => all built-in panels, same names and tests", base.length === ORDER_PANELS.length && base.every((p, i) => p.name === ORDER_PANELS[i].name && p.tests.join() === ORDER_PANELS[i].tests.join()));
check("built-in ids are the original names (stable)", base.every((p, i) => p.id === ORDER_PANELS[i].name && p.builtIn));

// ---- rename / retest / hide ----
const first = ORDER_PANELS[0].name;
const withRename = getEffectivePanels({ overrides: { [first]: { name: "ED STARTER" } }, hidden: [], custom: [] });
check("rename changes label only, keeps id and tests", withRename[0].name === "ED STARTER" && withRename[0].id === first && withRename[0].tests.join() === ORDER_PANELS[0].tests.join() && withRename[0].modified);
const withTests = getEffectivePanels({ overrides: { [first]: { tests: ["CBC", "TROPONIN I"] } }, hidden: [], custom: [] });
check("tests override applied", withTests[0].tests.join() === "CBC,TROPONIN I");
const hiddenList = getEffectivePanels({ overrides: {}, hidden: [first], custom: [] });
check("hidden built-in removed from menu list", hiddenList.length === ORDER_PANELS.length - 1 && !hiddenList.some((p) => p.id === first));
check("includeHidden returns it for the manage screen", getEffectivePanels({ overrides: {}, hidden: [first], custom: [] }, { includeHidden: true }).length === ORDER_PANELS.length);

// ---- custom ----
const custom = getEffectivePanels({ overrides: {}, hidden: [], custom: [{ id: "custom-1", name: "OUR CHEST PAIN", group: "adult", tests: ["ECG", "TROPONIN I", "CBC"] }] });
check("custom panel appended after built-ins", custom[custom.length - 1].name === "OUR CHEST PAIN" && !custom[custom.length - 1].builtIn);

// ---- ordering by case type ----
const paeds = orderForCase(base, true);
check("paediatric case lists paediatric panels first", paeds[0].group === "pediatric");
const adult = orderForCase(base, false);
check("adult case lists adult panels first", adult[0].group === "adult");

// ---- parse / sanitize ----
check("parseTests splits commas/newlines/semicolons, trims, de-dupes case-insensitively", parseTests(" CBC, crp ;\nCBC\n\n RFT ").join("|") === "CBC|crp|RFT");
check("parseTests caps test count", parseTests(Array.from({ length: 100 }, (_, i) => `T${i}`).join(",")).length === MAX_TESTS_PER_PANEL);
const dirty = sanitizePrefs({ overrides: { "NOT A PANEL": { name: "x" }, [first]: { name: "  A  ", tests: [] } }, hidden: ["bogus", first, first], custom: [{ id: "c", name: "", tests: ["x"] }, { id: "d", name: "Ok", tests: [] }, { id: "e", name: "Good", tests: ["CBC"], group: "weird" }] });
check("sanitize drops unknown built-in ids", !("NOT A PANEL" in dirty.overrides));
check("sanitize keeps name-only override, drops empty tests", dirty.overrides[first]?.name === "A" && dirty.overrides[first]?.tests === undefined);
check("sanitize de-dupes hidden and drops unknown", dirty.hidden.length === 1 && dirty.hidden[0] === first);
check("sanitize drops nameless / testless custom, defaults group", dirty.custom.length === 1 && dirty.custom[0].name === "Good" && dirty.custom[0].group === "adult");
check("sanitize survives garbage", sanitizePrefs(null).custom.length === 0 && sanitizePrefs("x").hidden.length === 0 && sanitizePrefs(42).custom.length === 0);
check("sanitize caps custom panel count", sanitizePrefs({ custom: Array.from({ length: 60 }, (_, i) => ({ id: `c${i}`, name: `P${i}`, tests: ["CBC"] })) }).custom.length === MAX_CUSTOM_PANELS);
check("sanitize caps name length", sanitizePrefs({ custom: [{ id: "a", name: "N".repeat(200), tests: ["CBC"] }] }).custom[0].name.length === MAX_NAME_LEN);

// ---- validation ----
check("empty name rejected", validatePanelName("  ", base) !== null);
check("duplicate name rejected case-insensitively", validatePanelName("er basic", base) !== null);
check("renaming a panel to its own name is allowed", validatePanelName("ER BASIC", base, "ER BASIC") === null);
check("new unique name accepted", validatePanelName("MY HOSPITAL PANEL", base) === null);

// ---- no duplicate ordering ----
check("testsToAdd skips already-ordered tests, case-insensitive", testsToAdd(["CBC", "CRP", "URE"], [" cbc ", "ure"]).join() === "CRP");
check("testsToAdd returns [] when all ordered", testsToAdd(["CBC"], ["CBC"]).length === 0);

// ---- wiring (static) ----
const cs = readFileSync("src/components/CaseSheetView.tsx", "utf8");
const menu = readFileSync("src/components/QuickInvestigationMenu.tsx", "utf8");
const store = readFileSync("src/services/quickPanelsStorage.ts", "utf8");
const panels = readFileSync("src/data/orderPanels.ts", "utf8");
check("case sheet renders QuickInvestigationMenu", cs.includes("<QuickInvestigationMenu"));
check("old always-open panel grid removed", !cs.includes("Quick Order Sets") && !cs.includes("+ Auto-Order"));
check("handleOrderPanel takes a panel and returns added count", /handleOrderPanel = \(panel: EffectivePanel\): number/.test(cs));
check("order still writes investigations + labs-ordered text", cs.includes("investigationLabsOrdered: updatedLabsStr") && cs.includes("investigations: [...prev.investigations, ...newItems]"));
check("menu: button + list ids", menu.includes('id="quick-investigation-button"') && menu.includes('id="quick-investigation-list"'));
check("menu: closes on outside click and Escape", menu.includes('"mousedown"') && menu.includes('"Escape"'));
check("menu: manage + add + save ids", menu.includes('id="quick-investigation-manage"') && menu.includes('id="quick-investigation-add"') && menu.includes('id="quick-investigation-save"'));
check("menu: tests not rendered in list rows (only count + tooltip)", menu.includes("title={p.tests.join") && !/>\s*\{p\.tests\.join/.test(menu));
check("storage: owner-only users/{uid}/meta/quickPanels", store.includes('"users", uid, "meta", "quickPanels"'));
check("storage: does not touch the user profile doc or handleSaveProfile", !store.includes("handleSaveProfile") && !/doc\(db, "users", uid\)\s*[,)]/.test(store));
check("built-in ORDER_PANELS data file unchanged in shape", /export const ORDER_PANELS: OrderPanel\[\]/.test(panels));

console.log(`\nQuick investigation panels: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
