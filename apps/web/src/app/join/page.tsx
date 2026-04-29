import Link from "next/link";
import { JoinCodeEntry } from "./JoinCodeEntry";
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body gap-4 text-center">
          <h1 className="card-title text-2xl justify-center">Join a room</h1>
          <p className="text-base-content/80">
            You opened an invite link. Full join flow (nickname, roster) arrives
            in later stories.
          </p>
          {displayCode ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-base-content/70">
                Room code from link
              </p>
              <p className="font-mono text-2xl tracking-widest bg-base-200 rounded-box px-3 py-3 border border-base-300">
                {displayCode}
              </p>
            </div>
          ) : (
            <>
              <div className="alert alert-info">
                <span>
                  Open an invite link from your host (it includes{" "}
                  <span className="font-mono">?code=</span> in the address bar), or
                  enter a code below.
                </span>
              </div>
              <JoinCodeEntry />
            </>
          )}
          <div className="card-actions justify-center">
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
            <Link href="/lobby" className="btn btn-primary">
              Create a room
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
