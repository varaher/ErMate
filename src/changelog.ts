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
  "3.0.0": [
    "Hospital self-learning engine & HOD rule approval center",
    "New structured Emergency Handover Card with real-time alert severity",
    "Streamlined shift handover review with chronological patient timeline",
    "Automatic clinical feedback learning from doctor edits",
  ],
  "2.10.0": [
    "Improved handover extraction accuracy and speed",
    "New structured Emergency Handover Card with real-time alert severity",
    "Streamlined shift handover notes and patient timelines",
    "Critical vitals and missed follow-up highlights on handover cards",
  ],
  "2.9.0": [
    "Enhanced clinical summaries for complex multi-system cases",
    "SBAR auto-structuring with high-visibility status tags",
    "Improved speech recognition & medical terminology formatting",
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
    "Automatic backup server support for uninterrupted clinical availability",
    "Errors now show friendly messages",
    "Session clears between patients",
    "Faster case sheet updates",
  ],
};

// Current application version — increment on release
export const APP_VERSION = "3.0.0";

