import fs from "fs";
const s = fs.readFileSync("server.ts", "utf8");
const v = fs.readFileSync("src/components/VoiceScribeChatView.tsx", "utf8");
let f = 0;
const t = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}`); if (!c) f++; };
t("server keeps only the last turns", /\.slice\(-DISCUSSION_HISTORY_MAX_TURNS\)/.test(s) && /DISCUSSION_HISTORY_MAX_TURNS = 14/.test(s));
t("server trims each turn", /slice\(0, DISCUSSION_HISTORY_MAX_CHARS\)/.test(s));
t("client sends the last turns only, once", /\[\.\.\.messages, userMsg\]\.slice\(-14\)/.test(v) && !/history: messages,/.test(v));
process.exit(f ? 1 : 0);