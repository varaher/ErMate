import React, { useEffect, useRef, useState } from "react";
import { RefreshCw, AlertTriangle, WifiOff, Check, ChevronRight } from "lucide-react";
import { runHardRefresh, type HardRefreshOutcome, type HardRefreshPhase } from "../../utils/hardRefresh";
import type { CriticalOpInfo } from "../../utils/criticalOps";
import { APP_VERSION } from "../../changelog";

type UiState =
  | { kind: "idle" }
  | { kind: "busy"; phase: HardRefreshPhase }
  | { kind: "blocked"; reasons: CriticalOpInfo[] }
  | { kind: "offline"; message: string }
  | { kind: "error"; message: string }
  | { kind: "reloading"; message: string };

const PHASE_TEXT: Record<HardRefreshPhase, string> = {
  checking: "Checking your work is saved…",
  updating: "Looking for the latest version…",
  reloading: "Reloading…",
};

/**
 * "Reload latest version" tile for the Settings/More screen.
 * Mobile equivalent of Ctrl+Shift+R: safety checks -> service-worker update -> reload.
 * Never clears auth, patient data, Firestore cache or storage (see utils/hardRefresh.ts).
 */
export function HardRefreshTile({ className = "" }: { className?: string }) {
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const apply = (outcome: HardRefreshOutcome) => {
    if (!mountedRef.current) return;
    switch (outcome.kind) {
      case "blocked":
        setUi({ kind: "blocked", reasons: outcome.reasons });
        break;
      case "offline":
        setUi({ kind: "offline", message: outcome.message });
        break;
      case "error":
        setUi({ kind: "error", message: outcome.message });
        break;
      case "reloading":
        setUi({ kind: "reloading", message: outcome.message });
        break;
    }
  };

  const handleClick = async () => {
    if (ui.kind === "busy" || ui.kind === "reloading") return;
    setUi({ kind: "busy", phase: "checking" });
    try {
      const outcome = await runHardRefresh((phase) => {
        if (mountedRef.current) setUi({ kind: "busy", phase });
      });
      apply(outcome);
    } catch (err: any) {
      if (mountedRef.current) {
        setUi({ kind: "error", message: err?.message || "Failed to reload." });
      }
    }
  };

  const handleResolve = async (reason: CriticalOpInfo) => {
    if (!reason.resolve || resolvingKey) return;
    setResolvingKey(reason.key);
    try {
      await reason.resolve.run();
      if (!mountedRef.current) return;
      setUi({ kind: "busy", phase: "checking" });
      const outcome = await runHardRefresh((phase) => {
        if (mountedRef.current) setUi({ kind: "busy", phase });
      });
      apply(outcome);
    } catch (err: any) {
      if (mountedRef.current) {
        setUi({ kind: "error", message: err?.message || "Could not complete resolution." });
      }
    } finally {
      if (mountedRef.current) {
        setResolvingKey(null);
      }
    }
  };

  if (ui.kind === "busy") {
    return (
      <div
        className={`p-3 bg-slate-50 dark:bg-slate-950 border border-indigo-400/50 dark:border-indigo-600/50 rounded-xl text-left transition-all flex items-center justify-between ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
          <div>
            <strong className="text-xs font-bold text-slate-900 dark:text-white block">
              {PHASE_TEXT[ui.phase]}
            </strong>
            <span className="text-[10px] text-slate-400 font-mono">Please wait…</span>
          </div>
        </div>
      </div>
    );
  }

  if (ui.kind === "reloading") {
    return (
      <div
        className={`p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-left transition-all flex items-center justify-between ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <strong className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
              {ui.message}
            </strong>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
              Reloading ErMate…
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (ui.kind === "offline") {
    return (
      <div
        className={`p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-left transition-all ${className}`}
      >
        <div className="flex items-start gap-2.5">
          <WifiOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <strong className="text-xs font-bold text-slate-900 dark:text-white block">
              Offline
            </strong>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              {ui.message}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClick}
                className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setUi({ kind: "idle" })}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ui.kind === "error") {
    return (
      <div
        className={`p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60 rounded-xl text-left transition-all ${className}`}
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <strong className="text-xs font-bold text-rose-900 dark:text-rose-200 block">
              Refresh Failed
            </strong>
            <p className="text-[11px] text-rose-800 dark:text-rose-300/90 mt-0.5 leading-snug">
              {ui.message}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClick}
                className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setUi({ kind: "idle" })}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ui.kind === "blocked") {
    return (
      <div
        className={`p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-xl text-left transition-all ${className}`}
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <strong className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
              Cannot reload right now
            </strong>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5 leading-snug">
              Save or finish the following items before reloading:
            </p>
            <ul className="mt-2 space-y-1.5">
              {ui.reasons.map((r) => (
                <li
                  key={r.key}
                  className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2 bg-white/70 dark:bg-slate-900/60 p-1.5 rounded-lg border border-amber-200 dark:border-amber-900/40"
                >
                  <span className="truncate">{r.label}</span>
                  {r.resolve && (
                    <button
                      type="button"
                      disabled={resolvingKey === r.key}
                      onClick={() => handleResolve(r)}
                      className="px-2 py-0.5 text-[10px] font-bold bg-amber-600 text-white hover:bg-amber-700 rounded transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {resolvingKey === r.key ? "Saving…" : r.resolve.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClick}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors cursor-pointer"
              >
                Check again
              </button>
              <button
                type="button"
                onClick={() => setUi({ kind: "idle" })}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-between ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <RefreshCw className="w-4 h-4 text-emerald-500 shrink-0" />
        <div>
          <strong className="text-xs font-bold text-slate-900 dark:text-white block">
            Reload latest version
          </strong>
          <span className="text-[10px] text-slate-400 font-mono">
            ErMate v{APP_VERSION} • Tap to refresh
          </span>
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
    </button>
  );
}
