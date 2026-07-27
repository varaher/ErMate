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
  "2.10.0": [
    "Upgraded AI core engine to Gemini 3.6 Flash & 3.1 Pro",
    "New structured Emergency Handover Card with real-time alert severity",
    "Preprocessed EMR noise-stripping & chronological reversal for shift handovers",
    "Critical vitals & missed follow-up row highlight on handover cards",
  ],
  "2.9.0": [
    "Enhanced clinical reasoning for complex multi-system cases",
    "SBAR auto-structuring with high-visibility color-coded tags",
    "Improved speech recognition & medical acronym auto-formatting",
    "Real-time sync resilience for low-bandwidth ER environments",
  ],
  "2.8.0": [
    "Redesigned Quick Paste & shift handover transition workflow",
    "Automatic normal physical exam generator for standard reviews",
    "Multi-consultant admitting note breakdown & triage badge colors",
    "Offline caching for case sheets & patient records",
  ],
  "2.7.0": [
    "Voice dictation speed optimizations",
    "Handover extraction accuracy enhancements",
    "Auto-filled normal exam fields",
    "Seamless offline mode improvements",
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
export const APP_VERSION = "2.10.0";
