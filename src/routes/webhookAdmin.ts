import { Router, Request, Response } from "express";
import { WebhookJob } from "../models/WebhookJob";
import { enqueueWebhook, getWebhookStats } from "../webhooks/webhookService";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../utils/logger";

const router = Router();

// all admin endpoints require auth - don't expose job list publicly
router.use(requireAuth);

// GET /webhooks/jobs - list recent jobs with basic filters
router.get("/jobs", async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const jobs = await WebhookJob.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ jobs, count: jobs.length });
});

// GET /webhooks/stats
router.get("/stats", async (_req: Request, res: Response) => {
  const stats = await getWebhookStats();
  res.json(stats);
});

// POST /webhooks/jobs/:id/retry - manually force a dead/failed job back to pending
router.post("/jobs/:id/retry", async (req: Request, res: Response) => {
  const job = await WebhookJob.findById(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status === "succeeded" || job.status === "processing") {
    res.status(400).json({ error: `Cannot retry a job in status: ${job.status}` });
    return;
  }

  // reset the job - it'll get picked up on the next poll cycle
  job.status    = "pending";
  job.nextRunAt = new Date();
  // intentionally NOT resetting attemptCount so we have audit trail of how many times it's been tried
  await job.save();

  logger.info("Webhook job manually retried", { jobId: job._id, retriedBy: (req as any).currentUser?.id });
  res.json({ message: "Job re-queued", jobId: job._id });
});

// POST /webhooks/test - fire a test webhook immediately, useful during integration testing
router.post("/test", async (req: Request, res: Response) => {
  const { url, payload, eventType } = req.body as {
    url: string;
    payload: Record<string, unknown>;
    eventType: string;
  };

  if (!url || !eventType) {
    res.status(400).json({ error: "url and eventType are required" });
    return;
  }

  const job = await enqueueWebhook({
    url,
    payload: payload ?? { test: true },
    eventType,
    correlationId: req.headers["x-correlation-id"] as string | undefined,
  });

  res.status(202).json({ message: "Test webhook enqueued", jobId: job._id });
});

export default router;
