# Development setup

Run `.config/bootstrap.sh` to install the pinned mise release, tools, and locked dependencies. The root `mise.toml` and
`mise.lock` pin tools. `workspaces/core/pnpm-lock.yaml` pins packages.

```sh
.config/bootstrap.sh
mise run check
```

Start Docker and use the release-qualified celld identity before local runtime work. An explicit
`MECHANE_LOCAL_CELLD_BINARY` override contains `executable`, `version`, and `sha256`; the launcher verifies them. Follow
the [local guide](../workspaces/core/packages/node/stack/README.md) for the current pin and prerequisites.

`mise run dev` and `mise run start` retain state in `~/.local/state/mechane`, or `MECHANE_LOCAL_STATE_DIR`. The
supervisor runs a watched application Worker, separate environment host, real Docker guests, and verified TLS Postgres.
Application reload preserves guests. Default HTTP fixtures supply local GitHub sign-in and deterministic model responses
without provider credentials.

Set `MECHANE_LOCAL_USE_FIXTURES=false` for configured providers and supply the documented runtime and authentication
settings. Keep credentials outside version control. The launcher owns local database credentials and its keyring.

Use `mise -C workspaces/core run TASK` for a product task and `mise run mechane -- --help` for the source CLI. The
[operator guide](runbook.md) links release installation and recovery. Operators consume qualified compiled artifacts
without a contributor toolchain.
