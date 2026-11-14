---
name: durable-agent-runtime
message: Give each mech one Pi execution owner with durable recovery, guarded tools, and metered provider attempts.
paths: ["packages/shared/bash/**", "packages/worker/runtime/**", "packages/worker/server/**", "packages/worker/control-store/**"]
---

## Rules

Run one pi-durable Harness and working conversation per mech in its Durable Object. Use supported public APIs and the
upstream storage adapter. Pi owns input placement, model/tool execution, compaction, and task recovery. Mechane owns
notification identity, current authority, environment boundaries, and explicit publications. Keep a second execution
engine, dependency patches, private SDK imports, and a separate run scheduler out of the application.

Do not impose a fixed model or tool round count on the root conversation. Current budgets, authority, and cancellation
bound continued work. Reconcile runtime-owned native configuration on every actor open through supported Pi APIs,
clearing a previously stored round limit without changing working context, history, or the human definition revision.
Retain a known native termination cause in safe trace evidence for historical failures without exposing raw errors.

Keep shared accounts, definitions, grants, budgets, and capacity in the Postgres control store. Its transactions own
those invariants. Actor status in Postgres is a read projection, never execution or cancellation authority. Reliable
cross-store delivery uses an immutable outbox identity and recipient acknowledgment. A committed outbox must have a
bounded recovery sweep; it does not drive the agent loop.

Persist an optional native-tool allowlist with the definition and its revisions. An absent or null selection retains
the ordinary product tools; an empty list exposes none. Keep granted MCP tools independently scoped. Filter the native
model registrations and check current selection before new native effects or pending dispatch. Reconcile an identical
admitted terminal receipt before rejecting a newly revoked tool, without starting another effect. Pi may interrupt cold
replay when a removed registration no longer resolves; preserve the original application receipt and report that limit.

Capture a configuration operation's exact recipient outbox rows only after their control transaction commits. Refresh
those recipients through the shared idempotent delivery owner and confirm their immutable identities before returning
command success. Do not hold a Postgres transaction over actor RPC or drain unrelated backlog to acknowledge a command.
A bounded confirmation failure reports persisted configuration with unconfirmed runtime refresh, without repeating the
mutation. A factual recipient acknowledgment survives concurrent sweep claims and later delivery failures. Select
connection recipients from current grants before deleting them; workspace policy changes reach every mech. Skip remote
tool discovery for inactive recipients and load their current grants when they resume.

Keep each bounded, serialized definition refresh alive in its recipient actor until it settles. An expired caller
confirmation must leave the refresh queue able to process later changes. The same durable outbox receipt remains
available to the scheduled delivery owner until it receives an acknowledgment.

Return an accepted cancellation's durable receipt after stopping its local native work, without waiting for environment
cleanup. Its committed intent immediately fences new effects; the existing actor alarm reconciles remote cancellation
across restart. Keep cold initialization free of remote cancellation waits, and preserve the earliest recovery alarm
while polling.

Acknowledge a canceled foreground command's terminal receipt without admitting a notification or another activation.
Preserve its outcome and execution identity; a stopped activation does not establish the command's outcome. Continue
admitting uncanceled and background completions at most once under their existing notification identity.

Before releasing a quiesced mech, reconcile the environment's retained completion outbox while admission remains fenced.
Durably admit each verified result under its existing identity before acknowledging it. Bound each reconciliation pass;
leave an incomplete resume quiesced and retry through the existing alarm. Do not hold an actor transaction across
environment requests, bypass an export hold, or let a completed read suppress a new unobserved notification.

Persist sanitized remote tool descriptors and availability notices as one bounded native configuration projection
before acknowledging refresh. Rebuild executable adapters locally from it on cold start. It is registry composition,
never permission: retain current policy, connection and grant checks at dispatch. Store no connection URL, credential,
client or session in the projection. Reuse the native document byte guard and tool-count bounds; reject oversize
configuration before acknowledgment. First preparation uses the existing pending-notification owner, and the existing
alarm retries incomplete discovery at a bounded cadence. A completed partial loadout may run available tools with
explicit notices, while required discovery failure cannot produce a positive control acknowledgment. Local tool and
receipt execution must not discover unrelated remote connections.

Use Pi's transaction queue for application documents sharing its storage. Mutate the document draft returned by the
current transaction. A decoded application record is an immutable value: persist its replacement and related indexes in
that same transaction. A local object passed into a draft collection does not retain mutation authority. Arm durable recovery before admission and reconcile
one alarm from pending Pi work, scheduled notifications, and receipt recovery. A request-local Promise or successful
listener startup does not prove that accepted work can resume. Preserve bounded context and inspectable older history
without copying lifetime history into every request.

Keep actor control state independent of lifetime history. Store each application record in a supported native document
family with its lookup and pagination pointers committed atomically. Bound the encoded native document to 7 MiB,
leaving margin below the platform's 8 MB SQL row ceiling. Pending-work indexes contain live identities with bounded
removal; a completed-history hole must not make recovery scan lifetime work. Page historical records and look up turn,
notification, attempt, and effect identities directly. Keep Pi's own inbox, compaction, and storage formats upstream.
A context fork snapshots prepared working context and immutable source scope, sequence, and definition revision. The
paused child receives a passive provenance entry linked to the source; all source history remains readable there.
Do not cache or copy aggregate lifetime history into one fork document.

Bind observed notifications to the actual provider context that proposed a tool. Before each new consequential tool,
check its execution fence, cancellation, current authority, and notification coverage. Missing input returns a typed
not-started result without an effect; Pi then incorporates the steers. Keep the guard inside the execution wrapper so
new dispatch after asynchronous preparation cannot bypass it. Look up an identical prior receipt before applying a
new-effect guard: reconciling an admitted command or publication must retain its original identity and known outcome
when newer input arrives. Execute tool batches serially. Do not allow provider-executed effects to bypass admission.

Expose Pi's native Bash registration through `@mechane-ai/bash`. Its caller supplies the working directory and
invocation-bound executor using native `ExecutionEnv.exec` types. Keep actors, storage, authorization, machine selection,
and receipt tasks in their application owners. Return actual process output and native errors to Pi; internal receipt
JSON is not command stdout. Preserve known exits, timeout, cancellation, truncation evidence, and original receipts.
Require an observed exit code on completed shell results. Missing exit evidence must not default to success. Reject an unsupported timeout before dispatch instead of silently clamping it.
Validate the built package from an independent install without sibling workspace source.

When newer input or current authority rejects a confirmed, never-dispatched command's continuation, settle its pending
claim through the sandbox's atomic pending-only cancellation owner. Persist the authoritative returned receipt and let
the native child finish so the next provider context observes the input. Explain confirmed non-dispatch as a refusal,
including the admission reason and the need to reconsider current input before issuing another command. Do not report
it as computer startup failure. A racing dispatch remains running and
observational; do not stop its machine, replay it, or rewrite uncertainty or a terminal outcome.
Record a known native Bash execution failure as a terminal tool invocation while preserving its separate command
receipt. Leave native interruption and retry signals with Pi rather than publishing a false tool failure.

Give commands stable identities derived from their durable tool identity. Reattach to recorded execution on replay;
never rerun an arbitrary shell because the response was lost. Unknown external outcomes require receipt lookup or
reconciliation. Nexus checks its own actions; an issued provider credential retains its explicit scope and lifetime
until expiry or provider revocation. A later local policy change cannot undo an already admitted effect.

Keep a background-process start waiting for machine readiness in a native receipt task with an immutable deadline.
Reuse the original identity and current dispatch checks on each attempt. Report unconfirmed outcomes honestly.
A pending machine without a durable continuation is not a completed start.

Meter every actual paid provider attempt, including compaction and protocol fallback requests. Use one supported Pi
provider wrapper with a trusted HTTP transport. Allocate attempt identity durably, reserve the maximum spend under
current workspace and mech policy, then recheck the actor fence before dispatch. Retries of the reservation retain its
identity; a new paid request receives another reservation. Settle confirmed usage once. An uncertain dispatched request
retains its reservation until evidence resolves it. Buffered SDK progress is not authoritative spending evidence.
The private generation guard checks its native task ownership, cancellation, and control fences. New unobserved input
does not revoke that generation's prepared cutoff; consequential tool and publication admission retains its separate
fresh-input guard. Authenticated HTTP transports use manual redirects and reject non-success responses without
forwarding credentials to another destination.

Keep credentials out of durable model context, tool arguments, and inspection output. Resolve configured references at
the trusted boundary. Treat private completion as quiet. Public messages and reactions require addressed tools under
contract 125. A terminal command result and a committed home revision are separate facts. Persist the command's known
outcome without waiting for background file transfer; checkpoint failure cannot rewrite that outcome or claim saved
files and successful retirement. Required file barriers retain their own blocking result. Preserve actual files,
credentials, receipts, and historical evidence during cutover.

## Checks

Run the same compiled Worker artifact on celld and workerd with real storage, alarms, local TLS Postgres, and
deterministic external providers.
Verify committed-only outbox capture, isolated concurrent commands, duplicate and lost acknowledgment, and late failure
after a positive acknowledgment. After a tool-policy upgrade command succeeds, the next provider request must offer
the current granted tools even when unrelated control delivery is backlogged.
Hold discovery past the caller's confirmation limit and verify the saved change's explicit unconfirmed result. Release
discovery and require a new change to confirm without restarting the actor or repeating the saved mutation.
Restart with remote discovery held: restored native cleanup and local tools must progress from durable descriptors,
and new intake must retain its receipt. Exercise failed and partial discovery, verify unconfirmed acknowledgment, and
inspect the projection for credential canaries and its physical byte bound.
Admit concurrent input, interrupt admission and final idle, restart, and require continued work without duplicate
publications. Steer during a generation and reject its stale tool; inspect the next provider context for all pending
input. Exercise independent mechs, cancellation, failed runs, and compaction. Continue one compacting activation past
32 tool rounds with one publication and complete accounting. Reopen stored native configuration with its old round
limit and unchanged definition; clearing the limit must preserve the conversation identity, history, and working context.

Replay the actual terminal callback of a canceled foreground command and wait for its delivery acknowledgment. Require
no received notification, added activation, or paid request. Inspect durable admission before provider counts so delayed
scheduling cannot hide a wake. Retain the ordinary background completion flow's one-wake guarantee.
Quiesce, stop an environment with a running background process, and resume with its retained completion. Require its
single notification before new work, including after an unavailable environment owner and a repeated callback.

Hold cold readiness beyond the initial request's wait and require one eventual process dispatch without another
notification or model poll. Restart or cancel during preparation and verify the original identity and dispatch fence.

Accept a correction after a shell claim but before dispatch. Require the old command to remain unexecuted, its pending
claim and native wait to settle promptly, and the next provider context to include the correction. Race pending-only
cancellation with dispatch and preserve the original running, uncertain and terminal receipts. Require the refused
command's trace and model result to distinguish non-dispatch from unavailable infrastructure.

Kill the application around tool dispatch and receipt persistence. Reattach to the same command and inspect its
outcome. Lose the guest and require an honest interrupted or uncertain result. Fail a home checkpoint and require
visible failure rather than a saved-generation claim. Local celld does not establish every Cloudflare platform
capability. Import more than 100 bounded history records, force a control-state checkpoint, restart, and verify
paged bodies and stable cursors. Inspect physical document sizes so bounded working context is not mistaken for
bounded stored records. An existing populated target must reject its first history import without changing accepted
data; operator intake fencing and quiescence precede that first batch.

Force compaction, provider retries, lost usage, and a lost reservation acknowledgment. Every actual paid request must
have a distinct admitted reservation; an unfunded request must not reach the provider. Retry settlement and verify
caps remain effective. Inspect serialized state for credential canaries. Review the provider wrapper and command
identity adapter against the pinned upstream public APIs. Generated dependency rules enforce the package owners.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `single-durable-agent-owner` (124): enforced: Use Pi for agent execution, such as `Harness` in the Worker runtime
- dependency-cruiser `shared-bash-native-surface` (124): enforced: Import native Bash tools and environment APIs in the shared binding, such as `createBashTool`; applications own Harness
- dependency-cruiser `durable-harness-owner` (124): enforced: Construct Pi in its Worker owner, such as `Harness` in packages/worker/runtime

<!-- End of the generated block. -->
