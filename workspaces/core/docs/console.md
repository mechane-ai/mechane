# Mechane Console

Open `/console` on the installation and sign in with its configured GitHub identity. The Console uses the same workspace
membership as the CLI. It neither creates a browser API key nor grants installation administration.

The signed-out page is a standalone entrance. An explicit workspace URL wins after sign-in, followed by a valid
remembered choice. Without either, a single shared workspace opens before Personal; several shared workspaces open a
chooser.

The sidebar separates Overview, Pinned, and Recent. Recent shows the last five unpinned mechs you opened. Preferences
and shortcuts belong to your account and workspace in this browser. Account settings contain documentation and software
notices under About.

## A mech's views

**Conversation** is the public exchange between Console operators and the mech. An operator submission becomes a durable
notification. An agent reply appears only when the mech explicitly calls `console_message`, optionally with a structured
presentation. Private model text and tool steps do not stream into this conversation. An activation can finish quietly.

**Activity** separates notifications and events from bounded activations. A notification receipt proves accepted input;
it does not promise a new activation or a reply. One activation can consume multiple notifications. Historical source
messages and execution events remain inspectable without a separate session selector or source-specific live agent.

**Environment** shows the last saved file checkpoint, its recorded capture time, pending upload, and save or recovery
errors beside the mech's processes. Commands can finish before files are saved; background writes can be newer than the
captured checkpoint. Reads do not wake a machine or extend its lease. A process Stop targets its exact handle. Notes,
plans, and memory are ordinary durable home files, not separate work or memory CRUD views. Settings holds the
definition, appearance, grants, and lifecycle controls.

Mech and activation rows use full-row links and keyboard focus. Open a trace in another tab, or use Back to return to
the row and reading position. Trace inspection fills the page and temporarily hides workspace navigation without
changing your saved sidebar preference. It preserves the conversation, draft, and original return destination.

## Evidence

An activation trace shows recorded outcomes, model requests, safe tool projections, and events. Quiet completion has no
implied public reply. Preserved historical replies remain linked to their exact event. Tool completion and command exit
are distinct: a returned command with a nonzero exit is still a failed command.

Native traces describe Pi and actor execution. Imported traces carry historical provenance and an evidence notice;
reading or importing an old receipt does not execute its tool again.

The request waterfall shows reservation-to-settlement intervals, not exact provider inference time. Missing usage
remains unknown. A tool duration needs both recorded endpoints. Raw credential-bearing arguments do not enter the
browser. Missing, unavailable, and truncated evidence remain labeled across trace views.

Select a request or event without losing the original return destination. Copying a link preserves the selected record
for viewers with current workspace membership. A direct trace link returns to its mech. Evidence media uses a full-page
viewer with the same return behavior and fresh server authorization.

## Loading and drafts

Initial layouts reserve the eventual content geometry. The shared loading boundary delays decoration and keeps the
composer in place. Usable content remains mounted during refresh. Refresh failure keeps the last authorized result and
offers retry; access loss clears protected content.

Only an acknowledged submission clears its submitted draft. Rejected or uncertain sends retain text and request
identity. A late history response cannot clear a later draft or erase a newer receipt. Reading older messages does not
hide current activity or cause new text to pull the reader away from their anchor. Return-to-latest is explicit.

Drafts and public conversation history survive run inspection and recent mech navigation within the admitted scope.
Switching account or workspace disposes protected content and fences pending completions. Local cache recovery replaces
cached resources without resending a command or discarding an acknowledged result.

## Package ownership

| Owner                  | Responsibility                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `console`              | Routes, composition, drafts, public conversation lifetime, and navigation              |
| `console-data`         | Admission, Query read lifecycles, canonical records, exact page receipts, and commands |
| `console-cache`        | Native browser persistence, scoped generations, recovery, and cleanup                  |
| `console-views`        | Mech, conversation, activity, environment, and trace presentation                      |
| `@mechane-ai/elements` | Shared controls, visual roles, layouts, charts, and content rendering                  |

Only `console-data` crosses from the shared Effect client into browser Promises. Native Query observers own demanded
reads and refresh. Canonical TanStack DB collections retain admitted resource records and exact page membership. One
fetched page never implies the complete dataset. Native browser persistence owns cross-tab record replication.

Public conversation history is the narrow exception to canonical persistence. Its Query observer lives in
`console-data/src/conversation.ts`; the admitted conversation owner merges authorized pages in memory by stable message
identity. There is no competing native Chat transcript and no public projection of the active model stream. Other
resource records use the normal canonical path. [Contract 113](../.contracts/113-console-boundaries/CONTRACT.md) defines
these boundaries and [contract 119](../.contracts/119-console-cache-lifecycle/CONTRACT.md) defines cache recovery.

### Add a view

Add a resource's encoded row, canonical table, bounded request, ingestion, and readiness checks in the existing data
modules. Compose it with shared live reads and `ResourceView`. Keep filters and cursor inputs in interaction state; keep
fetched record pages out of screen state and Query results. Commands settle from API acknowledgment and refresh
canonical data through the same owner.

The shared frame owns outer geometry and separators. Tables fill the content surface and cells own their insets.
Conversation prose has a reading width. Detail forms use the shared detail container. Base UI owns interaction, StyleX
owns appearance, and the generic waterfall owns measured trace geometry.

Run browser types and import boundaries, then inspect the built application with delayed reads, failed refresh, empty
history, switching mechs, pending sends, and full-page trace return. Static checks establish ownership; the browser
establishes the assembled experience.

## Local development

`mise run dev` starts a retained celld application Worker, separate environment host, real Docker guests, and verified
TLS Postgres. Default HTTP fixtures provide local identity and scripted models. Console HMR and watched Worker source
reload preserve the guest. Open the printed origin plus `/console`.

Select model and GitHub providers independently at start with `--model=fixture|live` and `--github=fixture|live`. Live
providers require their runtime settings. Environment and guest source changes use explicit apply; application reload
remains automatic. The [local guide](../packages/node/stack/README.md) owns qualified celld selection, setup, and
service lifetime.

From `workspaces/core`, `pnpm --filter @mechane/console storybook` provides component development and
`pnpm --filter @mechane/console build-storybook` checks its isolated build. Stories compose the same components and
frame as the application. The [component guide](components.md) owns catalog usage. Runtime acceptance uses the compiled
Worker, real authentication boundaries, and deterministic providers.

## Release

The Console ships in the application's immutable Worker release, with verified asset inventory and dependency notices.
The Worker serves it through `ASSETS` at the installation's origin. It has no separate deployment or browser secret
configuration. `/api/v1` owns domain operations and `/console` owns assets; a missing API never returns the application
shell. HTML is uncached and hashed assets are immutable.
