# Mechane

Mechane runs agents with durable memory, persistent sandboxes, a browser console, and a command-line interface.

## Start

Choose where the service runs. Open `/console` there, or use the CLI. Both use the same runtime API.

| Installation | Start here                                                   | Requirements                                               |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Hosted       | [mechane.ai](https://mechane.ai)                             | GitHub sign-in                                             |
| Local        | [Local guide](workspaces/core/packages/node/stack/README.md) | Node 24, Postgres, and model credentials                   |
| Self-hosted  | [Self-hosting guide](workspaces/core/docs/self-hosting.md)   | A Node host, Postgres, a sandbox service, and GitHub OAuth |

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

The Node service owns agents, authentication, conversations, and durable workflows in Postgres. The isolated sandbox
service owns command execution and persistent files. Releases contain the compiled Node service and console, the sandbox
Worker and image, and their checksums. Installation does not require compiling Mechane source.

## Elements

[Elements by Mechane](workspaces/core/packages/browser/elements/README.md) is the reusable React design system behind
the Console. Its components, AI interfaces, and analytical charts share compact typography, square surfaces, and light
and dark themes.

```sh
pnpm add @mechane-ai/elements react react-dom
```

Load `@mechane-ai/elements/styles.css` once and import the families you use, such as `/forms`, `/content/code`, or
`/charts/cartesian`. The package includes compiled ESM, TypeScript declarations, and CSS. Start with the
[component guide](workspaces/core/docs/components.md) or the
[npm package](https://www.npmjs.com/package/@mechane-ai/elements).

## Layout

`workspaces/core` is the product workspace. Its [package map](workspaces/core/dependencies.json) declares every package
and layer. The root contains the pinned toolchain, [repository contracts](.contracts/index.md), and independent setup.

The [Console guide](workspaces/core/docs/console.md) explains the browser UI and package boundaries.

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
