/**
 * Error-handling helpers.
 *
 * Several code paths perform "best-effort" side effects (cloud-sync enqueue,
 * cascade cleanup of optional tables) that must not abort the primary request
 * if they fail. Historically these were written as `try { ... } catch (_) {}`,
 * which silently swallowed every failure and made real problems (a broken sync
 * queue, a failed cascade delete) invisible in production.
 *
 * `runBestEffort` preserves the non-blocking behaviour while making failures
 * observable through a warning log.
 */

function describeError(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  return String(err);
}

/**
 * Run a non-critical async operation. Failures are logged as warnings and
 * swallowed so they never abort the caller.
 */
export async function runBestEffort(
  context: string,
  fn: () => Promise<unknown> | unknown,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(`[best-effort] ${context} failed:`, describeError(err));
  }
}

/**
 * Log a swallowed error with a consistent, greppable prefix. Use for the rare
 * cases where continuing past a failure is intentional but the failure should
 * still be recorded.
 */
export function logSwallowedError(context: string, err: unknown): void {
  console.warn(`[swallowed] ${context}:`, describeError(err));
}
