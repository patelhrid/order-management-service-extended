# Context Graph Demo Tasks — Order Management Service

These two tasks are designed to demonstrate that the context graph is working: that given a question about the codebase, the system retrieves the *right* files and connects them in a way a flat keyword or embedding search would miss.

Neither task involves querying an LLM. The output you're validating is purely **which nodes the graph retrieves and how it connects them**.

---

## What a passing result looks like (for both tasks)

The graph should return a **context chain** — an ordered list of nodes with the traversal path that linked them. For each task, the section below tells you exactly which nodes should appear and which edges were followed to get there. If those nodes come back, the graph is working. If they don't, something in ingestion, edge construction, or traversal is broken.

---

## Task 1 (Simple) — The missing orders route

### The question to send to the graph

```
Why does POST /api/orders return 404 even though an OrderService exists?
```

### Background (what a developer would actually be confused about)

A developer clones the repo, reads `src/services/orderService.ts`, sees `createOrder` and `getOrderById` fully implemented, and tries to call `POST /api/orders`. They get a 404. Nothing in the service layer is obviously wrong. The bug is that the route was never wired into the Express app — but to know that, you have to look at `src/app.ts` and notice the absence of an orders router registration. That's a cross-file reasoning task.

### What the graph should retrieve

The context chain should contain these nodes, connected as shown:

```
repo:order-management-service
    └─[CONTAINS]─► src/app.ts             ← only two routes registered: /api/webhooks and /health
    └─[CONTAINS]─► src/services/orderService.ts   ← createOrder and getOrderById exist here
    └─[CONTAINS]─► src/models/Order.ts    ← the schema the service depends on
    └─[CONTAINS]─► src/middlewares/requireAuth.ts ← auth middleware, also not applied to any order route
```

The key insight is that `app.ts` and `orderService.ts` must both appear. `app.ts` explains *why* (no route registered), and `orderService.ts` confirms *that the service actually exists* and is not the problem. If only one of them comes back, the graph is doing single-file retrieval, not cross-file reasoning.

### Expected context chain output

```json
{
  "query": "Why does POST /api/orders return 404 even though an OrderService exists?",
  "project": "order-management-service",
  "chain": [
    {
      "node_id": "file:src/app.ts",
      "relevance": "high",
      "reason": "Defines all registered Express routes. /api/webhooks and /health are present. No orders router is registered — this is the direct cause of the 404.",
      "edge_path": ["repo:order-management-service", "CONTAINS"]
    },
    {
      "node_id": "file:src/services/orderService.ts",
      "relevance": "high",
      "reason": "Implements createOrder and getOrderById. Service is complete and functional but never imported or wired to an HTTP route in app.ts.",
      "edge_path": ["repo:order-management-service", "CONTAINS"]
    },
    {
      "node_id": "file:src/models/Order.ts",
      "relevance": "medium",
      "reason": "Defines the Order schema consumed by OrderService. Confirms the data model exists.",
      "edge_path": ["file:src/services/orderService.ts", "DEPENDS_ON"]
    },
    {
      "node_id": "file:src/middlewares/requireAuth.ts",
      "relevance": "medium",
      "reason": "Auth middleware exists but is also not applied to any order route — relevant context for whoever implements the missing router.",
      "edge_path": ["repo:order-management-service", "CONTAINS"]
    }
  ]
}
```

### How to verify the graph is working

- ✅ `src/app.ts` appears in the chain — this is the file that directly explains the 404
- ✅ `src/services/orderService.ts` appears — confirms the service exists and is not the problem
- ✅ The chain includes both together, not just one — this is the cross-file reasoning the graph enables
- ❌ If only `orderService.ts` comes back without `app.ts`, the graph found the service but missed the root cause
- ❌ If `src/routes/webhooks.ts` comes back instead of `app.ts`, the query matched on "route" semantically but pulled the wrong file

---

## Task 2 (Advanced) — Silent event loss when RabbitMQ is unavailable

### The question to send to the graph

```
If RabbitMQ goes down after the service starts, order.created events are silently
dropped with no retry. What parts of the codebase are involved, and what was the
original reasoning behind this design?
```

### Background (what a developer would actually be investigating)

In production, RabbitMQ occasionally becomes temporarily unavailable. When this happens, `eventPublisher.publish()` in `src/events/publisher.ts` silently drops the event — it logs a warning and returns. The order is still saved to MongoDB, but the downstream inventory and payment services never receive the `order.created` event, so inventory is never reserved and payment is never initiated. The order stays `PENDING` forever.

To understand this fully, a developer needs to trace through four separate artifacts:

1. `src/events/publisher.ts` — the `connected` flag check and the `logger.warn` on drop
2. `src/services/orderService.ts` — the fire-and-forget `.catch()` that swallows the publish error
3. `docs/architecture/002-async-messaging.md` — the ADR that explicitly accepted eventual consistency as a tradeoff
4. `src/app.ts` — to confirm there is no reconnection logic or health check wired for RabbitMQ

This is a provenance task — not just "what is the code doing" but "why was it designed this way, and where is that decision recorded." This is exactly what the context graph's `GENERATED_FROM` and `REFERENCES` edges exist to surface.

### What the graph should retrieve

```
repo:order-management-service
    └─[CONTAINS]─► src/events/publisher.ts
                        └─[REFERENCES]─► docs/architecture/002-async-messaging.md
    └─[CONTAINS]─► src/services/orderService.ts
                        └─[DEPENDS_ON]─► src/events/publisher.ts
    └─[CONTAINS]─► src/app.ts
                        └─[DEPENDS_ON]─► src/events/publisher.ts  (publisher is used at app init)
    └─[CONTAINS]─► docs/architecture/002-async-messaging.md
```

The critical edge here is `publisher.ts --REFERENCES--> 002-async-messaging.md`. Without that edge, a naive embedding search would retrieve the source files but miss the ADR — and the developer would have the *what* but not the *why*.

### Expected context chain output

```json
{
  "query": "If RabbitMQ goes down after the service starts, order.created events are silently dropped with no retry. What parts of the codebase are involved, and what was the original reasoning behind this design?",
  "project": "order-management-service",
  "chain": [
    {
      "node_id": "file:src/events/publisher.ts",
      "relevance": "high",
      "reason": "Contains the EventPublisher class. The publish() method checks a boolean 'connected' flag and logs a warning and returns if false — no retry, no queue, no dead-letter. The connected flag is set once at startup and never re-checked.",
      "edge_path": ["repo:order-management-service", "CONTAINS"]
    },
    {
      "node_id": "doc:adr-002",
      "relevance": "high",
      "reason": "ADR 002 documents the decision to use RabbitMQ with an event-driven architecture and explicitly accepts eventual consistency as a consequence. This is the recorded reasoning behind the fire-and-forget design.",
      "edge_path": ["file:src/events/publisher.ts", "REFERENCES"]
    },
    {
      "node_id": "file:src/services/orderService.ts",
      "relevance": "high",
      "reason": "Calls eventPublisher.publish() with a .catch() that only logs the error — the publish failure does not fail the order creation. This is where the fire-and-forget pattern is applied at the service level.",
      "edge_path": ["file:src/events/publisher.ts", "DEPENDED_ON_BY"]
    },
    {
      "node_id": "file:src/app.ts",
      "relevance": "medium",
      "reason": "Application entrypoint. No RabbitMQ reconnection logic, health check, or circuit breaker is wired. Once the channel drops, no mechanism exists to restore it without a service restart.",
      "edge_path": ["repo:order-management-service", "CONTAINS"]
    }
  ]
}
```

### How to verify the graph is working

- ✅ `src/events/publisher.ts` appears — it is the direct location of the silent-drop behaviour
- ✅ `docs/architecture/002-async-messaging.md` appears — this is the provenance retrieval that makes the task "advanced"; a flat embedding search will likely miss it because the ADR is a markdown file that doesn't mention `publisher.ts` by name
- ✅ The ADR is reached via a `REFERENCES` edge from `publisher.ts`, not via direct embedding similarity to the query — this is the graph doing work that RAG cannot
- ✅ `src/services/orderService.ts` appears — confirms where the `.catch()` swallows the failure
- ❌ If the ADR is missing from the chain, the `REFERENCES` edge between `publisher.ts` and `002-async-messaging.md` was either not created during ingestion or not followed during traversal — this is the specific thing to debug
- ❌ If `src/routes/webhooks.ts` appears instead of `src/app.ts`, the traversal over-fetched on "service starts" or "RabbitMQ" semantics

---

## Running the tasks

Both tasks use the same retrieval call. The inputs are the query string and the project scope:

```python
result = retrieve_context(
    query="<query text above>",
    project_id="repo:order-management-service",
    max_hops=2,
    token_budget=4000
)
```

Or via the MCP tool directly:

```json
{
  "action": "retrieve",
  "project_id": "repo:order-management-service",
  "query": "<query text above>",
  "max_tokens": 4000
}
```

Print the returned chain. Compare node IDs and edge paths against the expected outputs above. That's the whole test.
