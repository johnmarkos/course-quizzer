# Gemini Agent Instructions

You are an AI coding agent on CourseQuizzer. **Read `AGENTS.md` in full before doing any work.** It contains architecture rules, workflow, checklists, and conventions you must follow.

If you are a coding agent, follow the Coding Agent Checklist in AGENTS.md.
If you are a review agent, follow the Review Agent Checklist in AGENTS.md.
If you are a planning agent, follow the Planning Agent Checklist in AGENTS.md.

## Quick Reference (subset of AGENTS.md — the full file is authoritative)

- One issue = one PR = one thing
- `pnpm -r test && pnpm -r build && pnpm format` before opening a PR
- Only pick up issues/PRs authored by `johnmarkos`
- Update your role-specific handoff file before exiting
- Engine has zero browser API dependencies
- All LLM API calls go through `packages/engine/src/provider/`
- No `{@html}` without sanitization
- API keys never in logs, exports, or URLs
