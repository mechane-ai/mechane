# @mechane/deploy-kernel

Shared deployment failures, installation and credential schemas, release checks, git and Wrangler calls, cloud variable
validation, and bounded account and readiness requests.

Layer 4 · node lane · effect dialect · consumers: deploy-preflight, deploy-render, deploy

## Layout

- `src/`: `DeployFailed`, the settings' types and schemas, the paths and timeouts, git and Wrangler runs, a fresh
  temporary folder, a check's refusals and the decode of production's rendered variables.
- `src/services/`: one request with its timeout, a JSON answer read with a bearer token, production's readiness, and
  OpenRouter's report of the production key.
- `src/installation/`: the strict resource and secret-reference schema and its reader.

## Rules

The [product contracts](../../../.contracts/index.md) apply. Rendering validates installation settings without
credentials. Cloud requests run only in operator modes.

## Use

Each mode imports its failures, settings and calls from here. `DeployFailed` names an operation through `DeployStep` and
explains its failure without quoting credentials.

## Never

- Never quote a credential's value in a failure or a diagnostic; the settings hold each one redacted.
- Never import a mode's member here; the modes import the kernel.
