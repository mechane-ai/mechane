# @mechane/wrangler

The Worker's build metadata, local runtime configuration, migration tags, and releases bucket.

Layer 4 · node lane · effect dialect · consumers: stack, distribution

## Layout

- `src/`: the base configuration read and decoded, a configuration that serves the built bundle, the releases bucket,
  the configuration's schemas, and the reader of JSON with comments that every configuration and lock read takes.

## Rules

The [product contracts](../../../.contracts/index.md) apply. After bundling, `mise run build:worker` records the Worker
digest, release identity, format locks, and configuration together in `dist/release.json`. The local stack and release
packager verify that record against the bundle before using it. Rebuild after changing source or configuration.

## Use

`readBuiltRelease()` supplies verified build metadata to both consumers. Configuration and JSONC helpers report failures
at their caller's step. The JSONC reader keeps `jsonc-parser` out of `@mechane/program`, which the guest bundles.

## Never

- Never decode a container key celld refuses; the stack's decode refuses every other key.
