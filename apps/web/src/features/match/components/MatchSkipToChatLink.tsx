/**
 * Optional skip navigation (UX-DR16) — visible only when focused; targets `#match-chat-composer`.
 */
export function MatchSkipToChatLink() {
  return (
    <a
      href="#match-chat-composer"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[4.25rem] focus:z-[60] focus:rounded-btn focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-content focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100"
    >
      Skip to chat
    </a>
  );
}
