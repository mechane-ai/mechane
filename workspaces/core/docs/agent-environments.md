# Agent environments

An agent is a named identity with one execution slot. Sessions using the same agent keep separate conversations, files
and pending tool calls. Threads within a session share its worker environment. Attach an explicit memory store when two
sessions need to share knowledge. The installation's sandbox and an external worker both implement the Managed Agents
environment work protocol.

The agent chooses commands and follows the repository's instructions. Mechane provides tools and current authority; it
does not prescribe coding, review, merge, or deployment stages.

## Access

An external worker polls an environment with its environment key. Each accepted work item grants a short-lived
credential for one session. The installed dispatcher delivers that credential to the session’s isolated guest. Public
session events, tool results, attached skills and memory use the same work protocol in both environments.

A workspace owner grants a named agent access for sessions opened by a specific workspace member or service principal.
The grant contains public variables and references to credentials already encrypted in that workspace. Use the managed
agent ID and the session creator’s principal ID when provisioning an installation. See
[Installed command access](./self-hosting.md#installed-command-access) for the CLI commands.

The installed worker checks its current lease before each Bash command. Rotating a referenced credential or revoking the
grant takes effect on the next command. Agents with delegated threads share a session computer, so those sessions
receive an empty command environment grant. External workers provision their own command credentials.

Configure application CLIs through their ordinary environment settings. In Softmax, the installation supplies Nexus CLI
and its service identity. Nexus owns application access, approval requests, and provider credential issuance. Mechane
does not contain a GitHub App issuer or a Nexus request-service adapter. Application scopes and provider token expiry
remain with that authority owner; GitHub repository protection still decides whether a merge is allowed.

Resolve references immediately before admitted dispatch. Durable execution state stores identifiers only. Credentials
are injected into the authorized command environment and redacted from retained output. Arbitrary granted code can copy
its credentials deliberately, so grant the intended authority rather than treating redaction as containment.

## Tools and files

The generic image includes the developer tools needed to clone, edit, test, and publish repositories, plus Chromium, a
display server, and media encoding. Repository pins remain authoritative. The standard Managed Agents toolset runs in
the installed worker. The native compute service also keeps process, browser and evidence receipts for installation
operators.

Nix runs as the guest user with flakes enabled. Its single-user store lives at `/nix`, outside the durable home; the
outer container owns isolation. Use the repository's flake or setup entrypoint for Bazel and other pinned toolchains.
The store is disposable and may be rebuilt after machine replacement. Installation and gateway certificate authorities
are projected into PEM and Java trust stores in scratch, including `NIX_SSL_CERT_FILE` and `JAVA_TOOL_OPTIONS`. Keep
certificate verification enabled when a tool downloads dependencies.

Configure installation-owned CLIs through `sandboxes.additional_tools` in the
[Cloudflare module](../infrastructure/modules/cloudflare/variables.tf). The
[tool manifest](../packages/shared/sandbox-wire/src/tools/schemas.ts) declares platform archives, SHA-256 digests,
executable paths, and expected version output. Bootstrap verifies the archive and executable before guest readiness. A
failed pin prevents startup. These verified tools live in machine scratch, lead the child `PATH`, and are installed
again on a fresh machine. Company CLIs such as Nexus remain explicit installation choices.

Use `sandboxes.web_access: "public"` for general browsing, or the default `packages` mode with explicit
`additional_hosts`. Both modes retain the outbound gateway. Public browsing does not authorize private destinations or
general access to the installation’s control plane. The gateway forwards the worker’s scoped operations only to the
installation’s canonical origin. The application checks the active lease and session on each request. Development
servers use loopback inside their own sandbox.

The installed worker starts in `/workspace`. Its backing directory lives under the guest home, so checkouts, uncommitted
changes and ordinary notes follow the session when its machine is replaced. Every thread in that session uses the same
files. A second session gets its own workspace, even when both sessions select the same agent and environment. The SDK
mounts attached memory stores outside the home. Installed sessions restore the portable home and load the session’s
current memory resources on the next allocation. External workers decide how to store and recover their own files.

A tool result can arrive before its files are saved. On graceful release the installed environment quiesces the worker,
commits the home and stops the machine. The next allocation restores the committed generation before starting the
worker. An abrupt machine loss can lose changes made since the last checkpoint. The environment report records the saved
generation, capture or restore progress, and any failure.

When you stop a persistent local stack or apply new environment source, the supervisor holds new launches and lets
active workers finish. It waits for their files to be saved and their machines to stop before replacing the host. A
failed save leaves the host available. The stack's `owner.json` identifies the session, allocation generation, and
reason so you can inspect its computer and retry the checkpoint.

Keep reproducible caches and build output in scratch locations; archive limits remain explicit. A failed save preserves
the previous committed generation and live files for recovery. Portable archives exclude browser profiles, cookies, and
private capture scratch.

A background save failure does not change a terminal command result. Historical persistence-failed receipts retain their
original status and any known exit code or timeout. Older receipts that omitted the outcome remain unknown; output text
is not evidence of an exit code.

The guest declares `MECHANE_CACHE_HOME` outside the home and supplies tool-specific npm, pnpm, uv, pip, mise, and Go
cache paths there. Pinned mise installs are reconstructed after machine replacement; source, lockfiles, configuration,
and Git metadata remain in the home. Repository build output needs its own declared scratch setting. Every other home
file is archived, including `.gitignore` entries and existing caches. Move only identified reproducible files during
explicit recovery; the runtime does not delete or exclude them. See the tools' directory settings for
[mise](https://mise.jdx.dev/directories.html), [pnpm](https://pnpm.io/pnpm-cli), and
[uv](https://docs.astral.sh/uv/concepts/cache/#cache-directory).

The portable home is bounded to a 2 GiB uncompressed tar stream and a 2 GiB gzip archive. Tar metadata and padding count
toward the first limit. Compression, splitting, transfer, and restoration buffer bounded parts, but saving and restoring
stage both the archive and its parts on disk. Allow home size plus twice the compressed size, as well as tools, caches,
build scratch, and filesystem overhead, when selecting the machine tier. Scratch outside the home still uses that
machine's disk. These bounds do not promise that every repository or build fits the selected environment. The
five-minute checkpoint and restore deadlines can also limit a home before it reaches the byte ceilings.

The guest and Worker share these limits. Roll them out together after committing the existing guest's files; a new
Worker cannot raise a limit compiled into an already-running guest. Older components may reject a new checkpoint at
their lower admission limit, even though archive and part formats are unchanged. Preserve unsaved live files before
replacing an older guest. Move only identified, reproducible data when recovery requires reducing its home first.

Checkpoint uploads and restoration use bounded parallel batches with separate limits. Each batch waits for every started
transfer to settle before advancing its fenced cursor or handling failure. Both paths validate part sizes and archive
metadata; restoration verifies the complete archive checksum. After capture, a background upload can proceed beside new
commands. A file barrier waits for its own complete generation. When investigating latency, record archive bytes,
transferred bytes, part count, and capture, upload, or restore time separately from command execution.

New generations publish an immutable manifest after their archive parts and before the head commits. Restoration
verifies that manifest's digest. Existing committed generations retain their original inline metadata and archive
verification. Cloudflare-native snapshots are not the portable-home authority and are not required locally.

Inspect the installed session’s workspace report for the stop phase, committed generation, transfer cursor, and recovery
action. A stop completes after the provider confirms the machine has gone. A failed final archive keeps the original
guest available for file repair while it is still alive.

For an installed session, read `GET /internal/managed/sessions/{sessionId}/computer/allocation` and the adjacent
`workspace` resource. A workspace owner can retry a failed final save while the allocation is releasing. POST its
observed `generation`, `machineId`, `recoveryGeneration`, and `committedGeneration` to
`…/computer/workspace/recovery-checkpoints/{operationId}`. Use GET on that same URL to follow the file repair. A changed
generation or a different guest returns HTTP 409. Normal session release resumes shutdown after the save.

A lost start acknowledgement rejoins the positively identified guest. A conflicting identity is refused. Application
restarts preserve the separate environment owner and its guest. If the environment host itself loses a guest during
restoration, its old partial-copy cursor cannot activate a replacement; the committed source remains preserved behind an
explicit recovery fence.

| Resource                           | Lifetime                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Committed home files               | Restore from the last committed generation after machine replacement.                                  |
| Managed process or browser session | Exists only on its original machine; saved files do not restore process memory or browser login.       |
| Ready screenshot or recording      | Remains in private evidence storage after machine replacement, independently of workspace generations. |

When a foreground command loses its result, inspect the affected branch, PR, deployment, or other external system before
repeating a write. A machine replacement can recover committed files and still leave the command’s outcome uncertain.

## Development servers

Inside SDK Bash, use `mechane-computer GET processes` to list servers and watchers. Start one with
`mechane-computer POST "processes/$id" '{"command":"make serve"}'`, using a new UUID for `id`. Save the returned machine
and process handle. Read that handle for state and bounded output, or stop its process group. The
[guest CLI documentation](../packages/node/guest/README.md#installed-session-computer) describes receipt polling.

An installed session records each process exit, stop, or loss together with its originating action, work ID, and lease
generation. To check an earlier process, read
`GET /internal/managed/sessions/{sessionId}/computer/completions/{processId}` with a workspace credential authorized for
that session. The collection at `…/computer/completions` returns the latest 20 receipts. Supply its `nextAfter` cursor
as `after` to read the next page. Reading receipts leaves the agent idle and preserves the machine's idle deadline. Use
the process handle to read bounded output.

Checkpoint status is reported separately. An exited process can have unsaved files. A later checkpoint failure preserves
the original exit code and work identity.

Managed processes receive the current granted environment at startup. Reads and stops do not renew credentials or prove
provider revocation. Later privileged work uses a fresh application operation and current authority. A running process
is not a promise that its startup credentials are still valid.

An installed process starts in the same `/workspace` directory as the SDK Bash tool, so a relative path names the same
checked-out file from either tool.

Running means the process started. Inspect its output and application response before treating it as ready. Exited
includes an exit code; Stopped records an explicit stop; Lost means the original machine cannot supply the process. Lost
work never restarts automatically. An incomplete log tail reports omitted bytes.

Background processes survive individual tool calls while the same guest runs. A status read leaves the worker’s idle
deadline unchanged. Inspect the existing handle after reconnecting. On ordinary release, the runtime quiesces the guest,
saves its home and shuts it down. Machine replacement starts new processes only when the agent requests them. An abrupt
loss can leave the files at the last committed generation. Check process receipts and checkpoint status separately when
diagnosing an interrupted task.

## Browser interaction

The same model operates Chromium beside its checkout and development server. Use the server's observed loopback URL. The
browser tools cover tabs, navigation, observed targets, clicks, typing, scrolling, keys, screenshots, recordings, and
bounded console/network diagnostics. Their argument schemas are linked from the native tool definitions.

Observe the page before selecting a target. References belong to that observation; refresh stale references rather than
guessing. Pixel clicks use the observed viewport. Omitted targets, logs, or image previews are reported explicitly. An
interrupted action with no confirmed result remains uncertain. Inspect the page and any external effect before choosing
a new action; recovering an activation does not prove a click failed.

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

A ready capture returns its signed-in Console link in `evidence.viewer_url`. To retrieve it later, run
`mechane-computer GET "evidence/$id"` and read `viewer_url`. Use that URL as proof in the PR. The link keeps the session
and capture identity when the machine is replaced. The recording descriptor reports measured duration, media type, size,
and checksum. Pending and failed captures have no downloadable media.

Reviewers sign in with a workspace identity authorized to read the capture’s session. The application Worker checks that
authority on each metadata and media read, including video ranges. Sign-in returns the reviewer to the linked capture.
Removing membership also removes access through a previously shared link. Provider uploads are separate application
operations with their own authority; a copied attachment follows that provider's access policy independently of this
original.

Use `mechane-computer GET "evidence/$id/content" > capture.png` to stream the stored original from an installed session;
choose the filename for its media type. Compare its checksum with the artifact metadata before publishing. For a
verified copy in the session’s home, use `mechane-computer POST "evidence/$id/export"`. It returns the stored file’s
path, SHA-256, media type, size, and machine ID. The exported copy joins the next home checkpoint. Removing that local
copy preserves the original in evidence storage.

Capture metadata identifies the original environment and native invocation, URL, time, dimensions, and digest. Supply
the inspected repository path when requesting Git provenance. The runtime records its actual head and dirty state, or
states that provenance is unavailable. A checkout head alone does not prove which revision a remote page serves.

Describe the interaction and observed outcome beside each link. Keep three claims separate: the capture was saved, the
required application checks passed, and the deployed revision was verified. A screenshot of a component fixture can
support a visual review without claiming production authentication, real data, or a complete end-to-end flow.

## Notifications and communication

The [notification guide](notifications.md) describes how an application starts a session or sends a follow-up. A session
can release the agent's execution slot while a person considers a tool request. Return the decision to the originating
session and call. Check current permission before a new external operation.

Read assistant replies from session events. Sending a Slack reply, reacting to a message or updating a PR requires an
explicit tool call to the configured CLI or MCP service. A completed turn does not publish to another application.

A durable receipt ties a previously admitted effect to its actual tool call. If a worker disconnects while an effect may
be running, inspect the receipt before repeating the operation. Keep uncertainty visible to the caller.

## Qualification

Before publishing a runtime, accept one built candidate with real Postgres and deterministic providers through the
[distribution owner](../packages/node/distribution/README.md). Its complete retained catalog exercises those exact
bytes. Separately qualify affected hosted capabilities, network policy, repositories, and credentials. A missing
required tool or environment capability is a visible limitation, never a passed suite.

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
