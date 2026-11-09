# @mechane/smoke

The maintained integration catalog checks user guarantees against the compiled CLI and a relocated Node server with real
Postgres and Workflow persistence. Each scenario names the regression it prevents.

Layer 6 · node lane · plain dialect · no consumers

## Run

Start Docker, then run `mise run smoke` with the repository's pinned tools. The task builds the CLI, server, sandbox
service, and guest before executing the catalog. No provider account or paid model is required. The model and GitHub
authentication fixtures are actual local HTTP services; Mechane's implementation is never mocked.

The sandbox fixture uses the real sandbox service and guest protocol, with synthetic commands running in owned host
directories. It checks execution receipts, workspace persistence, and transient credentials. It does not establish
container or operating-system isolation; that boundary requires qualification on the hosted sandbox provider.

`src/main.ts` owns one stack and always stops it. `src/catalog.ts` orders checks that share this stack; authentication
limits run first and credential leak checks run last. `src/run-scenarios.ts` applies a bounded deadline and can select
one guarantee by a command-line substring. Failed scenarios retain private runtime and sandbox logs at the printed path;
review and remove that folder afterward. Each resource folder contains the scenarios for its guarantees.

## Maintain

Follow the [repository's test curation](../../../../../.contracts/001-test-curation/CONTRACT.md) and the
[product contracts](../../../.contracts/index.md). Change the catalog only within an authorized product change and
account for any removed guarantee. Keep reusable public-boundary helpers in `@mechane/testing` and external service
fixtures in `@mechane/stack`. Never retain credentials in assertions or logs.
