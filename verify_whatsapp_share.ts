// MARKER: ERMATE-WHATSAPP-SHARE-V1
import { readFileSync } from "fs";
import { formatHandoverWhatsApp, dischargeToWhatsApp, buildWhatsAppUrl, openWhatsApp, MAX_LINK_CHARS } from "./src/utils/whatsappShare";
let fail = 0;
const t = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL " + n); } };
const when = new Date(2026, 10, 2, 9, 5);
const rows = [
  { bed: "3A", name: "Ravi Kumar", ageSex: "54 Years M", headline: "Inferior STEMI", vitals: "HR 90, BP 120/80, SpO2 97%", critical: [], given: ["Aspirin", "Clopidogrel"], plan: "Cath lab at 3 pm" },
  { bed: "7A", name: "Leela Devi", ageSex: "71 Years F", headline: "Sepsis", vitals: "HR 130, BP 82/50", critical: ["Hypotension (SBP 82 mmHg)"], plan: "Noradrenaline, ICU bed requested" },
];
const hidden = formatHandoverWhatsApp(rows, { hospital: "Sample Hospital", clinician: "Dr. Test", hideNames: true, when });
const shown = formatHandoverWhatsApp(rows, { hospital: "Sample Hospital", clinician: "Dr. Test", hideNames: false, when });
t("names are left out when hidden", !hidden.includes("Ravi") && !hidden.includes("Leela"));
t("names are shown when switched on", shown.includes("Ravi Kumar") && shown.includes("Leela Devi"));
t("bed, age/sex and diagnosis stay when names are hidden", hidden.includes("*Bed 3A* · 54 Years M") && hidden.includes("Inferior STEMI") && hidden.includes("*Bed 7A*"));
t("critical patients carry the CRITICAL tag", hidden.includes("*CRITICAL:* Hypotension (SBP 82 mmHg)") && !hidden.split("*Bed 3A*")[1].split("*Bed 7A*")[0].includes("CRITICAL"));
t("header has hospital, time and count", hidden.startsWith("*HANDOVER* · Sample Hospital · 2 Nov, 09:05") && hidden.includes("2 patients"));
t("plan and given are included", hidden.includes("Plan: Cath lab at 3 pm") && hidden.includes("Given: Aspirin, Clopidogrel"));
t("confidential footer", hidden.trim().endsWith("Confidential. For the receiving team only."));
t("one patient reads singular", formatHandoverWhatsApp([rows[0]], { hideNames: true, when }).includes("1 patient\n"));
t("missing bed is not invented", formatHandoverWhatsApp([{ ageSex: "30 Years M" }], { hideNames: true, when }).includes("Bed not set"));
t("long text is clipped", formatHandoverWhatsApp([{ bed: "1A", plan: "x".repeat(900) }], { hideNames: true, when }).length < 700);
t("values are not converted or invented", !/°C|°F/.test(hidden));

// discharge
const dis = dischargeToWhatsApp("**SAMPLE HOSPITAL**\r\n\r\n\r\n\r\n**PATIENT NAME:** Ravi\n- Weight: 70 kg");
t("discharge bold becomes WhatsApp bold", dis.startsWith("*SAMPLE HOSPITAL*") && dis.includes("*PATIENT NAME:* Ravi") && !dis.includes("**"));
t("discharge keeps the patient name (it goes to the patient)", dis.includes("Ravi"));
t("blank runs collapse", !/\n{3,}/.test(dis));

// opening
(async () => {
  const calls: string[] = []; let copied = "";
  const deps = { open: (u: string) => void calls.push(u), copy: async (x: string) => { copied = x; return true; } };
  t("short message opens a link with the text", (await openWhatsApp("hello & bye", deps)) === "link" && calls[0] === buildWhatsAppUrl("hello & bye") && calls[0].includes("hello%20%26%20bye"));
  calls.length = 0;
  const long = "a".repeat(MAX_LINK_CHARS + 10);
  t("long message is copied and WhatsApp opened empty", (await openWhatsApp(long, deps)) === "copied" && copied === long && calls[0] === "https://wa.me/");
  calls.length = 0;
  t("copy failure is reported, nothing opened", (await openWhatsApp(long, { open: deps.open, copy: async () => false })) === "failed" && calls.length === 0);

  // wiring
  const hv = readFileSync("src/components/HandoverView.tsx", "utf8");
  const dv = readFileSync("src/components/DischargeSummaryView.tsx", "utf8");
  const dlg = readFileSync("src/components/ShareWhatsAppDialog.tsx", "utf8");
  t("handover hides names by default", hv.includes("useState<boolean>(true)") && hv.includes("setWaHideNames"));
  t("handover has both share buttons", hv.includes('data-testid="share-whatsapp-registry"') && hv.includes('data-testid="share-whatsapp-quickpaste"'));
  t("handover share needs a selection", /share-whatsapp-registry"[\s\S]{0,80}disabled=\{selectedRegistryIds\.length === 0\}/.test(hv));
  t("handover marks critical from the real alert logic", hv.includes("computeCriticalAlerts(c).map("));
  t("discharge has the share button and reminder", dv.includes('data-testid="share-whatsapp-discharge"') && dv.includes("Send only to the patient or the treating team"));
  t("dialog shows the reminder, the preview and is labelled", dlg.includes("share-whatsapp-reminder") && dlg.includes("share-whatsapp-preview") && dlg.includes('role="dialog"'));
  t("dialog hidden in print", dlg.includes("no-print"));
  t("no server call, no Firestore, nothing stored", !/firestore|fetch\(|authenticatedFetch|setDoc|localStorage/i.test(dlg + readFileSync("src/utils/whatsappShare.ts", "utf8")));
  console.log(fail ? fail + " FAILED" : "ALL PASS"); process.exit(fail ? 1 : 0);
})();