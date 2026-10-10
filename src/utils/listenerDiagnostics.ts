/**
 * src/utils/listenerDiagnostics.ts
 *
 * Development-only diagnostics tracking Firestore listener subscriptions
 * and unsubscriptions with stable descriptive names.
 *
 * Guarantees:
 * - Zero production logging overhead.
 * - Zero additional Firestore reads or network requests.
 * - No-op in production builds.
 */

export interface ListenerDiagnosticsRecord {
  subscriptions: number;
  unsubscriptions: number;
  active: number;
}

const isDev = Boolean(
  (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) ||
  (typeof process !== "undefined" && process.env?.NODE_ENV !== "production")
);

export const listenerDiagnostics = {
  counts: {} as Record<string, ListenerDiagnosticsRecord>,

  trackSubscribe(name: string): void {
    if (!isDev) return;
    if (!this.counts[name]) {
      this.counts[name] = { subscriptions: 0, unsubscriptions: 0, active: 0 };
    }
    this.counts[name].subscriptions += 1;
    this.counts[name].active += 1;
    console.log(`[Firestore Listener] Subscribed: "${name}" (active: ${this.counts[name].active})`);
  },

  trackUnsubscribe(name: string): void {
    if (!isDev) return;
    if (!this.counts[name]) {
      this.counts[name] = { subscriptions: 0, unsubscriptions: 0, active: 0 };
    }
    this.counts[name].unsubscriptions += 1;
    this.counts[name].active = Math.max(0, this.counts[name].active - 1);
    console.log(`[Firestore Listener] Unsubscribed: "${name}" (active: ${this.counts[name].active})`);
  },

  getReport(): Record<string, ListenerDiagnosticsRecord> {
    const copy: Record<string, ListenerDiagnosticsRecord> = {};
    for (const [key, val] of Object.entries(this.counts)) {
      const rec = val as ListenerDiagnosticsRecord;
      copy[key] = {
        subscriptions: rec.subscriptions,
        unsubscriptions: rec.unsubscriptions,
        active: rec.active
      };
    }
    return copy;
  },

  reset(): void {
    this.counts = {};
  }
};

// Expose on window object only in development for devtools inspection
if (typeof window !== "undefined" && isDev) {
  (window as any).__listenerDiagnostics = listenerDiagnostics;
}
