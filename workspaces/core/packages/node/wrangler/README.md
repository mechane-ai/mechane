# @mechane/wrangler

The Worker's Wrangler configuration, its migration tags, the releases bucket it binds and the built bundle's path.

Layer 3 · node lane · effect dialect · consumers: stack, deploy-kernel, deploy-preflight, deploy-render, deploy

## Layout

- `src/`: the base configuration read and decoded, a configuration that serves the built bundle, the releases bucket,
  the configuration's schemas, and the reader of JSON with comments that every configuration and lock read takes.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The smoke's stack and `deploy:render` read the
configuration through these functions.

## Use

Each read fails as its caller's failure at the caller's step, such as
`baseConfiguration({ step: StackStep.ReadWranglerConfiguration, failure: StackFailed })`, so this member declares no
failure or step of its own. `readJsonc` and `decodeJsonc` keep `jsonc-parser` out of `@mechane/program`, which the guest
bundles.

## Never

- Never decode a container key celld refuses; the stack's decode refuses every other key.
