---
name: developer-environments
message: Keep developer tools reproducible, files durable, and execution recovery independent of application-specific workflows.
paths: ["packages/shared/sandbox-wire/src/{constants,certificate-environment,schemas}.ts", "packages/node/guest/image/{Dockerfile,mechane,*.sh}", "packages/node/guest/src/{executions,archives}/**", "packages/node/guest/src/{certificate-environment,load-guest-settings,schemas}.ts", "packages/node/stack/**", "packages/node/testing/src/fixtures/command-gate.ts", "packages/worker/sandbox/src/{checkpoints,executions,providers,egress,workspace}/**", "packages/worker/sandbox/src/{constants,sandbox-object}.ts", "infrastructure/modules/cloudflare/**", "docs/agent-environments.md"]
---

## Rules

Keep the generic developer image in `node/guest/image`. Pin downloaded tools and verify architecture-specific checksums
before installing them. Use repository-owned setup for revision-specific dependencies. Company endpoints and agent
instructions belong to installation configuration, never the generic image or runtime.
Build the installed Mechane CLI from the same source as a portable Node artifact in that image.

Keep useful source, Git metadata, notes, and progress records in the committed home. Memory and work organization are
ordinary agent-managed files, not another runtime task or memory service. Keep internal model-context checkpoints in
the runtime store; their persistence does not establish file durability. Keep reproducible caches and build output outside
that home through explicit environment setup. Preserve existing files. Do not infer disposability from `.gitignore` or
silently exclude unknown files. Retain archive size limits and report failures instead of claiming files were committed.

Declare machine-local package caches and reinstallable tool versions through the guest's ordinary tool environment.
Keep source, lockfiles, configuration, Git metadata, and unknown files in the durable home. A fresh machine may rebuild
only those declared scratch locations. Existing home files remain data until an explicit recovery operation moves them.

Keep the expanded and compressed checkpoint bounds in the shared sandbox wire constants used by the guest and Worker.
Qualify a capacity change against streaming memory, home plus archive staging disk, part counts, and existing operation
deadlines on the selected machine tier. Scratch outside the home still consumes that machine's disk. Preserve unsaved
files before replacing a guest with older compiled limits; deploying a new Worker does not change that guest's bounds.

Advance checkpoint uploads in bounded batches of at most four concurrent parts. Give each batch one captured generation,
writer machine, and starting durable cursor. Settle every started part before reporting a transfer failure, releasing
the writer, or changing the cursor. Recheck that exact captured identity and cursor before advancing the whole batch,
and advance only when every part succeeded. Keep the persisted part format, per-part validation, and interruption
reconciliation through immutable stored parts. Buffer at most four upload parts at a time.
Keep restoration copies sequential and buffer one part at a time. Reload the current restoration after each awaited
part; stop when its identity changes, progress stalls, or an operation fails. Bound both parts per call and the time
allowed to start another upload batch or restoration part. An in-flight transfer retains its existing timeout.
Create archive parts and the complete generation manifest immutably. Publish the manifest only after all parts exist,
then fence and atomically commit its digest, the head, and any command receipt. A delayed upload cannot revive a canceled
generation. Verify a referenced manifest before restoring its files. Preserve older committed inline metadata as
historical data; do not fabricate a manifest commitment for it.
Commit the complete generation and command receipt atomically, or activate a fully verified restoration, after the last
part without requiring another polling round. A batch boundary never establishes completion by itself.

Keep guest command duration distinct from time spent saving or restoring files. Performance evidence names archive
bytes, part count, and the measured boundary. Faster transfer scheduling cannot weaken the committed-file guarantee.

Supply additional HTTPS hosts through validated installation settings. Preserve authority validation, the private-network
boundary, and TLS verification. The gateway injects no credential and follows no redirect. Each redirect destination
must pass its own admission.

Supply additional certificate-authority trust as bounded public PEM through trusted guest startup composition. Validate
it before readiness and combine it with public roots and a gateway CA injected after startup. Keep generated trust files
in machine scratch. Preserve TLS verification; certificate trust cannot come from model tool arguments or a per-stack
certificate baked into the generic image.

Route local guest API calls and registered fixture requests through one retained, CA-verified HTTPS gateway. Configure
native host-service access for only that gateway port before starting the environment host. Application code and guest
startup arguments cannot broaden that declaration. Register fixture handlers under server-chosen opaque paths; never
proxy an arbitrary guest-supplied host URL. Keep the gateway and guest alive across application reloads.

Stop the environment owner and revoke its grant before releasing the gateway port. Reconcile retained ownership after
unclean exit before port reuse. Require native Linux bridge reachability and default-denial evidence. Record the actual
macOS Docker backend and its host-forwarding limits; local checks do not establish equivalent Linux or hosted isolation.

Inspect persisted local storage without changing its privacy assertions. Acquire, read and release one SQLite family
before acquiring another, with bounded native lock waiting. Hold the read transaction through enumeration and the
raw database and observed WAL reads. Read raw main-file bytes in a separate process because a descriptor close in
the reader process releases same-file POSIX locks from overlapping inspections. Keep partial file bytes out of read
errors. Exclude only identified native SHM coordination files. Inspect user files with similar names. Missing durable
files and locks that exceed the bound remain failures. A raw scan is not one global storage snapshot.

Observe an existing execution without resubmitting its command or requiring a serialized credential. Preserve execution
identity across transport retries. A missing receipt after a lost machine remains uncertain; never automatically rerun
an arbitrary command to reconstruct its output.

Rejoin a starting provider instance only with positive evidence of its original machine identity. A running flag alone
does not prove that identity or guest readiness. A lost start acknowledgement cannot destroy the matching instance or
restart its bootstrap. Refuse a conflicting start or stop without replacing the existing guest.
Keep restoration progress bound to its physical guest. If that guest is lost after a partial copy, preserve the committed
source and fence the never-dispatched command. Do not apply its advanced cursor to a newly created instance. Whole local
environment-host loss may destroy its guest; application-host replacement must preserve the separate environment owner.

Qualify a real checkout on the selected hosted environment before describing that environment as able to build and ship
it. Required checks remain required. A missing Docker capability is an explicit qualification failure, not a passed
suite. Generic execution cannot establish exactly-once external writes or prove production from an assistant reply.

## Checks

Build the image and inspect pinned tool versions. Run the existing command-recovery and file-restoration smoke cases.
For a new workload, record source revision, commands, checkpoint size, restart results, and required-check outcomes in
the deployment work record. Inspect network configuration for company-specific values and review observation requests
for command bodies. Live release proof names the checked PR head, merge, workflow run, and observed deployed revision.
Exercise a multipart save and restoration across batch boundaries. Hold one upload while its siblings finish, fail one
while another is held, and cancel the captured generation while parts are in flight. Require all started work to settle
before failure cleanup, and require the unchanged batch cursor until every part succeeds under its original fence.
Interrupt after immutable parts are stored and reuse them on reconciliation. Verify restored files and the absence of
a premature manifest, terminal receipt, or activated partial home. Check batch limits without treating a timing sample
as a latency promise.
For a raised capacity, save and restore a home exceeding the former bound, and retain explicit failures above each new
bound. Establish the tar-stream size from actual written data; a sparse file's logical length alone is insufficient.
Qualify a representative compressed archive near the accepted maximum separately from ordinary small smoke
fixtures. Record actual workload size and machine disk headroom; a local transfer measurement is not hosted qualification.

Run the production sandbox and guest owners through celld with a real Docker container for local qualification. Reload
the application without replacing that guest, then destroy and restore the actual container. Record container identity,
durable file results, multipart size, and explicit cache reconstruction. Process-scope fixtures do not qualify container
isolation. Local direct networking is an explicit platform composition and cannot establish hosted egress enforcement.
Exercise the ordinary guest CLI and command gate through the retained gateway on native Linux and a supported macOS
Docker backend. On Linux, reject undeclared host-service ports, verify one stack's cleanup preserves another stack's
grant, and confirm guest startup cannot widen native access. Reject arbitrary fixture destinations on both platforms.
Keep failure diagnostics bounded to known identities, phases, statuses and counts before cleanup, without commands,
message bodies, output or credentials.
Finish one live SQLite inspection while another still needs its observed WAL. Verify that the remaining scan reads
the main file and WAL bytes. Confirm that an interrupted raw read reports its error without captured bytes.
Exercise both archive limits and require the diagnostic to identify the measured representation, observed bytes, and
limit while preserving the previous head and recoverable live files.
Exercise installed CLI startup and actual Node, curl, and git HTTPS verification. Require rejection without the supplied
CA, acceptance with trusted startup configuration, and retained acceptance of both authorities after a late gateway CA.
Lose the HTTP start acknowledgement while real bootstrap is held, then rejoin the same machine and require the exact
container identity, one bootstrap, and one command effect. Reject conflicting start and stop identities. Lose a guest
after two restored parts; require a full fresh restore or an explicit recovery fence with the committed source intact.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
