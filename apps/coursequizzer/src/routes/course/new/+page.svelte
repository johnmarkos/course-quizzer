<script lang="ts">
  import { goto } from '$app/navigation';
  import { ClaudeProvider, type CurriculumPlan } from 'quizzer-engine';
  import { getApiKey } from '$lib/stores/api-key.js';
  import {
    analyzeSyllabus,
    saveCourseFromPlan,
    validateSyllabusInput,
    MIN_SYLLABUS_LENGTH,
  } from '$lib/stores/new-course.js';
  import { normalizeError } from '$lib/errors/app-errors.js';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';

  // --- State ---

  type FlowStep = 'input' | 'analyzing' | 'review' | 'saving' | 'error';

  let step = $state<FlowStep>('input');
  let syllabusText = $state('');
  let validationError = $state('');
  let analysisError = $state('');
  let plan = $state<CurriculumPlan | null>(null);

  // --- Derived ---

  const hasApiKey = $derived(getApiKey(localStorage) !== null);
  const charCount = $derived(syllabusText.trim().length);

  // --- Handlers ---

  async function handleAnalyze(e: SubmitEvent) {
    e.preventDefault();

    // Validate input
    const inputError = validateSyllabusInput(syllabusText);
    if (inputError) {
      validationError = inputError;
      return;
    }
    validationError = '';

    // Check API key
    const apiKey = getApiKey(localStorage);
    if (!apiKey) {
      validationError = 'No API key found. Please add one in Settings first.';
      return;
    }

    // Analyze
    step = 'analyzing';
    analysisError = '';

    const provider = new ClaudeProvider({ apiKey });
    const result = await analyzeSyllabus({
      syllabusText: syllabusText.trim(),
      sendMessage: (req) => provider.sendMessage(req),
    });

    if (result.ok) {
      plan = result.plan;
      step = 'review';
    } else {
      analysisError = result.error;
      step = 'error';
    }
  }

  function handleBackToInput() {
    step = 'input';
    analysisError = '';
  }

  function handleRetry() {
    step = 'input';
    analysisError = '';
  }

  function handleSave() {
    if (!plan) return;

    step = 'saving';
    try {
      const record = saveCourseFromPlan(plan, localStorage);
      goto(`/course/${record.id}`);
    } catch (err) {
      analysisError = normalizeError(err).message;
      step = 'error';
    }
  }
</script>

<svelte:head>
  <title>New Course — CourseQuizzer</title>
</svelte:head>

<main>
  <h1>New Course</h1>

  {#if !hasApiKey}
    <!-- No API key state -->
    <section>
      <p>
        You need an Anthropic API key to analyze syllabi. Please add one in
        <a href="/settings">Settings</a> first.
      </p>
    </section>
  {:else if step === 'input'}
    <!-- Syllabus input step -->
    <section>
      <p>
        Paste your course syllabus below. CourseQuizzer will analyze it and
        create a structured curriculum plan for adaptive learning.
      </p>

      <form onsubmit={handleAnalyze}>
        <label for="syllabus-input">Syllabus text</label>
        <textarea
          id="syllabus-input"
          bind:value={syllabusText}
          placeholder="Paste your course syllabus here..."
          rows="12"
        ></textarea>
        <p class="char-count">
          {charCount} characters
          {#if charCount > 0 && charCount < MIN_SYLLABUS_LENGTH}
            (minimum {MIN_SYLLABUS_LENGTH})
          {/if}
        </p>

        {#if validationError}
          <p role="alert" class="error">{validationError}</p>
        {/if}

        <button type="submit">Analyze Syllabus</button>
      </form>
    </section>
  {:else if step === 'analyzing'}
    <!-- Loading state -->
    <section>
      <LoadingIndicator
        message="Analyzing your syllabus with Claude..."
        detail="This may take 10–30 seconds depending on the syllabus length."
      />
    </section>
  {:else if step === 'review' && plan}
    <!-- Curriculum plan review step -->
    <section>
      <h2>{plan.title}</h2>
      <p>{plan.description}</p>

      <h3>Curriculum Plan ({plan.sections.length} sections)</h3>

      <ol class="section-list">
        {#each plan.sections as section (section.id)}
          <li>
            <strong>{section.title}</strong>
            <ul>
              {#each section.topics as topic (topic.id)}
                <li>
                  <strong>{topic.title}</strong> — {topic.description}
                </li>
              {/each}
            </ul>
          </li>
        {/each}
      </ol>

      <div class="actions">
        <button type="button" onclick={handleSave}>Save Course</button>
        <button type="button" class="secondary" onclick={handleBackToInput}>
          Back to Edit
        </button>
      </div>
    </section>
  {:else if step === 'error'}
    <!-- Error state -->
    <section>
      <ErrorAlert message={analysisError} recoverable={true} onretry={handleRetry} />
    </section>
  {:else if step === 'saving'}
    <!-- Saving state (brief — redirects immediately) -->
    <section>
      <LoadingIndicator message="Saving course..." />
    </section>
  {/if}

  <p><a href="/">← Back to home</a></p>
</main>

<style>
  main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem;
  }

  textarea {
    width: 100%;
    font-family: inherit;
    font-size: 0.95rem;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
  }

  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .char-count {
    font-size: 0.85rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .error {
    color: #c00;
    font-weight: 600;
  }

  .section-list {
    margin: 1rem 0;
  }

  .section-list > li {
    margin-bottom: 0.75rem;
  }

  .section-list ul {
    margin-top: 0.25rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
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

  .secondary {
    background: #fff;
    color: #333;
  }

  .secondary:hover {
    background: #f0f0f0;
  }
</style>
