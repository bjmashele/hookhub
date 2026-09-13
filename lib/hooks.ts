import rawHooks from "@/data/hooks.json";
import {
  HOOK_CATEGORIES, HOOK_EVENTS,
  type Hook, type HookCategory, type HookEvent,
} from "@/lib/types";

type RawHook = (typeof rawHooks)[number];

function narrow(raw: RawHook): Hook {
  if (!(HOOK_CATEGORIES as readonly string[]).includes(raw.category)) {
    throw new Error(`hooks.json: "${raw.slug}" has unknown category "${raw.category}"`);
  }
  if (!(HOOK_EVENTS as readonly string[]).includes(raw.event)) {
    throw new Error(`hooks.json: "${raw.slug}" has unknown event "${raw.event}"`);
  }
  return { ...raw, category: raw.category as HookCategory, event: raw.event as HookEvent };
}

export const hooks: readonly Hook[] = rawHooks.map(narrow);

const bySlug = new Map(hooks.map((hook) => [hook.slug, hook]));
export function getHook(slug: string): Hook | undefined {
  return bySlug.get(slug);
}

export function searchHooks(all: readonly Hook[], query: string): readonly Hook[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (h) =>
      h.name.toLowerCase().includes(q) ||
      h.description.toLowerCase().includes(q),
  );
}
