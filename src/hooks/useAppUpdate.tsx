import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloading = false;

    // Listen for controllerchange -> reload page when new service worker takes over
    const handleControllerChange = () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check existing registration
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;

      // Force check for updates on load
      registration.update().catch(() => {});

      // Case 1 — App reopened after update (waiting worker already present on load)
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }

      // Case 2 — Update found while app is open
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      });
    } else {
      window.location.reload();
    }
  };

  return { updateAvailable, applyUpdate };
}

export function HeaderUpdateButton({ hasUpdate, onApplyUpdate }: { hasUpdate?: boolean; onApplyUpdate?: () => void }) {
  const { updateAvailable, applyUpdate } = useAppUpdate();

  const isReady = updateAvailable || hasUpdate;

  if (!isReady) return null;

  const handleAction = () => {
    if (onApplyUpdate) {
      onApplyUpdate();
    } else {
      applyUpdate();
    }
  };

  return (
    <button
      type="button"
      onClick={handleAction}
      className="animate-pulse bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 text-white font-extrabold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-500/20 border border-emerald-400/40 transition-all cursor-pointer shrink-0 z-50"
      title="A new ErMate clinical update is ready! Click to reload and apply now."
    >
      <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
      <span>Update Ready</span>
      <Sparkles className="w-3 h-3 text-amber-200" />
    </button>
  );
}
