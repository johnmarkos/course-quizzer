<script lang="ts">
  import { listCourses } from '$lib/storage/course-storage.js';
  import { hasApiKey } from '$lib/stores/api-key.js';

  const courses = $derived(listCourses(localStorage));
  const apiKeyStored = $derived(hasApiKey(localStorage));
</script>

<main>
  <h1>CourseQuizzer</h1>
  <p>Adaptive course material from any syllabus, powered by Claude.</p>

  <nav>
    <a href="/course/new">New Course</a>
    <a href="/settings">Settings</a>
  </nav>

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
      <ul>
        {#each courses as course (course.id)}
          <li>
            <a href="/course/{course.id}">{course.title}</a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>
