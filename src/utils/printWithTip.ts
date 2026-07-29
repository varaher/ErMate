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
