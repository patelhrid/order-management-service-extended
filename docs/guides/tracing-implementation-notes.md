# Tracing Implementation Notes

**Why OTLP HTTP over gRPC?**
You might be wondering why we opted for `@opentelemetry/exporter-trace-otlp-http` instead of the gRPC equivalent. After the incident last month where our AWS Application Load Balancers (ALBs) started dropping long-lived gRPC streams during scale-in events, we found that HTTP/1.1 payloads were much more resilient in our specific infrastructure setup. It adds a tiny bit of payload overhead but saves us from dropping trace spans during peak load.

**Why not just stick to Winston Correlation IDs?**
Correlation IDs in Winston (`req.headers['x-correlation-id']`) were fine for single-service HTTP requests, but we are completely blind once the message enters RabbitMQ. OTel's context propagation allows us to map the exact timing of the Stripe Webhook -> RabbitMQ -> Inventory Service pipeline.
