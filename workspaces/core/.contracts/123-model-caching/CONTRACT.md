---
name: model-caching
message: Use native provider caching and conservative reservations for every model request.
paths: ["packages/worker/runtime/src/{models,managed,actor,views}/**", "packages/worker/authority-store/src/store/provider-attempts.ts", "packages/worker/managed-store/src/store/managed/**", "packages/node/smoke/src/**"]
---

## Rules

Configure model protocol and cache behavior through the supported Pi provider. Keep provider-specific message
serialization and usage parsing upstream. Custom model wrappers own credential resolution, attribution, and metering;
they do not maintain a second model protocol.

Keep provider session identity stable for one session thread's working context and distinct across independent contexts. Preserve
instructions and native message ordering when requesting cache reuse across activations. A notification source does
not create another cache identity or model owner. A retry retains its original workspace, context, and activation.
Prompt compaction may summarize context but must not discard the canonical retained history or bypass attempt metering.

Reserve before every provider request without assuming a cache hit. Cover cache-write prices, uncached input, and the
maximum allowed output. Record attempts separately so retries and compaction cannot escape the ledger. Settle actual
reported cache reads and writes at their respective rates; missing usage remains unknown and conservatively charged.
The Postgres control store owns atomic reservation and settlement. A durable attempt identity binds each paid request
to its native generation and reservation. A duplicate pending attempt is uncertain; a settled attempt is not dispatched
again. Native Pi retries receive distinct attempt identities and reservations. The transport prevents hidden provider
retries under one receipt.

Keep failed requests diagnosable through their existing turn, generation task, and attempt identities. Before recording a native failure,
retain only a bounded category, recognized SDK or provider error type, allowlisted code and parameter name, and numeric
HTTP error status. Apply the same boundary to thrown errors and structured error parts inside successful HTTP streams.
Retain an available provider generation ID only from that request's native response metadata or known generation header,
validated against the provider's bounded ID grammar. Never borrow an ID from another attempt or retain other headers.
Discard arbitrary error text, metadata, headers, request bodies, prompt contents, and credentials; unknown values do not
become diagnostic strings. A diagnostic does not authorize another attempt or release its conservative spend reservation.
Preserve the recognized diagnostic through the existing terminal run record and revalidate it when projecting native
errors into authenticated traces. Retain a generic failure for other native errors rather than forwarding their text.

For a managed session, bind the provider call to its pinned model, thread, current execution owner and Pi provider
session. Check these bindings before dispatch, including during compaction and recovery. Resolve Claude API names to
explicitly offered equivalents. An unavailable model or an upstream response for a different model fails the request.
Keep the public model identifier on emitted assistant events. Send the pinned effort and speed using the configured
gateway protocol. Require an explicit fast price and the provider's fast usage receipt to charge a fast request. A
downgraded or unconfirmed speed on that request cannot settle at either rate.

Resolve short-lived gateway credentials from the installation's authenticated HTTPS supplier. Bind the request to the
live session, its durable creator and its execution owner. Forward only configured metadata keys and freeze those
keys on session creation. Keep each returned bearer within the trusted transport call.

Meter the session's exact list cost separately from the workspace's daily allowance. Require explicit list prices on
budgeted models. A decision made between model calls can pause new work without losing the completed call or its tool
results. An unconfirmed upstream charge keeps its reserve. Release a marked dispatch only when the caller still has
local proof that it never entered the network transport.

## Checks

Use the actual provider adapter against a scripted local HTTP service to inspect cache hints and usage settlement.
Qualify a cache miss, reported cache read/write usage, and a retried model request with one final settlement per attempt.
Return a structured stream error containing actionable fields and private canaries. Inspect the replayed native trace
for the safe category and status, and confirm that neither private fields nor another provider call appear on replay.

Exercise two sessions with the same model on one agent. Change the active thread before transport dispatch and verify
the superseded call sends no request. Return another model from a synthetic gateway and verify the caller receives an
error. Compare a session budget crossing, a concurrent retry, and a lost usage receipt against the real Postgres ledger.

Exercise both gateway formats with actual Pi requests. Verify requested effort, speed, the served model, cache usage,
and the separate fast rate. Return standard speed for a fast request and confirm the missing fast receipt.

Inspect a direct assertion callback using a real TLS endpoint and the session store. Verify the creator and forwarded
fields, reject mutations to forwarded metadata, and confirm another workspace or runtime cannot obtain the assertion.

Hosted cache measurements establish whether the provider served a hit; local request inspection establishes only
protocol behavior. Record measured hit rates and limitations in the delivery work record, not as a contract promise.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
