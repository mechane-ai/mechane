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

Workflow SDK owns durable execution, step retries, sleeps, and waits in the Node runtime. Each accepted input has one
stable run identity. The domain store owns admission and per-mech order; native hooks wake queued runs. Keep these
transactions short. Do not hold a database transaction or an HTTP request open while waiting for a model or approval.

A workflow step records external side-effect identity before dispatch. Retrying a completed step returns the recorded
result. If an arbitrary command's outcome is unknown, read its original receipt or report uncertainty; never issue a
fresh execution ID merely to recover a missing response. Provider timeouts bound transport, not the truth of an
external effect. Cancellation has a durable state and cannot erase accepted inputs queued behind the canceled run.

The sandbox owns machines, executions, file checkpoints, and stop/recovery. It binds each sandbox to its admitted
workspace and mech. The guest runs commands in owned process groups and terminates those groups at exit or timeout.
Completed command receipts commit only after their file checkpoint. A failed save preserves the previous committed
head and keeps the live machine available for recovery. Detached processes have no persistence guarantee.

Container startup disables direct internet access and registers the egress gateway before work. Changed network
policy applies to a replacement machine through the checkpoint lifecycle. Execution and checkpoint IDs survive
transport retries and service replacement. Reusing an ID with different input is refused.

The Node server closes its HTTP listener, Workflow worker, and owned database pools during shutdown. Bounded shutdown
may leave durable work pending; a replacement process resumes that work from the SDK's state. Native asynchronous
callbacks, Promise composition, and resource cleanup use the SDK's native APIs. Wall-clock reads belong in steps;
workflow code uses only the SDK-supported deterministic clock. Business retries belong to one named owner and retain
their original operation IDs. Existing CLI and build programs keep their Effect-scoped lifecycle.

The server's `lifecycle/shutdown.ts` is the sole server process-exit owner. Successful shutdown exits with status zero
after the HTTP listener, Workflow worker, hooks and database pools have closed; SDK global handles cannot keep a
drained server alive. Failed shutdown or the bounded grace-period deadline exits with a failure status. Pending work
remains durable; shutdown does not mark it completed or make uncertain effects safe to repeat. No domain or SDK tool
gains process-exit authority from this exception. Repeated shutdown signals retain the same cleanup owner and cannot
restore the process's default immediate-exit behavior while that cleanup is pending.

The shared `stack/src/run-stack-program.ts` owns smoke, dev and retained local-stack process lifetimes. SIGINT and
SIGTERM wait for startup ownership and idempotent stack cleanup before exiting with failure. Repeated signals cannot
bypass cleanup or begin scenarios after interruption. The complete check graph settles static failures before starting
its smoke services.

The local sandbox emulator runs in a child process so its global signal handlers cannot terminate the stack owner.
Its `stack/src/sandbox/main.ts` entrypoint closes the emulator through its public disposal API before exiting. The
parent owns child startup, bounded shutdown and the surrounding guest resources; losing the parent also closes the
emulator child. This local fixture boundary adds no process-exit authority to production sandbox or domain code.

Release publication writes immutable artifacts before advertising their manifest. A failed download or verification
leaves the installed CLI intact. Evals retain their submitted input identities before sending, so restarting an eval
cannot duplicate accepted work.

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
