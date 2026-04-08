# Gemini Agent Context

This file provides context for Gemini CLI agents running in GitHub Actions.

## Primary Reference

Read **`AGENTS.md`** in the project root. It is the source of truth for:

- Architecture rules (hard rules, not suggestions)
- Testing philosophy
- Prompt engineering standards
- Security review checklist
- Content quality standards
- Conventions (TypeScript strict, ES modules, private fields, etc.)
- Self-review loop

Every agent must follow AGENTS.md. This file adds agent-specific context only.

## Project Structure

This is a pnpm monorepo:

- `packages/engine/` — QuizzerEngine, a client-side TypeScript library. Zero browser dependencies. All LLM calls go through `src/provider/`. All prompts live in `src/prompts/`.
- `apps/coursequizzer/` — SvelteKit 5 static site consuming the engine.

## Agent Roles

### Reviewer Agent (`agent-review.yml`)

- **Read-only.** No `contents:write` permission. Cannot edit code.
- Reviews PRs against AGENTS.md rules.
- Posts one comment per PR with findings in the `## Review — Reviewer Agent` format.
- Does NOT create commits, push code, or open PRs.

### Coding Agent (`agent-author.yml`)

- Implements GitHub issues and addresses review feedback.
- Claims issues with `in-progress` label before starting.
- Creates feature branches, writes code, runs tests, opens PRs.
- Follows the self-review loop before opening a PR.

## Key Commands

```bash
pnpm install              # Install dependencies
pnpm -r test              # Test all packages
pnpm -r build             # Build all packages
pnpm format               # Format code (Prettier)
pnpm format:check         # Check formatting (CI)
```

## Conventions to Follow

- Commit messages end with: `Co-Authored-By: Gemini <noreply@google.com>`
- PR descriptions link the issue: `Closes #<number>`
- Branch naming: `feat/`, `fix/`, `chore/` prefixes
- Update `CHANGELOG.md` when shipping functionality
