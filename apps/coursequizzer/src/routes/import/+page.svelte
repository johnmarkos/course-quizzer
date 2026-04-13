<script lang="ts">
  import { goto } from '$app/navigation';
  import { Importer } from 'quizzer-engine';
  import { importCourse } from '$lib/storage/course-storage.js';
  import { normalizeError } from '$lib/errors/app-errors.js';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';

  let error = $state('');
  let importing = $state(false);

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    error = '';
    importing = true;

    try {
      const text = await file.text();
      const importer = new Importer();
      const snapshot = importer.import(text);

      if (!snapshot.curriculum) {
         throw new Error('Imported course has no curriculum');
      }

      const courseId = importCourse(
        {
          title: snapshot.curriculum.title,
          curriculum: snapshot.curriculum,
          snapshot,
        },
        localStorage
      );

      goto(`/course/${courseId}`);
    } catch (err) {
      error = normalizeError(err).message;
    } finally {
      importing = false;
      input.value = ''; // Reset file input
    }
  }
</script>

<svelte:head>
  <title>Import Course — CourseQuizzer</title>
</svelte:head>

<main>
  <h1>Import Course</h1>
  <p>Upload a course export JSON file to continue your progress.</p>

  {#if error}
    <ErrorAlert message={error} />
  {/if}

  <section class="import-area">
    <label for="file-upload" class="file-label">
      {#if importing}
        Importing...
      {:else}
        Select course-export.json file
      {/if}
      <input
        id="file-upload"
        type="file"
        accept=".json,application/json"
        onchange={handleFileSelect}
        disabled={importing}
      />
    </label>
    <p class="help-text">
      This will add the course to your browser storage. API keys from the original machine are never imported.
    </p>
  </section>

  <p><a href="/">← Back to home</a></p>
</main>

<style>
  main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem;
  }

  .import-area {
    margin: 2rem 0;
    padding: 2rem;
    border: 2px dashed #ccc;
    border-radius: 8px;
    text-align: center;
  }

  .file-label {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: #333;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }

  .file-label:hover {
    background: #555;
  }

  .file-label input {
    display: none;
  }

  .help-text {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #666;
  }
</style>
