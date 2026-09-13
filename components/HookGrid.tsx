"use client";

import { useMemo, useState } from "react";
import HookCard from "@/components/HookCard";
import type { Hook } from "@/lib/types";

export default function HookGrid({ hooks }: { hooks: readonly Hook[] }) {
  const [query, setQuery] = useState("");

  // Lowercase once per hook, not on every keystroke (spec §5.1). Imports only
  // the Hook type so the catalog JSON isn't bundled a second time.
  const haystacks = useMemo(
    () => hooks.map((h) => `${h.name} ${h.description}`.toLowerCase()),
    [hooks],
  );

  const q = query.trim().toLowerCase();
  const visible = q ? hooks.filter((_, i) => haystacks[i].includes(q)) : hooks;

  return (
    <div className="flex flex-col gap-8">
      <div className="relative w-full max-w-md">
        <label htmlFor="hook-search" className="sr-only">
          Search hooks
        </label>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-accent"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
        <input
          id="hook-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or description…"
          autoComplete="off"
          className="w-full rounded-lg border border-card-border bg-card py-2.5 pr-4 pl-10 text-sm shadow-sm shadow-accent/5 transition-colors placeholder:text-muted hover:border-accent focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      {visible.length > 0 ? (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((hook) => (
            <li key={hook.slug}>
              <HookCard hook={hook} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-card-border bg-card-muted px-6 py-16 text-center text-muted">
          No hooks match “<span className="font-medium text-accent">{query.trim()}</span>”.
        </p>
      )}
    </div>
  );
}
