# ADR 001: Choosing MongoDB for Orders

**Date**: 2026-02-20
**Status**: Accepted

## Context
Orders have highly variable schemas depending on the product type (digital vs physical) and seasonal metadata. 

## Decision
We will use MongoDB via Mongoose.

## Consequences
Allows rapid iteration on order schemas without heavy migration scripts. However, we lose native ACID compliance across complex multi-document updates, which we must handle via application-level two-phase commits if necessary.
