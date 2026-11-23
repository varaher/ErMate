/**
 * Triggers browser print with an on-screen toast tip reminding doctors
 * to set 'Flip on Long Edge' for double-sided printing.
 */
export function triggerPrintWithTip(customTip?: string): void {
  const tipText = customTip || "Tip: For double-sided printing, select 'Flip on Long Edge' in printer settings";

  // Remove any existing print tip toast
  const existing = document.getElementById("ermate-print-tip-toast");
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.id = "ermate-print-tip-toast";
  toast.className = "no-print";
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    background-color: #0f172a;
    color: #ffffff;
    border: 2px solid #3b82f6;
    padding: 12px 22px;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 90vw;
    text-align: center;
    pointer-events: none;
  `;

  toast.innerHTML = `
    <span style="font-size: 20px;">🖨️</span>
    <span style="letter-spacing: 0.2px;">${tipText}</span>
  `;

  document.body.appendChild(toast);

  // Allow DOM to render the toast before opening the blocking browser print dialog
  setTimeout(() => {
    window.print();
    // Keep visible for ~3.5 seconds total
    setTimeout(() => {
      const el = document.getElementById("ermate-print-tip-toast");
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 3500);
  }, 350);
}


/**
 * BOOK PRINT (handover sheet): lays the sheet out as A5 pages with a fold margin and page numbers.
 * Pick the printer's "Booklet" option (Adobe / printer properties) and double-sided: 4 A5 pages go on one A4 sheet,
 * folded in the middle, so the handover uses about half the sheets. Nothing else changes: the normal print is untouched,
 * the book layout is switched on for this one print and removed afterwards.
 */
export const BOOK_PRINT_CSS = `
@media print {
  @page { size: A5 portrait; margin: 8mm 8mm 11mm 8mm; @bottom-center { content: counter(page) " / " counter(pages); font: 7pt Arial, sans-serif; color: #444; } }
  @page :left { margin: 8mm 10mm 11mm 7mm; }
  @page :right { margin: 8mm 7mm 11mm 10mm; }
  html.ermate-book-print, html.ermate-book-print body, html.ermate-book-print #root, html.ermate-book-print main {
    font-size: 7.6pt !important; line-height: 1.22 !important;
  }
  html.ermate-book-print .print-page h1 { font-size: 10pt !important; letter-spacing: 0 !important; }
  html.ermate-book-print .print-page { padding: 0 !important; }
  html.ermate-book-print .print-card { margin-bottom: 4pt !important; border-width: 1px !important; border-radius: 4px !important; }
  html.ermate-book-print .print-card * { font-size: 7.6pt !important; line-height: 1.22 !important; }
  html.ermate-book-print .print-card-header, html.ermate-book-print .print-card-header * { font-size: 8.6pt !important; }
  html.ermate-book-print .print-card [class*="uppercase"] { font-size: 6.6pt !important; }
  html.ermate-book-print .print-section, html.ermate-book-print .print-card .border-b { padding: 2pt 4pt !important; }
  html.ermate-book-print .print-mirror-div { font-size: 7.6pt !important; line-height: 1.25 !important; }
}
`;

export function triggerBookPrint(): void {
  const root = document.documentElement;
  const style = document.createElement("style");
  style.id = "ermate-book-print-style";
  style.textContent = BOOK_PRINT_CSS;
  // Last in the document so its @page wins over the normal A4 rules.
  document.body.appendChild(style);
  root.classList.add("ermate-book-print");
  const cleanup = () => {
    root.classList.remove("ermate-book-print");
    style.parentNode?.removeChild(style);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(cleanup, 10 * 60 * 1000); // safety net if the browser never fires afterprint
  triggerPrintWithTip("Book print: choose double-sided and the printer's \u2018Booklet\u2019 option. Pages fold into an A5 book.");
}