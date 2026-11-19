---
name: managed-processes
message: Keep managed processes bound to their original machine and preserve files when checkpointing or stopping them.
paths: ["packages/shared/sandbox-wire/**", "packages/shared/protocol/src/operations/environment/**", "packages/worker/runtime/src/tools/**", "packages/worker/runtime/src/operations/environment.ts", "packages/worker/runtime/src/execution/completion.ts", "packages/worker/server/src/sandboxes/completion.ts", "packages/worker/sandbox/src/**", "packages/worker/sandbox/src/service/**", "packages/worker/sandbox-store/src/**", "packages/node/guest/src/**", "packages/node/guest/image/Dockerfile", "packages/browser/console/src/screens/environment.tsx", "packages/browser/console-views/src/{environment,environment-durability}.tsx"]
---

## Rules

Record a stable start intent and its assigned machine before dispatch. Bind the process handle to that machine for its
whole lifetime. Reject changed inputs under the same identity. Rejoin an accepted start; never restart a lost process
on a replacement machine. Read, list, and stop observe existing identities without allocating compute or credentials.
Derive tool process identities in one parts-taking helper and retain the native run and tool-call identity separately in the intent.

Distinguish Running, Exited, Stopped, and Lost. A start acknowledgement proves neither application readiness nor a saved
workspace. Keep bounded, redacted output and report omitted bytes. Preserve the last known output when a machine is lost.
Once terminal, a process cannot become running again through a delayed observation. Return the committed observation
after merging a guest response, so concurrent cancellation cannot expose a stale Running result or duplicate handle.

The installed session's computer owns its background process receipts. Record the authorized workspace, environment,
session, work ID, lease generation and action ID when claiming the process. Preserve that origin through machine
replacement. Derive it from the admitted work credential and session binding. Exclude credentials and shell output.
Reject a replay that changes the command or origin. A later lease can inspect the original outcome.
Start an installed background process in the SDK Bash workspace so relative paths identify the same files in both tools.

Commit the terminal outcome and its receipt in one storage operation. Read one receipt by its process ID and list
recent receipts using a bounded cursor. Reading an outcome must preserve the session's scheduling state, machine
allocation, and idle deadline. Keep provider events and explicit external messages under their existing owners.

Preserve outstanding completion entries for earlier executions in their original storage. Acknowledge an external
recipient only after it confirms receipt. Never attribute an earlier entry to an installed session simply because
both use the same underlying database schema.

Retain a known foreground exit code or timeout when saving its files fails. File status reports the save failure
separately without changing that terminal outcome. Historical failure records that omitted the outcome remain
explicitly unknown; a background checkpoint cannot rewrite them or turn their failed receipt into success.

Run the guest under an unprivileged container init that reaps orphaned children, forwards signals and preserves exit
status.

Own each process group in the guest scope. Stop that group when its leader exits, on explicit stop, or on guest shutdown.
Preserve processes across ordinary tool waits and bounded activation completion while their machine remains alive.
Explicit activation cancellation stops processes started by that activation. A child that creates another session is outside an individual group-stop guarantee; only isolated-environment
shutdown or permanent container quiescence owns those escaped sessions.
Persist run cancellation before stopping its work. Late starts and browser actions from that run cannot dispatch.
Cancelling a dispatched foreground shell retains its existing whole-machine retirement boundary. Other managed handles
on that machine become Lost; they do not restart implicitly. Individual managed-process stop preserves other handles.

Freeze new mutations before creating a workspace snapshot. In container scope, pause writers to a verified fixed point
using process identities that distinguish PID reuse. In host process scope, touch only owned groups. Preserve an existing
stop and resume only processes this snapshot paused. Bound failure and release an unsuccessful freeze for recovery.

For an automatic checkpoint, coalesce requests under one owner and yield to foreground work before capture. Resume
writers and release mutating admission once the immutable archive is complete. Uploading that archive can proceed
beside later commands; its committed head represents the captured files, not every later write.
Required file barriers wait for their complete generation rather than returning a command's earlier terminal receipt.
For a graceful drain, take a fresh final checkpoint and keep writers frozen until provider stop is confirmed.
Bound both the uncompressed tar stream and compressed archive to 2 GiB. Keep transfers part-bounded and retain their
operation deadlines; the byte ceilings do not guarantee that every archive finishes within the deadline.
When a request for an immutable part of a pending required checkpoint loses its connection before headers arrive,
retry once under the same machine, generation, batch fence and operation deadline. A guest rejection or invalid archive
data fails the save. The retry retains the checkpoint, its writer and its committed head. If a restore activation loses
its response, poll the same guest and generation within the original startup deadline.

Preserve live files and the previous committed head after a failed save. A failed provider stop retains the drain fence
and capacity ownership. Snapshotting files does not preserve process memory or establish application transaction consistency.

Retain the expected recovery computer's provider lease through the sandbox's existing alarm while its files await
explicit repair or retirement. A ready computer's failed health observation refuses work without ending its identity.
Provider absence ends the live pointer, preserving its committed head, recovery record, and capacity reservation. A historical ended
pointer alone does not establish provider absence; retain only the recovery computer's latest assigned identity.

Stop returns a durable operation receipt before background retirement completes. Repeated requests attach to its current
machine and operation; they cannot hide a retained failure behind another acknowledgement. Expose requested, waiting for
commands, checkpointing, stopping, completed, and failed phases, with timestamps, generation, bounded last error, and a
closed recovery action. Completed requires confirmed provider shutdown and matching final file evidence where writers
were admitted. A failed save leaves repair explicit; a failed provider stop retries its original drain. Retain earlier
receipts after recovery. Inspection never starts a machine, dispatches work, or renews its lease.

Preserve retained Stop and drain operation identities and machine evidence. Leave an unrecorded request time unknown.
A historical committed drain still requires provider confirmation before its receipt claims completed shutdown.

Retain the checkpoint operation, known workspace path and part, transfer phase, and monotonic phase and whole-step
durations in its bounded failure reason. Distinguish request failures from response-body failures. Build this context from admitted
identities; never record raw request URLs, headers, payloads, or commands in the observation. Preserve the terminal
receipt and recovery semantics above.

When an activation requests a file barrier with no live machine, an existing head is insufficient by itself. For an
environment whose machine became ready and could admit writers, require the latest such machine's recorded drain
operation to have a committed file result matching that head's generation. Never-ready startup attempts cannot create
loss evidence or erase unresolved loss from an earlier ready machine. Drain keeps its writers frozen until confirmed
stop. An ordinary earlier snapshot, missing or failed drain, or mismatched generation cannot establish that newer writes
survived machine loss. Preserve the failed barrier receipt. A subsequent command may start a fresh guest from the committed head. A completed quiet model turn does not prove that files were saved. An environment whose
machines never became ready may use its immutable imported head or report Unallocated. A later successful checkpoint
on an explicitly recovered live machine is fresh evidence; it does not retroactively recover or validate lost writes.

After ordinary machine loss, allocate compute when work arrives. Restore and verify the committed head before admitting
a writer, or start empty when no head exists. Unfinished checkpoints and retained file recovery failures still fence
admission. Preserve uncertain command receipts and allow explicit owner maintenance to repair file recovery failures.

Provide an explicit service-authenticated file checkpoint retry for a quiet original ready guest. Bind its durable
operation identity to the caller-observed live machine, failed recovery generation, and committed head. Refuse active
work, allocation, active restoration, maintenance, a current drain, or changed observations. Never allocate, restore, or
dispatch a shell to perform this repair. A completed restoration marker on an already-ready machine is historical data.
Use the existing archive, part transfer, immutable manifest, and atomic commit owners. Keep the old recovery row and
head until the complete new generation commits; retain both when the retry fails. A failed retry's own scratch release
remains durable until acknowledged. Preserve earlier failed receipts and reject changed inputs under the same operation.
After commit, resume retained idle intent and any explicit failed Stop through the normal final frozen drain and provider
confirmation. Do not clear the runtime's model or tool fence merely because an operator requested repair. A file-only
operation creates neither an execution row nor a completion outbox entry.

Count explicit process and browser tool activity toward the existing machine idle deadline. Background execution and
internal observation alone do not retain paid compute indefinitely. Retire all handles when their machine ends.
Once a stop has claimed a machine's drain, later activity cannot postpone that stop by extending its idle deadline.
Continue a matching unfinished stop even when a previously stored idle deadline is still in the future.
Console polling is passive observation. Route it through the admitted runtime owner, preserving authorization and exact process
identity, without renewing a lease or allocating a replacement machine.
Startup credentials follow [execution access](../120-execution-access/CONTRACT.md). A stopped handle does not establish
provider credential revocation, and a running handle does not promise that startup credentials remain valid.

## Checks

For each direct diagnostic execution, does its caller retain the intent and observed outcome before acknowledging its
matching completion? Does an unknown receipt remain pending until its owner and outcome are established?

Hold a dispatched command while stopping its machine. Claim a later Bash, then release the command and require the same
stop to finish. Verify the claimed Bash runs once after the drain and its files survive on the restored machine.
Drain and restore a home whose compressed archive exceeds 512 MiB. Compare the restored file's digest to its original.

Inspect `node/guest/src/processes`, `node/guest/src/quiescence`, and the sandbox checkpoint and machine-drain owners.
Check that a repeated start cannot spawn twice, a changed start is rejected, and a read or stop cannot reach a replacement
machine. Observe natural exit, explicit stop, run cancellation, and machine loss through the existing runtime boundary.
Keep a recovery computer leased across idle alarm cycles and owner replacement without allocating or stopping it.
Return unavailable for a failed health probe while retaining its identity and access to the original repair fence.
Repeat with an ended pointer and the same latest assigned recovery identity; refuse renewal for a later replacement.
Confirm that provider absence preserves the head, recovery, and reservation and ends retention scheduling.

Start an installed process through a real session lease and record its machine and action ID. Observe terminal exit,
explicit stop and machine loss. Restart the service and reread the original receipt. Require one unchanged entry
with its authenticated work and generation. Walk the history across a full page and repeat a terminal observation.
Lookups must leave the model request count and public session events unchanged. Reject changed starts and access
from another session. Preserve pre-cutover receipts without synthesizing a new model wake.

During checkpoint qualification, keep a managed writer running across ordinary commands. Hold remote upload and require
the exited command's durable result and the next command to progress. Verify one coalesced capture, the stable archive,
resumption after copy, and retained files after restore. Inject a save failure and a provider-stop failure separately;
confirm the former preserves recoverable live files and the latter never resumes writers after the final snapshot.
Repeat Stop and inspect its original receipt after Worker replacement. Inject a failed checkpoint and a failed provider
stop separately; require the actual phase and recovery action, the previous committed head, and retained drain evidence.
Inject R2 head failure 10001 during a real file save and again during its explicit file-only retry. Require the original
recovery row, committed head, actual live files, and failed receipts to survive. Hold manifest publication and verify
that recovery clears only with the atomic new head. Rejoin the successful operation, reject changed fence inputs and
active work, then require the retained Stop to complete without another external Stop or an execution/outbox row.
Fail a guest transfer before headers and while reading its body. Require bounded operation and generation context,
the known part, distinct phases, and elapsed time without request credentials or payloads. Retain the failed receipt,
previous committed head, live files, and capacity ownership.
Seed a pre-receipt drain and inspect it before requesting Stop again. Require the original identity, an unknown request
time, and confirmed shutdown before completion. Historical backfills cannot replace a newer machine's latest receipt.
Interrupt manifest publication after its last part and cancel the generation while publication is in flight. No stale
head or successful receipt may appear. Reject a conflicting immutable manifest or missing referenced manifest on restore.
Verify the qualified guest image reaps an exited orphan. Check SIGTERM forwarding and the child exit status with the
configured init. Record host-group and isolated-container coverage separately. Do not claim cgroup isolation from
process enumeration.
Commit a head, mutate files afterward, and lose the machine before its drain. A later activation barrier must fail without
calling the old head a fresh save. Repeat with a committed matching drain, an unfinished or failed drain, a generation
mismatch, and an imported head with no previously ready machine. A never-ready startup refusal must not create a loss
record or hide loss from an earlier ready machine. Check that the original checkpoint outcome survives replacement.
Run a fresh command after ordinary machine loss. Verify that it can read committed files and the old barrier still
reports its failure. Only the saved generation is recoverable.
An unresolved workspace recovery record must still refuse maintenance rather than silently discard its failure.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
