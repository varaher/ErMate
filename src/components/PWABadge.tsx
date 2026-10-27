/// <reference types="vite-plugin-pwa/react" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { ErMateLogo } from './shared/ErMateLogo';
import { getBlockingReasonsDeep } from '../utils/hardRefresh';

/**
 * App update flow (installed PWA + browser).
 *
 *  1. CHECK   - ask the browser for a newer service worker when the app returns to the foreground,
 *               when the network comes back, and every 20 minutes while open.
 *  2. INSTALL - the new version downloads quietly; the old screen keeps working (registerType "prompt").
 *  3. APPLY   - the new version is applied automatically ONLY when it cannot disturb clinical work:
 *               no recording/transcription, no unsaved or in-flight save, all Firestore writes acknowledged,
 *               AND the app is either in the background or was just opened (first 60 s).
 *               Otherwise the "Update Available" card is shown and the doctor chooses when.
 */

const UPDATE_CHECK_MS = 20 * 60 * 1000;
const MIN_GAP_BETWEEN_CHECKS_MS = 60 * 1000;
const AUTO_APPLY_RETRY_MS = 15 * 1000;
const JUST_OPENED_WINDOW_MS = 60 * 1000;

export default function PWABadge() {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const lastCheckRef = useRef(0);
  const [blockedNote, setBlockedNote] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration;
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  const checkForUpdate = useCallback(() => {
    const reg = registrationRef.current;
    if (!reg) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const now = Date.now();
    if (now - lastCheckRef.current < MIN_GAP_BETWEEN_CHECKS_MS) return;
    lastCheckRef.current = now;
    reg.update().catch(() => {
      /* offline or transient: the next trigger will retry */
    });
  }, []);

  // 1. CHECK triggers
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    const onOnline = () => checkForUpdate();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onOnline);
    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_MS);
    // First check shortly after launch (registration may not be ready instantly).
    const first = window.setTimeout(checkForUpdate, 3000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onOnline);
      window.clearInterval(interval);
      window.clearTimeout(first);
    };
  }, [checkForUpdate]);

  // 3. APPLY automatically when it is safe
  useEffect(() => {
    if (!needRefresh) return;
    let cancelled = false;
    let timer: number | undefined;

    const tryApply = async () => {
      if (cancelled) return;
      let safe = false;
      try {
        const reasons = await getBlockingReasonsDeep();
        const quietMoment = document.hidden || performance.now() < JUST_OPENED_WINDOW_MS;
        safe = reasons.length === 0 && quietMoment;
      } catch {
        safe = false;
      }
      if (cancelled) return;
      if (safe) {
        setApplying(true);
        try {
          await updateServiceWorker(true);
        } catch {
          setApplying(false);
        }
        return;
      }
      timer = window.setTimeout(tryApply, AUTO_APPLY_RETRY_MS);
    };

    const onHidden = () => {
      if (document.hidden) {
        if (timer) window.clearTimeout(timer);
        void tryApply();
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    void tryApply();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [needRefresh, updateServiceWorker]);

  // Manual "Update Now": same safety checks, but the doctor chose the moment.
  const handleManualUpdate = async () => {
    setBlockedNote(null);
    let reasons: Awaited<ReturnType<typeof getBlockingReasonsDeep>> = [];
    try {
      reasons = await getBlockingReasonsDeep();
    } catch {
      reasons = [{ key: 'check', label: 'Could not confirm that all work is saved.' }];
    }
    if (reasons.length > 0) {
      setBlockedNote(reasons[0].label + ' Please wait, then try again.');
      return;
    }
    setApplying(true);
    try {
      await updateServiceWorker(true);
    } catch {
      setApplying(false);
    }
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5 max-w-[calc(100vw-2rem)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ErMateLogo variant="icon" size="sm" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Update Available</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              A new version of ErMate is ready. It will install automatically when you leave the app.
            </p>
          </div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
      {blockedNote && <p className="text-xs text-amber-600 dark:text-amber-400">{blockedNote}</p>}
      <div className="flex gap-2">
        <button
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          onClick={handleManualUpdate}
          disabled={applying}
        >
          <RefreshCw size={14} className={applying ? 'animate-spin' : ''} />
          <span>{applying ? 'Updating...' : 'Update Now'}</span>
        </button>
      </div>
    </div>
  );
}