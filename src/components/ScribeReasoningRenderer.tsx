import React, { useState } from "react";
import Markdown from "react-markdown";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

export interface ScribeReasoningSections {
  redFlags: string;
  priorityActions: string;
  clarify: string;
  differentials: string;
  watchFor: string;
  references: string;
  intro: string;
}

export function parseReasoningSections(
  text: string,
  structuredReasoning?: {
    differentials?: string[];
    watchFor?: string[];
    references?: string[];
  }
): ScribeReasoningSections {
  const sections: ScribeReasoningSections = {
    redFlags: "",
    priorityActions: "",
    clarify: "",
    differentials: "",
    watchFor: "",
    references: "",
    intro: "",
  };

  if (!text) {
    if (structuredReasoning?.differentials?.length) {
      sections.differentials = structuredReasoning.differentials.map((d) => `- ${d}`).join("\n");
    }
    if (structuredReasoning?.watchFor?.length) {
      sections.watchFor = structuredReasoning.watchFor.map((w) => `- ${w}`).join("\n");
    }
    if (structuredReasoning?.references?.length) {
      sections.references = structuredReasoning.references.map((r) => `- ${r}`).join("\n");
    }
    return sections;
  }

  const lines = text.split("\n");
  let currentSection: keyof ScribeReasoningSections = "intro";
  const sectionContent: Record<keyof ScribeReasoningSections, string[]> = {
    redFlags: [],
    priorityActions: [],
    clarify: [],
    differentials: [],
    watchFor: [],
    references: [],
    intro: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection !== "intro" || sectionContent.intro.length > 0) {
        sectionContent[currentSection].push(line);
      }
      continue;
    }

    if (!/^[-*•\d+.]\s/.test(trimmed)) {
      const cleanHeader = trimmed
        .replace(/^[#\s*🔴🟠🔵🟣⚠️📚]+/, "")
        .replace(/[*:]+$/, "")
        .trim()
        .toLowerCase();

      if (/^(red flags?|key concerns?|critical concerns?)$/i.test(cleanHeader)) {
        currentSection = "redFlags";
        continue;
      } else if (
        /^(priority actions?|immediate actions?|discriminating questions & next steps|discriminating questions and next steps|next steps|recommended actions?|immediate management)$/i.test(
          cleanHeader
        )
      ) {
        currentSection = "priorityActions";
        continue;
      } else if (
        /^(clarify|clarifications? needed|points? to clarify|to clarify|questions? to clarify)$/i.test(
          cleanHeader
        )
      ) {
        currentSection = "clarify";
        continue;
      } else if (
        /^(differentials? to consider|key considerations & differentials?|key considerations and differentials?|differentials?|differential diagnos[ie]s|key considerations?)$/i.test(
          cleanHeader
        )
      ) {
        currentSection = "differentials";
        continue;
      } else if (/^(watch for|things to watch for|monitoring)$/i.test(cleanHeader)) {
        currentSection = "watchFor";
        continue;
      } else if (
        /^(references? & guidelines?|references? and guidelines?|references?|guidelines?|textbook references?)$/i.test(
          cleanHeader
        )
      ) {
        currentSection = "references";
        continue;
      }
    }

    sectionContent[currentSection].push(line);
  }

  for (const key of Object.keys(sections) as Array<keyof ScribeReasoningSections>) {
    sections[key] = sectionContent[key].join("\n").trim();
  }

  // Merge structured fields if not already populated from text
  if (!sections.differentials && structuredReasoning?.differentials?.length) {
    sections.differentials = structuredReasoning.differentials.map((d) => `- ${d}`).join("\n");
  }
  if (!sections.watchFor && structuredReasoning?.watchFor?.length) {
    sections.watchFor = structuredReasoning.watchFor.map((w) => `- ${w}`).join("\n");
  }
  if (!sections.references && structuredReasoning?.references?.length) {
    sections.references = structuredReasoning.references.map((r) => `- ${r}`).join("\n");
  }

  return sections;
}

interface ScribeReasoningRendererProps {
  text: string;
  clinicalReasoning?: {
    differentials?: string[];
    watchFor?: string[];
    references?: string[];
  };
}

export const ScribeReasoningRenderer: React.FC<ScribeReasoningRendererProps> = ({
  text,
  clinicalReasoning,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReferences, setShowReferences] = useState(false);

  const sections = parseReasoningSections(text, clinicalReasoning);

  // Ordered sections specification:
  // 🔴 Red Flags
  // 🟠 Priority Actions
  // 🔵 Clarify
  // 🟣 Differentials to Consider
  // ⚠️ Watch For
  // 📚 References & Guidelines
  type SectionKey = "redFlags" | "priorityActions" | "clarify" | "differentials" | "watchFor" | "references";

  interface SectionConfig {
    key: SectionKey;
    title: string;
    containerClass: string;
    titleClass: string;
    bodyClass: string;
  }

  const sectionConfigs: SectionConfig[] = [
    {
      key: "redFlags",
      title: "🔴 Red Flags",
      containerClass: "bg-rose-50/70 dark:bg-rose-950/20 border-l-2 border-rose-400 dark:border-rose-500",
      titleClass: "text-rose-700 dark:text-rose-400 font-semibold text-[11px] uppercase tracking-wider",
      bodyClass: "text-rose-950 dark:text-rose-100",
    },
    {
      key: "priorityActions",
      title: "🟠 Priority Actions",
      containerClass: "bg-amber-50/70 dark:bg-amber-950/20 border-l-2 border-amber-400 dark:border-amber-500",
      titleClass: "text-amber-700 dark:text-amber-400 font-semibold text-[11px] uppercase tracking-wider",
      bodyClass: "text-amber-950 dark:text-amber-100",
    },
    {
      key: "clarify",
      title: "🔵 Clarify",
      containerClass: "bg-sky-50/70 dark:bg-sky-950/20 border-l-2 border-sky-400 dark:border-sky-500",
      titleClass: "text-sky-700 dark:text-sky-400 font-semibold text-[11px] uppercase tracking-wider",
      bodyClass: "text-sky-950 dark:text-sky-100",
    },
    {
      key: "differentials",
      title: "🟣 Differentials to Consider",
      containerClass: "bg-purple-50/70 dark:bg-purple-950/20 border-l-2 border-purple-400 dark:border-purple-500",
      titleClass: "text-purple-700 dark:text-purple-400 font-semibold text-[11px] uppercase tracking-wider",
      bodyClass: "text-purple-950 dark:text-purple-100",
    },
    {
      key: "watchFor",
      title: "⚠️ Watch For",
      containerClass: "bg-yellow-50/70 dark:bg-yellow-950/20 border-l-2 border-yellow-400 dark:border-yellow-500",
      titleClass: "text-yellow-700 dark:text-yellow-400 font-semibold text-[11px] uppercase tracking-wider",
      bodyClass: "text-yellow-950 dark:text-yellow-100",
    },
    {
      key: "references",
      title: "📚 References & Guidelines",
      containerClass: "bg-slate-50/80 dark:bg-slate-800/40 border-l-2 border-slate-400 dark:border-slate-500",
      titleClass: "text-slate-700 dark:text-slate-300 font-semibold text-[11px] uppercase tracking-wider",
      bodyClass: "text-slate-800 dark:text-slate-200",
    },
  ];

  // Filter available (non-empty) sections
  const availableSections = sectionConfigs.filter((cfg) => Boolean(sections[cfg.key]?.trim()));

  // If no structured sections were detected, render simple markdown prose
  if (availableSections.length === 0) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
        <Markdown>{text}</Markdown>
      </div>
    );
  }

  // Calculate if reasoning is long enough to collapse on mobile
  const nonRefSections = availableSections.filter((s) => s.key !== "references");
  const totalContentChars = availableSections.reduce(
    (acc, cur) => acc + (sections[cur.key]?.length || 0),
    0
  );
  const isLongReasoning = nonRefSections.length > 2 || totalContentChars > 380;

  // Determine sections to show based on expansion state
  const visibleSections =
    isLongReasoning && !isExpanded
      ? availableSections.slice(0, 2)
      : availableSections;

  return (
    <div className="space-y-2.5">
      {/* Optional Intro / Preamble */}
      {sections.intro?.trim() && (
        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-1 prose prose-xs dark:prose-invert max-w-none">
          <Markdown>{sections.intro}</Markdown>
        </div>
      )}

      {/* Advisory Consideration Label */}
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/80 px-2 py-0.5 rounded w-fit border border-slate-200/50 dark:border-slate-700/50">
        <Sparkles size={11} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
        <span>ErMate clinical consideration — not added to Case Sheet</span>
      </div>

      {/* Clinical Reasoning Section Cards */}
      <div className="space-y-2">
        {visibleSections.map((cfg) => {
          const content = sections[cfg.key];
          const isReferences = cfg.key === "references";

          return (
            <div
              key={cfg.key}
              className={`p-2.5 rounded-r-lg rounded-l-xs text-xs transition-all ${cfg.containerClass}`}
            >
              {isReferences ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowReferences((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
                  >
                    <span className={cfg.titleClass}>{cfg.title}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-normal">
                      {showReferences ? "Hide" : "Show"}
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${
                          showReferences ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>

                  {showReferences && (
                    <div
                      className={`mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 prose prose-xs dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-ul:my-0.5 prose-li:my-0.5 prose-strong:font-semibold ${cfg.bodyClass}`}
                    >
                      <Markdown>{content}</Markdown>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className={`mb-1 flex items-center gap-1.5 ${cfg.titleClass}`}>
                    {cfg.title}
                  </div>
                  <div
                    className={`prose prose-xs dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-ul:my-0.5 prose-li:my-0.5 prose-strong:font-semibold ${cfg.bodyClass}`}
                  >
                    <Markdown>{content}</Markdown>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Collapse / Expand Toggle for Long Reasoning */}
      {isLongReasoning && (
        <div>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="w-full mt-1 py-1.5 px-2.5 rounded-md bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
          >
            <span>{isExpanded ? "Show less" : "View full clinical reasoning"}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      )}
    </div>
  );
};
