// --- Rate Limiter ---
// Simple token bucket rate limiter for API calls.
// Prevents rapid-fire requests that would trigger 429s.
// The bucket refills one token per interval. Each API call
// consumes one token. When the bucket is empty, callers
// wait until a token becomes available.

export type RateLimiterConfig = {
  /** Maximum number of requests that can be made in a burst. */
  maxTokens: number;
  /** Time in milliseconds to refill one token. */
  refillIntervalMs: number;
};

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxTokens: 5,
  refillIntervalMs: 1000,
};

export class RateLimiter {
  #tokens: number;
  #maxTokens: number;
  #refillIntervalMs: number;
  #lastRefillTime: number;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    const resolved = { ...DEFAULT_CONFIG, ...config };
    this.#maxTokens = resolved.maxTokens;
    this.#tokens = resolved.maxTokens;
    this.#refillIntervalMs = resolved.refillIntervalMs;
    this.#lastRefillTime = Date.now();
  }

  // --- Public API ---

  /**
   * Waits until a token is available, then consumes it.
   * Returns the number of milliseconds waited (0 if a token was immediately available).
   */
  async acquire(): Promise<number> {
    this.#refill();

    if (this.#tokens >= 1) {
      this.#tokens--;
      return 0;
    }

    // Calculate wait time until next token
    const timeSinceLastRefill = Date.now() - this.#lastRefillTime;
    const waitMs = this.#refillIntervalMs - timeSinceLastRefill;
    const actualWait = Math.max(0, waitMs);

    await this.#sleep(actualWait);

    // Refill after sleeping and consume
    this.#refill();
    this.#tokens = Math.max(0, this.#tokens - 1);
    return actualWait;
  }

  /** Current number of available tokens. Useful for testing. */
  get availableTokens(): number {
    this.#refill();
    return this.#tokens;
  }

  // --- Internal ---

  #refill(): void {
    const now = Date.now();
    const elapsed = now - this.#lastRefillTime;
    const tokensToAdd = Math.floor(elapsed / this.#refillIntervalMs);

    if (tokensToAdd > 0) {
      this.#tokens = Math.min(this.#maxTokens, this.#tokens + tokensToAdd);
      this.#lastRefillTime = now;
    }
  }

  #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
