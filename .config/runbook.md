# Installation

Use [mechane.ai](https://mechane.ai) for the hosted service or run the
[Node service](../workspaces/core/packages/node/stack/README.md) with Postgres. The same compiled runtime runs locally
and on a managed Node host. Ordinary restarts retain state; explicit reset erases an inactive local installation.

Deploy an immutable Node archive, its console assets, and the separate sandbox service. Follow the
[self-hosting guide](../workspaces/core/docs/self-hosting.md) for database migration, runtime configuration, and the
[sandbox infrastructure](../workspaces/core/infrastructure/examples/cloudflare/main.tf). Configure your domain, model
service, GitHub OAuth app, and secret references. Keep database credentials, OAuth secrets, and workspace secrets out of
deployment manifests and state.

Use `tofu plan`, inspect the proposed changes, then `tofu apply` for sandbox resources. Upgrade the Node process and
sandbox service with their matching release artifacts. Workspace members, agents, credentials, and Slack connections are
managed separately through the running service's CLI or API. Workflow checkpoints belong to Postgres; command receipts
and filesystem checkpoints belong to the sandbox service.

Follow [operations](../workspaces/core/docs/operations.md) for shared infrastructure state, credential rotation,
recovery, and workspace access. Contributor setup and checks are described in [development setup](README.md). Retain
`LICENSE`, `NOTICE`, and dependency notices when redistributing artifacts.
