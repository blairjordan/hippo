# Hippo Benchmarks

These results come from the checked-in harness at [bench/throughput.ts](/home/blair/code/devmode/hippo/bench/throughput.ts:1).

## Reproduce

1. Start Postgres:

```bash
docker compose up -d postgres
```

2. Run the benchmark:

```bash
npx tsx bench/throughput.ts \
  --database-url=postgres://postgres:postgres@127.0.0.1:55432/hippo \
  --runs=2000 \
  --workers=1,2,4,8,16,24,32
```

The harness creates an isolated temporary database for each worker-count scenario, applies migrations, enqueues `2000` one-task runs, and measures:

- `claims/sec`
- end-to-end run latency (`p50`, `p95`, `p99`)
- `null-claim ratio` as the `FOR UPDATE SKIP LOCKED` contention proxy

The contention proxy counts `engine.tick()` calls that return no claim while unfinished benchmark runs still exist.

## Hardware

- CPU: `Intel(R) Core(TM) Ultra 7 155H`
- Logical CPUs: `22`
- Memory: `62 GiB`
- Postgres: `postgres:16-alpine` via local Docker
- OS: Linux x86_64

## Results

| workers | runs | claims/sec | p50 ms | p95 ms | p99 ms | null-claim ratio | duration s |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2000 | 279.8 | 12792.0 | 14147.0 | 14268.0 | 0.00% | 14.30 |
| 2 | 2000 | 437.9 | 8595.0 | 9096.0 | 9132.0 | 0.00% | 9.13 |
| 4 | 2000 | 655.5 | 6016.0 | 6085.0 | 6093.0 | 0.15% | 6.10 |
| 8 | 2000 | 950.1 | 4387.0 | 4623.0 | 4653.0 | 0.20% | 4.21 |
| 16 | 2000 | 1069.9 | 4060.0 | 4426.0 | 4491.0 | 0.35% | 3.74 |
| 24 | 2000 | 1635.8 | 2942.0 | 3474.0 | 3518.0 | 0.40% | 2.45 |
| 32 | 2000 | 1057.4 | 4083.0 | 4383.0 | 4398.0 | 0.35% | 3.78 |

## Readout

On this host, throughput keeps climbing through `24` workers and then regresses at `32`, which is the first clear contention/overhead cliff in this run. That means Hippo did not hit a `~100 rps` ceiling here; the local plateau was closer to `~1600 claims/sec` for this minimal workflow and single Postgres instance.
