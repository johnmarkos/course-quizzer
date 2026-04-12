<script lang="ts">
  import { page } from '$app/state';
  import { getCourse } from '$lib/storage/course-storage.js';

  const courseId = $derived(page.params.courseId);
  const course = $derived(courseId ? getCourse(courseId, localStorage) : null);
</script>

<svelte:head>
  <title>{course?.title ?? 'Course'} — CourseQuizzer</title>
</svelte:head>

<main>
  {#if course}
    <h1>{course.title}</h1>
    <p>{course.curriculum.description}</p>

    <h2>Sections</h2>
    <ol>
      {#each course.curriculum.sections as section (section.id)}
        <li>
          <strong>{section.title}</strong>
          ({section.topics.length} topics)
        </li>
      {/each}
    </ol>
  {:else}
    <h1>Course not found</h1>
    <p>No course with this ID was found in your browser storage.</p>
  {/if}

  <p><a href="/">← Back to home</a></p>
</main>
