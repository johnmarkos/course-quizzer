# Changelog

## 0.2.0 — 2026-04-05

### Phase 1: Engine Core

- `ClaudeProvider`: browser-to-Claude API client with typed request/response, `testConnection()`, and structured error handling (`ProviderError` with `authentication`, `rate_limit`, `overloaded`, `invalid_request`, `server_error`, `network`, `malformed_response` types)
- `RateLimiter`: token bucket rate limiter to prevent 429s
- Provider types: `ProviderRequest`, `ProviderResponse`, `ToolDefinition`, `ToolChoice` — provider-agnostic interface for the rest of the engine
- `StudentModel`: dedicated class for per-topic mastery tracking and gap detection, extracted from inline logic in `CourseEngine`
- Mastery scores: correct answers increase by 0.15, incorrect decrease by 0.10, clamped to [0, 1]
- Gap detection: topics below 0.5 mastery threshold are tracked as gaps
- `SessionProgress` computation with overall mastery average
- Full serialize/restore round-trip support
- `CourseEngine` now delegates all mastery logic to `StudentModel`
- Snapshot version bumped to 3
- 45 new tests (23 provider + 22 student model)
- `SyllabusParser`: orchestrates syllabus text → Claude API → validated `CurriculumPlan`, with retry on malformed response
- `CurriculumManager`: holds curriculum plan, tracks section position, provides navigation
- Syllabus analysis prompt (`src/prompts/syllabus-analysis.ts`): versioned, tool_use-based structured output, syllabus text in user message (not system prompt)
- `validateCurriculumPlan`: runtime shape validation with duplicate ID detection
- 3 recorded fixtures (MIT algorithms, Coursera ML, informal cooking) for deterministic testing
- 29 new tests (prompt builder, validation, parser with fixtures, curriculum manager)
- `ContentGenerator`: core content/quiz loop — generates explanation + quiz burst per topic in a section
- Explanation prompt (`src/prompts/explanation.ts`): versioned (v1.0), tool_use-based, topic context in user message
- Quiz generation prompt (`src/prompts/quiz-generation.ts`): versioned (v1.0), supports all 5 question types (MCQ, numeric-input, ordering, multi-select, two-stage)
- Quality filters (`src/content/quality-filters.ts`): length outlier detection, front-matter question detection, duplicate option detection — inherited from PageQuizzer
- Retry-once on malformed LLM responses for both explanations and quiz bursts
- Runtime shape validation and parsing for all 5 question types
- 22 new tests (prompt builders, quality filters, content generator with fixtures)

## 0.1.0 — 2026-04-05

### Phase 0: Scaffolding

- Initialized pnpm monorepo with `packages/engine` and `apps/coursequizzer`
- QuizzerEngine: `CourseEngine` class with typed event system, `serialize()`/`restore()`, 9 passing tests
- CourseQuizzer app: SvelteKit 5 + static adapter, consumes engine via workspace protocol
- AGENTS.md: governance doc with architecture rules, agent workflow, security review, content quality standards
- ROADMAP.md: phased implementation plan
- Prettier formatting configured monorepo-wide
