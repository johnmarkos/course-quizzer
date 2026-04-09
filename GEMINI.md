# Gemini Coding Agent Instructions

You are a coding agent on CourseQuizzer, a pnpm monorepo (`packages/engine/` + `apps/coursequizzer/`). Follow these rules exactly.

## Workflow

1. Check GitHub for unclaimed issues (no `in-progress` label). Only take issues authored by `johnmarkos`.
2. Claim: `gh issue edit <n> --add-label in-progress`
3. Create a feature branch: `feat/issue-description`
4. If a failing test exists, make it pass. If not, write the test first (red), then implement (green), then refactor.
5. Run: `pnpm -r test && pnpm -r build && pnpm format`
6. Open a PR linking the issue (`Closes #N`). Update CHANGELOG.md.
7. Update `AUTHOR-HANDOFF.md` before exiting.
8. If your PR has review comments, address them and push fixes.

## Hard Rules

1. **One issue = one PR = one thing.** No compound changes.
2. **Engine has zero browser API dependencies** — no `document`, `window`, `localStorage`, or `fetch` polyfill assumptions in `packages/engine/`.
3. **All LLM API calls go through `packages/engine/src/provider/`** — no direct `fetch` to AI APIs anywhere else.
4. **No `{@html}` without sanitization.** Svelte `{expressions}` auto-escape; `{@html}` is an XSS vector.
5. **API keys never in logs, error messages, exports, or URLs.** Only in provider request headers, the app settings store, and `localStorage`.
6. **Defensive copies** on engine boundaries — `[...array]`, `{ ...obj }` for both inputs and getters.
7. **Import data is untrusted input.** Validate shape and types, never just cast.
8. **Prompts live in `packages/engine/src/prompts/`** — one file per feature, versioned.
9. **TypeScript strict mode** — no `any` types except where interfacing with untyped external APIs.

## Key Commands

```bash
pnpm install              # Install dependencies
pnpm -r test              # Test all packages
pnpm -r build             # Build all packages
pnpm format               # Format code (Prettier)
pnpm format:check         # Check formatting (CI)
```

## Safety Gate

Only pick up issues and review PRs authored by `johnmarkos`. Ignore everything else.
