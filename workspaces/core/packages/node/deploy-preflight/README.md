# @mechane/deploy-preflight

The checks an installation passes before deployment: its release, account, buckets, Docker when needed, deployed state,
and append-only formats. Only an OpenRouter installation checks OpenRouter's credit limit.

Layer 5 · node lane · effect dialect · consumers: deploy

## Layout

- `src/`: the preflight's run and its summary, and one check each for the checkout, the accounts, the append-only
  formats, what production runs and the tools.
- `src/versions/`: the Worker version production's latest deployment serves most, its release tag and its readiness.

## Rules

The [product contracts](../../../.contracts/index.md) apply. Cloud account checks run only when an operator invokes
`deploy:preflight` or `deploy`; ordinary repository checks use no cloud credentials.

## Use

`runPreflight` runs every check in order and answers with production's origin and what it runs. The rollout reuses
`readFormats`, `deployedRelease`, `deployedVersion` and `versionTag` to compare and record releases.

## Never

- Never change production or the checkout from a check; the preflight only reads.
