---
name: mech-notifications
message: Admit immutable notifications into one persistent mech and deliver scheduled or external outcomes without held waits.
paths: ["packages/worker/runtime/**", "packages/worker/server/**", "packages/worker/control-store/**", "packages/shared/protocol/src/operations/notifications/**", "packages/shared/protocol/src/operations/routines/**", "packages/node/commands/**"]
---

## Rules

Admit external messages, verified triggers and user decisions through the destination session's event interface.
Authenticate the caller and verify access before writing. Persist canonical input and pending work together or use a
durable outbox with a bounded recovery sweep. Acceptance establishes durable storage. Model observation and external
delivery have independent receipts.

Serialize inputs within their documented session/thread order. Only that scope can affect the selected Pi context.
New arrivals during an external wait enqueue a continuation when allowed by the event protocol. A returned tool
result identifies its original call; it cannot supply authority or the destination for a later action. An uncertain
send of an ordinary message requires reconciliation before repeating a non-idempotent effect.

Keep platform verification, access approval, recurring trigger configuration and provider delivery deduplication in
the installation or integration. Public self-hosted Managed Agents has no schedule or deployment API.
Preserve already admitted events, pending decisions and effect receipts when replacing a historical producer.
Scope future self-wake tools to their authenticated owner and destination; acknowledge a persisted deadline without
holding a model call or shell process.

## Checks

Drive two sessions on the same agent and send independent events while its current execution is busy. Confirm each
event is readable in its own history and reaches only its intended model context. Verify an external wait releases
the identity for other work. Submit a correlated result before idle, after reconnect and after cancellation.
Require the documented response in each case and zero unintended external writes. Reject foreign-session results.
Exercise restart between admission and execution without another prompt from the user.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
