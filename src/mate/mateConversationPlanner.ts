/**
 * MATE Conversational Planner — Phase 1 Universal Orchestrator
 *
 * Converts clinician natural language into deterministic operational plans.
 *
 * Invariants:
 * 1. Read & Navigation ONLY in Phase 1: zero ClinicalCase writes or schema mutations.
 * 2. Mixed-content safety: utterances with clinical facts (PMH, meds, vitals)
 *    must NEVER be swallowed as pure navigation actions.
 * 3. Case sheet section navigation & top-level app tabs are cleanly recognized.
 */

export type MateConversationAction =
  | "BED_STATUS"
  | "PATIENT_OPEN"
  | "CASE_SUMMARY"
  | "CASE_SHEET_OPEN"
  | "SECTION_NAVIGATE"
  | "NAVIGATE_TAB"
  | "CASE_COMPLETENESS"
  | "DISCHARGE_PENDING"
  | "EXPLAIN_CASE"
  | "PREVIOUS_PATIENT";

export interface MateConversationPlan {
  actions: MateConversationAction[];
  refersToRecentPatient: boolean;
  mayContainClinicalUpdate: boolean;
  targetSection?: string | null;
  targetTab?: string | null;
}

const PRONOUN_REFERENCE_PATTERNS = [
  /\b(?:open|show|view|summarise|summarize|review|explain)\s+(?:it|him|her|them|this\s+patient|this\s+case|this\s+one)\b/i,
  /\b(?:what\s+about|how\s+about)\s+(?:him|her|them|this\s+patient|this\s+case)\b/i,
  /\b(?:his|her|their)\s+(?:case|casesheet|case\s*sheet|summary|details|file|investigations|treatment|vitals|labs|medications)\b/i,
  /\b(?:what\s+is\s+incomplete|what\s+is\s+pending)\b/i,
];

const CASE_SUMMARY_PATTERNS = [
  /\bsummaris?e\s*(?:him|her|it|them|this\s+patient|this\s+case|the\s+case)?\b/i,
  /\bgive\s+me\s+(?:a\s+)?summary\b/i,
  /\bcase\s+summary\b/i,
  /\bbrief\s+me\s+on\b/i,
  /\btell\s+me\s+about\b/i,
];

const BED_STATUS_PATTERNS = [
  /\bis\s+bed\b/i,
  /\bis\s+[0-9]{1,3}[ab]?\s+occupied\b/i,
  /\bwho\s+is\s+in\s+bed\b/i,
  /\bwho\s+is\s+on\s+bed\b/i,
  /\bwho\s+is\s+in\s+[0-9]{1,3}[ab]?\b/i,
  /\boccupied\b/i,
  /\bvacant\b/i,
  /\bempty\b/i,
  /\bfree\b/i,
];

const PATIENT_OPEN_PATTERNS = [
  /\bopen\s+bed\s*[0-9]{1,3}[ab]?\b/i,
  /\bopen\s+[0-9]{1,3}[ab]\b/i,
  /\bopen\s+patient\b/i,
  /\bopen\s+him\b/i,
  /\bopen\s+her\b/i,
  /\bopen\s+it\b/i,
  /\bgo\s+to\s+bed\b/i,
  /\bswitch\s+to\s+bed\b/i,
  /\bselect\s+bed\b/i,
  /\bopen\s+case\s*(?:[0-9]{9}|c-[0-9]{4,6})\b/i,
];

const CASE_SHEET_OPEN_PATTERNS = [
  /\b(?:open|view|show)\s+(?:bed\s+[0-9]{1,3}[ab]?\s+)?(?:the|his|her|their|this)?\s*case\s*sheet\b/i,
  /\bopen\s+(?:the|his|her|their|this)?\s*case\s*sheet\b/i,
  /\bview\s+(?:the|his|her|their|this)?\s*case\s*sheet\b/i,
  /\bshow\s+(?:the|his|her|their|this)?\s*case\s*sheet\b/i,
  /\bopen\s+case\s*(?:[0-9]{9}|c-[0-9]{4,6})\b/i,
];

const EXPLAIN_CASE_PATTERNS = [
  /\bexplain\s+(?:bed\s+[0-9]{1,3}[ab]?|him|her|it|this\s+patient|this\s+case|the\s+case)\b/i,
  /\buse\s+(?:the\s+)?whole\s+case\s+and\s+explain\b/i,
  /\b(?:i\s+)?don'?t\s+understand\s+(?:this\s+)?(?:case|patient)\b/i,
  /\breview\s+this\s+(?:patient|case)\b/i,
  /\bwhat\s+do\s+you\s+think\s+about\s+this\s+case\b/i,
];

const CASE_COMPLETENESS_PATTERNS = [
  /\b(?:what|which)\s+(?:is|are)?\s*(?:incomplete|pending|missing)\s*(?:in\s+bed\s+[0-9]{1,3}[ab]?|in\s+this\s+case|in\s+case|sections?)?\b/i,
  /\bwhich\s+sections\s+(?:are\s+)?incomplete\b/i,
  /\bcheck\s+completeness\b/i,
  /\bcase\s+completeness\b/i,
];

const DISCHARGE_PENDING_PATTERNS = [
  /\bwhat\s+is\s+pending\s+in\s+(?:the\s+)?discharge(?:\s+summary)?\b/i,
  /\b(?:for|is)\s+discharge.*what\s+is\s+pending\b/i,
  /\bpending\s+(?:in\s+)?discharge\b/i,
  /\bdischarge\s+completeness\b/i,
];

const SECTION_NAVIGATION_PATTERNS: Array<{ pattern: RegExp; section: string }> = [
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:his|her|the)?\s*investigations?\b/i, section: "investigations" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:his|her|the)?\s*labs?\b/i, section: "investigations" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:his|her|the)?\s*treatment\b/i, section: "treatment" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?primary\s*survey\b/i, section: "primary-survey" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?abcde\b/i, section: "primary-survey" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?secondary\s*survey\b/i, section: "secondary-survey" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?(?:sample\s+)?history\b/i, section: "history" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?(?:presenting\s+)?complaints?\b/i, section: "complaints" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?(?:vitals?|trends?|reassessments?)\b/i, section: "trends" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?(?:progress\s+)?notes\b/i, section: "notes" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?disposition\b/i, section: "disposition" },
  { pattern: /\b(?:show|open|view|go\s+to)\s+(?:the\s+)?clinical\s*rounds\b/i, section: "rounds" },
];

const TAB_NAVIGATION_PATTERNS: Array<{ pattern: RegExp; tab: string }> = [
  { pattern: /\b(?:go\s+to|open|show|back\s+to)\s+dashboard\b/i, tab: "dashboard" },
  { pattern: /\b(?:go\s+to|open|show)\s+(?:all\s+)?cases\b/i, tab: "cases" },
  { pattern: /\b(?:go\s+to|open|show)\s+handover\b/i, tab: "handover" },
  { pattern: /\b(?:go\s+to|open|show)\s+tools\b/i, tab: "tools" },
  { pattern: /\b(?:go\s+to|open|show)\s+learn\b/i, tab: "learn" },
  { pattern: /\b(?:go\s+to|open|show)\s+(?:my\s+)?log\s*book\b/i, tab: "logbook" },
  { pattern: /\b(?:go\s+to|open|show)\s+(?:department\s+)?team\b/i, tab: "team" },
  { pattern: /\b(?:go\s+to|open|show)\s+analytics\b/i, tab: "analytics" },
];

const CLINICAL_FACT_INDICATORS = [
  /\bbp\b/i,
  /\bhr\b/i,
  /\bpulse\b/i,
  /\bspo2\b/i,
  /\brr\b/i,
  /\btemp\b/i,
  /\bvitals\b/i,
  /\bgcs\b/i,
  /\bstarted\b/i,
  /\bgiven\b/i,
  /\bmg\b/i,
  /\biv\b/i,
  /\bpain\b/i,
  /\bdrowsy\b/i,
  /\bcomplaining\b/i,
  /\bshortness\s+of\s+breath\b/i,
  /\bsob\b/i,
  /\bvomiting\b/i,
  /\bfever\b/i,
  /\bchest\s+pain\b/i,
  /\bpast\s+medical\s+history\b/i,
  /\bpmh\b/i,
  /\bmedications?\b/i,
  /\ballerg(?:y|ies)\b/i,
  /\bsample\b/i,
  /\bdisposition\b/i,
  /\bdiagnos(?:is|es)\b/i,
  /\binvestigations?\b/i,
  /\btreatments?\b/i,
  /\bnil\b/i,
  /\bnone\b/i,
  /\bnot\s+on\s+medication\b/i,
  /\bhistory\s+of\b/i,
  /\bpresented\s+with\b/i,
];

export function planMateConversation(text: string): MateConversationPlan {
  const trimmed = text.trim();
  const actions: MateConversationAction[] = [];
  let targetSection: string | null = null;
  let targetTab: string | null = null;

  const refersToRecentPatient = PRONOUN_REFERENCE_PATTERNS.some((p) =>
    p.test(trimmed)
  );

  // 1. Bed status
  if (BED_STATUS_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("BED_STATUS");
  }

  // 2. Case Summary
  if (CASE_SUMMARY_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("CASE_SUMMARY");
  }

  // 3. Explain Case (Clinical Rounds)
  if (EXPLAIN_CASE_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("EXPLAIN_CASE");
  }

  // 4. Case Completeness Review
  if (CASE_COMPLETENESS_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("CASE_COMPLETENESS");
  }

  // 5. Discharge Pending Review
  if (DISCHARGE_PENDING_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("DISCHARGE_PENDING");
  }

  // 6. Section Navigation
  for (const s of SECTION_NAVIGATION_PATTERNS) {
    if (s.pattern.test(trimmed)) {
      actions.push("SECTION_NAVIGATE");
      targetSection = s.section;
      break;
    }
  }

  // 7. Top-Level Tab Navigation
  for (const t of TAB_NAVIGATION_PATTERNS) {
    if (t.pattern.test(trimmed)) {
      actions.push("NAVIGATE_TAB");
      targetTab = t.tab;
      break;
    }
  }

  // 8. Open Case Sheet
  if (CASE_SHEET_OPEN_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("CASE_SHEET_OPEN");
  }

  // 9. Open Patient / Bed / Case number
  if (PATIENT_OPEN_PATTERNS.some((p) => p.test(trimmed))) {
    actions.push("PATIENT_OPEN");
  }

  // 10. Previous Patient
  if (/\b(?:previous|last)\s+patient\b/i.test(trimmed)) {
    actions.push("PREVIOUS_PATIENT");
  }

  const isPureSectionNavigation = actions.includes("SECTION_NAVIGATE") && trimmed.split(/\s+/).length <= 5;
  const mayContainClinicalUpdate = isPureSectionNavigation
    ? CLINICAL_FACT_INDICATORS.filter(
        (p) =>
          !p.source.includes("investigation") &&
          !p.source.includes("treatment") &&
          !p.source.includes("disposition")
      ).some((p) => p.test(trimmed))
    : CLINICAL_FACT_INDICATORS.some((p) => p.test(trimmed));

  return {
    actions,
    refersToRecentPatient,
    mayContainClinicalUpdate,
    targetSection,
    targetTab,
  };
}
