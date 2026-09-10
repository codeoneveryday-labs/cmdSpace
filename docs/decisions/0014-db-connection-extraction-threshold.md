# Decision 0014: Keep the SQLite mutex until contention crosses a measured threshold

Date: 2026-09-10

## Status

Accepted

## Context

cmdSpace currently serializes SQLite access through one process-local
`Mutex<rusqlite::Connection>`. A pool or worker could improve parallel reads,
but would also change transaction ownership, shutdown behavior, and write
ordering. The maintainability goal requires evidence before making that
extraction.

The test-only harness runs four threads for forty iterations each against an
in-memory database. Each worker rotates through workspace reads, pane reads,
recent-workspace writes, and pane writes. It also measures eight schema-startup
runs. The measurements are diagnostic only and do not alter production
scheduling.

## Measurements

The two recorded runs were made on the same workspace checkout and host:

- Host: MacBookPro18,1, Apple Silicon arm64, 10 logical CPUs, Darwin 25.1.0.
- Toolchain: `rustc 1.97.1`, `cargo 1.97.1`.
- Workload: 4 workers × 40 iterations, 160 operation samples, 8 schema-startup
  samples.
- Prompt 02 run: lock wait p50/p95/p99 `42/84/858708 ns`; operation latency
  p50/p95/p99 `14541/21542/30250 ns`; schema startup p50/p95/p99
  `945542/1081834/1081834 ns`.
- Prompt 18 repeat: lock wait p50/p95/p99 `42/167/783750 ns`; operation
  latency p50/p95/p99 `15750/29791/44166 ns`; schema startup p50/p95/p99
  `590167/719916/719916 ns`.

## Decision

Keep the mutex-backed connection for this refactor. Treat contention as
material only when the same harness exceeds either of these thresholds in
three consecutive runs on the same workload:

- lock-wait p95 greater than 1 ms; or
- operation-latency p95 greater than 5 ms.

Both recorded runs are well below both p95 thresholds. The sub-millisecond p99
wait samples do not justify a production extraction by themselves, especially
when operation p95 remains below 30 µs.

## Alternatives considered

- **Introduce a connection pool now:** rejected because the measured workload
  does not show sustained contention, while pooled writes would need explicit
  transaction and shutdown ownership.
- **Move all DB work to a worker thread now:** rejected because queue latency
  and cancellation semantics would become a new boundary without evidence of
  user-visible pressure.
- **Ignore measurement permanently:** rejected; a repeatable threshold keeps
  the decision reversible if the workload or user reports change.

## Follow-up

Repeat the harness with a file-backed database and a larger realistic workspace
fixture if profiling or a user report shows DB stalls. A future worker/pool
proposal must include that workload, transaction ownership, cancellation, and
shutdown design before implementation.
