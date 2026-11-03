/**
 * Share a discharge summary or a handover through the DOCTOR'S OWN WhatsApp.
 * Pure helpers: no Firebase, no network. ErMate sends nothing itself and stores nothing about the share.
 * WhatsApp bold is *text*.
 */

export interface HandoverShareRow {
  bed?: string | null;
  /** Left out when the doctor hides identity. */
  name?: string;
  ageSex?: string;
  headline?: string;
  vitals?: string;
  /** e.g. "Hypotension (SBP 72 mmHg)". Shown with a CRITICAL tag. */
  critical?: string[];
  given?: string[];
  plan?: string;
}

export interface HandoverShareOptions {
  hospital?: string;
  clinician?: string;
  hideNames: boolean;
  when?: Date;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const clip = (s: string | undefined | null, n: number): string => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

const stamp = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hh}:${mm}`;
};

export function formatHandoverWhatsApp(rows: HandoverShareRow[], opts: HandoverShareOptions): string {
  const out: string[] = [];
  const head = ["*HANDOVER*", clip(opts.hospital, 60), stamp(opts.when || new Date())].filter(Boolean).join(" · ");
  out.push(head);
  if (opts.clinician) out.push(`From: ${clip(opts.clinician, 60)}`);
  out.push(`${rows.length} patient${rows.length === 1 ? "" : "s"}`);

  rows.forEach((r) => {
    out.push("");
    const title = [
      `*${r.bed ? `Bed ${String(r.bed).replace(/^bed\s*/i, "")}` : "Bed not set"}*`,
      clip(r.ageSex, 20),
      opts.hideNames ? "" : clip(r.name, 60),
    ].filter(Boolean).join(" · ");
    out.push(title);
    if (r.critical && r.critical.length) out.push(`*CRITICAL:* ${r.critical.map((c) => clip(c, 60)).join("; ")}`);
    if (r.headline) out.push(clip(r.headline, 160));
    if (r.vitals) out.push(`Vitals: ${clip(r.vitals, 100)}`);
    if (r.given && r.given.length) out.push(`Given: ${clip(r.given.join(", "), 160)}`);
    if (r.plan) out.push(`Plan: ${clip(r.plan, 200)}`);
  });

  out.push("");
  out.push("Confidential. For the receiving team only.");
  return out.join("\n");
}

/** The discharge card text, with the card's **bold** markers turned into WhatsApp *bold*. */
export function dischargeToWhatsApp(text: string): string {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Longest message we put in the link. Longer ones are copied to the clipboard instead. */
export const MAX_LINK_CHARS = 5500;

export const buildWhatsAppUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

export interface ShareDeps {
  open: (url: string) => void;
  copy: (text: string) => Promise<boolean>;
}

const defaultDeps = (): ShareDeps => ({
  open: (url) => { try { window.open(url, "_blank", "noopener,noreferrer"); } catch { /* ignore */ } },
  copy: async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  },
});

/**
 * Opens WhatsApp with the message ready. A very long message cannot travel in a link, so it is copied
 * and WhatsApp is opened empty: the doctor pastes it. Returns what happened so the dialog can say so.
 */
export async function openWhatsApp(text: string, deps: ShareDeps = defaultDeps()): Promise<"link" | "copied" | "failed"> {
  const url = buildWhatsAppUrl(text);
  if (text.length <= MAX_LINK_CHARS && url.length <= 7500) {
    deps.open(url);
    return "link";
  }
  const ok = await deps.copy(text);
  if (!ok) return "failed";
  deps.open("https://wa.me/");
  return "copied";
}