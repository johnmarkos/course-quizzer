<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getCourse } from '$lib/storage/course-storage.js';
  import { getApiKey } from '$lib/stores/api-key.js';
  import {
    createEngineSession,
    type EngineSession,
  } from '$lib/stores/engine-session.svelte.js';
  import {
    ClaudeProvider,
    ContentGenerator,
    type ContentItem,
    type Section,
  } from 'quizzer-engine';
  import { normalizeError } from '$lib/errors/app-errors.js';

  // --- State ---

  const courseId = $derived(page.params.courseId);
  const course = $derived(courseId ? getCourse(courseId, localStorage) : null);

  let session: EngineSession | null = $state(null);
  let generateError = $state('');
  let generating = $state(false);

  // Initialize session when course loads
  $effect(() => {
    if (!course) return;
    const apiKey = getApiKey(localStorage);
    if (!apiKey) return;

    const newSession = createEngineSession({
      apiKey,
      courseId: course.id,
      storage: localStorage,
      snapshot: course.snapshot ?? undefined,
    });

    // If no snapshot or restore failed, load the curriculum fresh
    if (!course.snapshot || newSession.restoreFailed) {
      newSession.loadCurriculum(course.curriculum);
    }
    session = newSession;

    return () => {
      newSession.dispose();
    };
  });

  // --- Content generation ---

  async function handleStartSection(sectionId: string) {
    if (!session || !course) return;
    const apiKey = getApiKey(localStorage);
    if (!apiKey) return;

    generateError = '';
    generating = true;

    session.startSection(sectionId);

    const section = course.curriculum.sections.find((s) => s.id === sectionId);
    if (!section) {
      generateError = 'Section not found.';
      generating = false;
      return;
    }

    try {
      const provider = new ClaudeProvider({ apiKey });
      const generator = new ContentGenerator(provider);
      const items = await generator.generateSection(section, course.curriculum.title);
      session.setSectionContent(items);
    } catch (err) {
      generateError = normalizeError(err).message;
    } finally {
      generating = false;
    }
  }

  // --- Answer handling ---

  function handleMultipleChoice(selectedIndex: number) {
    if (!session) return;
    session.submitAnswer({ type: 'multiple-choice', selectedIndex });
  }

  function handleNumericInput(value: number) {
    if (!session) return;
    session.submitAnswer({ type: 'numeric-input', value });
  }

  function handleOrdering(order: number[]) {
    if (!session) return;
    session.submitAnswer({ type: 'ordering', order });
  }

  function handleMultiSelect(selectedIndices: number[]) {
    if (!session) return;
    session.submitAnswer({ type: 'multi-select', selectedIndices });
  }

  function handleTwoStage(selectedIndex: number, followUpSelectedIndex: number) {
    if (!session) return;
    session.submitAnswer({
      type: 'two-stage',
      selectedIndex,
      followUpSelectedIndex,
    });
  }

  function handleNext() {
    session?.nextItem();
  }

  function handleSkip() {
    session?.skipQuestion();
  }

  function handleNextSection() {
    session?.nextSection();
  }

  function handleBackToOverview() {
    goto(`/course/${courseId}`);
  }

  function handleReportIssue() {
    const item = session?.currentItem?.item;
    if (item) {
      // v1: log to console per spec
      console.log('[CourseQuizzer] Content issue reported:', {
        itemType: item.type,
        topicId: item.topicId,
        timestamp: new Date().toISOString(),
      });
      reportedItem = true;
      setTimeout(() => {
        reportedItem = false;
      }, 2000);
    }
  }

  let reportedItem = $state(false);

  // --- Two-stage local state ---

  let twoStageFirstAnswer = $state<number | null>(null);

  // Reset two-stage state when item changes
  $effect(() => {
    if (session?.currentItem) {
      twoStageFirstAnswer = null;
    }
  });

  // --- Ordering local state ---

  let orderingSequence = $state<number[]>([]);

  $effect(() => {
    const item = session?.currentItem?.item;
    if (item && item.type === 'ordering') {
      // Initialize with natural order
      orderingSequence = item.items.map((_, i) => i);
    }
  });

  function moveOrderingItem(fromIdx: number, direction: 'up' | 'down') {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= orderingSequence.length) return;
    const copy = [...orderingSequence];
    [copy[fromIdx], copy[toIdx]] = [copy[toIdx], copy[fromIdx]];
    orderingSequence = copy;
  }

  // --- Multi-select local state ---

  let multiSelectChoices = $state<Set<number>>(new Set());

  $effect(() => {
    const item = session?.currentItem?.item;
    if (item && item.type === 'multi-select') {
      multiSelectChoices = new Set();
    }
  });

  function toggleMultiSelect(index: number) {
    const copy = new Set(multiSelectChoices);
    if (copy.has(index)) {
      copy.delete(index);
    } else {
      copy.add(index);
    }
    multiSelectChoices = copy;
  }

  // --- Numeric input local state ---

  let numericValue = $state('');

  $effect(() => {
    const item = session?.currentItem?.item;
    if (item && item.type === 'numeric-input') {
      numericValue = '';
    }
  });

  // --- Derived helpers ---

  const hasApiKey = $derived(getApiKey(localStorage) !== null);
</script>

<svelte:head>
  <title>{course?.title ?? 'Learn'} — CourseQuizzer</title>
</svelte:head>

<main>
  {#if !course}
    <h1>Course not found</h1>
    <p>No course with this ID was found in your browser storage.</p>
    <p><a href="/">← Back to home</a></p>
  {:else if !hasApiKey}
    <h1>{course.title}</h1>
    <p>
      You need an Anthropic API key to generate content. Please add one in
      <a href="/settings">Settings</a>.
    </p>
    <p><a href={`/course/${courseId}`}>← Back to course</a></p>
  {:else if !session}
    <p>Loading session...</p>
  {:else}
    <!-- --- Session active --- -->

    {#if session.engineState === 'ready'}
      <!-- Section picker -->
      <h1>{course.title}</h1>
      <p>Choose a section to start learning.</p>
      <ol class="section-list">
        {#each course.curriculum.sections as section (section.id)}
          <li>
            <button
              type="button"
              class="section-button"
              onclick={() => handleStartSection(section.id)}
            >
              {section.title}
            </button>
            <span class="topic-count">({section.topics.length} topics)</span>
          </li>
        {/each}
      </ol>
      <p><a href={`/course/${courseId}`}>← Back to course</a></p>

    {:else if session.engineState === 'loading' || generating}
      <!-- Generating content -->
      <h1>{course.title}</h1>
      {#if session.currentSection}
        <h2>{session.currentSection.section.title}</h2>
      {/if}
      <p class="loading">Generating learning content...</p>
      <p>This may take a minute as content is generated for each topic.</p>
      {#if generateError}
        <p role="alert" class="error">{generateError}</p>
        <button type="button" onclick={handleBackToOverview}>Back to Course</button>
      {/if}

    {:else if session.engineState === 'practicing' && session.currentItem}
      <!-- Content/quiz loop -->
      {#if session.currentSection}
        <header class="progress-bar">
          <span>
            Section {session.currentSection.sectionIndex + 1}
            of {session.currentSection.totalSections}:
            {session.currentSection.section.title}
          </span>
          <span>
            Item {session.currentItem.itemIndex + 1} of {session.currentItem.totalItems}
          </span>
        </header>
      {/if}

      {#if session.currentItem.item.type === 'explanation'}
        <!-- Explanation -->
        <article class="explanation">
          <h2>{session.currentItem.item.title}</h2>
          <p>{session.currentItem.item.content}</p>
          <div class="actions">
            <button type="button" onclick={handleNext}>Continue</button>
            <button type="button" class="text-button" onclick={handleReportIssue}>
              {reportedItem ? 'Reported' : 'Report issue'}
            </button>
          </div>
        </article>

      {:else if session.currentItem.item.type === 'multiple-choice'}
        <!-- Multiple choice -->
        <article class="question">
          <h2>{session.currentItem.item.question}</h2>
          <div class="options" role="radiogroup">
            {#each session.currentItem.item.options as option, i}
              <button
                type="button"
                class="option-button"
                onclick={() => handleMultipleChoice(i)}
              >
                {option}
              </button>
            {/each}
          </div>
          <div class="actions">
            <button type="button" class="secondary" onclick={handleSkip}>Skip</button>
            <button type="button" class="text-button" onclick={handleReportIssue}>
              {reportedItem ? 'Reported' : 'Report issue'}
            </button>
          </div>
        </article>

      {:else if session.currentItem.item.type === 'numeric-input'}
        <!-- Numeric input -->
        <article class="question">
          <h2>{session.currentItem.item.question}</h2>
          {#if session.currentItem.item.unit}
            <p class="hint">Unit: {session.currentItem.item.unit}</p>
          {/if}
          <form
            onsubmit={(e) => {
              e.preventDefault();
              const val = parseFloat(numericValue);
              if (!isNaN(val)) handleNumericInput(val);
            }}
          >
            <input
              type="number"
              step="any"
              bind:value={numericValue}
              placeholder="Enter your answer"
              class="numeric-input"
            />
            <div class="actions">
              <button type="submit">Submit</button>
              <button type="button" class="secondary" onclick={handleSkip}>Skip</button>
              <button type="button" class="text-button" onclick={handleReportIssue}>
                {reportedItem ? 'Reported' : 'Report issue'}
              </button>
            </div>
          </form>
        </article>

      {:else if session.currentItem.item.type === 'ordering'}
        <!-- Ordering -->
        <article class="question">
          <h2>{session.currentItem.item.question}</h2>
          <p class="hint">Arrange the items in the correct order using the arrows.</p>
          <ol class="ordering-list">
            {#each orderingSequence as itemIdx, position}
              <li class="ordering-item">
                <span>{session.currentItem.item.items[itemIdx]}</span>
                <span class="ordering-controls">
                  <button
                    type="button"
                    class="arrow-button"
                    disabled={position === 0}
                    onclick={() => moveOrderingItem(position, 'up')}
                    aria-label="Move up"
                  >↑</button>
                  <button
                    type="button"
                    class="arrow-button"
                    disabled={position === orderingSequence.length - 1}
                    onclick={() => moveOrderingItem(position, 'down')}
                    aria-label="Move down"
                  >↓</button>
                </span>
              </li>
            {/each}
          </ol>
          <div class="actions">
            <button type="button" onclick={() => handleOrdering(orderingSequence)}>
              Submit
            </button>
            <button type="button" class="secondary" onclick={handleSkip}>Skip</button>
            <button type="button" class="text-button" onclick={handleReportIssue}>
              {reportedItem ? 'Reported' : 'Report issue'}
            </button>
          </div>
        </article>

      {:else if session.currentItem.item.type === 'multi-select'}
        <!-- Multi-select -->
        <article class="question">
          <h2>{session.currentItem.item.question}</h2>
          <p class="hint">Select all that apply.</p>
          <div class="options">
            {#each session.currentItem.item.options as option, i}
              <button
                type="button"
                class="option-button"
                class:selected={multiSelectChoices.has(i)}
                onclick={() => toggleMultiSelect(i)}
              >
                {option}
              </button>
            {/each}
          </div>
          <div class="actions">
            <button
              type="button"
              onclick={() => handleMultiSelect([...multiSelectChoices])}
              disabled={multiSelectChoices.size === 0}
            >
              Submit
            </button>
            <button type="button" class="secondary" onclick={handleSkip}>Skip</button>
            <button type="button" class="text-button" onclick={handleReportIssue}>
              {reportedItem ? 'Reported' : 'Report issue'}
            </button>
          </div>
        </article>

      {:else if session.currentItem.item.type === 'two-stage'}
        <!-- Two-stage -->
        <article class="question">
          {#if twoStageFirstAnswer === null}
            <!-- Stage 1 -->
            <h2>{session.currentItem.item.question}</h2>
            <div class="options" role="radiogroup">
              {#each session.currentItem.item.options as option, i}
                <button
                  type="button"
                  class="option-button"
                  onclick={() => { twoStageFirstAnswer = i; }}
                >
                  {option}
                </button>
              {/each}
            </div>
          {:else}
            <!-- Stage 2 -->
            <h2>{session.currentItem.item.followUp}</h2>
            <div class="options" role="radiogroup">
              {#each session.currentItem.item.followUpOptions as option, i}
                <button
                  type="button"
                  class="option-button"
                  onclick={() => handleTwoStage(twoStageFirstAnswer!, i)}
                >
                  {option}
                </button>
              {/each}
            </div>
          {/if}
          <div class="actions">
            <button type="button" class="secondary" onclick={handleSkip}>Skip</button>
            <button type="button" class="text-button" onclick={handleReportIssue}>
              {reportedItem ? 'Reported' : 'Report issue'}
            </button>
          </div>
        </article>
      {/if}

    {:else if session.engineState === 'answered' && session.lastResult}
      <!-- Answer result -->
      {#if session.currentSection}
        <header class="progress-bar">
          <span>
            Section {session.currentSection.sectionIndex + 1}
            of {session.currentSection.totalSections}:
            {session.currentSection.section.title}
          </span>
        </header>
      {/if}

      <article class="result" class:correct={session.lastResult.result.correct} class:incorrect={!session.lastResult.result.correct}>
        <h2>{session.lastResult.result.correct ? 'Correct!' : 'Incorrect'}</h2>
        {#if !session.lastResult.result.correct}
          <p><strong>Correct answer:</strong> {session.lastResult.result.correctAnswer}</p>
        {/if}
        {#if session.lastResult.result.explanation}
          <p>{session.lastResult.result.explanation}</p>
        {/if}
        <div class="actions">
          <button type="button" onclick={handleNext}>Continue</button>
        </div>
      </article>

    {:else if session.engineState === 'sectionComplete'}
      <!-- Section complete -->
      <article class="section-complete">
        <h2>Section Complete!</h2>
        {#if session.currentSection}
          <p>You finished <strong>{session.currentSection.section.title}</strong>.</p>
        {/if}
        {#if session.progress}
          <p>
            Section {session.progress.currentSectionIndex + 1}
            of {session.progress.totalSections} |
            Overall mastery: {Math.round(session.progress.overallMastery * 100)}%
          </p>
        {/if}
        <div class="actions">
          <button type="button" onclick={handleNextSection}>Next Section</button>
          <button type="button" class="secondary" onclick={handleBackToOverview}>
            Back to Course
          </button>
        </div>
      </article>

    {:else if session.engineState === 'complete'}
      <!-- Course complete -->
      <article class="course-complete">
        <h2>Course Complete!</h2>
        <p>Congratulations — you've completed all sections of <strong>{course.title}</strong>.</p>
        {#if session.progress}
          <p>
            Overall mastery: {Math.round(session.progress.overallMastery * 100)}%
          </p>
        {/if}
        <div class="actions">
          <button type="button" onclick={handleBackToOverview}>Back to Course</button>
        </div>
      </article>

    {:else if session.error}
      <!-- Error state -->
      <article>
        <p role="alert" class="error">{session.error.message}</p>
        <button type="button" onclick={handleBackToOverview}>Back to Course</button>
      </article>

    {:else}
      <p>Loading...</p>
    {/if}
  {/if}
</main>

<style>
  main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem;
  }

  .progress-bar {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    margin-bottom: 1rem;
    border-bottom: 1px solid #ddd;
    font-size: 0.85rem;
    color: #666;
  }

  .explanation {
    margin: 1rem 0;
  }

  .question {
    margin: 1rem 0;
  }

  .question h2 {
    margin-bottom: 1rem;
  }

  .hint {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 0.75rem;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .option-button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 0.95rem;
    color: #333;
  }

  .option-button:hover {
    background: #f5f5f5;
    border-color: #999;
  }

  .option-button.selected {
    background: #e8f0fe;
    border-color: #1a73e8;
    color: #1a73e8;
  }

  .numeric-input {
    width: 100%;
    max-width: 16rem;
    padding: 0.5rem;
    font-size: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .ordering-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
  }

  .ordering-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.25rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
  }

  .ordering-controls {
    display: flex;
    gap: 0.25rem;
  }

  .arrow-button {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 0.85rem;
    color: #333;
  }

  .arrow-button:hover:not(:disabled) {
    background: #f0f0f0;
  }

  .arrow-button:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .result {
    margin: 1rem 0;
    padding: 1rem;
    border-radius: 4px;
  }

  .result.correct {
    background: #e6f4ea;
    border: 1px solid #34a853;
  }

  .result.incorrect {
    background: #fce8e6;
    border: 1px solid #ea4335;
  }

  .section-complete,
  .course-complete {
    margin: 2rem 0;
    text-align: center;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    align-items: center;
  }

  .section-list {
    list-style: none;
    padding: 0;
  }

  .section-list li {
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-button {
    padding: 0.5rem 1rem;
    border: 1px solid #333;
    border-radius: 4px;
    background: #333;
    color: #fff;
    cursor: pointer;
    font-size: 0.95rem;
  }

  .section-button:hover {
    background: #555;
  }

  .topic-count {
    font-size: 0.85rem;
    color: #666;
  }

  button {
    padding: 0.5rem 1rem;
    font-size: 0.95rem;
    cursor: pointer;
    border: 1px solid #333;
    border-radius: 4px;
    background: #333;
    color: #fff;
  }

  button:hover {
    background: #555;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .secondary {
    background: #fff;
    color: #333;
  }

  .secondary:hover {
    background: #f0f0f0;
  }

  .text-button {
    background: none;
    border: none;
    color: #666;
    font-size: 0.85rem;
    padding: 0.25rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .text-button:hover {
    color: #333;
    background: none;
  }

  .loading {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .error {
    color: #c00;
    font-weight: 600;
  }
</style>
