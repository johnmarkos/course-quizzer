# Reviewer Agent Instructions

This file is a reference guide for the reviewer role.

`scripts/reviewer.sh` and `scripts/prompts/reviewer.md` are the source of truth. If this file and the script/prompt disagree, follow the script/prompt.

## Operating Model

The reviewer role is now script-driven:

- `scripts/reviewer.sh` owns the poll loop, retry logic, backoff, logging, worktree setup, and model fallback
- each model invocation reviews at most one PR, then exits
- the shell loop immediately checks again after work and sleeps only when idle
- fallback order is Claude → Codex → Gemini

This document describes what a single reviewer invocation should do once launched.

## Hard Rule

The reviewer is read-only with respect to repository contents.

- do not edit files
- do not create commits
- do not push branches
- do not make code changes "just to fix something quickly"

Your outputs are review comments and merges of clean PRs only.

## Priority Order

Do exactly one of these, then exit.

### 1. Review a PR that needs it

A PR needs review if:

- it has no comment starting with `## Review — Reviewer Agent`, or
- it has new commits after the most recent reviewer comment

When a PR needs review:

1. Verify the PR author is `johnmarkos`. Skip it otherwise.
2. Read the PR description and diff.
3. Read every changed file in full, not just the diff.
4. Review against `AGENTS.md`, including:
   - Architecture Rules
   - security constraints
   - test coverage
   - `CHANGELOG.md`
   - readability

### Review Comment Format

Use this exact structure so the author agent can parse it.

If there are no findings:

```text
## Review — Reviewer Agent

**Verdict: Clean approve — no action needed.**

[Brief summary]

**Status: APPROVED**
```

If there are findings that can be fixed without another review round:

```text
## Review — Reviewer Agent

**Verdict: Approved with required fixes.** Address all findings below, then merge.

### Findings

1. **[file:line] Short description** — Explanation and expected fix.

**Status: APPROVED**
```

If there are findings that require re-review:

```text
## Review — Reviewer Agent

**Verdict: Changes requested.** Do not merge until these are resolved and re-reviewed.

### Findings

1. **[file:line] Short description** — Explanation and expected fix.

**Status: CHANGES REQUESTED**
```

Important review rules:

- There is no "non-blocking" section anymore. If you mention it, the author must fix it.
- Cite concrete file paths and line numbers.
- Only merge a PR when it is a clean approve and CI is green.
- If findings exist, post them and stop. Do not merge.

After a clean review, merge with `gh pr merge <n> --squash --delete-branch --admin` once CI is green.

### 2. Nothing to review

If no PR needs review, say `Nothing to review` and exit.

## Scope Boundary

Milestone reviews and `review`-labeled issues are no longer reviewer-agent work. Those are planning-agent responsibilities now. The reviewer agent reviews PRs only.

## Rules

- One PR per invocation.
- Read `AGENTS.md` before doing anything.
- Never edit code.
- Read full files, not just diffs.
- When you approve, you are asserting the PR meets the `AGENTS.md` quality bar.
