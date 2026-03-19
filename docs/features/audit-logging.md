# Audit Logging for Order State Changes

## Why this exists

We needed a reliable way to track:
- Who changed an order
- What changed
- When it changed

This is critical for:
- Debugging production issues
- Compliance requirements
- Customer dispute resolution

## Why not embed in Order?

We explicitly avoided embedding logs inside the Order document because:
- Order documents would grow unbounded
- MongoDB document size limit (16MB)
- Poor query performance for historical analysis

## Why Mongoose model vs event store?

We considered:
- Event sourcing → too heavy for current system maturity
- Kafka topic replay → not sufficient for audit guarantees

We chose:
→ Simple append-only Mongo collection

## Design Notes

- Logs are **write-only**
- Failures are **non-blocking**
- Indexed by `orderId`
- Correlation ID included for tracing across services

## Known Tradeoffs

- No strict guarantee of log write (best-effort)
- No immutability enforcement at DB level (future improvement)

## Future Ideas

- TTL index for retention policies
- Export pipeline to data warehouse
- Admin UI for audit inspection
