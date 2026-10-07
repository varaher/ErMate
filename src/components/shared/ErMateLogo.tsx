import React, { useState } from "react";

export interface ErMateLogoProps {
  /**
   * Display variant:
   * - 'full': Displays full logo with medical cross mark + ErMate wordmark
   * - 'icon': Displays the medical cross icon mark only
   * - 'header': Compact header layout with icon mark + responsive text
   */
  variant?: "full" | "icon" | "header";
  /**
   * Predefined size presets:
   * - 'xs': 24px (compact indicators)
   * - 'sm': 32px (header bar)
   * - 'md': 48px (cards, forms)
   * - 'lg': 64px (login screens, splash)
   * - 'xl': 96px (hero, about modals)
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  /** Custom pixel dimension or CSS class if size is 'custom' */
  dimension?: number;
  /** Whether to show 'The Scribe Companion for ER' subtitle */
  showSubtitle?: boolean;
  /** Custom subtitle text if overridden */
  subtitleText?: string;
  className?: string;
  altText?: string;
}

export const ErMateLogo: React.FC<ErMateLogoProps> = ({
  variant = "header",
  size = "sm",
  dimension,
  showSubtitle = true,
  subtitleText = "The Scribe Companion for ER",
  className = "",
  altText = "ErMate Clinical AI",
}) => {
  const [imageError, setImageError] = useState(false);

  // Dimension mapping
  const sizeMap = {
    xs: 24,
    sm: 34,
    md: 48,
    lg: 64,
    xl: 96,
    custom: dimension || 40,
  };

  const px = sizeMap[size];

  if (variant === "icon") {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs ${className}`}
        style={{ width: px, height: px }}
      >
        {!imageError ? (
          <img
            src="/icon-192.png"
            alt={altText}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain rounded-xl hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-xs">
            EM
          </div>
        )}
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className={`flex flex-col items-center justify-center text-center ${className}`}>
        <div
          className="relative inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-md bg-white p-1"
          style={{ width: px, height: px }}
        >
          {!imageError ? (
            <img
              src="/logo.png"
              alt={altText}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center text-white font-black">
              ErMate
            </div>
          )}
        </div>
        {showSubtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wider mt-2">
            {subtitleText}
          </p>
        )}
      </div>
    );
  }

  // Variant: 'header' (Compact Horizontal Layout)
  return (
    <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
      <div
        className="relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs bg-white/90 dark:bg-slate-900 ring-1 ring-slate-200/60 dark:ring-slate-800"
        style={{ width: px, height: px }}
      >
        {!imageError ? (
          <img
            src="/icon-192.png"
            alt={altText}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain rounded-lg p-0.5"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-xs">
            EM
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="text-sm md:text-base font-black font-display tracking-tight text-slate-900 dark:text-white">
            ErMate
          </span>
        </div>
        {showSubtitle && (
          <p className="text-[9px] md:text-[10px] text-slate-400 font-medium font-mono hidden sm:block leading-tight truncate">
            {subtitleText}
          </p>
        )}
      </div>
    </div>
  );
};

export default ErMateLogo;
