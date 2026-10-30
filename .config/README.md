# Development setup

Run `.config/bootstrap.sh` to install the pinned mise release, tools, and locked dependencies. The root `mise.toml` and
`mise.lock` pin tools. `workspaces/core/pnpm-lock.yaml` pins packages.

```sh
.config/bootstrap.sh
mise run check
```

Use `mise run start` to run a persistent installation from this checkout. It requires Docker and the model settings
described in the [local guide](../workspaces/core/packages/node/stack/README.md). That guide also covers packaged local
releases, which need no contributor toolchain. Keep credentials outside version control.

Use `mise run dev` for a disposable development fixture. It supplies local GitHub sign-in and a scripted model.
Development fixtures and checks require no provider credentials.

Use `mise -C workspaces/core run TASK` for one product task and `mise run mechane -- --help` for the CLI from source.

The [operator guide](runbook.md) links the installation procedures. The public repository contains no credentials,
production account identifiers, or organization admission lists.
