---
name: managed-processes
message: Keep managed processes bound to their original machine and preserve files when checkpointing or stopping them.
paths: ["packages/shared/sandbox-wire/**", "packages/shared/protocol/src/operations/environment/**", "packages/node/runtime/src/tools/**", "packages/node/runtime/src/operations/environment.ts", "packages/worker/sandbox/src/**", "packages/worker/sandbox-service/src/**", "packages/worker/sandbox-store/src/**", "packages/node/guest/src/**", "packages/browser/console/src/screens/environment.tsx", "packages/browser/console-views/src/environment.tsx"]
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

Own each process group in the guest scope. Stop that group when its leader exits, on explicit stop, or on guest shutdown.
Preserve processes across ordinary tool waits and native workflow waits. Run cancellation stops processes started by that
run. A child that creates another session is outside an individual group-stop guarantee; only isolated-environment
shutdown or permanent container quiescence owns those escaped sessions.
Persist run cancellation before stopping its work. Late starts and browser actions from that run cannot dispatch.
Cancelling a dispatched foreground shell retains its existing whole-machine retirement boundary. Other managed handles
on that machine become Lost; they do not restart implicitly. Individual managed-process stop preserves other handles.

Freeze new mutations before creating a workspace snapshot. In container scope, pause writers to a verified fixed point
using process identities that distinguish PID reuse. In host process scope, touch only owned groups. Preserve an existing
stop and resume only processes this snapshot paused. Bound failure and release an unsuccessful freeze for recovery.

For an ordinary checkpoint, resume writers once the immutable archive is complete. Keep new mutating admission fenced
until the generation is committed or released. Commit the completed command's receipt with its generation as before.
For a graceful drain, take a fresh final checkpoint and keep writers frozen until provider stop is confirmed.
Negotiate the mode-bearing checkpoint route. Older guests retain their released archive behavior, which terminates
writers, until their machine retires; never send a new request body to that released route.

Preserve live files and the previous committed head after a failed save. A failed provider stop retains the drain fence
and capacity ownership. Snapshotting files does not preserve process memory or establish application transaction consistency.

Count explicit process and browser tool activity toward the existing machine idle deadline. Background execution and
internal observation alone do not retain paid compute indefinitely. Retire all handles when their machine ends.
Console polling is passive observation. Route it through the admitted runtime owner, preserving authorization and exact process
identity, without renewing a lease or allocating a replacement machine.
Startup credentials follow [execution access](../120-execution-access/CONTRACT.md). A stopped handle is not a claim that its original
GitHub token was immediately revoked, and a running handle is not a promise that startup credentials remain valid.

## Checks

Inspect `node/guest/src/processes`, `node/guest/src/quiescence`, and the sandbox checkpoint and machine-drain owners.
Check that a repeated start cannot spawn twice, a changed start is rejected, and a read or stop cannot reach a replacement
machine. Observe natural exit, explicit stop, run cancellation, and machine loss through the existing runtime boundary.

During checkpoint qualification, keep a managed writer running across ordinary commands. Verify the stable archive,
resumption after copy, and retained files after restore. Inject a save failure and a provider-stop failure separately;
confirm the former preserves recoverable live files and the latter never resumes writers after the final snapshot.
Record host-group and isolated-container coverage separately. Do not claim cgroup isolation from process enumeration.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
