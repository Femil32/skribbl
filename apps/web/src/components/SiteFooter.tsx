"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gameWsUrlToHttpHealthzUrl } from "@/lib/game-ws-url-to-healthz";
import { resolveGameWebSocketUrl } from "@/lib/game-ws-url";

function readOptionalPublicEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

export function SiteFooter() {
  const [healthzHref, setHealthzHref] = useState<string | null>(null);
  const [healthzResolved, setHealthzResolved] = useState(false);

  const repoUrl = readOptionalPublicEnv("NEXT_PUBLIC_REPO_URL");
  const demoUrl = readOptionalPublicEnv("NEXT_PUBLIC_DEMO_URL");
  const docsUrl = readOptionalPublicEnv("NEXT_PUBLIC_DOCS_URL");

  const reserveHealthzRow =
    Boolean(readOptionalPublicEnv("NEXT_PUBLIC_WS_URL")) ||
    process.env.NODE_ENV === "development";

  const showHealthzRow =
    reserveHealthzRow && (!healthzResolved || healthzHref !== null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const ws = resolveGameWebSocketUrl();
      if (!ws) {
        setHealthzResolved(true);
        return;
      }
      try {
        setHealthzHref(gameWsUrlToHttpHealthzUrl(ws));
      } catch {
        setHealthzHref(null);
      } finally {
        setHealthzResolved(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <footer className="footer footer-center mt-auto border-t border-base-200 bg-base-100 p-6 text-base-content">
      <div className="flex max-w-3xl flex-col gap-1 text-center text-sm">
        <p className="font-semibold text-base-content">
          <Link href="/" className="link link-hover link-primary">
            Skribbl
          </Link>
          <span className="text-base-content/80 font-normal">
            {" "}
            — real-time draw & guess (MVP)
          </span>
        </p>

        {repoUrl ? (
          <p className="text-base-content/80">
            <span className="text-base-content/80">Source </span>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary"
            >
              repository
            </a>
          </p>
        ) : null}

        {demoUrl ? (
          <p className="text-base-content/80">
            <span className="text-base-content/80">Demo </span>
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-secondary"
            >
              showcase
            </a>
          </p>
        ) : null}

        {docsUrl ? (
          <p className="text-base-content/80">
            <span className="text-base-content/80">Docs </span>
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-secondary"
            >
              project notes
            </a>
          </p>
        ) : null}

        {showHealthzRow ? (
          <p className="text-base-content/80 min-h-[1.25rem]">
            <span className="text-base-content/80">Game server </span>
            {healthzHref ? (
              <a
                href={healthzHref}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-hover"
              >
                Probe /healthz
              </a>
            ) : (
              <span
                className="inline-block min-h-[1.15em] min-w-[7rem] rounded bg-base-content/10 align-text-bottom"
                aria-busy={!healthzResolved}
              />
            )}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
