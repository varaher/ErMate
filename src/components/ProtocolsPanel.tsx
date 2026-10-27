import React, { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Search } from "lucide-react";
import { PROTOCOL_CHAPTERS, searchProtocols } from "../data/protocols";
import type { ProtocolTopic } from "../data/protocols/types";

/** Read-only protocol reader: chapter list + search on one side, the selected protocol on the other. */
export default function ProtocolsPanel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(PROTOCOL_CHAPTERS[0]?.topics[0]?.id || "");
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PROTOCOL_CHAPTERS.map((c) => [c.id, true]))
  );

  const matchIds = useMemo(() => new Set(searchProtocols(query).map((t) => t.id)), [query]);
  const selected: ProtocolTopic | undefined = PROTOCOL_CHAPTERS.flatMap((c) => c.topics).find((t) => t.id === selectedId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4" data-testid="protocols-panel">
      <div className="md:col-span-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search protocols (e.g. adrenaline, pneumothorax)"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            data-testid="protocol-search"
          />
        </div>
        {PROTOCOL_CHAPTERS.map((chapter) => {
          const topics = chapter.topics.filter((t) => matchIds.has(t.id));
          if (topics.length === 0) return null;
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
              {open && topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-2 text-xs border-t border-slate-100 dark:border-slate-800 ${
                    selectedId === t.id ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          );
        })}
        {matchIds.size === 0 && <p className="text-xs text-slate-500">No protocol matches “{query}”.</p>}
      </div>

      <div className="md:col-span-8 space-y-4">
        {!selected ? (
          <p className="text-xs text-slate-500">Select a protocol.</p>
        ) : (
          <>
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
            </div>

            {selected.sections.map((section) => (
              <div key={section.heading} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-950/60 space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">{section.heading}</h3>
                  {section.note && <p className="text-[11px] text-slate-500 mt-0.5">{section.note}</p>}
                </div>
                <ul className="space-y-2">
                  {section.items.map((item, idx) => (
                    <li
                      key={idx}
                      className={`text-xs rounded-lg px-3 py-2 ${
                        item.critical
                          ? "bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 text-red-800 dark:text-red-200"
                          : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {item.critical && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                      {item.label && <strong>{item.label}: </strong>}
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <p className="text-[10px] text-slate-500 leading-snug" data-testid="protocol-footer">
              v{selected.version} · Source: {selected.source}. This is a clinical support reference. Doses and decisions must be confirmed by the treating clinician against the patient's condition and local availability.
            </p>
          </>
        )}
      </div>
    </div>
  );
}