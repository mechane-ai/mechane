# @mechane/deploy-render

An installation's Wrangler configuration, rendered from the product configuration and explicit operator settings.

Layer 5 · node lane · effect dialect · consumers: deploy

## Layout

- `src/`: resource composition, release variables, and provider-specific container configuration.

## Rules

The [product contracts](../../../.contracts/index.md) apply. `mise run check` renders the configuration with
`deploy:render` and builds it with Wrangler in a dry run, so a malformed overlay fails the check.

## Use

`renderConfiguration` writes the rendered configuration into the app's ignored Wrangler folder. It answers with the
Worker's name, this checkout's revision, its variables and its migrations, which every later mode reads.

## Never

- Never accept secret values, local bootstrap settings, host-launcher variables or a generated revision in an
  installation.
