---
name: code-execution-lifecycle
message: Bound work and preserve authoritative results through failure and interruption.
paths: ["**/*.ts"]
---

## Rules

Give concurrency, deadlines, retries, cancellation, and cleanup explicit owners.
Bound paid and external work across nested operations; give each request exactly one retry owner so that retry layers cannot multiply the intended budget.
Retry known transient failures within that budget, not valid unfavorable results.

Preserve completed work and visible failure states when resuming durable operations.
Define which steps and external effects can repeat after interruption.
Durably record a required external effect's intent and a stable operation identity before starting it, and reconcile an interrupted effect through that identity.
Reject reuse of an operation identity with different inputs.
Never automatically replay an external effect whose outcome is uncertain unless the external system deduplicates it by its operation identity; otherwise reconcile it with that system or surface it for a decision.
When an external system cannot check a precondition and apply an effect atomically, reconcile after the effect and state the remaining race.
Do not claim exactly-once effects without a supporting mechanism.
Surface failures to save authoritative results; never claim work was retained when persistence failed.

A task with external resources must have a cleanup path, owned by its lifecycle, that still runs when its caller fails.
Do not treat cleanup as proof that an external effect was rolled back; keep the effect's record until it is reconciled.

Derive reports and terminal displays from authoritative execution state.
Cosmetic progress and optional diagnostics must not decide success.
Record meaningful transitions and failures at boundaries using consistent identities and bounded, redacted diagnostics; avoid repeated logging through every helper.

## Checks

Trace success, failure, and cancellation through the affected owner.
Check the total request budget, retained results, and resource cleanup, including delegated work.
For recovery changes, exercise the relevant interruption or restart path and inspect saved state.
Interrupt an external effect after its intent is recorded and before its outcome is confirmed, and confirm that recovery reconciles it without applying the effect twice.
Submit a reused operation identity with different inputs and confirm that it is rejected.
Run the existing lifecycle tests; a passing type check does not establish recovery.

## Local adaptations

Pi owns durable tasks, inbox placement, compaction, and recovery in each MechObject. Mechane records immutable
notifications and effect receipts through Pi transactions. One actor alarm reconciles native work, durable wakes,
and receipt recovery. Do not hold Postgres transactions or HTTP requests open while waiting for a model or human
decision. Contract 124 owns the activation rules.

A native tool records external side-effect identity before dispatch. Retrying a completed tool returns the recorded
result. If an arbitrary command's outcome is unknown, read its original receipt or report uncertainty; never issue a
fresh execution ID merely to recover a missing response. Provider timeouts bound transport, not the truth of an
external effect. Cancellation has durable state and cannot erase unrelated accepted notifications.

The sandbox owns machines, executions, file checkpoints, and stop/recovery. It binds each sandbox to its admitted
workspace and mech. The guest runs commands in owned process groups and terminates those groups at exit or timeout.
Command completion and a committed file checkpoint remain separate recorded facts. A failed save preserves the
previous committed head and keeps the live machine available for recovery. Unmanaged detached processes have no
persistence guarantee; managed processes keep the explicit lifetime defined by contract 127.

Hosted gateway startup disables direct internet access and registers the egress gateway before work. Changed network
policy applies to a replacement machine through the checkpoint lifecycle. Execution and checkpoint IDs survive
transport retries and service replacement. Reusing an ID with different input is refused.

The Worker has no application-owned process listener or World worker. Each request closes its control-store client;
Pi and Durable Object alarms own persisted task recovery. Transient native callbacks use public SDK APIs and owned
cleanup. Durable phases use the SDK-supported clock. Business retries belong to one named owner and retain their
original operation IDs. Existing CLI and build programs keep their Effect-scoped lifecycle.

The shared `stack/src/run-stack-program.ts` owns smoke, dev and retained local-stack process lifetimes. SIGINT and
SIGTERM wait for startup ownership and idempotent stack cleanup before exiting with failure. Repeated signals cannot
bypass cleanup or begin scenarios after interruption. The complete check graph settles static failures before starting
its smoke services.

The local supervisor owns separate celld application and environment processes, the source compiler watch, Console
Vite process, local database, fixtures, and guest HTTPS gateway. Restart the application host without replacing the
environment host. Shutdown first drains admitted guests through the supported Stop receipt, then observes provider
retirement and capacity release before closing serving dependencies. A failed retained drain preserves resources and
records recovery evidence. An explicit ephemeral fixture may discard only its owned disposable resources.

Release publication writes immutable artifacts before advertising their manifest. A failed download or verification
leaves the installed CLI intact. Evals retain their submitted input identities before sending, so restarting an eval
cannot duplicate accepted work.

The bounded control-outbox RPC deadline in `packages/worker/server/src/control/deliver-changes.ts` owns its native
Promise race and timer. Durable Object RPC has no abort signal; the deadline stops the caller waiting, not the remote
effect. Clear the timer on every outcome, preserve the stable delivery identity, and reconcile a lost acknowledgment
through idempotent redelivery. This exception does not admit another worker scheduler or an unowned polling loop.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `typescript/no-floating-promises` (041): enforced, `"error"`
- oxlint `no-void` (041): enforced in phase D, `["error",{"allowAsStatement":true}]`
- oxlint's restricted members (EF-06): enforced in phase F3: `Effect.promise`
- oxlint's restricted members (EF-08): enforced in phase F3: `Effect.acquireUseRelease`, `Effect.addFinalizer`, `Effect.ensuring`, `Scope.make`
- oxlint's restricted members (EF-08): enforced in phase F3: `Scope.provide`
- oxlint's restricted members (EF-08): enforced in phase F3: `Scope.close`
- oxlint's restricted members (EF-09): enforced in phase A: `Effect.timeout`, `Effect.timeoutFail`, `Effect.repeat`
- oxlint `typescript/promise-function-async` (DO-03): enforced in phase F4, `["error",{"checkArrowFunctions":false}]`
- oxlint `typescript/return-await` (DO-03): enforced in phase D, `["error","always"]`
- oxlint `promise/avoid-new` (DO-03): enforced in phase D, `"error"`
- oxlint `promise/always-return` (DO-03): enforced in phase D, `["error",{"ignoreLastCallback":true}]`
- ast-grep `promise-chain` (DO-03): enforced in phase F4
- ast-grep `promise-building` (DO-05): enforced in phase F4
- ast-grep `fetch-signal` (EF-06): enforced in phase F3
- ast-grep `process-signal` (EF-11): enforced in phase F3
- ast-grep `all-concurrency` (EF-10): enforced in phase D
- ast-grep `all-options-concurrency` (EF-10): enforced in phase C1
- ast-grep `for-each-concurrency` (EF-10): enforced in phase D
- ast-grep `for-each-options-concurrency` (EF-10): enforced in phase D

<!-- End of the generated block. -->
