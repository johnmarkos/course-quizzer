# Gemini CLI Context

This file provides context for Gemini CLI when used for integration testing.

## Purpose

Gemini (free tier) is used as an alternative LLM provider for integration tests,
avoiding paid API calls during CI and local testing. It is NOT used for agent
workflows (coding, reviewing) — those run as local Claude Code sessions.

## Project Structure

This is a pnpm monorepo. See `AGENTS.md` for full details.

- `packages/engine/` — QuizzerEngine, a client-side TypeScript library.
- `apps/coursequizzer/` — SvelteKit 5 static site consuming the engine.

## Integration Test Usage

The engine's provider interface is provider-agnostic. Integration tests that
need real LLM responses can use a Gemini provider (when implemented in Phase 3)
with a free API key from [Google AI Studio](https://aistudio.google.com/apikey).

Store the key as `GEMINI_API_KEY` in repo secrets for CI, or set it locally:

```bash
export GEMINI_API_KEY="your-key-here"
pnpm --filter quizzer-engine test:integration
```

## Key Commands

```bash
pnpm install              # Install dependencies
pnpm -r test              # Test all packages
pnpm -r build             # Build all packages
pnpm format               # Format code (Prettier)
pnpm format:check         # Check formatting (CI)
```
