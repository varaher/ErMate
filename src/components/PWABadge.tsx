/// <reference types="vite-plugin-pwa/react" />
import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export default function PWABadge() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Update Available</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">A new version of ErMate is ready.</p>
        </div>
        <button 
          onClick={() => setNeedRefresh(false)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          onClick={() => updateServiceWorker(true)}
        >
          <RefreshCw size={14} />
          <span>Update Now</span>
        </button>
      </div>
    </div>
  );
}
