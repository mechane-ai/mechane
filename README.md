# Mechane

Mechane runs agents with durable memory, persistent sandboxes, and a command-line interface.

## Start

Choose where the service runs. The CLI uses the same commands for each installation.

| Installation            | Start here                                                   | Requirements                                                                  |
| ----------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Hosted                  | [mechane.ai](https://mechane.ai)                             | GitHub sign-in and the CLI                                                    |
| Local                   | [Local guide](workspaces/core/packages/node/stack/README.md) | Packaged local release, Docker, and model credentials                         |
| Your Cloudflare account | [Self-hosting guide](workspaces/core/docs/self-hosting.md)   | OpenTofu, Cloudflare account, domain, GitHub OAuth app, and model credentials |

For the hosted service, download its CLI installer and sign in:

```sh
curl -fsSL https://mechane.ai/install.sh -o install-mechane.sh
sh install-mechane.sh
export MECHANE_ORIGIN=https://mechane.ai
mechane auth login
mechane mech create --name scout
```

Use the returned agent ID with `mechane inbox send MECH_ID 'hello, scout'`. A different installation supplies its own
origin; set `MECHANE_ORIGIN` before signing in. Workspace policy controls sandbox access and spending.

Local releases retain agents, authentication, and workspace files across restarts. Cloud releases contain the OpenTofu
module, Worker bundle, and sandbox image. Neither installation requires compiling Mechane source.

## Layout

`workspaces/core` is the product workspace. Its [package map](workspaces/core/dependencies.json) declares every package
and layer. The root contains the pinned toolchain, [repository contracts](.contracts/index.md), and independent setup.

The [operator guide](.config/runbook.md) links installation and administration procedures. Runtime agents and
integrations remain separate from infrastructure configuration.

## Development

Follow [development setup](.config/README.md) to bootstrap the pinned toolchain and run checks. Use `mise run dev` for
an isolated scripted fixture or `mise run start` for a persistent source installation. Checks require no cloud account
or paid model.

Mechane develops in a private source repository. An organization-owned GitHub App publishes reviewed source snapshots
here. Every snapshot builds independently. Private history, credentials, planning notes, and hosted installation
settings are excluded.

Public issues and proposed patches can inform later snapshots. Keep required third-party attribution when contributing.

## License

Mechane's original source is available under [Apache-2.0](LICENSE). [NOTICE](NOTICE) retains attribution for copied
third-party materials. Downloaded dependencies keep their own licenses. The software license grants no general right to
Mechane trademarks.
