/**
 * Edit-in-place pieces for the case sheet preview (Neeraj, 23 Nov 2026: "edit directly in the preview,
 * like a Word document, instead of small tabs").
 *
 *  - EditableBlock: a group of printed lines that belong to ONE case field. It looks exactly like the
 *    printed lines until clicked; then it turns into a text box holding those lines (one per row).
 *    Leaving the box writes the text back to the field. Nothing is written when the text is unchanged.
 *  - InlineSpan: one typeable piece inside a composed line (e.g. the findings after the vitals in
 *    "Breathing → RR: 24/min, SpO2: 88%. <findings>").
 *
 * Neither writes anywhere by itself: they call onCommit and the preview keeps the result in its draft
 * copy of the case, which is saved only when the doctor presses Apply.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

type LineKind = "item" | "dash" | "para";

const LINE_CLASS: Record<LineKind, string> = {
  item: "pl-8 whitespace-pre-line",
  dash: "pl-2",
  para: "whitespace-pre-line",
};

/** The text box content for a block: one row per printed line ("- " kept for dash lines so new rows keep the style). */
export function blockEditText(kind: LineKind, lines: string[], placeholder: boolean): string {
  if (placeholder) return "";
  return lines.map((l) => (kind === "dash" ? `- ${l}` : l)).join("\n");
}

/** Text box content back to the stored field text: no dash marks, no empty rows. */
export function blockTextToValue(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s+/, "").trim())
    .filter(Boolean)
    .join("\n");
}

/** Text box content back to the stored text for free-text documents (discharge summary): keeps the doctor's own "-" / "•" marks and blank lines. */
export function blockTextToFreeValue(text: string): string {
  return text.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();
}

export function EditableBlock({
  kind, lines, placeholder, onCommit, keepMarks,
}: {
  kind: LineKind;
  /** Free-text field: do not strip leading "-" marks or blank lines on commit. */
  keepMarks?: boolean;
  lines: string[];
  /** The block is only the "Not documented." placeholder of an empty field. */
  placeholder?: boolean;
  onCommit: (value: string) => void;
}) {
  const initial = blockEditText(kind, lines, Boolean(placeholder));
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const cancelled = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!editing) setText(initial); }, [initial, editing]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text, editing]);
  useEffect(() => {
    if (editing && box.current) {
      const el = box.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={box}
        data-testid="inline-edit-box"
        value={text}
        rows={1}
        spellCheck
        aria-label="Edit this section"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { cancelled.current = true; setText(initial); setEditing(false); }
        }}
        onBlur={() => {
          setEditing(false);
          if (cancelled.current) { cancelled.current = false; return; }
          if (text !== initial) onCommit(keepMarks ? blockTextToFreeValue(text) : blockTextToValue(text));
        }}
        className="no-print block w-full resize-none overflow-hidden rounded-md border-2 border-indigo-500 bg-white px-2 py-1 text-sm leading-relaxed text-slate-900 outline-none shadow-sm"
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="inline-edit-view"
      title="Click to edit"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); } }}
      className="cursor-text rounded-md -mx-1.5 px-1.5 space-y-1.5 hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 print:hover:bg-transparent"
    >
      {lines.map((l, i) => (
        <p key={i} className={LINE_CLASS[kind]}>{kind === "dash" ? `- ${l}` : l}</p>
      ))}
    </div>
  );
}

export function InlineSpan({
  text, hint, placeholder, onCommit,
}: {
  text: string;
  /** Shown (grey) when the piece is empty. */
  hint?: string;
  /** The empty piece stands for "Not documented.": it stays visible and prints. */
  placeholder?: boolean;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== text) el.textContent = text;
  }, [text]);
  return (
    <span
      ref={ref}
      data-testid="inline-edit-span"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={hint || "Edit"}
      data-hint={hint || ""}
      data-ph={placeholder ? "1" : undefined}
      className="inline-edit"
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (e.key === "Enter") { e.preventDefault(); el.blur(); }
        if (e.key === "Escape") { el.textContent = text; el.blur(); }
      }}
      onPaste={(e) => {
        // Plain text only, on one line (browsers without "plaintext-only" would otherwise keep pasted formatting).
        e.preventDefault();
        const t = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, t);
      }}
      onBlur={(e) => {
        const v = (e.currentTarget.textContent || "").replace(/\s+/g, " ").trim();
        if (v !== text.trim()) onCommit(v);
      }}
    />
  );
}

/**
 * SHARED BASE for every sheet type (adult ER, pediatric, and the ICU / OPD sheets later).
 * A sheet wraps its body in <InlineEditCtx.Provider value={{ editing, onEdit }}> and marks each editable
 * place with <EdText> (one line next to a label) or <EdBlock> (a paragraph / list of lines), giving the
 * section title + field key from src/lib/previewedit.ts. Outside edit mode they print the plain text, so
 * the sheet looks and prints exactly as before. A new sheet type only has to add its fields to previewedit.ts.
 */
export interface InlineEditState {
  editing: boolean;
  onEdit?: (section: string, key: string, value: string) => void;
}
export const InlineEditCtx = React.createContext<InlineEditState>({ editing: false });

/** One typeable line after a label ("Airway: ..."). `text` is what is stored ("" when empty); `shown` is what is printed when not editing. */
export function EdText({ s, k, text, shown, hint }: { s?: string; k: string; text: string; shown?: React.ReactNode; hint?: string }) {
  const { editing, onEdit } = React.useContext(InlineEditCtx);
  if (!editing || !onEdit || !s) return <>{shown ?? text}</>;
  return <InlineSpan text={text} hint={hint || "Not documented"} placeholder={!text} onCommit={(v) => onEdit(s, k, v)} />;
}

/** A paragraph or list of lines for one field. `kind` "dash" keeps "- " rows. */
export function EdBlock({ s, k, lines, kind = "para", shown, hint, keepMarks }: {
  s?: string; k: string; lines: string[]; kind?: LineKind; shown?: React.ReactNode; hint?: string; keepMarks?: boolean;
}) {
  const { editing, onEdit } = React.useContext(InlineEditCtx);
  if (!editing || !onEdit || !s) return <>{shown ?? lines.map((l, i) => <p key={i} className={LINE_CLASS[kind]}>{kind === "dash" ? `- ${l}` : l}</p>)}</>;
  const empty = lines.length === 0 || lines.every((l) => !l.trim());
  return (
    <EditableBlock
      kind={kind}
      lines={empty ? [hint || "Not documented"] : lines}
      placeholder={empty}
      keepMarks={keepMarks}
      onCommit={(v) => onEdit(s, k, v)}
    />
  );
}

/** Styles for InlineSpan (kept next to it; the preview includes them once). */
export const INLINE_EDIT_CSS = `
  .inline-edit { outline: none; border-radius: 4px; padding: 0 3px; margin: 0 -3px; cursor: text; }
  .inline-edit:hover { background: rgba(99,102,241,.12); }
  .inline-edit:focus { background: #fff; box-shadow: 0 0 0 2px #6366f1; }
  .inline-edit:empty::before { content: attr(data-hint); color: #94a3b8; font-style: italic; }
  .inline-edit:empty:not([data-ph]):not(:hover):not(:focus)::before { content: ""; }
  .inline-edit[data-ph]:empty::before { color: inherit; font-style: normal; }
  /* While the Edit switch is on, every typeable place is visibly marked (dashed outline + pale fill). */
  .ie-on [data-testid="inline-edit-view"] { background: #f5f7ff; outline: 1px dashed #a5b4fc; outline-offset: 1px; }
  .ie-on .inline-edit { background: rgba(99,102,241,.08); border-bottom: 1px dashed #818cf8; border-radius: 3px 3px 0 0; }
  .ie-on .inline-edit:empty:not([data-ph])::before { content: attr(data-hint) !important; }
  @media print {
    .ie-on [data-testid="inline-edit-view"] { background: none !important; outline: none !important; }
    .ie-on .inline-edit { background: none !important; border-bottom: 0 !important; }
    .ie-on .inline-edit:empty:not([data-ph])::before { content: "" !important; }
    .inline-edit { background: none !important; box-shadow: none !important; }
    .inline-edit:empty:not([data-ph])::before { content: "" !important; }
  }
`;