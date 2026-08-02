import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { SaveStatus } from '../hooks/useCaseSheetSave';

interface SaveStatusPillProps {
  status: SaveStatus;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function SavingPill() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 animate-pulse">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-400" />
      <span>Saving to Case Sheet...</span>
    </div>
  );
}

export function SavedCheckmark() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-all duration-300">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      <span>Saved to Case Sheet</span>
    </div>
  );
}

export function ErrorPill({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
      <span className="max-w-[180px] truncate">{message || 'Save failed'}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors shadow-sm"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}

export function SaveStatusPill({ status, errorMessage, onRetry, className = '' }: SaveStatusPillProps) {
  if (status === 'idle') return null;

  return (
    <div className={`transition-all duration-200 ${className}`}>
      {status === 'saving' && <SavingPill />}
      {status === 'saved' && <SavedCheckmark />}
      {status === 'error' && <ErrorPill message={errorMessage} onRetry={onRetry} />}
    </div>
  );
}

export default SaveStatusPill;
