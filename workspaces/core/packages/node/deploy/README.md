# @mechane/deploy

The operator deployment program: explicit installation settings, release checks, Worker and secret uploads, provider
image publication, CLI releases and rollback.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/`: the program's settings, its run of the mode the command line names, and its exit.
- `src/rollout/`: the deploy after the preflight, its wait for readiness and checks of what production serves, the CLI's
  release, the deploy's record, and the rollback.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The rollout runs the preflight and reads its formats, so it
sits above `@mechane/deploy-preflight` and stays in the program.

## Use

The `deploy:render`, `deploy:preflight`, `deploy`, `deploy:rollback` and `release:upload` tasks run `src/main.ts` with
their mode. Only `render` runs in the check. Cloud modes require an explicit installation and clean tagged checkout. See
[self-hosting](../../../docs/self-hosting.md).

## Never

- Never read ambient configuration outside the deploy settings modules or the image child's settings module.
- Never deploy, roll back or upload from a dirty tree; only `render` takes one.
