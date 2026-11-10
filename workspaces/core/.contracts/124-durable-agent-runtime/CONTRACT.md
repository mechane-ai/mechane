---
name: durable-agent-runtime
message: Give each mech one Pi execution owner with durable recovery, guarded tools, and metered provider attempts.
paths: ["packages/worker/runtime/**", "packages/worker/server/**", "packages/worker/control-store/**"]
---

## Rules

Run one pi-durable Harness and working conversation per mech in its Durable Object. Use supported public APIs and the
upstream storage adapter. Pi owns input placement, model/tool execution, compaction, and task recovery. Mechane owns
notification identity, current authority, environment boundaries, and explicit publications. Keep a second execution
engine, dependency patches, private SDK imports, and a separate run scheduler out of the application.

Keep shared accounts, definitions, grants, budgets, and capacity in the Postgres control store. Its transactions own
those invariants. Actor status in Postgres is a read projection, never execution or cancellation authority. Reliable
cross-store delivery uses an immutable outbox identity and recipient acknowledgment. A committed outbox must have a
bounded recovery sweep; it does not drive the agent loop.

Capture a configuration operation's exact recipient outbox rows only after their control transaction commits. Refresh
those recipients through the shared idempotent delivery owner and confirm their immutable identities before returning
command success. Do not hold a Postgres transaction over actor RPC or drain unrelated backlog to acknowledge a command.
A bounded confirmation failure reports persisted configuration with unconfirmed runtime refresh, without repeating the
mutation. A factual recipient acknowledgment survives concurrent sweep claims and later delivery failures. Select
connection recipients from current grants before deleting them; workspace policy changes reach every mech. Skip remote
tool discovery for inactive recipients and load their current grants when they resume.

Return an accepted cancellation's durable receipt after stopping its local native work, without waiting for environment
cleanup. Its committed intent immediately fences new effects; the existing actor alarm reconciles remote cancellation
across restart. Keep cold initialization free of remote cancellation waits, and preserve the earliest recovery alarm
while polling.

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

Give commands stable identities derived from their durable tool identity. Reattach to recorded execution on replay;
never rerun an arbitrary shell because the response was lost. Unknown external outcomes require receipt lookup or
reconciliation. Nexus checks its own actions; an issued provider credential retains its explicit scope and lifetime
until expiry or provider revocation. A later local policy change cannot undo an already admitted effect.

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
contract 125. A command result and a committed home revision are separate facts; a failed checkpoint cannot claim saved
files or successful retirement. Preserve actual files, credentials, receipts, and historical evidence during cutover.

## Checks

Run the same compiled Worker artifact on celld and workerd with real storage, alarms, local TLS Postgres, and
deterministic external providers.
Verify committed-only outbox capture, isolated concurrent commands, duplicate and lost acknowledgment, and late failure
after a positive acknowledgment. After a tool-policy upgrade command succeeds, the next provider request must offer
the current granted tools even when unrelated control delivery is backlogged.
Restart with remote discovery held: restored native cleanup and local tools must progress from durable descriptors,
and new intake must retain its receipt. Exercise failed and partial discovery, verify unconfirmed acknowledgment, and
inspect the projection for credential canaries and its physical byte bound.
Admit concurrent input, interrupt admission and final idle, restart, and require continued work without duplicate
publications. Steer during a generation and reject its stale tool; inspect the next provider context for all pending
input. Exercise independent mechs, cancellation, failed runs, and compaction.

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
- dependency-cruiser `durable-harness-owner` (124): enforced: Construct Pi in its Worker owner, such as `Harness` in packages/worker/runtime

<!-- End of the generated block. -->
