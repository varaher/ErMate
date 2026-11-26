/**
 * Shares the doctor's Free / Pro access with every screen, and opens the one Pro upgrade sheet.
 * App.tsx publishes the result of computeAccess(); screens read it with useAccess() / useProGate().
 *
 * Fail-open for care: until App publishes, everyone is treated as Pro (a missing wire never locks a doctor out).
 * Patient safety: gates protect STARTING new Pro work. Patients already in care are never closed by a lapse.
 */
import { useEffect, useState } from "react";
import type { AccessResult, ProFeature } from "./access";
import { canUseFeature } from "./access";

export type AccessView = Pick<AccessResult, "state" | "isPro" | "daysLeft">;

const FAIL_OPEN: AccessView = { state: "trial", isPro: true, daysLeft: 0 };
let current: AccessView = FAIL_OPEN;
const accessListeners = new Set<(a: AccessView) => void>();
const upgradeListeners = new Set<(f: ProFeature) => void>();

export function publishAccess(a: AccessView): void {
  if (a.state === current.state && a.isPro === current.isPro && a.daysLeft === current.daysLeft) return;
  current = { state: a.state, isPro: a.isPro, daysLeft: a.daysLeft };
  accessListeners.forEach((l) => l(current));
}

export function getAccess(): AccessView {
  return current;
}

/** Test hook. */
export function resetAccessForTests(): void {
  current = FAIL_OPEN;
}

export function useAccess(): AccessView {
  const [a, setA] = useState<AccessView>(current);
  useEffect(() => {
    accessListeners.add(setA);
    setA(current);
    return () => { accessListeners.delete(setA); };
  }, []);
  return a;
}

/** Opens the upgrade sheet (rendered once by ProUpgradeHost in App). */
export function requestProUpgrade(feature: ProFeature): void {
  upgradeListeners.forEach((l) => l(feature));
}

export function onProUpgradeRequest(l: (f: ProFeature) => void): () => void {
  upgradeListeners.add(l);
  return () => { upgradeListeners.delete(l); };
}

/** True when the feature may be used now; otherwise opens the upgrade sheet and returns false. */
export function guardPro(feature: ProFeature, a: AccessView = current): boolean {
  if (canUseFeature(a, feature)) return true;
  // No upgrade sheet on screen (e.g. App not wired yet): fail open rather than a button that silently does nothing.
  if (upgradeListeners.size === 0) return true;
  requestProUpgrade(feature);
  return false;
}

/** Hook for screens: `allowed` for rendering, `guard(feature, fn)` wraps a "start new Pro work" action. */
export function useProGate(feature: ProFeature) {
  const a = useAccess();
  const allowed = canUseFeature(a, feature);
  const guard = <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => {
    if (guardPro(feature, a)) fn(...args);
  };
  return { allowed, guard, access: a };
}

/**
 * Handover continuity: a lapsed doctor can still open Handover to finish one started in the last 24 h.
 * `times` = creation times (ms or ISO) of the doctor's handovers.
 */
export function hasRecentHandover(times: Array<number | string | undefined | null>, now: number = Date.now()): boolean {
  const DAY = 24 * 60 * 60 * 1000;
  return times.some((t) => {
    const ms = typeof t === "number" ? t : typeof t === "string" ? Date.parse(t) : NaN;
    return Number.isFinite(ms) && ms <= now + 60_000 && now - ms < DAY;
  });
}