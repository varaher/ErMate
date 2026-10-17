/**
 * Quick Investigation panels — per-clinician customisation layer over the built-in ORDER_PANELS.
 *
 * Built-in panels keep a stable id (their original name). A clinician can rename a built-in,
 * change its test list, hide it, or add their own panels (to match hospital policy). Nothing here
 * mutates ORDER_PANELS, and "reset" always restores the built-ins.
 */
import { ORDER_PANELS } from "../data/orderPanels";

export type PanelGroup = "adult" | "pediatric";

export interface CustomPanel {
  id: string;
  name: string;
  group: PanelGroup;
  tests: string[];
}

export interface PanelOverride {
  name?: string;
  tests?: string[];
}

export interface QuickPanelPrefs {
  overrides: Record<string, PanelOverride>; // keyed by built-in id
  hidden: string[]; // built-in ids
  custom: CustomPanel[];
}

export interface EffectivePanel {
  id: string;
  name: string;
  group: PanelGroup;
  tests: string[];
  builtIn: boolean;
  modified: boolean; // built-in that the user renamed / re-listed
}

export const MAX_CUSTOM_PANELS = 30;
export const MAX_TESTS_PER_PANEL = 40;
export const MAX_NAME_LEN = 40;
export const MAX_TEST_LEN = 80;

export const EMPTY_PREFS: QuickPanelPrefs = { overrides: {}, hidden: [], custom: [] };

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

/** Split free text (comma / newline / semicolon separated) into a de-duplicated test list. */
export function parseTests(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(text || "").split(/[,;\n]/)) {
    const t = clean(raw).slice(0, MAX_TEST_LEN);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_TESTS_PER_PANEL) break;
  }
  return out;
}

/** Defensive parse of anything read from storage. Never throws; drops malformed entries. */
export function sanitizePrefs(raw: unknown): QuickPanelPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as any;
  const builtInIds = new Set(ORDER_PANELS.map((p) => p.name));

  const overrides: Record<string, PanelOverride> = {};
  if (r.overrides && typeof r.overrides === "object") {
    for (const id of Object.keys(r.overrides)) {
      if (!builtInIds.has(id)) continue;
      const o = r.overrides[id] || {};
      const name = clean(o.name).slice(0, MAX_NAME_LEN);
      const tests = Array.isArray(o.tests) ? parseTests(o.tests.join(",")) : undefined;
      const entry: PanelOverride = {};
      if (name) entry.name = name;
      if (tests && tests.length > 0) entry.tests = tests;
      if (entry.name || entry.tests) overrides[id] = entry;
    }
  }

  const hidden = Array.isArray(r.hidden)
    ? Array.from(new Set(r.hidden.filter((x: unknown) => typeof x === "string" && builtInIds.has(x as string)))) as string[]
    : [];

  const custom: CustomPanel[] = [];
  if (Array.isArray(r.custom)) {
    for (const c of r.custom) {
      const name = clean(c?.name).slice(0, MAX_NAME_LEN);
      const tests = Array.isArray(c?.tests) ? parseTests(c.tests.join(",")) : [];
      const id = typeof c?.id === "string" && c.id ? c.id.slice(0, 60) : "";
      if (!name || tests.length === 0 || !id) continue;
      custom.push({ id, name, group: c?.group === "pediatric" ? "pediatric" : "adult", tests });
      if (custom.length >= MAX_CUSTOM_PANELS) break;
    }
  }
  return { overrides, hidden, custom };
}

/** Built-ins (with overrides, minus hidden) followed by custom panels. */
export function getEffectivePanels(prefs: QuickPanelPrefs, opts?: { includeHidden?: boolean }): EffectivePanel[] {
  const hidden = new Set(prefs.hidden);
  const list: EffectivePanel[] = [];
  for (const p of ORDER_PANELS) {
    if (hidden.has(p.name) && !opts?.includeHidden) continue;
    const o = prefs.overrides[p.name];
    list.push({
      id: p.name,
      name: o?.name || p.name,
      group: p.group,
      tests: o?.tests && o.tests.length > 0 ? o.tests : p.tests,
      builtIn: true,
      modified: !!(o?.name || o?.tests),
    });
  }
  for (const c of prefs.custom) {
    list.push({ id: c.id, name: c.name, group: c.group, tests: c.tests, builtIn: false, modified: false });
  }
  return list;
}

/** Panels for the dropdown: the case's own group (adult / paediatric) first, order otherwise stable. */
export function orderForCase(panels: EffectivePanel[], isPediatric: boolean): EffectivePanel[] {
  const want: PanelGroup = isPediatric ? "pediatric" : "adult";
  return [...panels].sort((a, b) => (a.group === want ? 0 : 1) - (b.group === want ? 0 : 1));
}

/** Returns an error message, or null if the name is acceptable. Names must be unique (case-insensitive). */
export function validatePanelName(name: string, existing: EffectivePanel[], ignoreId?: string): string | null {
  const n = clean(name);
  if (!n) return "Give the panel a name.";
  if (n.length > MAX_NAME_LEN) return `Name must be ${MAX_NAME_LEN} characters or fewer.`;
  const clash = existing.some((p) => p.id !== ignoreId && p.name.trim().toLowerCase() === n.toLowerCase());
  if (clash) return "A panel with this name already exists.";
  return null;
}

export function newCustomId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Tests from a panel that are not already on the case. Case-insensitive, so tapping two panels never
 * orders CBC twice (same rule the one-tap order sets always used).
 */
export function testsToAdd(panelTests: string[], alreadyOrdered: string[]): string[] {
  const norm = (x: string) => x.trim().toLowerCase();
  const already = new Set(alreadyOrdered.map(norm));
  return panelTests.filter((t) => !already.has(norm(t)));
}
