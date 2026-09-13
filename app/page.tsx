import HookGrid from "@/components/HookGrid";
import { hooks } from "@/lib/hooks";

export default function Home() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">hookhub</h1>
          <p className="mt-2 text-muted">
            A browsable directory of open-source Claude Code hooks.
          </p>
        </header>
        <HookGrid hooks={hooks} />
      </div>
    </main>
  );
}
