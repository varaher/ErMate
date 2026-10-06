/**
 * ErMate — Deterministic Fast-Path Classifier
 *
 * Checks if clinician utterance can be handled safely without calling
 * the server-side conversational interpreter.
 *
 * Fast path cases:
 * - Simple social greetings / pleasantries (Hi, Hello, Hey, Good morning, Thanks, Thank you, OK)
 * - Patient count questions ("How many patients do I have?", "How many patients in my list?", "patient count")
 * - ER Overview / status queries ("What's happening in my ER?", "How's my list?", "Who all are there?", "Give me a quick overview")
 * - Incomplete cases inquiry ("Which cases are incomplete?", "What cases are pending?")
 * - Occupied beds inquiry ("Which beds are occupied?", "Occupied beds", "List occupied beds")
 * - Exact bed reference single-command without clinical facts ("Open Bed 9", "Bed 9 summary", "Is Bed 10 occupied?")
 * - Exact displayId reference without clinical facts ("Open case 261006004")
 * - Simple app tab navigation ("Go to dashboard", "Show handover", "Open tools")
 * - Simple section navigation on active case ("Show his investigations", "Open treatment")
 *
 * Invariants:
 * 1. ZERO clinical writes in fast path: any utterance with clinical facts (BP, meds, vitals, PMH)
 *    is routed to interpreter or scribe, never handled as a trivial fast-path query.
 * 2. Unambiguous: if there is any doubt or compound instruction with clinical data, returns null.
 */

import type { ClinicalCase } from "../types";
import { computeCensusOrientation, formatErOverviewMessage } from "./mateOrientation";
import { planMateConversation } from "./mateConversationPlanner";
import { extractMateBedReference, resolveMateCaseReference } from "./mateCaseResolver";
import { extractMateDisplayIdReference, resolveMateCaseByDisplayId } from "./mateCaseDisplayResolver";
import { getCasePendingStatus } from "../utils/caseHelper";
import { checkDischargeCompleteness } from "../utils/dischargeCompleteness";

export interface FastPathResult {
  handled: boolean;
  replyText?: string;
  targetCaseId?: string | null;
  targetBed?: string | null;
  targetSection?: string | null;
  targetTab?: string | null;
  action?:
    | "SOCIAL"
    | "ER_OVERVIEW"
    | "COUNT_PATIENTS"
    | "INCOMPLETE_LIST"
    | "OCCUPIED_BEDS"
    | "BED_STATUS"
    | "CASE_SUMMARY"
    | "OPEN_CASE"
    | "OPEN_SECTION"
    | "NAVIGATE_TAB"
    | "CASE_COMPLETENESS"
    | "DISCHARGE_PENDING";
  listedCaseIds?: string[];
}

export function tryDeterministicFastPath(params: {
  utterance: string;
  activeCase?: ClinicalCase | null;
  recentCase?: ClinicalCase | null;
  censusCases: ClinicalCase[];
  physicalCapacity?: number;
}): FastPathResult | null {
  const { utterance, activeCase, recentCase, censusCases, physicalCapacity = 30 } = params;
  const trimmed = (utterance || "").trim();
  if (!trimmed) return null;

  const orientation = computeCensusOrientation(censusCases);

  // 1. Social greetings & acknowledgments
  const isSocial = /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|mate|hi\s+mate|hello\s+mate|hey\s+mate)[!.]?$/i.test(trimmed);
  if (isSocial) {
    return {
      handled: true,
      action: "SOCIAL",
      replyText: "Hi Doctor. I'm ready.",
    };
  }

  const isThanks = /^(?:thanks|thank\s+you|thank\s+you\s+mate|thanks\s+mate|thx|ok|okay|cool)[!.]?$/i.test(trimmed);
  if (isThanks) {
    return {
      handled: true,
      action: "SOCIAL",
      replyText: "Anytime.",
    };
  }

  // 2. Patient Count
  if (
    /^(?:how\s+many\s+patients\s+(?:do\s+i\s+have|are\s+there(?:\s+in\s+my\s+list)?|in\s+my\s+list|in\s+er)|patient\s+count|number\s+of\s+patients)[?.]?$/i.test(trimmed)
  ) {
    const count = orientation.activePatientCount;
    const reply = count === 0
      ? "You currently have 0 active patients in your list."
      : `You currently have **${count} active patient${count > 1 ? "s" : ""}** in your ER list.`;
    return {
      handled: true,
      action: "COUNT_PATIENTS",
      replyText: reply,
    };
  }

  // 3. ER Overview
  if (
    /^(?:what'?s\s+happening\s+in\s+my\s+er|how'?s\s+my\s+list|who\s+all\s+are\s+there|give\s+me\s+a\s+quick\s+overview|er\s+overview|overview|status\s+of\s+er)[?.]?$/i.test(trimmed)
  ) {
    return {
      handled: true,
      action: "ER_OVERVIEW",
      replyText: formatErOverviewMessage(orientation),
    };
  }

  // 4. Incomplete Cases Query
  if (
    /^(?:which\s+cases\s+are\s+incomplete|what\s+cases\s+are\s+pending|show\s+incomplete\s+cases|list\s+incomplete\s+cases)[?.]?$/i.test(trimmed)
  ) {
    const incompleteCases = censusCases.filter((c) => {
      const p = getCasePendingStatus(c);
      return p.isPending && p.pendingCount > 0;
    });

    if (incompleteCases.length === 0) {
      return {
        handled: true,
        action: "INCOMPLETE_LIST",
        replyText: "✓ All active cases have complete clinical documentation.",
      };
    }

    const listedIds: string[] = [];
    const lines = incompleteCases.map((c, i) => {
      listedIds.push(c.id);
      const bed = c.bedNo ? `Bed ${c.bedNo}` : (c.displayId || c.id);
      const pending = getCasePendingStatus(c);
      return `${i + 1}. **${bed}** (${c.patient?.name || "Patient"}, ${c.patient?.age ? c.patient.age + "y" : ""}): Missing ${pending.pendingSections.join(", ")}`;
    });

    return {
      handled: true,
      action: "INCOMPLETE_LIST",
      replyText: `You have **${incompleteCases.length} incomplete case${incompleteCases.length > 1 ? "s" : ""}**:\n${lines.join("\n")}`,
      listedCaseIds: listedIds,
    };
  }

  // 5. Occupied beds query
  if (/^(?:which\s+beds\s+are\s+occupied|occupied\s+beds|list\s+occupied\s+beds)[?.]?$/i.test(trimmed)) {
    if (orientation.occupiedBeds.length === 0) {
      return {
        handled: true,
        action: "OCCUPIED_BEDS",
        replyText: "All ER beds are currently vacant.",
      };
    }
    return {
      handled: true,
      action: "OCCUPIED_BEDS",
      replyText: `Currently occupied beds (${orientation.occupiedBeds.length}): ${orientation.occupiedBeds.join(", ")}.`,
    };
  }

  // Check if utterance might contain clinical updates. If so, NEVER fast-path it!
  const plan = planMateConversation(trimmed);
  if (plan.mayContainClinicalUpdate) {
    return null;
  }

  // If compound commands (more than one distinct action)
  const isOpeningOnly = plan.actions.length === 2 && plan.actions.includes("CASE_SHEET_OPEN") && plan.actions.includes("PATIENT_OPEN");
  if (plan.actions.length > 1 && !isOpeningOnly) {
    return null;
  }

  // 6. Top-level tab navigation
  if (plan.actions.includes("NAVIGATE_TAB") && plan.targetTab && trimmed.split(/\s+/).length <= 5) {
    return {
      handled: true,
      action: "NAVIGATE_TAB",
      targetTab: plan.targetTab,
      replyText: `Navigating to ${plan.targetTab.charAt(0).toUpperCase() + plan.targetTab.slice(1)}.`,
    };
  }

  // 7. Case Sheet section navigation on active / recent case
  if (plan.actions.includes("SECTION_NAVIGATE") && plan.targetSection && trimmed.split(/\s+/).length <= 5) {
    const target = activeCase || recentCase;
    if (target) {
      const bedLabel = target.bedNo ? `Bed ${target.bedNo}` : (target.displayId || "patient");
      return {
        handled: true,
        action: "OPEN_SECTION",
        targetCaseId: target.id,
        targetSection: plan.targetSection,
        replyText: `Opening ${bedLabel} ${plan.targetSection} section.`,
      };
    }
  }

  // 8. Exact Bed Open ("Open Bed 9", "Open Bed 10B", "Bed 9")
  const bedOpenMatch = trimmed.match(/^(?:open\s+)?bed\s+([0-9]+[a-b]?)[.]?$/i);
  if (bedOpenMatch && !plan.mayContainClinicalUpdate) {
    const rawBed = bedOpenMatch[1];
    const resolution = resolveMateCaseReference({
      utterance: `Bed ${rawBed}`,
      cases: censusCases,
      activeCaseId: activeCase?.id || null,
      physicalCapacity,
    });
    if (resolution.status === "RESOLVED" && resolution.caseId) {
      const target = censusCases.find((c) => c.id === resolution.caseId);
      return {
        handled: true,
        action: "OPEN_CASE",
        targetCaseId: resolution.caseId,
        targetBed: target?.bedNo || rawBed,
        replyText: `Opening Bed ${target?.bedNo || rawBed}.`,
      };
    }
  }

  // 9. Exact Display ID Open ("Open case 261006004", "Case 261006004")
  const displayIdMatch = trimmed.match(/^(?:open\s+)?(?:case\s+)?([0-9]{9}|C-[0-9]{4})[.]?$/i);
  if (displayIdMatch && !plan.mayContainClinicalUpdate) {
    const rawDisplayId = displayIdMatch[1];
    const resolution = resolveMateCaseByDisplayId(rawDisplayId, censusCases);
    if (resolution.status === "RESOLVED" && resolution.matchedCase) {
      return {
        handled: true,
        action: "OPEN_CASE",
        targetCaseId: resolution.matchedCase.id,
        targetBed: resolution.matchedCase.bedNo,
        replyText: `Opening case ${resolution.matchedCase.displayId || rawDisplayId}.`,
      };
    }
  }

  return null;
}
