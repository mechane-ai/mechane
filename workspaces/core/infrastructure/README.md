# Mechane infrastructure

Cloud operators install an immutable release archive with OpenTofu. The module owns installation resources; runtime APIs
own workspaces and agents. See [self-hosting](../docs/self-hosting.md).

- `modules/cloudflare/` contains the service module packaged with each release.
- `provider/` is the standalone Go provider for Worker release activation and Cloudflare Containers.
- `examples/cloudflare/` contains a consumer declaration with no source-build dependency.
- `check.sh` validates the module and provider without a cloud account.

The distribution program builds archives from clean public source tags. The private factory publishes provider source
and signed binaries through its engineering App; public provider users need no private repository or factory tooling.
