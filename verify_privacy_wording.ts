/** Honest privacy wording, accurate policy page, and terms acceptance for every sign-in path. */
import fs from "node:fs";
import { TERMS_VERSION } from "./src/lib/legal.ts";
let pass = 0, fail = 0;
const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const rd = (p: string) => fs.readFileSync(p, "utf8");

const ui = ["src/components/ConsentModal.tsx", "src/components/ProfileSettingsView.tsx", "src/components/MoreView.tsx", "src/components/HandoverView.tsx", "src/components/shared/PitchDeckModal.tsx"].map((p) => [p, rd(p)] as const);
const BANNED: [string, RegExp][] = [
  ["HIPAA claim", /HIPAA/],
  ["'DPDP compliant' claim", /DPDP(?: Act)?(?: 2023)? (?:&[^<"]*)?compliance? ?|DPDP(?: Act)?(?: 2023)? compliant/i],
  ["'Zero PHI leaves' claim", /Zero PHI leaves|Zero-PHI/i],
  ["'Local AES' claim", /Local AES/i],
  ["'Zero-PHI' claim", /Zero-PHI/i],
  ["'never shared externally'", /Never shared externally/i],
  ["'Fully anonymised'", /Fully anonymised/i],
  ["'identity is never stored'", /identity is never stored/i],
  ["fixed '15 minutes' claim", /saved 15 minutes/i],
  ["'End-to-end encrypted locally'", /End-to-end encrypted locally/i],
  ["fake support phone", /98765 43210/],
  ["wrong support domain", /ermate\.app/],
];
for (const [name, re] of BANNED) t(`no ${name} in the app screens`, ui.every(([, s]) => !re.test(s)));

const priv = rd("public/privacy.html");
t("policy names OpenAI and Anthropic and Sarvam", /OpenAI/.test(priv) && /Anthropic/.test(priv) && /Sarvam/.test(priv));
t("policy says audio goes to Sarvam unmasked", /sent as recorded to Sarvam/.test(priv) && /not masked/.test(priv));
t("policy says de-identification is not a guarantee and models may be outside India", /cannot guarantee/.test(priv) && /outside India/.test(priv));
t("policy has a grievance route and the Board", /Privacy grievance/.test(priv) && /Data Protection Board/.test(priv));
t("policy, terms and refund pages carry the current TERMS_VERSION", ["public/privacy.html", "public/terms.html", "public/refund.html"].every((p) => rd(p).includes(`Version ${TERMS_VERSION}`)));
t("terms version was bumped so everyone re-accepts", TERMS_VERSION === "2026-11-27");

const login = rd("src/components/MockLoginView.tsx");
t("sign-in (Google and email) asks for terms when the account has not accepted the current version", /profile\.termsVersion !== TERMS_VERSION/.test(login) && /<TermsGate/.test(login));
t("accepting saves termsAcceptedAt + termsVersion; declining signs out", /termsAcceptedAt: new Date\(\)\.toISOString\(\)/.test(login) && /updateDoc\(doc\(db, "users", user\.uid\), stamp\)/.test(login) && /declineTerms[\s\S]{0,120}signOut\(auth\)/.test(login));
const gate = rd("src/components/TermsGate.tsx");
t("accept button is disabled until the box is ticked", /disabled=\{!checked \|\| busy\}/.test(gate) && /terms-gate-check/.test(gate));
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);