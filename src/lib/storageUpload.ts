/**
 * Resilient Supabase Storage uploads.
 *
 * Proof photos / PDFs are uploaded over mobile networks that routinely drop the
 * connection mid-request. When the browser's `fetch()` can't complete, Supabase
 * surfaces a raw `"Failed to fetch"` — opaque and alarming for the user, even
 * though nothing is actually broken server-side. This helper:
 *
 *   1. retries transient network failures with a short exponential backoff,
 *   2. treats an "already exists" response on a retry as success — the previous
 *      attempt's request actually landed; reusing the SAME stable path makes the
 *      retry idempotent (no duplicate files),
 *   3. normalizes a definitive network failure into a clear French message.
 *
 * It deliberately does NOT retry real server rejections (RLS, quota, invalid
 * type) — those surface immediately so the user/admin sees the actual cause.
 * This is upload-only retry; it never re-runs financial RPCs.
 */

/** A network blip the browser couldn't complete — safe to retry. */
function isTransientNetworkError(message: string): boolean {
  return /failed to fetch|fetch failed|network ?error|load failed|timeout|timed out|connection (reset|closed|refused|aborted)|err_network|err_connection/i.test(
    message,
  );
}

/** The same file already landed on a previous attempt — treat as success. */
function isAlreadyExists(message: string): boolean {
  return /already exists|resource already exists|duplicate/i.test(message);
}

/** User-facing message shown when retries are exhausted on a network failure. */
export const STORAGE_NETWORK_ERROR_MESSAGE =
  "Connexion interrompue pendant l'envoi du fichier. Vérifiez votre connexion internet et réessayez.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface UploadOutcome {
  error: { message: string } | null;
}

/**
 * Run a Supabase Storage upload with retry-on-network-failure.
 *
 * `doUpload` MUST target a stable path across calls (compute the path once,
 * outside the retry) so that retries are idempotent.
 *
 * @returns `{ error: null }` on success, or `{ error }` with a human-readable
 *          message on definitive failure.
 */
export async function uploadWithRetry(
  doUpload: () => Promise<UploadOutcome>,
  maxAttempts = 3,
): Promise<{ error: Error | null }> {
  let lastMessage = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let error: { message: string } | null = null;
    try {
      ({ error } = await doUpload());
    } catch (e) {
      // supabase-js normally returns the error in the result, but guard against
      // a thrown one (older transports / unexpected rejections).
      error = { message: e instanceof Error ? e.message : String(e) };
    }

    if (!error) return { error: null };

    // A retry collided with a file a previous attempt actually uploaded.
    if (attempt > 1 && isAlreadyExists(error.message)) return { error: null };

    lastMessage = error.message;

    const retryable = isTransientNetworkError(error.message);
    if (!retryable) return { error: new Error(error.message) };
    if (attempt === maxAttempts) return { error: new Error(STORAGE_NETWORK_ERROR_MESSAGE) };

    await sleep(400 * 2 ** (attempt - 1)); // 400ms, then 800ms
  }

  return { error: new Error(lastMessage || STORAGE_NETWORK_ERROR_MESSAGE) };
}
