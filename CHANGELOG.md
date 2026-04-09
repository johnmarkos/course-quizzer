# Changelog

## 0.3.0 — 2026-04-09

### Phase 2: App Foundation

- Settings page (`/settings`) with API key entry, masked display, and removal
- API key store (`src/lib/stores/api-key.ts`): save, remove, get, has, masked display — localStorage only
- Input validation: rejects empty/whitespace-only keys, trims whitespace
- Key displayed as masked string (prefix + dots + last 4 chars) after saving
- Input uses `type="password"` to prevent shoulder surfing
- Vitest configured for app package with 13 new store tests
- No `{@html}`, no direct API calls, key never leaves localStorage
- Course storage (`src/lib/storage/course-storage.ts`): CRUD for course records in localStorage
- Course records hold id, title, curriculum plan, engine snapshot, and timestamps
- Runtime validation: malformed localStorage JSON rejected safely, invalid records filtered out
- API keys stripped from snapshots before persisting (sanitizeSnapshot)
- Defensive copies on all inputs and outputs (JSON round-trip)
- 17 new course storage tests covering CRUD, validation, security, and defensive copies

## 0.2.1 — 2026-04-07

### Phase 1 Review Fixes

- Fix reference leaks: `CurriculumManager` and `CourseEngine` getters, navigation methods, emitted content payloads, and serialize/restore snapshots now return defensive copies
- Reject negative `tolerance` values in `ContentGenerator` numeric-input parsing
- Extend length-outlier quality filter to cover multi-select (checks longest correct option) and two-stage `followUpOptions`
- 16 new tests covering all three fixes and the nested-array reference leak surfaces

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
- Integration tests: full engine lifecycle (syllabus → curriculum → content → answering → mastery) with 3 recorded fixture sets (MIT Algorithms, Cooking, WWII History)
- 2 new syllabus fixtures: WWII History (non-CS subject), Guitar (minimal/edge case)
- 3 recorded API response fixture sets for deterministic lifecycle testing covering all 5 question types
- 11 integration tests validating end-to-end flow, question diversity, unique IDs, topic mapping, and mastery progression
- Separate `pnpm test:integration` script for running integration suite

## 0.1.0 — 2026-04-05

### Phase 0: Scaffolding

- Initialized pnpm monorepo with `packages/engine` and `apps/coursequizzer`
- QuizzerEngine: `CourseEngine` class with typed event system, `serialize()`/`restore()`, 9 passing tests
- CourseQuizzer app: SvelteKit 5 + static adapter, consumes engine via workspace protocol
- AGENTS.md: governance doc with architecture rules, agent workflow, security review, content quality standards
- ROADMAP.md: phased implementation plan
- Prettier formatting configured monorepo-wide
