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
