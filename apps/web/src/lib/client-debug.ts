/**
 * Verbose client diagnostics: dev builds, or production with explicit opt-in
 * (`?debug=1` or `localStorage.skribbl_debug === "1"`).
 *
 * @see _bmad-output/project-context.md — Debug / production gating
 */
export function shouldLogRouteErrors(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage?.getItem("skribbl_debug") === "1") return true;
  } catch {
    /* private mode / denied */
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}
