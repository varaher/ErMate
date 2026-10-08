import React, { useState, useId } from "react";

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
   * - 'sm': 34px (header bar)
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

/**
 * Pure Bundled Vector of the Official ErMate Medical Cross:
 * Glossy 3D ribbon medical cross + white ECG pulse + teal/cyan/blue/purple gradient.
 * Guaranteed 100% runtime availability with zero network dependency.
 */
export const OfficialCrossIcon: React.FC<{
  size?: number;
  className?: string;
  withBackground?: boolean;
}> = ({ size = 34, className = "", withBackground = true }) => {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const bgGradId = `bgGrad_${id}`;
  const crossGrad1Id = `crossGrad1_${id}`;
  const crossGrad2Id = `crossGrad2_${id}`;
  const crossGrad3Id = `crossGrad3_${id}`;
  const glossGradId = `glossGrad_${id}`;
  const ecgGlowId = `ecgGlow_${id}`;
  const shadowId = `shadow_${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label="ErMate Medical Cross"
    >
      <defs>
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>

        <linearGradient id={crossGrad1Id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="40%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        <linearGradient id={crossGrad2Id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>

        <linearGradient id={crossGrad3Id} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#c026d3" />
        </linearGradient>

        <linearGradient id={glossGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <filter id={ecgGlowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#ffffff" floodOpacity="0.7" />
        </filter>

        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#0284c7" floodOpacity="0.25" />
        </filter>
      </defs>

      {withBackground && (
        <rect
          x="16"
          y="16"
          width="480"
          height="480"
          rx="112"
          fill={`url(#${bgGradId})`}
          filter={`url(#${shadowId})`}
        />
      )}

      <g transform="translate(0, 16)">
        {/* Ribbon Fold: Left Arm */}
        <path
          d="M 120 180 C 120 156, 140 136, 164 136 L 206 136 L 206 180 C 206 202, 188 220, 166 220 L 120 220 Z"
          fill={`url(#${crossGrad1Id})`}
        />

        {/* Ribbon Fold: Top Arm */}
        <path
          d="M 206 136 L 206 94 C 206 70, 226 50, 250 50 C 274 50, 294 70, 294 94 L 294 180 C 294 202, 276 220, 254 220 L 206 220 Z"
          fill={`url(#${crossGrad1Id})`}
        />

        {/* Ribbon Fold: Center & Right */}
        <path
          d="M 294 136 L 336 136 C 360 136, 380 156, 380 180 C 380 204, 360 224, 336 224 L 294 224 L 294 280 C 294 302, 276 320, 254 320 L 206 320 L 206 260 C 206 238, 224 220, 246 220 L 294 220 Z"
          fill={`url(#${crossGrad2Id})`}
        />

        {/* Ribbon Fold: Bottom Arm & Violet Curve */}
        <path
          d="M 206 280 L 206 336 C 206 360, 226 380, 250 380 C 274 380, 294 360, 294 336 L 294 280 Z"
          fill={`url(#${crossGrad3Id})`}
        />

        {/* Full Unified Smooth Cross Silhouette with Ribbon Folds */}
        <path
          d="
            M 210 70 C 210 50, 226 36, 256 36 C 286 36, 302 50, 302 70 L 302 144
            L 376 144 C 396 144, 410 160, 410 190 C 410 220, 396 236, 376 236 L 302 236
            L 302 310 C 302 330, 286 344, 256 344 C 226 344, 210 330, 210 310 L 210 236
            L 136 236 C 116 236, 102 220, 102 190 C 102 160, 116 144, 136 144 L 210 144 Z
          "
          fill={`url(#${crossGrad2Id})`}
          opacity="0.95"
        />

        {/* Dynamic 3D Ribbon Shading */}
        <path
          d="
            M 210 144 C 240 144, 270 170, 270 200 C 270 230, 240 260, 210 260
            L 210 310 C 210 330, 226 344, 256 344 C 286 344, 302 330, 302 310
            L 302 236 L 376 236 C 396 236, 410 220, 410 190
            C 410 160, 396 144, 376 144 L 302 144
            C 270 144, 240 120, 240 90 L 240 70
            C 240 50, 226 36, 256 36
          "
          fill={`url(#${crossGrad3Id})`}
          opacity="0.88"
        />

        {/* Gloss Highlight Overlay */}
        <path
          d="
            M 210 70 C 210 50, 226 36, 256 36 C 270 36, 280 40, 286 48
            C 256 56, 230 84, 230 120 L 230 160
            L 150 160 C 130 160, 116 170, 108 184
            C 104 176, 102 168, 102 160 C 102 140, 116 144, 136 144 L 210 144 Z
          "
          fill={`url(#${glossGradId})`}
        />

        {/* Pure Crisp White ECG Heartbeat Pulse Line */}
        <path
          d="
            M 92 190
            L 190 190
            L 215 190
            L 230 215
            L 256 95
            L 282 255
            L 302 170
            L 322 190
            L 420 190
          "
          fill="none"
          stroke="#ffffff"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${ecgGlowId})`}
        />
      </g>
    </svg>
  );
};

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
  const baseUrl = (typeof import.meta !== "undefined" && (import.meta as any).env?.BASE_URL) || "/";
  const iconSrc = `${baseUrl.replace(/\/$/, "")}/icon-192.png?v=3`;
  const logoSrc = `${baseUrl.replace(/\/$/, "")}/logo.png?v=3`;

  if (variant === "icon") {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs ${className}`}
        style={{ width: px, height: px }}
      >
        {!imageError ? (
          <img
            src={iconSrc}
            alt={altText}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain rounded-xl hover:scale-105 transition-transform"
          />
        ) : (
          <OfficialCrossIcon size={px} withBackground={true} />
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
              src={logoSrc}
              alt={altText}
              onError={() => setImageError(true)}
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <OfficialCrossIcon size={px - 8} withBackground={false} />
          )}
        </div>
        <div className="mt-2">
          <span className="text-xl md:text-2xl font-black font-display tracking-tight text-slate-900 dark:text-white">
            ErMate
          </span>
          {showSubtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wider mt-0.5">
              {subtitleText}
            </p>
          )}
        </div>
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
            src={iconSrc}
            alt={altText}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain rounded-lg p-0.5"
          />
        ) : (
          <OfficialCrossIcon size={px} withBackground={false} />
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
