# Installation

Use [mechane.ai](https://mechane.ai) for the hosted service, a
[packaged local release](../workspaces/core/packages/node/stack/README.md) on your computer, or
[OpenTofu](../workspaces/core/docs/self-hosting.md) in your Cloudflare account. Local runtime state survives ordinary
restarts; explicit reset erases an inactive installation.

Cloud installations use the versioned OpenTofu module, prebuilt Worker, and sandbox image. Follow the
[self-hosting guide](../workspaces/core/docs/self-hosting.md), starting with the
[Cloudflare example](../workspaces/core/infrastructure/examples/cloudflare/main.tf). Set your own domain, model service,
GitHub OAuth app, and Secrets Store references. `CLOUDFLARE_API_TOKEN` authenticates the providers; no model, OAuth, or
workspace secret values belong in HCL or state.

Use `tofu plan`, inspect the proposed changes, then `tofu apply`. Upgrade by changing the release archive. Retain the
Worker and workspace bucket identities. Workspace members, agents, credentials, Slack connections, and watches are
managed separately through the running service's CLI or API.

Follow [operations](../workspaces/core/docs/operations.md) for shared infrastructure state, credential rotation,
recovery, and workspace access. Contributor setup and checks are described in [development setup](README.md). Retain
`LICENSE`, `NOTICE`, and dependency notices when redistributing artifacts.
