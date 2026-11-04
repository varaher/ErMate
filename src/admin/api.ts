import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = getApps().length === 0 ? initializeApp(firebaseConfig as any) : getApp();
export const adminAuthClient = getAuth(app);

export class ApiError extends Error {
  status: number; code?: string; data?: any;
  constructor(message: string, status: number, code?: string, data?: any) { super(message); this.status = status; this.code = code; this.data = data; }
}

/** Calls /api/admin/* (or any API path) with the signed-in admin's Firebase ID token. */
export async function api<T = any>(path: string, init?: { method?: string; body?: any }): Promise<T> {
  const user = adminAuthClient.currentUser;
  if (!user) throw new ApiError("Please sign in.", 401);
  const token = await user.getIdToken();
  const res = await fetch(path.startsWith("/api/") ? path : `/api/admin${path}`, {
    method: init?.method || (init?.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code, data);
  return data as T;
}

const IST = "Asia/Kolkata";
export const inr = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—"
  : "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: Math.abs(n) < 100 && n % 1 !== 0 ? 2 : 0, maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
export const count = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-IN"));
export const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" }) : "—");
export const dateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
export function ago(iso?: string | null): string {
  if (!iso) return "Never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 90) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 2) return "Yesterday";
  if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
  return day(iso);
}
export function place(u: { place?: string; district?: string; state?: string }): string {
  const parts = [u.place || u.district, u.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "Not given";
}

/** Keys are route paths without the leading "/api/" (display labels only; the portal never calls these routes). */
const FEATURE_LABELS: Record<string, string> = {
  "voice/stream": "Live dictation",
  "sarvam/batch-transcribe": "Batch transcription",
  "sarvam/transcribe": "Transcription",
  "sarvam-asr": "Transcription (legacy)",
  "voice/transcribe": "Transcription",
  "voice/extract-clinical": "Voice extraction",
  "voice-dictation": "Voice dictation",
  "scribe-chat": "Scribe dictation turn",
  "scribe-extract": "Scribe extraction",
  "scribe-ocr-scan": "Scribe OCR scan",
  "ai-discharge": "Discharge draft",
  "discharge-summary": "Discharge summary",
  "discharge-summary/generate": "Discharge summary",
  "em-reference": "EM Reference (Q&A)",
  "case-discussion": "Case discussion",
  "differentials": "Differentials",
  "clinical-decision-support": "Decision support",
  "interpret-abg": "ABG interpretation",
  "lens-report": "Lens report",
  "document-scan": "Document scan",
  "mlc-extract": "MLC extraction",
  "handover/parse-structured": "Handover parsing",
  "handover/compile-sheet": "Handover sheet",
  "handover-chat": "Handover chat",
  "mortality-audit/generate": "Mortality audit",
  "rounds-debrief": "Rounds debrief",
  "parse-rota": "Rota parsing",
  "scan-mnemonic": "Mnemonic scan",
  "mate/interpret": "MATE assistant",
  "learning/extract-rules": "Learning rules (admin)",
  "background": "Background (no request)",
};
export const featureLabel = (f: string) => FEATURE_LABELS[f.replace(/^\/api\//, "")] || f;

const PROVIDER_LABELS: Record<string, string> = { anthropic: "Claude (Anthropic)", openai: "OpenAI", sarvam: "Sarvam (speech)", google: "Google Gemini" };
export const providerLabel = (p: string) => PROVIDER_LABELS[p] || p;
export const PROVIDER_COLORS: Record<string, string> = { anthropic: "#5B21B6", sarvam: "#047857", openai: "#8B5CF6", google: "#34A37A" };

/** Section links are real URLs (/admin/users …) so each section can be bookmarked or shared. */
export function go(path: string) {
  const url = path ? `/admin/${path}` : "/admin";
  if (window.location.pathname !== url) window.history.pushState({}, "", url);
  window.dispatchEvent(new Event("admin:navigate"));
  window.scrollTo(0, 0);
}

/** Download rows as a CSV file. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: any) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [header, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}