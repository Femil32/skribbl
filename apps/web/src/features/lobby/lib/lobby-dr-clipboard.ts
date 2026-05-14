export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined") {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  if (!navigator.clipboard?.writeText) {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  await navigator.clipboard.writeText(text);
}

export function clipboardFailureMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = String((err as Error).name);
    if (name === "NotAllowedError") {
      return "Copy was blocked. Allow clipboard access for this site, or copy manually.";
    }
  }
  if (
    typeof window !== "undefined" &&
    !window.isSecureContext &&
    window.location.hostname !== "localhost"
  ) {
    return "Copy needs a secure connection (https). You can copy the text manually below.";
  }
  return "Copy is not available in this browser. You can select and copy the text below.";
}
