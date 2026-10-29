# @mechane/smoke

The scenario catalog and one function per guarantee: the one test `mise run check` runs, which drives the built CLI
against a fresh local stack.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/catalog.ts`: every scenario, with the guarantee it checks and the regression it guards, in the order they run.
- `src/run-scenarios.ts`: the stack the scenarios share, and the run of the catalog against it.
- `src/<resource>/`: one folder per resource a guarantee is about (`auth`, `deployment`, `drones`, `evals`, `forks`,
  `hands`, `limits`, `mechs`, `memory`, `releases`, `workspaces`), one scenario per file named for its guarantee, beside
  the steps and declarations only that folder's scenarios use.

## Rules

The [repository's test curation](../../../../../.contracts/001-test-curation/CONTRACT.md) and the
[product contracts](../../../.contracts/index.md) apply.

## Use

`mise -C workspaces/core run smoke` builds the Worker, the CLI and the guest, and runs every scenario in the catalog's
order against one stack with host sandboxes, so it needs no Docker, no account and no paid model. A scenario reaches the
deployment only through the built CLI, a browser of `@mechane/testing` and the stack's local services, and ends with one
named check.

## Never

- Never add, drop or reword a scenario of the catalog without maintainer approval.
- Never mock Mechane's code, call a paid model or reach a cloud account.
- Never share a fixture across resource folders here: move it to a family of `@mechane/testing`.
