---
name: native-workflow-runtime
message: Drive one durable mech context from notifications through bounded native Workflow activations and replay-safe tools.
paths: ["packages/node/runtime/**", "packages/node/server/**"]
---

## Rules

Use AI SDK's public model, tool, message, and stream types. WorkflowAgent and Workflow own the model/tool loop, durable
steps, retries, and resumable execution. Keep dependency patches, private SDK imports, and another agent engine out of
the production path. An activation is a bounded native invocation lifetime, not a task created for every notification.

Keep one identity, definition, context checkpoint, and durable inbox per mech. The domain store owns their authority,
usage, and execution receipts. Admit immutable notifications before acknowledging them. A transaction records their
ordered sequence and durable wake intent. Duplicate identity cannot add another notification or wake effect.

Allow one fenced model owner per mech. Different mechs execute independently. Present newly accepted notifications at
native `prepareStep` boundaries and persist the presented watermark with the context checkpoint. Source metadata is
untrusted input, never an instruction channel or a credential. Do not append active notifications only to a future
activation while the current native loop continues making decisions from stale context. Seed native invocation with a
nonempty context before `prepareStep`; reconstruct current identity instructions separately and do not persist the SDK's
rendered copy of them as conversation. A declared private summary may use a system-role message only with a consistent
`allowSystemInMessages` policy; it remains fallible context and grants no authority. Carry the observed notification cursor
across invocations and activations. Bound the working checkpoint to a private summary and recent native messages; do not
copy lifetime history into every Workflow payload. Persist the current activation's trace before prompt compaction.
Compaction and bounded historical import keep omitted history inspectable rather than deleting it. Checkpoint progress
within an owner is monotonic: a delayed or replayed save cannot rewind context, its presented cursor, or later tool evidence.

Before any new consequential tool dispatch, compare its presented watermark, owner fence, cancellation, and current
authority with the store. A newer notification returns a normal typed `not_started` result for reconsideration and starts
no effect. Replayed receipts retain their existing result. An effect admitted before a later notification is observed
honestly; later context does not erase or automatically repeat it. Use the public native execution boundary rather than
throwing a retryable exception to force reconsideration. Execute local tools serially and apply the guard to every call
in a returned batch. Reject provider-executed tools at capability admission because they bypass the local guard.

Validate runtime-owned tool definitions before constructing WorkflowAgent. Require a local `execute` and reject
`needsApproval: true`, an approval callback, and `onInputStart`, `onInputDelta`, or `onInputAvailable` hooks. Those paths
can block the mech or run before dispatch admission. `needsApproval: false` is allowed. Preserve native schemas and
`toModelOutput` formatters without giving validation or formatting an external-effect role. Native SDK progress callbacks
remain supported; this restriction applies to tool definitions, not to SDK internals. Application approvals use ordinary
request tools and later notifications under contract 121.

Treat native completion without an outward tool call as valid quiet completion. Model text, tool results, activation
completion, refusal, cancellation, and failure do not publish conversational output. Each outward message, reaction, or
presentation requires an explicit addressed tool invocation. Keep private model context separate from public messages.

Bound each activation's model requests and durable history. At idle or rotation, checkpoint context and the inbox cursor,
complete the required file barrier, and decide ownership release with a fresh inbox check under the same store lock.
Unprocessed notifications retain durable wake intent. Native step-budget exhaustion also schedules continuation when
the model ended on tool calls, even if no new notification arrived. Reconcile start attempts after failure so a crash between admission,
workflow start, and idle cannot strand accepted input. A native hook is a wake hint, not the only record of pending work.
Do not promise a saved file generation when its checkpoint failed or merely started. Failed and canceled activations
leave a durable `environment_checkpoint_required` fence unless their barrier committed. The next activation must complete
that barrier before model work or tool dispatch, then clear the fence under its current ownership. A restart cannot
turn an unresolved file save into permission to continue from an unsaved environment.
An older committed head does not satisfy that barrier after a machine may have lost newer files. Require the environment's
current save or verified clean-drain evidence under contract 127. Missing evidence keeps the fence and explicit failure;
restoring older files is recovery, not proof that the lost writes were saved.

Keep Workflow arguments and checkpoints serializable and secret-free. Store references and resolve credentials, live
clients, and provider configuration inside trusted steps. Give consequential effects stable receipt identities. Replay
returns recorded outcomes; uncertainty requires reconciliation before retry. Keep deadlines, cancellation, and terminal
failure explicit. Commit the activation's durable outcome before closing any inspection stream.

Report readiness only after bounded native Workflow health confirms queue execution. A listener or database connection
alone is insufficient. Failed startup closes its listener and World. Preserve actual records and replayable histories
under contracts 047 and 061; the initial fresh-state cutover is not a recurring deployment policy.

## Checks

Run the compiled server with real Postgres and repository-pinned SDKs. Admit concurrent notifications to one mech and
verify one active owner; repeat with independent mechs. Inject a notification after a model decision but before dispatch:
observe `not_started`, no effect, and reconsideration with the new input. Keep an already-admitted effect observable.

Interrupt at admission, start, context checkpoint, and the final idle decision. Restart and verify no lost notification,
duplicate external effect, or unmetered model attempt. Exercise activation rotation with retained context and files.
Cross the context bound and inspect the saved trace and bounded successor prompt. Replay an earlier checkpoint write and
verify it cannot replace later context or consume a notification twice.
A file-barrier failure must preserve the prior committed head and must not claim that the new generation is durable.
Fail or cancel before the barrier, replace the worker, and admit new input. Verify the persisted checkpoint fence blocks
model and tool work until a successful recovery barrier, including when the prior activation has a terminal outcome.
Lose a machine after background writes newer than its committed head. The old generation must not clear the fence or
produce a completed activation. Distinguish this from a verified drain of the latest machine that became ready and from
an immutable imported head whose environment never had a ready machine. Never-ready startup attempts neither create
loss evidence nor erase a prior ready machine's unresolved loss.

Supply a provider tool, a tool without local execution, blocking approval definitions, and each prohibited input hook.
Require construction to fail before a model request or external effect. Native schemas, formatters, and progress callbacks
must continue through the supported public boundary, with `not_started` results remaining valid model input.

Complete a quiet activation and inspect public conversations and external delivery receipts: neither may gain an output.
Verify explicit communication remains visible and idempotent independently of activation termination. Inspect serialized
Workflow state and native trace projections for fixture credentials. Public imports and type checks establish SDK usage;
compiled restart, concurrency, and tool-guard checks establish behavior.

Prevent the native worker from starting and confirm readiness fails. Exercise bounded normal shutdown and startup through
the same packaged path. Review preserved active histories and stored rows before publishing a changed runtime.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `workflow-server-owner` (124): enforced: Keep Workflow execution dependencies in the Node runtime, such as `workflow` in a durable step

<!-- End of the generated block. -->
