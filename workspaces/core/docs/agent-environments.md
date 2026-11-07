# Agent environments

A mech is a durable identity with memory, native conversation history, and a persistent developer environment. Slack and
the Console admit work to that identity. The runtime serializes a mech's executions because its tools share memory and
files. Different mechs can work independently.

The agent chooses commands and follows the repository's instructions. Mechane provides tools and current authority; it
does not prescribe coding, review, merge, or deployment stages.

## Access

A workspace owner writes a credential from a private file, then grants references and public variables to a mech:

```sh
mechane credential put application-agent --file /private/path/application-key
mechane execution-access show MECH_ID
```

Use `execution-access set` with the current
[grant schema](../packages/shared/protocol/src/operations/execution-access/schemas.ts). It separates GitHub identity,
public environment values, command secrets, and a host-only request service. Metadata reads contain references, never
secret values. Revoking a grant affects subsequent commands without broadening another credential to compensate.

For GitHub, configure the App, installation, repository, and signing-key reference. The runtime mints a
repository-scoped installation token and checks its returned permissions. `gh` receives `GH_TOKEN` and `GH_REPO`; git
receives only the transient credential path for that repository. The App private key stays in the host. GitHub branch
protection still determines whether a merge is permitted.

Configure application CLIs using their ordinary environment settings. Nexus uses `NEXUS_API_KEY` and `NEXUS_URL` in the
sandbox. Its request-service credential is a different host-only reference, with a stable Nexus service ID and
configured request collection. The model cannot choose the service URL, credential, callback destination, or requester.

Credentials are resolved inside trusted steps immediately before use. Workflow state stores references only. Injected
values are redacted from retained output. Arbitrary granted code can deliberately copy its credentials, so choose the
intended authority rather than treating redaction as a sandbox permission boundary.

## Tools and files

The generic image includes the developer tools needed to clone, edit, test, and publish repositories, plus Chromium, a
display server, and media encoding. Repository pins remain authoritative. The
[native tool definitions](../packages/node/runtime/src/tools/runtime-tools.ts) own current names and input shapes.

Configure installation-owned CLIs through `sandboxes.additional_tools` in the
[Cloudflare module](../infrastructure/modules/cloudflare/variables.tf). The
[tool manifest](../packages/shared/sandbox-wire/src/tools/schemas.ts) declares platform archives, SHA-256 digests,
executable paths, and expected version output. Bootstrap verifies the archive and executable before guest readiness. A
failed pin prevents startup. These verified tools live in machine scratch, lead the child `PATH`, and are installed
again on a fresh machine. Company CLIs such as Nexus remain explicit installation choices.

Use `sandboxes.web_access: "public"` for general browsing, or the default `packages` mode with explicit
`additional_hosts`. Both modes retain the outbound gateway. Public browsing does not authorize private destinations or
the installation's control plane. Development servers use loopback inside their own sandbox.

Memory tools read and update durable documents with version checks. Work tools record useful progress and verified
outcomes separately from conversation sessions. Remote tools come from the current owner-configured MCP connection and
grant. No tool can infer new authority from a remembered instruction.

The sandbox checkpoints its home files after a completed command. Keep reproducible dependency caches and build output
in scratch locations; file checkpoints have explicit archive limits. A failed checkpoint preserves the previous saved
generation and remains visible. Portable file archives exclude browser profiles, cookies, and private capture scratch.

| Resource                           | Lifetime                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Committed home files               | Restore from the last committed generation after machine replacement.                                  |
| Managed process or browser session | Exists only on its original machine; saved files do not restore process memory or browser login.       |
| Ready screenshot or recording      | Remains in private evidence storage after machine replacement, independently of workspace generations. |

Every command uses a stable execution ID. `bash_status` observes its receipt without resubmitting the command. If a
machine disappears before a receipt commits, the result stays uncertain. Check the remote branch, PR, deployment, or
other affected system before deciding whether to repeat an external write.

## Development servers

Use the managed-process tools for a server or watcher that must survive a tool result. Keep the returned machine and
process handle. List existing work before starting another server. Read a handle for its state and bounded output, or
stop its owned group. Reads and stops never start replacement work or mint another execution credential.

Managed processes receive their granted credentials at startup. GitHub installation tokens
[expire after one hour](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation).
An admitted background process does not renew that token, and stopping it later does not immediately revoke it. Run
later GitHub operations in a fresh command so they receive current authority. Foreground commands retain their terminal
token cleanup; definitely rejected or already-finished initial process starts also release their minted token.

Running means the process started. Inspect its output and application response before treating it as ready. Exited
includes an exit code; Stopped records an explicit stop; Lost means the original machine cannot supply the process. Lost
work never restarts automatically. An incomplete log tail reports omitted bytes.

Managed processes survive ordinary tool waits and native Workflow suspension while their machine remains alive. Explicit
tool activity renews the existing idle deadline; background execution and Console polling do not. On resume, inspect the
handle before deciding whether to start a replacement. Canceling a run stops the processes it started. Canceling a
dispatched foreground shell retires the machine, so other handles on that machine become Lost.

Ordinary checkpoints pause writers while copying the home, then resume them during upload. New mutations stay fenced
until generation release. Graceful drain takes a fresh snapshot and keeps writers paused until shutdown is confirmed. A
failed save retains recoverable live files and the previous head. Older guests keep their released checkpoint behavior
until their machine retires. Snapshots preserve files, not application transaction consistency.

The Console's Environment view passively observes existing handles. Expanding a process reads bounded logs; stopping it
targets that exact machine and process. An individual stop owns a process group. A child that creates another session
requires whole isolated-environment shutdown.

## Browser interaction

The same model operates Chromium beside its checkout and development server. Use the server's observed loopback URL. The
browser tools cover tabs, navigation, observed targets, clicks, typing, scrolling, keys, screenshots, recordings, and
bounded console/network diagnostics. Their argument schemas are linked from the native tool definitions.

Observe the page before selecting a target. References belong to that observation; refresh stale references rather than
guessing. Pixel clicks use the observed viewport. Omitted targets, logs, or image previews are reported explicitly. An
interrupted action with no confirmed result remains uncertain. Inspect the page and any external effect before choosing
a new action; replaying a workflow does not prove a click failed.

The private browser profile does not inherit a user's personal session. A Nexus CLI API key also does not by itself sign
the browser into Nexus. Use an application-supported agent login or an appropriate local fixture. Describe a Storybook
or synthetic-authentication check as synthetic coverage, and keep production authentication checks separate.

Chromium's sandbox stays enabled by default. An operator may set `sandboxes.browser_sandbox_disabled` explicitly after
qualifying the host; startup never silently retries with weaker isolation. The browser trusts the runtime's gateway
certificate without disabling TLS checks. Native desktop dialogs and human browser takeover are outside this interface.

## PR evidence

Explicit screenshot and recording tools save captures. Ordinary observations supply transient previews. The native tool
result includes actual image content when a bounded preview is available. Full images and videos stay outside the
conversation, in private R2 storage owned by the sandbox service.

A successful durable capture returns a Mechane viewer link. The capture's local scratch path lasts only while its
machine does. Use the viewer link in the PR through ordinary authorized `gh` commands. Recording limits bound encoded
duration and bytes; the descriptor reports measured media duration. Pending or failed evidence is not downloadable.

Reviewers must sign in with current workspace membership. The Node server checks membership on every metadata and media
read, including video ranges. A viewer link grants no access; sign-in returns to that evidence. Removing membership also
removes access through a previously shared link. Native GitHub attachments are not the selected App-token path.

Capture metadata identifies the original environment and native invocation, URL, time, dimensions, and digest. Supply
the inspected repository path when requesting Git provenance. The runtime records its actual head and dirty state, or
states that provenance is unavailable. A checkout head alone does not prove which revision a remote page serves.

Describe the interaction and observed outcome beside each link. Keep three claims separate: the capture was saved, the
required application checks passed, and the deployed revision was verified. A screenshot of a component fixture can
support a visual review without claiming production authentication, real data, or a complete end-to-end flow.

## Waiting

Nexus decides whether a capability is standing, automatically granted with notification, or subject to approval. The
runtime records the external request identity and registers its durable wait before a decision can arrive. Authenticated
decision events resume that work without another human message or a polling model call.

A ready event means access may be usable. Read the current Nexus request or collect the authorized token before acting.
Denial, cancellation, expiry, and changed service authority have explicit outcomes. A late event cannot reopen canceled
work. Original requester attribution and Slack destination remain fixed throughout the wait.

Use native Workflow waits for durable pauses. The SDK owns suspension and resumption; tracked work records describe
progress rather than recreating the former alarm scheduler. Keep active model and shell requests bounded.

## Qualification

Before publishing a runtime, run the compiled local smoke with real Postgres and deterministic providers. Separately
qualify the selected live image, network policy, repository, and credentials. A missing required tool or environment
capability is a visible limitation, never a passed suite.

Exercise process identity, cancellation, machine loss, and a live writer during checkpointing. Exercise browser controls
and native image output through the integrated tool boundary, then decode recordings and inspect their frames. Verify
private media access after membership removal, ranged playback, and a viewer link through sign-in. A host fixture or
synthetic provider does not qualify hosted containment or production browser authentication.

Earlier isolated browser and storage probes are supporting evidence for their components. They do not establish that the
integrated native runtime or its deployment passed. Record current acceptance in the delivery issue rather than turning
this guide into a release receipt.

The coding flow starts with a real Slack request and ends with a verified deployed revision in that thread. Keep the
checked PR head, merge, release, and deployed revision in the delivery work record. The repository owns its build and
release instructions; Mechane owns generic execution, identity, and durable recovery.
