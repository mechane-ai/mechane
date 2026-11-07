# Mechane infrastructure

Operators deploy one Node service backed by Postgres and a separate Cloudflare compute service. Both consume immutable
artifacts from the same release. The runtime package owns product data and migrations; infrastructure owns resources,
credentials, and service endpoints.

- `modules/cloudflare/` supplies the sandbox service and public ingress gateway.
- `provider/` owns Worker release activation, verified image copying, and Cloudflare container rollout.
- `examples/cloudflare/` shows the compute declaration and provider setup helper.
- `check.sh` validates the module and provider without a cloud account.

The Node archive includes the compiled server, Workflow bundle, migrations, grant command, and console assets. Its
`release.json` names each entrypoint and the pinned Node version. Deployment verifies the archive checksum and runs the
included commands without compiling TypeScript or installing packages.

The distribution program builds artifacts from clean public source tags. Public users need no private repository or
Factory tooling. The private Factory publishes provider source and signed binaries through its engineering App.
