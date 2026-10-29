import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateProtocolFlag, underDailyFlagLimit, FLAG_LIMITS } from "./src/lib/protocolFlag";
import ProtocolsPanel from "./src/components/ProtocolsPanel";
import ProtocolFlagDialog from "./src/components/ProtocolFlagDialog";
import { readFileSync } from "fs";
let failures = 0;
const check = (c: boolean, m: string) => { if (c) console.log("PASS:", m); else { console.error("FAIL:", m); failures++; } };

const good = { topicId: "dyspnea-adult", topicVersion: "0.1", stepKey: "dyspnea-adult:0:3", stepLabel: "Anaphylaxis", reason: "dose", comment: "Check route" };
const v = validateProtocolFlag(good);
check(v.ok && v.value?.reason === "dose" && v.value?.stepKey === "dyspnea-adult:0:3", "valid step flag accepted");
check(validateProtocolFlag({ ...good, stepKey: "" }).ok, "whole-protocol flag (no step) accepted");
check(!validateProtocolFlag({ ...good, reason: "hack" }).ok, "unknown reason rejected");
check(!validateProtocolFlag({ ...good, reason: undefined }).ok, "missing reason rejected");
check(!validateProtocolFlag({ ...good, topicId: "../../etc" }).ok, "bad topic id rejected");
check(!validateProtocolFlag({ ...good, stepKey: "x; drop" }).ok, "bad step key rejected");
check(!validateProtocolFlag(null).ok && !validateProtocolFlag("x").ok, "non-object rejected");
const long = validateProtocolFlag({ ...good, comment: "a".repeat(5000) });
check(long.value!.comment.length === FLAG_LIMITS.maxComment, "comment capped at 1000");
const ctl = validateProtocolFlag({ ...good, comment: "line1\n\u0000line2\t  x" });
check(ctl.value!.comment === "line1 line2 x", "control characters stripped");
const now = Date.now();
check(underDailyFlagLimit(Array(19).fill(now), now) && !underDailyFlagLimit(Array(20).fill(now), now), "limit: 19 ok, 20 blocked");
check(underDailyFlagLimit(Array(50).fill(now - 25 * 3600 * 1000), now), "flags older than 24h do not count");

// UI renders
const html = renderToStaticMarkup(React.createElement(ProtocolsPanel));
check((html.match(/data-testid="protocol-flag-step"/g) || []).length > 20, "every step has a Flag button");
check(html.includes('data-testid="protocol-flag-topic"'), "protocol-level flag button present");
check(html.includes("Primary survey and triage") || html.includes("Airway"), "protocol text still rendered");
check(html.includes('data-testid="protocol-chips"') && html.includes('data-testid="protocol-investigations-box"'), "step 1 features still present");
const dlg = renderToStaticMarkup(React.createElement(ProtocolFlagDialog, { target: { topicId: "dyspnea-adult", topicTitle: "Dyspnea (Adult)", topicVersion: "0.1", stepKey: "dyspnea-adult:0:3", stepLabel: "Anaphylaxis" }, onClose: () => {} }));
check(dlg.includes("Flag a concern") && dlg.includes("Dose looks wrong") && dlg.includes("Send to reviewers") && dlg.includes("does not change the protocol"), "dialog shows reasons and the no-edit promise");
check(dlg.includes("disabled") , "send button disabled until a reason is chosen");

// Server route is wired, protected, and write-only
const server = readFileSync("./server.ts", "utf8");
check(server.includes('app.use("/api/protocol-flags", protocolFlagsRouter)'), "route mounted at /api/protocol-flags");
const route = readFileSync("./server/routes/protocolFlags.routes.ts", "utf8");
check(/router\.post\("\/", requireAuth/.test(route), "POST requires login");
check(!/router\.get\(/.test(route), "no read endpoint: users cannot read others' flags");
check(/collection\("protocolFlags"\)/.test(route), "writes only to the protocolFlags collection");
if (failures) { console.error(failures + " failed"); process.exit(1); }
console.log("\nAll protocol flag checks passed.");