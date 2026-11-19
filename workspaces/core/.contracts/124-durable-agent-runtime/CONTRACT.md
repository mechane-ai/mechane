---
name: durable-agent-runtime
message: Give each mech one Pi execution owner with durable recovery, guarded tools, and metered provider attempts.
paths: ["packages/shared/bash/**", "packages/worker/runtime/**", "packages/worker/server/**", "packages/worker/control-store/**"]
---

## Rules

One named agent owns one durable execution slot across its definition versions. Each Managed Agents session pins its
resolved configuration and keeps an independent history, sandbox and resource scope. Each thread has a separate Pi
working conversation. Use supported Pi APIs for model execution, compaction, and recovery. Accept input durably while
another session runs. Admit model starts, resumes and new agent effects through the same identity owner after restart.
The actor owns each serialized session operation until it settles, even if its caller disconnects. Streaming responses
release the session queue as soon as the response is ready; the stream has its own lifetime.

A wait for a permission, client tool or delegated result releases the slot. Deliver its result to the originating
session, thread and call. A new event in another session cannot steer this generation, invalidate its authority or
select its checkout. Fence stale owners before dispatch. Preserve known external effect receipts through lease changes.
External work already admitted may finish independently. Distinct agent identities may execute concurrently.

Each installed shell and background process receives the public `MECHANE_WORKSPACE_ID`, `MECHANE_AGENT_ID` and
`MECHANE_SESSION_ID` from its authorized work lease, including when no command grant exists. Reserve these names
in both configured variables and credential bindings. They identify the session for external tools. Downstream
services authorize actions with their own credentials.

Do not impose a fixed model or tool round count on a working conversation. Current budgets, authority, and cancellation
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
connection recipients from current grants before deleting them. Workspace policy and its audit record commit together.
Enforce current policy at admission and wake eligible installed work after a change. Policy writes must complete
independently of the number or availability of historical actors and managed sessions. Skip remote tool discovery for
inactive recipients and load their current grants when they resume.

Keep each bounded, serialized definition refresh alive in its recipient actor until it settles. An expired caller
confirmation must leave the refresh queue able to process later changes. The same durable outbox receipt remains
available to the scheduled delivery owner until it receives an acknowledgment.

Return an accepted cancellation's durable receipt after stopping its local native work, without waiting for environment
cleanup. Its committed intent immediately fences new effects; the existing actor alarm reconciles remote cancellation
across restart. Keep cold initialization free of remote cancellation waits, and preserve the earliest recovery alarm
while polling.

Retain known foreground and background execution outcomes under their original owner. A canceled activation alone
does not establish the outcome of a command. Installed process completions are private session observations. Reading
a completion cannot schedule a generation or invent a user or agent event. Contract 127 owns the originating identities
and machine receipt. Preserve pre-cutover outbox entries for their original recipients.

Persist sanitized remote tool descriptors and availability notices as one bounded native configuration projection
before acknowledging refresh. Rebuild executable adapters locally from it on cold start. It is registry composition,
never permission: retain current policy, connection and grant checks at dispatch. Store no connection URL, credential,
client or session in the projection. Reuse the native document byte guard and tool-count bounds; reject oversize
configuration before acknowledgment. First preparation uses the existing pending-notification owner, and the existing
alarm retries incomplete discovery at a bounded cadence. A completed partial loadout may run available tools with
explicit notices, while required discovery failure cannot produce a positive control acknowledgment. Local tool and
receipt execution must not discover unrelated remote connections.

A control-store outage during cold start must leave the actor's local state readable to an authorized caller. Retry
execution preparation through the existing alarm. Restore current policy and the tool registry, reconcile abandoned
provider reservations, and honor pending cancellations before resuming the agent.

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
reconciliation. After an unconfirmed Bash transport response, the original native task observes the same receipt
until its recorded deadline. A missing receipt can race submission. Resume only a confirmed pending claim under
the current dispatch checks. Return a confirmed terminal result as soon as it is known and report uncertainty at
the deadline if the outcome remains unconfirmed. Nexus checks its own actions; an issued provider credential retains
its explicit scope and lifetime until expiry or provider revocation. A later local policy change cannot undo an already
admitted effect.

Keep a background-process start waiting for machine readiness in a native receipt task with an immutable deadline.
Reuse the original identity and current dispatch checks on each attempt. Report unconfirmed outcomes honestly.
A pending machine without a durable continuation is not a completed start.

Meter every actual paid provider attempt, including compaction and protocol fallback requests. Use one supported Pi
provider wrapper with a trusted HTTP transport. Allocate attempt identity durably, reserve the maximum spend under
current workspace and mech policy, then recheck the actor fence before dispatch. Retries of the reservation retain its
identity; a new paid request receives another reservation. Settle confirmed usage once. An uncertain dispatched request
retains its reservation until evidence resolves it. Buffered SDK progress is not authoritative spending evidence.

Only a workspace owner can inspect or set a Managed Agent’s daily spending policy. Resolve the public agent ID
inside the selected workspace and report its stored creator principal. Apply changes to the cap used by provider
admission under the same workspace lock. Preserve the independent workspace limit and record each change in
the audit log. Reapplying the current cap creates no revision or audit entry.

The private generation guard checks its native task ownership, cancellation, and control fences. New unobserved input
does not revoke that generation's prepared cutoff; consequential tool and publication admission retains its separate
fresh-input guard. Authenticated HTTP transports use manual redirects and reject non-success responses without
forwarding credentials to another destination.

Keep credentials out of durable model context, tool arguments, and inspection output. Resolve configured references at
the trusted boundary. Distinguish a failure reserving or authorizing a model request from a failure sending it to
the provider. Preserve the native retry and budget classification. Treat private completion as quiet. Public
messages and reactions require addressed tools under contract 125. A terminal command result and a committed home revision are separate facts. Persist the command's known
outcome without waiting for background file transfer; checkpoint failure cannot rewrite that outcome or claim saved
files and successful retirement. Required file barriers retain their own blocking result. Preserve actual files,
credentials, receipts, and historical evidence during cutover.

## Checks

Use two sessions and two distinguishable contexts on the same agent. Hold A at an external call, run B, return A's
result, interrupt B, replace the actor and reconnect both clients. Verify a single active identity owner, the exact
destination and count of each effect, independent session histories, and the absence of private data across sessions.
Reload immediately after a message is accepted while another session is waiting. Verify the original session serves
its history and finishes the accepted message without another submission.

Run the same compiled Worker artifact on celld and workerd with real storage, alarms, local TLS Postgres, and
deterministic external providers.
Restart a populated actor while its execution policy cannot be read. An authorized history read must succeed. Restore
the policy and verify that accepted work resumes without a replacement actor or a duplicate provider action.
Verify committed-only outbox capture, isolated concurrent commands, duplicate and lost acknowledgment, and late failure
after a positive acknowledgment. After a tool-policy upgrade command succeeds, the next provider request must offer
the current granted tools even when unrelated control delivery is backlogged.
Compare the three installed shell identifiers with the workspace, agent and session returned by their APIs. Check
the same identifiers in a background process and after command-grant revocation. Reject grant names that shadow them.
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

Read a canceled command and completed installed process before and after an owner restart. Verify that each retains
one receipt and that observation does not enqueue a second provider request. Forfeit a machine with a running process
and require a result tied to that original machine.

Hold cold readiness beyond the initial request's wait and require one eventual process dispatch without another
notification or model poll. Restart or cancel during preparation and verify the original identity and dispatch fence.

Accept a correction after a shell claim but before dispatch. Require the old command to remain unexecuted, its pending
claim and native wait to settle promptly, and the next provider context to include the correction. Race pending-only
cancellation with dispatch and preserve the original running, uncertain and terminal receipts. Require the refused
command's trace and model result to distinguish non-dispatch from unavailable infrastructure.
Inspect its retained terminal receipt while subsequent work is running. The read must preserve the current activation.

Drop an acknowledged cold Bash submission response, then kill the application during receipt observation. Require
the original command's terminal tool result without a model status call, with one external effect. Lose the guest
and require an honest interrupted or uncertain result. Fail a home checkpoint and require
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
