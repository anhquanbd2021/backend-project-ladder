# Backend Ladder Lab — companion demo

Interactive lab for the article *The Backend Project Ladder: 7 Builds That
Each Force One Production Lesson*. The article's claim: projects level you
up only when each one forces a specific production concept — and those
concepts form a ladder where later builds assume earlier lessons.

Zero dependencies — Node 20+ only. The ladder data, ordering/audit engine,
and failure simulations are plain ES modules shared by the browser UI, the
CLI, and the test suite.

## What it does

| Piece | What it proves |
|---|---|
| **Ladder view** | The seven rungs (CRUD API → distributed KV store) with the concept each one forces. Rungs whose prerequisites aren't in your completed set render locked. |
| **Failure simulations** | Each rung plays the same scenario twice — *without* the concept (fails) and *with* it (holds): restart-wipes-state, enumerable/colliding keys, burst-vs-limiter, retry double-execution, slow-consumer stall, auth-policy drift, node-loss key loss. |
| **Path audit** | Tick the rungs you've built; the audit lists the prerequisite concepts each completed rung assumed but you skipped, and names the next rung to build. |

## Run it

```text
npm start        # serve the lab on :3000
npm test         # ladder ordering + sims + server tests
npm run report   # CLI: validate ladder, audit examples/, run all sims
npm run check    # both
```

## Examples

- `examples/in-order.json` — the full climb; audits clean.
- `examples/skip-rungs.json` — jumped to the chat server and KV store; the
  audit flags the skipped `async-processing` lesson behind the chat rung and
  the `storage-design` lesson behind the KV store.

## Honest limits

- Simulations are illustrative models, not benchmarks — they show the
  failure *shape* (queue explodes, job runs twice), not measured numbers.
- The rung order is a curated opinion; other valid progressions exist. The
  lab only enforces that each rung's stated prerequisites come first.
- The audit checks *concept coverage*, not whether you actually learned the
  lesson — ticking a box is self-reported.

This is an educational demo, not production infrastructure.
