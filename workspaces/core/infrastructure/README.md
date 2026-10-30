# Mechane infrastructure

Cloud operators install an immutable release archive with OpenTofu. Follow
[Cloudflare setup](../docs/cloudflare-setup.md) for a first installation. The module owns installation resources;
runtime APIs own workspaces and agents.

- `modules/cloudflare/` contains the service module packaged with each release.
- `provider/` is the standalone Go provider for Worker release activation and Cloudflare Containers.
- `examples/cloudflare/` contains the consumer declaration and a signed-provider filesystem-mirror setup helper.
- `check.sh` validates the module and provider without a cloud account.

The distribution program builds archives from clean public source tags. The private factory publishes provider source
and signed binaries through its engineering App; public provider users need no private repository or factory tooling.
