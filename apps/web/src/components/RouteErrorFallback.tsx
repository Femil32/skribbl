"use client";

type RouteErrorFallbackProps = {
  unstable_retry: () => void;
  title?: string;
  body?: string;
  /** Full page reload; default uses `window.location.reload` when defined. */
  reloadPage?: () => void;
};

function AlertOctagonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-12 shrink-0 text-warning"
      aria-hidden
    >
      <path d="M12 16h.01M12 8v4m7.54-3.54-5-5a2.07 2.07 0 0 0-2.92 0l-5 5a2.07 2.07 0 0 0 0 2.92l5 5a2.07 2.07 0 0 0 2.92 0l5-5a2.07 2.07 0 0 0 0-2.92z" />
    </svg>
  );
}

/**
 * Shared App Router segment error UI — calm copy, no raw exception text.
 */
function defaultReloadPage(): void {
  if (typeof window !== "undefined") window.location.reload();
}

export function RouteErrorFallback(props: RouteErrorFallbackProps) {
  const {
    unstable_retry,
    title = "Something went wrong",
    body = "You can try again or reload the page — your progress may resume if the connection is still alive.",
    reloadPage = defaultReloadPage,
  } = props;

  function handleReload() {
    reloadPage();
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center bg-base-200 p-8">
      <div className="card bg-base-100 shadow-xl w-full max-w-lg border border-base-300">
        <div className="card-body gap-4 items-center text-center">
          <div
            className="alert alert-warning w-full flex-col sm:flex-row gap-3 text-left border border-warning/25"
            role="alert"
          >
            <AlertOctagonIcon />
            <div className="min-w-0 w-full">
              <h1 className="font-semibold text-lg text-base-content">{title}</h1>
              <p className="text-sm text-base-content/90 mt-1">{body}</p>
            </div>
          </div>
          <div className="card-actions flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => unstable_retry()}>
              Try again
            </button>
            <button type="button" className="btn btn-outline btn-primary" onClick={handleReload}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
