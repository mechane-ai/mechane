# @mechane/wrangler

The Worker's build and local runtime configuration, migration tags, local releases bucket and built bundle path.

Layer 4 · node lane · effect dialect · consumers: stack, distribution

## Layout

- `src/`: the base configuration read and decoded, a configuration that serves the built bundle, the releases bucket,
  the configuration's schemas, and the reader of JSON with comments that every configuration and lock read takes.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The local stack and release packager read the configuration
through this package.

## Use

Each read fails as its caller's failure at the caller's step, such as
`baseConfiguration({ step: StackStep.ReadWranglerConfiguration, failure: StackFailed })`, so this member declares no
failure or step of its own. The JSONC reader keeps `jsonc-parser` out of `@mechane/program`, which the guest bundles.

## Never

- Never decode a container key celld refuses; the stack's decode refuses every other key.
