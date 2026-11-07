# @mechane/wrangler

Build metadata and configuration for the isolated Cloudflare compute service.

Layer 4 · node lane · effect dialect · consumers: distribution

After bundling, `mise run build:sandbox` records the sandbox Worker's digest, release identity, format locks, and
configuration in `packages/worker/sandbox-service/dist/release.json`. The release packager verifies that record against
the bundle before using it. Rebuild after changing source or configuration.

`readBuiltRelease()` supplies verified metadata. Configuration and JSONC helpers report failures at their caller's step.
The Node service owns console assets, authentication, and durable agent execution.
