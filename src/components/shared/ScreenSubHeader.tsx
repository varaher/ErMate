import React from "react";
import { ArrowLeft } from "lucide-react";

export interface ScreenSubHeaderProps {
  /** Callback fired when user taps the back button */
  onBack: () => void;
  /** Primary title of the screen or sub-view */
  title: React.ReactNode;
  /** Optional secondary subtitle or clinical context (e.g., patient identifier) */
  subtitle?: React.ReactNode;
  /** Optional badge or status tag placed next to title */
  badge?: React.ReactNode;
  /** Accessible label for the back button (defaults to "Go back") */
  backAriaLabel?: string;
  /** Optional back button text label (e.g., "Back" or "Cases") */
  backLabel?: string;
  /** Optional screen-specific actions aligned to the right */
  actions?: React.ReactNode;
  /** Optional extra classes */
  className?: string;
}

/**
 * ScreenSubHeader
 * 
 * Sits immediately below the sticky Global App Header.
 * Guarantees a persistent, accessible, high-contrast Back navigation control
 * with minimum 44px touch targets on mobile viewports.
 * Uses ErMate semantic design tokens and respects safe areas.
 */
export const ScreenSubHeader: React.FC<ScreenSubHeaderProps> = ({
  onBack,
  title,
  subtitle,
  badge,
  backAriaLabel = "Go back",
  backLabel = "Back",
  actions,
  className = "",
}) => {
  return (
    <div
      className={`sticky top-[var(--ermate-header-height,52px)] z-30 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-2xs no-print ${className}`}
      role="region"
      aria-label="Screen Navigation"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 min-h-[48px]">
        {/* Left: Back button + Title/Context */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            aria-label={backAriaLabel}
            className="min-w-[44px] min-h-[44px] -ml-1 sm:ml-0 px-2.5 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-900 active:scale-95 transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer select-none shrink-0"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 shrink-0" />
            <span className="hidden xs:inline">{backLabel}</span>
          </button>

          <div className="h-5 w-px bg-slate-200 dark:border-slate-800 shrink-0 hidden xs:block" />

          {/* Title + Subtitle / Badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate tracking-tight font-display">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Screen Actions */}
        {actions && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenSubHeader;
