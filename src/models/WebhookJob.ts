import mongoose, { Document, Schema } from "mongoose";

// i copy-pasted the status values from slack, dont @ me
export type WebhookStatus = "pending" | "processing" | "failed" | "dead" | "succeeded";

export interface IWebhookJob extends Document {
  url: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  status: WebhookStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRunAt: Date;
  lastError?: string;
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // the event type that triggered this, e.g. "order.created"
  eventType: string;
  // correlation id so we can trace it through logs
  correlationId?: string;
}

const WebhookJobSchema = new Schema<IWebhookJob>(
  {
    url: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    headers: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["pending", "processing", "failed", "dead", "succeeded"],
      default: "pending",
    },
    attemptCount: { type: Number, default: 0 },
    // default 8 - chosen because after 8 attempts with our backoff formula
    // the total wait time is ~68 minutes which is enough for transient outages
    maxAttempts: { type: Number, default: 8 },
    nextRunAt: { type: Date, default: () => new Date() },
    lastError: { type: String },
    lastAttemptAt: { type: Date },
    eventType: { type: String, required: true },
    correlationId: { type: String },
  },
  { timestamps: true }
);

// index so the worker query is fast. compound because we filter on both
WebhookJobSchema.index({ status: 1, nextRunAt: 1 });

// ttl index - dead jobs get auto-purged after 30 days, we dont want mongo filling up with garbage
WebhookJobSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { status: "dead" } }
);

export const WebhookJob = mongoose.model<IWebhookJob>("WebhookJob", WebhookJobSchema);
