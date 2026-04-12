<script lang="ts">
  import {
    saveApiKey,
    removeApiKey,
    hasApiKey,
    getMaskedApiKey,
  } from '$lib/stores/api-key.js';
  import { normalizeError } from '$lib/errors/app-errors.js';

  let keyInput = $state('');
  let saved = $state(hasApiKey(localStorage));
  let maskedKey = $state(getMaskedApiKey(localStorage));
  let error = $state('');

  function handleSave(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    try {
      saveApiKey(keyInput, localStorage);
      saved = true;
      maskedKey = getMaskedApiKey(localStorage);
      keyInput = '';
    } catch (e) {
      error = normalizeError(e).message;
    }
  }

  function handleRemove() {
    removeApiKey(localStorage);
    saved = false;
    maskedKey = null;
    keyInput = '';
    error = '';
  }
</script>

<svelte:head>
  <title>Settings — CourseQuizzer</title>
</svelte:head>

<main>
  <h1>Settings</h1>

  <section>
    <h2>Anthropic API Key</h2>
    <p>
      Your API key is stored only in this browser's localStorage. It is never
      sent anywhere except directly to the Anthropic API.
    </p>

    {#if saved}
      <p>
        <strong>Saved:</strong>
        <code>{maskedKey}</code>
      </p>
      <button type="button" onclick={handleRemove}>Remove Key</button>
    {:else}
      <form onsubmit={handleSave}>
        <label>
          API Key
          <input
            type="password"
            bind:value={keyInput}
            placeholder="sk-ant-api03-..."
            autocomplete="off"
          />
        </label>
        <button type="submit">Save Key</button>
      </form>
    {/if}

    {#if error}
      <p role="alert">{error}</p>
    {/if}
  </section>

  <p><a href="/">← Back to home</a></p>
</main>
