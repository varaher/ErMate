// ============================================================
// ErMate — Print one element without touching the live app
// File: src/utils/printElement.ts
// ============================================================
// Copies the element's HTML (plus the page's stylesheets) into a hidden
// iframe and prints that. The running app is never replaced or reloaded,
// so no unsaved work is lost.

export function printElementById(elementId: string, title = "ErMate"): boolean {
  const source = document.getElementById(elementId);
  if (!source) return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return false;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(node => node.outerHTML)
    .join("\n");

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${styles}</head><body class="bg-white text-black">${source.innerHTML}</body></html>`);
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  win.onafterprint = cleanup;
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  }, 400);
  return true;
}
