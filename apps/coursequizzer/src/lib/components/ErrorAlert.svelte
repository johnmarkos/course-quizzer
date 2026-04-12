<script lang="ts">
  type Props = {
    message: string;
    recoverable?: boolean;
    onretry?: () => void;
  };

  let { message, recoverable = false, onretry }: Props = $props();
</script>

<div role="alert" class="error-alert">
  <p class="error-message">{message}</p>
  {#if recoverable && onretry}
    <button type="button" class="retry-button" onclick={onretry}>Try Again</button>
  {/if}
</div>

<style>
  .error-alert {
    padding: 0.75rem 1rem;
    border: 1px solid #c00;
    border-radius: 4px;
    background: #fff5f5;
    margin: 0.75rem 0;
  }

  .error-message {
    color: #c00;
    font-weight: 600;
    margin: 0;
  }

  .retry-button {
    margin-top: 0.5rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.9rem;
    cursor: pointer;
    border: 1px solid #333;
    border-radius: 4px;
    background: #333;
    color: #fff;
  }

  .retry-button:hover {
    background: #555;
  }
</style>
