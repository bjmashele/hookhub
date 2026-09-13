import Link from "next/link";
import type { Hook } from "@/lib/types";

export default function HookCard({ hook }: { hook: Hook }) {
  return (
    <Link
      href={`/hooks/${hook.slug}`}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-card-border bg-card p-5 shadow-sm shadow-accent/5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-accent to-badge opacity-60 transition-opacity group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold leading-snug transition-colors group-hover:text-accent">
          {hook.name}
        </h2>
        <span className="shrink-0 rounded-full bg-badge px-2.5 py-0.5 text-xs font-medium text-badge-foreground">
          {hook.category}
        </span>
      </div>
      <p className="line-clamp-3 text-sm leading-6 text-muted">{hook.description}</p>
      <code className="mt-auto self-start rounded-md border border-card-border bg-card-muted px-2 py-1 font-mono text-xs text-accent">
        {hook.event}
      </code>
    </Link>
  );
}
