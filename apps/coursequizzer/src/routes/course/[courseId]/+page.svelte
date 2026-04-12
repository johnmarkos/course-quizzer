<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getCourse, deleteCourse } from '$lib/storage/course-storage.js';
  import { hasApiKey } from '$lib/stores/api-key.js';
  import {
    getCourseProgress,
    formatMastery,
    getProgressLabel,
  } from '$lib/stores/course-progress.js';
  import { normalizeError } from '$lib/errors/app-errors.js';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';

  const courseId = $derived(page.params.courseId);

  // Load course — errors are returned as part of the result object to avoid
  // mutating reactive state inside a $derived computation.
  const courseResult = $derived.by(() => {
    if (!courseId) return { data: null, error: '' };
    try {
      return { data: getCourse(courseId, localStorage), error: '' };
    } catch (err) {
      return { data: null, error: normalizeError(err).message };
    }
  });

  const course = $derived(courseResult.data);
  const loadError = $derived(courseResult.error);
  const progress = $derived(course ? getCourseProgress(course) : null);
  const apiKeyStored = $derived(hasApiKey(localStorage));

  // --- Delete confirmation ---

  let confirmingDelete = $state(false);

  function requestDelete() {
    confirmingDelete = true;
  }

  function cancelDelete() {
    confirmingDelete = false;
  }

  function confirmDelete() {
    if (!courseId) return;
    deleteCourse(courseId, localStorage);
    goto('/');
  }

  // --- Section resume logic ---

  /**
   * Determine which section to link to for "Start Learning" / "Resume".
   * Uses the snapshot's currentSectionIndex if available.
   */
  function getResumeSectionId(): string | null {
    if (!course) return null;
    const sections = course.curriculum.sections;
    if (sections.length === 0) return null;

    if (progress && progress.currentSectionIndex < sections.length) {
      return sections[progress.currentSectionIndex].id;
    }
    return sections[0].id;
  }

  const resumeSectionId = $derived(getResumeSectionId());
  const hasStarted = $derived(progress?.hasProgress ?? false);
</script>

<svelte:head>
  <title>{course?.title ?? 'Course'} — CourseQuizzer</title>
</svelte:head>

<main>
  {#if loadError}
    <h1>Error</h1>
    <ErrorAlert message={loadError} />
  {:else if course}
    <header>
      <h1>{course.title}</h1>
      <p class="description">{course.curriculum.description}</p>

      {#if progress && progress.hasProgress}
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: {Math.round(progress.overallMastery * 100)}%"></div>
        </div>
        <p class="progress-summary">
          {getProgressLabel(course)} · {progress.totalQuestionsAnswered} questions answered
        </p>
      {/if}
    </header>

    <!-- Primary action -->
    {#if !apiKeyStored}
      <section class="callout">
        <p>
          Add your Anthropic API key in <a href="/settings">Settings</a> before starting a section.
        </p>
      </section>
    {:else if resumeSectionId}
      <div class="primary-action">
        <a href="/course/{course.id}/learn" class="btn-primary">
          {hasStarted ? 'Resume Learning' : 'Start Learning'}
        </a>
      </div>
    {/if}

    <!-- Sections -->
    <h2>Sections ({course.curriculum.sections.length})</h2>
    <ol class="section-list">
      {#each course.curriculum.sections as section, index (section.id)}
        {@const sp = progress?.sections[index]}
        <li class="section-card">
          <div class="section-header">
            <strong>{section.title}</strong>
            {#if sp?.started}
              <span class="section-status">
                {sp.topicsAttempted}/{sp.topicsTotal} topics · {formatMastery(sp.mastery)}
              </span>
            {:else}
              <span class="section-status muted">
                {section.topics.length} topics
              </span>
            {/if}
          </div>
          <ul class="topic-list">
            {#each section.topics as topic (topic.id)}
              <li class="topic-item">
                <span class="topic-title">{topic.title}</span>
                <span class="topic-desc">{topic.description}</span>
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ol>

    <!-- Delete -->
    <section class="danger-zone">
      {#if confirmingDelete}
        <p class="confirm-text">
          Are you sure you want to delete this course? This cannot be undone.
        </p>
        <div class="actions">
          <button type="button" class="btn-danger" onclick={confirmDelete}>
            Yes, delete
          </button>
          <button type="button" class="btn-secondary" onclick={cancelDelete}>
            Cancel
          </button>
        </div>
      {:else}
        <button type="button" class="btn-secondary" onclick={requestDelete}>
          Delete course
        </button>
      {/if}
    </section>
  {:else}
    <h1>Course not found</h1>
    <p>No course with this ID was found in your browser storage.</p>
    <p>It may have been deleted or the link may be incorrect.</p>
  {/if}

  <p><a href="/">← Back to home</a></p>
</main>

<style>
  main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem;
  }

  header {
    margin-bottom: 1.5rem;
  }

  .description {
    color: #444;
    margin-top: 0.25rem;
  }

  .progress-bar-container {
    background: #e0e0e0;
    border-radius: 4px;
    height: 8px;
    margin-top: 0.75rem;
    overflow: hidden;
  }

  .progress-bar {
    background: #2a7;
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-summary {
    font-size: 0.85rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .callout {
    padding: 0.75rem;
    background: #fff8e1;
    border: 1px solid #ffe082;
    border-radius: 6px;
    margin-bottom: 1.5rem;
  }

  .primary-action {
    margin-bottom: 1.5rem;
  }

  .btn-primary {
    display: inline-block;
    padding: 0.6rem 1.25rem;
    font-size: 1rem;
    font-weight: 600;
    border: 1px solid #333;
    border-radius: 4px;
    background: #333;
    color: #fff;
    text-decoration: none;
    cursor: pointer;
  }

  .btn-primary:hover {
    background: #555;
  }

  .section-list {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: section-counter;
  }

  .section-card {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    counter-increment: section-counter;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .section-header strong::before {
    content: counter(section-counter) '. ';
  }

  .section-status {
    font-size: 0.85rem;
    color: #2a7;
    font-weight: 600;
  }

  .section-status.muted {
    color: #999;
    font-weight: normal;
  }

  .topic-list {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0 1rem;
  }

  .topic-item {
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
  }

  .topic-title {
    font-weight: 500;
  }

  .topic-desc {
    color: #666;
  }

  .topic-desc::before {
    content: ' — ';
  }

  .danger-zone {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .confirm-text {
    color: #c00;
    font-weight: 600;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .btn-secondary {
    padding: 0.35rem 0.75rem;
    font-size: 0.9rem;
    border: 1px solid #999;
    border-radius: 4px;
    background: #fff;
    color: #333;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background: #f0f0f0;
  }

  .btn-danger {
    padding: 0.35rem 0.75rem;
    font-size: 0.9rem;
    border: 1px solid #c00;
    border-radius: 4px;
    background: #c00;
    color: #fff;
    cursor: pointer;
  }

  .btn-danger:hover {
    background: #a00;
  }
</style>
