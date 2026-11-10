---
name: model-caching
message: Use native provider caching and conservative reservations for every model request.
paths: ["packages/worker/runtime/src/{models,actor,views}/**", "packages/worker/control-store/src/provider-attempt.ts", "packages/worker/control-store/src/store/provider-attempts.ts", "packages/node/smoke/src/**"]
---

## Rules

Configure model protocol and cache behavior through the supported Pi provider. Keep provider-specific message
serialization and usage parsing upstream. Custom model wrappers own credential resolution, attribution, and metering;
they do not maintain a second model protocol.

Keep provider session identity stable for one mech working context and distinct across independent mechs. Preserve
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

## Checks

Use the actual provider adapter against a scripted local HTTP service to inspect cache hints and usage settlement.
Qualify a cache miss, reported cache read/write usage, and a retried model request with one final settlement per attempt.
Return a structured stream error containing actionable fields and private canaries. Inspect the replayed native trace
for the safe category and status, and confirm that neither private fields nor another provider call appear on replay.

Hosted cache measurements establish whether the provider served a hit; local request inspection establishes only
protocol behavior. Record measured hit rates and limitations in the delivery work record, not as a contract promise.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
