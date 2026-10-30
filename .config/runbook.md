# Installation

Use `mise run start` for persistent local use or `mise run dev` for a disposable scripted fixture. Local runtime state
survives ordinary restarts; `local:reset --confirm` is the explicit reset operation.

Cloud installations use the versioned OpenTofu module, prebuilt Worker, and sandbox image. Follow the
[self-hosting guide](../workspaces/core/docs/self-hosting.md), starting with the
[Cloudflare example](../workspaces/core/infrastructure/examples/cloudflare/main.tf). Set your own domain, model service,
GitHub OAuth app, and Secrets Store references. `CLOUDFLARE_API_TOKEN` authenticates the providers; no model, OAuth, or
workspace secret values belong in HCL or state.

Use `tofu plan`, inspect the proposed changes, then `tofu apply`. Upgrade by changing the release archive. Retain the
Worker and workspace bucket identities. Workspace members, agents, credentials, Slack connections, and watches are
managed separately through the running service's CLI or API.

CI runs offline checks only: the product smoke uses local scripted services, and infrastructure checks compile the
provider and validate the packaged module without a cloud account. Release publication and cloud applies remain explicit
operator actions. Retain `LICENSE`, `NOTICE`, and dependency notices when redistributing artifacts.
