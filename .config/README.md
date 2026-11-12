# Development setup

Run `.config/bootstrap.sh` to install the pinned mise release, tools, and locked dependencies. The root `mise.toml` and
`mise.lock` pin tools. `workspaces/core/pnpm-lock.yaml` pins packages.

```sh
.config/bootstrap.sh
mise run check:static
```

Automatic CI runs the same static command. Building release assets and running their complete acceptance is an explicit
operator action through `Build runtime candidate`, or `mise -C workspaces/core run distribution:candidate` locally. The
workflow requires a full reviewed source commit matching its selected ref. Its qualified artifact expires after three
days; publication consumes that exact candidate without rebuilding. Source checks alone do not qualify a release.

Start Docker and use the release-qualified celld identity before local runtime work. An explicit
`MECHANE_LOCAL_CELLD_BINARY` override contains `executable`, `version`, and `sha256`; the launcher verifies them. Follow
the [local guide](../workspaces/core/packages/node/stack/README.md) for the current pin and prerequisites.

`mise run dev` retains worktree-specific state under `~/.local/state/mechane/dev`, or `MECHANE_LOCAL_STATE_DIR`. The
supervisor runs a watched application Worker, separate environment host, real Docker guests, and verified TLS Postgres.
Application reload preserves guests. Default HTTP fixtures supply local GitHub sign-in and deterministic model responses
without provider credentials.

Select model and GitHub providers independently when starting, such as
`mise run dev -- start --model=live --github=fixture`. Supply the selected live provider's runtime or authentication
settings. Keep credentials outside version control. The launcher owns local database credentials and its keyring.

Use `mise -C workspaces/core run TASK` for a product task and `mise run dev -- cli --help` for the retained source CLI.
The [operator guide](runbook.md) links release installation and recovery. Operators consume qualified compiled artifacts
without a contributor toolchain.
