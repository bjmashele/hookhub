import HookGrid from "@/components/HookGrid";
import { hooks } from "@/lib/hooks";

export default function Home() {
  return (
    <main className="flex-1 bg-linear-to-b from-hero to-background to-[28rem] bg-no-repeat">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1 text-xs font-medium text-accent">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            {hooks.length} open-source hooks
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            hook<span className="text-accent">hub</span>
          </h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            A browsable directory of open-source Claude Code hooks.
          </p>
        </header>
        <HookGrid hooks={hooks} />
      </div>
    </main>
  );
}
