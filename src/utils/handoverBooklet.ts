/**
 * Handover "Print as Book" — ErMate builds the booklet itself (Neeraj, 24 Nov 2026).
 *
 * The earlier book mode only produced A5 pages and relied on the printer's own "Booklet" option, so on most
 * printers it came out as a single run of pages, page numbers did not print (browsers ignore @page margin
 * boxes), and the back sides came out upside down (landscape booklets need "flip on SHORT edge").
 *
 * Now:
 *  1. The patient cards on screen are copied with their PRINT look (textareas → their print mirrors,
 *     buttons / no-print parts removed).
 *  2. Each card is measured at A5 width and whole cards are packed into A5 pages (an over-long card is
 *     scaled down a little, or split across pages if it is very long).
 *  3. Every page gets a footer: "Handover <date> · <from → to> · Page n of N".
 *  4. FOLD-AND-STACK book (Neeraj, 24 Nov 2026): every A4 sheet carries 4 pages in its own order —
 *     front = [p+3 | p], back = [p+1 | p+2] — so each sheet, printed double-sided (flip on short edge) and
 *     folded in half with its first page outside, reads p, p+1, p+2, p+3. Folded sheets are stacked one
 *     after another (sheet 1 on top) and read 1, 2, 3, 4, 5 … as a book. No blank halves in the middle;
 *     blanks appear only at the end of the last sheet when the page count is not a multiple of 4.
 *  5. Optional 180° rotation of the back sides for duplex printers that can only flip on the long edge.
 */

export const A5_W_MM = 148.5;
export const A5_H_MM = 210;
export const PAGE_PAD_MM = { top: 7, bottom: 12, outer: 7, inner: 9 };
const CONTENT_W_MM = A5_W_MM - PAGE_PAD_MM.outer - PAGE_PAD_MM.inner;
const CONTENT_H_MM = A5_H_MM - PAGE_PAD_MM.top - PAGE_PAD_MM.bottom;
const CARD_GAP_MM = 3;
export const MIN_FIT_SCALE = 0.8;

export interface FoldSheet {
  /** Page indices (0-based) or null (blank, only on the last sheet). Left | right half of each side. */
  front: [number | null, number | null];
  back: [number | null, number | null];
}

/**
 * Fold-and-stack imposition: sheet k holds pages 4k … 4k+3.
 * Front = [4k+3 | 4k] (outer back cover | cover), back = [4k+1 | 4k+2] (inside spread).
 * 5 pages → sheet 1: front [3 | 0], back [1 | 2]; sheet 2: front [null | 4], back [null | null].
 */
export function foldStackSheets(pages: number): FoldSheet[] {
  const real = (i: number) => (i < pages ? i : null);
  const sheets: FoldSheet[] = [];
  for (let p = 0; p < pages; p += 4) {
    sheets.push({ front: [real(p + 3), real(p)], back: [real(p + 1), real(p + 2)] });
  }
  return sheets;
}

export interface PlacedItem {
  /** Index of the card. */
  card: number;
  /** Scale applied to fit (1 = none). */
  scale: number;
  /** For a card split across pages: which slice (0-based) and how many slices. */
  slice?: { index: number; of: number };
}

/**
 * Packs cards (heights in mm, in order) into pages of `pageH` mm; the first page has `firstPageReserve` mm
 * taken by the sheet header. A card taller than a page is scaled to fit if the scale stays ≥ MIN_FIT_SCALE,
 * otherwise it is split into page-height slices on consecutive pages. Card order is never changed.
 */
export function packPages(cardHeights: number[], pageH = CONTENT_H_MM, firstPageReserve = 0, gap = CARD_GAP_MM): PlacedItem[][] {
  const pages: PlacedItem[][] = [[]];
  let used = firstPageReserve;
  const avail = () => pageH - (pages.length === 1 ? firstPageReserve : 0);
  const newPage = () => { pages.push([]); used = 0; };

  cardHeights.forEach((h, card) => {
    const cur = pages[pages.length - 1];
    const need = (cur.length ? gap : 0) + h;
    if (used + need <= pageH + 0.01) {
      cur.push({ card, scale: 1 });
      used += need;
      return;
    }
    // Does not fit here. Start a fresh page unless this page is still empty.
    if (cur.length) newPage();
    const room = avail();
    if (h <= room) {
      pages[pages.length - 1].push({ card, scale: 1 });
      used = (pages.length === 1 ? firstPageReserve : 0) + h;
      return;
    }
    const scale = room / h;
    if (scale >= MIN_FIT_SCALE) {
      pages[pages.length - 1].push({ card, scale });
      used = pageH;
      return;
    }
    // Very long card: split into slices on consecutive pages (full page height each).
    const slices = Math.ceil(h / pageH);
    for (let i = 0; i < slices; i++) {
      if (i > 0 || pages[pages.length - 1].length) newPage();
      pages[pages.length - 1].push({ card, scale: 1, slice: { index: i, of: slices } });
      used = pageH;
    }
  });
  return pages.filter((p, i) => p.length || i === 0);
}

// ---------------------------------------------------------------------------------------------------
// DOM side
// ---------------------------------------------------------------------------------------------------

const ROOT_ID = "ermate-booklet-root";
const STYLE_ID = "ermate-booklet-style";
export const ROTATE_BACK_KEY = "ermate.booklet.rotateBack";

export const BOOKLET_CSS = `
#${ROOT_ID} { position: absolute; left: -20000px; top: 0; background: #fff; color: #000; font-family: Arial, sans-serif; }
#${ROOT_ID} .eb-sheet { width: 297mm; height: 210mm; display: flex; box-sizing: border-box; overflow: hidden; background: #fff; }
#${ROOT_ID} .eb-sheet.eb-rotated { transform: rotate(180deg); }
#${ROOT_ID} .eb-page { position: relative; width: ${A5_W_MM}mm; height: ${A5_H_MM}mm; box-sizing: border-box; overflow: hidden; }
#${ROOT_ID} .eb-page.eb-left { padding: ${PAGE_PAD_MM.top}mm ${PAGE_PAD_MM.inner}mm ${PAGE_PAD_MM.bottom}mm ${PAGE_PAD_MM.outer}mm; }
#${ROOT_ID} .eb-page.eb-right { padding: ${PAGE_PAD_MM.top}mm ${PAGE_PAD_MM.outer}mm ${PAGE_PAD_MM.bottom}mm ${PAGE_PAD_MM.inner}mm; }
#${ROOT_ID} .eb-content { width: ${CONTENT_W_MM}mm; }
#${ROOT_ID} .eb-item { margin-bottom: ${CARD_GAP_MM}mm; transform-origin: top left; }
#${ROOT_ID} .eb-slice { overflow: hidden; height: ${CONTENT_H_MM}mm; }
#${ROOT_ID} .eb-footer { position: absolute; left: 0; right: 0; bottom: 4mm; text-align: center; font-size: 6.8pt; color: #333; }
#${ROOT_ID} .eb-header { border-bottom: 1.5px solid #000; padding-bottom: 2mm; margin-bottom: 3mm; text-align: center; }
#${ROOT_ID} .eb-header .eb-h1 { font-weight: 800; font-size: 9.5pt; letter-spacing: 0.3px; }
#${ROOT_ID} .eb-header .eb-h2 { font-size: 7pt; font-weight: 700; margin-top: 0.5mm; }
#${ROOT_ID} .eb-header .eb-meta { font-size: 7pt; margin-top: 1mm; }
#${ROOT_ID} .print-card { border: 1px solid #000 !important; border-radius: 4px !important; overflow: hidden; background: #fff !important; box-shadow: none !important; }
#${ROOT_ID} .print-card * { font-size: 7.6pt !important; line-height: 1.22 !important; color: #000 !important; background-color: transparent !important; box-shadow: none !important; }
#${ROOT_ID} .print-card [class*="uppercase"] { font-size: 6.6pt !important; }
#${ROOT_ID} .print-card .print-card-header, #${ROOT_ID} .print-card .print-card-header * { background-color: #1e293b !important; color: #fff !important; font-size: 8.4pt !important; }
#${ROOT_ID} .print-card .print-card-header { padding: 1.5mm 2mm !important; }
#${ROOT_ID} .print-card .border-b, #${ROOT_ID} .print-card .print-section { padding: 1.2mm 2mm !important; }
#${ROOT_ID} .print-mirror-div { display: block !important; white-space: pre-wrap !important; word-wrap: break-word !important; font-family: Arial, sans-serif !important; }
#${ROOT_ID} .p-2, #${ROOT_ID} .p-3, #${ROOT_ID} .p-4 { padding: 1.2mm 2mm !important; }
@media print {
  @page { size: A4 landscape; margin: 0; }
  @page :left { margin: 0; }
  @page :right { margin: 0; }
  html.ermate-booklet-print, html.ermate-booklet-print body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  html.ermate-booklet-print body > *:not(#${ROOT_ID}) { display: none !important; }
  html.ermate-booklet-print #${ROOT_ID} { position: static !important; left: auto !important; }
  html.ermate-booklet-print #${ROOT_ID} .eb-sheet { break-after: page; page-break-after: always; }
  html.ermate-booklet-print #${ROOT_ID} .eb-sheet:last-child { break-after: auto; page-break-after: auto; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

/** Turns a live card into its printed look (works on a clone; the original is untouched). */
export function toPrintLook(el: HTMLElement): HTMLElement {
  const c = el.cloneNode(true) as HTMLElement;
  c.querySelectorAll(".no-print, button, textarea, input, select, .print\\:hidden").forEach((n) => n.remove());
  c.querySelectorAll<HTMLElement>("[class]").forEach((n) => {
    const cls = n.className;
    if (typeof cls !== "string") return;
    if (/\bprint:(inline-block|block|inline|flex)\b/.test(cls)) n.classList.remove("hidden");
  });
  c.querySelectorAll<HTMLElement>(".print-mirror-div").forEach((n) => { n.style.display = "block"; });
  c.removeAttribute("id");
  c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  return c;
}

function mmToPx(): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:-20000px;top:0;width:100mm;height:1px";
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return px || 3.7795;
}

export interface BookletMeta {
  hospitalLine: string;
  date: string;
  from: string;
  to: string;
  time: string;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function headerEl(meta: BookletMeta): HTMLElement {
  const h = el("div", "eb-header");
  h.appendChild(el("div", "eb-h1", meta.hospitalLine));
  h.appendChild(el("div", "eb-h2", "DOCTORS' CLINICAL HANDOVER SHEET"));
  h.appendChild(el("div", "eb-meta", `DATE: ${meta.date}   FROM: ${meta.from}   TO: ${meta.to}   TIME: ${meta.time}`));
  return h;
}

export function footerText(meta: BookletMeta, page: number, total: number): string {
  return `Confidential handover · ${meta.date} · ${meta.from} → ${meta.to} · Page ${page} of ${total}`;
}

/**
 * Builds the imposed booklet from the cards currently on screen and opens the print dialog.
 * Returns the number of real pages (0 if there was nothing to print).
 */
export function printHandoverBooklet(cards: HTMLElement[], meta: BookletMeta, opts: { rotateBack: boolean }): number {
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  if (!cards.length) return 0;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BOOKLET_CSS;
  document.body.appendChild(style);

  const root = el("div", "");
  root.id = ROOT_ID;
  document.body.appendChild(root);

  // 1. Measure each card (print look) and the header at A5 content width.
  const px = mmToPx();
  const measure = el("div", "eb-content");
  root.appendChild(measure);
  const header = headerEl(meta);
  measure.appendChild(header);
  const headerMm = (header.getBoundingClientRect().height + 3 * px) / px; // + margin-bottom
  const printed = cards.map(toPrintLook);
  const heights = printed.map((c) => {
    measure.appendChild(c);
    const h = c.getBoundingClientRect().height / px;
    return h;
  });
  measure.remove();

  // 2. Pack into A5 pages.
  const pages = packPages(heights, CONTENT_H_MM, headerMm);
  const total = pages.length;

  // 3. Build page elements.
  const pageEls: HTMLElement[] = pages.map((items, i) => {
    const content = el("div", "eb-content");
    if (i === 0) content.appendChild(headerEl(meta));
    for (const it of items) {
      const wrap = el("div", it.slice ? "eb-item eb-slice" : "eb-item");
      const card = printed[it.card].cloneNode(true) as HTMLElement;
      if (it.slice) {
        card.style.transform = `translateY(-${it.slice.index * CONTENT_H_MM}mm)`;
      } else if (it.scale < 1) {
        wrap.style.transform = `scale(${it.scale.toFixed(3)})`;
        wrap.style.width = `${(100 / it.scale).toFixed(2)}%`;
      }
      wrap.appendChild(card);
      content.appendChild(wrap);
    }
    return content;
  });

  // 4. Fold-and-stack: each sheet = front [p+3 | p], back [p+1 | p+2].
  const pageBox = (idx: number | null, side: "eb-left" | "eb-right") => {
    const p = el("div", `eb-page ${side}`);
    if (idx != null) {
      p.appendChild(pageEls[idx].cloneNode(true));
      p.appendChild(el("div", "eb-footer", footerText(meta, idx + 1, total)));
    }
    return p;
  };
  for (const sh of foldStackSheets(total)) {
    const front = el("div", "eb-sheet");
    front.appendChild(pageBox(sh.front[0], "eb-left"));
    front.appendChild(pageBox(sh.front[1], "eb-right"));
    const back = el("div", opts.rotateBack ? "eb-sheet eb-rotated" : "eb-sheet");
    back.appendChild(pageBox(sh.back[0], "eb-left"));
    back.appendChild(pageBox(sh.back[1], "eb-right"));
    root.appendChild(front);
    // A completely empty back (last sheet with only its cover page) is not printed.
    if (sh.back[0] != null || sh.back[1] != null) root.appendChild(back);
  }

  // 5. Print, then clean up.
  const html = document.documentElement;
  html.classList.add("ermate-booklet-print");
  const cleanup = () => {
    html.classList.remove("ermate-booklet-print");
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(cleanup, 10 * 60 * 1000);
  setTimeout(() => window.print(), 150);
  return total;
}

export function readRotateBack(): boolean {
  try { return localStorage.getItem(ROTATE_BACK_KEY) === "1"; } catch { return false; }
}
export function saveRotateBack(v: boolean): void {
  try { localStorage.setItem(ROTATE_BACK_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}