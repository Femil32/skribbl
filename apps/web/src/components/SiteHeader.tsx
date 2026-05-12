"use client";

import Link from "next/link";

function optionalRepoUrl(): string | undefined {
  const v = process.env.NEXT_PUBLIC_REPO_URL?.trim();
  return v || undefined;
}

/**
 * Compact top strip: home link and optional repo shortcut (portfolio cue).
 */
export function SiteHeader() {
  const repoUrl = optionalRepoUrl();

  return (
    <header className="navbar border-b border-base-200 bg-base-100/80 px-4 py-2 backdrop-blur-sm">
      {repoUrl ? (
        <div className="flex-none">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary text-sm"
          >
            Source
          </a>
        </div>
      ) : null}
    </header>
  );
}
