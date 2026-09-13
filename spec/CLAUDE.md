# hookhub — MVP Specification

**Status:** Draft · **Version:** 0.1 (MVP) · **Last updated:** 2026-09-12

---

## 1. Overview

**hookhub is a browsable directory of open-source Claude Code hooks.**

Claude Code hooks are shell commands and handlers that fire at points in the Claude Code
lifecycle — `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SessionStart` and others —
configured under the `hooks` key of `.claude/settings.json`. They are how developers add
deterministic behaviour to an otherwise non-deterministic agent: auto-format every file
Claude edits, block a destructive `rm -rf`, play a sound when a long task finishes.

Good hooks exist, but they are scattered across individual GitHub repositories, buried in
`.claude/hooks/` directories, and discovered mostly by word of mouth. There is no single
place to browse them.

hookhub is that place.

### 1.1 MVP goal

**Display the hooks.** A visitor lands on the home page, sees a grid of hook cards, can
narrow it with a text search, and can click through to a detail page that explains the hook
and links out to its source repository.

That is the entire MVP. Everything else is deferred (§10).

### 1.2 Non-goals — permanent

- **hookhub hosts no hook code.** Every entry is a pointer to an upstream repository. We
  never vendor, mirror, or re-publish someone's hook source. This keeps attribution intact,
  keeps the catalog honest as upstream hooks change, and keeps hookhub out of the business
  of distributing executable code.
- **Listing is not endorsement.** See §9.

---

## 2. Data model

### 2.1 The `Hook` type

Defined in `lib/types.ts` (types and vocabularies), consumed via `lib/hooks.ts` (§2.3):

```ts
export const HOOK_CATEGORIES = [
  "formatting", "testing", "security", "notifications",
  "git-workflow", "context", "observability",
] as const;
export type HookCategory = (typeof HOOK_CATEGORIES)[number];

export const HOOK_EVENTS = [
  "PreToolUse", "PostToolUse", "PostToolUseFailure", "UserPromptSubmit",
  "SessionStart", "SessionEnd", "Stop", "SubagentStop",
  "Notification", "PreCompact", "PermissionRequest", "FileChanged",
] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface Hook {
  /** URL segment — unique, lowercase, kebab-case. Powers /hooks/[slug]. */
  slug: string;
  /** Display name, e.g. "Dangerous Command Guard". */
  name: string;
  category: HookCategory;
  /** One or two sentences. Shown on the card and the detail page. */
  description: string;
  /** The Claude Code lifecycle event this hook binds to. Rendered as a badge. */
  event: HookEvent;
  /** Link to the hook's source on GitHub — repo, directory, file, or gist. */
  repoUrl: string;
}
```

The `as const` arrays, not bare unions, are deliberate: they are runtime values, so §2.3 can
validate against them and a future category-filter UI can iterate them. One line now, no
refactor later.

### 2.2 Field notes

Four fields were specified for the MVP: `name`, `category`, `description`, `repoUrl`. Two
more are included, each justified:

| Field | Why it's here |
|---|---|
| `slug` | **Required.** The detail route needs a stable URL key. Deriving it from `name` means every rename silently breaks existing links, so it is stored explicitly and treated as immutable once published. |
| `event` | **Required — proposed addition.** A Claude Code hook is *defined* by the event it binds to; "runs Prettier" is meaningless without "on `PostToolUse`". Without it the detail page shows the same four fields as the card and has no reason to exist. Required rather than optional for a type-inference reason — see §2.3. |

Deliberately **not** added: author, star count, language, license, tags, date added. Each is
either a network call (cut by the static-data decision) or unused by any MVP surface.

### 2.3 Storage and typing

The catalog lives in **`data/hooks.json`** — a single committed JSON array. Adding a hook is
a pull request that edits one file. No database, no API, no runtime network calls.

`tsconfig.json` already sets `resolveJsonModule: true`, so the JSON imports directly. But it
imports **widened**: `category` comes back as `string`, not `HookCategory`. A typo'd
`"formating"` compiles clean and surfaces as a missing badge at render time.

Two obvious fixes both fail:

- **`satisfies Hook[]`** errors immediately — `string` is not assignable to `HookCategory` —
  so it rejects every entry whether correct or not. `satisfies` only works on a literal
  expression in the same file, which an imported JSON module is not.
- **`as Hook[]`** is an unchecked assertion that silences precisely the errors worth having.

**The fix: narrow through a real runtime check, once, in `lib/hooks.ts`.**

```ts
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
```

Every page is statically prerendered, so this module runs **at build time**. A bad category
fails `npm run build` with a message naming the offending slug. In a repo with no test
runner, that is the safety net — and the assertions after the checks are sound rather than
hopeful.

> **Hard constraint on `data/hooks.json`: every entry must have all six keys.** If one entry
> omits `event`, TypeScript infers `(typeof rawHooks)[number]` as a *union* of two object
> shapes and `raw.event` stops resolving. This is why `event` is required, not optional.

Every consumer imports from `lib/hooks.ts`, never from the JSON directly. The JSON stays the
single source of truth; the module is the only place that knows its shape.

> **Known gap:** the check above does not enforce `slug` uniqueness or URL reachability. A
> fuller validator is deferred (§10). Adding a duplicate-slug check to `narrow` is a
> three-line extension if you want it in the MVP.

---

## 3. Category taxonomy

A closed union of seven values, grounded in what hooks actually do in the wild:

| Category | What belongs here | Typical events |
|---|---|---|
| `formatting` | Auto-format files Claude edits — prettier, gofmt, black | `PostToolUse` |
| `testing` | Linters, type checkers, test runners triggered on edit | `PostToolUse` |
| `security` | Guards that block dangerous operations or secret leakage | `PreToolUse`, `PermissionRequest` |
| `notifications` | Sound, TTS, desktop and phone alerts | `Notification`, `Stop`, `SubagentStop` |
| `git-workflow` | Auto-commit, branch guards, WIP snapshots | `Stop`, `PreToolUse` |
| `context` | Inject project context into the session | `SessionStart`, `UserPromptSubmit` |
| `observability` | Logging, transcript capture, metrics | `PostToolUse`, `PreCompact` |

Typed as a union rather than a plain string so that a typo in `hooks.json` fails
`npm run build` instead of rendering an empty badge in production.

**Categories are display-only in the MVP.** They appear as a badge on each card. Filtering
by category is explicitly deferred (§10).

---

## 4. Routes

| Route | File | Rendering |
|---|---|---|
| `/` | `app/page.tsx` *(rewrite)* | Server Component — static |
| `/hooks/[slug]` | `app/hooks/[slug]/page.tsx` *(new)* | Server Component — statically generated per hook |

### 4.1 Home page — `/`

A header (product name, one-line description), a search input, and the hook grid.

`app/page.tsx` stays a **Server Component**. It imports `hooks` from `lib/hooks.ts` and
passes the array to the client grid component. The current scaffold contents — the Next.js
logo, "To get started, edit the page.tsx file", the Deploy/Documentation buttons — are
replaced wholesale.

### 4.2 Detail page — `/hooks/[slug]`

Shows the hook's name, category badge, event badge, full description, a prominent **View on
GitHub** link, the security advisory (§9), and a back link to the grid.

```tsx
// app/hooks/[slug]/page.tsx
import { notFound } from "next/navigation";
import { hooks, getHook } from "@/lib/hooks";

export const dynamicParams = false;

export function generateStaticParams() {
  return hooks.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata(props: PageProps<"/hooks/[slug]">) {
  const { slug } = await props.params;
  const hook = getHook(slug);
  if (!hook) return {};
  return { title: `${hook.name} — hookhub`, description: hook.description };
}

export default async function HookDetailPage(props: PageProps<"/hooks/[slug]">) {
  const { slug } = await props.params;
  const hook = getHook(slug);
  if (!hook) notFound();
  // ...
}
```

Three things in that snippet are **Next.js 16 specific** and differ from what older
knowledge would produce:

1. **`params` is a Promise.** `const { slug } = await props.params`. The Next 14/15 pattern
   `function Page({ params }) { params.slug }` is a hard error in this version. The same
   applies to `searchParams`.
2. **`PageProps<"/hooks/[slug]">` is a generated global type** — no import. It is generated
   into `.next/types` by `next dev`, `next build`, or `npx next typegen`, which has ordering
   consequences (§8).
3. **`export const dynamicParams = false`** means any slug not returned by
   `generateStaticParams` returns a 404 automatically. Since the catalog is fully known at
   build time, this is correct and makes the entire route tree static. The `notFound()` call
   is kept as a belt-and-braces guard for dev-mode navigation.

Unknown slugs fall through to Next's default 404. A custom `app/not-found.tsx` is optional
polish, not required.

---

## 5. Components and the client boundary

The data is fully static; only the search is interactive. The boundary is placed to keep
that the only client-side code.

```
app/page.tsx                 Server  — reads lib/hooks.ts, renders header, passes data down
└── components/HookGrid.tsx  Client  — "use client"; owns search state, filters, renders grid
    └── components/HookCard.tsx      — presentational card, wrapped in next/link
```

- **`HookGrid`** carries the only `"use client"` directive in the application. It takes
  `hooks: readonly Hook[]` as a prop, holds `const [query, setQuery] = useState("")`, renders
  the search input, and maps `searchHooks(hooks, query)` to cards.
- **`HookCard`** is presentational: name, category badge, event chip, truncated description.
  The whole card is a `next/link` to `/hooks/${hook.slug}`.
- **`app/page.tsx` takes no props at all** — `export default function Home()`, the same empty
  signature the scaffold has. This is a direct consequence of the §5.1 search decision, and
  it is what keeps `/` statically prerendered (§11.1).
- **Empty state:** when a search matches nothing, the grid renders a short "No hooks match
  <query>" message rather than a bare empty area.

> **RSC subtlety worth stating outright:** `HookCard` carries no `"use client"` directive,
> but because it is imported and rendered *by* a Client Component it is compiled into the
> client bundle. It is not "a Server Component inside a Client Component" — that arrangement
> is only reachable through the `children`/props slot pattern.
>
> The slot pattern was considered and rejected. Passing pre-rendered cards as `children`
> would keep them on the server, but then `HookGrid` holds opaque `ReactNode`s and cannot
> filter on name or description — you would smuggle in a parallel array of search strings and
> filter by index. `HookCard` is pure presentation with no server-only dependencies, so
> shipping it costs roughly a kilobyte. Accept the boundary at `HookGrid`.

### 5.1 Search: client-side, and why

**Decision: filter in the browser with `useState`.** No `searchParams`, no
`useSearchParams`, no router involvement. Reasons, in order of weight:

1. **Reading `searchParams` in `app/page.tsx` makes the home page dynamic.** It opts out of
   static prerendering, so the one page that should be a static HTML file becomes
   server-rendered per request. For a static directory site that is a straight regression —
   and it is visible in the build output, which is why §11.1 makes it an acceptance test.
2. **The server-side version doesn't remove the client boundary anyway.** You still need a
   Client Component to call `router.replace` on input, or a `<form>` that navigates. It adds
   a round trip *on top of* the boundary it was supposed to eliminate.
3. **`useSearchParams` is worse still.** On a prerendered route it forces the client tree up
   to the nearest `<Suspense>` to be client-rendered, and you have to add that boundary
   yourself. More machinery, no benefit at this scale.
4. **The data is already in the payload.** Every hook ships in the initial RSC payload
   regardless. Filtering locally is free; asking a server about them is not.

Implementation notes: precompute one lowercased `"${name} ${description}"` haystack per hook
in a `useMemo` rather than lowercasing on every keystroke. **No debounce** — a local
`Array.filter` over single-digit entries is not something to debounce. If the catalog ever
passes a few hundred entries, `useDeferredValue(query)` is the escape hatch; don't add it
now.

Matching is case-insensitive substring over `name` and `description`. No fuzzy matching, no
ranking, no highlighting.

**Trade-offs, stated honestly:** search state is not bookmarkable or shareable, and is not
restored when navigating back from a detail page. Both are acceptable for the MVP. The
upgrade path adds `useSearchParams` + `router.replace(…, { scroll: false })` *inside the same
`HookGrid`* — the client boundary does not move, which is the point of putting it there.

Because `page.tsx` is a Server Component, the initial HTML contains every card: browsing
works with JavaScript disabled, and only filtering doesn't.

---

## 6. Styling

Tailwind CSS v4, which is **CSS-configured** — there is no `tailwind.config.*` in this
project and none should be added. Theme values go in the `@theme inline` block in
`app/globals.css`.

### 6.1 Tokens

Extend the existing block with card-surface tokens, following the pattern already there —
declare on `:root`, override under `prefers-color-scheme: dark`, map into `@theme inline`:

```css
:root {
  color-scheme: light dark;
  --background: #ffffff;
  --foreground: #171717;
  --card: #ffffff;
  --card-muted: #f4f4f5;   /* badge and code-chip fill */
  --card-border: #e4e4e7;
  --muted: #71717a;
  --accent: #4f46e5;       /* links, focus ring */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
    --card: #111113;
    --card-muted: #18181b;
    --card-border: #27272a;
    --muted: #a1a1aa;
    --accent: #818cf8;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-muted: var(--card-muted);
  --color-card-border: var(--card-border);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

**Rule for all new components: use the semantic tokens, write zero `dark:` utilities.**
Because the light and dark values swap on `:root` and `@theme inline` only forwards them,
`bg-card` is already correct in both themes. Contrast that with the scaffold's `page.tsx`,
which sprays `dark:bg-black dark:text-zinc-50` across every element — that approach doubles
every colour decision and is what gets deleted here.

`color-scheme: light dark` is a cheap win that is usually missed: it makes native controls
(the `<input type="search">` clear button, scrollbars) follow the theme.

### 6.2 Scaffold bug to fix

`app/globals.css` currently ends with:

```css
body { font-family: Arial, Helvetica, sans-serif; }
```

This hardcodes Arial over the Geist font the layout loads, so Geist only applies where a
`font-sans` class is set explicitly. Point `body` at the token instead:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
}
```

### 6.3 Layout

- Page container: `max-w-6xl mx-auto px-6 py-12`. The scaffold's `max-w-3xl` with
  `py-32 px-16` and `justify-between` is a single-column marketing layout and does not
  survive the rewrite.
- Grid: `grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3`. Do not add
  `xl:grid-cols-4` — at nine hooks a 4-up row leaves an awkward remainder and squeezes the
  card text.
- Card: `h-full` (equal heights across a row with no fixed height), rounded border in
  `--color-card-border` over `--color-card`, hover lifting the border to `--color-accent`.
  Name in `font-semibold`, category badge top-right, description in `--color-muted`
  `line-clamp-3`, event chip pinned to the bottom with `mt-auto` so chips align across a row
  regardless of description length.
- Keep the scaffold's `<body className="min-h-full flex flex-col">` and give the page
  `<main className="flex-1">` so a future footer pins to the bottom.

### 6.3.1 Tailwind v4 gotchas

Three things that differ from v3 habits and will cost time otherwise:

- **Class names cannot be built dynamically.** `` className={`bg-${category}-100`} `` will
  never work — the v4 scanner reads source text and never sees the composed string. If
  per-category badge colours are ever wanted, map them with a static
  `Record<HookCategory, string>` of complete literal class strings. The MVP sidesteps this
  entirely by using one neutral badge style for all categories.
- **`line-clamp-3` is core in v4.** Don't go looking for `@tailwindcss/line-clamp`; the v3
  plugin is obsolete.
- **Use `focus-visible:outline-*`, not `focus:ring-*`.** The `outline-*` utilities changed
  meaningfully in v4, and outline is the accessibility-correct treatment for a link.

### 6.4 Dark mode

**System-driven only**, via `prefers-color-scheme`, exactly as the scaffold already works.

A manual light/dark toggle is **out of scope** (§10). Document rather than build the upgrade
path: replace the media query with `@custom-variant dark (&:where(.dark, .dark *));` plus a
`.dark { … }` override block, and add an inline script to avoid a flash of the wrong theme.

Because of the token discipline in §6.1, that future change touches **only `globals.css` and
one new toggle component — zero component edits.** That payoff is the whole reason for the
"no `dark:` utilities" rule.

### 6.5 Accessibility floor

Not a full audit, but the MVP must clear these:

- The search input has a real `<label>` (visually hidden is fine).
- Card links have discernible text — the hook name is the accessible name.
- **Never nest the outbound GitHub `<a>` inside the card `<Link>`.** Nested interactive
  elements are invalid HTML and an accessibility failure. The whole card is one link and one
  tab stop; the GitHub link lives on the detail page only.
- Outbound links use `target="_blank"` with `rel="noopener noreferrer"`.
- Focus rings are visible on cards and the search input, in **both** themes.
- Body text meets 4.5:1 contrast in both themes; `--muted` is checked against both grounds.

---

## 7. Seed data

Ship **nine real hooks** in `data/hooks.json`. Nine fills the 3-column grid as an exact 3×3 —
eight leaves a ragged row that reads as broken — and gives search enough vocabulary to
actually discriminate between entries during the §11.3 checks.

**Invented entries and placeholder URLs are not acceptable.** hookhub's entire value
proposition is "this link goes to a real hook"; a dead link is worse than an empty
directory. Every `repoUrl` must be opened and confirmed to contain the hook it claims before
the entry lands. If a real source can't be found for one of the rows below, drop the row
rather than inventing a URL.

The rows below were researched against live repositories, but **re-verify each URL at
implementation time** — upstream repos move and rename.

Researched starting catalog:

| Name | Category | Event | Source |
|---|---|---|---|
| Dangerous Command Guard | `security` | `PreToolUse` | `disler/claude-code-hooks-mastery` — blocks `rm -rf` and `.env` access |
| Ruff Validator | `testing` | `PostToolUse` | `disler/claude-code-hooks-mastery` — Python lint on write |
| Type Check Validator | `testing` | `PostToolUse` | `disler/claude-code-hooks-mastery` — type check on write |
| TTS Completion Announcer | `notifications` | `Stop` | `disler/claude-code-hooks-mastery` — speaks when Claude finishes |
| Subagent Complete Chime | `notifications` | `SubagentStop` | `disler/claude-code-hooks-mastery` |
| Session Context Loader | `context` | `SessionStart` | `disler/claude-code-hooks-mastery` — injects git status and open issues |
| Transcript Backup | `observability` | `PreCompact` | `disler/claude-code-hooks-mastery` — backs up transcript before compaction |
| Permission Auditor | `security` | `PermissionRequest` | `disler/claude-code-hooks-mastery` — auto-allows read-only tools |
| Completion Sound | `notifications` | `Notification` | `pascalporedda/awesome-claude-code` |

This list is a starting point, and it is **thin on `formatting` and `git-workflow`** — two of
the seven categories currently have no entry. Before launch, either find real hooks for them
(`PostToolUse` formatters and `Stop` auto-commit hooks are common in the wild) or shrink the
taxonomy to match what actually exists. Shipping a category vocabulary with empty members is
the kind of thing that looks like a bug.

**Write descriptions so search has something to find.** Each description should contain
distinguishing vocabulary that does not appear in the name — mention "Python" in the Ruff
entry, "credential" in the secret-scanning entry. This is what makes the §11.3 search checks
meaningful rather than tautological.

Example entry — note all six keys are present, per §2.3:

```json
{
  "slug": "dangerous-command-guard",
  "name": "Dangerous Command Guard",
  "category": "security",
  "description": "Intercepts tool calls before they run and blocks destructive commands like rm -rf along with reads of .env files.",
  "repoUrl": "https://github.com/disler/claude-code-hooks-mastery",
  "event": "PreToolUse"
}
```

---

## 8. Implementation sequence

### 8.1 File tree

```
hookhub/
├── data/
│   └── hooks.json               NEW      the catalog; the only file a contributor edits
├── lib/
│   ├── types.ts                 NEW      Hook, HOOK_CATEGORIES, HOOK_EVENTS
│   └── hooks.ts                 NEW      narrows the JSON at build time; getHook, searchHooks
├── components/
│   ├── HookCard.tsx             NEW      presentational card (client-compiled — see §5)
│   └── HookGrid.tsx             NEW      the ONLY "use client" file: search input + grid
├── app/
│   ├── globals.css              MODIFY   tokens, color-scheme, body font fix
│   ├── layout.tsx               MODIFY   real metadata with a title template
│   ├── page.tsx                 REWRITE  propless Server Component
│   ├── not-found.tsx            NEW      themed 404
│   └── hooks/[slug]/page.tsx    NEW      detail route
├── README.md                    MODIFY   "Adding a hook" contributor section
└── CLAUDE.md                    MODIFY   architecture section (no longer "scaffold stage")
```

**Deliberately unchanged:** `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
`tsconfig.json`. Nothing in this MVP needs new configuration. The scaffold SVGs in `public/`
become unused once `app/page.tsx` is rewritten; deleting them is optional cleanup.

### 8.2 Order of work

Ordered so the typegen dependency does not block anything.

**Step 0 — baseline.** Run `npx next typegen` once and look at `.next/types/routes.d.ts`. It
currently reads `type AppRoutes = "/"` — a single literal. That is the cliff; know its shape
before you walk up to it.

1. **`lib/types.ts`** — `HOOK_CATEGORIES`, `HOOK_EVENTS`, `Hook`.
2. **`data/hooks.json`** — seed catalog (§7), uniform six-key shape on every entry.
3. **`lib/hooks.ts`** — the narrowing module (§2.3). Verify with `npx tsc --noEmit`. Then
   prove the guardrail: typo a category, confirm you get a thrown error naming the slug,
   revert.
4. **`app/globals.css`** — tokens, `color-scheme`, fix the `body` font-family (§6.2).
5. **`app/layout.tsx`** — replace the placeholder metadata (`"Create Next App"` /
   `"Generated by create next app"`) with hookhub's title and description.
6. **`components/HookCard.tsx`**, then **`components/HookGrid.tsx`**.
7. **`app/page.tsx`** — rewrite. `/` now works end to end, searchable and theme-correct, and
   **nothing so far has touched `PageProps`** — that is the payoff of keeping the home page
   propless. Verify before moving on.
8. **`app/hooks/[slug]/page.tsx`** — in three sub-steps, in this order:
   - **8a.** Create it as a **propless stub**: `export default function Page() { return null; }`.
     This puts the file on disk for typegen to see, with no route literal to fail on.
   - **8b.** Run `npx next typegen` (or leave `next dev` running — it regenerates on file
     add). Confirm `AppRoutes` now includes `"/hooks/[slug]"`.
   - **8c.** *Now* write the real implementation using `PageProps<"/hooks/[slug]">`.
9. **`app/not-found.tsx`** — without it you get Next's unstyled default 404, which looks
   broken next to a themed site. Fifteen lines and a link home.

> **Typegen gotcha — the reason for step 8's ordering.** `PageProps<"/hooks/[slug]">` is
> generated into `.next/types` from the route tree. Write it before typegen has seen the
> route and you get `Type '"/hooks/[slug]"' does not satisfy the constraint '"/"'`. Do **not**
> work around it by hand-writing `{ params: Promise<{ slug: string }> }` — it compiles, but
> it contradicts the convention recorded in `CLAUDE.md`.
>
> **Second-order trap:** if the editor still shows an error after typegen, restart the
> TypeScript server (VS Code: *TypeScript: Restart TS Server*). The generated `.d.ts` changed
> on disk and the language server caches it.

**Optional but recommended:** add `"type-check": "next typegen && tsc --noEmit"` to
`package.json`. It is the only way to typecheck route literals in CI without a full build.

**Docs to update when done:** a README "Adding a hook" section (edit one file, six required
keys, open a PR), and the `## Architecture` section of `CLAUDE.md`, which currently says the
project is "at the `create-next-app` scaffold stage" and will be stale.

---

## 9. Security advisory — a content requirement

A hook is an **arbitrary shell command that runs on a developer's machine with that
developer's privileges**, triggered automatically by agent activity. A directory that makes
finding and installing them one click easier has an obligation that a normal link list does
not.

The MVP must therefore include:

1. **A standing advisory on every hook detail page**, in the visible layout — not a footer,
   not a tooltip — telling the reader to review a hook's source before installing it.
2. **An explicit "listing is not endorsement" statement.** Entries are catalogued, not
   audited. hookhub makes no claim that any listed hook is safe.

Suggested wording:

> ⚠️ **Review before you install.** Hooks run shell commands on your machine automatically.
> Read the source in the linked repository before adding a hook to your `settings.json`.
> Listing here is not an endorsement or a security audit.

This is a product requirement with a checkbox in review, not decoration.

---

## 10. Out of scope for the MVP

Deferred deliberately. Each is a real feature; none is needed to display hooks.

**Product**
- Submitting a hook through the UI (MVP path: open a PR against `data/hooks.json`)
- User accounts, auth, favourites
- Ratings, comments, upvotes
- Category filter chips — *cut explicitly; category is display-only in the MVP*
- Sorting and pagination
- Copy-to-clipboard `settings.json` install snippets

**Technical**
- Any database
- GitHub API integration — stars, last-commit date, owner avatars, link liveness checks
- A manual dark/light toggle (system preference only — §6.4)
- A fuller validator for `data/hooks.json` — unique slugs and reachable URLs. Category and
  event values *are* validated at build time (§2.3); the rest is deferred.
- Images of any kind. Zero images ship, so `next.config.ts` needs no `images.remotePatterns`
  and the Next 16 narrowing of `images.qualities` to `[75]` is irrelevant here. The
  scaffold's `<Image>` usage is deleted outright.
- Tests. No runner is configured in this project; adding one is its own task.
- Analytics, search indexing, sitemap, OG images

---

## 11. Verification

Run from the repo root.

```bash
npx next typegen      # regenerates .next/types after adding the detail route
npx tsc --noEmit      # strict typecheck, including the JSON -> Hook narrowing
npm run lint          # bare eslint, flat config, no args
npm run build         # also typechecks and runs the hooks.json validation
npm run start         # production server, for the 404 check below
```

### 11.1 Build output — two acceptance tests

- **`/` must be marked static (`○`), not dynamic (`ƒ`).** If it shows dynamic, something is
  reading `searchParams`, `headers`, or `cookies` — exactly the regression that client-side
  search exists to prevent. This single line of build output is the acceptance test for §5.1.
- **`/hooks/[slug]` must be marked SSG (`●`)** with one prerendered path per hook listed. If
  it shows dynamic, `generateStaticParams` is not wired up.

### 11.2 Prove the data guardrail

There is no test runner, so run this one by hand: temporarily change a `category` in
`data/hooks.json` to `"formating"`, run `npm run build`, confirm it **fails** with a message
naming the offending slug, then revert. If it builds clean, §2.3 is not doing its job.

### 11.3 In the browser

| Check | Expected |
|---|---|
| Home page | Grid of all seeded hooks, each with name, category badge, description, event chip |
| Responsive | 1 column on mobile, 2 at `sm` (~640px), 3 at `lg` (~1024px) |
| Search — name | `prettier` → only the Prettier card |
| Search — description | `python` → only the Ruff card. This is the real test: "python" appears nowhere in that hook's *name*, so a hit proves description search works |
| Search — empty state | `zzz` → "No hooks match" message; layout does not collapse. Clearing restores all |
| Keyboard | Tab through the grid: exactly one tab stop per card, focus outline clearly visible in both themes |
| Card click | Navigates to `/hooks/<slug>`; browser tab title reads "<Hook Name> — hookhub", proving the metadata `template` |
| Detail page | Correct content, visible security advisory (§9), **View on GitHub** opening the right repo in a new tab |
| Unknown slug | `/hooks/does-not-exist` — check the **Network tab shows status 404**, not merely that 404 content rendered. A 200-with-404-body is a real SEO bug. Test against `npm run start`, not `next dev`, since `dynamicParams: false` is not enforced identically in dev |
| Dark mode | DevTools → Rendering → *Emulate prefers-color-scheme: dark*, or flip the OS theme. Card borders must stay visible rather than black-on-black; badge contrast holds; the `<input type="search">` native chrome flips, which confirms `color-scheme` took effect |
| No-JS | View source on `/` with JavaScript disabled — all cards present in the initial HTML. Proves the server rendered them and the client boundary covers filtering only |
| Fonts | Text renders in Geist, not Arial (confirms §6.2 is fixed) |

---

## 12. Open questions

1. **`event` field** — keep it, or hold the MVP to the four originally specified fields? If
   it goes, the detail page shows exactly what the card already showed, and §4.2 needs a
   reason to exist.
2. **Taxonomy size** — seven categories against nine seeded hooks leaves `formatting` and
   `git-workflow` empty (§7). Find entries for them, or ship five categories and split later?
3. **Attribution** — should a card credit the repo owner (`disler`, `pascalporedda`) on the
   card face, not just via the link? Leans yes for an open-source directory, but it is a
   seventh field and was not in the original set.
4. **`slug` uniqueness** — enforce it in `narrow()` now (three lines, §2.3) or defer with the
   rest of the validator?

---

## Appendix: risks that will actually bite

Collected from the sections above, for whoever implements this.

1. **Typegen ordering.** `PageProps<"/hooks/[slug]">` is a hard type error until typegen has
   seen the route file. Mitigated by the propless-stub step (§8.2, step 8a); the TS-server
   restart is the second-order trap.
2. **JSON imports do not produce literal union types.** Hence the runtime narrowing in §2.3.
   `satisfies` does not help on imported JSON, and `as Hook[]` silences the useful errors.
3. **Non-uniform JSON entries break the inferred element type.** Omit one key anywhere and
   `(typeof rawHooks)[number]` becomes a union. All six keys, every entry.
4. **Tailwind v4 cannot see dynamically-constructed class names.** Static
   `Record<HookCategory, string>` maps only (§6.3.1).
5. **Nested interactive elements.** No `<a>` inside the card `<Link>` (§6.5).
6. **Unverified repo URLs.** The one item in this spec that needs a human to go and look
   things up before merge (§7).
