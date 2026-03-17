/**
 * Wrapper around fetch that retries idempotent GET requests on transient failures.
 * Non-GET requests and 4xx responses are never retried.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  { retries = 2, baseDelay = 500 }: { retries?: number; baseDelay?: number } = {},
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const shouldRetry = method === 'GET';

  let lastError: unknown;

  for (let attempt = 0; attempt <= (shouldRetry ? retries : 0); attempt++) {
    try {
      const response = await fetch(input, init);

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 5xx — retry if we have attempts left
      if (attempt < retries && shouldRetry) {
        await delay(baseDelay * Math.pow(2, attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries && shouldRetry) {
        await delay(baseDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
