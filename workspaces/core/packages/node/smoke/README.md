# @mechane/smoke

The maintained integration catalog checks user guarantees against the source CLI and compiled Worker, with real celld
durability, local TLS Postgres, and Docker guests. Artifact acceptance runs the same catalog against selected built
Worker, Console, guest, and CLI bytes. Each scenario names the regression it prevents.

Layer 6 · node lane · plain dialect · no consumers

## Run

Start Docker, then run `mise -C workspaces/core run smoke` with the pinned tools. Source checks build the guest and
compile the Worker; Console and full source runs use Vite, and non-Console cases need no built UI assets. The host CLI
runs from source. No provider account or paid model is required. The model and GitHub authentication fixtures are actual
local HTTP services; Mechane's implementation is never mocked.

The sandbox service runs on a separate celld host and executes real commands in Docker containers. Restarting the
application preserves this host. Environment scenarios check execution receipts, workspace recovery, and transient
credentials. Cloudflare platform behavior still requires hosted qualification.

`src/main.ts` owns one stack and always stops it. `src/catalog.ts` orders checks that share this stack; authentication
limits run first and credential leak checks run last. `src/run-scenarios.ts` applies a bounded deadline and can select
one scenario by its exported function name or a guarantee substring. For example,
`mise -C workspaces/core run smoke -- managedAgentLifecycle` selects the SDK resource lifecycle guarantee. Full smoke
runs the complete catalog. Failed scenarios retain private runtime and sandbox logs at the printed path; review and
remove that folder afterward. Each resource folder contains the scenarios for its guarantees.

`@mechane/stack` owns retained development sessions through `runDevelopment`. Smoke supplies its catalog callback; only
explicitly marked fixture cases reuse retained state, and other cases use isolation. Generic session control does not
import the smoke catalog. Final candidate acceptance always runs the complete artifact catalog.

The history scenario creates a separate database from a frozen, checksummed schema 3 fixture. The current compiled
migration and import commands upgrade and transfer its records into a quiesced actor. Repeating the import checks
preservation and idempotence; the application database retains its current migration ledger.

## Maintain

Follow the [repository's test curation](../../../../../.contracts/001-test-curation/CONTRACT.md) and the
[product contracts](../../../.contracts/index.md). Change the catalog only within an authorized product change and
account for any removed guarantee. Keep reusable public-boundary helpers in `@mechane/testing` and external service
fixtures in `@mechane/stack`. Never retain credentials in assertions or logs.

## Managed Agents clients

Run `mise -C workspaces/core run smoke -- --family managed` against a fresh local installation. The TypeScript journeys
use the pinned public Anthropic SDK, a held model fixture and a scoped environment worker. To focus on one guarantee,
pass its catalog function name.

The Python driver provides an independent client and validates JSON before SDK parsing. From the factory root run:

```sh
uv run --script workspaces/core/packages/node/smoke/clients/managed_agents.py wire
uv run --script workspaces/core/packages/node/smoke/clients/managed_agents.py inventory
```

Set `ANTHROPIC_BASE_URL` to the local application origin and `ANTHROPIC_API_KEY` to a fixture account to run
`capabilities` or `live`. The former checks collection reads and expected self-hosted omissions. The latter exercises
real agent, skill and vault lifecycles, including the worker’s pinned skill downloads. `wire` captures a local client
request. `inventory` lists upstream operations. Verify the official CLI against the same installation with
`sh workspaces/core/packages/node/smoke/clients/managed_cli.sh MODEL_ID`, using an offered model and `ant` 2.11.0. The
published guide documents the differences between hosted and self-hosted deployments.
[Feature differences](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences)
