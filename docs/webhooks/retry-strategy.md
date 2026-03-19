# Webhook Retry Strategy

exponential backoff with full jitter. see the code comments in backoff.ts, they explain it better than i could here.

max 8 attempts. dead jobs cleaned up by mongo TTL after 30 days.

if a job goes dead it just sits there. someone needs to build an alert for that.
