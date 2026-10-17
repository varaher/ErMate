/**
 * Copy text (optionally with an HTML flavour) to the clipboard and report honestly whether it worked.
 *
 * Order: rich ClipboardItem (plain + html) -> navigator.clipboard.writeText -> legacy execCommand("copy").
 * Resolves true only when one of them succeeded, so callers can show "Copied" or a visible failure state
 * instead of silently doing nothing (Safari / WebViews / non-secure contexts reject the modern APIs).
 *
 * The first clipboard call is made synchronously (before any await) so it still counts as part of the
 * user's click gesture.
 */
export async function copyTextToClipboard(plain: string, html?: string): Promise<boolean> {
  try {
    if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard && typeof navigator.clipboard.write === "function") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn("Rich clipboard write failed, falling back to plain text:", err);
  }

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(plain);
      return true;
    }
  } catch (err) {
    console.warn("clipboard.writeText failed, falling back to execCommand:", err);
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = plain;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, plain.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok === true;
  } catch (err) {
    console.warn("execCommand copy failed:", err);
    return false;
  }
}
