# Events Migration

This document records the RabbitMQ exchange migration for downstream integrations.

## Timeline

- T1 (before migration): exchange name `order_events`
- T2 (after migration): exchange name `order_stream`

## Current Canonical Configuration

T2 supersedes T1. New integrations should use `order_stream`.

## Migration Impact

Consumers and publishers still configured for `order_events` will not receive new traffic after the migration. Any integration built from older documentation must be updated to `order_stream`.

## What Did Not Change

Only the exchange name changed. The exchange type remains `topic`, durability remains `true`, and the routing key for order creation events remains `order.created`.
