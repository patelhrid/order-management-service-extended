import axios, { AxiosError } from "axios";
import { logger } from "../utils/logger";
import { IWebhookJob } from "../models/WebhookJob";

export interface DispatchResult {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
}

// timeout is intentionally short. if the receiver cant ack in 10s they're having
// a bad day and we should back off anyway. don't want our worker threads held open.
const REQUEST_TIMEOUT_MS = 10_000;

// we only treat these as "real" failures that should retry.
// 4xx (except 429) means the receiver rejected our payload - retrying wont help
// but we retry anyway on 408 and 429 because those are timeout/ratelimit not logic errors
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export async function dispatchWebhook(job: IWebhookJob): Promise<DispatchResult> {
  const logCtx = { jobId: job._id, url: job.url, attempt: job.attemptCount + 1, correlationId: job.correlationId };

  try {
    logger.info("Dispatching webhook", logCtx);

    const response = await axios.post(job.url, job.payload, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": job.eventType,
        "X-Correlation-Id": job.correlationId ?? "",
        "X-Attempt-Number": String(job.attemptCount + 1),
        ...(job.headers ?? {}),
      },
      // HACK: axios throws on non-2xx by default. we want to inspect the status
      // ourselves to decide if its retryable, so we disable that here.
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      logger.info("Webhook delivered successfully", { ...logCtx, statusCode: response.status });
      return { success: true, statusCode: response.status };
    }

    if (RETRYABLE_STATUS_CODES.has(response.status)) {
      logger.warn("Webhook got retryable error status", { ...logCtx, statusCode: response.status });
      return { success: false, statusCode: response.status, errorMessage: `HTTP ${response.status}` };
    }

    // non-retryable 4xx - log it but signal success=false with no retry
    // the worker will move this to dead immediately
    logger.error("Webhook got non-retryable error, moving to dead", { ...logCtx, statusCode: response.status });
    return {
      success: false,
      statusCode: response.status,
      errorMessage: `Non-retryable HTTP ${response.status} - payload rejected`,
    };
  } catch (err) {
    // network errors, DNS failures, timeouts - all retryable
    const axiosErr = err as AxiosError;
    const msg = axiosErr.message ?? "Unknown network error";
    logger.warn("Webhook dispatch threw network error", { ...logCtx, error: msg });
    return { success: false, errorMessage: msg };
  }
}
