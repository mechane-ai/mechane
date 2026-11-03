# Mechane Console

Open `/console` on any Mechane installation. Sign in through its configured GitHub or local sign-in. The console uses
the same workspaces and permissions as the CLI, without creating or storing a browser API key. It is a workspace
management interface; it does not grant installation-wide administrative access.

The console lists mechs and their daily allowance, creates and edits definitions, pauses or activates work, sends
messages, and archives mechs. Each mech has recent turns, activity, and a trace for each turn. A trace shows the
recorded request intervals, outcomes, token usage, and settled cost. Select a request to inspect its reservation,
settlement, and usage. Each trace also pages through that turn's original inputs, replies, and lifecycle events.
Intervals measure reservation to settlement; they do not measure provider inference alone. Missing provider usage
remains unknown. Tool calls are not yet recorded as spans, and there is no workspace-wide event feed.

Lists are bounded pages. Newest turns and events appear first; older pages remain available. Mech lists follow the API's
stable creation order. Background refresh keeps the last result visible and marks a failed refresh. Writes wait for the
server. Editing checks the saved revision; a conflict keeps your draft so you can compare it with the latest definition.
Sign-out revokes the browser session, and changing workspace discards its in-memory collections.

## Package boundaries

| Package                  | Owns                                                    | Uses                       |
| ------------------------ | ------------------------------------------------------- | -------------------------- |
| `@mechane/console`       | Start routes, screens, commands, session lifetime       | data, views, UI            |
| `@mechane/console-data`  | Validated requests, TanStack DB snapshots, cancellation | shared client and protocol |
| `@mechane/console-views` | Mech, activity, and trace presentation                  | protocol, records, UI      |
| `@mechane/ui`            | Base UI controls, StyleX tokens, visx charts            | browser libraries          |

Only `console-data` crosses from the shared Effect client into browser Promises. It stores each bounded API response as
one reactive snapshot; it does not pretend one fetched page contains every entity. The server owns authorization and
persistence. No browser code imports Worker storage or installation secrets.

UI modules group controls, forms, typography, surfaces, and charts by responsibility. The shell uses compact neutral
surfaces and a mobile navigation drawer. Base UI owns button, tab, and dialog interactions. StyleX uses explicit border
and outline longhands; the contract's syntax check prevents unsupported shorthands from silently losing styles. The
trace timeline uses visx. Turn events come from the existing durable event log, with indexed turn and inbox lookup;
there is no separate tracing store.

## Local development

From a configured checkout, `mise run dev` builds the complete release and starts a disposable celld fixture with fake
GitHub and a scripted model. Open the printed origin plus `/console`. `mise run start` uses retained local state and
real model credentials instead; see the [local guide](../packages/node/stack/README.md). Rebuild and restart the fixture
after changing the application or Worker.

For component development with hot reload, run `pnpm --filter @mechane/console storybook` from `workspaces/core`.
`pnpm --filter @mechane/console build-storybook` checks the isolated component build. Stories cover populated, empty,
loading, refresh-failure, and revision-conflict states. `mise run check` runs the repository checks and existing runtime
scenarios. Browser acceptance uses the built celld Worker, including authentication and actual API responses.

## Installation and upgrades

The Console is part of the existing local package and Cloudflare release module. No second service, frontend deployment,
database, public URL, or client-side secret configuration is required. Local celld and Cloudflare's ASSETS binding serve
the same checksum-bound `console.json` inventory. OpenTofu uploads missing assets before activating the Worker and
exports `console_url`. Upgrade the installation to upgrade both API and Console together.

Runtime JSON operations use `/api/v1`. `/console` serves only Console files; a missing API route never returns the app
shell. HTML is uncached and hashed assets are immutable. Bundled dependency notices are available at
`/console/THIRD_PARTY_LICENSES.txt`.

The 0.10 release moves the previous `/v1` API to `/api/v1` without aliases. Upgrade CLI binaries and integration clients
together. The upgrade comparison recognizes that address change while retaining exact stored-format and migration
checks. Existing agents, identities, sessions, histories, and files remain in their original stores.
