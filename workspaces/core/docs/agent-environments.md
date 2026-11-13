# Agent environments

A mech is a persistent identity with working context and a developer environment. Generic notifications bring it new
input. One active model owner protects that context and shared files; different mechs work independently. An activation
is a bounded Pi execution within that identity, not a separate task for each notification.

The agent chooses commands and follows the repository's instructions. Mechane provides tools and current authority; it
does not prescribe coding, review, merge, or deployment stages.

## Access

A workspace owner writes a credential from a private file, then grants references and public variables to a mech:

```sh
mechane credential put application-agent --file /private/path/application-key
mechane execution-access show MECH_ID
```

Use `execution-access set` with the current
[grant schema](../packages/shared/protocol/src/operations/execution-access/schemas.ts). Grants contain public
environment variables and encrypted credential references. Metadata exposes references only. Revocation affects
subsequent dispatch without selecting a broader credential to compensate.

Configure application CLIs through their ordinary environment settings. In Softmax, the installation supplies Nexus CLI
and its service identity. Nexus owns application access, approval requests, and provider credential issuance. Mechane
does not contain a GitHub App issuer or a Nexus request-service adapter. Application scopes and provider token expiry
remain with that authority owner; GitHub repository protection still decides whether a merge is allowed.

Resolve references immediately before admitted dispatch. Durable execution state stores identifiers only. Credentials
are injected into the authorized command environment and redacted from retained output. Arbitrary granted code can copy
its credentials deliberately, so grant the intended authority rather than treating redaction as containment.

## Tools and files

The generic image includes the developer tools needed to clone, edit, test, and publish repositories, plus Chromium, a
display server, and media encoding. Repository pins remain authoritative. The
[native tool definitions](../packages/worker/runtime/src/tools/runtime-tools.ts) own current names and input shapes.

Configure installation-owned CLIs through `sandboxes.additional_tools` in the
[Cloudflare module](../infrastructure/modules/cloudflare/variables.tf). The
[tool manifest](../packages/shared/sandbox-wire/src/tools/schemas.ts) declares platform archives, SHA-256 digests,
executable paths, and expected version output. Bootstrap verifies the archive and executable before guest readiness. A
failed pin prevents startup. These verified tools live in machine scratch, lead the child `PATH`, and are installed
again on a fresh machine. Company CLIs such as Nexus remain explicit installation choices.

Use `sandboxes.web_access: "public"` for general browsing, or the default `packages` mode with explicit
`additional_hosts`. Both modes retain the outbound gateway. Public browsing does not authorize private destinations or
the installation's control plane. Development servers use loopback inside their own sandbox.

Use ordinary files in the durable home for notes, plans, and progress. The installation can recommend a layout without
adding a runtime task or memory service. Internal model-context checkpoints are distinct from those files. Remote tools
come from current owner-configured MCP connections and grants. Remembered instructions cannot expand authority.

A terminal foreground result records the shell's exit code or timeout and bounded output durably. It does not wait for a
remote home upload. Automatic file checkpoints coalesce changes in the background and yield to new foreground work.
Native activation completion does not itself save every file or end managed processes. Explicit file barriers and
graceful shutdown still wait for a fresh committed generation.

The environment report shows the last committed head separately from automatic capture, upload, and failure status. Its
[durability schema](../packages/shared/sandbox-wire/src/environment-state.ts) distinguishes observed activity from the
captured activity of that saved head. A saved head describes files at capture time, not every later write. Automatic
cadence is not a recovery-point guarantee; a lost machine can lose unsaved changes. Activity records admitted work, not
a filesystem watch. An already-running process can write after capture without a new dispatch, so equal activity
sequences do not mean that every live file is saved. Status reads do not create activity.

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

Stop acknowledges a durable operation ID with HTTP 202. Inspect that ID or the workspace report for requested, waiting
for commands, checkpointing, stopping, completed, or failed state. Inspection includes the committed generation,
transfer cursor, recovery files, bounded last error, and a recovery action. A failed save preserves live files; a failed
provider stop retains the final drain and retries its original identity. Completed confirms shutdown. Repeating Stop
does not erase the failure or imply that an earlier head contains later writes. The activation checkpoint route also
supports a passive receipt GET. It cannot advance a pending save or allocate a guest; an unknown operation returns 404.

For a failed save on the original quiet, ready guest, an operator can request a file-only checkpoint retry through the
authenticated environment service. The request names the observed machine, recovery generation, and committed head.
Changed observations or active work are refused. It preserves live files, the old head, and the original failure until a
complete new generation commits. A successful repair resumes a retained Stop through its normal final drain; it does not
clear a model or tool admission fence. This operation never runs a shell or adds a command completion notice.

A lost start acknowledgement rejoins the positively identified guest. A conflicting identity is refused. Application
restarts preserve the separate environment owner and its guest. If the environment host itself loses a guest during
restoration, its old partial-copy cursor cannot activate a replacement; the committed source remains preserved behind an
explicit recovery fence.

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

Terminal environment results enter a durable sandbox outbox in the same operation that records the outcome. The sandbox
retries delivery after interruption, keeping the original execution identity. The runtime authenticates the callback,
checks its workspace and mech against the persisted execution, and compares the authoritative terminal receipt before
admitting a generic notification. Reading that receipt neither allocates compute nor extends the machine's idle
deadline. If the original tool already retained the matching terminal outcome, the callback is acknowledged without a
redundant inbox notice. A completed process-start receipt can still describe a running process; its later exit or loss
produces a notification. A callback racing a pending active start waits through transport retry. Detached, uncertain, or
abandoned pending execution still produces its completion notification.

A terminal result, a saved home, and notification acceptance are separate facts. An exited process may have unsaved
background writes. A failed file save cannot rewrite a completed command. The notification includes correlation and
status; the agent chooses whether to read output or send a message through its tools.

Managed processes receive the current granted environment at startup. Reads and stops do not renew credentials or prove
provider revocation. Later privileged work uses a fresh application operation and current authority. A running process
is not a promise that its startup credentials are still valid.

Running means the process started. Inspect its output and application response before treating it as ready. Exited
includes an exit code; Stopped records an explicit stop; Lost means the original machine cannot supply the process. Lost
work never restarts automatically. An incomplete log tail reports omitted bytes.

Managed processes survive ordinary tool waits and activation completion while their machine remains alive. Explicit tool
activity renews the existing idle deadline; background execution and Console polling do not. On resume, inspect the
handle before deciding whether to start a replacement. Explicitly canceling an activation stops the processes it
started. Canceling a dispatched foreground shell retires the machine, so other handles on that machine become Lost.

Automatic checkpoints pause writers while copying the home, then resume them and release foreground admission during
upload. They share one in-flight owner and coalesce later activity. Graceful drain takes a fresh snapshot and keeps
writers paused until shutdown is confirmed. A failed save retains recoverable live files and the previous head.
Snapshots preserve files, not application transaction consistency.

After machine loss, an earlier saved head does not prove that newer background writes survived. A barrier with no live
machine accepts that head only with matching committed drain evidence from the latest machine that became ready.
Never-ready startup attempts neither create file-loss evidence nor hide earlier loss. Missing proof leaves an explicit
failure and fences ordinary replacement allocation.

The agent can inspect receipts and report the loss. An explicit upgrade can restore the last committed generation when
no checkpoint or recovery remains pending. Restoring older saved files does not establish that the lost machine's newer
writes survived. An environment with no previously ready machine can use its immutable imported files.

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

A successful durable capture returns a Mechane viewer link. The capture's local scratch path lasts only while its
machine does. Use the viewer link in the PR through ordinary authorized `gh` commands. Recording limits bound encoded
duration and bytes; the descriptor reports measured media duration. Pending or failed evidence is not downloadable.

Reviewers must sign in with current workspace membership. The application Worker checks membership on every metadata and
media read, including video ranges. A viewer link grants no access; sign-in returns to that evidence. Removing
membership also removes access through a previously shared link. Provider uploads are separate application operations
with their own authority; a copied attachment follows that provider's access policy independently of this original.

Use `export_evidence` with the ready artifact ID when a CLI needs actual media bytes. It copies the saved original into
`.mechane-evidence` under the current home and returns its absolute path, SHA-256, media type, size, and machine ID. It
does not open Chromium, capture a changed page, or publish anything. Only this mech's ready artifacts are available.
Ordinary shell commands can consume the returned file. Use the supplied digest when preparing an upload manifest.

A confirmed copy is available on that machine; it joins the normal home checkpoint. Copy completion alone does not prove
that a checkpoint committed. After machine replacement, call `export_evidence` again to copy the durable original.
Repeating an interrupted copy is safe. Remove exported copies when no longer needed to keep home snapshots small;
removing a local file does not delete the original saved evidence.

Capture metadata identifies the original environment and native invocation, URL, time, dimensions, and digest. Supply
the inspected repository path when requesting Git provenance. The runtime records its actual head and dirty state, or
states that provenance is unavailable. A checkout head alone does not prove which revision a remote page serves.

Describe the interaction and observed outcome beside each link. Keep three claims separate: the capture was saved, the
required application checks passed, and the deployed revision was verified. A screenshot of a component fixture can
support a visual review without claiming production authentication, real data, or a complete end-to-end flow.

## Notifications and communication

The [notification guide](notifications.md) describes generic admission and service producers. The agent can handle other
input while an application request awaits approval. Its decision arrives as another notification, which carries
correlation but no implied tool result. The agent reads current permission and relevance before a fresh operation.

Use explicit tools for every outward message or reaction. Slack tools belong to the configured application CLI or MCP
service. `console_message` publishes to the current mech's public Console conversation. Native final text and quiet
completion do not send a response. Instructions can recommend acknowledgment without adding runtime delivery behavior.

A new notification can arrive after a model decides on a command. Before a new effect, the runtime checks the presented
notification watermark and current owner. A `not_started` result asks the model to reconsider with current context
without launching the command. Previously admitted effects retain their original receipts and must be observed honestly.

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
