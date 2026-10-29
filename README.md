# Mechane

Mechane runs agents with durable memory, persistent sandboxes, and a command-line interface. This repository contains
the service, CLI, local development stack, and checks.

## Start

Git, Bash, and a supported Linux or macOS machine are required. The bootstrap installs the pinned tools and locked
packages.

```sh
.config/bootstrap.sh
export PATH="$HOME/.local/bin:$PATH"
mise run check
```

For a persistent local installation, start Docker and configure your model provider as the
[local guide](workspaces/core/packages/node/stack/README.md) describes. Then run `mise run start`. Open the printed
local owner-login URL and use the secret from the indicated private file. Copy the printed `MECHANE_ORIGIN` assignment,
then run:

```sh
mise run mechane -- auth login
mise run mechane -- mech create --name scout
mise run mechane -- inbox send <mech-id> 'hello, scout'
mise run mechane -- --help
```

Stopping the local installation preserves its agents, authentication, and workspace files. For disposable development
without provider credentials, run `mise run dev`. It supplies a scripted model and local GitHub sign-in. Checks need no
cloud account or paid model. The smoke uses host processes for sandboxes, while local installations use Docker.

To erase an inactive local installation and create fresh state on its next start, run
`mise run local:reset -- --confirm`. For a cloud installation, follow the
[self-hosting guide](workspaces/core/docs/self-hosting.md), then run the product's `deploy:render`, `deploy:preflight`,
and `deploy` tasks with your installation configuration. Cloud deployment uses a clean checkout of an annotated
`v<version>` source tag. Binaries and images are published separately from source tags.

## Layout

`workspaces/core` is the product workspace. Its [package map](workspaces/core/dependencies.json) declares every package
and layer. The root contains the pinned toolchain, [repository contracts](.contracts/index.md), and independent setup.

Use `mise -C workspaces/core run <task>` for a product task. The [configuration guide](.config/README.md) explains local
setup. The [operator guide](.config/runbook.md) explains the deployment example.

## Development

Mechane develops in a private source repository. An organization-owned GitHub App publishes reviewed source snapshots
here. Every snapshot builds independently. Private history, credentials, planning notes, and hosted installation
settings are excluded.

Public issues and proposed patches can inform later snapshots. Keep required third-party attribution when contributing.

## License

Mechane's original source is available under [Apache-2.0](LICENSE). [NOTICE](NOTICE) retains attribution for copied
third-party materials. Downloaded dependencies keep their own licenses. The software license grants no general right to
Mechane trademarks.
