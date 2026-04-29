import Link from "next/link";
import { ComponentWsPingDemo } from "@/components/ComponentWsPingDemo";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
      <ComponentWsPingDemo />
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body items-center text-center gap-4">
          <h1 className="card-title text-3xl font-semibold">Skribbl</h1>
          <p className="text-base-content/80">
            Create a room to get a shareable link and code. Game rounds ship in
            later stories.
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
