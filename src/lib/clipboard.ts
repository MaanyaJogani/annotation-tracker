/** Copy text to clipboard with fallbacks for restricted contexts
 *  (e.g. iframe previews where navigator.clipboard is permission-blocked).
 *  Returns "copied" | "manual" (dialog shown) | "failed". */
export async function copyText(text: string): Promise<"copied" | "manual" | "failed"> {
  if (!text) return "failed";
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) return "copied";
    } catch {
      /* fall through */
    }
    try {
      window.prompt("Clipboard blocked here — copy manually:", text);
      return "manual";
    } catch {
      return "failed";
    }
  }
}
