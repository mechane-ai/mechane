# Mechane Console

Open `/console` on the installation and sign in with its configured GitHub identity. The Console uses the same workspace
membership as the CLI. It neither creates a browser API key nor grants installation administration.

The signed-out page is a standalone entrance. An explicit workspace URL wins after sign-in, followed by a valid
remembered choice. Without either, a single shared workspace opens before Personal; several shared workspaces open a
chooser.

## Working with an agent

Under **Overview → Agents**, open an agent to see its sessions. A session is one conversation with that agent. Choose
**New session** to select an environment, optionally give the session a title, and send its first message. If you need
another self-hosted environment, you can create its definition from the same form. The directory also offers **New
agent**. Pinned and Recent are shortcuts to agents in the current workspace and browser account.

Choose **Archive session** on an idle session to end it and remove it from the session list. Its direct link still opens
the conversation. **Archive agent** removes an agent from the directory and leaves its existing sessions available. Both
actions ask you to confirm the selected name.

The session list reports each session’s public lifecycle status. **Working now** identifies the session currently using
the agent’s execution slot when the private attention read is available. A session can be waiting for a tool decision
while the same agent works in another session. Opening a conversation selects what you read. Sending a message or
confirming a pending tool call can give the agent more work.

The transcript shows public user and agent messages, tool activity, and session events. A thread selector opens the
events for one thread. Compose messages in the session conversation. Where the current session is waiting for a tool
confirmation, the transcript offers the decision on the corresponding call. The composer also offers an interrupt while
the session is running or rescheduling. An external action such as posting to Slack still requires a tool call.

Agent and session links include the workspace in the path. A session opens at
`/console/workspaces/:workspaceId/agents/:agentId/sessions/:sessionId`. A `thread` query parameter selects a thread.
Pagination follows the service’s opaque cursors. Reopening a link reads the selected records under the viewer’s current
workspace membership.

Select **Evidence** in a session to see its browser screenshots and recordings. Open a capture to see its status, media
and recorded execution origin. **Copy link** opens the same capture for someone with access to that session. **Back to
evidence** returns to the capture list. **Back to session** restores the conversation you were reading.

## Archived diagnostics and evidence

Workspace owners can open **Settings → Archived mechs** at `/console/workspaces/:workspaceId/archives`. Each row opens
the mech’s read-only Archive, including historical messages, recorded Markdown, and structured cards. Select a recorded
message’s run link to inspect its execution. Older and Newer follow archive pages.

Historical mech links also provide Runs, Events, and Environment. A run opens full-page inspection of the recorded
outcome, model requests, tool activity, events, and captures. The request waterfall measures reservation to settlement.
Missing usage, truncated data, and imported history retain their provenance. Command exit and tool completion have
distinct outcomes.

Archived captures open at `/console/workspaces/:workspaceId/mechs/:mechId/evidence/:artifactId`. A direct link can
return to the recorded run. Media requires fresh authorization. A capture documents what the process observed at that
point.

Environment displays recorded checkpoint and recovery information alongside process summaries. Expand a process to read
its bounded output. A Stop action targets the recorded machine and process handle. Reading diagnostics leaves machine
lifetime and workspace contents alone.

## Loading and drafts

The loading boundary delays placeholders during short reads and renders the view’s placeholder during longer waits.
Refreshes can keep an authorized result visible. Error and access states belong to the resource being read.

Drafts stay in the admitted workspace’s in-memory owner, keyed by agent, session, and selected thread. Switching
sessions preserves unfinished text. If an earlier submission succeeds while the author is editing, only the submitted
draft clears. Failed sends retain the text. When delivery is uncertain, check the conversation before sending again.
Reloading a link restores server history; unsent text lives in the open browser application.

## Adding a screen or feature

| Owner                  | Responsibility                                                              |
| ---------------------- | --------------------------------------------------------------------------- |
| `console`              | Routes, navigation, command interaction, and drafts                         |
| `console-data`         | Admission, SDK calls, read lifecycles, record ingestion, and commands       |
| `console-cache`        | Native browser persistence, scoped generations, recovery, and disposal      |
| `console-views`        | Presentation of supplied agents, sessions, threads, events, and diagnostics |
| `@mechane-ai/elements` | Shared controls, layouts, charts, and content rendering                     |

Start with the resource’s owner. Managed resources use the official Anthropic SDK through the same-origin Console
gateway. Store resource summaries and exact page membership in TanStack DB. Keep session and thread events and the
agent’s current execution slot in tab-owned queries. A transcript subscribes to its event stream and reconciles
committed events with authorized history. Native diagnostics use their scoped catalog operations. The data package owns
both transports.

Compose established views with live reads and `ResourceView`. Screens own selections, drafts, and command feedback. Use
server acknowledgments to settle commands. A page refresh can fail after a command has already succeeded. Exercise
navigation between two sessions during a send, thread inspection, reloading a selected page, and returning from a
capture in the built application. See the [Console boundaries](../.contracts/113-console-boundaries/CONTRACT.md) and
[cache lifecycle](../.contracts/119-console-cache-lifecycle/CONTRACT.md) contracts.

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
The Worker serves `/console` through `ASSETS` at the installation’s origin. Public SDK clients use `/v1`. The browser
uses its session cookie at `/console-api/v1` for Managed Agents and the installation’s scoped endpoints for native
diagnostics and authentication. HTML is uncached and hashed assets are immutable.
