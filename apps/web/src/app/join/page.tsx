import { Suspense } from "react";
import { JoinRoomClient } from "./JoinRoomClient";
import { normalizeRoomCodeForDisplay } from "@/lib/invite-url";

type JoinPageProps = {
  searchParams: Promise<{ code?: string | string[] }>;
};

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.code) ? sp.code[0] : sp.code;
  const displayCode =
    raw !== undefined && raw !== "" ? normalizeRoomCodeForDisplay(raw) : null;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
          <span
            className="loading loading-spinner loading-lg text-primary motion-reduce:!animate-none"
            aria-label="Loading"
          />
        </div>
      }
    >
      <JoinRoomClient initialQueryCode={displayCode} />
    </Suspense>
  );
}
