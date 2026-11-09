---
name: model-caching
message: Use native provider caching and conservative reservations for every model request.
paths: ["packages/node/runtime/src/models/**", "packages/node/runtime/src/store/budgets/**", "packages/node/smoke/src/**"]
---

## Rules

Configure model protocol and cache behavior through the supported AI SDK provider. Keep provider-specific message
serialization and usage parsing upstream. Custom model wrappers own credential resolution, attribution, and metering;
they do not maintain a second model protocol.

Keep provider session identity stable for one mech working context and distinct across independent mechs. Preserve
instructions and native message ordering when requesting cache reuse across activations. A notification source does
not create another cache identity or model owner. A retry retains its original workspace, context, and activation.
Prompt compaction may summarize context but must not discard the canonical retained history or bypass attempt metering.

Reserve before every provider request without assuming a cache hit. Cover cache-write prices, uncached input, and the
maximum allowed output. Record attempts separately so retries and compaction cannot escape the ledger. Settle actual
reported cache reads and writes at their respective rates; missing usage remains unknown and conservatively charged.
The allowance store owns atomic reservation and settlement. A stable Workflow step identity binds each paid attempt
to its reservation. A duplicate pending attempt is uncertain; a settled attempt is not dispatched again. The model
adapter disables automatic provider/agent retries that could repeat an unconfirmed paid request under another receipt.

## Checks

Use the actual provider adapter against a scripted local HTTP service to inspect cache hints and usage settlement.
Qualify a cache miss, reported cache read/write usage, and a retried model request with one final settlement per attempt.

Hosted cache measurements establish whether the provider served a hit; local request inspection establishes only
protocol behavior. Record measured hit rates and limitations in the delivery work record, not as a contract promise.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
