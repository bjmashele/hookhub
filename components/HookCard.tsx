import Link from "next/link";
import type { Hook } from "@/lib/types";

export default function HookCard({ hook }: { hook: Hook }) {
  return (
    <Link
      href={`/hooks/${hook.slug}`}
      className="flex h-full flex-col gap-3 rounded-xl border border-card-border bg-card p-5 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold leading-snug">{hook.name}</h2>
        <span className="shrink-0 rounded-full bg-card-muted px-2.5 py-0.5 text-xs font-medium">
          {hook.category}
        </span>
      </div>
      <p className="line-clamp-3 text-sm leading-6 text-muted">{hook.description}</p>
      <code className="mt-auto self-start rounded-md bg-card-muted px-2 py-1 font-mono text-xs">
        {hook.event}
      </code>
    </Link>
  );
}
