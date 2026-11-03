# Bounded turns

An application can submit one finite unit of work to a mech and retrieve its result after disconnecting. The
[bounded-turn operations](../packages/shared/protocol/src/operations/bounded-turns/bounded-turn-operations.ts) and
[schemas](../packages/shared/protocol/src/operations/bounded-turns/schemas.ts) define the API. The CLI exposes the same
operations through `bounded-turn submit`, `bounded-turn show`, and `bounded-turn cancel`.

Create a fresh mech for each independent application session, choose its model and instructions, then submit requests
sequentially. Each request uses a caller-generated UUID. Retrying the same request with identical text and limits
reattaches to its saved result. Changing those inputs under the same UUID conflicts.

The request names a maximum dispatch count, a maximum output-token count **per dispatch**, and an absolute deadline. Pi
owns retries, and each attempt consumes the durable request budget before it can reach the provider. Workspace and mech
daily allowances still apply. A claimed attempt whose outcome is uncertain is never refunded speculatively.

Bounded input waits for earlier work and receives its own turn. Other inbox input cannot join that turn. Bounded turns
can read memory and use the existing sandbox, but cannot spawn drones or use the root-only mutation tools. The host
alarm enforces cancellation and expiry independently of the submitting connection. Queued cancellation retires Pi's
submission as well as its inbox record.

Results retain the reply or terminal reason, dispatch accounting, captured provider request and response bodies, and
committed tool results. Dispatch evidence uses the same IDs as the workspace ledger. An uncaptured request is `null`;
missing responses, actual model IDs, usage, and tool outcomes remain unknown. The export contains only evidence the
runtime observed, including any reasoning the provider explicitly returned. It cannot reveal unreported reasoning.

`evidence_complete` becomes true only after the request ends, cancellation is drained, every claimed attempt has ledger
accounting, and no retained dispatch or tool outcome remains unresolved. A false value requires conservative budget
handling even when the request itself is terminal. Mechane's ledger prices are installation accounting, not a provider
invoice. Transport credentials are excluded, and the exact installation model key is redacted if a body echoes it.

All operations require current workspace membership. Archive a finished application's mech to preserve its evidence
while refusing new input.
