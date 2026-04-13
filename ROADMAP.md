# CourseQuizzer Roadmap

High-level project plan, organized by phase. The planning agent creates GitHub issues from the current phase once John signs off.

## Phase 0: Scaffolding & Validation ✓

**Goal:** Prove the monorepo setup works end-to-end. Engine builds and tests independently. App consumes engine and deploys as a static site.

- [x] Init monorepo: pnpm workspaces, root package.json, workspace config
- [x] Init QuizzerEngine (`packages/engine`): TypeScript, Vitest, empty `src/` structure with `CourseEngine` stub
- [x] Init CourseQuizzer app (`apps/coursequizzer`): SvelteKit 5 + static adapter, TypeScript, Vitest, Playwright
- [x] Hello-world engine: `CourseEngine` class with constructor, one event (`ready`), `serialize()`/`restore()`
- [x] Wire app to engine: render a page that creates a `CourseEngine` and displays its state
- [x] CI: GitHub Actions pipeline — lint, test, build for both packages (PR #1)
- [ ] Deploy CourseQuizzer to GitHub Pages (deferred — nothing to show yet)
- [x] Create GitHub repo (`johnmarkos/course-quizzer`), push initial structure

**Checkpoint:** Both packages build and test. App deploys. Engine is consumable from the app via workspace protocol. SvelteKit static adapter works fine — no framework switch needed.

## Phase 1: Core Engine — Syllabus to Content ✓

**Goal:** The engine can accept a syllabus, analyze it with Claude, and generate content for the first section.

- [x] #2 — Core engine types and state machine (PR #8)
- [x] #3 — ClaudeProvider: API client for browser-to-Claude calls (PR #10)
- [x] #4 — SyllabusParser: prompt + parsing for CurriculumPlan (PR #12)
- [x] #5 — ContentGenerator: content/quiz loop for a section (PR #13)
- [x] #6 — StudentModel: mastery tracking and gap detection (PR #11)
- [x] #7 — Phase 1 integration: end-to-end test with recorded fixtures (PR #14)
- [x] #9 — Phase 1 milestone review: security, readability, architecture audit (PR #15)

**Checkpoint:** Engine drivable from tests — load syllabus, get curriculum plan, generate section content, answer questions, see mastery update. Integration tests use recorded fixtures (3 diverse syllabi). Real API testing is manual.

## Phase 2: App Shell — Syllabus to First Question ✓

**Goal:** A user can paste a syllabus in the browser and answer the first generated question.

- [x] #16 — Build settings page and API key management
- [x] #17 — Add local course persistence and `LocalStorageAdapter`
- [x] #18 — Create engine Svelte store wrapper
- [x] #19 — Implement new course syllabus-analysis flow
- [x] #20 — Implement course list and course overview pages
- [x] #21 — Implement learn page content and answer flow
- [x] #22 — Add app error handling, loading states, and safe rendering checks
- [x] #23 — Add Phase 2 tests for the critical browser flow
- [x] #24 — Phase 2 milestone review: app security, UX, and architecture audit
- [x] #43/44 — Harden course-storage validation for persisted curriculum and snapshots
- [x] #45 — Fail closed on bad persisted engine snapshots in learn session restore
- [x] #46 — Mask short stored API keys in Settings

**Checkpoint:** Full demo flow in the browser: enter API key → paste syllabus → see curriculum plan → start section → answer question → see result.

## Phase 3: Adaptive Learning + Polish ← current

**Goal:** Content adapts to student performance. Pre-fetch hides latency. Export/import works.

- [ ] #50 — [Engine] Refactor content generation lifecycle into the engine (**Prerequisite for #51, #52**)
- [ ] #51 — [Engine] Implement `AdaptiveSelector` to bias content generation
- [ ] #52 — [Engine] Implement `Prefetcher` for background generation
- [ ] #53 — [Engine/App] Implement Export and Import functionality (**Parallel**)
- [ ] #54 — [App] Section completion summary and mastery display (**Parallel**)
- [ ] #55 — [Engine/App] Support additional question types (**Parallel**)
- [ ] Prompt refinement: explanation quality, question quality, adaptive follow-up
- [ ] Mobile-responsive CSS
- [ ] Loading states and transitions
- [ ] Comprehensive E2E test suite
- [ ] Full security review
- [ ] Additional LLM providers: GPT, Gemini, Ollama (provider interface is already provider-agnostic from Phase 1)

**Checkpoint:** Multi-section course flow, adaptive content, export → import → continue on different browser. Multiple provider options.

## Phase 4: Hardening + PWA

**Goal:** Production-ready. Installable as PWA.

- [ ] PWA manifest + service worker
- [ ] Offline detection and graceful degradation
- [ ] Performance audit: bundle size, load time, API call efficiency
- [ ] Accessibility audit: keyboard navigation, screen reader, contrast
- [ ] Documentation, README, landing page
- [ ] Final security review
- [ ] Public launch

## Phase 5: Future (not planned in detail)

- Content/quiz ratio tuning (user-adjustable per course or globally)
- Additional question types (free-response with Claude evaluation, fill-in-the-blank, diagram labeling, code exercises)
- Google Drive sync (`GoogleDriveAdapter`)
- Multiple concurrent courses
- Course sharing (export curriculum plan as shareable file)
- Spaced repetition across sessions
- Static course generation (batch mode)
