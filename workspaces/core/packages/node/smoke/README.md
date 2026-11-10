# @mechane/smoke

The maintained integration catalog checks user guarantees against the compiled CLI and Worker, with real celld
durability, local TLS Postgres, and Docker guests. Each scenario names the regression it prevents.

Layer 6 · node lane · plain dialect · no consumers

## Run

Start Docker, then run `mise run smoke` with the repository's pinned tools. The task builds the CLI, Worker, console,
and guest before executing the catalog. No provider account or paid model is required. The model and GitHub
authentication fixtures are actual local HTTP services; Mechane's implementation is never mocked.

The sandbox service runs on a separate celld host and executes real commands in Docker containers. Restarting the
application preserves this host. Environment scenarios check execution receipts, workspace recovery, and transient
credentials. Cloudflare platform behavior still requires hosted qualification.

`src/main.ts` owns one stack and always stops it. `src/catalog.ts` orders checks that share this stack; authentication
limits run first and credential leak checks run last. `src/run-scenarios.ts` applies a bounded deadline and can select
one scenario by its exported function name or a guarantee substring. For example,
`mise run smoke -- duplicateNotificationRunsAndChargesOnce` selects the admission and charging guarantee. Full smoke
runs the complete catalog. Failed scenarios retain private runtime and sandbox logs at the printed path; review and
remove that folder afterward. Each resource folder contains the scenarios for its guarantees.

The history scenario creates a separate database from a frozen, checksummed schema 3 fixture. The current compiled
migration and import commands upgrade and transfer its records into a quiesced actor. Repeating the import checks
preservation and idempotence; the application database retains its current migration ledger.

## Maintain

Follow the [repository's test curation](../../../../../.contracts/001-test-curation/CONTRACT.md) and the
[product contracts](../../../.contracts/index.md). Change the catalog only within an authorized product change and
account for any removed guarantee. Keep reusable public-boundary helpers in `@mechane/testing` and external service
fixtures in `@mechane/stack`. Never retain credentials in assertions or logs.
