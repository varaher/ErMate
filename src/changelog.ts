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
  "3.3.0": [
    "MATE critical alerts: a red value you save (for example BP 72/40) now pops up straight away, and MATE says it aloud if MATE voice is on",
    "A red alert repeats every 15 minutes until a new reading is no longer critical",
    "GCS is added up from E, V and M when all three are recorded",
    "Quick Discharge no longer fills in placeholder vitals or a default GCS of 15",
  ],
  "3.2.0": [
    "ErMate Teams: create your hospital team or join one with an invite link, then share the rota with your colleagues",
    "New Team page: edit your profile, hospital, team and shift timings in one place",
    "Hospital name, place, district and state are now needed in your profile, so colleagues find the same hospital",
    "MATE picks a free bed by itself when you dictate a new case, and you can say 'move this patient to bed 12'",
    "Share handover and discharge summaries to WhatsApp",
    "More roles to choose from: Postgraduate Resident, Nursing In-charge, Paramedic, Other healthcare staff",
  ],
  "3.1.0": [
    "Case sheet now saves reliably: no more false 'NOT SAVED', and edits made offline are kept and sent when you reconnect",
    "Two devices editing the same case no longer overwrite each other's untouched fields",
    "History of Presenting Illness now writes itself from your dictation; Events accepts 'collapsed' and exertional onset",
    "Secondary survey 'Normal' fills only blank systems and never invents a GCS",
  ],
  "3.0.4": [
    "Fixed voice dictation crash due to FFmpeg/node-fetch module conflict",
    "Fixed 'dischargeDraft is not defined' error in Scribe Chat",
    "Restored functional Rounds Debrief AI functionality",
    "Forced update of Android PWA to activate responsive composer fixes",
  ],
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
export const APP_VERSION = "3.3.0";