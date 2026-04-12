<script lang="ts">
  import { listCourses, deleteCourse } from '$lib/storage/course-storage.js';
  import { hasApiKey } from '$lib/stores/api-key.js';
  import { getProgressLabel } from '$lib/stores/course-progress.js';
  import { normalizeError } from '$lib/errors/app-errors.js';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';

  let storageError = $state('');
  let courses = $state(loadCourses());

  /** Load courses from localStorage, capturing any error. */
  function loadCourses() {
    try {
      storageError = '';
      return listCourses(localStorage);
    } catch (err) {
      storageError = normalizeError(err).message;
      return [] as ReturnType<typeof listCourses>;
    }
  }

  const apiKeyStored = $derived.by(() => {
    try {
      return hasApiKey(localStorage);
    } catch {
      return false;
    }
  });

  // --- Delete confirmation ---

  let confirmDeleteId = $state<string | null>(null);

  function requestDelete(courseId: string) {
    confirmDeleteId = courseId;
  }

  function cancelDelete() {
    confirmDeleteId = null;
  }

  function confirmDelete(courseId: string) {
    deleteCourse(courseId, localStorage);
    courses = loadCourses();
    confirmDeleteId = null;
  }
</script>

<svelte:head>
  <title>CourseQuizzer</title>
</svelte:head>

<main>
  <h1>CourseQuizzer</h1>
  <p>Adaptive course material from any syllabus, powered by Claude.</p>

  <nav>
    <a href="/course/new">New Course</a>
    <a href="/settings">Settings</a>
  </nav>

  {#if storageError}
    <ErrorAlert message={storageError} />
  {/if}

  {#if !apiKeyStored}
    <section>
      <p>
        To get started, add your Anthropic API key in
        <a href="/settings">Settings</a>.
      </p>
    </section>
  {/if}

  {#if courses.length > 0}
    <section>
      <h2>Your Courses</h2>
      <ul class="course-list">
        {#each courses as course (course.id)}
          <li class="course-card">
            <div class="course-info">
              <a href="/course/{course.id}" class="course-title">{course.title}</a>
              <span class="course-progress">{getProgressLabel(course)}</span>
            </div>
            <div class="course-actions">
              <a href="/course/{course.id}" class="btn">Open</a>
              {#if confirmDeleteId === course.id}
                <span class="confirm-delete">
                  Delete?
                  <button type="button" class="btn-danger" onclick={() => confirmDelete(course.id)}>Yes</button>
                  <button type="button" class="btn-secondary" onclick={cancelDelete}>No</button>
                </span>
              {:else}
                <button type="button" class="btn-secondary" onclick={() => requestDelete(course.id)}>Delete</button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {:else if apiKeyStored}
    <section>
      <p>No courses yet. <a href="/course/new">Create your first course</a> from a syllabus.</p>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem;
  }

  nav {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .course-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .course-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .course-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .course-title {
    font-weight: 600;
    font-size: 1.05rem;
    text-decoration: none;
    color: #111;
  }

  .course-title:hover {
    text-decoration: underline;
  }

  .course-progress {
    font-size: 0.85rem;
    color: #666;
  }

  .course-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .btn {
    padding: 0.35rem 0.75rem;
    font-size: 0.9rem;
    border: 1px solid #333;
    border-radius: 4px;
    background: #333;
    color: #fff;
    text-decoration: none;
    cursor: pointer;
  }

  .btn:hover {
    background: #555;
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

  .confirm-delete {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.9rem;
    color: #c00;
    font-weight: 600;
  }
</style>
