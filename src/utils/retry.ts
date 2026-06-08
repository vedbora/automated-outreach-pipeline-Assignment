import { AxiosError } from 'axios';
import { logger } from './logger';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  label?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(error: AxiosError): number | null {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (!retryAfter) {
    return null;
  }

  const seconds = Number.parseInt(String(retryAfter), 10);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(String(retryAfter));
  if (!Number.isNaN(dateMs)) {
    return Math.max(dateMs - Date.now(), 0);
  }

  return null;
}

function isRetryableStatus(status?: number): boolean {
  return status === 429 || status === 408 || (status !== undefined && status >= 500);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, label = 'request' } = options;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;

      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const retryable = isRetryableStatus(status) || !axiosError.response;

      if (!retryable || attempt > maxRetries) {
        throw error;
      }

      const retryAfterMs = getRetryAfterMs(axiosError);
      const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
      const delayMs = retryAfterMs ?? exponentialDelay;

      logger.warn(
        `${label} failed (attempt ${attempt}/${maxRetries}, status=${status ?? 'network'}). Retrying in ${delayMs}ms...`,
      );

      await sleep(delayMs);
    }
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
