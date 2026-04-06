# Changelog

## 0.2.0 — 2026-04-05

### Phase 1: Engine Core

- `ClaudeProvider`: browser-to-Claude API client with typed request/response, `testConnection()`, and structured error handling (`ProviderError` with `authentication`, `rate_limit`, `overloaded`, `invalid_request`, `server_error`, `network`, `malformed_response` types)
- `RateLimiter`: token bucket rate limiter to prevent 429s
- Provider types: `ProviderRequest`, `ProviderResponse`, `ToolDefinition`, `ToolChoice` — provider-agnostic interface for the rest of the engine
- 23 new tests covering request formatting, response parsing, error handling, rate limiting, and API key security

## 0.1.0 — 2026-04-05

### Phase 0: Scaffolding

- Initialized pnpm monorepo with `packages/engine` and `apps/coursequizzer`
- QuizzerEngine: `CourseEngine` class with typed event system, `serialize()`/`restore()`, 9 passing tests
- CourseQuizzer app: SvelteKit 5 + static adapter, consumes engine via workspace protocol
- AGENTS.md: governance doc with architecture rules, agent workflow, security review, content quality standards
- ROADMAP.md: phased implementation plan
- Prettier formatting configured monorepo-wide
