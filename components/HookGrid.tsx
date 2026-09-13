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
      <div>
        <label htmlFor="hook-search" className="sr-only">
          Search hooks
        </label>
        <input
          id="hook-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or description…"
          autoComplete="off"
          className="w-full max-w-md rounded-lg border border-card-border bg-card px-4 py-2.5 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
        <p className="rounded-xl border border-dashed border-card-border px-6 py-16 text-center text-muted">
          No hooks match “{query.trim()}”.
        </p>
      )}
    </div>
  );
}
