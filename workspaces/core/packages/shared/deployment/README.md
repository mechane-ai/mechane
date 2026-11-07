# @mechane/deployment

Shared endpoint validation, model identities, and sandbox configuration names used by Mechane clients and compute. The
Node runtime owns its application settings, credential keyring, model rates, and admission policy.

## Use

Validate credential destinations with `SecureOrigin`. Use `ModelId` for an upstream model's opaque name. The CLI reads
`ORIGIN_VARIABLE`; the sandbox provider reads the names in `SANDBOX_VARIABLES`.

Production sandboxes use Cloudflare Containers. Local verification launches the same guest through an authenticated
loopback launcher. `SandboxProvider` names those two supported compute boundaries.

## Ownership

`constants.ts` owns shared variable names and provider choices. `schemas.ts` owns their endpoint and identity schemas.
This package imports no platform APIs or other Mechane packages.
