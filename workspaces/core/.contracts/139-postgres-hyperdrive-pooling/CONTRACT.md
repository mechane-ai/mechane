---
name: postgres-hyperdrive-pooling
message: Connect Cloudflare Worker isolates to transactional PostgreSQL through uncached TLS-required Hyperdrive pools with bounded per-isolate connection ceilings.
paths: ["packages/worker/authority-store/src/store/postgres.ts", "packages/worker/server/src/settings/worker.ts", "packages/node/wrangler/src/**", "infrastructure/**"]
---

## Rules

Prefer Cloudflare Hyperdrive (`HYPERDRIVE`) over direct TCP PostgreSQL connections whenever a Hyperdrive binding is configured on the Worker isolate. Keep query caching explicitly disabled (`caching.disabled = true`) on every Hyperdrive configuration serving the transactional control store so read-after-write authentication, rate-limit, spend-budget, session-lifecycle, and work-lease queries never observe stale cached rows.

Require encrypted transport (`sslmode=require` or stricter) between Hyperdrive and the upstream PostgreSQL origin, and between direct migration/grant tooling and PostgreSQL. Never weaken TLS verification or embed database credentials in checked-in infrastructure or Wrangler configuration files.

Bound every Worker isolate's `pg` pool size with `MECHANE_DATABASE_MAX_CONNECTIONS` and size `max_instances` alongside it so worst-case aggregate connections across concurrent isolates and maintenance workers stay safely within the upstream PostgreSQL connection budget. Configure short idle timeouts and explicit connection timeouts so dormant isolates release pooled slots promptly and transient pool pressure fails cleanly with retryable status instead of hanging Worker invocations.

## Checks

Verify through OpenTofu infrastructure configuration and live deployment inspection that production Hyperdrive resources set `caching.disabled = true`, connect with TLS required, and pair bounded `MECHANE_DATABASE_MAX_CONNECTIONS` with bounded Worker `max_instances`.

Qualify database migrations and runtime grants through the release `migrate.mjs` and `grant.mjs` entry points against real PostgreSQL with least-privilege runtime roles, confirming readiness reports the expected `storage_revision` with zero connection exhaustion under concurrent smoke traffic.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
