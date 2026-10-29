# Configuration

Run `.config/bootstrap.sh` to install the pinned mise release, tools, and locked dependencies. The root `mise.toml` and
`mise.lock` pin tools. `workspaces/core/pnpm-lock.yaml` pins packages.

```sh
.config/bootstrap.sh
mise run check
```

Use `mise run start` for a persistent local installation with Docker and your model provider. Set
`MECHANE_MODEL_UPSTREAM`, `MECHANE_MODEL_API_KEY`, and `MECHANE_MODEL_OFFERS` as the
[local guide](../workspaces/core/packages/node/stack/README.md) describes. The launcher prints the owner-login URL, the
private bootstrap-secret file path, and the CLI origin.

State lives in `$XDG_STATE_HOME/mechane`, or `~/.local/state/mechane`. Restart with the same settings to retain agents
and data. Keep credentials in an ignored local environment file or the operating system's credential store.

Use `mise run dev` for a disposable development fixture. It supplies local GitHub sign-in and a scripted model.
Development fixtures and checks require no provider credentials.

The [operator guide](runbook.md) describes the example deployment configuration. The public repository contains no
credentials, production account identifiers, or organization admission lists.
