/**
 * Canonical Public Application URL Configuration
 *
 * The official public domain for ErMate is https://ermate.in.
 * Shared external links (such as secure team invitations) must always use this
 * canonical base URL to prevent internal preview, Cloud Run, or localhost origins
 * from leaking into clinician-facing invite links.
 *
 * Can be overridden in deployment via VITE_PUBLIC_APP_URL environment variable.
 */
export function getPublicAppUrl(): string {
  // Safe environment variable check for Vite / browser runtimes
  try {
    const metaEnv = (typeof import.meta !== "undefined" ? (import.meta as any)?.env : undefined);
    if (metaEnv && metaEnv.VITE_PUBLIC_APP_URL) {
      const configured = String(metaEnv.VITE_PUBLIC_APP_URL).trim();
      if (configured) {
        return configured.replace(/\/+$/, "");
      }
    }
  } catch {
    // Fall back to default canonical domain
  }

  // Safe process.env check for Node.js / test environments
  try {
    if (typeof process !== "undefined" && process.env && process.env.VITE_PUBLIC_APP_URL) {
      const configured = String(process.env.VITE_PUBLIC_APP_URL).trim();
      if (configured) {
        return configured.replace(/\/+$/, "");
      }
    }
  } catch {
    // Fall back to default canonical domain
  }

  return "https://ermate.in";
}
