# AGENTS.md

Guidance for agents working on this repository. Read this entire file before making changes.

## Project Overview

**CourseQuizzer** is a web app that takes real-world course syllabi and dynamically generates adaptive course material as the student progresses. It emphasizes active recall — quizzing, problem-solving, demonstration of knowledge — over passive reading. Content is generated on-the-fly via the user's own Anthropic API key. Nothing phones home. The app never knows what anyone is studying.

This is a pnpm monorepo containing two packages:

- **QuizzerEngine** (`packages/engine/`) — The engine. A client-side TypeScript library with zero browser dependencies. Accepts syllabi, maintains student state, generates adaptive content via Claude API, pre-fetches one section ahead. No UI, no server, no opinions about presentation. Publishable as a standalone npm package.

- **CourseQuizzer** (`apps/coursequizzer/`) — The app. A SvelteKit 5 static site that consumes QuizzerEngine. Provides course selection, API key management, learning UX, and progress persistence.

**Sister projects:** [PageQuizzer](https://github.com/johnmarkos/page-quizzer) (Chrome extension), [OpenQuizzer](https://github.com/johnmarkos/openquizzer) (zero-dependency quiz engine + template repo). QuizzerEngine is a different project from OpenQuizzer — OpenQuizzer presents static pre-made content; QuizzerEngine generates adaptive content dynamically via the Claude API. When in doubt about event-driven engine design patterns, OpenQuizzer is still the reference.

## Learning Model

The app is a quizzing engine with just enough reading to give the student something to be quizzed on. Reading is the means, not the end — active recall is the point.

**The content/quiz loop:** For each concept in a section:

1. **Brief content** — A focused explanation (2-3 paragraphs) or a link to external material with a summary. Short enough that the student doesn't lose focus.
2. **Quiz burst** — Multiple questions on that concept, varying in type, until mastery is demonstrated. High ratio of questions to content.
3. **Repeat** for the next concept in the section.
4. **Section assessment** — Broader questions mixing concepts from the whole section.

This is not a textbook with quizzes bolted on. The quiz burst is the primary experience; the content exists to give the student something to recall.

**Question types:** v1 uses the types proven in OpenQuizzer (multiple choice, numeric input, ordering, multi-select, two-stage). Additional types are on the roadmap.

## Monorepo Coordination

This is a pnpm workspaces monorepo. The engine and app live in one repo but remain independently functional.

- **Workspace structure:** `packages/engine` is a dependency of `apps/coursequizzer` via workspace protocol (`"quizzer-engine": "workspace:*"`). No `npm link` needed — pnpm resolves it automatically.
- **Atomic PRs:** When an engine API change requires app changes, both go in a single PR. The PR title should note both packages (e.g., "feat: add prefetch support to engine + wire into app").
- **Independent engine:** The engine must always build and test in isolation (`cd packages/engine && pnpm test`). It has no dependency on the app.
- **Publishing:** The engine is publishable to npm independently. Its `package.json` has its own version, description, and entry points. The app is not published — it's deployed as a static site.
- **CI runs from the root:** A single CI pipeline builds and tests both packages. Engine tests run first; if the engine breaks, the app isn't tested.

## Architecture Rules

These are hard rules, not suggestions. Violations should be caught in self-review.

1. **All LLM API calls go through `packages/engine/src/provider/`** — no direct `fetch` to AI APIs anywhere else in the monorepo. The provider interface is provider-agnostic; no provider-specific code outside `src/provider/`.
2. **Prompts live in `packages/engine/src/prompts/`** — one file per feature, with a version constant and tested output shape.
3. **The engine (`packages/engine/`) has zero browser API dependencies** — no `document`, no `window`, no `localStorage`, no `fetch` polyfill assumptions. It runs identically in Node and the browser.
4. **Engine/UI boundary:** The engine emits events with all data the UI needs to render. The UI never reaches back into the engine for display info. This is the core design constraint.
5. **API keys appear only in:** the provider's request headers, the app's settings store, and `localStorage`. Nowhere else. Never in logs, error messages, exports, or URLs.
6. **Student state is the engine's responsibility.** The app reads it via events and getters. The app never computes mastery, gap analysis, or adaptive logic.
7. **Generated content is ephemeral by default.** Only explicit user action (export) makes it persistent outside the session.
8. **The prefetcher runs only one section ahead.** Never more. The user is paying for API calls.
9. **No `{@html}` in Svelte components without explicit sanitization.** LLM-generated content rendered in the UI must be escaped. Svelte auto-escapes `{expressions}`; `{@html}` bypasses this and is a XSS vector.
10. **Import data is untrusted input.** Validate shape and types before restoring. Never trust that an imported JSON file has the expected structure.

## File Layout

```
course-quizzer/                       # Monorepo root
├── packages/
│   └── engine/                       # QuizzerEngine library
│       ├── src/
│       │   ├── index.ts              # Public API re-exports
│       │   ├── engine/
│       │   │   ├── CourseEngine.ts    # State machine, session orchestrator
│       │   │   ├── types.ts          # All public types
│       │   │   ├── events.ts         # Typed event emitter
│       │   │   └── errors.ts         # Domain errors
│       │   ├── curriculum/
│       │   │   ├── CurriculumManager.ts
│       │   │   ├── SyllabusParser.ts
│       │   │   └── types.ts
│       │   ├── student/
│       │   │   ├── StudentModel.ts    # Per-topic mastery, gap tracking
│       │   │   ├── AdaptiveSelector.ts
│       │   │   └── types.ts
│       │   ├── content/
│       │   │   ├── ContentGenerator.ts
│       │   │   ├── Prefetcher.ts
│       │   │   ├── ContentCache.ts
│       │   │   └── types.ts
│       │   ├── prompts/
│       │   │   ├── syllabus-analysis.ts
│       │   │   ├── explanation.ts
│       │   │   ├── quiz-generation.ts
│       │   │   ├── assessment.ts
│       │   │   ├── adaptive-followup.ts
│       │   │   └── types.ts
│       │   ├── provider/
│       │   │   ├── ClaudeProvider.ts
│       │   │   ├── types.ts
│       │   │   └── rate-limiter.ts
│       │   ├── storage/
│       │   │   ├── StorageAdapter.ts  # Interface
│       │   │   └── MemoryAdapter.ts   # For testing
│       │   └── export/
│       │       ├── Exporter.ts
│       │       └── Importer.ts
│       └── tests/
├── apps/
│   └── coursequizzer/                # SvelteKit app
│       ├── src/
│       │   ├── routes/
│       │   │   ├── +page.svelte
│       │   │   ├── +layout.svelte
│       │   │   ├── course/
│       │   │   │   ├── new/+page.svelte
│       │   │   │   └── [courseId]/
│       │   │   │       ├── +page.svelte
│       │   │   │       └── learn/+page.svelte
│       │   │   ├── settings/+page.svelte
│       │   │   └── export/+page.svelte
│       │   ├── lib/
│       │   │   ├── stores/
│       │   │   ├── components/
│       │   │   ├── storage/
│       │   │   └── security/
│       │   ├── app.html
│       │   └── app.css
│       └── tests/
│           ├── unit/
│           ├── integration/
│           └── e2e/
├── AGENTS.md
├── ROADMAP.md
├── CHANGELOG.md
├── pnpm-workspace.yaml
└── package.json
```

## Development

**Prerequisites:** Node 20+, pnpm 9+.

**Setup:**

```bash
pnpm install                          # Install all workspace dependencies
```

**Engine development:**

```bash
cd packages/engine
pnpm test                             # Vitest — engine tests
pnpm build                            # TypeScript build
```

**App development:**

```bash
cd apps/coursequizzer
pnpm dev                              # SvelteKit dev server
pnpm build                            # Static site build
pnpm test                             # Vitest — component/store tests
pnpm test:e2e                         # Playwright — end-to-end tests
```

**From root:**

```bash
pnpm -r test                          # Test all packages
pnpm -r build                         # Build all packages
pnpm format                           # Prettier — entire monorepo
pnpm format:check                     # CI check
```

**Tests must pass before committing.** Run `pnpm -r test` from the root.

## Conventions

- TypeScript strict mode — no `any` types except where interfacing with untyped external APIs
- ES module format throughout
- Defensive copies of caller-provided data in the engine (`[...array]`, `{ ...obj }`)
- Private fields (`#field`) for engine internals — not `_field` or closures
- Section comments (`// --- Section Name ---`) to group related code in larger files
- Descriptive variable names — no single-letter variables outside tight loops
- When in doubt, a short comment is better than making the reader trace through code
- Prettier standard formatting: single quotes, 2-space indent, no trailing whitespace

**Readability is a nonfunctional requirement.** The bar: a junior engineer who is competent but not expert — someone who can read TypeScript and follow logic — should be able to read any file in this codebase and build a mental model of what the system does. Not just "what does this line do" but "how does this piece fit into the whole." If a junior engineer would need to trace through three files to understand why a function exists, add a comment explaining the purpose. If a module's role in the system isn't obvious from its name and structure, add a doc comment at the top explaining what it does and how it relates to the rest.

Concretely: use section headers to group related code, add doc comments on non-obvious algorithms, choose method names that describe what the code does (not what the caller uses it for), label conditional branches, and avoid single-letter variable names outside tight loops. But these are tactics — the goal is comprehension, not decoration. A well-named function with clear structure needs no comments. A complex algorithm needs explanation regardless of how it's formatted.

## Prompt Engineering Standards

Prompts are a first-class engineering artifact, not strings buried in code.

- **Location:** All prompts live in `packages/engine/src/prompts/`. One file per feature.
- **Versioning:** Each prompt file exports a version constant (e.g., `export const SYLLABUS_ANALYSIS_VERSION = '1.0'`). Bump on any prompt text change. This makes prompt changes traceable in git history.
- **Structure:** Prompt files export builder functions (`buildSystemPrompt(params)`, `buildUserPrompt(params)`), never raw template strings. The builder validates its inputs.
- **Testing:** Every prompt has a companion test that validates the expected response shape against recorded Claude API responses. Store fixtures in `packages/engine/tests/fixtures/`.
- **Quality review:** Prompt changes require a quality check: run the prompt against 3+ diverse syllabi or inputs and verify output quality before merging. Document which inputs were tested in the PR description.
- **Separate commits:** Prompt text changes are always a separate commit from code changes, so the diff is reviewable on its own.
- **Security:** No user-controlled data in system prompts. Syllabus text goes into the user message. The system prompt defines Claude's role and output format; user input goes into the user message where Claude expects untrusted content.
- **Output format:** Prompts request JSON output with a documented schema. The engine parses and validates the schema before using the response. Malformed responses trigger a retry (once) before surfacing an error.

## Testing Philosophy (Goldilocks)

Every test should answer the question: "does this code actually work?" If a test doesn't meaningfully demonstrate that something works correctly, it shouldn't exist. Comprehensive coverage of real behavior, zero wasted tests.

Don't test trivial assignments, getters that return a field, or framework wiring. Do test anything where a bug would be non-obvious or would break the user experience. The sweet spot: if you deleted a test, would you lose confidence that the system works? If yes, keep it. If no, delete it.

**Engine — good targets:**

- State machine transitions and edge cases (invalid transitions throw, guards prevent wrong states)
- Answer grading correctness for all question types
- Prompt output parsing against recorded API fixtures
- Serialize/restore round-trips — restored engine behaves identically
- Event payloads contain all data the UI needs
- StudentModel mastery calculations and gap detection
- Prefetcher lifecycle (start, cache hit, cache miss, cancel)
- StorageAdapter contract tests (any adapter implementation passes the same suite)
- Export data explicitly excludes API keys (security test)
- Import validation rejects malformed data

**App — good targets:**

- Store wiring: engine events flow into reactive state correctly
- Component rendering: given a state, does the right thing appear
- API key input: validation, masking, storage, removal
- E2E: paste syllabus → answer first question (the critical path)

**Not worth testing:**

- CSS rendering
- Exact LLM output text (it's nondeterministic)
- Framework internals (SvelteKit routing, Svelte reactivity)

**Patterns:**

- Factory functions (`mockProblem(id)`, `mockCurriculum()`) for test data
- The `collectEvents` pattern: register listener, perform actions, assert on collected events
- Test through shuffling by reading `engine.currentItem` — don't assume content order
- Recorded API fixtures for deterministic prompt tests — capture once, replay in CI

## Security Review

This app handles API keys in the browser and renders LLM-generated content. The attack surface is real.

### Checklist

- [ ] **API key storage** — `localStorage` only. Never in cookies, `sessionStorage`, URL params, or exported data. Never logged, never in error messages.
- [ ] **API key transmission** — Only to `api.anthropic.com`, only in the `x-api-key` header. Verify every `fetch()` call in the codebase.
- [ ] **XSS in rendered content** — LLM-generated text must be escaped. In Svelte, `{expression}` auto-escapes. Every use of `{@html}` must be justified and wrapped in a sanitizer. Search for `{@html` during review.
- [ ] **No `eval()`** — No `eval()`, `new Function()`, or dynamic script injection. No exceptions.
- [ ] **CORS / browser access** — Direct browser-to-Anthropic API requires the `anthropic-dangerous-direct-browser-access` header. This is documented and intentional. No other unexpected CORS usage.
- [ ] **Export security** — Export bundles must never include the API key. Verify with a test.
- [ ] **Import validation** — Imported JSON is untrusted input. Validate shape and types before restoring state. Never `JSON.parse()` and cast without validation.
- [ ] **Network requests** — All outbound requests go only to `api.anthropic.com`. No telemetry, no analytics, no unexpected network calls. Audit every `fetch()`.
- [ ] **Dependencies** — Minimize. Audit `package.json` after adding any dependency. No postinstall scripts.
- [ ] **Content Security Policy** — If self-hosting, set restrictive CSP headers. Document the recommended CSP in the README.
- [ ] **LocalStorage sensitivity** — Course progress contains the syllabus the user studied. This is potentially sensitive. It stays in `localStorage` and is never transmitted. Export warns if applicable.

### When to run

- After adding any new dependency
- After any change to how API keys are stored or transmitted
- After any change to content rendering (especially adding `{@html}`)
- After any change to export/import
- Periodically during staff reviews (every 3-4 milestones)

Fix issues immediately. If a security concern requires an architectural change, flag it for the project owner.

## Content Quality Standards

LLM-generated educational content needs quality gates beyond "it parsed correctly."

- **Self-contained questions:** Generated questions must be understandable without the source material. A student should be able to read the question and all options without needing to reference the syllabus.
- **Scope adherence:** Explanations and questions must stay within the topics defined by the syllabus. The prompt instructs Claude to stay in scope; the engine should not attempt to verify this (it cannot), but quality issues should be reportable by the user.
- **Structural validation:** The engine validates generated content before presenting it: correct JSON shape, required fields present, correct number of options, no duplicate options, answer key present and valid. Malformed content triggers a single retry.
- **No front-matter questions:** Questions about publication metadata, authors, or edition numbers are low-value for learning. Filter them if they appear (lesson learned from PageQuizzer).
- **Option quality:** The length-outlier and uniquely-specific-correct-answer checks from PageQuizzer apply here. If the correct answer is the only long, detailed, or specific option, the question is too guessable.
- **Quality reporting:** The app displays a "Report issue" action on every generated item. In v1 this logs to console. In v2, it writes to a local quality log the user can review.
- **Content is ephemeral:** Generated content is not cached permanently without the student's explicit action (export). Regeneration is always available. This is a feature, not a limitation — it means a student can get fresh material by replaying a section.

## Self-Review Loop

**Mandatory after every milestone.** Switch to a reviewer role and critique harshly:

- [ ] Bugs in engine logic (state transitions, mastery calculation, edge cases)
- [ ] Architecture rule violations (see Architecture Rules above — every numbered rule gets checked)
- [ ] Dead code or unused fields after refactors
- [ ] API surface mismatch (engine exposes things the UI doesn't need, or vice versa)
- [ ] Missing test coverage for new functionality
- [ ] Prompt quality (run against diverse inputs, check output)
- [ ] Security checklist items affected by this milestone's changes
- [ ] Readability: descriptive names, section comments, labeled branches
- [ ] `any` types — each one is a type safety hole

Fix issues. Review again. **Iterate until the reviewer finds nothing significant.**

**Escape hatch:** If the same issue recurs or you're uncertain, flag it for human review and move on.

## Branching & Pull Requests

All changes to `main` require a pull request. No direct commits to `main`.

- **Branch naming:** `feat/`, `fix/`, `chore/` prefixes (e.g., `feat/syllabus-parser`, `fix/prefetch-race-condition`)
- **Before opening a PR:** run `pnpm -r test`, `pnpm -r build`, `pnpm format:check`, and the self-review checklist
- **CI runs on every PR:** checkout → Node 20 → `pnpm install` → engine test → engine build → app test → app build → format check
- **Branch protection** is configured in the GitHub UI (require PRs, require CI status check)
- **Code review:** The review agent monitors open PRs and reviews them (see Agent Workflow below). Trivial PRs (version bumps, typos, config tweaks, doc-only) can merge after CI passes without a full review.
- **Cross-package PRs:** When a PR touches both `packages/engine` and `apps/coursequizzer`, the PR description must explain why both are changing together.

## Agent Workflow

This project uses Claude agents running in git worktrees for parallel development. GitHub is the dispatch and coordination system — not local files.

### Roles

- **Planning agent** — Breaks down ROADMAP.md phases into GitHub issues with clear scope and acceptance criteria. Updates ROADMAP.md and AGENTS.md as the project evolves.
- **Coding agent** — Implements features and fixes. Monitors GitHub issues for work. Monitors their own open PRs for review feedback.
- **Review agent** — Reviews PRs. Monitors open PRs for new or updated submissions.
- **John** — Signs off on the roadmap, makes architectural decisions, course-corrects. Does not author. John approves phases in ROADMAP.md; once a phase is approved, the planning agent creates issues and agents execute without waiting for per-issue or per-PR approval.

### Worktree Setup

Each agent runs in its own git worktree so they can work in parallel without conflicts:

```bash
# From the main clone, create worktrees for each agent
git worktree add ../cq-coding -b feat/current-task
git worktree add ../cq-review main

# Each agent runs in its own terminal
cd ../cq-coding && claude    # coding agent
cd ../cq-review && claude    # review agent
```

Worktrees share the same git history but have independent working directories. Each agent works on its own branch.

### Dispatch: Plan → Issues → Code → PR → Review

**GitHub issues are the task queue.** The full workflow:

1. **Planning agent breaks down work into issues:**
   - Reads ROADMAP.md for the current phase
   - Creates GitHub issues with clear scope, acceptance criteria, and context
   - Labels: `engine`, `app`, `prompt`, `infra`, etc.
   - Issues are created once John has signed off on the phase in ROADMAP.md
2. **Coding agent picks up an issue:**
   - Reads AGENTS.md
   - Creates a feature branch in their worktree (`feat/issue-description`)
   - Implements the feature, following Architecture Rules
   - Runs `pnpm -r test`, `pnpm -r build`, `pnpm format`
   - Runs the self-review loop
   - Opens a PR linking the issue (e.g., "Closes #12")
3. **Review agent picks up the PR:**
   - Reads every changed source file — not just diffs
   - Checks all Architecture Rules (every numbered rule)
   - Verifies test coverage matches new functionality
   - Checks prompt quality if prompt changes are included
   - Looks for: `any` types, browser APIs in the engine, direct API calls outside provider, unsanitized `{@html}`, API keys in exports
   - Checks readability: section headers, doc comments, descriptive names, labeled branches
   - Posts review findings as PR comments
4. **Coding agent addresses review feedback:**
   - Monitors their own open PRs for new comments
   - Pushes fixes to the same branch
   - Re-requests review
5. **Review agent re-reviews.** Iterate until clean.
6. **Review agent approves.** Coding agent merges the PR.

### Issue Format

The planning agent creates issues. Good issues contain:

- **What:** Clear description of the feature or fix
- **Why:** Context and motivation
- **Scope:** What's in and out of scope
- **Package:** Which package(s) are affected (`packages/engine`, `apps/coursequizzer`, or both)
- **Acceptance criteria:** How to know it's done
- **Dependencies:** Other issues that must be completed first (if any)

### Coding Agent Checklist

Before opening a PR:

1. All Architecture Rules followed
2. `pnpm -r test` passes
3. `pnpm -r build` passes
4. `pnpm format` run
5. Self-review loop completed
6. CHANGELOG.md updated
7. PR description links the issue and explains the approach

### Review Agent Checklist

For each PR:

1. Read every changed source file — not just diffs
2. Check all Architecture Rules (every numbered rule)
3. Verify test coverage matches current functionality
4. Check CHANGELOG.md accurately reflects what's in the code
5. Run prompts against diverse inputs if prompt changes are included
6. Check readability: section headers, doc comments, descriptive names, labeled branches
7. Flag anything needing John's decision
8. At the end of significant reviews: check if AGENTS.md Lessons Learned should be updated

### Planning Agent Checklist

When breaking down a phase into issues:

1. Read AGENTS.md and ROADMAP.md
2. Break the phase into issues that are independently implementable where possible
3. Order issues by dependency (what must be built first)
4. Keep issues small enough for one PR — if an issue needs 10+ files changed, split it
5. Include enough context in each issue that the coding agent doesn't need to ask clarifying questions
6. After creating issues, update ROADMAP.md to link to them

## Commit Attribution

Include model and tool info. Examples:

```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Roadmap & Changelog

- `ROADMAP.md` — High-level project plan, organized by phase. The planning agent reads this to create GitHub issues for the current phase. Not a task queue itself — GitHub issues are the task queue.
- `CHANGELOG.md` — Completed work, with version numbers and dates
- The planning agent updates ROADMAP.md as phases are completed or plans evolve
- Update CHANGELOG at the end of every milestone

## Maintaining This File

**This AGENTS.md is a living document.** At the end of each session or milestone:

1. **Capture insights** — If you learned something reusable (a pattern that worked, a mistake to avoid), add it to Lessons Learned
2. **Trim cruft** — Remove anything obvious, outdated, or low-value
3. **Refine structure** — If a section is getting unwieldy, reorganize

The goal: a future agent instance should be productive faster because of what we learned.

## Lessons Learned

Insights captured from development. This section starts empty and grows with the project.

**Inherited from OpenQuizzer and PageQuizzer (validated patterns):**

- Engine emits events with all data the UI needs — UI should never reach back into the engine for display info
- Store defensive copies of caller-provided arrays (`[...problems]`) — the caller may mutate the original
- Guard state transitions: methods should throw or no-op if the engine is in the wrong state
- `serialize()` / `restore()` enable persistence; restore does NOT emit events (the consumer must resync explicitly)
- Factory functions (`mockProblem(id)`) and the `collectEvents` pattern keep tests concise and readable
- When splitting mixed functions (part logic, part DOM), the engine emits events; the UI listens — never the reverse
- Rename methods to match what they actually do, not what the caller conceptually wants
- Watch for dead fields after extraction: if a field is set but never read, delete it
- Every `JSON.parse` of untrusted data needs runtime shape validation, not just a type cast
- If the correct answer is the only long, specific, or detailed option, the question is too guessable — apply structural checks
- Prompt changes should be in separate commits from code changes for reviewability
- Keep hooks versioned in `.githooks/` and use `npm prepare` to set `core.hooksPath`
