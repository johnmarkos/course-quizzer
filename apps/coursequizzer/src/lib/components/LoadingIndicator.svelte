<script lang="ts">
  type Props = {
    message: string;
    detail?: string;
  };

  let { message, detail }: Props = $props();
</script>

<div class="loading-indicator" aria-busy="true" role="status">
  <p class="loading-message">{message}</p>
  {#if detail}
    <p class="loading-detail">{detail}</p>
  {/if}
</div>

<style>
  .loading-indicator {
    padding: 0.75rem 0;
  }

  .loading-message {
    font-weight: 600;
    font-size: 1.1rem;
    margin: 0;
  }

  .loading-detail {
    color: #666;
    font-size: 0.9rem;
    margin: 0.25rem 0 0;
  }
</style>
