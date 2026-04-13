# Author Agent Instructions

This file is a reference guide for the author role.

`scripts/author.sh` and `scripts/prompts/author.md` are the source of truth. If this file and the script/prompt disagree, follow the script/prompt.

## Operating Model

The author agent is no longer a long-lived poller with its own handoff file. The shell script is the control plane:

- `scripts/author.sh` runs an infinite loop
- each model invocation does exactly one task, then exits
- the shell loop immediately checks again after work, and sleeps only when idle
- worktree creation, retry logic, backoff, logging, and model fallback are handled by the shell script
- fallback order is Claude → Codex → Gemini

This document describes what a single author invocation should do once launched.

## Priority Order

Do exactly one of these, in order, then exit.

### 1. Address review feedback on an open PR

Look for open PRs from `johnmarkos` that already have a reviewer comment and no newer commits after that comment.

The reviewer comment must start with `## Review — Reviewer Agent`.

Interpret the latest verdict like this:

- `Clean approve — no action needed` — skip it; nothing to do
- `Approved with required fixes` — fix every finding, push, then merge
- `Changes requested` — fix every finding, push, and wait for re-review

If a PR needs action:

1. Check out the PR branch.
2. Read the full review comment, not just the verdict line.
3. Address every finding. If the reviewer mentioned it, fix it.
4. Run `pnpm -r test`, `pnpm -r build`, and `pnpm format`.
5. Commit and push.
6. If the verdict was `Approved with required fixes`, merge with `gh pr merge <n> --squash --delete-branch --admin`.
7. Exit.

### 2. Finish a stale `in-progress` issue with no PR

Look for open issues labeled `in-progress` but not `review` that have no open PR attached.

Treat these as stale claims:

1. Reclaim the issue by removing and re-adding `in-progress`.
2. Pull latest `main` and create a branch.
3. Implement the issue from scratch.
4. Run `pnpm -r test`, `pnpm -r build`, and `pnpm format`.
5. Update `CHANGELOG.md`.
6. Commit, push, and open a PR with `Closes #N`.
7. Exit.

### 3. Implement the next unclaimed issue

Pick the lowest-numbered open issue that:

- is not labeled `in-progress`
- is not labeled `review`
- is authored by `johnmarkos`

Do not skip an eligible issue just because its body mentions dependencies. Dependency ordering is the planning agent's job.

If an eligible issue exists:

1. Add the `in-progress` label.
2. Pull latest `main` and create a feature branch.
3. Read the issue carefully.
4. Implement with TDD where practical: test first or make the provided failing test pass, then implement, then refactor.
5. Run `pnpm -r test`, `pnpm -r build`, and `pnpm format`.
6. Update `CHANGELOG.md`.
7. Commit, push, and open a PR with `Closes #N`.
8. Exit.

### 4. Nothing to do

If none of the above apply, say `Nothing to do` and exit.

## Rules

- One task per invocation. Do not start a second task.
- Read `AGENTS.md` before doing anything.
- Follow all Architecture Rules and Conventions in `AGENTS.md`.
- Skip issues not authored by `johnmarkos`.
- Skip issues labeled `review`. Milestone reviews are planning-agent work now.
- Never merge without a reviewer approval verdict.
- Do not maintain `AUTHOR-HANDOFF.md`. GitHub state and the shell loop replaced it.

## Commit Attribution

Use the model-appropriate trailer when committing:

```text
Co-Authored-By: Codex <noreply@openai.com>
```

Other models should substitute their own trailer.
