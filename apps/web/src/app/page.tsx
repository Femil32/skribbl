import Link from "next/link";
import { ComponentWsPingDemo } from "@/components/ComponentWsPingDemo";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-base-200 p-8">
      <ComponentWsPingDemo />
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body items-center text-center gap-4">
          <h1 className="card-title text-3xl font-semibold">Skribbl</h1>
          <p className="text-base-content/80">
            MVP draw-and-guess stack: Next.js shell plus a Node WebSocket game
            server—create a room, invite with a link or code, and play a round.
          </p>
          <div className="card-actions">
            <Link href="/lobby" className="btn btn-primary">
              Create room
            </Link>
            <Link href="/join" className="btn btn-ghost">
              Join a room
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
