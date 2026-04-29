import { ComponentWsPingDemo } from "@/components/ComponentWsPingDemo";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
      <ComponentWsPingDemo />
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body items-center text-center gap-4">
          <h1 className="card-title text-3xl font-semibold">Skribbl</h1>
          <p className="text-base-content/80">
            Lobby and game UI ship in later stories. This shell confirms Next.js,
            Tailwind, and DaisyUI build in the monorepo.
          </p>
          <div className="card-actions">
            <span className="btn btn-primary btn-disabled" aria-disabled="true">
              Create room (soon)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
