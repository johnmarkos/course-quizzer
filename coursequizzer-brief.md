# CourseQuizzer — Project Brief

## What This Is

CourseQuizzer is a web app that takes real-world course syllabi (e.g. MIT OCW) and dynamically generates adaptive course material as the student progresses. It emphasizes active recall — quizzing, problem-solving, demonstration of knowledge — over passive reading.

Content is generated on-the-fly via the user's own Anthropic API key. Nothing phones home. The app never knows what anyone is studying.

## Two Projects, One Ecosystem

### OpenQuizzer 2.0 (the engine)

A client-side JavaScript library. Evolved from the original OpenQuizzer. Separate repo, separate package, no opinions about presentation.

Responsibilities:

- Accept a syllabus (pasted text, URL, or structured data)
- Maintain student state: progress through curriculum, demonstrated knowledge, identified gaps
- Generate adaptive content via Claude API: explanations, questions, problems, assessments
- Pre-fetch one section ahead to hide latency
- Export everything as portable data (JSON, markdown)
- Provide a clean API surface that any frontend can consume

What it is NOT:

- Not a UI
- Not a server
- Not aware of how it's being presented

Key insight from System Design Practice: syllabus parsing is not a structured data extraction problem. Claude understands what a course is about from a syllabus and generates appropriate material. The syllabus is context, not a schema.

### CourseQuizzer (the app)

One frontend that consumes OpenQuizzer 2.0. The "actually good website."

Responsibilities:

- Course selection / syllabus input UX
- API key management (stored in browser)
- Course progression UX
- Progress storage: LocalStorage with JSON export/import for backup
- Eventually: Google Drive sync, mobile, desktop

## Architectural Decisions (Made)

1. **Client-side only.** No backend servers, no content database, no user accounts. The app is a static site that orchestrates Claude API calls from the browser. Hostable on GitHub Pages or Netlify for free.

2. **User's own API key.** User provides their Anthropic API key. Stored in browser only. This keeps costs off us, selects for serious users, and preserves total privacy.

3. **No phone-home, no shared content.** All content is generated locally. The user decides what, if anything, to publish. This is a privacy-first design: the app never knows what anyone is studying.

4. **Personalized content, generated client-side.** Every user gets material adapted to their level and gaps. No canonical content library on our infrastructure. If a user wants to generate and publish a static course, the engine supports that — but it's the user's choice.

5. **Engine/presentation separation.** OpenQuizzer 2.0 is the engine; CourseQuizzer is one skin. Others can build different frontends, or use the engine to batch-generate content for static sites.

6. **Pre-generate one section ahead.** To manage API latency, the engine generates the next section while the student works on the current one.

## Architectural Decisions (Open)

1. **Frontend framework.** Constraints: no backend needed (static site), should age well, Claude Code needs to be productive in it. Candidates:
   - React/Vite — largest ecosystem, Claude Code knows it best, risk of aging like Angular
   - Svelte/SvelteKit — closer to the platform, less lock-in, smaller community
   - Web Components / Lit — maximally durable, less tooling
   - Pragmatic answer may be: whatever Claude Code generates best + clean architecture so the UI layer is swappable

2. **State persistence beyond LocalStorage.** v1 is LocalStorage + JSON export/import. Google Drive sync is a natural next step. Architecture should allow pluggable storage backends.

3. **Testing strategy.** Integration and E2E testing are in scope — a step up from previous projects. Specific framework TBD. The engine needs its own test suite independent of the app.

4. **Cross-platform strategy.** Web-first. Mobile and desktop come later. PWA might get 90% of the value. Decision deferred.

## Quality Constraints

Carried forward from PageQuizzer and OpenQuizzer, plus additions:

- Well-tested: unit tests on the engine, integration + E2E tests on the app
- Human-readable code: a good junior engineer should be able to review any file
- Security reviews, especially around API key handling
- Quality tests that verify the code actually works
- All AI-generated code goes through review (centaur workflow)

## Development Workflow

- GitHub as project management (issues, PRs)
- Author agents poll GitHub issues
- Review agents poll PRs
- Author agents also poll their own PRs
- All AI communications go through John

## Context

This is part of the "Nhoj" entity's edtech portfolio:

- **PageQuizzer** — Chrome extension, quizzes on any webpage (live on Chrome Web Store)
- **OpenQuizzer** — reusable open-source quiz engine underneath PageQuizzer
- **System Design Practice** — 1,800+ pre-generated problems
- **CourseQuizzer** — this project

North star: something like Neal Stephenson's "A Young Lady's Illustrated Primer" — personalized, adaptive, rigorous, accessible.
