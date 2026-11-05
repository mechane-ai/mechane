# Mechane Console

Open `/console` on any Mechane installation. Sign in through its configured GitHub or local sign-in. The console uses
the same workspaces and permissions as the CLI, without creating or storing a browser API key. It is a workspace
management interface; it does not grant installation-wide administrative access.

The signed-out page is a standalone entrance. After sign-in, an explicit workspace link wins, then the last valid
workspace remembered for that account in this browser. With no preference, a single shared workspace opens before the
personal workspace. Multiple shared workspaces open a chooser. The personal workspace is labeled **Personal**; workspace
names and permissions remain unchanged.

Open a mech to read its continuous **Conversation**, with an inline composer and Markdown replies. **Work** shows the
agent's durable threads and notes; these are work records, not separate chat sessions. **Runs** shows executions with
their input excerpts. **Memory** contains explicitly saved notes, separately from conversation history. **History**
keeps the original durable events. A fork explains the source and copied event boundary: its event number is a position
in the log, not a count of forks. Forked mechs continue independently.

List rows are links with full-row hover and keyboard focus. Open one in another tab or use Back to return to the row and
page you were reading. **Inspect run** opens a contextual pane; on a phone it occupies the content area while the
conversation and draft stay mounted. Closing the inspector returns focus to the originating record.

A run opens on **Overview**. An answered run shows the start of its recorded reply. **Read full reply** opens the exact
event, even in a long history. An unanswered turn shows its recorded reason. **Requests** plots the allowance decision
and settlement for each model request. A bar has both endpoints, a hollow point is awaiting settlement, and a diamond is
a refusal before a call. Select a row to inspect its model, cost and reported usage. **Copy link** shares that selection
with someone who can access the workspace. **Events** pages through the original messages and replies in commit order.
**Tools** shows recorded tool names, outcomes and timing; raw tool arguments and results do not enter this browser
projection. Evidence reads are bounded, and missing or truncated evidence is labeled.

Activate a timestamp to copy its exact UTC value. A transient refresh failure keeps the last result visible and offers a
retry. New activity waits behind **Show new activity** while you read. A message clears only after receipt; failed sends
retain the draft and request identity for retry. Enabled means the mech can run, while Running comes from an execution
record. **Settings** holds the definition, lifecycle actions, existing Slack connections and delivery receipts. An
answered run and a delivered Slack reply are separate outcomes. The console does not change Slack bindings or
permissions. When you edit a definition someone else has changed, compare the saved revision with your draft before
saving. Continuing keeps your edits and adopts the latest values for untouched fields.

## Package boundaries

| Package                       | Owns                                                             | Uses                                  |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| `@mechane/console`            | Start routes, screens, commands, session lifetime                | data, views, UI, layout               |
| `@mechane/console-data`       | Validated requests, TanStack DB snapshots, cancellation          | shared client and protocol            |
| `@mechane/console-views`      | Mech, activity, and trace presentation                           | protocol, records, UI, layout, charts |
| `@mechane-ai/elements`        | Base UI controls, forms, feedback, and generic data presentation | tokens and browser libraries          |
| `@mechane-ai/elements/layout` | AppShell, sidebar, PageToolbar, FocusPage, Workbench, DetailPage | UI and tokens                         |
| `@mechane-ai/elements/charts` | Generic selectable Waterfall                                     | UI, tokens, and visx                  |
| `@mechane-ai/elements/tokens` | Semantic visual tokens                                           | StyleX                                |

Only `console-data` crosses from the shared Effect client into browser Promises. It stores each bounded API response as
one reactive snapshot; it does not pretend one fetched page contains every entity. The server owns authorization and
persistence. No browser code imports Worker storage or installation secrets.

UI modules group controls, forms, typography, and data presentation by responsibility. A shared frame owns the 240-pixel
sidebar, its 48-pixel collapsed rail, and the mobile navigation drawer. Every screen uses the same 48-pixel toolbar;
screens supply its resource actions. Tables fill the main surface, while `DetailPage` centers forms and resource
details. Frame dimensions belong to layout; semantic colors and type roles belong to the tokens module. Base UI owns
button, select, tab, and dialog interactions. StyleX uses explicit border and outline longhands; the contract's syntax
check prevents unsupported shorthands from silently losing styles. The trace maps recorded requests into the generic
visx Waterfall. Turn events come from the existing durable event log, with indexed turn and inbox lookup; there is no
separate tracing store.

## Local development

From a configured checkout, `mise run dev` builds the complete release and starts a disposable celld fixture with fake
GitHub and a scripted model. Open the printed origin plus `/console`. `mise run start` uses retained local state and
real model credentials instead; see the [local guide](../packages/node/stack/README.md). Rebuild and restart the fixture
after changing the application or Worker.

For component development with hot reload, run `pnpm --filter @mechane/console storybook` from `workspaces/core`.
`pnpm --filter @mechane/console build-storybook` checks the isolated component build. The runner discovers component
stories beside their owning packages and screen stories inside the actual console frame. The
[component guide](components.md) explains selection, composition, and catalog review. Screen stories cover populated,
empty, loading, refresh-failure, and revision-conflict states. `mise run check` runs the repository checks and existing
runtime scenarios. Browser acceptance uses the built celld Worker, including authentication and actual API responses.

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
