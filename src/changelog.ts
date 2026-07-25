// ============================================================
// ErMate — Application Version & Changelog
// File: src/changelog.ts
// ============================================================

export interface VersionInfo {
  version: string;
  changes: string[];
  forceUpdate?: boolean;
}

export const CHANGELOG: Record<string, string[]> = {
  "2.7.0": [
    "Voice dictation faster",
    "Handover extraction improved",
    "Normal exam fields auto-fill",
    "Works offline seamlessly",
  ],
  "2.6.0": [
    "Voice dictation is faster",
    "Handover extraction improved",
    "Syncs across all devices",
    "Saves time during handovers",
  ],
  "2.5.0": [
    "Claude AI added as backup",
    "Errors now show friendly messages",
    "Session clears between patients",
    "Faster case sheet updates",
  ],
};

// Current application version — increment on release
export const APP_VERSION = "2.7.0";
