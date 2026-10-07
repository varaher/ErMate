import React, { useState, useEffect } from "react";
import { RefreshCw, Check, AlertCircle, AlertTriangle } from "lucide-react";
import { isGlobalVoiceRecordingActive, subscribeGlobalVoiceRecording } from "./VoiceRecorder";

export interface GlobalRefreshButtonProps {
  onRefresh: () => Promise<void> | void;
  isDirty?: boolean;
  isVoiceBusy?: boolean;
  onSaveAndRefresh?: () => Promise<void> | void;
  onDiscardAndRefresh?: () => void;
  className?: string;
  compact?: boolean;
}

export const GlobalRefreshButton: React.FC<GlobalRefreshButtonProps> = ({
  onRefresh,
  isDirty = false,
  isVoiceBusy = false,
  onSaveAndRefresh,
  onDiscardAndRefresh,
  className = "",
  compact = true,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "success" | "error" | "recording_warning">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [isAudioRecording, setIsAudioRecording] = useState(false);

  // Subscribe to global recording status
  useEffect(() => {
    setIsAudioRecording(isGlobalVoiceRecordingActive());
    const unsubscribe = subscribeGlobalVoiceRecording((active) => {
      setIsAudioRecording(active);
    });
    return () => unsubscribe();
  }, []);

  const isRecordingOrBusy = isAudioRecording || isVoiceBusy;

  const performRefresh = async () => {
    setIsRefreshing(true);
    setFeedback("idle");
    try {
      // Deterministic 8-second safety timeout so button never spins indefinitely
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Refresh timed out. Please try again.")), 8000)
      );
      await Promise.race([Promise.resolve(onRefresh()), timeoutPromise]);
      setFeedback("success");
      setFeedbackMessage("Updated");
      setTimeout(() => {
        setFeedback("idle");
      }, 2000);
    } catch (err: any) {
      console.error("[GlobalRefreshButton] Refresh failed:", err);
      setFeedback("error");
      setFeedbackMessage(err?.message || "Unable to refresh. Try again.");
      setTimeout(() => {
        setFeedback("idle");
      }, 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClick = () => {
    if (isRecordingOrBusy) {
      setFeedback("recording_warning");
      setFeedbackMessage("Finish current recording/save before refreshing");
      setTimeout(() => {
        setFeedback("idle");
      }, 3500);
      return;
    }

    if (isDirty) {
      setShowUnsavedModal(true);
      return;
    }

    performRefresh();
  };

  const handleSaveAndRefresh = async () => {
    setShowUnsavedModal(false);
    if (onSaveAndRefresh) {
      setIsRefreshing(true);
      try {
        await onSaveAndRefresh();
        await performRefresh();
      } catch (err) {
        console.error("[GlobalRefreshButton] Save before refresh failed:", err);
        setFeedback("error");
        setFeedbackMessage("Unable to save changes. Refresh aborted.");
        setTimeout(() => setFeedback("idle"), 3000);
        setIsRefreshing(false);
      }
    } else {
      performRefresh();
    }
  };

  const handleDiscardAndRefresh = () => {
    setShowUnsavedModal(false);
    if (onDiscardAndRefresh) {
      onDiscardAndRefresh();
    }
    performRefresh();
  };

  const getTooltip = () => {
    if (isRecordingOrBusy) return "Finish current recording/save before refreshing";
    if (isRefreshing) return "Refreshing data...";
    if (feedback === "success") return "Data refreshed";
    if (feedback === "error") return feedbackMessage || "Refresh failed. Try again.";
    if (isDirty) return "Unsaved changes present (click to review)";
    return "Refresh data";
  };

  return (
    <>
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleClick}
          disabled={isRefreshing || isRecordingOrBusy}
          title={getTooltip()}
          aria-label={getTooltip()}
          className={`relative inline-flex items-center justify-center rounded-lg text-xs font-medium transition-all duration-150 border cursor-pointer ${
            compact ? "w-8 h-8 md:w-8.5 md:h-8.5" : "gap-1.5 px-2.5 py-1.5"
          } ${
            isRecordingOrBusy
              ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
              : isRefreshing
              ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60"
              : feedback === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
              : feedback === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60"
              : "bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 border-slate-200 dark:border-slate-750 shadow-xs"
          } ${className}`}
        >
          {feedback === "success" ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-150" />
          ) : feedback === "error" ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 animate-in zoom-in-75 duration-150" />
          ) : (
            <RefreshCw
              className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${
                isRefreshing ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""
              }`}
            />
          )}

          {!compact && (
            <span className="hidden sm:inline">
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </span>
          )}

          {isDirty && !isRecordingOrBusy && feedback === "idle" && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
              title="Unsaved changes present"
            />
          )}
        </button>

        {/* Transient toast/feedback pill */}
        {feedback !== "idle" && (
          <div
            role="status"
            className={`absolute top-full mt-1.5 right-0 z-50 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium shadow-lg border transition-all duration-200 flex items-center gap-1.5 ${
              feedback === "success"
                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : feedback === "recording_warning"
                ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            {feedback === "success" && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            {feedback === "recording_warning" && (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
            {feedback === "error" && (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage}</span>
          </div>
        )}
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-changes-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3
                  id="unsaved-changes-title"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Unsaved Changes Present
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Unsaved changes are present. Save or discard them before refreshing to avoid losing clinical documentation.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscardAndRefresh}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900 transition-colors"
              >
                Discard & Refresh
              </button>
              <button
                type="button"
                onClick={handleSaveAndRefresh}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-xs transition-colors"
              >
                Save & Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalRefreshButton;
