# CourseQuizzer Roadmap

High-level project plan, organized by phase. The planning agent creates GitHub issues from the current phase once John signs off.

## Phase 0: Scaffolding & Validation ← current

**Goal:** Prove the monorepo setup works end-to-end. Engine builds and tests independently. App consumes engine and deploys as a static site.

- [ ] Init monorepo: pnpm workspaces, root package.json, workspace config
- [ ] Init QuizzerEngine (`packages/engine`): TypeScript, Vitest, empty `src/` structure with `CourseEngine` stub
- [ ] Init CourseQuizzer app (`apps/coursequizzer`): SvelteKit 5 + static adapter, TypeScript, Vitest, Playwright
- [ ] Hello-world engine: `CourseEngine` class with constructor, one event (`ready`), `serialize()`/`restore()`
- [ ] Wire app to engine: render a page that creates a `CourseEngine` and displays its state
- [ ] CI: GitHub Actions pipeline — lint, test, build for both packages
- [ ] Deploy CourseQuizzer to GitHub Pages (static build, even if minimal)
- [ ] Create GitHub repo (`johnmarkos/course-quizzer`), push initial structure

**Checkpoint:** Both packages build and test. App deploys. Engine is consumable from the app via workspace protocol. **If SvelteKit static adapter has issues, switch to Vite+React before Phase 1.**

## Phase 1: Core Engine — Syllabus to Content

**Goal:** The engine can accept a syllabus, analyze it with Claude, and generate content for the first section.

- [ ] #2 — Core engine types and state machine (no dependencies)
- [ ] #3 — ClaudeProvider: API client for browser-to-Claude calls (no dependencies)
- [ ] #4 — SyllabusParser: prompt + parsing for CurriculumPlan (depends on #2, #3)
- [ ] #5 — ContentGenerator: content/quiz loop for a section (depends on #2, #3, #4)
- [ ] #6 — StudentModel: mastery tracking and gap detection (depends on #2)
- [ ] #7 — Phase 1 integration: end-to-end test with real Claude API (depends on all above)

**Checkpoint:** Engine drivable from tests — load syllabus, get curriculum plan, generate section content, answer questions, see mastery update. Validate prompt quality against 5+ real syllabi.

## Phase 2: App Shell — Syllabus to First Question

**Goal:** A user can paste a syllabus in the browser and answer the first generated question.

- [ ] Settings page: API key input, validation, storage, removal
- [ ] New Course page: syllabus text input, analyze, display resulting curriculum plan
- [ ] Course Overview page: section list with progress indicators, "Start Section"
- [ ] Learn page: question display, answer submission, result, explanation
- [ ] Engine store: Svelte store wrapping `CourseEngine`, translating events to reactive `$state`
- [ ] Course list page: show all courses, resume or delete
- [ ] `LocalStorageAdapter` implementing `StorageAdapter`
- [ ] Error handling: API errors, network errors, invalid syllabus
- [ ] Tests: component units, integration (mocked engine), one E2E (paste syllabus → answer question)

**Checkpoint:** Full demo flow in the browser: enter API key → paste syllabus → see curriculum plan → start section → answer question → see result.

## Phase 3: Adaptive Learning + Polish

**Goal:** Content adapts to student performance. Pre-fetch hides latency. Export/import works.

- [ ] `AdaptiveSelector`: bias content generation using `StudentModel` gaps
- [ ] `Prefetcher`: generate next section while student works on current
- [ ] Section completion: summary, mastery display, "Next Section"
- [ ] Export/import: JSON bundle (minus API key), download/upload UX
- [ ] Prompt refinement: explanation quality, question quality, adaptive follow-up
- [ ] Mobile-responsive CSS
- [ ] Loading states and transitions
- [ ] Comprehensive E2E test suite
- [ ] Full security review

**Checkpoint:** Multi-section course flow, adaptive content, export → import → continue on different browser.

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
- Alternative LLM providers
- Static course generation (batch mode)
