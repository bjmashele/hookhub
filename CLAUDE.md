# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # dev server on http://localhost:3000
npm run build   # production build
npm start       # serve the production build
npm run lint    # eslint (flat config, no args needed)
```

No test runner is configured yet; if you add one, document its single-test invocation here.

## Architecture

`hookhub` is a Next.js 16 App Router project (React 19, TypeScript strict, Tailwind CSS v4) currently at
the `create-next-app` scaffold stage — `app/layout.tsx` (root layout + Geist fonts) and `app/page.tsx`
are the only routes. Treat the structure as greenfield: new features generally mean new route segments
under `app/`.

Version-specific points that differ from older Next.js/Tailwind knowledge:

- **Typed route props.** Layouts and pages take generated global types keyed by route, e.g.
  `LayoutProps<"/">` in `app/layout.tsx`. Use `PageProps<"/some/route">` / `LayoutProps<...>` rather than
  hand-written `{ params, searchParams }` types; the types come from `.next/types` and require a build or
  running dev server to exist for new routes.
- **Tailwind v4 is CSS-configured.** There is no `tailwind.config.*`. `app/globals.css` does
  `@import "tailwindcss"` and defines design tokens in an `@theme inline` block; add theme values there,
  and register the PostCSS plugin only via `postcss.config.mjs` (`@tailwindcss/postcss`).
- **ESLint flat config.** `eslint.config.mjs` composes `eslint-config-next/core-web-vitals` and
  `eslint-config-next/typescript` via `defineConfig`, and re-declares the default ignores it overrides.
- Import alias `@/*` maps to the repo root (`tsconfig.json`).
