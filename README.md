# Mechane

Mechane runs persistent agents with durable conversations, sandbox computers, a browser Console, and a command-line
interface.

## Start

Start Docker and select the release-qualified celld build described in [development setup](.config/README.md). From a
source checkout:

```sh
.config/bootstrap.sh
mise run dev
```

Open the printed Console URL. Source development retains local state and supplies deterministic identity and model
fixtures. Use `mise run mechane -- --help` in another terminal for the source CLI.

| Installation | Start here                                                   | Requirements                                               |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Local source | [Local guide](workspaces/core/packages/node/stack/README.md) | Pinned tools, qualified celld, Docker                      |
| Self-hosted  | [Self-hosting guide](workspaces/core/docs/self-hosting.md)   | Cloudflare Workers, Containers, R2, Postgres, GitHub OAuth |

With the installed CLI, select your operator's origin and sign in:

```sh
export MECHANE_ORIGIN=https://agents.example.com
mechane auth login
mechane mech create --name scout
mechane notification send MECH_ID 'hello, scout'
```

Use the returned mech ID. Keep the printed notification ID when retrying an uncertain send. Workspace policy controls
execution access and spending. Replies appear only through explicit communication tools; private model completion can be
quiet.

## Runtime

One Cloudflare Worker serves the API and Console assets. Pi and each Mech Durable Object own durable execution. Postgres
owns shared control authority, credentials, grants, accounting, and capacity. Sandbox Durable Objects, guests, and R2
own commands and committed home files.

Install immutable, qualified Worker, Console, guest, and database-tool artifacts. Operators do not rebuild application
source. Infrastructure configuration and runtime workspace records have separate owners.

## Elements

[Elements by Mechane](workspaces/core/packages/browser/elements/README.md) is the reusable React design system behind
the Console.

```sh
pnpm add @mechane-ai/elements react react-dom
```

Load `@mechane-ai/elements/styles.css` once and import the families you use, such as `/forms`, `/content/code`, or
`/charts/cartesian`. The package includes compiled ESM, TypeScript declarations, and CSS. Start with the
[component guide](workspaces/core/docs/components.md) or the
[npm package](https://www.npmjs.com/package/@mechane-ai/elements).

## Documentation

- [Console](workspaces/core/docs/console.md): conversations, activity, environments, and trace evidence.
- [Notifications](workspaces/core/docs/notifications.md): durable input and explicit responses.
- [Operations](workspaces/core/docs/operations.md): qualification, migration, import, stopping, and recovery.
- [Development](.config/README.md): pinned tools and standalone checks.

`workspaces/core` contains the product. Its [package map](workspaces/core/dependencies.json) declares packages and
layers. Read the [repository contracts](.contracts/index.md) before contributing. Checks use deterministic providers
without cloud accounts or paid models. This public source builds independently and preserves required third-party
attribution.

## License

Mechane's original source is available under [Apache-2.0](LICENSE). [NOTICE](NOTICE) retains attribution for copied
third-party materials. Downloaded dependencies keep their own licenses. The software license grants no general right to
Mechane trademarks.
