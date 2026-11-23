import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronRight, Flag, Search } from "lucide-react";
import { PROTOCOL_CHAPTERS, allProtocolTopics, searchProtocols } from "../data/protocols";
import type { ProtocolItem, ProtocolTopic } from "../data/protocols/protocolTypes";
import { chipsForTopic, sectionIndexForKind, investigationItems, itemLine, resolveLink, linkedTopicIds, backlinks } from "../data/protocols/protocolViews";
import { requestTour } from "../lib/coachTours";
import ProtocolFlagDialog, { type FlagTarget } from "./ProtocolFlagDialog";

/**
 * ErMate Handbook reader (read-only): chapter list + search on one side, the selected topic on the other.
 * Topics link to each other (differentials, pathophysiology, approach steps); "Back" returns along the trail.
 * A link to a topic that is not written yet shows "Topic coming" and never breaks.
 */
export default function ProtocolsPanel() {
  const [query, setQuery] = useState("");
  useEffect(() => { requestTour("protocols"); }, []);
  const [flagTarget, setFlagTarget] = useState<FlagTarget | null>(null);
  const [selectedId, setSelectedId] = useState<string>(PROTOCOL_CHAPTERS[0]?.topics[0]?.id || "");
  const [trail, setTrail] = useState<string[]>([]);
  const topRef = useRef<HTMLDivElement | null>(null);
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PROTOCOL_CHAPTERS.map((c) => [c.id, true]))
  );

  const topics = useMemo(() => allProtocolTopics(), []);
  const matchIds = useMemo(() => new Set(searchProtocols(query).map((t) => t.id)), [query]);
  const selected: ProtocolTopic | undefined = topics.find((t) => t.id === selectedId);

  const scrollToTop = () => {
    try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* ignore */ }
  };

  /** Open a topic from a link: remembers where we came from so Back works. */
  const openLinked = (id: string) => {
    if (!resolveLink(id, topics) || id === selectedId) return;
    setTrail((t) => (selectedId ? [...t, selectedId] : t));
    setSelectedId(id);
    scrollToTop();
  };

  /** Open a topic from the chapter list: a fresh start, no trail. */
  const openFromList = (id: string) => {
    setTrail([]);
    setSelectedId(id);
  };

  const goBack = () => {
    if (!trail.length) return;
    const next = trail.slice();
    const prev = next.pop() as string;
    setTrail(next);
    setSelectedId(prev);
    scrollToTop();
  };

  const prevTopic = trail.length ? topics.find((t) => t.id === trail[trail.length - 1]) : undefined;
  const parentTopic = selected ? resolveLink(selected.parent, topics) : undefined;

  const flagFor = (item: ProtocolItem, sIdx: number, idx: number) =>
    selected && setFlagTarget({
      topicId: selected.id,
      topicTitle: selected.title,
      topicVersion: selected.version,
      stepKey: `${selected.id}:${sIdx}:${idx}`,
      stepLabel: (item.label || item.text).slice(0, 120),
    });

  const related = selected
    ? [
        ...linkedTopicIds(selected).map((id) => resolveLink(id, topics)).filter(Boolean) as ProtocolTopic[],
        ...backlinks(selected.id, topics),
      ].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4" data-testid="protocols-panel">
      <div className="md:col-span-4 space-y-3">
        <div className="flex items-center gap-2 px-1" data-testid="handbook-title">
          <BookOpen className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-extrabold text-slate-800 dark:text-white">ErMate Handbook</span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a symptom, diagnosis or drug (e.g. vomiting blood, confusion, terlipressin)"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            data-testid="protocol-search"
          />
        </div>
        {PROTOCOL_CHAPTERS.map((chapter) => {
          const chapterTopics = chapter.topics.filter((t) => matchIds.has(t.id));
          if (chapterTopics.length === 0) return null;
          const open = openChapters[chapter.id] !== false;
          return (
            <div key={chapter.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenChapters((p) => ({ ...p, [chapter.id]: !open }))}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-extrabold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <span>{chapter.title}</span>
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {open && chapterTopics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openFromList(t.id)}
                  className={`w-full text-left px-4 py-2 text-xs border-t border-slate-100 dark:border-slate-800 ${
                    selectedId === t.id ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                  } ${t.parent ? "pl-7" : ""}`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          );
        })}
        {matchIds.size === 0 && <p className="text-xs text-slate-500">No topic matches “{query}”.</p>}
      </div>

      <div className="md:col-span-8 space-y-4" ref={topRef}>
        {!selected ? (
          <p className="text-xs text-slate-500">Select a topic.</p>
        ) : (
          <>
            {(prevTopic || parentTopic) && (
              <div className="flex flex-wrap items-center gap-2">
                {prevTopic && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300"
                    data-testid="handbook-back"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to {prevTopic.title}
                  </button>
                )}
                {parentTopic && parentTopic.id !== prevTopic?.id && (
                  <button
                    type="button"
                    onClick={() => openLinked(parentTopic.id)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-violet-700"
                    data-testid="handbook-parent"
                  >
                    Part of: {parentTopic.title}
                  </button>
                )}
              </div>
            )}

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950/60 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{selected.title}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 uppercase">{selected.population}</span>
                <span
                  data-testid="protocol-status"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selected.status === "reviewed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {selected.status === "reviewed" ? `Reviewed ${selected.reviewedOn}` : "Draft — not yet clinically reviewed"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{selected.summary}</p>
              {chipsForTopic(selected).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1" data-testid="protocol-chips">
                  {chipsForTopic(selected).map((c) => (
                    <button
                      key={c.kind}
                      type="button"
                      onClick={() => {
                        const idx = sectionIndexForKind(selected, c.kind);
                        if (idx < 0) return;
                        document.getElementById(`protocol-section-${selected.id}-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full border-[1.5px] border-violet-600 text-violet-700 dark:text-violet-300 dark:border-violet-400 hover:bg-violet-600 hover:text-white"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              {selected.notice && (
                <p
                  className="text-[11px] rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 px-3 py-2"
                  data-testid="protocol-notice"
                >
                  {selected.notice}
                </p>
              )}
            </div>

            {selected.firstTen && selected.firstTen.length > 0 && (
              <div className="rounded-2xl border-[1.5px] border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2" data-testid="handbook-first10">
                <p className="text-xs font-extrabold text-red-800 dark:text-red-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> First 10 minutes
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-red-900 dark:text-red-100">
                  {selected.firstTen.map((f, i) => <li key={i}>{f}</li>)}
                </ol>
              </div>
            )}

            {investigationItems(selected).length > 0 && (
              <div className="rounded-xl border-[1.5px] border-emerald-600 p-3 space-y-1.5 bg-white dark:bg-slate-950/60" data-testid="protocol-investigations-box">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Investigations to send (as written in this topic)</p>
                <ul className="space-y-1">
                  {investigationItems(selected).map((item, i) => (
                    <li key={i} className="text-[11px] text-slate-700 dark:text-slate-200">{itemLine(item)}</li>
                  ))}
                </ul>
              </div>
            )}

            {selected.sections.map((section, sIdx) => (
              <div key={section.heading} id={`protocol-section-${selected.id}-${sIdx}`} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950/60 space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">{section.heading}</h3>
                  {section.note && <p className="text-[11px] text-slate-500 mt-0.5">{section.note}</p>}
                </div>

                {section.layout === "tiles" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="handbook-ddx-grid">
                    {section.items.map((item, idx) => {
                      const target = resolveLink(item.link, topics);
                      return target && target.id !== selected.id ? (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => openLinked(target.id)}
                          className="text-left rounded-xl border-[1.5px] border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-3 py-2.5 min-h-[56px]"
                          data-testid="handbook-link"
                        >
                          <span className="block text-xs font-bold text-violet-800 dark:text-violet-200">{item.label || target.title} →</span>
                          <span className="block text-[11px] text-slate-600 dark:text-slate-300">{item.text}</span>
                        </button>
                      ) : (
                        <div key={idx} className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 min-h-[56px]" data-testid="handbook-tile-static">
                          <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                            {item.label}
                            {item.link && <span className="ml-1.5 text-[9px] font-bold uppercase text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded" data-testid="handbook-topic-coming">Topic coming</span>}
                          </span>
                          <span className="block text-[11px] text-slate-600 dark:text-slate-300">{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {section.items.map((item, idx) => {
                      const target = resolveLink(item.link, topics);
                      return (
                        <li
                          key={idx}
                          className={`text-xs rounded-lg px-3 py-2 ${
                            item.critical
                              ? "bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 text-red-800 dark:text-red-200"
                              : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              {item.critical && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                              {item.tier === "local" && (
                                <span
                                  className="inline-block mr-1.5 mb-0.5 text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 align-middle"
                                  data-testid="local-practice-badge"
                                >
                                  Local practice{item.origin ? ` · ${item.origin}` : ""} · not a guideline requirement
                                </span>
                              )}
                              {item.label && <strong>{item.label}: </strong>}
                              {item.text}
                              {target && target.id !== selected.id && (
                                <button
                                  type="button"
                                  onClick={() => openLinked(target.id)}
                                  className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-violet-700 dark:text-violet-300 hover:underline"
                                  data-testid="handbook-link"
                                >
                                  Open {target.title} <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                              {item.link && !target && (
                                <span className="mt-1.5 block text-[10px] font-semibold text-slate-400" data-testid="handbook-topic-coming">Linked topic coming soon</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => flagFor(item, sIdx, idx)}
                              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-violet-700"
                              aria-label={`Flag a concern about ${item.label || "this step"}`}
                              data-testid="protocol-flag-step"
                            >
                              <Flag className="w-3 h-3" /> Flag
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}

            {related.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950/60 space-y-2" data-testid="handbook-related">
                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Related topics</p>
                <div className="flex flex-wrap gap-2">
                  {related.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openLinked(t.id)}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected.reviewNotes && selected.reviewNotes.length > 0 && (
              <details className="border border-amber-200 dark:border-amber-900 rounded-2xl p-4 bg-amber-50/60 dark:bg-amber-950/20" data-testid="protocol-review-notes">
                <summary className="text-xs font-extrabold text-amber-800 dark:text-amber-200 cursor-pointer">
                  Review notes for clinical sign-off ({selected.reviewNotes.length})
                </summary>
                <ul className="mt-2 space-y-1.5 list-disc pl-4 text-[11px] text-amber-900 dark:text-amber-100">
                  {selected.reviewNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </details>
            )}

            {selected.references && selected.references.length > 0 && (
              <details className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950/60" data-testid="protocol-references">
                <summary className="text-xs font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer">
                  References to verify ({selected.references.length})
                </summary>
                <p className="mt-2 text-[10px] text-slate-500">Recommended verification sources, not proof that each step has been individually validated.</p>
                <ul className="mt-1 space-y-1 list-disc pl-4 text-[11px] text-slate-600 dark:text-slate-300">
                  {selected.references.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </details>
            )}

            <button
              type="button"
              onClick={() => setFlagTarget({ topicId: selected.id, topicTitle: selected.title, topicVersion: selected.version, stepKey: "", stepLabel: "" })}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border-[1.5px] border-violet-600 text-violet-700 dark:text-violet-300 dark:border-violet-400"
              data-testid="protocol-flag-topic"
            >
              <Flag className="w-3.5 h-3.5" /> Flag a concern about this topic
            </button>
            <p className="text-[10px] text-slate-500 leading-snug" data-testid="protocol-footer">
              ErMate Handbook · v{selected.version} · {selected.source}. This is a clinical support reference. Doses and decisions must be confirmed by the treating clinician against the patient's condition and local availability.
            </p>
          </>
        )}
      </div>
      {flagTarget && <ProtocolFlagDialog target={flagTarget} onClose={() => setFlagTarget(null)} />}
    </div>
  );
}