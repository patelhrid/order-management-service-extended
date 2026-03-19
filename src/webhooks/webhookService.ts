import { WebhookJob, IWebhookJob } from "../models/WebhookJob";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

export interface EnqueueWebhookOptions {
  url: string;
  payload: Record<string, unknown>;
  eventType: string;
  headers?: Record<string, string>;
  correlationId?: string;
  maxAttempts?: number;
  // delayMs - if you want to schedule it in the future for some reason
  delayMs?: number;
}

/**
 * Creates a WebhookJob document and saves it. The worker picks it up asynchronously.
 */
export async function enqueueWebhook(options: EnqueueWebhookOptions): Promise<IWebhookJob> {
  const correlationId = options.correlationId ?? uuidv4();

  const nextRunAt = options.delayMs
    ? new Date(Date.now() + options.delayMs)
    : new Date();

  const job = new WebhookJob({
    url: options.url,
    payload: options.payload,
    eventType: options.eventType,
    headers: options.headers,
    correlationId,
    maxAttempts: options.maxAttempts ?? 8,
    nextRunAt,
  });

  await job.save();

  logger.info("Webhook job enqueued", {
    jobId: job._id,
    url: job.url,
    eventType: job.eventType,
    correlationId,
  });

  return job;
}

/**
 * Returns stats useful for a health check or admin dashboard.
 * Runs as an aggregation - don't call this on every request.
 */
export async function getWebhookStats(): Promise<Record<string, number>> {
  const results = await WebhookJob.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const stats: Record<string, number> = {};
  for (const r of results) {
    stats[r._id as string] = r.count as number;
  }
  return stats;
}
