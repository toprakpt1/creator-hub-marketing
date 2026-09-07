import { toast } from "sonner";

/**
 * The async Clipboard API can hang indefinitely — it never resolves and never
 * rejects when the document is not focused, when the page runs inside a tunnel
 * or preview frame, or when permission is pending. Awaiting it bare means a
 * `try/catch` runs neither branch and the user gets no feedback at all.
 *
 * So: race it against a timeout, then fall back to the legacy selection copy,
 * and always report an outcome.
 */
const CLIPBOARD_TIMEOUT_MS = 1200;

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    const previous = document.getSelection()?.rangeCount
      ? document.getSelection()!.getRangeAt(0)
      : null;

    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (previous) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(previous);
    }
    return ok;
  } catch {
    return false;
  }
}

/** Copies text to the clipboard. Always settles — never hangs. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      const wrote = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), CLIPBOARD_TIMEOUT_MS)),
      ]);
      if (wrote) return true;
    } catch {
      /* fall through to the legacy path */
    }
  }

  return legacyCopy(text);
}

/**
 * Copies and always shows a toast, so a copy control can never be a dead
 * button. `label` names the thing being copied, e.g. "Channel URL".
 */
export async function copyWithToast(text: string, label: string): Promise<boolean> {
  if (!text) {
    toast.error(`Nothing to copy`);
    return false;
  }
  const ok = await copyToClipboard(text);
  if (ok) {
    toast.success(`${label} copied`);
  } else {
    toast.error(`Could not copy ${label}`, {
      description: "Your browser blocked clipboard access — select and copy manually.",
    });
  }
  return ok;
}
