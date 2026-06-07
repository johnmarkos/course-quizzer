# Changelog

## 0.9.2 — 2026-06-07

### Fixes

- **Engine:** Complete provider-agnostic refactor by making `provider` mandatory in `CourseEngineConfig` and removing `apiKey`/`model` fields, ensuring `CourseEngine` has no dependency on `createDefaultProvider` or `ClaudeProvider`
- **Engine:** Fix bug in `export.test.ts` where an undefined variable was used in a restore test
- **App:** Update engine session store to pass an explicitly constructed provider to the engine constructor

## 0.9.1 — 2026-05-11

### Fixes

- **Scripts:** Stop cascading author/reviewer runs to fallback models after non-credit Codex failures, and pipe Gemini prompts directly from the prompt file to preserve multi-line formatting
- **Engine:** Pass the engine-owned `StudentModel` into background prefetch generation so cached next-section content uses adaptive quiz burst sizing instead of the default question count
- **Engine:** Extend quality-filter length-outlier coverage to `checklist` and `self-evaluation` questions, and make all question-type switch branches explicit
- **Engine:** Extract shared `copyContentItem` utility so `ContentCache` and `CourseEngine` cannot drift when new content item types are added
- **Engine:** Bump `QUIZ_GENERATION_VERSION` to `1.3` to track the prompt expansion for checklist, code, and self-evaluation questions
- **Engine/App:** Add correlation ids to `apiCallStart` and `apiCallComplete` events, and keep app loading state tied to active API call ids
- **Engine:** Add `AdaptiveSelector` boundary and integration tests covering gap, default, and proficient quiz burst counts
- **Scripts:** Guard author-agent `gh pr merge` calls so approved PRs cannot merge while GitHub status checks are failing, pending, cancelled, or absent
- **Engine/App:** Complete the provider-agnostic refactor by removing concrete `ClaudeProvider` exports from the engine index and updating the app to use the provider factory
- **App:** Refactor syllabus analysis flow to use `SyllabusParser` from the engine, centralizing parsing and retry logic
- **Engine:** Update `SyllabusParser` to throw `ProviderError` with `malformed_response` type for better error categorization in the UI
- **Engine:** Tighten provider boundary tests to ensure no concrete provider leaks through the main engine index
- **Engine/App:** Move topic status, review flags, and course progress summary calculations behind engine-owned progress helpers so the app only formats and renders emitted progress data
- **Engine:** Tighten imported snapshot validation for mastery ranges, question counts, answer-key bounds, and state-aware section/item indices
- **Engine:** Add import coverage for recoverable error-state snapshots so exports from generation failures restore back to `ready`
- **Engine/App:** Strip unknown fields from imported engine snapshots before persistence or re-export so stale or malicious import metadata cannot carry secrets forward
- **Engine:** Copy imported generated-content and mastery records with own data properties so `__proto__` keys cannot mutate returned snapshot prototypes
- **Engine/App:** Move topic mastery display status, review flags, and snapshot progress summaries into the engine so the app only formats engine-provided progress values
- **Engine:** Retry explanation and quiz generation once when tool payload parsing or content validation fails
- **Engine:** Reuse in-flight prefetch generation when starting a prefetched section so the engine does not make duplicate foreground and background API calls for the same section
- **Engine:** Reject duplicate, fractional, and out-of-range practical-question answer indices during checklist and self-evaluation grading
- **Engine/App:** Convert code questions to v1 self-evaluation grading, remove regex-based expected-pattern grading, and bump `QUIZ_GENERATION_VERSION` to `1.4`
- **Engine/App:** Add AI-tutor grading for code questions, including tutor feedback rendering, self-evaluation fallback on provider failure, and `QUIZ_GENERATION_VERSION` `1.5`
- **App:** Add route-level DOM coverage for checklist, code, and self-evaluation question rendering and submitted answer payloads
- **Engine:** Add recorded quiz-generation v1.4 fixtures for diverse topics, including checklist, code, and self-evaluation schema coverage
- **Engine:** Clean up stale Phase 3 question-type comments so source comments match the current eight-format v1 set

## 0.9.0 — 2026-05-10

### Phase 3: Adaptive Learning + Polish

- **Engine:** Add `AdaptiveSelector` so quiz bursts can be biased by student mastery and performance
- **Engine:** Add `Prefetcher` and `ContentCache` support for background generation of the next section
- **Engine/App:** Add export and import flows so course progress can move between browsers without including API keys
- **App:** Add section completion summaries with topic-level mastery display and review suggestions
- **Engine/App:** Add checklist, code, and self-evaluation question types for practical skills

## 0.8.5 — 2026-05-10

### Fixes

- **Engine:** Extend `ContentCache.copyContentItem` switch to cover the `checklist`, `code`, and `self-evaluation` question types — restores `pnpm -r build` after the regression introduced by #62
- **Engine:** Extend `snapshot-validation` to validate the new question shapes and their student-answer shapes; previously, export → import of a course containing any of the three new types would reject the snapshot as malformed
- **Engine:** Reformat `ContentGenerator.ts`, `prompts/quiz-generation.ts`, and `tests/new-question-types.test.ts` to satisfy `pnpm format:check` (pre-existing drift from #62)
- 35 new engine tests in `content-roundtrip.test.ts` that enumerate every member of the `Question` union and assert round-trip through both the cache and the snapshot validator — a dropped switch case in either location now breaks the suite

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
