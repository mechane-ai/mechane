# Installation

Use `mise run start` for persistent local use or `mise run dev` for a disposable scripted fixture. Run `mise run check`
before changing deployment configuration.

Use `workspaces/core/packages/worker/app/cloudflare.example.jsonc` as the starting installation configuration. Configure
your own domain, provider accounts, and GitHub OAuth application before deploying.

New cloud installations use Cloudflare Workers, Containers, and R2. Tensorlake is an optional sandbox provider. Read the
[self-hosting guide](../workspaces/core/docs/self-hosting.md) before preparing an installation.

Keep credentials in an ignored file with owner-only permissions. Set `MECHANE_DEPLOY_ENV_FILE` to that file and
`MECHANE_DEPLOY_CONFIG_FILE` to your installation configuration. From the repository root, render, inspect, and deploy
with:

```sh
mise -C workspaces/core run deploy:render
mise -C workspaces/core run deploy:preflight
mise -C workspaces/core run deploy
```

The offline check renders the example overlay and builds the Worker without uploading it. Deployment and release uploads
require an explicit operator command. CI runs checks only.

Use the source's package licenses when distributing dependencies or compiled binaries. Retain `LICENSE`, `NOTICE`, and
each dependency's required notices with your distribution.
