import React from "react";

// Small, dependency-free renderer for the markdown the reference chat returns:
// headings, ---, **bold**, *italic*, `code`, bullet / numbered lists and pipe tables.
// Everything is rendered as React elements (no raw HTML), so model output cannot inject markup.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-bold text-slate-900 dark:text-white">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k} className="italic">{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes("-");
const splitRow = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function ChatMarkdown({ content }: { content: string }) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { i++; continue; }

    if (/^-{3,}$|^\*{3,}$|^_{3,}$/.test(t)) {
      blocks.push(<hr key={key++} className="my-3 border-slate-200 dark:border-slate-700" />);
      i++; continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1].length;
      const cls = level <= 2
        ? "text-sm font-extrabold text-slate-900 dark:text-white mt-1 mb-1.5"
        : level === 3
          ? "text-[13px] font-bold text-purple-700 dark:text-purple-300 mt-3 mb-1"
          : "text-xs font-bold text-slate-700 dark:text-slate-200 mt-2.5 mb-1";
      blocks.push(<div key={key++} className={cls}>{renderInline(h[2], `h${key}`)}</div>);
      i++; continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-[11px]">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>{head.map((c, ci) => <th key={ci} className="px-2 py-1.5 text-left font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{renderInline(c, `th${key}-${ci}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-slate-100 dark:border-slate-800">
                  {r.map((c, ci) => <td key={ci} className="px-2 py-1.5 align-top text-slate-700 dark:text-slate-300">{renderInline(c, `td${key}-${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^([-*•])\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^([-*•])\s+/, "")); i++; }
      blocks.push(
        <ul key={key++} className="my-1.5 ml-4 list-disc space-y-1 marker:text-purple-400">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `li${key}-${ii}`)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^\d+[.)]\s+/, "")); i++; }
      blocks.push(
        <ol key={key++} className="my-1.5 ml-4 list-decimal space-y-1 marker:text-purple-500 marker:font-bold">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `ol${key}-${ii}`)}</li>)}
        </ol>
      );
      continue;
    }

    // paragraph: gather consecutive plain lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|-{3,}$|\s*([-*•]|\d+[.)])\s+)/.test(lines[i].trim()) && !isTableRow(lines[i])) {
      para.push(lines[i].trim()); i++;
    }
    if (para.length === 0) { para.push(lines[i].trim()); i++; }
    blocks.push(<p key={key++} className="my-1.5">{renderInline(para.join(" "), `p${key}`)}</p>);
  }

  return <div className="space-y-0.5 break-words">{blocks}</div>;
}