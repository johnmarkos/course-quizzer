# Changelog

## 0.8.4 — 2026-04-14

### Features

- **Engine/App:** Support additional question types for practical skills: `checklist`, `code`, and `self-evaluation`
- **Engine:** Updated `quiz-generation` prompt (v1.2) to support generating these new types for procedural and technical topics
- **Engine:** Added parsing and grading logic for the new types, including regex-based validation for code snippets
- **App:** Updated learn flow UI to render interactive checklists, code editors (textarea), and self-evaluation options
- **App:** Added state management and answer handlers for the new question types in the Svelte 5 learn page
- **App:** Detailed section completion summary with topic-level mastery display
- **App:** Visual cues for topic mastery (Green: Mastered, Amber: Gaining, Red: Struggling)
- **App:** "Review suggested" badges for topics identified as knowledge gaps (< 0.5 mastery)
- **App:** Enhanced "Next Section" button with smoother transitions and improved styling
- **App:** New unit test `section-summary.test.ts` verifying summary data availability

### Fixes

- **Engine:** Updated quality filters to support the new question types, enabling duplicate option checks for checklists and self-evaluations
- **Engine:** Updated version expectation in content generator tests to match the new prompt version
- **Engine:** Resolved circular dependency between `CourseEngine.ts` and `snapshot-validation.ts` by moving `SNAPSHOT_VERSION` to a new `constants.ts` file — this fixed a runtime error where `validateEngineSnapshot` was `undefined` during tests
- 5 new engine tests covering the grading and serialization of the new question types

## 0.8.3 — 2026-04-14

### Features

- **Engine:** Implement `Prefetcher` for background content generation — hides LLM latency by generating the next section while the student works on the current one
- **Engine:** Implement `ContentCache` for in-memory storage of generated section items
- **Engine:** Update `CourseEngine` to automatically check `ContentCache` in `startSection` and trigger background prefetching of the next section
- Add `prefetch` configuration to `CourseEngineConfig` (enabled/disabled, generator reference)
- 7 new engine tests covering cache, prefetcher, and engine integration (including failure modes)

### Fixes

- **Engine:** Prioritize active section generation over prefetch to ensure zero-latency for the current section
- **Engine:** Sanitize error logs in `CourseEngine` and `Prefetcher` to avoid raw provider messages and potential sensitive data leaks
- **Engine:** Update regression tests to assert full shared-limiter order
- **Engine:** Increase test timeouts and clear mocks between runs for stability

## 0.8.2 — 2026-04-13

### Features

- **Engine/App:** Implement Export and Import functionality — users can now download a JSON bundle of their course progress and import it on other machines
- **Engine:** Export bundle includes curriculum, student mastery, and all generated content across all sections
- **Engine:** Secure by design — API keys are strictly excluded from all export bundles
- **Engine:** Robust validation — Imported bundles are validated for structure and version compatibility before restoration
- **Engine:** Automatic migration — Support for migrating version 3 snapshots to version 4 (adding `allGeneratedContent` support)

### Fixes

- **Engine/App:** Tighten import validation so malformed snapshot indices, section content, and `allGeneratedContent` payloads are rejected before persistence or restore

## 0.8.1 — 2026-04-13

### Features

- `AdaptiveSelector` now sizes quiz bursts from student mastery within the engine-owned content generation flow
- `ContentManager` passes adaptive question counts into `ContentGenerator.generateTopicQuizBurst`
- Updated `buildQuizGenerationPrompt` to support configurable `questionCount` and dynamic tool schema limits
- 4 new `AdaptiveSelector` tests and 1 new `ContentManager` bias verification test

### Fixes

- Enforce exact adaptive quiz burst counts in both the quiz tool schema and `ContentGenerator` validation so generated bursts cannot drift above or below the requested size

## 0.8.0 — 2026-04-13

### Infrastructure

- Model cooldown mechanism: automated fallback cascade (Claude → Codex → Gemini) with 1-hour cooldowns for credit exhaustion or transient failures
- Fallback logic now proceeds to the next model even on non-credit errors to improve robustness

### Developer Experience

- Planning Agent instructions updated to write failing tests as specs for coding agents
- Phase 2 complete: all foundational app and engine features implemented and verified

## 0.7.6 — 2026-04-12

### Added

- `ContentManager` in `packages/engine` to orchestrate content generation.
- `apiCallStart` and `apiCallComplete` events to `CourseEngine` for better UX feedback during LLM calls.
- `error` state in `CourseEngine` for persistent visibility of background generation failures.

### Changed

- `CourseEngine` now owns the content generation lifecycle via `ContentManager`.
- `ContentGenerator` methods are now public to allow orchestration.
- Simplified `apps/coursequizzer` learn flow by removing direct `ContentGenerator` usage.
- `CourseEngine.startSection` is now asynchronous internally, automatically triggering content generation.
- Improved Error UI on the learn page with a Retry button.

## 0.7.5 — 2026-04-12

### Fixes

- Mask short stored API keys in Settings instead of displaying them verbatim — `getMaskedApiKey()` now always returns a masked value for any non-empty key

## 0.7.4 — 2026-04-12

### Fixes

- Harden `course-storage` persisted-data validation so malformed curriculum records are filtered out before app routes read them
- Null out malformed persisted engine snapshots instead of attempting to restore them
- Add storage tests covering malformed curriculum and snapshot payloads, and align engine-session test fixtures with the current curriculum shape
- Fail closed on bad persisted engine snapshots: stale or malformed snapshots no longer crash the learn page — the session falls back to a fresh engine with the curriculum reloaded, and the bad snapshot is cleared from storage
- Allow `updateCourse` to accept `null` snapshot for clearing persisted snapshots

## 0.7.3 — 2026-04-12

### Developer Experience

- Add root-level `pnpm dev` script that builds the engine first, then starts the app dev server

## 0.7.2 — 2026-04-12

### Fixes

- Rename "Save Course & Start Learning" button to "Save Course" on `/course/new` — no learning flow exists yet, so the old label set false expectations

## 0.7.1 — 2026-04-12

### Phase 2 Milestone Review Fixes

- Fix: learn page content generation errors now normalized through `normalizeError()` instead of showing raw provider error messages (potential sensitive data leak)
- Fix: settings page `saveApiKey` errors now normalized through `normalizeError()` instead of showing raw `DOMException` messages
- Update ROADMAP.md Phase 2 checkboxes to reflect completed issues

## 0.7.0 — 2026-04-12

### Phase 2: App Foundation (continued)

- Critical-path integration test: full flow from syllabus analysis → save course → create session → answer questions → verify auto-save
- Session restore/resume test: serialize session, restore into new session, continue answering
- Analysis failure and retry test: verifies graceful failure then successful retry
- Static security scan tests: verify no `{@html}`, no `eval()`, no API key logging in app source
- Runtime security tests: API key not in serialized snapshots, not in persisted course records, malformed import data handled gracefully
- 9 new tests across 2 test files (critical-path.test.ts, security.test.ts), total app tests now 90

## 0.6.1 — 2026-04-12

### Fixes

- Removed unused `SyllabusParser` import from `new-course.ts`
- `extractPlan` double-failure now returns user-friendly "unexpected response" message instead of raw error
- Home page course list refreshes on client-side navigation (no more stale list after creating a course)

## 0.6.0 — 2026-04-12

### Phase 2: App Foundation (continued)

- Course list home page: shows all courses with progress summary, open link, and delete with confirmation
- Course overview page: curriculum sections with expanded topics, progress bar, mastery percentages, Start/Resume Learning action
- Progress helper module (`src/lib/stores/course-progress.ts`): extracts per-section and overall progress from snapshot data
- Delete course with explicit confirmation step on both home and overview pages
- Graceful handling of missing/invalid course IDs with helpful message
- Empty state for new users with API key prompt and create-course link
- All user/LLM text rendered with Svelte auto-escaping (no `{@html}`)
- 12 new tests covering progress extraction, mastery formatting, and progress labels
- Learn page (`/course/[courseId]/learn`): content generation, explanation display, and answer flow for all 5 question types
- Section picker: choose a section to start, generates content via ContentGenerator + ClaudeProvider
- Renders explanations with Svelte auto-escaping (no `{@html}`)
- Multiple choice: click-to-answer option buttons
- Numeric input: form with number input and submit
- Ordering: reorderable list with up/down arrow controls
- Multi-select: toggle option buttons with visual selected state
- Two-stage: first answer → follow-up question flow
- Answer result screen: correct/incorrect feedback with correct answer shown on wrong answers
- Section complete and course complete screens with mastery percentage
- Skip question support for all question types
- Report issue action on every content item (v1: console log)
- Auto-saves engine snapshots to course storage after each answer and section completion
- Restores session from snapshot when returning to a course in progress
- "Start Learning" link added to course overview page
- 5 new learn-flow tests covering full section completion, incorrect answers, skip, auto-save, and section navigation
- Centralized error normalization module (`src/lib/errors/app-errors.ts`): maps provider, engine, storage, and unknown errors to user-safe messages
- Sensitive data scrubbing: API key patterns, raw headers, and localStorage dump patterns are redacted from all user-facing error messages
- Reusable `ErrorAlert` component with optional retry action and accessible `role="alert"` markup
- Reusable `LoadingIndicator` component with message and detail text, `aria-busy` and `role="status"` attributes
- Home page handles localStorage failures gracefully with error display
- Course overview page catches and normalizes storage access errors
- New course page save flow catches localStorage quota/access errors
- Engine session auto-save catches storage errors and surfaces them as recoverable
- Engine session error handler sanitizes messages via `scrubSensitiveData` directly (no throwaway Error wrapping)
- Refactored `new-course.ts` to delegate error sanitization to centralized module (removed inline error message map)
- Security audit: no `{@html}`, no `eval()`, no direct `fetch()`, no API key logging in app source
- 20 new tests covering error normalization for all provider types, engine errors, storage errors, unknown errors, and sensitive data scrubbing

## 0.5.0 — 2026-04-12

### Phase 2: App Foundation (continued)

- New course syllabus-analysis flow (`/course/new`): paste syllabus → Claude analysis → review curriculum plan → save course
- Analysis logic module (`src/lib/stores/new-course.ts`): validates input, calls provider via SyllabusParser prompt, retries on malformed response, sanitizes all error messages
- Provider errors mapped to user-readable messages; API key and raw headers never leak into error text
- Curriculum plan displayed with Svelte auto-escaping (no `{@html}`)
- Saved courses persist via course-storage and are loadable by ID
- Minimal course detail page (`/course/[courseId]`) as redirect target after save
- Home page updated with course list and new-course navigation
- 14 new tests covering input validation, successful analysis, retry logic, 4 error types, and API key leak prevention

## 0.4.0 — 2026-04-12

### Phase 2: App Foundation (continued)

- Engine session store (`src/lib/stores/engine-session.svelte.ts`): reactive Svelte 5 wrapper around CourseEngine
- Translates all engine events into reactive state via `$state` runes
- Exposes: engineState, curriculum, currentSection, currentItem, lastResult, studentState, progress, apiLoading, error
- Actions pass through to CourseEngine: loadCurriculum, startSection, setSectionContent, submitAnswer, nextItem, skipQuestion, nextSection
- Auto-saves engine snapshots to course storage on answer submission, section completion, and course completion
- Snapshot restore support: restored sessions reflect correct initial state
- Dispose clears all subscriptions and resets state to prevent duplicate listeners
- API key never appears in serialized snapshots
- Vitest config updated with Svelte vite plugin for `.svelte.ts` file support
- 19 new engine session store tests covering state flow, auto-save, restore, dispose, and security

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
