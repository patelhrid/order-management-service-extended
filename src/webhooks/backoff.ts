// exponential backoff with full jitter
// why full jitter? because without it all retries from a batch of failed webhooks
// slam the downstream at the same time. thundering herd. bad.
// see: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
// we picked "full jitter" over "decorrelated jitter" because it has better average
// completion time in our load tests (just trust me on this, i ran the numbers once)

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
}

const DEFAULT_BASE_DELAY_MS = 2000;   // 2s
const DEFAULT_MAX_DELAY_MS  = 3600000; // 1 hour cap - after this its probably not coming back
const DEFAULT_MULTIPLIER    = 2;

/**
 * Returns how many milliseconds to wait before the next attempt.
 * attemptNumber is 1-indexed (first retry = 1).
 */
export function calculateBackoffMs(
  attemptNumber: number,
  options: BackoffOptions = {}
): number {
  const base       = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const cap        = options.maxDelayMs  ?? DEFAULT_MAX_DELAY_MS;
  const multiplier = options.multiplier  ?? DEFAULT_MULTIPLIER;

  // formula: min(cap, random_between(0, base * multiplier^attempt))
  const exponential = base * Math.pow(multiplier, attemptNumber);
  const capped      = Math.min(cap, exponential);

  // full jitter: random value in [0, capped]
  return Math.floor(Math.random() * capped);
}

/**
 * Returns the Date at which the next attempt should run.
 */
export function nextAttemptDate(attemptNumber: number, options?: BackoffOptions): Date {
  const delayMs = calculateBackoffMs(attemptNumber, options);
  return new Date(Date.now() + delayMs);
}
