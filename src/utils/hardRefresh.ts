/**
 * hardRefresh.ts — mobile-safe equivalent of Ctrl+Shift+R for the ErMate PWA.
 *
 * What it does (in order):
 *   1. SAFETY CHECK  – refuses to continue while a Sarvam recording/transcription,
 *      unsaved or in-flight case save, attachment read, scribe request or
 *      un-acknowledged Firestore write exists.
 *   2. CONNECTIVITY  – confirms the server is reachable; otherwise reports "offline"
 *      and does NOT reload (a reload offline cannot fetch anything new).
 *   3. UPDATE        – asks the already-registered service worker to check for a new
 *      version (registration.update()) and waits for it to install. This is the
 *      same path the existing "Update Available" badge uses; no second SW is added.
 *   4. ACTIVATE      – if a worker is waiting, re-checks safety, then sends the same
 *      SKIP_WAITING message the existing update flow uses.
 *   5. RELOAD        – re-checks safety one last time, then window.location.reload().
 *
 * What it deliberately does NOT do:
 *   - no localStorage / sessionStorage / IndexedDB writes or clears
 *   - no Cache Storage deletion (the service worker's own activate step prunes
 *     obsolete precache entries; clinical data is never in those caches)
 *   - no sign-out, no Firestore terminate/clearPersistence
 */

import { waitForPendingWrites } from "firebase/firestore";
import { db } from "../firebase";
import { isGlobalVoiceRecordingActive } from "../components/shared/VoiceRecorder";
import { getActiveCriticalOps, type CriticalOpInfo } from "./criticalOps";

export type HardRefreshPhase = "checking" | "updating" | "reloading";

export type HardRefreshOutcome =
  | { kind: "blocked"; reasons: CriticalOpInfo[] }
  | { kind: "offline"; message: string }
  | { kind: "reloading"; updated: boolean; message: string }
  | { kind: "error"; message: string };

const CLOUD_SYNC_WAIT_MS = 4000;
const SERVER_PROBE_MS = 6000;
const SW_UPDATE_CHECK_MS = 10000;
const SW_INSTALL_WAIT_MS = 20000;
const CONTROLLER_CHANGE_WAIT_MS = 4000;

let running = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** Synchronous blockers (cheap; safe to call on every render). */
export function getBlockingReasons(): CriticalOpInfo[] {
  const reasons: CriticalOpInfo[] = [];
  if (isGlobalVoiceRecordingActive()) {
    reasons.push({ key: "voice", label: "A voice recording or transcription is in progress." });
  }
  return reasons.concat(getActiveCriticalOps());
}

/** Full check, including whether Firestore has acknowledged every write. */
export async function getBlockingReasonsDeep(): Promise<CriticalOpInfo[]> {
  const reasons = getBlockingReasons();
  try {
    const synced = await Promise.race([
      waitForPendingWrites(db).then(() => true),
      delay(CLOUD_SYNC_WAIT_MS).then(() => false),
    ]);
    if (!synced) {
      reasons.push({
        key: "cloudSync",
        label: "Some changes have not reached the cloud yet. Wait for the connection, then try again.",
      });
    }
  } catch {
    // If the check itself fails we cannot prove the writes are safe.
    reasons.push({ key: "cloudSync", label: "Could not confirm that all changes are saved to the cloud." });
  }
  return reasons;
}

async function serverReachable(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_PROBE_MS);
  try {
    // Public, tiny endpoint already used by the app's own version check.
    await fetch("/api/version", { cache: "no-store", signal: controller.signal });
    return true; // any HTTP response means the network path works
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function waitForInstalled(worker: ServiceWorker, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      worker.removeEventListener("statechange", onChange);
      resolve();
    }
    function onChange() {
      if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") done();
    }
    worker.addEventListener("statechange", onChange);
  });
}

/** Starts listening NOW (so the event can't be missed); resolve with the result via `result(ms)`. */
function listenForControllerChange(): { result: (ms: number) => Promise<boolean>; stop: () => void } {
  let fired = false;
  const onChange = () => {
    fired = true;
  };
  navigator.serviceWorker.addEventListener("controllerchange", onChange);
  const stop = () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  const result = async (ms: number): Promise<boolean> => {
    const deadline = Date.now() + ms;
    while (!fired && Date.now() < deadline) await delay(100);
    stop();
    return fired;
  };
  return { result, stop };
}

interface SwResult {
  hasServiceWorker: boolean;
  newVersionFound: boolean;
  activatedByUs: boolean;
}

async function updateServiceWorker(): Promise<SwResult> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { hasServiceWorker: false, newVersionFound: false, activatedByUs: false };
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { hasServiceWorker: false, newVersionFound: false, activatedByUs: false };

  // ErMate's generated worker calls skipWaiting()+clientsClaim(), so a new version activates by
  // itself right after install and fires `controllerchange` (the existing useAppUpdate hook then
  // reloads). Listen before checking so that event can never be missed.
  const control = listenForControllerChange();
  try {
    const hadWaiting = Boolean(reg.waiting);
    await withTimeout(reg.update(), SW_UPDATE_CHECK_MS, "Could not check for a new version.");

    const installing = reg.installing;
    if (installing) await waitForInstalled(installing, SW_INSTALL_WAIT_MS);

    const newVersionFound = hadWaiting || Boolean(installing) || Boolean(reg.waiting);
    if (!newVersionFound) {
      control.stop();
      return { hasServiceWorker: true, newVersionFound: false, activatedByUs: false };
    }

    // A worker that is genuinely waiting (not the case for the generated worker, but possible
    // for other builds): only activate it if it is still safe.
    if (reg.waiting) {
      const blockers = await getBlockingReasonsDeep();
      if (blockers.length > 0) {
        control.stop();
        throw new BlockedError(blockers);
      }
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    const changed = await control.result(CONTROLLER_CHANGE_WAIT_MS);
    return { hasServiceWorker: true, newVersionFound: true, activatedByUs: changed };
  } catch (err) {
    control.stop();
    throw err;
  }
}

class BlockedError extends Error {
  reasons: CriticalOpInfo[];
  constructor(reasons: CriticalOpInfo[]) {
    super("blocked");
    this.reasons = reasons;
  }
}

/**
 * Run the full flow. Never throws; always resolves with an outcome the UI can show.
 * `onPhase` lets the UI show "Checking / Updating / Reloading".
 */
export async function runHardRefresh(onPhase?: (p: HardRefreshPhase) => void): Promise<HardRefreshOutcome> {
  if (running) return { kind: "error", message: "A refresh is already in progress." };
  running = true;
  try {
    onPhase?.("checking");
    const blockers = await getBlockingReasonsDeep();
    if (blockers.length > 0) return { kind: "blocked", reasons: blockers };

    if (!(await serverReachable())) {
      return {
        kind: "offline",
        message: "You appear to be offline, so a new version can't be downloaded. Your work is untouched. Try again when connected.",
      };
    }

    onPhase?.("updating");
    let sw: SwResult;
    try {
      sw = await updateServiceWorker();
    } catch (err) {
      if (err instanceof BlockedError) return { kind: "blocked", reasons: err.reasons };
      return {
        kind: "error",
        message: "Couldn't fetch the latest version right now. Your work is untouched. Please try again in a moment.",
      };
    }

    // If our SKIP_WAITING took effect, the existing update hook is already reloading the page.
    if (sw.activatedByUs) {
      onPhase?.("reloading");
      return { kind: "reloading", updated: true, message: "New version found. Reloading…" };
    }

    // Without a service worker (some Safari modes / first visit) re-validate the HTML shell,
    // so the plain reload below fetches fresh asset links instead of a stale HTTP-cached copy.
    if (!sw.hasServiceWorker) {
      try {
        await withTimeout(fetch("/index.html", { cache: "reload" }), SERVER_PROBE_MS, "timeout");
      } catch {
        /* best effort */
      }
    }

    // Last check right before the reload (a recording could have started meanwhile).
    const lastCheck = await getBlockingReasonsDeep();
    if (lastCheck.length > 0) return { kind: "blocked", reasons: lastCheck };

    onPhase?.("reloading");
    // Give the UI one frame to show "Reloading…" before the page goes away.
    setTimeout(() => window.location.reload(), 150);
    return {
      kind: "reloading",
      updated: sw.newVersionFound,
      message: sw.newVersionFound ? "New version found. Reloading…" : "You have the latest version. Reloading…",
    };
  } finally {
    running = false;
  }
}
